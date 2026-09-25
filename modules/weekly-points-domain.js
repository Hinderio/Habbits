(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HabitFlowWeeklyPointsDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  function monday(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return NaN;
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return utc - ((new Date(utc).getUTCDay() + 6) % 7) * DAY;
  }
  function weekLabel(start) {
    const thursday = new Date(start + 3 * DAY);
    const year = thursday.getUTCFullYear();
    const jan4 = Date.UTC(year, 0, 4);
    const first = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
    return { year, number: 1 + Math.round((start - first) / (7 * DAY)) };
  }
  function color(points) {
    const positive = ['#dcecc8', '#bbdda0', '#8cc66b', '#59ac50', '#2b8746', '#12663d'];
    const negative = ['#fee6bb', '#fbc977', '#f59c4b', '#ea713c', '#d44835', '#ab292e'];
    const n = Math.abs(points);
    const index = n <= 10 ? 0 : n <= 30 ? 1 : n <= 75 ? 2 : n <= 150 ? 3 : n <= 300 ? 4 : 5;
    return (points < 0 ? negative : positive)[index];
  }
  function build({ ledger = [], habits = [], entries = [], tasks = [], now = new Date(), offset = 0, count = 26 } = {}) {
    count = Math.max(1, Math.min(52, Math.floor(Number(count) || 26)));
    offset = Math.max(0, Math.min(5200, Math.floor(Number(offset) || 0)));
    const today = monday(now);
    const first = today - (offset + count - 1) * 7 * DAY;
    const weeks = Array.from({ length: count }, (_, i) => {
      const start = first + i * 7 * DAY;
      return { start, key: new Date(start).toISOString().slice(0, 10), ...weekLabel(start), positive: [], negative: [], positivePoints: 0, negativePoints: 0 };
    });
    const habitById = new Map(habits.map(h => [h.id, h]));
    const entryById = new Map(entries.map(e => [e.id, e]));
    const taskById = new Map(tasks.map(t => [t.id, t]));
    const weeklyGroups = weeks.map(() => new Map());
    const groupedHabitNames = new Set(['brotfreier tag', 'spazieren', 'stehpult', 'meditation']);
    let sequence = 0;
    const seen = new Set();
    const nowTime = new Date(now).getTime();
    for (const point of ledger) {
      const value = Number(point.points);
      const date = new Date(point.earned_at);
      if (!Number.isFinite(value) || !value || !Number.isFinite(date.getTime()) || date.getTime() > nowTime) continue;
      if (point.id && seen.has(point.id)) continue;
      if (point.id) seen.add(point.id);
      const index = Math.round((monday(date) - first) / (7 * DAY));
      if (index < 0 || index >= count) continue;
      const key = point.id || 'row:' + sequence++;
      let label = point.reason || 'Punktebuchung';
      let groupKey = point.source_type === 'cigarette' ? 'smoking' : null;
      if (point.source_type === 'habit') {
        const entry = entryById.get(point.source_id);
        const habit = habitById.get(entry?.habit_id);
        label = habit?.name || label;
        const name = String(habit?.name || '').trim().toLocaleLowerCase('de-CH').replace(/\s+/g, ' ');
        if (habit && groupedHabitNames.has(name)) groupKey = 'habit:' + habit.id;
      } else if (point.source_type === 'task') {
        label = taskById.get(point.source_id)?.title || label;
      }
      const week = weeks[index];
      const sign = value > 0 ? 'positive' : 'negative';
      if (groupKey) {
        // Group only selected sources, retaining separate gains/losses and original totals.
        const signedKey = groupKey + ':' + sign;
        let item = weeklyGroups[index].get(signedKey);
        if (!item) {
          item = { key: signedKey, label: (point.source_type === 'cigarette' ? 'Rauchen' : String(label)) + ' · Wochenwert', points: 0, logs: 0, type: point.source_type };
          weeklyGroups[index].set(signedKey, item);
          week[sign].push(item);
        }
        item.points += value;
        item.logs++;
      } else {
        week[sign].push({ key, label: String(label), points: value, logs: 1, type: point.source_type || 'other' });
      }
      if (value > 0) week.positivePoints += value;
      else week.negativePoints += value;
    }
    weeks.forEach(week => {
      const order = (a, b) => Math.abs(a.points) - Math.abs(b.points) || a.key.localeCompare(b.key);
      week.positive.sort(order);
      week.negative.sort(order);
    });
    return { weeks, offset, count };
  }
  return { build, color, monday, weekLabel };
});
