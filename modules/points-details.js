(function initPointsDetails(window, document) {
  'use strict';
  const PAGE_DAYS = 14;
  let modal, trigger, range = '30', limit = PAGE_DAYS, hadScrollLock = false;
  const number = value => Number(value).toLocaleString('de-CH');
  const signed = value => `${value > 0 ? '+' : ''}${number(value)}`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  function category(row) {
    if (/^morgenroutine/i.test(row.reason || '')) return 'Morgenroutine';
    if (/^Alkohol[:\-]/i.test(row.reason || '')) return 'Alkohol';
    if (/^Rauchziel:/i.test(row.reason || '')) return 'Rauchziel';
    return ({ habit: 'Habits', task: 'Aufgaben', cigarette: 'Rauchen', bonus: 'Bonus', manual: 'Pausen / Anpassungen', fitness: 'Fitness', alcohol: 'Alkohol' })[row.source_type] || 'Weitere Punkte';
  }

  function groupRows(rows, selectedRange, now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - Number(selectedRange || 1) + 1);
    const cutoff = dateKey(start), today = dateKey(now);
    const days = new Map();
    for (const row of rows) {
      const date = new Date(row.earned_at || row.created_at || '');
      const key = /^\d{4}-\d{2}-\d{2}$/.test(row.day || '') ? row.day : Number.isNaN(date.getTime()) ? '' : dateKey(date);
      if (selectedRange !== 'all' && (!key || key < cutoff || key > today)) continue;
      if (!days.has(key)) days.set(key, { key, rows: [], plus: 0, minus: 0, total: 0, categories: new Map() });
      const day = days.get(key), points = Number(row.points || 0);
      if (!Number.isFinite(points)) continue;
      day.rows.push({ ...row, points });
      day.total += points;
      day.plus += Math.max(0, points);
      day.minus += Math.min(0, points);
      const label = category(row);
      day.categories.set(label, (day.categories.get(label) || 0) + points);
    }
    return [...days.values()].sort((a, b) => b.key.localeCompare(a.key));
  }

  function dayLabel(key) {
    if (!key) return 'Ohne Datum';
    return new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${key}T12:00:00`));
  }

  function renderDay(day, open) {
    const categories = [...day.categories].map(([label, value]) => `<span>${escape(label)} <b>${signed(value)}</b></span>`).join('');
    const rows = day.rows.slice().sort((a, b) => String(b.earned_at || b.created_at || '').localeCompare(String(a.earned_at || a.created_at || '')));
    return `<details class="points-day" data-day="${day.key}" ${open ? 'open' : ''}>
      <summary><span><b>${escape(dayLabel(day.key))}</b><small>${day.rows.length} Buchungen · Gutschriften ${signed(day.plus)} · Abzüge ${signed(day.minus)}</small></span><strong class="${day.total < 0 ? 'points-negative' : 'points-positive'}">${signed(day.total)} <small>Pkt.</small></strong></summary>
      <div class="points-categories">${categories}</div>
      <ul class="points-entries">${rows.map(row => {
        const date = new Date(row.earned_at || row.created_at || '');
        const time = row.day ? 'Tagesbuchung' : Number.isNaN(date.getTime()) ? 'Zeit unbekannt' : new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' }).format(date);
        return `<li><div><b>${escape(row.reason || category(row))}</b><small>${escape(category(row))} · ${time}</small></div><strong class="${row.points < 0 ? 'points-negative' : 'points-positive'}">${signed(row.points)} Pkt.</strong></li>`;
      }).join('')}</ul>
    </details>`;
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'pointsDetailsModal';
    modal.className = 'coach-modal points-details-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pointsDetailsTitle');
    modal.innerHTML = `<section class="coach-modal-card points-details-card" tabindex="-1">
      <button type="button" class="icon-btn coach-close-btn" data-points-close aria-label="Punktedetails schliessen">×</button>
      <header class="points-details-head"><p class="eyebrow">Companion Evolution · Details</p><h2 id="pointsDetailsTitle">Deine Punkte. Nachvollziehbar.</h2><p>Jede Gutschrift, jeder Abzug – und was am Ende des Tages bleibt.</p></header>
      <div data-points-overview></div>
      <div class="points-period" role="group" aria-label="Zeitraum">${[['7', '7 Tage'], ['30', '30 Tage'], ['all', 'Gesamter Verlauf']].map(([value, label]) => `<button type="button" class="pill secondary" data-points-range="${value}" aria-pressed="false">${label}</button>`).join('')}</div>
      <div data-points-history></div>
      <p class="points-footnote">Die Details zeigen die aktuell gültigen Buchungen, einschliesslich nachträglicher Korrekturen. Pausierte Einträge werden wie im Gesamtstand ausgeblendet. Tagesboni zählen zum zugehörigen Tag; andere Buchungen zur lokalen Zeit. Tage ohne Buchung werden ausgelassen.</p>
    </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  function render(preserveDays = false) {
    const snapshot = window.HabitFlowPointsLive?.snapshot();
    if (!snapshot) {
      modal.querySelector('[data-points-history]').innerHTML = '<p class="points-empty">Die Punktedaten sind noch nicht bereit. Bitte öffne die Details erneut, sobald das Dashboard geladen ist.</p>';
      return;
    }
    const opened = new Set([...modal.querySelectorAll('.points-day[open]')].map(day => day.dataset.day));
    const days = groupRows(snapshot.rows, range);
    const total = days.reduce((sum, day) => sum + day.total, 0);
    const plus = days.reduce((sum, day) => sum + day.plus, 0);
    const minus = days.reduce((sum, day) => sum + day.minus, 0);
    const meta = snapshot.evolution;
    modal.querySelector('[data-points-overview]').innerHTML = `<div class="points-evolution"><div><small>Gesamtstand · alle Buchungen</small><strong>${number(snapshot.total)} <span>Pkt.</span></strong></div><div><b>Stufe ${meta.stage} / 20</b><span>${meta.stage >= 20 ? 'Maximalstufe erreicht' : `${number(meta.nextPoints)} Pkt. bis Stufe ${meta.stage + 1}`}</span></div><progress max="100" value="${meta.stageProgress}" aria-label="Fortschritt zur nächsten Stufe"></progress></div><p class="points-explanation">Gutschriften minus Abzüge ergeben deinen Gesamtstand. Die Stufe startet bei 0 Punkten; negative Salden bleiben sichtbar. Energie und Bindung sind separate Werte.</p>`;
    modal.querySelectorAll('[data-points-range]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pointsRange === range)));
    modal.querySelector('[data-points-history]').innerHTML = `<div class="points-period-summary" role="status"><article><small>Saldo im Zeitraum</small><strong>${signed(total)}</strong></article><article><small>Gutschriften</small><strong class="points-positive">${signed(plus)}</strong></article><article><small>Abzüge</small><strong class="points-negative">${signed(minus)}</strong></article></div><div class="points-days">${days.length ? days.slice(0, limit).map((day, i) => renderDay(day, preserveDays ? opened.has(day.key) : i === 0)).join('') : '<p class="points-empty">Keine Punktebuchungen in diesem Zeitraum. Sobald du Punkte sammelst, erscheint hier die Verteilung pro Tag.</p>'}</div><div class="points-history-footer"><span>${Math.min(days.length, limit)} von ${days.length} Tagen mit Buchungen · Summen enthalten den gesamten Zeitraum</span>${days.length > limit ? '<button type="button" class="pill secondary" data-points-more>Weitere Tage anzeigen</button>' : ''}</div>`;
  }

  function close() {
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    if (!hadScrollLock) document.body.classList.remove('modal-open');
    const target = trigger?.isConnected ? trigger : document.querySelector('[data-points-details-open]');
    target?.focus({ preventScroll: true });
  }

  document.addEventListener('click', event => {
    const open = event.target.closest('[data-points-details-open]');
    if (open) {
      trigger = open;
      ensureModal();
      hadScrollLock = document.body.classList.contains('modal-open');
      limit = PAGE_DAYS;
      render();
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
      modal.querySelector('[data-points-close]').focus({ preventScroll: true });
      return;
    }
    if (!modal || modal.classList.contains('hidden')) return;
    if (event.target === modal || event.target.closest('[data-points-close]')) close();
    const filter = event.target.closest('[data-points-range]');
    if (filter) { range = filter.dataset.pointsRange; limit = PAGE_DAYS; render(); }
    if (event.target.closest('[data-points-more]')) {
      const previous = limit;
      limit += PAGE_DAYS;
      render(true);
      modal.querySelectorAll('.points-day summary')[previous]?.focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (!modal || modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button, summary, [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }, true);
  window.addEventListener('habitflow:points-update', () => {
    if (modal && !modal.classList.contains('hidden')) render(true);
  });
})(window, document);
