(() => {
  'use strict';
  const domain = window.HabitFlowWeeklyPointsDomain;
  let data = null, model = null, offset = 0, selected = 51, frame = 0, root = null, canvas = null, geometry = null, limit = 40, revealSelection = true;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = n => (n > 0 ? '+' : '') + n.toLocaleString('de-CH', { maximumFractionDigits: 1 });
  const date = stamp => new Date(stamp).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const find = id => root.querySelector('#' + id);
  function select(index) {
    selected = Math.max(0, Math.min(model.weeks.length - 1, index));
    limit = 40;
    details();
    draw();
    find('weeklyPointsWeeks').querySelector('[data-week="' + selected + '"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function details() {
    const week = model.weeks[selected];
    find('weeklyPointsSelect').value = String(selected);
    find('weeklyPointsSelection').textContent = 'KW ' + week.number + ' · ' + week.year + ' · ' + date(week.start) + '–' + date(week.start + 6 * 86400000);
    find('weeklyPointsTotals').textContent = fmt(week.positivePoints) + ' / ' + fmt(week.negativePoints) + ' Punkte';
    const items = [...week.positive].reverse().concat([...week.negative].reverse());
    find('weeklyPointsItems').innerHTML = items.length ? items.slice(0, limit).map(item =>
      '<li><i aria-hidden="true" style="background:' + domain.color(item.points) + '"></i><span>' + esc(item.label) +
      '<small>' + (item.type === 'task' ? 'Task' : item.type === 'habit' ? 'Habit' : 'Punkte') + ' · ' + item.logs + ' Buchung' + (item.logs === 1 ? '' : 'en') +
      '</small></span><strong>' + fmt(item.points) + '</strong></li>').join('') : '<li class="weekly-points-empty">Keine Punktebuchungen in dieser Woche.</li>';
    find('weeklyPointsMore').hidden = items.length <= limit;
    find('weeklyPointsWeeks').querySelectorAll('button').forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === selected));
      button.tabIndex = i === selected ? 0 : -1;
    });
    canvas.setAttribute('aria-label', 'Punkte nach Kalenderwoche. Ausgewählt: KW ' + week.number + ', ' + fmt(week.positivePoints) + ' positive und ' + fmt(week.negativePoints) + ' negative Punkte. Pfeiltasten wechseln die Woche; Details stehen unter der Grafik.');
  }
  function draw() {
    if (!model || !root.getBoundingClientRect().width) return;
    const scroll = find('weeklyPointsScroll');
    // Leave a small rounding gutter at browser zoom levels; desktop fits all KWs.
    const availableWidth = Math.max(1, Math.floor(scroll.getBoundingClientRect().width) - 2);
    const width = window.matchMedia('(max-width: 760px)').matches ? Math.max(850, availableWidth) : availableWidth;
    const height = 460, left = 46, top = 30, bottom = 410, zero = 235;
    const column = (width - left - 14) / model.weeks.length;
    const maxPositive = Math.max(6, ...model.weeks.map(w => w.positive.length));
    const maxNegative = Math.max(6, ...model.weeks.map(w => w.negative.length));
    const step = Math.min(13, (zero - top - 10) / maxPositive, (bottom - zero - 10) / maxNegative);
    const size = Math.min(11, column - 5, step * .84);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = height * ratio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    find('weeklyPointsWeeks').style.width = width + 'px';
    find('weeklyPointsWeeks').style.paddingLeft = left + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const styles = getComputedStyle(root);
    const muted = styles.getPropertyValue('--muted').trim() || '#65778c';
    const ink = styles.getPropertyValue('--text').trim() || '#172536';
    ctx.fillStyle = 'rgba(90,155,148,.08)';
    ctx.fillRect(left + selected * column, top - 8, column, bottom - top + 16);
    ctx.strokeStyle = 'rgba(128,145,155,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left - 5, zero); ctx.lineTo(width - 10, zero); ctx.stroke();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.fillStyle = muted;
    for (const sign of [1, -1]) {
      const max = sign > 0 ? maxPositive : maxNegative;
      const tick = Math.max(1, Math.ceil(max / 4));
      for (let value = tick; value <= max; value += tick) {
        const y = zero - sign * value * step;
        ctx.fillText(String(sign * value), left - 10, y + 4);
      }
    }
    ctx.fillText('0', left - 10, zero + 4);
    ctx.textAlign = 'left'; ctx.fillText('Positiv', 4, 14); ctx.fillText('Negativ', 4, height - 8);
    const hits = model.weeks.map(() => []);
    model.weeks.forEach((week, index) => {
      const x = left + index * column + column / 2;
      if (week.number === 1 || index === 0) {
        ctx.fillStyle = ink; ctx.fillText(String(week.year), x - 8, top - 2);
      }
      for (const sign of [1, -1]) {
        (sign > 0 ? week.positive : week.negative).forEach((item, rank) => {
          const y = zero - sign * (rank + .7) * step;
          ctx.fillStyle = domain.color(item.points);
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
          hits[index].push({ x, y, item, week: index });
        });
      }
    });
    if (!model.weeks.some(week => week.positive.length || week.negative.length)) {
      ctx.fillStyle = muted;
      ctx.textAlign = 'center';
      ctx.fillText('Noch keine Punkte im gewählten Zeitraum.', width / 2, zero - 25);
    }
    geometry = { width, left, column, hits };
    if (revealSelection) {
      find('weeklyPointsScroll').scrollLeft = Math.max(0, left + selected * column - find('weeklyPointsScroll').clientWidth / 2);
      revealSelection = false;
    }
  }
  function rebuild() {
    frame = 0;
    if (!data || !root) return;
    model = domain.build({ ...data, offset, count: 52 });
    selected = Math.min(selected, model.weeks.length - 1);
    const first = model.weeks[0], last = model.weeks.at(-1);
    find('weeklyPointsRange').textContent = 'KW ' + first.number + '/' + first.year + ' – KW ' + last.number + '/' + last.year;
    find('weeklyPointsNext').disabled = offset === 0;
    find('weeklyPointsToday').disabled = offset === 0;
    find('weeklyPointsPrev').disabled = offset >= 5148;
    find('weeklyPointsWeeks').innerHTML = model.weeks.map((week, i) => '<button type="button" data-week="' + i +
      '" aria-label="KW ' + week.number + ', ' + week.year + ', ' + esc(fmt(week.positivePoints) + ' / ' + fmt(week.negativePoints)) + ' Punkte">' + week.number + '</button>').join('');
    find('weeklyPointsSelect').innerHTML = model.weeks.map((week, i) => '<option value="' + i + '">KW ' + week.number + ' · ' + week.year + ' · ' + date(week.start) + '</option>').join('');
    details(); draw();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(rebuild);
  }
  function init() {
    root = document.getElementById('weeklyPointsPanel');
    if (!root || !domain) return false;
    canvas = find('weeklyPointsCanvas');
    const change = delta => { offset = Math.max(0, Math.min(5148, offset + delta)); limit = 40; schedule(); };
    find('weeklyPointsPrev').addEventListener('click', () => change(52));
    find('weeklyPointsNext').addEventListener('click', () => change(-52));
    find('weeklyPointsToday').addEventListener('click', () => { offset = 0; selected = 51; limit = 40; revealSelection = true; schedule(); });
    find('weeklyPointsSelect').addEventListener('change', event => { if (model) { select(Number(event.target.value)); find('weeklyPointsDetail').open = true; } });
    find('weeklyPointsMore').addEventListener('click', () => { limit += 40; details(); });
    find('weeklyPointsWeeks').addEventListener('click', event => {
      const button = event.target.closest('[data-week]');
      if (button && model) select(Number(button.dataset.week));
    });
    const keyboard = event => {
      if (!model || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      select(event.key === 'Home' ? 0 : event.key === 'End' ? 51 : selected + (event.key === 'ArrowRight' ? 1 : -1));
      if (event.target !== canvas) find('weeklyPointsWeeks').querySelector('[data-week="' + selected + '"]').focus();
    };
    canvas.addEventListener('keydown', keyboard);
    find('weeklyPointsWeeks').addEventListener('keydown', keyboard);
    function position(event) {
      const box = canvas.getBoundingClientRect();
      return { x: (event.clientX - box.left) * geometry.width / box.width, y: event.clientY - box.top };
    }
    canvas.addEventListener('click', event => {
      if (!geometry) return;
      const p = position(event);
      select(Math.floor((p.x - geometry.left) / geometry.column));
      find('weeklyPointsDetail').open = true;
    });
    canvas.addEventListener('pointermove', event => {
      if (!geometry || event.pointerType === 'touch') return;
      const p = position(event);
      const week = Math.floor((p.x - geometry.left) / geometry.column);
      let closest = null, distance = 10;
      for (const hit of geometry.hits[week] || []) {
        const d = Math.hypot(hit.x - p.x, hit.y - p.y);
        if (d < distance) { closest = hit; distance = d; }
      }
      const tip = find('weeklyPointsTooltip');
      tip.hidden = !closest;
      if (closest) {
        tip.textContent = closest.item.label + ' · ' + fmt(closest.item.points) + ' Punkte · KW ' + model.weeks[week].number;
        const box = root.getBoundingClientRect();
        tip.style.left = Math.max(12, Math.min(box.width - 260, event.clientX - box.left + 12)) + 'px';
        tip.style.top = Math.max(12, event.clientY - box.top - 58) + 'px';
      }
    });
    canvas.addEventListener('pointerleave', () => { find('weeklyPointsTooltip').hidden = true; });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (model) draw(); }).observe(find('weeklyPointsScroll'));
    else window.addEventListener('resize', draw);
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => { if (model) requestAnimationFrame(draw); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    return true;
  }
  window.HabitFlowWeeklyPoints = { render(snapshot) { data = snapshot; if (root || init()) schedule(); } };
})();
