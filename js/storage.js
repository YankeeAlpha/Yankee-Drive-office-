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
