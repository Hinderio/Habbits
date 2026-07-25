(() => {
  'use strict';

  if (window.__habitFlowProjectIdeaBridgeInstalled) return;
  window.__habitFlowProjectIdeaBridgeInstalled = true;

  const STATE_KEY = 'habitflow-state-v1';
  const CONTEXT_KEY = 'habitflow-idea-project-context-v1';
  const IDEA_PROJECT_LINKS_KEY = 'habitflow-idea-project-links-v1';
  const META_RE = /\n?\s*<!--hf-idea-meta:([^>]+)-->/;
  const RETRY_DELAYS = [120, 360, 800, 1400, 2400, 3600];
  const IDEA_STATUSES = new Set(['open', 'accepted', 'dismissed']);
  const IDEA_CATEGORIES = {
    focus: 'Fokus',
    health: 'Gesundheit',
    consumption: 'Konsum',
    habit: 'Habit',
    admin: 'Admin',
    experiment: 'Experiment'
  };
  const PRIORITIES = {
    low: 'Niedrig',
    medium: 'Normal',
    high: 'Hoch',
    urgent: 'Dringend'
  };
  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.4L19.7 8.7a2.1 2.1 0 0 0 0-3l-1.4-1.4a2.1 2.1 0 0 0-3 0L4 15.6V20Z"></path><path d="m13.8 5.8 4.4 4.4"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 7V5h6v2"></path><path d="M7 7l1 13h8l1-13"></path></svg>'
  };

  let supabaseClient = null;
  let lastProjectFieldSignature = '';
  let syncProjectFieldQueued = false;
  let repairLinksQueued = false;

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state || {}));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/projects] Ideen-Projekt-Verknuepfung konnte lokal nicht gespeichert werden.', error);
      return false;
    }
  }

  function readIdeaProjectLinks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(IDEA_PROJECT_LINKS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeIdeaProjectLinks(links) {
    try {
      localStorage.setItem(IDEA_PROJECT_LINKS_KEY, JSON.stringify(links || {}));
    } catch (error) {
      console.warn('[HabitFlow/projects] Ideen-Projekt-Linkregister konnte nicht gespeichert werden.', error);
    }
  }

  function rememberIdeaProject(ideaId, projectId) {
    if (!ideaId || !projectId) return;
    const links = readIdeaProjectLinks();
    links[String(ideaId)] = String(projectId);
    writeIdeaProjectLinks(links);
  }

  function forgetIdeaProject(ideaId) {
    if (!ideaId) return;
    const links = readIdeaProjectLinks();
    if (!Object.prototype.hasOwnProperty.call(links, String(ideaId))) return;
    delete links[String(ideaId)];
    writeIdeaProjectLinks(links);
  }

  function escapeHtml(value = '') {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function clampStoryPoints(value) {
    const points = Number(value || 2);
    return [1, 2, 3, 5, 8].includes(points) ? points : 2;
  }

  function normalizePriority(value) {
    const key = String(value || 'medium').trim().toLowerCase();
    return PRIORITIES[key] ? key : 'medium';
  }

  function normalizeCategory(value) {
    const key = String(value || 'focus').trim();
    return IDEA_CATEGORIES[key] ? key : 'focus';
  }

  function normalizeIdeaStatus(value) {
    const key = String(value || 'open').trim();
    return IDEA_STATUSES.has(key) ? key : 'open';
  }

  function normalizeRating(value) {
    const numeric = Math.round(Number(value || 0));
    return Math.max(0, Math.min(5, Number.isFinite(numeric) ? numeric : 0));
  }

  function cleanDescription(value = '') {
    return String(value || '').replace(META_RE, '').trim();
  }

  function parseMeta(value = '') {
    const match = String(value || '').match(META_RE);
    if (!match) return {};
    try {
      const decoded = JSON.parse(decodeURIComponent(match[1] || ''));
      return decoded && typeof decoded === 'object' ? decoded : {};
    } catch {
      return {};
    }
  }

  function descriptionWithMeta(description = '', extraMeta = {}) {
    const clean = cleanDescription(description);
    const meta = { ...parseMeta(description), ...extraMeta };
    Object.keys(meta).forEach(key => {
      if (meta[key] == null || meta[key] === '') delete meta[key];
    });
    if (!Object.keys(meta).length) return clean;
    return `${clean ? `${clean}\n\n` : ''}<!--hf-idea-meta:${encodeURIComponent(JSON.stringify(meta))}-->`;
  }

  function ideaProjectId(idea = {}) {
    const direct = String(idea.project_id || idea.projectId || parseMeta(idea.description).project_id || '');
    if (direct) return direct;
    return idea?.id ? String(readIdeaProjectLinks()[String(idea.id)] || '') : '';
  }

  function applyIdeaProjectLinksToState(state, { markUnsynced = false } = {}) {
    if (!state || !Array.isArray(state.taskIdeas)) return { state, changed: false, restored: [] };
    const links = readIdeaProjectLinks();
    let linksChanged = false;
    let changed = false;
    const restored = [];
    state.taskIdeas = state.taskIdeas.map(idea => {
      if (!idea?.id) return idea;
      const ideaId = String(idea.id);
      const directProjectId = String(idea.project_id || idea.projectId || parseMeta(idea.description).project_id || '');
      if (directProjectId) {
        if (links[ideaId] !== directProjectId) {
          links[ideaId] = directProjectId;
          linksChanged = true;
        }
        return idea;
      }
      const linkedProjectId = String(links[ideaId] || '');
      if (!linkedProjectId) return idea;
      changed = true;
      const next = {
        ...idea,
        project_id: linkedProjectId,
        projectId: linkedProjectId,
        description: descriptionWithMeta(idea.description, { project_id: linkedProjectId })
      };
      if (markUnsynced) {
        next.synced = false;
        next.updated_at = next.updated_at || new Date().toISOString();
      }
      restored.push(next);
      return next;
    });
    if (linksChanged) writeIdeaProjectLinks(links);
    return { state, changed, restored };
  }

  function activeProjects() {
    return (readState().projects || [])
      .filter(project => project?.id && !project.is_archived)
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de'));
  }

  function projectById(projectId) {
    return activeProjects().find(project => String(project.id) === String(projectId || '')) || null;
  }

  function readContext() {
    let parsed = null;
    try {
      const raw = sessionStorage.getItem(CONTEXT_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return parsed?.project_id ? parsed : null;
  }

  function writeContext(projectId) {
    const project = projectById(projectId);
    if (!project) return null;
    const context = {
      project_id: String(project.id),
      project_title: String(project.title || 'Projekt'),
      project_color: project.color || null,
      created_at: Date.now()
    };
    try {
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch {
      window.__habitFlowIdeaProjectContext = context;
    }
    return context;
  }

  function clearContext() {
    try {
      sessionStorage.removeItem(CONTEXT_KEY);
    } catch {}
    if (window.__habitFlowIdeaProjectContext) delete window.__habitFlowIdeaProjectContext;
  }

  function ensureProjectField() {
    const form = document.getElementById('taskIdeaForm');
    if (!form || form.elements.project_id) return form?.elements.project_id || null;
    const noteLabel = form.querySelector('textarea[name="description"]')?.closest('label');
    const field = document.createElement('label');
    field.dataset.taskIdeaProjectField = 'true';
    field.innerHTML = '<span>Projekt</span><select name="project_id"></select>';
    if (noteLabel) noteLabel.insertAdjacentElement('beforebegin', field);
    else form.appendChild(field);
    return field.querySelector('select');
  }

  function syncProjectField() {
    const select = ensureProjectField();
    if (!select) return;
    const context = readContext() || window.__habitFlowIdeaProjectContext || null;
    const projects = activeProjects();
    const selected = context?.project_id || select.value || '';
    const value = projects.some(project => String(project.id) === String(selected)) ? String(selected) : '';
    const signature = `${value}|${projects.map(project => `${project.id}:${project.title || ''}`).join('|')}`;
    if (signature === lastProjectFieldSignature && select.value === value) return;
    lastProjectFieldSignature = signature;
    select.innerHTML = [
      '<option value="">Kein Projekt</option>',
      ...projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title || 'Projekt')}</option>`)
    ].join('');
    select.value = value;
  }

  function queueSyncProjectField(delay = 0) {
    if (syncProjectFieldQueued) return;
    syncProjectFieldQueued = true;
    window.setTimeout(() => {
      syncProjectFieldQueued = false;
      syncProjectField();
    }, delay);
  }

  function openIdeaMask(projectId) {
    if (!writeContext(projectId)) return;
    document.querySelector('.nav-btn[data-target="tasks"]')?.click();
    window.setTimeout(() => {
      const panel = document.getElementById('taskIdeasPanel');
      const toggle = document.getElementById('taskIdeasToggleBtn');
      if (panel?.classList.contains('hidden')) toggle?.click();
      syncProjectField();
      document.querySelector('#taskIdeaForm [name="title"]')?.focus({ preventScroll: false });
    }, 90);
  }

  function persistIdeaProject(ideaId, projectId) {
    if (!ideaId || !projectId) return false;
    rememberIdeaProject(ideaId, projectId);
    const state = readState();
    const ideas = Array.isArray(state.taskIdeas) ? state.taskIdeas : [];
    const now = new Date().toISOString();
    let changed = false;
    state.taskIdeas = ideas.map(idea => {
      if (String(idea?.id || '') !== String(ideaId)) return idea;
      changed = true;
      return {
        ...idea,
        project_id: String(projectId),
        projectId: String(projectId),
        description: descriptionWithMeta(idea.description, { project_id: String(projectId) }),
        updated_at: now,
        synced: false
      };
    });
    if (!changed) return false;
    writeState(state);
    const updatedIdea = state.taskIdeas.find(idea => String(idea?.id || '') === String(ideaId));
    syncRemoteIdeaProject(updatedIdea, projectId, now).then(synced => {
      if (!synced) return;
      const fresh = readState();
      fresh.taskIdeas = (fresh.taskIdeas || []).map(idea => String(idea?.id || '') === String(ideaId) ? { ...idea, synced: true } : idea);
      writeState(fresh);
      window.dispatchEvent(new Event('habitflow:projects-changed'));
    });
    window.dispatchEvent(new Event('habitflow:projects-changed'));
    return true;
  }

  function newestCreatedIdea(beforeIds, createdAt = Date.now()) {
    const createdAfter = Number(createdAt || Date.now()) - 60000;
    return (readState().taskIdeas || [])
      .filter(idea => idea?.id && !beforeIds.has(String(idea.id)))
      .filter(idea => !createdAfter || Date.parse(idea.created_at || idea.updated_at || '') >= createdAfter)
      .sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0] || null;
  }

  function linkCreatedIdea(beforeIds, projectId, createdAt, attempt = 0) {
    const idea = newestCreatedIdea(beforeIds, createdAt);
    if (idea) {
      persistIdeaProject(idea.id, projectId);
      clearContext();
      return;
    }
    const delay = RETRY_DELAYS[attempt];
    if (delay) window.setTimeout(() => linkCreatedIdea(beforeIds, projectId, createdAt, attempt + 1), delay);
  }

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const config = window.HABITFLOW_SUPABASE_CONFIG;
    const createClient = window.supabase?.createClient;
    if (!config?.url || !config?.anonKey || typeof createClient !== 'function') return null;
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return supabaseClient;
  }

  async function syncRemoteTaskProject(taskId, projectId, updatedAt) {
    const client = getSupabaseClient();
    if (!client || !taskId || !projectId) return false;
    const { error } = await client.from('tasks').update({ project_id: projectId, updated_at: updatedAt }).eq('id', taskId);
    if (error) {
      console.warn('[HabitFlow/projects] Ideen-Task konnte remote nicht mit Projekt verknuepft werden.', error);
      return false;
    }
    return true;
  }

  async function syncRemoteIdeaProject(idea, projectId, updatedAt) {
    const client = getSupabaseClient();
    if (!client || !idea?.id || !projectId) return false;
    const description = descriptionWithMeta(idea.description, { project_id: String(projectId) });
    const { error } = await client.from('task_ideas').update({ description, updated_at: updatedAt }).eq('id', idea.id);
    if (error) {
      console.warn('[HabitFlow/projects] Idee konnte remote nicht mit Projekt verknuepft werden.', error);
      return false;
    }
    return true;
  }

  function repairIdeaProjectLinks({ syncRemote = true } = {}) {
    const state = readState();
    const result = applyIdeaProjectLinksToState(state, { markUnsynced: true });
    if (!result.changed) return false;
    writeState(result.state);
    window.dispatchEvent(new Event('habitflow:projects-changed'));
    if (syncRemote) {
      result.restored.forEach(idea => {
        syncRemoteIdeaProject(idea, ideaProjectId(idea), idea.updated_at || new Date().toISOString());
      });
    }
    return true;
  }

  function queueRepairIdeaProjectLinks(delay = 0) {
    if (repairLinksQueued) return;
    repairLinksQueued = true;
    window.setTimeout(() => {
      repairLinksQueued = false;
      repairIdeaProjectLinks();
    }, delay);
  }

  function ideaProjectMap() {
    const pairs = new Map();
    (readState().taskIdeas || []).forEach(idea => {
      const projectId = ideaProjectId(idea);
      if (idea?.id && projectId) pairs.set(String(idea.id), String(projectId));
    });
    return pairs;
  }

  function restoreIdeaProjectLinks(projectByIdeaId) {
    if (!projectByIdeaId?.size) return false;
    const state = readState();
    const ideas = Array.isArray(state.taskIdeas) ? state.taskIdeas : [];
    const now = new Date().toISOString();
    let changed = false;
    const remoteUpdates = [];
    state.taskIdeas = ideas.map(idea => {
      const projectId = projectByIdeaId.get(String(idea?.id || ''));
      if (!idea?.id || !projectId || ideaProjectId(idea)) return idea;
      changed = true;
      const next = {
        ...idea,
        project_id: projectId,
        projectId: projectId,
        description: descriptionWithMeta(idea.description, { project_id: projectId }),
        updated_at: now,
        synced: false
      };
      remoteUpdates.push(next);
      return next;
    });
    if (!changed) return false;
    writeState(state);
    remoteUpdates.forEach(idea => {
      syncRemoteIdeaProject(idea, ideaProjectId(idea), idea.updated_at).then(synced => {
        if (!synced) return;
        const fresh = readState();
        fresh.taskIdeas = (fresh.taskIdeas || []).map(item => String(item?.id || '') === String(idea.id) ? { ...item, synced: true } : item);
        writeState(fresh);
      });
    });
    window.dispatchEvent(new Event('habitflow:projects-changed'));
    return true;
  }

  async function syncRemoteIdea(idea) {
    const client = getSupabaseClient();
    if (!client || !idea?.id) return false;
    const row = {
      title: idea.title,
      description: descriptionWithMeta(idea.description, { project_id: ideaProjectId(idea), rating: normalizeRating(idea.rating) || undefined }),
      category: normalizeCategory(idea.category),
      story_points: clampStoryPoints(idea.story_points),
      priority: normalizePriority(idea.priority),
      idea_status: normalizeIdeaStatus(idea.idea_status),
      updated_at: idea.updated_at
    };
    const { error } = await client.from('task_ideas').update(row).eq('id', idea.id);
    if (error) {
      console.warn('[HabitFlow/projects] Idee konnte remote nicht gespeichert werden.', error);
      return false;
    }
    return true;
  }

  function ideaById(ideaId) {
    return (readState().taskIdeas || []).find(idea => String(idea?.id || '') === String(ideaId || '')) || null;
  }

  function projectOptions(selectedProjectId = '') {
    return [
      `<option value="">Kein Projekt</option>`,
      ...activeProjects().map(project => `<option value="${escapeHtml(project.id)}" ${String(project.id) === String(selectedProjectId) ? 'selected' : ''}>${escapeHtml(project.title || 'Projekt')}</option>`)
    ].join('');
  }

  function optionList(options, selected) {
    return Object.entries(options).map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  function openIdeaDetail(ideaId) {
    const idea = ideaById(ideaId);
    if (!idea) return;
    const projectId = ideaProjectId(idea);
    const rating = normalizeRating(idea.rating || parseMeta(idea.description).rating);
    const status = normalizeIdeaStatus(idea.idea_status);
    const modal = document.createElement('div');
    modal.className = 'task-idea-detail-modal';
    modal.dataset.taskIdeaDetailModal = 'true';
    modal.innerHTML = `<section class="task-idea-detail-card" role="dialog" aria-modal="true" aria-labelledby="taskIdeaDetailTitle">
      <button class="icon-btn task-idea-detail-close" type="button" data-action="close-task-idea-detail" aria-label="Idee schliessen">×</button>
      <div class="task-idea-detail-head">
        <p class="eyebrow">Idee</p>
        <h2 id="taskIdeaDetailTitle">${escapeHtml(idea.title || 'Idee')}</h2>
        <p>${escapeHtml(IDEA_CATEGORIES[normalizeCategory(idea.category)] || 'Fokus')} · ${clampStoryPoints(idea.story_points)} Story Points · ${escapeHtml(PRIORITIES[normalizePriority(idea.priority)])}</p>
      </div>
      <form id="taskIdeaDetailForm" class="task-idea-detail-form" data-id="${escapeHtml(idea.id)}">
        <label class="full"><span>Titel</span><input name="title" required value="${escapeHtml(idea.title || '')}" /></label>
        <label><span>Projekt</span><select name="project_id">${projectOptions(projectId)}</select></label>
        <label><span>Status</span><select name="idea_status">
          <option value="open" ${status === 'open' ? 'selected' : ''}>Offen</option>
          <option value="accepted" ${status === 'accepted' ? 'selected' : ''}>Umgesetzt</option>
          <option value="dismissed" ${status === 'dismissed' ? 'selected' : ''}>Verworfen</option>
        </select></label>
        <label><span>Kategorie</span><select name="category">${optionList(IDEA_CATEGORIES, normalizeCategory(idea.category))}</select></label>
        <label><span>Story Points</span><select name="story_points">
          ${[1, 2, 3, 5, 8].map(value => `<option value="${value}" ${clampStoryPoints(idea.story_points) === value ? 'selected' : ''}>${value}</option>`).join('')}
        </select></label>
        <label><span>Prioritaet</span><select name="priority">${optionList(PRIORITIES, normalizePriority(idea.priority))}</select></label>
        <label><span>Rating</span><select name="rating">
          ${[0, 1, 2, 3, 4, 5].map(value => `<option value="${value}" ${rating === value ? 'selected' : ''}>${value ? `${value}/5` : 'ohne Rating'}</option>`).join('')}
        </select></label>
        <label class="full"><span>Notiz</span><textarea name="description" rows="5">${escapeHtml(cleanDescription(idea.description || ''))}</textarea></label>
        <div class="form-actions full task-idea-detail-actions">
          <button class="pill primary" type="submit">Idee speichern</button>
          ${status === 'open' ? `<button class="pill secondary" type="button" data-action="idea-to-task" data-id="${escapeHtml(idea.id)}">Als Task</button><button class="pill secondary" type="button" data-action="idea-to-backlog" data-id="${escapeHtml(idea.id)}">In Backlog</button><button class="pill secondary" type="button" data-action="dismiss-task-idea" data-id="${escapeHtml(idea.id)}">Verwerfen</button>` : `<button class="pill secondary" type="button" data-action="reopen-task-idea" data-id="${escapeHtml(idea.id)}">Wieder oeffnen</button>`}
        </div>
      </form>
    </section>`;
    document.querySelector('[data-task-idea-detail-modal]')?.remove();
    document.body.appendChild(modal);
    document.body.classList.add('project-modal-open');
    modal.querySelector('input[name="title"]')?.focus({ preventScroll: true });
  }

  function closeIdeaDetail() {
    document.querySelector('[data-task-idea-detail-modal]')?.remove();
    document.body.classList.remove('project-modal-open');
  }

  function saveIdeaDetail(event) {
    event.preventDefault();
    const form = event.target;
    const ideaId = form.dataset.id;
    const state = readState();
    const idea = (state.taskIdeas || []).find(item => String(item?.id || '') === String(ideaId || ''));
    if (!idea) return;
    const data = new FormData(form);
    const projectId = String(data.get('project_id') || '').trim();
    const rating = normalizeRating(data.get('rating'));
    const now = new Date().toISOString();
    idea.title = String(data.get('title') || '').trim();
    idea.description = descriptionWithMeta(String(data.get('description') || '').trim(), { project_id: projectId, rating: rating || undefined });
    idea.project_id = projectId || null;
    idea.projectId = projectId || null;
    if (projectId) rememberIdeaProject(idea.id, projectId);
    else forgetIdeaProject(idea.id);
    idea.category = normalizeCategory(data.get('category'));
    idea.story_points = clampStoryPoints(data.get('story_points'));
    idea.priority = normalizePriority(data.get('priority'));
    idea.rating = rating;
    idea.idea_status = normalizeIdeaStatus(data.get('idea_status'));
    idea.updated_at = now;
    idea.synced = false;
    writeState(state);
    syncRemoteIdea(idea).then(synced => {
      if (!synced) return;
      const fresh = readState();
      fresh.taskIdeas = (fresh.taskIdeas || []).map(item => String(item?.id || '') === String(idea.id) ? { ...item, synced: true } : item);
      writeState(fresh);
    });
    window.dispatchEvent(new Event('habitflow:projects-changed'));
    closeIdeaDetail();
  }

  function persistTaskProject(taskId, projectId) {
    if (!taskId || !projectId) return false;
    const state = readState();
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const now = new Date().toISOString();
    let changed = false;
    state.tasks = tasks.map(task => {
      if (String(task?.id || '') !== String(taskId)) return task;
      changed = true;
      return { ...task, project_id: String(projectId), projectId: String(projectId), project_link_cleared_at: null, updated_at: now, synced: false };
    });
    if (!changed) return false;
    writeState(state);
    syncRemoteTaskProject(taskId, projectId, now).then(synced => {
      if (!synced) return;
      const fresh = readState();
      fresh.tasks = (fresh.tasks || []).map(task => String(task?.id || '') === String(taskId) ? { ...task, synced: true } : task);
      writeState(fresh);
      window.dispatchEvent(new Event('habitflow:project-task-link-updated'));
    });
    return true;
  }

  function linkTaskCreatedFromIdea(ideaId, projectId, beforeTaskIds, attempt = 0) {
    const state = readState();
    const idea = (state.taskIdeas || []).find(item => String(item?.id || '') === String(ideaId));
    const generatedId = idea?.generated_task_id;
    const task = generatedId
      ? (state.tasks || []).find(item => String(item?.id || '') === String(generatedId))
      : (state.tasks || []).filter(item => item?.id && !beforeTaskIds.has(String(item.id))).sort((a, b) => Date.parse(b.created_at || b.updated_at || 0) - Date.parse(a.created_at || a.updated_at || 0))[0];
    if (task?.id) {
      persistTaskProject(task.id, projectId);
      return;
    }
    const delay = RETRY_DELAYS[attempt];
    if (delay) window.setTimeout(() => linkTaskCreatedFromIdea(ideaId, projectId, beforeTaskIds, attempt + 1), delay);
  }

  function patchStoragePreservation() {
    if (window.__habitFlowProjectIdeaStoragePatched) return;
    window.__habitFlowProjectIdeaStoragePatched = true;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      let nextValue = value;
      if (this === window.localStorage && key === STATE_KEY && typeof value === 'string' && value.includes('"taskIdeas"')) {
        try {
          const parsed = JSON.parse(value);
          const result = applyIdeaProjectLinksToState(parsed, { markUnsynced: true });
          if (result.changed) {
            nextValue = JSON.stringify(result.state);
            window.setTimeout(() => queueRepairIdeaProjectLinks(80), 0);
          }
        } catch {}
      }
      return originalSetItem.call(this, key, nextValue);
    };
  }

  function injectStyle() {
    if (document.getElementById('habitflow-project-idea-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'habitflow-project-idea-bridge-style';
    style.textContent = `
      [data-task-idea-project-field]{display:flex;flex-direction:column;gap:8px}
      .task-idea-detail-modal{position:fixed;inset:0;z-index:88;background:rgba(3,8,13,.68);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(14px);overflow:auto}
      .task-idea-detail-card{position:relative;width:min(980px,100%);max-height:92vh;overflow:auto;border-radius:30px;padding:22px;background:var(--card-strong);border:1px solid var(--card-border);box-shadow:var(--shadow);-webkit-overflow-scrolling:touch}
      .task-idea-detail-close{position:absolute;right:16px;top:16px;z-index:2}
      .task-idea-detail-head{padding-right:56px;margin-bottom:16px}
      .task-idea-detail-head h2{font-size:clamp(1.6rem,4vw,3rem);letter-spacing:-.06em;line-height:1}
      .task-idea-detail-head p:not(.eyebrow){color:var(--muted);font-weight:800;margin-top:8px}
      .task-idea-detail-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .task-idea-detail-form label{display:flex;flex-direction:column;gap:8px}
      .task-idea-detail-form label span{font-size:.86rem;color:var(--muted);font-weight:850}
      .task-idea-detail-form .full{grid-column:1/-1}
      .task-idea-detail-actions{align-items:center}
      #screen-tasks .task-action-icon,.task-detail-modal .task-action-icon{display:inline-grid;place-items:center;width:38px;height:38px;min-width:38px;padding:0;border-radius:999px;background:rgba(74,215,209,.11);border:1px solid rgba(74,215,209,.24);color:var(--primary);box-shadow:none;font-size:0}
      #screen-tasks .task-action-icon svg,.task-detail-modal .task-action-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
      #screen-tasks .task-action-icon:hover,.task-detail-modal .task-action-icon:hover{transform:translateY(-1px);background:rgba(74,215,209,.17);border-color:rgba(74,215,209,.36)}
      #screen-tasks .task-action-icon-delete,.task-detail-modal .task-action-icon-delete{background:rgba(255,99,99,.08);border-color:rgba(255,99,99,.22);color:#b33a3a}
      #screen-tasks .task-action-icon-delete:hover,.task-detail-modal .task-action-icon-delete:hover{background:rgba(255,99,99,.13);border-color:rgba(255,99,99,.32)}
      body.light #screen-tasks .task-action-icon,body.light .task-detail-modal .task-action-icon{background:rgba(74,215,209,.14);border-color:rgba(17,36,58,.08)}
      body.light #screen-tasks .task-action-icon-delete,body.light .task-detail-modal .task-action-icon-delete{background:rgba(255,99,99,.1);border-color:rgba(179,58,58,.16)}
      #screen-tasks .kanban-card .list-actions,#screen-tasks .activity-suggestion-card .idea-actions{display:flex;align-items:flex-end;flex-wrap:wrap;gap:8px}
      #screen-tasks .kanban-card .list-actions>:not(.task-action-icon),#screen-tasks .activity-suggestion-card .idea-actions>:not(.task-action-icon){order:10}
      #screen-tasks .kanban-card .task-action-icon-edit,#screen-tasks .activity-suggestion-card .task-action-icon-edit{order:90;margin-left:auto}
      #screen-tasks .kanban-card .task-action-icon-delete,#screen-tasks .activity-suggestion-card .task-action-icon-delete{order:91;margin-left:0}
      #screen-tasks .kanban-card .task-action-icon + .task-action-icon,#screen-tasks .activity-suggestion-card .task-action-icon + .task-action-icon{margin-left:0}
      @media(max-width:760px){.task-idea-detail-modal{align-items:flex-end;padding:10px 8px calc(env(safe-area-inset-bottom,0px) + 10px)}.task-idea-detail-card{max-height:min(88svh,760px);border-radius:24px 24px 18px 18px;padding:16px 14px 24px}.task-idea-detail-head{padding-right:44px}.task-idea-detail-form{grid-template-columns:1fr}.task-idea-detail-actions{display:grid;grid-template-columns:1fr;align-items:stretch}.task-idea-detail-close{right:12px;top:12px}}
    `;
    document.head.appendChild(style);
  }

  function polishActionButton(button, { icon, label, deleteTone = false }) {
    if (!button || button.dataset.taskIdeaPolished === 'true') return;
    button.dataset.taskIdeaPolished = 'true';
    button.classList.add('task-action-icon', deleteTone ? 'task-action-icon-delete' : 'task-action-icon-edit');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = icon;
  }

  function ensureIdeaEditButtons(root = document) {
    const cards = [
      ...(root.matches?.('#screen-tasks .idea-card') ? [root] : []),
      ...Array.from(root.querySelectorAll?.('#screen-tasks .idea-card') || [])
    ];
    cards.forEach(card => {
      const id = card.querySelector('[data-action="idea-to-task"], [data-action="reopen-task-idea"], [data-action="delete-task-idea"]')?.dataset.id;
      const actions = card.querySelector('.idea-actions');
      if (!id || !actions || actions.querySelector('[data-action="edit-task-idea"]')) return;
      const edit = document.createElement('button');
      edit.className = 'mini-btn';
      edit.type = 'button';
      edit.dataset.action = 'edit-task-idea';
      edit.dataset.id = id;
      edit.textContent = 'Bearbeiten';
      actions.insertBefore(edit, actions.firstChild);
    });
  }

  function polishTaskActions(root = document) {
    ensureIdeaEditButtons(root);
    const editButtons = [
      ...(root.matches?.('#screen-tasks [data-action="edit-task"], #screen-tasks [data-action="edit-task-idea"], #screen-tasks [data-action="edit-activity"], .task-detail-modal [data-action="edit-task"]') ? [root] : []),
      ...Array.from(root.querySelectorAll?.('#screen-tasks [data-action="edit-task"], #screen-tasks [data-action="edit-task-idea"], #screen-tasks [data-action="edit-activity"], .task-detail-modal [data-action="edit-task"]') || [])
    ];
    const deleteButtons = [
      ...(root.matches?.('#screen-tasks [data-action="delete-task"], #screen-tasks [data-action="delete-task-idea"], #screen-tasks [data-action="delete-activity"], .task-detail-modal [data-action="delete-task"]') ? [root] : []),
      ...Array.from(root.querySelectorAll?.('#screen-tasks [data-action="delete-task"], #screen-tasks [data-action="delete-task-idea"], #screen-tasks [data-action="delete-activity"], .task-detail-modal [data-action="delete-task"]') || [])
    ];
    editButtons.forEach(button => {
      polishActionButton(button, { icon: ICONS.edit, label: 'Bearbeiten' });
    });
    deleteButtons.forEach(button => {
      polishActionButton(button, { icon: ICONS.trash, label: 'Loeschen', deleteTone: true });
    });
    alignActionIcons(root);
  }

  function alignActionIcons(root = document) {
    const actionRows = [
      ...(root.matches?.('#screen-tasks .kanban-card .list-actions, #screen-tasks .activity-suggestion-card .idea-actions') ? [root] : []),
      ...Array.from(root.querySelectorAll?.('#screen-tasks .kanban-card .list-actions, #screen-tasks .activity-suggestion-card .idea-actions') || [])
    ];
    actionRows.forEach(row => {
      const edit = row.querySelector(':scope > .task-action-icon-edit');
      const remove = row.querySelector(':scope > .task-action-icon-delete');
      if (edit) row.appendChild(edit);
      if (remove) row.appendChild(remove);
    });
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const addIdea = event.target?.closest?.('#projectTimelineViewMount [data-action="open-project-idea"]');
      if (addIdea?.dataset.id) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openIdeaMask(addIdea.dataset.id);
        return;
      }

      const openIdea = event.target?.closest?.('[data-action="open-task-idea-detail"], [data-action="edit-task-idea"]');
      if (openIdea?.dataset.id) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openIdeaDetail(openIdea.dataset.id);
      }
    }, true);

    document.addEventListener('submit', event => {
      if (event.target?.id === 'taskIdeaDetailForm') {
        saveIdeaDetail(event);
        return;
      }
      if (event.target?.id !== 'taskIdeaForm') return;
      const select = ensureProjectField();
      const context = readContext() || window.__habitFlowIdeaProjectContext || null;
      const projectId = select?.value || context?.project_id || '';
      const textarea = event.target.elements.description;
      if (projectId && textarea) textarea.value = descriptionWithMeta(textarea.value, { project_id: String(projectId) });
      const beforeIds = new Set((readState().taskIdeas || []).map(idea => String(idea.id)));
      const createdAt = Date.now();
      if (projectId) window.setTimeout(() => linkCreatedIdea(beforeIds, projectId, createdAt), 0);
      else clearContext();
    }, true);

    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-action="close-task-idea-detail"]') || (event.target?.matches?.('[data-task-idea-detail-modal]'))) {
        event.preventDefault();
        closeIdeaDetail();
        return;
      }
      if (event.target?.closest?.('#taskIdeasToggleBtn')) queueSyncProjectField(90);
      const action = event.target?.closest?.('#taskIdeasPanel [data-action], [data-task-idea-detail-modal] [data-action="idea-to-task"], [data-task-idea-detail-modal] [data-action="idea-to-backlog"], [data-task-idea-detail-modal] [data-action="dismiss-task-idea"], [data-task-idea-detail-modal] [data-action="reopen-task-idea"]');
      if (!action) return;
      const beforeProjects = ideaProjectMap();
      const ideaId = action.dataset.id;
      const idea = ideaById(ideaId);
      const projectId = ideaProjectId(idea);
      const shouldLinkCreatedTask = projectId && (action.dataset.action === 'idea-to-task' || action.dataset.action === 'idea-to-backlog');
      const beforeTaskIds = shouldLinkCreatedTask ? new Set((readState().tasks || []).map(task => String(task.id))) : null;
      if (action.matches('[data-task-idea-detail-modal] [data-action]')) window.setTimeout(closeIdeaDetail, 120);
      if (shouldLinkCreatedTask) [60, 360, 900, 1600].forEach(delay => window.setTimeout(() => linkTaskCreatedFromIdea(ideaId, projectId, beforeTaskIds), delay));
      [80, 420, 1200].forEach(delay => window.setTimeout(() => {
        restoreIdeaProjectLinks(beforeProjects);
        repairIdeaProjectLinks();
      }, delay));
    }, true);
  }

  function boot() {
    patchStoragePreservation();
    injectStyle();
    repairIdeaProjectLinks({ syncRemote: false });
    syncProjectField();
    polishTaskActions();
    bindEvents();
    new MutationObserver(mutations => {
      const shouldSync = mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => node.nodeType === 1 && (node.id === 'taskIdeaForm' || node.querySelector?.('#taskIdeaForm'))));
      if (shouldSync) queueSyncProjectField(0);
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) polishTaskActions(node);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
