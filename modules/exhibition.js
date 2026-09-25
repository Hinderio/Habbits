(function installExhibition(window, document) {
  'use strict';
  const PAGE_SIZE = 12;
  const MAX_IMAGE_LENGTH = 180000;
  const FONTS = { sans: 'Modern', rounded: 'Soft', condensed: 'Display' };
  const STYLES = { poster: 'Plakat', editorial: 'Editorial', minimal: 'Minimal' };
  const TONES = { white: '#ffffff', red: '#ff6759', gold: '#ffce70' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const pick = (options, value, fallback) => Object.hasOwn(options, value) ? value : fallback;
  function normalizeColor(value, fallback) {
    if (typeof value !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return fallback;
    const color = value.toLowerCase();
    return color.length === 4 ? '#' + [...color.slice(1)].map(char => char + char).join('') : color;
  }
  function normalize(input = {}) {
    return {
      font: pick(FONTS, input.font === 'serif' ? 'rounded' : input.font === 'mono' ? 'condensed' : input.font, 'sans'),
      style: pick(STYLES, input.style, 'poster'),
      tone: pick(TONES, input.tone, 'white'),
      color: normalizeColor(input.color, TONES[pick(TONES, input.tone, 'white')]),
      brightness: typeof input.brightness === 'number' && Number.isFinite(input.brightness) ? Math.min(150, Math.max(50, Math.round(input.brightness))) : 100,
      look: pick({ color: 1, mono: 1, warm: 1 }, input.look, input.monochrome === true ? 'mono' : 'color'),
      monochrome: input.look ? input.look === 'mono' : input.monochrome === true
    };
  }
  function safeImage(value) {
    return typeof value === 'string' && value.length <= MAX_IMAGE_LENGTH &&
      /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) ? value : '';
  }
  function poster(item, preview = false) {
    const settings = normalize(item.metadata);
    const image = safeImage(item.metadata?.image);
    return '<div class="hf-ex-poster ex-font-' + settings.font + ' ex-style-' + settings.style + (settings.look === 'mono' ? ' ex-mono' : settings.look === 'warm' ? ' ex-warm' : '') + (image ? '' : ' ex-empty') + '" style="--ex-text-color:' + settings.color + ';--ex-brightness:' + settings.brightness / 100 + '">' +
      (image ? '<img src="' + image + '" alt="" width="1200" height="1500" loading="' + (preview ? 'eager' : 'lazy') + '" decoding="async">' : '<div class="hf-ex-placeholder" aria-hidden="true"></div>') +
      '<div class="hf-ex-overlay"><small>IDEEN / EXHIBITION</small><h4>' + escape(item.title || 'Eine neue Perspektive') + '</h4><p>' + escape(item.note || '') + '</p></div></div>';
  }
  function options(values, selected) {
    return Object.entries(values).map(([value, label]) => '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' + label + '</option>').join('');
  }
  async function optimize(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Bitte ein JPG-, PNG- oder WebP-Bild verwenden.');
    if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Bitte ein Bild bis maximal 20 MB wählen.');
    let image;
    let objectUrl;
    try {
      if (window.createImageBitmap) image = await window.createImageBitmap(file);
      else {
        objectUrl = URL.createObjectURL(file);
        image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Dieses Bild konnte nicht gelesen werden.'));
          img.src = objectUrl;
        });
      }
      if (!image.width || !image.height || image.width * image.height > 60000000) throw new Error('Das Bild ist zu groß. Bitte vorher auf maximal 60 Megapixel verkleinern.');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Bildverarbeitung ist in diesem Browser nicht verfügbar.');
      let edge = 1440;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const scale = Math.min(1, edge / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL('image/webp', Math.max(.55, .82 - attempt * .05));
        if (safeImage(result)) return result;
        // Browsers without WebP encoding fall back to PNG; use JPEG there.
        const jpeg = canvas.toDataURL('image/jpeg', Math.max(.55, .8 - attempt * .05));
        if (safeImage(jpeg)) return jpeg;
        edge = Math.round(edge * .78);
        await new Promise(resolve => window.setTimeout(resolve, 0));
      }
      throw new Error('Das Bild lässt sich nicht ausreichend verkleinern. Bitte einen kleineren Ausschnitt wählen.');
    } finally {
      image?.close?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }
  function mount(target, api) {
    let root = target.querySelector('[data-exhibition]');
    if (root) { root.exApi = api; root.exRefresh(); return; }
    target.innerHTML = '<section data-exhibition class="hf-exhibition"><div class="panel-head"><div><p class="eyebrow">EXHIBITION</p><h3>Deine Ideen. Deine Ausstellung.</h3></div><span class="badge" data-ex-count></span></div>' +
      '<div class="hf-ex-workspace"><form class="hf-list-form hf-ex-form"><h4 class="full" data-ex-form-title>Ein neues Exponat</h4>' +
      '<label class="full hf-ex-drop"><span>Foto einfügen oder auswählen</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp"><small>Hier ein Foto ablegen oder in diesem Bereich mit ⌘/Strg + V einfügen. Automatisch optimiert, Original bleibt unverändert.</small></label>' +
      '<label class="full"><span>Überschrift</span><input name="title" maxlength="100" required placeholder="Eine neue Perspektive"></label>' +
      '<label class="full"><span>Kurzbeschreibung auf dem Bild</span><textarea name="note" maxlength="280" rows="2" placeholder="Was inspiriert dich daran?"></textarea></label>' +
      '<label><span>Überschriftenstil</span><select name="style">' + options(STYLES, 'poster') + '</select></label>' +
      '<label><span>Schriftart</span><select name="font">' + options(FONTS, 'sans') + '</select></label>' +
      '<label><span>Schriftfarbe</span><input name="color" type="color" value="#ffffff"></label>' +
      '<label><span>Foto-Look</span><select name="look"><option value="color">Originalfarben</option><option value="mono">Schwarz-Weiß</option><option value="warm">Warm / Film</option></select></label>' +
      '<label class="full hf-ex-brightness"><span>Bildhelligkeit · <output data-ex-brightness>100 %</output></span><input name="brightness" type="range" min="50" max="150" step="1" value="100"><small>Nur das Bild wird angepasst, nicht die Schrift. 100 % = keine zusätzliche Helligkeitsänderung.</small></label>' +
      '<div class="full hf-ex-form-actions"><button class="pill primary" type="submit">Exponat speichern</button><button class="pill secondary" type="button" data-ex-cancel hidden>Abbrechen</button></div>' +
      '<p class="full hf-ex-status" role="status" aria-live="polite" data-ex-status></p></form><div class="hf-ex-preview"><p class="eyebrow">LIVE-VORSCHAU</p><div data-ex-preview></div></div></div>' +
      '<div class="hf-ex-gallery" data-ex-gallery></div><nav class="hf-ex-pagination" aria-label="Galerieseiten"><button class="pill secondary" type="button" data-ex-prev>Zurück</button><span data-ex-page></span><button class="pill secondary" type="button" data-ex-next>Weiter</button></nav></section>';
    root = target.querySelector('[data-exhibition]');
    root.exApi = api;
    const form = root.querySelector('form');
    const status = root.querySelector('[data-ex-status]');
    let image = '', editingId = '', page = 0, busy = false, operation = 0;
    const say = message => { status.textContent = message; };
    const draft = () => ({ title: form.elements.title.value.trim(), note: form.elements.note.value.trim(), metadata: { image, style: form.elements.style.value, font: form.elements.font.value, color: form.elements.color.value, brightness: Number(form.elements.brightness.value), look: form.elements.look.value, monochrome: form.elements.look.value === 'mono' } });
    let previewImage = null;
    const preview = () => {
      const item = draft();
      const host = root.querySelector('[data-ex-preview]');
      if (previewImage !== image || !host.firstElementChild) {
        host.innerHTML = poster(item, true);
        previewImage = image;
      } else {
        // Keep the decoded image and DOM in place while adjusting typography or brightness.
        const settings = normalize(item.metadata);
        const card = host.firstElementChild;
        card.className = 'hf-ex-poster ex-font-' + settings.font + ' ex-style-' + settings.style +
          (settings.look === 'mono' ? ' ex-mono' : settings.look === 'warm' ? ' ex-warm' : '') + (image ? '' : ' ex-empty');
        card.style.setProperty('--ex-text-color', settings.color);
        card.style.setProperty('--ex-brightness', settings.brightness / 100);
        card.querySelector('h4').textContent = item.title || 'Eine neue Perspektive';
        card.querySelector('p').textContent = item.note;
      }
      root.querySelector('[data-ex-brightness]').textContent = form.elements.brightness.value + ' %';
    };
    function setBusy(value) {
      busy = value;
      form.querySelectorAll('input, textarea, select, button').forEach(control => { control.disabled = value; });
      root.querySelectorAll('[data-ex-edit],[data-ex-delete]').forEach(control => { control.disabled = value; });
    }
    function reset() {
      operation += 1;
      editingId = ''; image = ''; form.reset();
      root.querySelector('[data-ex-cancel]').hidden = true;
      root.querySelector('[data-ex-form-title]').textContent = 'Ein neues Exponat';
      preview();
    }
    root.exRefresh = () => {
      const items = root.exApi.items;
      const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
      page = Math.min(page, pages - 1);
      root.querySelector('[data-ex-count]').textContent = items.length + ' Exponate';
      root.querySelector('[data-ex-gallery]').innerHTML = items.length ? items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(item =>
        '<article class="hf-ex-piece">' + poster(item) + '<div class="hf-ex-piece-actions"><button type="button" class="pill secondary" data-ex-edit="' + escape(item.id) + '"' + (busy ? ' disabled' : '') + '>Bearbeiten<span class="hf-ex-sr">: ' + escape(item.title) + '</span></button><button type="button" class="pill secondary" data-ex-delete="' + escape(item.id) + '"' + (busy ? ' disabled' : '') + '>Entfernen<span class="hf-ex-sr">: ' + escape(item.title) + '</span></button><button type="button" class="pill secondary" data-ex-export="' + escape(item.id) + '">Exportieren<span class="hf-ex-sr">: ' + escape(item.title) + '</span></button></div></article>'
      ).join('') : '<p class="hf-ex-empty">Deine Ausstellung beginnt mit einem Bild. Füge dein erstes Foto oben ein.</p>';
      root.querySelector('[data-ex-page]').textContent = 'Seite ' + (page + 1) + ' / ' + pages;
      root.querySelector('[data-ex-prev]').disabled = page === 0;
      root.querySelector('[data-ex-next]').disabled = page >= pages - 1;
    };
    async function receive(file) {
      if (busy) return;
      const token = ++operation;
      setBusy(true); say('Foto wird verkleinert …');
      try {
        const result = await optimize(file);
        if (token !== operation || !root.isConnected) return;
        image = result; preview();
        say('Foto bereit · ca. ' + Math.round(image.length * .75 / 1024) + ' KB. Zum Speichern noch bestätigen.');
      } catch (error) { if (root.isConnected) say(error.message || 'Foto konnte nicht verarbeitet werden.'); }
      finally { setBusy(false); form.elements.image.value = ''; }
    }
    form.addEventListener('input', event => { if (event.target.name !== 'image') preview(); });
    form.addEventListener('change', event => { if (event.target.name === 'image' && event.target.files[0]) void receive(event.target.files[0]); else preview(); });
    root.addEventListener('paste', event => {
      const file = Array.from(event.clipboardData?.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
      if (file) { event.preventDefault(); void receive(file); }
    });
    const drop = root.querySelector('.hf-ex-drop');
    drop.addEventListener('dragover', event => event.preventDefault());
    drop.addEventListener('drop', event => { event.preventDefault(); const file = event.dataTransfer?.files?.[0]; if (file) void receive(file); });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      if (!image) { say('Bitte zuerst ein Foto einfügen.'); form.elements.image.focus(); return; }
      try {
        root.exApi.save({ ...draft(), id: editingId });
        reset(); page = 0; root.exRefresh(); say('Exponat gespeichert.');
      } catch (error) { say(error.name === 'QuotaExceededError' ? 'Der lokale Speicher ist voll. Bitte Platz schaffen. Dein Entwurf bleibt erhalten; nichts wurde überschrieben.' : error.message || 'Speichern fehlgeschlagen. Dein Entwurf bleibt erhalten.'); }
    });
    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || busy) return;
      if (button.hasAttribute('data-ex-cancel')) { reset(); say(''); return; }
      if (button.hasAttribute('data-ex-prev') || button.hasAttribute('data-ex-next')) {
        page += button.hasAttribute('data-ex-next') ? 1 : -1; root.exRefresh(); return;
      }
      const id = button.dataset.exEdit || button.dataset.exDelete || button.dataset.exExport;
      if (!id) return;
      const item = root.exApi.items.find(entry => entry.id === id);
      if (!item) return;
      if (button.hasAttribute('data-ex-export')) {
        window.HabitFlowExhibitionExport.open(item);
        return;
      }
      if (button.hasAttribute('data-ex-delete')) {
        if (!window.confirm('Exponat „' + item.title + '“ entfernen?')) return;
        try { root.exApi.save({ ...item, isArchived: true }); if (editingId === id) reset(); root.exRefresh(); say('Exponat entfernt.'); }
        catch (_) { say('Entfernen fehlgeschlagen. Das Exponat bleibt erhalten.'); }
        return;
      }
      editingId = id; image = safeImage(item.metadata?.image);
      const settings = normalize(item.metadata);
      form.elements.title.value = item.title;
      form.elements.note.value = item.note || '';
      for (const key of ['font', 'style', 'color', 'brightness']) form.elements[key].value = settings[key];
      form.elements.look.value = settings.look;
      root.querySelector('[data-ex-cancel]').hidden = false;
      root.querySelector('[data-ex-form-title]').textContent = 'Exponat bearbeiten';
      preview(); say(''); form.elements.title.focus();
    });
    preview(); root.exRefresh();
  }
  window.HabitFlowExhibition = Object.freeze({ mount, normalize, safeImage, optimize, poster });
})(window, document);
