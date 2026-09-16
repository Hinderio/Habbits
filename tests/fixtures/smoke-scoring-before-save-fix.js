// Regression oracle: scoring from f20f1fe9d345c207cb36dfe1d8fe87c23a855637.
  function addPoints(sourceType, sourceId, points, reason, earnedAt = nowIso()) {
    const matches = state.pointsLedger.filter(p => p.source_type === sourceType && p.source_id === sourceId);
    const existing = matches[0] || null;
    if (existing) {
      const duplicateIds = new Set(matches.slice(1).map(p => p.id));
      if (duplicateIds.size) state.pointsLedger = state.pointsLedger.filter(p => !duplicateIds.has(p.id));
      const changed = Number(existing.points || 0) !== Number(points || 0)
        || existing.reason !== reason
        || existing.earned_at !== earnedAt
        || duplicateIds.size > 0;
      if (!changed) return false;
      existing.points = points;
      existing.reason = reason;
      existing.earned_at = earnedAt;
      existing.updated_at = nowIso();
      existing.synced = false;
      return true;
    }
    const createdAt = nowIso();
    state.pointsLedger.push({ id: uid(), source_type: sourceType, source_id: sourceId, points, reason, earned_at: earnedAt, created_at: createdAt, updated_at: createdAt, synced: false });
    return true;
  }

  function recalculateSmokeIntervals({ markUpdated = false } = {}) {
    const touchedAt = nowIso();
    let changed = false;
    const sorted = [...visibleCigarettes()].sort((a, b) => new Date(a.smoked_at) - new Date(b.smoked_at));
    sorted.forEach((c, index) => {
      const prev = sorted[index - 1] || null;
      const scoringContext = smokingScoringContext(prev, c);
      scoringContext.consecutiveRecoveryBonus = smokeRecoveryRepeatBonus(prev, scoringContext);
      const interval = scoringContext.interval;
      const scoringInterval = scoringContext.scoringInterval;
      const sleepMinutes = scoringContext.sleepMinutes;
      const recoveryBonus = scoringContext.consecutiveRecoveryBonus ? SMOKE_RECOVERY_REPEAT_BONUS : 0;
      const points = cigarettePoints(scoringInterval, scoringContext);
      const hasChanged = c.interval_minutes !== interval
        || c.scoring_interval_minutes !== scoringInterval
        || c.scoring_sleep_deducted_minutes !== sleepMinutes
        || Number(c.consecutive_recovery_bonus || 0) !== recoveryBonus
        || Number(c.points || 0) !== points;
      if (hasChanged) {
        c.interval_minutes = interval;
        c.scoring_interval_minutes = scoringInterval;
        c.scoring_sleep_deducted_minutes = sleepMinutes;
        c.consecutive_recovery_bonus = recoveryBonus;
        c.points = points;
        changed = true;
      }
      if (hasChanged) {
        c.synced = false;
        if (markUpdated) c.updated_at = touchedAt;
      }
      if (addPoints('cigarette', c.id, c.points, cigarettePointReason(scoringInterval, scoringContext), c.smoked_at)) changed = true;
    });
    if (recalculateSmokeDailyBonuses()) changed = true;
    return changed;
  }

  function recalculateSmokeDailyBonuses(keys = null) {
    const byDay = new Map();
    visibleCigarettes().forEach(cigarette => {
      const key = toDateKey(cigarette.smoked_at || cigarette.created_at);
      if (key) byDay.set(key, (byDay.get(key) || 0) + 1);
    });
    const groups = new Map();
    state.pointsLedger.filter(isSmokeDailyBonusEntry).forEach(entry => {
      const key = smokeDailyBonusDay(entry);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });
    const targetKeys = new Set([...(keys || byDay.keys()), ...groups.keys()]);
    const removedIds = new Set();
    let changed = false;
    targetKeys.forEach(key => {
      const entries = groups.get(key) || [];
      const count = byDay.get(key) || 0;
      const points = smokeBonusDayPaused(key) ? 0 : smokeDailyBonusPoints(count);
      if (!points) {
        entries.forEach(entry => removedIds.add(entry.id));
        return;
      }
      const sourceId = smokeDailyBonusSourceId(key);
      // Prefer the canonical row, then a stable ID order, on every device.
      const sorted = entries.slice().sort((a, b) =>
        Number(b.source_id === sourceId) - Number(a.source_id === sourceId)
        || String(a.id).localeCompare(String(b.id)));
      const keep = sorted[0];
      sorted.slice(1).forEach(entry => removedIds.add(entry.id));
      if (keep && keep.source_id !== sourceId) {
        keep.source_id = sourceId;
        keep.synced = false;
        keep.updated_at = nowIso();
        changed = true;
      }
      // Remove duplicates before addPoints, which otherwise discards them
      // without registering remote deletions.
      if (removedIds.size) state.pointsLedger = state.pointsLedger.filter(entry => !removedIds.has(entry.id));
      if (addPoints('bonus', sourceId, points, smokeDailyBonusReason(count, points), `${key}T23:59:00.000Z`)) changed = true;
    });
    if (removedIds.size) {
      state.pointsLedger = state.pointsLedger.filter(entry => !removedIds.has(entry.id));
      markRemoteDeletedMany('points_ledger', [...removedIds]);
      changed = true;
    }
    return changed;
  }