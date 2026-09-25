(function installExhibitionExport(window, document) {
  'use strict';
  const WIDTH = 1600, HEIGHT = 2000;
  const FAMILIES = {
    sans: 'Arial, Helvetica, sans-serif',
    rounded: '"Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif',
    condensed: 'Impact, "Arial Narrow", sans-serif'
  };
  function wrap(context, text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && context.measureText(line + ' ' + word).width > maxWidth) { lines.push(line); line = ''; }
        let part = '';
        for (const char of word) {
          if (part && context.measureText(part + char).width > maxWidth) {
            if (line) { lines.push(line); line = ''; }
            lines.push(part); part = '';
          }
          part += char;
        }
        line += (line ? ' ' : '') + part;
      }
      lines.push(line);
    }
    return lines;
  }
  async function decode(source) {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden.'));
        image.src = url;
      });
    } finally { if (typeof source !== 'string') URL.revokeObjectURL(url); }
  }
  // CPU fallback is used only for this explicit export, including Safari without canvas filters.
  async function applyLook(context, settings) {
    const pixels = context.getImageData(0, 0, WIDTH, HEIGHT);
    const data = pixels.data, brightness = settings.brightness / 100;
    for (let offset = 0; offset < data.length; offset += 4) {
      let r = data[offset], g = data[offset + 1], b = data[offset + 2];
      if (settings.look === 'mono') r = g = b = .2126 * r + .7152 * g + .0722 * b;
      else if (settings.look === 'warm') {
        const sr = .78755 * r + .26915 * g + .06615 * b;
        const sg = .12215 * r + .8901 * g + .0588 * b;
        const sb = .0952 * r + .1869 * g + .69585 * b;
        const gray = .213 * sr + .715 * sg + .072 * sb;
        r = gray + .85 * (sr - gray); g = gray + .85 * (sg - gray); b = gray + .85 * (sb - gray);
      }
      data[offset] = r * brightness; data[offset + 1] = g * brightness; data[offset + 2] = b * brightness;
      if (offset && offset % 1048576 === 0) await new Promise(resolve => window.setTimeout(resolve, 0));
    }
    context.putImageData(pixels, 0, 0);
  }
  async function createPoster(item, original) {
    const api = window.HabitFlowExhibition;
    const settings = api.normalize(item.metadata);
    if (original && (!/^image\/(?:jpeg|png|webp)$/.test(original.type) || !original.size || original.size > 20 * 1024 * 1024)) {
      throw new Error('Das Original muss ein JPG, PNG oder WebP bis 20 MB sein.');
    }
    const source = original || api.safeImage(item.metadata?.image);
    if (!source) throw new Error('Kein gültiges Foto vorhanden.');
    const image = await decode(source);
    if (!image.width || !image.height || image.width * image.height > 60000000) throw new Error('Bitte ein Original bis maximal 60 Megapixel verwenden.');
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH; canvas.height = HEIGHT;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Bildexport wird hier nicht unterstützt.');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, WIDTH, HEIGHT);
      const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
      context.drawImage(image, (WIDTH - image.width * scale) / 2, (HEIGHT - image.height * scale) / 2, image.width * scale, image.height * scale);
      if (settings.look !== 'color' || settings.brightness !== 100) await applyLook(context, settings);
      if (settings.overlay > 0) {
        const strength = settings.overlay / 100;
        const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
        gradient.addColorStop(0, 'rgba(0,0,0,' + .24 * strength + ')');
        gradient.addColorStop(.3, 'rgba(0,0,0,' + .12 * strength + ')');
        gradient.addColorStop(1, 'rgba(0,0,0,' + .86 * strength + ')');
        context.fillStyle = gradient; context.fillRect(0, 0, WIDTH, HEIGHT);
      }
      const padding = 100, maxWidth = WIDTH - padding * 2;
      const family = FAMILIES[settings.font];
      context.fillStyle = settings.color; context.textBaseline = 'top';
      context.font = '700 30px Arial, sans-serif';
      context.fillText('IDEEN / EXHIBITION', padding, padding);
      const title = settings.style === 'poster' ? String(item.title).toUpperCase() : String(item.title);
      let size = settings.style === 'minimal' ? 92 : 150, titleLines, noteLines, titleHeight, noteHeight;
      const titleFont = value => (settings.style === 'editorial' ? 'italic 500 ' : settings.style === 'minimal' ? '600 ' : '900 ') + value + 'px ' + family;
      do {
        context.font = titleFont(size);
        titleLines = wrap(context, title, maxWidth);
        context.font = '400 42px ' + family;
        noteLines = item.note ? wrap(context, item.note, maxWidth) : [];
        titleHeight = titleLines.length * size * 1.08;
        noteHeight = noteLines.length ? 50 + noteLines.length * 60 : 0;
        if (titleHeight + noteHeight <= HEIGHT - padding * 3 - 70 || size <= 48) break;
        size -= 6;
      } while (true);
      let y = HEIGHT - padding - titleHeight - noteHeight;
      context.font = titleFont(size);
      for (const line of titleLines) { context.fillText(line, padding, y); y += size * 1.08; }
      if (noteLines.length) {
        y += 50; context.font = '400 42px ' + family;
        for (const line of noteLines) { context.fillText(line, padding, y); y += 60; }
      }
      return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG konnte nicht erzeugt werden.')), 'image/png'));
    } finally { canvas.width = 0; canvas.height = 0; image.src = ''; }
  }
  let activeDialog;
  function open(item) {
    if (activeDialog) { activeDialog.focus(); return; }
    const dialog = document.createElement('dialog');
    dialog.className = 'hf-ex-export';
    dialog.setAttribute('aria-label', 'Exponat lokal exportieren');
    dialog.innerHTML = '<h3>Dein Exponat als Poster</h3><p>PNG · 1600 × 2000 Pixel · inklusive Text und Foto-Look. Der Export wird nur auf diesem Gerät erstellt.</p>' +
      '<label>Originalfoto optional auswählen<input type="file" accept="image/jpeg,image/png,image/webp"></label>' +
      '<p class="hf-ex-export-hint">Ohne Original wird das kleine gespeicherte Bild hochskaliert – verlorene Details werden nicht wiederhergestellt. Für die beste Qualität dasselbe Originalfoto auswählen. Es wird nicht hochgeladen oder in der App gespeichert.</p>' +
      '<p role="status" aria-live="polite"></p><div><button type="button" class="pill primary" data-create>PNG vorbereiten</button><a class="pill primary" data-download hidden>PNG speichern</a><button class="pill secondary" type="button" data-close>Schließen</button></div>';
    document.body.appendChild(dialog); activeDialog = dialog;
    const previousFocus = document.activeElement;
    let url = '', busy = false;
    const input = dialog.querySelector('input');
    const status = dialog.querySelector('[role="status"]');
    const create = dialog.querySelector('[data-create]');
    const download = dialog.querySelector('[data-download]');
    const cleanup = () => {
      if (url) URL.revokeObjectURL(url);
      input.value = ''; dialog.remove(); activeDialog = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
    dialog.addEventListener('close', cleanup, { once: true });
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    input.addEventListener('change', () => {
      if (url) URL.revokeObjectURL(url);
      url = ''; download.hidden = true; status.textContent = '';
    });
    create.addEventListener('click', async () => {
      if (busy) return;
      busy = true; create.disabled = true; input.disabled = true; download.hidden = true;
      status.textContent = 'Poster wird lokal erstellt …';
      try {
        const blob = await createPoster(item, input.files[0]);
        if (!dialog.isConnected) return;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        download.href = url;
        download.download = (String(item.title).replace(/[^a-z0-9äöüß_-]+/gi, '-').slice(0, 80) || 'Exhibition') + '.png';
        download.hidden = false;
        status.textContent = 'Fertig. „PNG speichern“ lädt das Poster auf dein Gerät.';
        download.focus();
      } catch (error) { if (dialog.isConnected) status.textContent = error.message || 'Export fehlgeschlagen. Bitte erneut versuchen.'; }
      finally { busy = false; create.disabled = false; input.disabled = false; }
    });
    dialog.showModal();
  }
  window.HabitFlowExhibitionExport = Object.freeze({ open, createPoster, wrap });
})(window, document);
