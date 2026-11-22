/* Yankee Office – jednoduché úložisko dokumentov v prehliadači (localStorage) */
const Store = (() => {
  const KEY = 'yankee-office-docs-v1';

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeAll(docs) {
    try { localStorage.setItem(KEY, JSON.stringify(docs)); return true; }
    catch (e) { alert('Nepodarilo sa uložiť dokument (úložisko je plné alebo zablokované).'); return false; }
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    list() {
      return Object.values(readAll()).sort((a, b) => b.updated - a.updated);
    },
    get(id) { return readAll()[id] || null; },
    create(type, title, content) {
      const docs = readAll();
      const doc = { id: uid(), type, title: title || 'Bez názvu', content: content ?? null, created: Date.now(), updated: Date.now() };
      docs[doc.id] = doc;
      writeAll(docs);
      return doc;
    },
    save(doc) {
      const docs = readAll();
      doc.updated = Date.now();
      docs[doc.id] = doc;
      return writeAll(docs);
    },
    remove(id) {
      const docs = readAll();
      delete docs[id];
      writeAll(docs);
    },
    exportAll() { return JSON.stringify(readAll(), null, 2); },
    importAll(json) {
      const incoming = JSON.parse(json);
      const docs = readAll();
      let n = 0;
      for (const d of Object.values(incoming)) {
        if (d && d.id && d.type) { docs[d.id] = d; n++; }
      }
      writeAll(docs);
      return n;
    }
  };
})();

/* Spoločné pomocné funkcie */
function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function safeName(name) {
  return (name || 'dokument').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'dokument';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Načíta dokument z URL (?id=...) alebo vytvorí nový daného typu */
function openOrCreate(type, defaultTitle, defaultContent) {
  const params = new URLSearchParams(location.search);
  let doc = params.get('id') ? Store.get(params.get('id')) : null;
  if (!doc || doc.type !== type) {
    doc = Store.create(type, defaultTitle, defaultContent);
    history.replaceState(null, '', '?id=' + doc.id);
  }
  return doc;
}

/* Automatické ukladanie s oneskorením */
function makeAutosave(doc, getContent, statusEl) {
  let timer = null;
  function saveNow() {
    clearTimeout(timer);
    doc.content = getContent();
    if (Store.save(doc) && statusEl) {
      statusEl.textContent = 'Uložené ' + new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
    }
  }
  function schedule() {
    if (statusEl) statusEl.textContent = 'Ukladám…';
    clearTimeout(timer);
    timer = setTimeout(saveNow, 600);
  }
  window.addEventListener('beforeunload', () => { if (timer) saveNow(); });
  return { schedule, saveNow };
}

function bindTitle(doc, input, autosave) {
  input.value = doc.title;
  document.title = doc.title + ' – Yankee Office';
  input.addEventListener('input', () => {
    doc.title = input.value || 'Bez názvu';
    document.title = doc.title + ' – Yankee Office';
    autosave.schedule();
  });
}

/* Načítanie knižnice na požiadanie (funguje aj pri otvorení zo súboru file://) */
const _loaded = {};
function loadScript(src) {
  if (!_loaded[src]) {
    _loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => { delete _loaded[src]; reject(new Error('Nepodarilo sa načítať ' + src)); };
      document.head.appendChild(s);
    });
  }
  return _loaded[src];
}

const PAGE_FOR = { writer: 'writer.html', sheet: 'sheet.html', slides: 'slides.html' };
const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  yslides: 'application/json'
};

/* Prevedie súbor (Blob/File) na dokument Yankee Office. Vracia uložený dokument. */
async function importFile(blob, filename) {
  const ext = (filename.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
  const base = filename.replace(/\.yslides\.json$/i, '').replace(/\.[^.]+$/, '') || 'Dokument';
  if (ext === 'docx') {
    const html = await Docx.toHtml(await blob.arrayBuffer());
    return Store.create('writer', base, html);
  }
  if (['xlsx', 'xlsm', 'xls', 'ods', 'csv', 'tsv'].includes(ext)) {
    return Store.create('sheet', base, await XlsxIO.read(blob, ext));
  }
  if (/\.yslides(\.json)?$/i.test(filename) || ext === 'json') {
    const data = JSON.parse(await blob.text());
    if (!data || !Array.isArray(data.slides)) throw new Error('Súbor nie je prezentácia Yankee Office.');
    return Store.create('slides', base, data);
  }
  if (['html', 'htm', 'doc', 'txt', 'md', 'rtf'].includes(ext)) {
    const t = await blob.text();
    let html;
    if (ext === 'txt' || ext === 'md') html = t.split(/\r?\n/).map(l => '<p>' + (escapeHtml(l) || '<br>') + '</p>').join('');
    else if (ext === 'rtf') throw new Error('Formát RTF nie je podporovaný – uložte ho ako .docx.');
    else {
      if (ext === 'doc' && !/<html|<body|<p[\s>]/i.test(t)) throw new Error('Starý binárny formát .doc nie je podporovaný – otvorte ho vo Worde a uložte ako .docx.');
      const m = t.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      html = sanitizeHtml(m ? m[1] : t);
    }
    return Store.create('writer', base, html);
  }
  if (ext === 'pptx') throw new Error('Otváranie .pptx zatiaľ nie je podporované. Prezentácie sa dajú do .pptx ukladať.');
  throw new Error('Nepodporovaný typ súboru: .' + ext);
}

function sanitizeHtml(html) {
  const tmp = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
  tmp.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove());
  tmp.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
    if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
  }));
  return tmp.innerHTML;
}

function toast(msg, ms = 3500) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

/* Registrácia offline režimu (PWA) – len pri http(s) */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
