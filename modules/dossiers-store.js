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
  const normalizedCollections = new WeakMap();
  let snapshotCache = null, localRevision = 0, flightRequest = null, syncFailure = null;
  function featureState() {
    return window.HabitFlowPersistence?.readCollections
      ? window.HabitFlowPersistence.readCollections(['dossiers', 'dossierEntries', 'projects']) : read();
  }
  function sameRow(a, b) {
    if (a === b) return true;
    const keys = Object.keys(a || {});
    return Boolean(b) && keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
  }
  function sameRows(a = [], b = []) {
    return a.length === b.length && a.every((row, index) => sameRow(row, b[index]));
  }
  function cachedRows(rows, entry) {
    if (!Array.isArray(rows)) return Object.freeze([]);
    let result = normalizedCollections.get(rows);
    if (!result) { result = Object.freeze(merge([], rows, entry).map(Object.freeze)); normalizedCollections.set(rows, result); }
    return result;
  }
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
      // A server acknowledgment describes the same version, not a new edit.
      // Legacy storage wrappers can lose dossierWrite context and reverse the
      // merge order. Never turn an identical acknowledged version pending again.
      if (old && old.synced !== row.synced && sameRow({ ...old, synced: false }, { ...row, synced: false })) {
        rows.set(row.id, old.synced ? old : row);
        continue;
      }
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
      const first = context.dossierWrite ? previous : next;
      const second = context.dossierWrite ? next : previous;
      return { changed: true, state: { ...next,
        dossiers: merge(first.dossiers, second.dossiers),
        dossierEntries: merge(first.dossierEntries, second.dossierEntries, true)
      } };
    }
  });
  function snapshot() {
    const state = featureState(), owner = user();
    if (!snapshotCache || snapshotCache.owner !== owner || snapshotCache.sourceDossiers !== state.dossiers || snapshotCache.sourceEntries !== state.dossierEntries || snapshotCache.sourceProjects !== state.projects) {
      snapshotCache = { owner, sourceDossiers: state.dossiers, sourceEntries: state.dossierEntries, sourceProjects: state.projects,
        dossiers: Object.freeze(cachedRows(state.dossiers, false).filter(row => row.user_id === owner && !row.is_archived)),
        entries: Object.freeze(cachedRows(state.dossierEntries, true).filter(row => row.user_id === owner && !row.is_archived)),
        projects: Object.freeze((state.projects || []).filter(row => !row.is_archived && (!row.user_id || row.user_id === owner)).map(row => Object.freeze({ ...row }))) };
    }
    return { dossiers: snapshotCache.dossiers, entries: snapshotCache.entries, projects: snapshotCache.projects, status };
  }
  // Reconcile against the latest durable state, not the snapshot sent over the network.
  // Only changed results traverse the expensive whole-app write pipeline.
  function commitRemote(received) {
    const current = featureState(), changes = {};
    for (const key of Object.keys(FIELDS)) {
      if (!received[key]?.length) continue;
      const next = merge(current[key], received[key], key === 'dossierEntries');
      if (!sameRows(current[key] || [], next)) changes[key] = next;
    }
    if (Object.keys(changes).length) write({ ...read(), ...changes });
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
    localRevision++; status = 'lokal · Sync ausstehend'; publish(); schedule();
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
  async function runSync(request) {
    const owner = request.owner;
    const received = { dossiers: [], dossierEntries: [] };
    let syncTable = 'dossiers';
    syncFailure = null;
    if (!owner || !client()) { status = 'Bitte anmelden'; publish(); return; }
    status = 'synchronisiert …'; publish();
    try {
      // Fetch headers before pushing, so newer remote archives cannot be resurrected.
      const remote = await pages('dossiers', owner);
      stillOwner(owner);
      received.dossiers = remote;
      for (const [key, table] of Object.entries(FIELDS)) {
        const entry = key === 'dossierEntries';
        const current = featureState();
        current.dossiers = merge(current.dossiers, received.dossiers);
        const archived = new Set((current.dossiers || []).filter(row => row.is_archived).map(row => row.id));
        const pending = merge([], current[key], entry).filter(row => row.user_id === owner && !row.synced).map(row => entry && archived.has(row.dossier_id) ? { ...row, is_archived: true } : row);
        for (let offset = 0; offset < pending.length; offset += 100) {
          const batch = pending.slice(offset, offset + 100);
          syncTable = table;
          const result = await client().from(table).upsert(batch.map(({ synced, ...row }) => row), { onConflict: 'id' }).select('*');
          if (result.error) throw result.error;
          stillOwner(owner);
          received[key].push(...(result.data || []).map(row => ({ ...row, synced: true })));
        }
      }
      const dossierId = request.dossierId;
      if (dossierId) {
        syncTable = 'dossier_entries';
        const entries = await pages('dossier_entries', owner, dossierId);
        stillOwner(owner);
        received.dossierEntries.push(...entries);
      }
      commitRemote(received);
      received.dossiers = []; received.dossierEntries = [];
      const latest = featureState();
      status = Object.keys(FIELDS).some(key => (latest[key] || []).some(row => row.user_id === owner && !row.synced)) ? 'lokal · Sync ausstehend' : 'synchronisiert';
    } catch (error) {
      if (user() !== owner) { queued = Boolean(user()); return; }
      // Retain only a diagnostic code, never server details containing user content.
      syncFailure = { owner, table: syncTable, code: /^[A-Z0-9]{3,12}$/.test(String(error.code || '')) ? String(error.code) : '' };
      // Keep successful earlier batches acknowledged even if a later request fails.
      try { commitRemote(received); } catch (_) { /* Pending local rows stay durable. */ }
      status = /42P01|PGRST205/.test(error.code || '') ? 'Dossier-Sync noch nicht eingerichtet' : 'lokal · Sync ausstehend';
      console.warn('[HabitFlow/dossiers] Sync bleibt ausstehend.', error.message || error);
      queued = false;
    } finally { publish(); }
  }
  function sync(dossierId) {
    window.clearTimeout(timer);
    if (dossierId !== undefined) activeDossier = dossierId;
    if (inFlight) {
      if (flightRequest.owner !== user() || flightRequest.dossierId !== activeDossier || flightRequest.revision !== localRevision) queued = true;
      return inFlight;
    }
    inFlight = (async () => {
      do { queued = false; flightRequest = { owner: user(), dossierId: activeDossier, revision: localRevision }; await runSync(flightRequest); } while (queued);
    })().finally(() => { inFlight = null; flightRequest = null; });
    return inFlight;
  }
  function schedule() { window.clearTimeout(timer); timer = window.setTimeout(() => { void sync(); }, 300); }
  async function upload(blob, dossierId) {
    const owner = user();
    if (!owner || !client() || window.navigator.onLine === false) throw new Error('Zum Hochladen eines Bildes bitte anmelden und online gehen. Text kannst du offline speichern.');
    if (!(blob instanceof Blob) || !['image/webp', 'image/jpeg'].includes(blob.type) || blob.size > 135000) throw new Error('Bitte zuerst ein optimiertes Bild auswählen.');
    await sync(dossierId);
    stillOwner(owner);
    if (!(read().dossiers || []).some(row => row.id === dossierId && row.user_id === owner && row.synced && !row.is_archived)) {
      const detail = syncFailure?.owner === owner && syncFailure.code ? ` (Sync: ${syncFailure.table}, ${syncFailure.code})` : '';
      throw new Error(status === 'Dossier-Sync noch nicht eingerichtet'
        ? 'Die Dossier-Synchronisierung ist noch nicht eingerichtet. Der Bild-Upload ist deshalb nicht möglich. Dein Entwurf bleibt erhalten.'
        : 'Das Dossier konnte noch nicht synchronisiert werden' + detail + '. Bitte erneut speichern. Dein Entwurf bleibt erhalten.');
    }
    const path = owner + '/' + dossierId + '/' + window.crypto.randomUUID() + (blob.type === 'image/webp' ? '.webp' : '.jpg');
    const result = await client().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' });
    if (result.error) {
      const message = String(result.error.message || ''), code = String(result.error.statusCode || result.error.status || '');
      const reason = /bucket.*not found/i.test(message) ? 'Der Bildspeicher für Dossiers ist noch nicht eingerichtet.'
        : code === '403' || /row.level security|unauthorized|permission/i.test(message) ? 'Der Bildspeicher hat den Upload abgelehnt. Bitte Anmeldung und Zugriffsrechte prüfen.'
        : 'Bild konnte nicht hochgeladen werden. Bitte Verbindung prüfen und erneut versuchen.';
      throw new Error(reason + ' Dein Entwurf bleibt erhalten.');
    }
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
