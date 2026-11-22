/* Yankee Text – textový editor */
(() => {
  const editor = document.getElementById('editor');
  const doc = openOrCreate('writer', 'Nový dokument', '');
  editor.innerHTML = doc.content || '';

  const autosave = makeAutosave(doc, () => editor.innerHTML, document.getElementById('status'));
  bindTitle(doc, document.getElementById('title'), autosave);

  document.execCommand('styleWithCSS', false, true);

  function exec(cmd, val) {
    editor.focus();
    document.execCommand(cmd, false, val ?? null);
    changed();
  }

  // Tlačidlá panela
  document.querySelectorAll('[data-cmd]').forEach(b =>
    b.addEventListener('mousedown', e => { e.preventDefault(); exec(b.dataset.cmd); }));

  document.getElementById('block').onchange = e => exec('formatBlock', '<' + e.target.value + '>');
  document.getElementById('font').onchange = e => exec('fontName', e.target.value);
  document.getElementById('size').onchange = e => exec('fontSize', e.target.value);
  document.getElementById('fore').oninput = e => exec('foreColor', e.target.value);
  document.getElementById('back').oninput = e => exec('hiliteColor', e.target.value);

  document.getElementById('link').onclick = () => {
    const url = prompt('Adresa odkazu (https://…):', 'https://');
    if (url && url !== 'https://') exec('createLink', url);
  };

  document.getElementById('img').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => exec('insertImage', r.result);
    r.readAsDataURL(f);
    e.target.value = '';
  };

  document.getElementById('table').onclick = () => {
    const rows = parseInt(prompt('Počet riadkov:', '3'), 10);
    const cols = parseInt(prompt('Počet stĺpcov:', '3'), 10);
    if (!(rows > 0 && cols > 0 && rows <= 100 && cols <= 20)) return;
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>' + Array(cols).fill(r === 0 ? '<th>&nbsp;</th>' : '<td>&nbsp;</td>').join('') + '</tr>';
    }
    exec('insertHTML', html + '</tbody></table><p><br></p>');
  };

  document.getElementById('date').onclick = () =>
    exec('insertText', new Date().toLocaleDateString('sk-SK'));

  // Nájsť a nahradiť
  function findReplace() {
    const what = prompt('Nájsť:'); if (!what) return;
    const withWhat = prompt(`Nahradiť „${what}“ za (nechajte prázdne pre iba počítanie):`);
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let count = 0, node;
    const nodes = [];
    while ((node = walker.nextNode())) nodes.push(node);
    for (const n of nodes) {
      const parts = n.nodeValue.split(what);
      if (parts.length > 1) {
        count += parts.length - 1;
        if (withWhat !== null && withWhat !== '') n.nodeValue = parts.join(withWhat);
      }
    }
    if (withWhat) changed();
    alert(withWhat ? `Nahradených výskytov: ${count}` : `Nájdených výskytov: ${count}`);
  }
  document.getElementById('find').onclick = findReplace;

  // Počítadlo slov
  const wc = document.getElementById('wc');
  function updateCount() {
    const text = editor.innerText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    wc.textContent = `Slová: ${words} · Znaky: ${text.length}`;
  }

  // Stav tlačidiel
  function updateState() {
    document.querySelectorAll('[data-cmd]').forEach(b => {
      try { b.classList.toggle('active', document.queryCommandState(b.dataset.cmd)); } catch (e) { }
    });
  }

  function changed() { autosave.schedule(); updateCount(); }
  editor.addEventListener('input', changed);
  document.addEventListener('selectionchange', updateState);

  // Klávesové skratky
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); autosave.saveNow(); }
    else if (k === 'h') { e.preventDefault(); findReplace(); }
    else if (k === 'p') { e.preventDefault(); window.print(); }
  });
  editor.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
  });

  // Nový / Otvoriť
  document.getElementById('new').onclick = () => {
    autosave.saveNow();
    location.href = 'writer.html';
  };
  document.getElementById('open').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      const nd = Store.create('writer', f.name.replace(/\.[^.]+$/, ''), '');
      if (/\.txt$/i.test(f.name)) {
        nd.content = t.split(/\r?\n/).map(l => '<p>' + (escapeHtml(l) || '<br>') + '</p>').join('');
      } else {
        const m = t.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const tmp = document.createElement('div');
        tmp.innerHTML = m ? m[1] : t;
        tmp.querySelectorAll('script,style,iframe,object,embed').forEach(n => n.remove());
        tmp.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); }));
        nd.content = tmp.innerHTML;
      }
      Store.save(nd);
      location.href = 'writer.html?id=' + nd.id;
    });
  };

  // Export
  function fullHtml() {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;max-width:800px;margin:40px auto}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 8px}</style></head>
<body>${editor.innerHTML}</body></html>`;
  }
  document.getElementById('export').onchange = e => {
    const v = e.target.value; e.target.value = '';
    const name = safeName(doc.title);
    if (v === 'doc') {
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
        fullHtml().replace(/^<!doctype html><html>/i, '');
      download(name + '.doc', '﻿' + html, 'application/msword');
    } else if (v === 'html') download(name + '.html', fullHtml(), 'text/html;charset=utf-8');
    else if (v === 'txt') download(name + '.txt', editor.innerText, 'text/plain;charset=utf-8');
    else if (v === 'pdf') window.print();
  };

  updateCount();
  editor.focus();
})();
