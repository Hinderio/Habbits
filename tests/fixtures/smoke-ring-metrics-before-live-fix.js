// Regression oracle from dab5add110ef3bec992c286676f7f71505ec0e32.
  function legacyMetrics(state = readState()) {
    const rows = smokeRows(state);
    const intervals = rows.map(item => Number(item.interval_minutes)).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    const activeIntervals = activeDaytimePauses(rows, state, 28);
    const median = medianOf(activeIntervals);
    const latest = rows[rows.length - 1] || null;
    const pause = latest ? Math.max(0, Math.floor((Date.now() - new Date(latest.smoked_at).getTime()) / 60000)) : null;
    const bestDaytime = activeIntervals.length ? Math.max(...activeIntervals) : null;
    const bonusMinutes = median != null && pause != null ? Math.max(0, Math.floor(pause - median)) : 0;
    const bonusProgress = bonusMinutes > 0 && bestDaytime != null
      ? bestDaytime > median
        ? Math.min(1, bonusMinutes / (bestDaytime - median))
        : 1
      : 0;
    const todayKey = dateKey(new Date());
    const weekKeys = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - index);
      return dateKey(date);
    });
    const today = rows.filter(item => dateKey(item.smoked_at) === todayKey);
    const week = rows.filter(item => weekKeys.includes(dateKey(item.smoked_at)));
    const weekIntervals = week.map(item => Number(item.interval_minutes)).filter(value => Number.isFinite(value) && value > 0);
    const next = pause == null ? 10 : pause < 30 ? Math.min(30, pause + 10) : pause < 60 ? 60 : pause < 120 ? 120 : pause < 240 ? 240 : pause + 30;
    return {
      rows,
      recent: [...rows].reverse().slice(0, 3),
      total: rows.length,
      today: today.length,
      week: week.length,
      pause,
      median,
      bestDaytime,
      bonusMinutes,
      bonusProgress,
      next,
      progress: median && pause != null ? Math.min(1, Math.max(0, pause / median)) : 0,
      avg: weekIntervals.length ? duration(weekIntervals.reduce((sum, value) => sum + value, 0) / weekIntervals.length) : '-',
      best: intervals.length ? Math.max(...intervals) : null
    };
  }
