/* Yankee Tabuľky – tabuľkový procesor */
(() => {
  let ROWS = 200, COLS = 26;
  const MAX_ROWS = 5000, MAX_COLS = 104;
  const { numToCol, makeRef, parseRef, computeWorkbook, isErr } = Formula;

  const doc = openOrCreate('sheet', 'Nový zošit', null);
  if (!doc.content || !Array.isArray(doc.content.sheets)) doc.content = { sheets: [{ name: 'Hárok1', cells: {}, styles: {} }] };
  doc.content.sheets.forEach(s => { s.cells ||= {}; s.styles ||= {}; s.charts ||= []; });
  let active = 0;
  const sheet = () => doc.content.sheets[active];

  const autosave = makeAutosave(doc, () => doc.content, document.getElementById('status'));
  bindTitle(doc, document.getElementById('title'), autosave);

  const grid = document.getElementById('grid');
  const fbar = document.getElementById('fbar');
  const cellName = document.getElementById('cellName');
  const tabsEl = document.getElementById('tabs');
  let values = {}, allValues = [];
  let rendered = new Set();
  let anchor = { c: 0, r: 0 }, cur = { c: 0, r: 0 };
  let editing = null; // { c, r, input }
  let undoStack = [], redoStack = [];

  /* ---------- Mriežka ---------- */
  function fitSize() {
    let mr = 0, mc = 0;
    for (const ref of Object.keys(sheet().cells).concat(Object.keys(sheet().styles))) { const p = parseRef(ref); if (p) { mr = Math.max(mr, p.r); mc = Math.max(mc, p.c); } }
    ROWS = Math.min(MAX_ROWS, Math.max(200, mr + 51));
    COLS = Math.min(MAX_COLS, Math.max(26, mc + 3));
  }
  function buildGrid(minRows = 0) {
    fitSize();
    ROWS = Math.min(MAX_ROWS, Math.max(ROWS, minRows));
    rendered = new Set();
    let html = '<thead><tr><th class="corner"></th>';
    for (let c = 0; c < COLS; c++) html += `<th data-col="${c}">${numToCol(c)}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < ROWS; r++) {
      html += `<tr><th data-row="${r}">${r + 1}</th>`;
      for (let c = 0; c < COLS; c++) html += `<td data-c="${c}" data-r="${r}"></td>`;
      html += '</tr>';
    }
    grid.innerHTML = html + '</tbody>';
  }
  const td = (c, r) => grid.tBodies[0].rows[r]?.cells[c + 1];

  function format(v, st) {
    if (isErr(v)) return String(v);
    if (typeof v === 'boolean') return v ? 'PRAVDA' : 'NEPRAVDA';
    if (typeof v === 'number') {
      const f = st && st.f;
      if (f === 'n2') return v.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (f === 'eur') return v.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' });
      if (f === 'pct') return (v * 100).toLocaleString('sk-SK', { maximumFractionDigits: 2 }) + ' %';
      return Number.isInteger(v) ? v.toLocaleString('sk-SK', { useGrouping: false }) : String(+v.toFixed(10)).replace('.', ',');
    }
    return String(v ?? '');
  }

  function renderValues() {
    allValues = computeWorkbook(doc.content.sheets);
    values = allValues[active];
    const styles = sheet().styles;
    const now = new Set([...Object.keys(values), ...Object.keys(styles)]);
    for (const ref of new Set([...now, ...rendered])) {
      const p = parseRef(ref); if (!p || p.r >= ROWS || p.c >= COLS) continue;
      const { c, r } = p, cell = td(c, r);
      if (editing && editing.c === c && editing.r === r) continue;
      const v = values[ref], st = styles[ref];
      const txt = v === undefined ? '' : format(v, st);
      if (cell.textContent !== txt) cell.textContent = txt;
      cell.className = (typeof v === 'number' ? 'num' : '') + (isErr(v) ? ' err' : '');
      const s = cell.style;
      s.fontWeight = st?.b ? '700' : ''; s.fontStyle = st?.i ? 'italic' : ''; s.textDecoration = st?.u ? 'underline' : '';
      s.color = st?.color || ''; s.background = st?.fill || ''; s.textAlign = st?.a || '';
    }
    rendered = now;
    renderSelection();
    updateStats();
    renderCharts();
  }

  function selRect() {
    return { c1: Math.min(anchor.c, cur.c), c2: Math.max(anchor.c, cur.c), r1: Math.min(anchor.r, cur.r), r2: Math.max(anchor.r, cur.r) };
  }
  function eachSel(fn) { const s = selRect(); for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) fn(makeRef(c, r), c, r); }

  function renderSelection() {
    grid.querySelectorAll('td.sel, td.cur').forEach(e => e.classList.remove('sel', 'cur'));
    grid.querySelectorAll('th.hl').forEach(e => e.classList.remove('hl'));
    const s = selRect();
    for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) td(c, r).classList.add('sel');
    td(cur.c, cur.r).classList.add('cur');
    for (let c = s.c1; c <= s.c2; c++) grid.tHead.rows[0].cells[c + 1].classList.add('hl');
    for (let r = s.r1; r <= s.r2; r++) grid.tBodies[0].rows[r].cells[0].classList.add('hl');
    const ref = makeRef(cur.c, cur.r);
    cellName.textContent = s.c1 === s.c2 && s.r1 === s.r2 ? ref : `${makeRef(s.c1, s.r1)}:${makeRef(s.c2, s.r2)}`;
    if (document.activeElement !== fbar) fbar.value = sheet().cells[ref] ?? '';
    const st = sheet().styles[ref] || {};
    document.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('active', !!st[b.dataset.style]));
    document.getElementById('fmt').value = st.f || '';
  }

  function updateStats() {
    const nums = []; let count = 0;
    eachSel(ref => { const v = values[ref]; if (v !== undefined && v !== '') count++; if (typeof v === 'number') nums.push(v); });
    const el = document.getElementById('stats');
    if (!el) return;
    if (count < 2) { el.textContent = ''; return; }
    const sum = nums.reduce((a, b) => a + b, 0);
    el.textContent = nums.length
      ? `Súčet: ${format(sum)} · Priemer: ${format(+(sum / nums.length).toFixed(6))} · Počet: ${count}`
      : `Počet: ${count}`;
  }

  function scrollIntoView(c, r) { td(c, r).scrollIntoView({ block: 'nearest', inline: 'nearest' }); }

  /* ---------- Úpravy ---------- */
  function snapshot() {
    undoStack.push(JSON.stringify({ active, cells: sheet().cells, styles: sheet().styles, charts: sheet().charts }));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }
  function restore(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify({ active, cells: sheet().cells, styles: sheet().styles, charts: sheet().charts }));
    const s = JSON.parse(from.pop());
    if (s.active !== active && doc.content.sheets[s.active]) { active = s.active; renderTabs(); }
    sheet().cells = s.cells; sheet().styles = s.styles; sheet().charts = s.charts || [];
    buildGrid();
    commit(false);
  }
  function commit() {
    for (const ref of Object.keys(sheet().cells)) { const p = parseRef(ref); if (p && (p.r >= ROWS || p.c >= COLS)) { buildGrid(); break; } }
    renderValues(); autosave.schedule();
  }

  function setCell(ref, raw) {
    const cells = sheet().cells;
    if (raw === '' || raw == null) delete cells[ref]; else cells[ref] = raw;
  }

  function startEdit(initial) {
    if (editing) return;
    const { c, r } = cur, cell = td(c, r);
    const input = document.createElement('input');
    input.className = 'cell-edit';
    input.value = initial ?? (sheet().cells[makeRef(c, r)] ?? '');
    cell.textContent = '';
    cell.appendChild(input);
    editing = { c, r, input };
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('input', () => { fbar.value = input.value; });
    input.addEventListener('blur', () => { if (editing && editing.input === input) finishEdit(true); });
  }
  function finishEdit(save) {
    if (!editing) return;
    const { c, r, input } = editing;
    editing = null;
    const ref = makeRef(c, r);
    if (save && (sheet().cells[ref] ?? '') !== input.value) { snapshot(); setCell(ref, input.value); commit(); }
    input.remove();
    renderValues();
  }

  function move(dc, dr, extend) {
    if (cur.r + dr >= ROWS && ROWS < MAX_ROWS) { buildGrid(ROWS + 100); renderValues(); }
    cur = { c: Math.max(0, Math.min(COLS - 1, cur.c + dc)), r: Math.max(0, Math.min(ROWS - 1, cur.r + dr)) };
    if (!extend) anchor = { ...cur };
    renderSelection(); updateStats(); scrollIntoView(cur.c, cur.r);
  }

  /* ---------- Myš ---------- */
  let dragging = false;
  grid.addEventListener('mousedown', e => {
    const cell = e.target.closest('td');
    const colH = e.target.closest('thead th[data-col]');
    const rowH = e.target.closest('tbody th[data-row]');
    if (e.target.classList.contains('cell-edit')) return;
    if (editing) finishEdit(true);
    if (cell) {
      const p = { c: +cell.dataset.c, r: +cell.dataset.r };
      cur = p; if (!e.shiftKey) anchor = { ...p };
      dragging = true;
    } else if (colH) { const c = +colH.dataset.col; anchor = { c, r: 0 }; cur = { c, r: ROWS - 1 }; }
    else if (rowH) { const r = +rowH.dataset.row; anchor = { c: 0, r }; cur = { c: COLS - 1, r }; }
    else return;
    e.preventDefault();
    renderSelection(); updateStats();
  });
  grid.addEventListener('mouseover', e => {
    if (!dragging) return;
    const cell = e.target.closest('td'); if (!cell) return;
    cur = { c: +cell.dataset.c, r: +cell.dataset.r };
    renderSelection(); updateStats();
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  grid.addEventListener('dblclick', e => { if (e.target.closest('td')) startEdit(); });

  /* ---------- Klávesnica ---------- */
  document.addEventListener('keydown', e => {
    if (e.target === fbar || e.target.classList?.contains('title-input')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (editing) {
      if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); move(0, e.shiftKey ? -1 : 1); }
      else if (e.key === 'Tab') { e.preventDefault(); finishEdit(true); move(e.shiftKey ? -1 : 1, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
      return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (ctrl) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); restore(undoStack, redoStack); }
      else if (k === 'y') { e.preventDefault(); restore(redoStack, undoStack); }
      else if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); toggleStyle(k); }
      else if (k === 's') { e.preventDefault(); autosave.saveNow(); }
      else if (k === 'a') { e.preventDefault(); anchor = { c: 0, r: 0 }; cur = { c: COLS - 1, r: ROWS - 1 }; renderSelection(); updateStats(); }
      return;
    }
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(0, -1, e.shiftKey); break;
      case 'ArrowDown': e.preventDefault(); move(0, 1, e.shiftKey); break;
      case 'ArrowLeft': e.preventDefault(); move(-1, 0, e.shiftKey); break;
      case 'ArrowRight': e.preventDefault(); move(1, 0, e.shiftKey); break;
      case 'Tab': e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); break;
      case 'Enter': e.preventDefault(); startEdit(); break;
      case 'F2': e.preventDefault(); startEdit(); break;
      case 'Delete': case 'Backspace': e.preventDefault(); clearSel(); break;
      default:
        if (e.key.length === 1 && !e.altKey) { e.preventDefault(); startEdit(e.key); }
    }
  });

  /* ---------- Schránka ---------- */
  document.addEventListener('copy', e => {
    if (editing || document.activeElement === fbar || document.activeElement?.tagName === 'INPUT') return;
    const s = selRect(), lines = [];
    for (let r = s.r1; r <= s.r2; r++) {
      const row = [];
      for (let c = s.c1; c <= s.c2; c++) { const v = values[makeRef(c, r)]; row.push(v === undefined ? '' : format(v, sheet().styles[makeRef(c, r)])); }
      lines.push(row.join('\t'));
    }
    e.clipboardData.setData('text/plain', lines.join('\n'));
    e.preventDefault();
  });
  document.addEventListener('cut', e => {
    if (editing || document.activeElement?.tagName === 'INPUT') return;
    const s = selRect(), lines = [];
    for (let r = s.r1; r <= s.r2; r++) { const row = []; for (let c = s.c1; c <= s.c2; c++) row.push(sheet().cells[makeRef(c, r)] ?? ''); lines.push(row.join('\t')); }
    e.clipboardData.setData('text/plain', lines.join('\n'));
    e.preventDefault(); clearSel();
  });
  document.addEventListener('paste', e => {
    if (editing || document.activeElement?.tagName === 'INPUT') return;
    const text = e.clipboardData.getData('text/plain'); if (!text) return;
    e.preventDefault();
    snapshot();
    text.replace(/\r/g, '').replace(/\n$/, '').split('\n').forEach((line, dr) =>
      line.split('\t').forEach((val, dc) => {
        const c = cur.c + dc, r = cur.r + dr;
        if (c < MAX_COLS && r < MAX_ROWS) setCell(makeRef(c, r), val);
      }));
    commit();
  });

  /* ---------- Panel nástrojov ---------- */
  function clearSel() { snapshot(); eachSel(ref => setCell(ref, '')); commit(); }
  function setStyle(fn) {
    snapshot();
    const styles = sheet().styles;
    eachSel(ref => { const s = styles[ref] || {}; fn(s); Object.keys(s).forEach(k => { if (s[k] === '' || s[k] == null || s[k] === 0) delete s[k]; }); if (Object.keys(s).length) styles[ref] = s; else delete styles[ref]; });
    commit();
  }
  function toggleStyle(k) {
    const on = !(sheet().styles[makeRef(cur.c, cur.r)] || {})[k];
    setStyle(s => { s[k] = on ? 1 : 0; });
  }
  document.querySelectorAll('[data-style]').forEach(b => b.onclick = () => toggleStyle(b.dataset.style));
  document.querySelectorAll('[data-align]').forEach(b => b.onclick = () => setStyle(s => { s.a = b.dataset.align; }));
  document.getElementById('color').onchange = e => setStyle(s => { s.color = e.target.value === '#000000' ? '' : e.target.value; });
  document.getElementById('fill').onchange = e => setStyle(s => { s.fill = e.target.value === '#ffffff' ? '' : e.target.value; });
  document.getElementById('fmt').onchange = e => setStyle(s => { s.f = e.target.value; });
  document.getElementById('undo').onclick = () => restore(undoStack, redoStack);
  document.getElementById('redo').onclick = () => restore(redoStack, undoStack);
  document.getElementById('clear').onclick = clearSel;

  document.getElementById('sum').onclick = () => {
    // Súčet čísel nad aktuálnou bunkou
    const c = cur.c; let r = cur.r - 1;
    while (r >= 0 && typeof values[makeRef(c, r)] !== 'number') r--;
    const end = r; while (r >= 0 && typeof values[makeRef(c, r)] === 'number') r--;
    if (end < 0) { startEdit('=SUM()'); return; }
    snapshot(); setCell(makeRef(c, cur.r), `=SUM(${makeRef(c, r + 1)}:${makeRef(c, end)})`); commit();
  };

  function sortCol(dir) {
    const s = selRect();
    let r1 = s.r1, r2 = s.r2;
    if (r1 === r2) { // celý stĺpec s dátami, prvý riadok sa berie ako hlavička
      r1 = 1; r2 = 0;
      for (const ref of Object.keys(sheet().cells)) { const p = parseRef(ref); if (p) r2 = Math.max(r2, p.r); }
    }
    if (r2 <= r1) return;
    snapshot();
    const cells = sheet().cells, styles = sheet().styles, rows = [];
    for (let r = r1; r <= r2; r++) {
      const row = { key: values[makeRef(cur.c, r)], cells: [], styles: [] };
      for (let c = 0; c < COLS; c++) { row.cells.push(cells[makeRef(c, r)]); row.styles.push(styles[makeRef(c, r)]); }
      rows.push(row);
    }
    rows.sort((a, b) => {
      const x = a.key ?? '', y = b.key ?? '';
      if (x === '' && y !== '') return 1; if (y === '' && x !== '') return -1;
      const res = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'sk');
      return res * dir;
    });
    rows.forEach((row, i) => row.cells.forEach((v, c) => {
      const ref = makeRef(c, r1 + i);
      if (v == null) delete cells[ref]; else cells[ref] = v;
      if (row.styles[c]) styles[ref] = row.styles[c]; else delete styles[ref];
    }));
    commit();
  }
  document.getElementById('sortAsc').onclick = () => sortCol(1);
  document.getElementById('sortDesc').onclick = () => sortCol(-1);

  document.getElementById('help').onclick = () => alert(
    'Vzorce začínajú znakom =, napr. =A1+B1 alebo =SUM(A1:A10)\n\n' +
    'Operátory: + - * / ^ & = <> < > <= >= %\n\nDostupné funkcie:\n' + Formula.functions.join(', '));

  /* ---------- Riadok vzorcov ---------- */
  fbar.addEventListener('focus', () => { if (editing) finishEdit(true); });
  fbar.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const ref = makeRef(cur.c, cur.r);
      if ((sheet().cells[ref] ?? '') !== fbar.value) { snapshot(); setCell(ref, fbar.value); commit(); }
      fbar.blur(); move(0, 1);
    } else if (e.key === 'Escape') { fbar.value = sheet().cells[makeRef(cur.c, cur.r)] ?? ''; fbar.blur(); }
  });

  /* ---------- Hárky ---------- */
  function renderTabs() {
    tabsEl.innerHTML = doc.content.sheets.map((s, i) =>
      `<button data-tab="${i}" class="${i === active ? 'active' : ''}" title="Dvojklik = premenovať">${escapeHtml(s.name)}</button>`).join('') +
      '<button id="addSheet" title="Pridať hárok">+</button>' +
      (doc.content.sheets.length > 1 ? '<button id="delSheet" title="Odstrániť aktuálny hárok">−</button>' : '') +
      '<span class="stats" id="stats"></span>';
  }
  function switchSheet(i) {
    if (editing) finishEdit(true);
    active = i; anchor = { c: 0, r: 0 }; cur = { c: 0, r: 0 }; undoStack = []; redoStack = [];
    buildGrid(); renderTabs(); renderValues();
  }
  tabsEl.addEventListener('click', e => {
    if (e.target.dataset.tab !== undefined) switchSheet(+e.target.dataset.tab);
    else if (e.target.id === 'addSheet') {
      let n = doc.content.sheets.length + 1;
      while (doc.content.sheets.some(s => s.name === 'Hárok' + n)) n++;
      doc.content.sheets.push({ name: 'Hárok' + n, cells: {}, styles: {}, charts: [] });
      switchSheet(doc.content.sheets.length - 1); autosave.schedule();
    } else if (e.target.id === 'delSheet') {
      if (!confirm(`Odstrániť hárok „${sheet().name}“?`)) return;
      doc.content.sheets.splice(active, 1); switchSheet(Math.max(0, active - 1)); autosave.schedule();
    }
  });
  tabsEl.addEventListener('dblclick', e => {
    if (e.target.dataset.tab === undefined) return;
    const s = doc.content.sheets[+e.target.dataset.tab];
    const name = prompt('Nový názov hárka:', s.name);
    if (name && name.trim()) { s.name = name.trim().slice(0, 40); renderTabs(); renderValues(); autosave.schedule(); }
  });

  /* ---------- Grafy ---------- */
  const gridWrap = document.getElementById('gridWrap');
  function renderCharts() {
    gridWrap.querySelectorAll('.chart-box').forEach(e => e.remove());
    sheet().charts.forEach((ch, i) => {
      const box = document.createElement('div');
      box.className = 'chart-box';
      box.style.left = (ch.x ?? 60) + 'px'; box.style.top = (ch.y ?? 40) + 'px';
      box.innerHTML = `<div class="ch-head"><strong>${escapeHtml(ch.title || Charts.TYPES[ch.type])}</strong>
        <button data-act="edit" title="Upraviť graf">✎</button><button data-act="png" title="Stiahnuť ako obrázok PNG">⤓</button><button data-act="del" title="Odstrániť graf">✕</button></div><div class="ch-body"></div>`;
      const { svg, marks } = Charts.render(ch, values);
      box.querySelector('.ch-body').innerHTML = svg;
      Charts.attachHover(box.querySelector('.ch-body'), marks);
      box.querySelector('[data-act=edit]').onclick = () => chartDialog(i);
      box.querySelector('[data-act=del]').onclick = () => { if (confirm('Odstrániť graf?')) { snapshot(); sheet().charts.splice(i, 1); commit(); } };
      box.querySelector('[data-act=png]').onclick = async () => download(safeName(ch.title || 'graf') + '.png', await Charts.toPng(svg, ch.title));
      const head = box.querySelector('.ch-head');
      head.addEventListener('mousedown', e => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY, ox = ch.x ?? 60, oy = ch.y ?? 40;
        const mv = ev => { ch.x = Math.max(0, ox + ev.clientX - sx); ch.y = Math.max(0, oy + ev.clientY - sy); box.style.left = ch.x + 'px'; box.style.top = ch.y + 'px'; };
        const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); autosave.schedule(); };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      });
      gridWrap.appendChild(box);
    });
  }
  function chartDialog(index) {
    const s = selRect();
    const existing = index !== undefined ? sheet().charts[index] : null;
    const range = existing ? existing.range : (s.c1 === s.c2 && s.r1 === s.r2 ? guessRange() : `${makeRef(s.c1, s.r1)}:${makeRef(s.c2, s.r2)}`);
    const d = DriveUI.dialog(existing ? 'Upraviť graf' : 'Vložiť graf', `
      <p>Prvý stĺpec s textom sa použije ako kategórie (os X), prvý riadok s textom ako názvy radov. Každý ďalší stĺpec je jeden rad (max. 8).</p>
      <label for="chType">Typ grafu</label>
      <select id="chType">${Object.entries(Charts.TYPES).map(([k, v]) => `<option value="${k}" ${existing?.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <label for="chRange">Rozsah údajov</label>
      <input type="text" id="chRange" value="${escapeHtml(range)}" placeholder="napr. A1:C6">
      <label for="chTitle">Nadpis</label>
      <input type="text" id="chTitle" value="${escapeHtml(existing?.title ?? '')}" placeholder="Nadpis grafu">
    `, [
      { label: 'Zrušiť', onClick: dlg => dlg.close() },
      { label: existing ? 'Uložiť' : 'Vložiť', primary: true, onClick: dlg => {
        const type = dlg.querySelector('#chType').value, rng = dlg.querySelector('#chRange').value.trim().toUpperCase().replace(/\$/g, '');
        if (!/^[A-Z]+\d+(:[A-Z]+\d+)?$/.test(rng)) { alert('Zadajte rozsah v tvare A1:C6'); return; }
        const title = dlg.querySelector('#chTitle').value.trim();
        snapshot();
        if (existing) Object.assign(existing, { type, range: rng, title });
        else {
          const [, b] = rng.split(':'); const p = parseRef(b || rng), a = parseRef(rng.split(':')[0]);
          let maxC = p.c;
          for (const ref of Object.keys(sheet().cells)) { const q = parseRef(ref); if (q) maxC = Math.max(maxC, q.c); }
          const anchorTd = td(Math.min(COLS - 1, maxC + 1), Math.min(a.r, p.r));
          sheet().charts.push({ id: Date.now().toString(36), type, range: rng, title, x: anchorTd.offsetLeft + 12, y: anchorTd.offsetTop });
        }
        dlg.close(); commit();
      } }
    ]);
    d.querySelector('#chTitle').focus();
  }
  // Ak je vybraná jedna bunka, nájdeme súvislú oblasť dát okolo nej
  function guessRange() {
    const has = (c, r) => sheet().cells[makeRef(c, r)] !== undefined;
    let c1 = cur.c, c2 = cur.c, r1 = cur.r, r2 = cur.r, grown = true;
    while (grown) {
      grown = false;
      if (c1 > 0 && [...Array(r2 - r1 + 1)].some((_, k) => has(c1 - 1, r1 + k))) { c1--; grown = true; }
      if (c2 < COLS - 1 && [...Array(r2 - r1 + 1)].some((_, k) => has(c2 + 1, r1 + k))) { c2++; grown = true; }
      if (r1 > 0 && [...Array(c2 - c1 + 1)].some((_, k) => has(c1 + k, r1 - 1))) { r1--; grown = true; }
      if (r2 < ROWS - 1 && [...Array(c2 - c1 + 1)].some((_, k) => has(c1 + k, r2 + 1))) { r2++; grown = true; }
    }
    return `${makeRef(c1, r1)}:${makeRef(c2, r2)}`;
  }
  document.getElementById('chart').onclick = () => chartDialog();

  /* ---------- Súbory ---------- */
  document.getElementById('open').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const nd = await importFile(f, f.name); location.href = PAGE_FOR[nd.type] + '?id=' + nd.id; }
    catch (err) { alert(err.message); }
  };

  function csvText() {
    let mr = -1, mc = -1;
    for (const ref of Object.keys(sheet().cells)) { const p = parseRef(ref); if (p) { mr = Math.max(mr, p.r); mc = Math.max(mc, p.c); } }
    const lines = [];
    for (let r = 0; r <= mr; r++) {
      const row = [];
      for (let c = 0; c <= mc; c++) {
        let val = values[makeRef(c, r)];
        val = val === undefined ? '' : typeof val === 'number' ? String(val).replace('.', ',') : String(val);
        row.push(/[;"\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val);
      }
      lines.push(row.join(';'));
    }
    return '﻿' + lines.join('\r\n');
  }
  const chartNote = () => { if (doc.content.sheets.some(s => s.charts.length)) toast('Pozn.: grafy sa do .xlsx neprenášajú – stiahnite si ich cez ⤓ ako obrázok.', 6000); };
  const makeXlsx = async () => ({ blob: await XlsxIO.write(doc.content, 'xlsx'), name: safeName(doc.title) + '.xlsx', mimeType: MIME.xlsx });

  document.getElementById('export').onchange = async e => {
    const v = e.target.value; e.target.value = '';
    const name = safeName(doc.title);
    try {
      if (v === 'csv') download(name + '.csv', csvText(), 'text/csv;charset=utf-8');
      else if (v === 'xlsx') { download(name + '.xlsx', (await makeXlsx()).blob); chartNote(); }
      else if (v === 'ods') { download(name + '.ods', await XlsxIO.write(doc.content, 'ods')); chartNote(); }
      else if (v === 'pdf') window.print();
    } catch (err) { alert('Export zlyhal: ' + err.message); }
  };

  DriveUI.menu(document.getElementById('driveSlot'), doc, {
    statusEl: document.getElementById('status'),
    saves: [{ label: 'Uložiť na Drive (.xlsx)', make: async () => { chartNote(); return makeXlsx(); } }]
  });

  document.getElementById('new').onclick = () => { autosave.saveNow(); location.href = 'sheet.html'; };

  buildGrid();
  renderTabs();
  renderValues();
})();
