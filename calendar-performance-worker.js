const capturedFetchListeners = [];
const nativeAddEventListener = self.addEventListener.bind(self);

self.addEventListener = function captureHabitFlowFetchListeners(type, listener, options) {
  if (type === 'fetch') {
    capturedFetchListeners.push({ listener, options });
    return;
  }
  nativeAddEventListener(type, listener, options);
};

importScripts('./service-worker.js?v=calendar-index-base');

self.addEventListener = nativeAddEventListener;

function patchHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return headers;
}

function nativeCalendarIndexPatch(script) {
  if (!script.includes('function renderCalendar()') || script.includes('function buildCalendarAppointmentIndex(')) return script;
  let next = script;
  next = next.replace(
    "\n  function isActiveTask(task) {",
    "\n  function pushCalendarIndexEntry(index, key, value) {\n    if (!key) return;\n    const items = index.get(key);\n    if (items) items.push(value);\n    else index.set(key, [value]);\n  }\n\n  function buildCalendarAppointmentIndex(startKey, endKey) {\n    const index = new Map();\n    state.appointments.forEach(appointment => {\n      const appointmentStartKey = toDateKey(appointment?.starts_at);\n      const appointmentEndKey = toDateKey(appointment?.ends_at || appointment?.starts_at);\n      if (!appointmentStartKey || !appointmentEndKey || appointmentStartKey > appointmentEndKey) return;\n      if (appointmentStartKey > endKey || appointmentEndKey < startKey) return;\n      const firstKey = appointmentStartKey < startKey ? startKey : appointmentStartKey;\n      const lastKey = appointmentEndKey > endKey ? endKey : appointmentEndKey;\n      const cursor = new Date(`${firstKey}T12:00:00`);\n      let cursorKey = firstKey;\n      while (cursorKey <= lastKey) {\n        pushCalendarIndexEntry(index, cursorKey, appointment);\n        cursor.setDate(cursor.getDate() + 1);\n        cursorKey = toDateKey(cursor);\n      }\n    });\n    index.forEach(items => items.sort(compareAppointments));\n    return index;\n  }\n\n  function isActiveTask(task) {"
  );
  next = next.replace(
    "\n  function renderCalendarTaskDots(tasks) {",
    "\n  function buildCalendarTaskIndex(startKey, endKey) {\n    const index = new Map();\n    state.tasks\n      .map(normalizeTask)\n      .forEach(task => {\n        if (!isActiveTask(task)) return;\n        const dueKey = toDateKey(task.due_at);\n        if (!dueKey || dueKey < startKey || dueKey > endKey) return;\n        pushCalendarIndexEntry(index, dueKey, task);\n      });\n    index.forEach(items => items.sort((a, b) => taskPriorityMeta(b).rank - taskPriorityMeta(a).rank || compareTasks(a, b)));\n    return index;\n  }\n\n  function renderCalendarTaskDots(tasks) {"
  );
  next = next.replace(
    "    start.setDate(first.getDate() - day + 1);\n\n    const cells = [];",
    "    start.setDate(first.getDate() - day + 1);\n    const end = new Date(start);\n    end.setDate(start.getDate() + 41);\n    const startKey = toDateKey(start);\n    const endKey = toDateKey(end);\n    const todayKey = toDateKey(new Date());\n    const appointmentIndex = buildCalendarAppointmentIndex(startKey, endKey);\n    const taskIndex = buildCalendarTaskIndex(startKey, endKey);\n\n    const cells = [];"
  );
  next = next.replace(
    "      const appointments = appointmentsOnDate(key);\n      const tasks = calendarTasksOnDate(key);",
    "      const appointments = appointmentIndex.get(key) || [];\n      const tasks = taskIndex.get(key) || [];"
  );
  next = next.replace(
    "${key === toDateKey(new Date()) ? 'is-today' : ''}",
    "${key === todayKey ? 'is-today' : ''}"
  );
  return next;
}

function shouldPatchAppRequest(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname.endsWith('/app.js');
  } catch {
    return false;
  }
}

async function patchAppResponse(response, request) {
  if (!shouldPatchAppRequest(request) || !response) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('javascript') && !type.includes('text/plain') && !request.url.includes('app.js')) return response;
  const script = await response.text();
  return new Response(nativeCalendarIndexPatch(script), {
    status: response.status,
    statusText: response.statusText,
    headers: patchHeaders(response)
  });
}

nativeAddEventListener('fetch', event => {
  let responded = false;
  let responsePromise = null;
  const proxyEvent = new Proxy(event, {
    get(target, prop) {
      if (prop === 'respondWith') {
        return promise => {
          responded = true;
          responsePromise = Promise.resolve(promise).then(response => patchAppResponse(response, target.request));
        };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });

  capturedFetchListeners.forEach(({ listener }) => {
    if (responded) return;
    if (typeof listener === 'function') listener.call(self, proxyEvent);
    else if (listener?.handleEvent) listener.handleEvent(proxyEvent);
  });

  if (responded) event.respondWith(responsePromise);
});
