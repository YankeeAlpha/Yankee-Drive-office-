/* Yankee Tabuľky – import/export .xlsx, .xls, .ods, .csv (knižnica SheetJS / xlsx-js-style) */
const XlsxIO = (() => {
  const MAX_ROWS = 5000, MAX_COLS = 104; // limit importu (A..CZ)
  const ensure = () => window.XLSX ? Promise.resolve() : loadScript('vendor/xlsx.bundle.js');

  function parseCSV(text) {
    const first = text.split('\n')[0];
    const delim = first.includes('\t') ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function fmtFromZ(z) {
    if (!z || z === 'General') return '';
    if (/%/.test(z)) return 'pct';
    if (/€|EUR/i.test(z)) return 'eur';
    if (/0[.,]00/.test(z)) return 'n2';
    return '';
  }
  const rgb = c => c && c.rgb && /^[0-9A-F]{6,8}$/i.test(c.rgb) ? '#' + c.rgb.slice(-6).toLowerCase() : '';

  async function read(blob, ext) {
    if (ext === 'csv' || ext === 'tsv') {
      const cells = {};
      parseCSV((await blob.text()).replace(/^﻿/, '')).forEach((row, r) => row.forEach((v, c) => {
        if (v !== '' && r < MAX_ROWS && c < MAX_COLS) cells[Formula.makeRef(c, r)] = v;
      }));
      return { sheets: [{ name: 'Hárok1', cells, styles: {}, charts: [] }] };
    }
    await ensure();
    const buf = await blob.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellStyles: true, cellNF: true });
    const fonts = await readFontStyles(buf).catch(() => ({}));
    const sheets = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name], cells = {}, styles = {};
      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let r = range.s.r; r <= Math.min(range.e.r, MAX_ROWS - 1); r++) {
          for (let c = range.s.c; c <= Math.min(range.e.c, MAX_COLS - 1); c++) {
            const addr = XLSX.utils.encode_cell({ r, c }), cell = ws[addr];
            if (!cell) continue;
            const ref = Formula.makeRef(c, r);
            let raw;
            if (cell.f) raw = '=' + cell.f;
            else if (cell.t === 'n') raw = String(cell.v);
            else if (cell.t === 'b') raw = cell.v ? 'TRUE' : 'FALSE';
            else if (cell.t === 'd' || cell.t === 'e') raw = cell.w || String(cell.v);
            else if (cell.t === 's') raw = cell.v;
            if (raw !== undefined && raw !== '') cells[ref] = raw;
            const st = {};
            const f = fmtFromZ(cell.z); if (f) st.f = f;
            const s = cell.s || {};
            if (s.patternType === 'solid' && rgb(s.fgColor) && rgb(s.fgColor) !== '#ffffff') st.fill = rgb(s.fgColor);
            if (s.font) { if (s.font.bold) st.b = 1; if (s.font.italic) st.i = 1; if (s.font.underline) st.u = 1; if (rgb(s.font.color) && rgb(s.font.color) !== '#000000') st.color = rgb(s.font.color); }
            if (s.alignment && ['left', 'center', 'right'].includes(s.alignment.horizontal)) st.a = s.alignment.horizontal;
            Object.assign(st, (fonts[name] || {})[addr]);
            if (Object.keys(st).length) styles[ref] = st;
          }
        }
      }
      return { name: name.slice(0, 40), cells, styles, charts: [] };
    });
    return { sheets: sheets.length ? sheets : [{ name: 'Hárok1', cells: {}, styles: {}, charts: [] }] };
  }

  /* Písmo (tučné, kurzíva, podčiarknutie, farba) a zarovnanie priamo z XML súboru .xlsx */
  async function readFontStyles(buf) {
    if (!window.JSZip) await loadScript('vendor/jszip.min.js');
    const zip = await JSZip.loadAsync(buf);
    const xml = async path => { const f = zip.file(path); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
    const stylesDoc = await xml('xl/styles.xml'), wbDoc = await xml('xl/workbook.xml'), relDoc = await xml('xl/_rels/workbook.xml.rels');
    if (!stylesDoc || !wbDoc || !relDoc) return {};
    const kids = (el, tag) => el ? [...el.children].filter(c => c.localName === tag) : [];
    const first = (el, tag) => kids(el, tag)[0];
    const fontsEl = stylesDoc.getElementsByTagNameNS('*', 'fonts')[0];
    const fontList = kids(fontsEl, 'font').map(f => {
      const st = {};
      const on = tag => { const e = first(f, tag); return e && e.getAttribute('val') !== '0' && e.getAttribute('val') !== 'false' && e.getAttribute('val') !== 'none'; };
      if (on('b')) st.b = 1; if (on('i')) st.i = 1; if (on('u')) st.u = 1;
      const col = first(f, 'color')?.getAttribute('rgb');
      if (col && /^[0-9A-F]{6,8}$/i.test(col) && !/000000$/i.test(col)) st.color = '#' + col.slice(-6).toLowerCase();
      return st;
    });
    const xfs = kids(stylesDoc.getElementsByTagNameNS('*', 'cellXfs')[0], 'xf').map(xf => {
      const st = { ...(fontList[+xf.getAttribute('fontId') || 0] || {}) };
      const h = first(xf, 'alignment')?.getAttribute('horizontal');
      if (['left', 'center', 'right'].includes(h)) st.a = h;
      return st;
    });
    const rels = {};
    [...relDoc.getElementsByTagNameNS('*', 'Relationship')].forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const out = {};
    for (const sh of wbDoc.getElementsByTagNameNS('*', 'sheet')) {
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let target = rels[rid]; if (!target) continue;
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const f = zip.file(target); if (!f) continue;
      const text = await f.async('string'), map = {};
      for (const m of text.matchAll(/<c\b([^>]*)>|<c\b([^>]*)\/>/g)) {
        const attrs = m[1] || m[2] || '';
        const r = /\br="([A-Z]+\d+)"/.exec(attrs), si = /\bs="(\d+)"/.exec(attrs);
        if (r && si && xfs[+si[1]] && Object.keys(xfs[+si[1]]).length) map[r[1]] = xfs[+si[1]];
      }
      out[sh.getAttribute('name')] = map;
    }
    return out;
  }

  const Z = { n2: '#,##0.00', eur: '#,##0.00 "€"', pct: '0.00%' };

  async function write(content, bookType = 'xlsx') {
    await ensure();
    const values = Formula.computeWorkbook(content.sheets);
    const wb = XLSX.utils.book_new();
    const used = new Set();
    content.sheets.forEach((sheet, si) => {
      const ws = {};
      let mr = 0, mc = 0;
      const refs = new Set([...Object.keys(sheet.cells), ...Object.keys(sheet.styles || {})]);
      for (const ref of refs) {
        const p = Formula.parseRef(ref); if (!p) continue;
        mr = Math.max(mr, p.r); mc = Math.max(mc, p.c);
        const raw = sheet.cells[ref], v = values[si][ref], st = (sheet.styles || {})[ref] || {};
        const cell = {};
        if (raw === undefined) cell.t = 'z';
        else if (Formula.isErr(v)) { cell.t = 'e'; cell.v = 15; cell.w = String(v); }
        else if (typeof v === 'number') { cell.t = 'n'; cell.v = v; }
        else if (typeof v === 'boolean') { cell.t = 'b'; cell.v = v; }
        else { cell.t = 's'; cell.v = String(v ?? ''); }
        if (typeof raw === 'string' && raw[0] === '=') cell.f = Formula.toExcel(raw.slice(1));
        if (st.f && Z[st.f]) cell.z = Z[st.f];
        const s = {};
        const font = {};
        if (st.b) font.bold = true; if (st.i) font.italic = true; if (st.u) font.underline = true;
        if (st.color) font.color = { rgb: st.color.slice(1).toUpperCase() };
        if (Object.keys(font).length) s.font = font;
        if (st.fill) s.fill = { patternType: 'solid', fgColor: { rgb: st.fill.slice(1).toUpperCase() } };
        if (st.a) s.alignment = { horizontal: st.a };
        if (cell.z) s.numFmt = cell.z;
        if (Object.keys(s).length) cell.s = s;
        ws[XLSX.utils.encode_cell({ r: p.r, c: p.c })] = cell;
      }
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: mr, c: mc } });
      ws['!cols'] = Array.from({ length: mc + 1 }, () => ({ wch: 14 }));
      let name = (sheet.name || 'Hárok' + (si + 1)).replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
      while (used.has(name.toLowerCase())) name = name.slice(0, 28) + '_' + si;
      used.add(name.toLowerCase());
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const out = XLSX.write(wb, { type: 'array', bookType, compression: true });
    const mime = bookType === 'ods' ? 'application/vnd.oasis.opendocument.spreadsheet' : MIME.xlsx;
    return new Blob([out], { type: mime });
  }

  return { read, write, parseCSV };
})();
