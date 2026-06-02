(function registerHabitFlowSmokeActivePauseMetric(window, document) {
  'use strict';

  const modules = window.HabitFlowModules;
  if (modules && modules.has('smoke-active-pause-metric')) return;

  const STORAGE_KEY = 'habitflow-state-v1';
  const SLEEP_START_HOUR = 23;
  const SLEEP_END_HOUR = 7;
  const SLEEP_BRIDGE_MINUTES = 240;
  const WAKE_MIN_HOUR = 5;
  const DAY_MS = 24 * 60 * 60 * 1000;
  let renderTimer = null;

  function readState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn('[HabitFlow/smoke-active-pause-metric] State konnte nicht gelesen werden.', error);
      return null;
    }
  }

  function escapeHtml(value = '') {
    return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function eventDate(row = {}) {
    const value = row.smoked_at || row.created_at || row.updated_at;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function toDateKey(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function daysBack(count) {
    const today = new Date();
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (count - 1 - index));
      return toDateKey(date);
    });
  }

  function activePausePeriods(state) {
    return (Array.isArray(state?.pausePeriods) ? state.pausePeriods : [])
      .filter(period => period && !period.is_archived && String(period.scope || 'smoke') === 'smoke')
      .map(period => {
        const start = new Date(period.starts_at || period.start_at || period.started_at || 0).getTime();
        const end = period.ends_at ? new Date(period.ends_at).getTime() : Infinity;
        return { start, end };
      })
      .filter(period => Number.isFinite(period.start) && period.end >= period.start);
  }

  function isWithinPause(timeMs, pausePeriods) {
    return pausePeriods.some(period => timeMs >= period.start && timeMs <= period.end);
  }

  function intervalCrossesPause(startMs, endMs, pausePeriods) {
    return pausePeriods.some(period => period.start < endMs && period.end > startMs);
  }

  function visibleCigarettes(state) {
    const pauses = activePausePeriods(state);
    return (Array.isArray(state?.cigarettes) ? state.cigarettes : [])
      .filter(row => row && !row.deleted_at && !row.archived_at && !row.is_archived)
      .map(row => ({ row, date: eventDate(row) }))
      .filter(item => item.date && !isWithinPause(item.date.getTime(), pauses))
      .sort((a, b) => a.date - b.date)
      .map(item => item.row);
  }

  function sleepWindowForScoring(dateValue) {
    const start = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue || 0);
    if (Number.isNaN(start.getTime())) return null;
    start.setHours(SLEEP_START_HOUR, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(SLEEP_END_HOUR, 0, 0, 0);
    return { start, end };
  }

  function sleepMinutesBetween(startValue, endValue) {
    const startMs = new Date(startValue || 0).getTime();
    const endMs = new Date(endValue || 0).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
    let total = 0;
    const cursor = new Date(startMs);
    cursor.setDate(cursor.getDate() - 1);
    cursor.setHours(12, 0, 0, 0);
    for (let guard = 0; guard < 14 && cursor.getTime() <= endMs + DAY_MS; guard += 1) {
      const sleepWindow = sleepWindowForScoring(cursor);
      if (sleepWindow) {
        const overlapStart = Math.max(startMs, sleepWindow.start.getTime());
        const overlapEnd = Math.min(endMs, sleepWindow.end.getTime());
        if (overlapEnd > overlapStart) total += Math.round((overlapEnd - overlapStart) / 60000);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }

  function isPostSleepWakeTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return false;
    const hour = date.getHours();
    return hour >= WAKE_MIN_HOUR && hour < 12;
  }

  function activeIntervalMinutes(previous, current, rawMinutes) {
    const deducted = Number(current?.scoring_sleep_deducted_minutes);
    if (Number.isFinite(deducted) && deducted > 0) return Math.max(0, rawMinutes - deducted);
    const storedScoring = Number(current?.scoring_interval_minutes);
    if (Number.isFinite(storedScoring) && storedScoring >= 0 && storedScoring <= rawMinutes) return storedScoring;
    const previousAt = previous?.smoked_at || previous?.created_at;
    const currentAt = current?.smoked_at || current?.created_at;
    const sleepMinutes = sleepMinutesBetween(previousAt, currentAt);
    const sleepBridge = rawMinutes >= SLEEP_BRIDGE_MINUTES && sleepMinutes >= SLEEP_BRIDGE_MINUTES && isPostSleepWakeTime(currentAt);
    return sleepBridge ? Math.max(0, rawMinutes - sleepMinutes) : rawMinutes;
  }

  function buildActiveSnapshots(state, days = null) {
    const pauses = activePausePeriods(state);
    const rows = visibleCigarettes(state);
    const keySet = days ? new Set(daysBack(days)) : null;
    const all = [];
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      const previousAt = previous?.smoked_at || previous?.created_at;
      const currentAt = current?.smoked_at || current?.created_at;
      const currentKey = toDateKey(currentAt);
      if (keySet && !keySet.has(currentKey)) continue;
      const previousMs = new Date(previousAt || 0).getTime();
      const currentMs = new Date(currentAt || 0).getTime();
      if (!Number.isFinite(previousMs) || !Number.isFinite(currentMs) || currentMs <= previousMs) continue;
      const rawMinutes = Math.max(0, Math.round((currentMs - previousMs) / 60000));
      const crossesPause = intervalCrossesPause(previousMs, currentMs, pauses);
      all.push({
        id: current.id || `${index}-${currentAt || ''}`,
        cigarette: current,
        previous,
        rawMinutes,
        activeMinutes: activeIntervalMinutes(previous, current, rawMinutes),
        isDaytimeInterval: toDateKey(previousAt) === currentKey,
        crossesPause
      });
    }
    return all;
  }

  function bestActiveDaytimePauseMinutes(state) {
    const values = buildActiveSnapshots(state, null)
      .filter(item => item.isDaytimeInterval && !item.crossesPause && Number.isFinite(item.activeMinutes) && item.activeMinutes > 0)
      .map(item => item.activeMinutes);
    return values.length ? Math.max(...values) : null;
  }

  function average(values = []) {
    const finite = values.map(Number).filter(Number.isFinite);
    return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : 0;
  }

  function percentile(values = [], ratio = 0.5) {
    if (!values.length) return 0;
    const sorted = [...values].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const index = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * ratio));
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  function compactDuration(minutes) {
    const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const rest = totalMinutes % 60;
      return rest ? `${hours}h ${rest}m` : `${hours}h`;
    }
    return `${totalMinutes}m`;
  }

  function formatDateTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function smokeIntervalTone(minutes) {
    if (minutes < 30) return 'is-critical';
    if (minutes < 60) return 'is-warning';
    if (minutes < 120) return 'is-neutral';
    if (minutes < 240) return 'is-positive';
    return 'is-recovery';
  }

  function buildHorizontalIntervalViolin(values = [], { maxValue = null, median = null, q1 = null, q3 = null, qualityLabel = '', subtitle = '' } = {}) {
    const durations = values.map(value => Number(value)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!durations.length) return '';

    const upperBound = Math.max(Number(maxValue) || 0, durations[durations.length - 1] || 0, 60);
    const lowerBound = 0;
    const safeMedian = Number.isFinite(Number(median)) ? Number(median) : percentile(durations, 0.5);
    const safeQ1 = Number.isFinite(Number(q1)) ? Number(q1) : percentile(durations, 0.25);
    const safeQ3 = Number.isFinite(Number(q3)) ? Number(q3) : percentile(durations, 0.75);
    const width = 720;
    const height = 260;
    const paddingX = 28;
    const topPad = 28;
    const centerY = 118;
    const halfHeight = 62;
    const innerWidth = width - (paddingX * 2);
    const sampleCount = Math.max(30, Math.min(48, Math.round(durations.length * 1.4)));
    const bandwidth = Math.max(16, Math.min(120, upperBound / Math.max(6, Math.min(14, Math.round(Math.sqrt(durations.length) + 4)))));
    const valueToX = value => paddingX + (1 - ((Math.max(lowerBound, Math.min(upperBound, value)) - lowerBound) / (upperBound - lowerBound || 1))) * innerWidth;

    const densityPoints = Array.from({ length: sampleCount }, (_, index) => {
      const ratio = sampleCount === 1 ? 0 : index / (sampleCount - 1);
      const value = lowerBound + ((upperBound - lowerBound) * ratio);
      const density = durations.reduce((sum, current) => {
        const z = (current - value) / bandwidth;
        return sum + Math.exp(-0.5 * z * z);
      }, 0);
      return { value, density };
    }).map((point, index, array) => {
      const neighbours = [array[index - 1], point, array[index + 1]].filter(Boolean);
      return { ...point, density: average(neighbours.map(entry => entry.density)) };
    });

    const maxDensity = Math.max(...densityPoints.map(point => point.density), 1);
    const scaledPoints = densityPoints.map(point => ({ ...point, radius: (point.density / maxDensity) * halfHeight, x: valueToX(point.value) }));
    const upperPath = scaledPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${(centerY - point.radius).toFixed(2)}`).join(' ');
    const lowerPath = [...scaledPoints].reverse().map(point => `L ${point.x.toFixed(2)} ${(centerY + point.radius).toFixed(2)}`).join(' ');
    const violinPath = `${upperPath} ${lowerPath} Z`;
    const centerLine = `M ${paddingX} ${centerY} L ${width - paddingX} ${centerY}`;
    const q1x = valueToX(safeQ1);
    const q3x = valueToX(safeQ3);
    const medianX = valueToX(safeMedian);
    const peakPoint = scaledPoints.reduce((best, point) => point.density > best.density ? point : best, scaledPoints[0]);
    const peakValue = peakPoint?.value || safeMedian;
    const tickCount = upperBound <= 180 ? 5 : 6;
    const tickValues = Array.from({ length: tickCount }, (_, index) => (upperBound / Math.max(1, tickCount - 1)) * index);
    const uniqueTicks = [...new Set(tickValues.map(value => Math.max(0, Math.min(upperBound, Math.round(value)))))] ;
    const tickMarkup = uniqueTicks.map(value => {
      const x = valueToX(value);
      return `<g class="interval-violin-tick"><line x1="${x}" y1="${centerY + halfHeight + 8}" x2="${x}" y2="${centerY + halfHeight + 18}" /><text x="${x}" y="${height - 14}" text-anchor="middle">${escapeHtml(compactDuration(value))}</text></g>`;
    }).join('');

    return `
      <section class="interval-violin-card" aria-label="Verteilung der aktiven Rauchpausen als horizontaler Violin-Plot" data-hf-active-pause-visual="true">
        <div class="interval-violin-head">
          <div>
            <strong>Verteilung der Rauchpausen</strong>
            <small>${escapeHtml(subtitle || 'Aktive Tagespausen · Schlafzeit neutralisiert')}</small>
          </div>
          <span class="badge muted">${escapeHtml(qualityLabel || 'Verteilung')}</span>
        </div>
        <div class="interval-violin-shell">
          <svg class="interval-violin-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Links liegen längere aktive Pausen, rechts kürzere Abstände zwischen Zigaretten.">
            <defs><linearGradient id="interval-violin-fill" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#8ff0a7" stop-opacity="0.88" /><stop offset="45%" stop-color="#4ad7d1" stop-opacity="0.9" /><stop offset="100%" stop-color="#b79cff" stop-opacity="0.82" /></linearGradient></defs>
            <rect class="interval-violin-bg" x="${paddingX}" y="${topPad}" width="${innerWidth}" height="${(halfHeight * 2)}" rx="28" />
            <path class="interval-violin-axis-line" d="${centerLine}"></path>
            <line class="interval-violin-iqr" x1="${q3x}" y1="${centerY}" x2="${q1x}" y2="${centerY}"></line>
            <path class="interval-violin-area" d="${violinPath}"></path>
            <line class="interval-violin-median" x1="${medianX}" y1="${centerY - halfHeight - 8}" x2="${medianX}" y2="${centerY + halfHeight + 8}"></line>
            <circle class="interval-violin-peak" cx="${valueToX(peakValue)}" cy="${centerY}" r="5"></circle>
            ${tickMarkup}
          </svg>
        </div>
        <div class="interval-violin-caption"><p><b>Leserichtung:</b> links = längere aktive Tagespausen · rechts = dichtere Rauchmomente.</p><div class="interval-violin-legend"><span><i class="is-fill"></i>Dichteform</span><span><i class="is-iqr"></i>mittlere 50%</span><span><i class="is-median"></i>Median</span><span><i class="is-peak"></i>Dichte-Peak ${escapeHtml(compactDuration(peakValue))}</span></div></div>
      </section>
    `;
  }

  function renderActiveSmokeIntervalVisual(state, days = 28) {
    const visual = document.getElementById('smokeIntervalVisual');
    if (!visual || !state) return;
    const allSnapshots = buildActiveSnapshots(state, days);
    const skippedPauseBridges = allSnapshots.filter(item => item.crossesPause).length;
    const finiteSnapshots = allSnapshots.filter(item => Number.isFinite(Number(item.rawMinutes)) && Number(item.rawMinutes) > 0);
    const skippedBoundaryIntervals = finiteSnapshots.filter(item => !item.isDaytimeInterval).length;
    const snapshots = finiteSnapshots.filter(item => item.isDaytimeInterval && !item.crossesPause && Number.isFinite(item.activeMinutes) && item.activeMinutes > 0);
    const signature = `${days}:${snapshots.map(item => `${item.id}:${Math.round(item.rawMinutes)}:${Math.round(item.activeMinutes)}`).join('|')}:${skippedPauseBridges}:${skippedBoundaryIntervals}`;
    if (visual.dataset.hfActivePauseSignature === signature && visual.querySelector('[data-hf-active-pause-visual="true"]')) return;
    visual.dataset.hfActivePauseSignature = signature;

    if (!snapshots.length) {
      const quality = document.getElementById('smokeIntervalQuality');
      if (quality) quality.textContent = skippedPauseBridges ? 'pausiert' : 'lernt noch';
      const hints = [];
      if (skippedPauseBridges) hints.push(`${skippedPauseBridges} Pause-Brücke${skippedPauseBridges === 1 ? '' : 'n'} ausgeklammert`);
      if (skippedBoundaryIntervals) hints.push(`${skippedBoundaryIntervals} Nacht-/Mehrtagspause${skippedBoundaryIntervals === 1 ? '' : 'n'} nicht in der Dichteverteilung`);
      const pauseHint = hints.length ? ` ${hints.join(' · ')}.` : '';
      visual.innerHTML = `<div class="empty-state" data-hf-active-pause-visual="true">Für die aktive Intervall-Analyse braucht es mindestens zwei Tages-Einträge ausserhalb pausierter Zeiträume.${pauseHint}</div>`;
      return;
    }

    const durations = snapshots.map(item => Number(item.activeMinutes));
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const q1 = percentile(sortedDurations, 0.25);
    const median = percentile(sortedDurations, 0.5);
    const p75 = percentile(sortedDurations, 0.75);
    const recoveryShare = Math.round((durations.filter(value => value >= 120).length / durations.length) * 100);
    const compressionShare = Math.round((durations.filter(value => value < 60).length / durations.length) * 100);
    const bestDaytime = durations.length ? Math.max(...durations) : null;
    const recent = snapshots.slice(-20);
    const cap = Math.max(240, percentile(sortedDurations, 0.92));
    const violinCap = Math.max(cap, 120);
    const halfIndex = Math.floor(recent.length / 2);
    const earlierSample = recent.slice(0, halfIndex);
    const laterSample = recent.slice(halfIndex);
    const earlyAverage = average(earlierSample.map(item => item.activeMinutes));
    const lateAverage = average(laterSample.map(item => item.activeMinutes));
    const delta = earlierSample.length && laterSample.length ? Math.round(lateAverage - earlyAverage) : 0;
    const qualityLabel = median >= 150 ? 'stark' : recoveryShare >= 40 ? 'stabil' : compressionShare >= 55 ? 'verdichtet' : 'in Bewegung';
    const quality = document.getElementById('smokeIntervalQuality');
    if (quality) quality.textContent = qualityLabel;

    const summary = [
      { label: 'Median-Pause', value: compactDuration(median), detail: 'Robuster Mittelpunkt deiner aktiven Pausen.' },
      { label: '75. Perzentil', value: compactDuration(p75), detail: 'Diesen aktiven Abstand erreichst du im oberen Viertel.' },
      { label: 'Recovery-Quote', value: `${recoveryShare}%`, detail: 'Aktive Intervalle ≥ 2 Stunden im Analysefenster.' },
      { label: 'Beste Tagespause', value: bestDaytime ? compactDuration(bestDaytime) : '–', detail: bestDaytime ? 'Längste aktive Pause ohne Nacht-Effekt.' : 'Noch keine Tagespause vorhanden.' }
    ];

    const violinMarkup = buildHorizontalIntervalViolin(durations, {
      maxValue: violinCap,
      median,
      q1,
      q3: p75,
      qualityLabel,
      subtitle: `Aktive Tagespausen · ${days} Tage · ${durations.length} Pause${durations.length === 1 ? '' : 'n'}${skippedPauseBridges ? ` · ${skippedPauseBridges} Pause-Brücke${skippedPauseBridges === 1 ? '' : 'n'} ausgeklammert` : ''}${skippedBoundaryIntervals ? ` · ${skippedBoundaryIntervals} Nacht-/Mehrtagspause${skippedBoundaryIntervals === 1 ? '' : 'n'} ausgeklammert` : ''}`
    });

    const skyline = recent.map(item => {
      const minutes = Number(item.activeMinutes);
      const height = Math.max(14, Math.round((Math.min(minutes, cap) / cap) * 100));
      const rawHint = Math.round(item.rawMinutes) !== Math.round(minutes) ? ` · roh ${compactDuration(item.rawMinutes)}` : '';
      return `<div class="interval-skyline-bar ${smokeIntervalTone(minutes)}" title="${escapeHtml(`${formatDateTime(item.cigarette.smoked_at || item.cigarette.created_at)} · aktive Pause ${compactDuration(minutes)}${rawHint}`)}"><i style="height:${height}%"></i></div>`;
    }).join('');

    const bucketConfig = [
      { label: '<30 Min.', detail: 'sehr dicht', test: value => value < 30, tone: 'is-critical' },
      { label: '30–59 Min.', detail: 'verdichtet', test: value => value >= 30 && value < 60, tone: 'is-warning' },
      { label: '1–2 Std.', detail: 'neutral', test: value => value >= 60 && value < 120, tone: 'is-neutral' },
      { label: '2–4 Std.', detail: 'stark', test: value => value >= 120 && value < 240, tone: 'is-positive' },
      { label: '4+ Std.', detail: 'Recovery', test: value => value >= 240, tone: 'is-recovery' }
    ];
    const buckets = bucketConfig.map(bucket => {
      const count = durations.filter(bucket.test).length;
      const share = Math.round((count / durations.length) * 100);
      return `<article class="interval-bucket-card ${bucket.tone}"><div class="interval-bucket-copy"><small>${escapeHtml(bucket.label)}</small><strong>${share}%</strong><p>${count}/${durations.length} aktive Intervalle · ${escapeHtml(bucket.detail)}</p></div><div class="interval-bucket-track"><i style="width:${Math.max(8, share)}%"></i></div></article>`;
    }).join('');

    const trendText = recent.length < 4
      ? 'Noch wenig aktive Intervallhistorie – sammle ein paar weitere Einträge für belastbare Trend-Aussagen.'
      : delta >= 10
        ? `Die neueren aktiven Pausen sind im Schnitt ${compactDuration(delta)} länger als die älteren im sichtbaren Verlauf.`
        : delta <= -10
          ? `Die neueren aktiven Pausen sind im Schnitt ${compactDuration(Math.abs(delta))} kürzer – hier lohnt sich ein gezielter Coach-Einsatz.`
          : 'Die letzten aktiven Pausen liegen stabil nahe am bisherigen Niveau.';

    visual.innerHTML = `
      <div class="smoking-visual-summary-grid" data-hf-active-pause-visual="true">
        ${summary.map(item => `<article><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}
      </div>
      ${violinMarkup}
      <div class="interval-skyline-card" data-hf-active-pause-visual="true"><div class="interval-skyline-head"><strong>Sequenz der letzten ${recent.length} aktiven Pausen</strong><small>höher = längerer aktiver Abstand</small></div><div class="interval-skyline">${skyline}</div><div class="interval-skyline-axis"><span>älter</span><span>neu</span></div></div>
      <div class="interval-bucket-grid" data-hf-active-pause-visual="true">${buckets}</div>
      <div class="coach-callout interval-callout" data-hf-active-pause-visual="true"><b>Signal:</b> ${escapeHtml(trendText)}</div>
    `;
  }

  function patchInsights(state) {
    const grid = document.getElementById('insightsGrid');
    if (!state || !grid) return;
    const best = bestActiveDaytimePauseMinutes(state);
    const card = Array.from(grid.querySelectorAll('.insight-card')).find(item => {
      const title = item.querySelector('strong')?.textContent?.trim().toLowerCase() || '';
      return title === 'beste tagespause';
    });
    if (!card) return;
    const body = card.querySelector('p');
    if (!body) return;
    const nextText = best == null
      ? 'Noch keine aktive Tagespause zwischen zwei Zigaretten vorhanden.'
      : `Längste aktive Pause innerhalb eines Tages: ${compactDuration(best)}. Schlaf-/Nachtzeit ist neutralisiert.`;
    if (body.textContent !== nextText) body.textContent = nextText;
    card.dataset.hfActivePauseMetric = 'scoring-interval';
  }

  function patchSmokeAnalytics() {
    const state = readState();
    if (!state) return;
    renderActiveSmokeIntervalVisual(state, 28);
    patchInsights(state);
  }

  function schedulePatch(delay = 80) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(patchSmokeAnalytics, delay);
  }

  function start() {
    [120, 500, 1200].forEach(delay => window.setTimeout(patchSmokeAnalytics, delay));
    const observer = new MutationObserver(() => schedulePatch(80));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) schedulePatch(80); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedulePatch(120); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  if (modules) {
    modules.register('smoke-active-pause-metric', {
      description: 'Uses scoring_interval_minutes for the smoke interval visual and dashboard active daytime pause insight so sleep/night time is neutralized.',
      source: 'localStorage.cigarettes.scoring_interval_minutes',
      mutatesState: false,
      active: true
    });
  }
})(window, document);
