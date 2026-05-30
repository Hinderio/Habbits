(function registerHabitFlowSmokingDomain(window) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (!modules || modules.has('smoking-domain')) return;

  const MIN_SLEEP_BRIDGE_MINUTES = 240;
  const SLEEP_START_HOUR = 23;
  const SLEEP_END_HOUR = 7;

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function minutesBetween(startValue, endValue) {
    const start = toDate(startValue);
    const end = toDate(endValue);
    if (!start || !end || end <= start) return null;
    return Math.max(0, Math.round((end - start) / 60000));
  }

  function sleepWindowForDate(value) {
    const start = toDate(value) || new Date();
    start.setHours(SLEEP_START_HOUR, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(SLEEP_END_HOUR, 0, 0, 0);
    return { start, end };
  }

  function sleepMinutesBetween(startValue, endValue) {
    const start = toDate(startValue);
    const end = toDate(endValue);
    if (!start || !end || end <= start) return 0;
    let total = 0;
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - 1);
    cursor.setHours(12, 0, 0, 0);
    for (let guard = 0; guard < 10 && cursor.getTime() <= end.getTime() + 86400000; guard += 1) {
      const range = sleepWindowForDate(cursor);
      const overlapStart = Math.max(start.getTime(), range.start.getTime());
      const overlapEnd = Math.min(end.getTime(), range.end.getTime());
      if (overlapEnd > overlapStart) total += Math.round((overlapEnd - overlapStart) / 60000);
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }

  function isMorningAfterSleep(endValue) {
    const end = toDate(endValue);
    if (!end) return false;
    return end.getHours() >= 5 && end.getHours() < 12;
  }

  function scoreInterval(previousValue, currentValue) {
    const interval = minutesBetween(previousValue, currentValue);
    if (interval == null) {
      return Object.freeze({ intervalMinutes: null, scoringIntervalMinutes: null, sleepDeductedMinutes: 0, sleepBridge: false, points: 0, reason: 'Rauchpause: erster Eintrag' });
    }
    const sleep = sleepMinutesBetween(previousValue, currentValue);
    const sleepBridge = interval >= MIN_SLEEP_BRIDGE_MINUTES && sleep >= MIN_SLEEP_BRIDGE_MINUTES && isMorningAfterSleep(currentValue);
    const scoringInterval = sleepBridge ? Math.max(0, interval - sleep) : interval;
    const points = pointsForScoringInterval(scoringInterval, { sleepBridge });
    return Object.freeze({
      intervalMinutes: interval,
      scoringIntervalMinutes: scoringInterval,
      sleepDeductedMinutes: sleepBridge ? sleep : 0,
      sleepBridge,
      points,
      reason: reasonForPoints(points, { sleepBridge })
    });
  }

  function pointsForScoringInterval(minutes, options = {}) {
    if (minutes == null) return 0;
    if (options.sleepBridge) return 0;
    if (minutes < 30) return -40;
    if (minutes < 60) return -20;
    if (minutes < 120) return 0;
    if (minutes < 240) return 20;
    if (minutes < 480) return 60;
    return 100;
  }

  function reasonForPoints(points, options = {}) {
    if (options.sleepBridge) return 'Rauchpause: Schlafzeit neutralisiert';
    if (points >= 100) return 'Rauchpause: 8+ Stunden';
    if (points >= 60) return 'Rauchpause: 4–8 Stunden';
    if (points >= 20) return 'Rauchpause: 2–4 Stunden';
    if (points < 0) return 'Rauchabstand zu kurz';
    return 'Rauchpause: neutral';
  }

  function sortEvents(events, direction = 'asc') {
    const rows = (Array.isArray(events) ? events : [])
      .filter(event => event && !event.deleted_at)
      .slice()
      .sort((a, b) => new Date(a.smoked_at || a.created_at || 0) - new Date(b.smoked_at || b.created_at || 0));
    return direction === 'desc' ? rows.reverse() : rows;
  }

  function recalculateEvents(events) {
    const rows = sortEvents(events, 'asc');
    return rows.map((event, index) => {
      const previous = index > 0 ? rows[index - 1] : null;
      const score = previous ? scoreInterval(previous.smoked_at || previous.created_at, event.smoked_at || event.created_at) : scoreInterval(null, event.smoked_at || event.created_at);
      return Object.assign({}, event, {
        interval_minutes: score.intervalMinutes,
        scoring_interval_minutes: score.scoringIntervalMinutes,
        scoring_sleep_deducted_minutes: score.sleepDeductedMinutes,
        points: score.points
      });
    });
  }

  const api = Object.freeze({
    MIN_SLEEP_BRIDGE_MINUTES,
    minutesBetween,
    sleepMinutesBetween,
    scoreInterval,
    pointsForScoringInterval,
    reasonForPoints,
    sortEvents,
    recalculateEvents
  });

  window.HabitFlowDomains = window.HabitFlowDomains || {};
  window.HabitFlowDomains.smoking = api;

  modules.register('smoking-domain', {
    description: 'Pure smoking interval and point scoring domain. Keeps sleep-aware scoring separate from UI and sync.',
    exports: Object.freeze(['scoreInterval', 'recalculateEvents', 'pointsForScoringInterval'])
  });
})(window);
