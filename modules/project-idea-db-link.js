(() => {
  'use strict';

  if (window.__habitFlowProjectIdeaDbLinkInstalled) return;
  window.__habitFlowProjectIdeaDbLinkInstalled = true;

  const STATE_KEY = 'habitflow-state-v1';
  const BRIDGE_LINKS_KEY = 'habitflow-idea-project-links-v1';
  const DB_LINKS_KEY = 'habitflow-idea-project-db-links-v1';
  const META_RE = /\n?\s*<!--hf-idea-meta:([^>]+)-->/;
  const RETRY_DELAYS = [250, 1000, 2500, 6000];

  let supabaseClient = null;
  let syncQueued = false;
  let projectColumnSupported = true;

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value || {}));
    } catch {}
  }

  function readState() {
    return readJson(STATE_KEY, {});
  }

  function writeState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state || {}));
      return true;
    } catch (error) {
      console.warn('[HabitFlow/projects] Ideen-Projekt-DB-Link konnte lokal nicht gespeichert werden.', error);
      return false;
    }
  }

  function parseMeta(description = '') {
    const match = String(description || '').match(META_RE);
    if (!match) return {};
    try {
      const decoded = JSON.parse(decodeURIComponent(match[1] || ''));
      return decoded && typeof decoded === 'object' ? decoded : {};
    } catch {
      return {};
    }
  }

  function cleanDescription(description = '') {
    return String(description || '').replace(META_RE, '').trim();
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

  function readKnownLinks() {
    return {
      ...readJson(DB_LINKS_KEY, {}),
      ...readJson(BRIDGE_LINKS_KEY, {})
    };
  }

  function rememberLink(ideaId, projectId) {
    if (!ideaId || !projectId) return;
    const links = readJson(DB_LINKS_KEY, {});
    links[String(ideaId)] = String(projectId);
    writeJson(DB_LINKS_KEY, links);
  }

  function ideaProjectId(idea = {}, knownLinks = readKnownLinks()) {
    const direct = String(idea.project_id || idea.projectId || parseMeta(idea.description).project_id || '').trim();
    if (direct) return direct;
    return idea?.id ? String(knownLinks[String(idea.id)] || '').trim() : '';
  }

  function applyKnownLinksToLocalState() {
    const state = readState();
    if (!Array.isArray(state.taskIdeas)) return false;
    const links = readKnownLinks();
    let changed = false;
    state.taskIdeas = state.taskIdeas.map(idea => {
      if (!idea?.id) return idea;
      const projectId = ideaProjectId(idea, links);
      if (!projectId) return idea;
      rememberLink(idea.id, projectId);
      if (String(idea.project_id || idea.projectId || parseMeta(idea.description).project_id || '') === projectId) return idea;
      changed = true;
      return {
        ...idea,
        project_id: projectId,
        projectId: projectId,
        description: descriptionWithMeta(idea.description, { project_id: projectId })
      };
    });
    if (!changed) return false;
    writeState(state);
    window.dispatchEvent(new Event('habitflow:projects-changed'));
    return true;
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

  function isMissingProjectColumn(error) {
    const message = String(error?.message || error?.details || error?.hint || error || '').toLowerCase();
    return message.includes('project_id') || (message.includes('schema cache') && message.includes('column'));
  }

  async function pullRemoteProjectLinks() {
    const client = getSupabaseClient();
    if (!client || !projectColumnSupported) return false;
    const { data, error } = await client.from('task_ideas').select('id,project_id,updated_at').not('project_id', 'is', null);
    if (error) {
      if (isMissingProjectColumn(error)) {
        projectColumnSupported = false;
        console.warn('[HabitFlow/projects] task_ideas.project_id fehlt noch in Supabase. SQL-Migration anwenden, dann wird nativ verknuepft.', error);
        return false;
      }
      console.warn('[HabitFlow/projects] Projektlinks der Ideen konnten nicht gelesen werden.', error);
      return false;
    }
    const rows = Array.isArray(data) ? data : [];
    const links = readJson(DB_LINKS_KEY, {});
    let changed = false;
    rows.forEach(row => {
      if (!row?.id || !row.project_id) return;
      if (links[String(row.id)] !== String(row.project_id)) {
        links[String(row.id)] = String(row.project_id);
        changed = true;
      }
    });
    if (changed) writeJson(DB_LINKS_KEY, links);
    return applyKnownLinksToLocalState() || changed;
  }

  async function pushLocalProjectLinks() {
    const client = getSupabaseClient();
    if (!client || !projectColumnSupported) return false;
    const state = readState();
    const ideas = Array.isArray(state.taskIdeas) ? state.taskIdeas : [];
    const knownLinks = readKnownLinks();
    const rows = ideas
      .map(idea => ({ idea, projectId: ideaProjectId(idea, knownLinks) }))
      .filter(entry => entry.idea?.id && entry.projectId);
    if (!rows.length) return false;
    let changed = false;
    for (const { idea, projectId } of rows) {
      const updatedAt = idea.updated_at || new Date().toISOString();
      const { error } = await client
        .from('task_ideas')
        .update({ project_id: projectId, updated_at: updatedAt })
        .eq('id', idea.id);
      if (error) {
        if (isMissingProjectColumn(error)) {
          projectColumnSupported = false;
          console.warn('[HabitFlow/projects] task_ideas.project_id fehlt noch in Supabase. SQL-Migration anwenden, dann wird nativ verknuepft.', error);
          return changed;
        }
        console.warn('[HabitFlow/projects] Projektlink konnte nicht in task_ideas.project_id geschrieben werden.', error);
        continue;
      }
      rememberLink(idea.id, projectId);
      changed = true;
    }
    return changed;
  }

  async function reconcileProjectLinks() {
    applyKnownLinksToLocalState();
    await pullRemoteProjectLinks();
    await pushLocalProjectLinks();
    applyKnownLinksToLocalState();
  }

  function queueReconcile(delay = 0) {
    if (syncQueued) return;
    syncQueued = true;
    window.setTimeout(() => {
      syncQueued = false;
      reconcileProjectLinks();
    }, delay);
  }

  function patchStorageWrites() {
    if (window.__habitFlowProjectIdeaDbStoragePatched) return;
    window.__habitFlowProjectIdeaDbStoragePatched = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      let nextValue = value;
      if (this === window.localStorage && key === STATE_KEY && typeof value === 'string' && value.includes('"taskIdeas"')) {
        try {
          const parsed = JSON.parse(value);
          const links = readKnownLinks();
          if (Array.isArray(parsed.taskIdeas)) {
            let changed = false;
            parsed.taskIdeas = parsed.taskIdeas.map(idea => {
              const projectId = ideaProjectId(idea, links);
              if (!idea?.id || !projectId || String(idea.project_id || idea.projectId || parseMeta(idea.description).project_id || '') === projectId) return idea;
              changed = true;
              return {
                ...idea,
                project_id: projectId,
                projectId: projectId,
                description: descriptionWithMeta(idea.description, { project_id: projectId })
              };
            });
            if (changed) nextValue = JSON.stringify(parsed);
          }
        } catch {}
      }
      return original.call(this, key, nextValue);
    };
  }

  function boot() {
    patchStorageWrites();
    RETRY_DELAYS.forEach(delay => window.setTimeout(() => reconcileProjectLinks(), delay));
    window.addEventListener('habitflow:projects-changed', () => queueReconcile(300));
    window.addEventListener('habitflow:project-task-link-updated', () => queueReconcile(300));
    window.addEventListener('storage', event => {
      if (event.key === STATE_KEY || event.key === BRIDGE_LINKS_KEY || event.key === DB_LINKS_KEY) queueReconcile(300);
    });
    document.addEventListener('submit', event => {
      if (event.target?.id === 'taskIdeaForm' || event.target?.id === 'taskIdeaDetailForm') queueReconcile(900);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
