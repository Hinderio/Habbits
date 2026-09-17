// Run with TZ=Europe/Zurich node tests/line-calendar-render.bench.cjs [baseline-file].
// Measures warmed HTML generation only, not network, layout or painting.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const file = process.argv[2] || path.join(__dirname, '../modules/line-calendar.js');

function load(rows) {
  const window = {
    localStorage: {
      getItem: key => key === 'habitflow-state-v1' ? JSON.stringify({ appointments: rows }) : '{}'
    }
  };
  const source = fs.readFileSync(file, 'utf8').replace("  if (document.readyState === 'loading')", `
    window.api = { renderModalBody, setup() {
      windowAnchor = new Date('2026-09-17T10:00:00Z');
      windowAppointments = prepareAppointments();
    }};
    if (document.readyState === 'loading')`);
  vm.runInNewContext(source, {
    window, document: { readyState: 'loading', addEventListener() {} }, Date, Intl
  });
  window.api.setup();
  return window.api;
}

for (const count of [20, 200, 1000]) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: String(i), title: `Termin ${i}`,
    starts_at: new Date(Date.UTC(2026, 8, 18 + i % 340, 9)).toISOString(),
    ends_at: new Date(Date.UTC(2026, 8, 18 + i % 340 + (i % 5 === 0 ? 40 : 0), 10)).toISOString()
  }));
  const api = load(rows);
  api.renderModalBody();
  const times = [];
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    api.renderModalBody();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(`${count} events: ${times[2].toFixed(2)} ms median HTML generation`);
}
