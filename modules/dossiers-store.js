(function installDossierStore(window) {
  'use strict';
  if (window.HabitFlowDossiersStore) return;
  const KEY = 'habitflow-state-v1';
  const BUCKET = 'dossier-images';
  const FIELDS = { dossiers: 'dossiers', dossierEntries: 'dossier_entries' };
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const text = (value, max) => String(value || '').trim().slice(0, max);
  const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
  const user = () => window.HabitFlowRemote?.getUserId() || '';
  const client = () => window.HabitFlowRemote?.getClient();
  let inFlight = null, queued = false, activeDossier = '', status = 'lokal', timer = 0;
  const listeners = new Set(), signed = new Map();
  function safeLink(value) {
    if (!value || String(value).length > 4000) return '';
    try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  }
  function normalize(row, entry = false) {
    if (!row || !uuid(row.id) || !uuid(row.user_id) || !date(row.updated_at)) return null;
    const base = { id: row.id, user_id: row.user_id, created_at: date(row.created_at) || date(row.updated_at), updated_at: date(row.updated_at), is_archived: row.is_archived === true, synced: row.synced === true };
    if (!entry) return { ...base, title: text(row.title, 120), description: text(row.description, 600), project_id: uuid(row.project_id) ? row.project_id : null };
    if (!uuid(row.dossier_id)) return null;
    const prefix = row.user_id + '/' + row.dossier_id + '/';
    const imagePath = typeof row.image_path === 'string' && row.image_path.length <= 160 && row.image_path.startsWith(prefix) && /^[0-9a-f/-]+\.(webp|jpg)$/.test(row.image_path) ? row.image_path : '';
    return { ...base, dossier_id: row.dossier_id, body: text(row.body, 10000), link: safeLink(row.link), image_path: imagePath, image_alt: text(row.image_alt, 200), is_pinned: row.is_pinned === true };
  }
  function merge(a = [], b = [], entry = false) {
    const rows = new Map();
    for (const value of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      const row = normalize(value, entry);
      if (!row) continue;
      const old = rows.get(row.id);
      if (!old || (row.is_archived && !old.is_archived) || (!old.is_archived || row.is_archived) && row.updated_at >= old.updated_at) rows.set(row.id, row);
    }
    return [...rows.values()];
  }
  function read() { return JSON.parse(window.localStorage.getItem(KEY) || '{}'); }
  function publish() { listeners.forEach(listener => listener()); }
  function write(next) {
    if (!window.HabitFlowPersistence) throw new Error('Speicher ist noch nicht bereit. Bitte neu laden.');
    window.HabitFlowPersistence.writeState(next, { dossierWrite: true });
    publish();
  }
  // One state key, one writer. Older app snapshots must not erase feature data.
  window.HabitFlowPersistence?.register('dossiers', {
    write(next, context) {
      const previous = context.previous();
      return { changed: true, state: { ...next,
        dossiers: merge(next.dossiers, previous.dossiers),
        dossierEntries: merge(next.dossierEntries, previous.dossierEntries, true),
        // Explicit feature writes win timestamp ties (e.g. synced acknowledgement).
        ...(context.dossierWrite ? {
          dossiers: merge(previous.dossiers, next.dossiers),
          dossierEntries: merge(previous.dossierEntries, next.dossierEntries, true)
        } : {})
      } };
    }
  });
  function snapshot() {
    const state = read(), owner = user();
    return { dossiers: merge([], state.dossiers).filter(row => row.user_id === owner && !row.is_archived),
      entries: merge([], state.dossierEntries, true).filter(row => row.user_id === owner && !row.is_archived),
      projects: (state.projects || []).filter(row => !row.is_archived && (!row.user_id || row.user_id === owner)), status };
  }
  function save(input, entry = false) {
    const owner = user();
    if (!owner) throw new Error('Bitte zuerst anmelden.');
    const state = read(), key = entry ? 'dossierEntries' : 'dossiers';
    const rows = merge([], state[key], entry);
    const previous = rows.find(row => row.id === input.id && row.user_id === owner);
    if (input.id && (!previous || previous.is_archived)) throw new Error('Dieser Eintrag ist nicht mehr verfügbar. Bitte aktualisieren.');
    if (entry && !(state.dossiers || []).some(row => row.id === input.dossier_id && row.user_id === owner && !row.is_archived)) throw new Error('Dieses Dossier ist nicht mehr verfügbar.');
    const updated = new Date(Math.max(Date.now(), Date.parse(previous?.updated_at || '') + 1 || 0)).toISOString();
    const row = normalize({ ...previous, ...input, id: previous?.id || window.crypto.randomUUID(), user_id: owner, created_at: previous?.created_at || updated, updated_at: updated, synced: false }, entry);
    if (!row || (!entry && !row.title) || (entry && !row.is_archived && !row.body && !row.link && !row.image_path)) throw new Error(entry ? 'Bitte Text, Link oder Bild hinzufügen.' : 'Bitte einen Titel angeben.');
    if (input.link && !safeLink(input.link)) throw new Error('Bitte einen gültigen http- oder https-Link eingeben.');
    if (input.image_path && row.image_path !== input.image_path) throw new Error('Ungültiger Bildverweis.');
    if (!entry && row.project_id && !(state.projects || []).some(project => project.id === row.project_id && !project.is_archived)) throw new Error('Das verknüpfte Projekt ist nicht mehr verfügbar.');
    state[key] = merge(rows, [row], entry);
    write(state);
    status = 'lokal · Sync ausstehend'; publish(); schedule();
    return row;
  }
  async function pages(table, owner, dossierId) {
    const all = [];
    for (let offset = 0; ; offset += 500) {
      let query = client().from(table).select('*').eq('user_id', owner).order('id', { ascending: true }).range(offset, offset + 499);
      if (dossierId) query = query.eq('dossier_id', dossierId);
      const result = await query;
      if (result.error) throw result.error;
      all.push(...result.data);
      if (result.data.length < 500) return all.map(row => ({ ...row, synced: true }));
    }
  }
  function stillOwner(owner) { if (user() !== owner) throw new Error('Anmeldung hat sich geändert.'); }
  async function runSync() {
    const owner = user();
    if (!owner || !client()) { status = 'Bitte anmelden'; publish(); return; }
    status = 'synchronisiert …'; publish();
    try {
      // Fetch headers before pushing, so newer remote archives cannot be resurrected.
      const remote = await pages('dossiers', owner);
      stillOwner(owner);
      let state = read(); state.dossiers = merge(state.dossiers, remote); write(state);
      for (const [key, table] of Object.entries(FIELDS)) {
        const entry = key === 'dossierEntries';
        const current = read();
        const archived = new Set((current.dossiers || []).filter(row => row.is_archived).map(row => row.id));
        const pending = merge([], current[key], entry).filter(row => row.user_id === owner && !row.synced).map(row => entry && archived.has(row.dossier_id) ? { ...row, is_archived: true } : row);
        for (let offset = 0; offset < pending.length; offset += 100) {
          const batch = pending.slice(offset, offset + 100);
          const result = await client().from(table).upsert(batch.map(({ synced, ...row }) => row), { onConflict: 'id' }).select('*');
          if (result.error) throw result.error;
          stillOwner(owner);
          state = read(); state[key] = merge(state[key], (result.data || []).map(row => ({ ...row, synced: true })), entry); write(state);
        }
      }
      const dossierId = activeDossier;
      if (dossierId) {
        const entries = await pages('dossier_entries', owner, dossierId);
        stillOwner(owner);
        state = read(); state.dossierEntries = merge(state.dossierEntries, entries, true); write(state);
      }
      const latest = read();
      status = Object.keys(FIELDS).some(key => (latest[key] || []).some(row => row.user_id === owner && !row.synced)) ? 'lokal · Sync ausstehend' : 'synchronisiert';
    } catch (error) {
      if (user() !== owner) { queued = Boolean(user()); return; }
      status = /42P01|PGRST205/.test(error.code || '') ? 'Dossier-Sync noch nicht eingerichtet' : 'lokal · Sync ausstehend';
      console.warn('[HabitFlow/dossiers] Sync bleibt ausstehend.', error.message || error);
      queued = false;
    } finally { publish(); }
  }
  function sync(dossierId) {
    window.clearTimeout(timer);
    if (dossierId !== undefined) activeDossier = dossierId;
    if (inFlight) { queued = true; return inFlight; }
    inFlight = (async () => { do { queued = false; await runSync(); } while (queued); })().finally(() => { inFlight = null; });
    return inFlight;
  }
  function schedule() { window.clearTimeout(timer); timer = window.setTimeout(() => { void sync(); }, 300); }
  async function upload(blob, dossierId) {
    const owner = user();
    if (!owner || !client() || window.navigator.onLine === false) throw new Error('Zum Hochladen eines Bildes bitte anmelden und online gehen. Text kannst du offline speichern.');
    if (!(blob instanceof Blob) || !['image/webp', 'image/jpeg'].includes(blob.type) || blob.size > 135000) throw new Error('Bitte zuerst ein optimiertes Bild auswählen.');
    await sync(dossierId);
    stillOwner(owner);
    if (!(read().dossiers || []).some(row => row.id === dossierId && row.user_id === owner && row.synced && !row.is_archived)) throw new Error('Das Dossier muss vor dem Bild-Upload synchronisiert sein. Dein Entwurf bleibt erhalten.');
    const path = owner + '/' + dossierId + '/' + window.crypto.randomUUID() + (blob.type === 'image/webp' ? '.webp' : '.jpg');
    const result = await client().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' });
    if (result.error) throw new Error('Bild konnte nicht hochgeladen werden. Verbindung und Dossier-Bildspeicher prüfen. Dein Entwurf bleibt erhalten.');
    stillOwner(owner);
    return path;
  }
  async function removeUpload(path) {
    if (!path || !path.startsWith(user() + '/')) return;
    try { await client()?.storage.from(BUCKET).remove([path]); } catch (_) { /* Best effort for an uncommitted upload. */ }
  }
  async function imageUrls(paths) {
    const owner = user(), now = Date.now();
    const allowed = [...new Set(paths)].filter(path => path.startsWith(owner + '/'));
    const missing = allowed.filter(path => !signed.has(path) || signed.get(path).expires < now);
    if (missing.length && client() && owner) {
      const result = await client().storage.from(BUCKET).createSignedUrls(missing, 3600);
      stillOwner(owner);
      if (!result.error) for (const row of result.data || []) if (row.signedUrl) signed.set(row.path, { url: row.signedUrl, expires: now + 3500000 });
      while (signed.size > 100) signed.delete(signed.keys().next().value);
    }
    return new Map(allowed.map(path => [path, signed.get(path)?.url || '']));
  }
  window.HabitFlowDossiersStore = Object.freeze({ snapshot, saveDossier: input => save(input), saveEntry: input => save(input, true), sync, upload, removeUpload, imageUrls, safeLink, normalize, merge,
    backup() { const state = read(); return { dossiers: merge([], state.dossiers).filter(row => row.user_id === user()), dossierEntries: merge([], state.dossierEntries, true).filter(row => row.user_id === user()) }; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } });
  window.addEventListener('habitflow:auth-change', () => { signed.clear(); activeDossier = ''; publish(); schedule(); });
  window.addEventListener('online', schedule);
  window.addEventListener('storage', event => { if (event.key === KEY) publish(); });
})(window);
