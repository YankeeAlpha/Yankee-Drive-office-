/* Yankee Text – export HTML -> .docx (Office Open XML) a import .docx -> HTML
   Export: vlastný generátor nad JSZip. Import: mammoth.js. */
const Docx = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SIZE_KEYWORDS = { 'xx-small': 7, 'x-small': 8, small: 10, medium: 12, large: 14, 'x-large': 18, 'xx-large': 24, 'xxx-large': 36 };
  const FONT_TAG_SIZE = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 };
  const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER']);
  const isBlock = el => BLOCK.has(el.tagName);

  function toHex(c) {
    if (!c) return null;
    c = c.trim().toLowerCase();
    if (c === 'transparent' || c === 'inherit' || c === 'initial') return null;
    let m = /^#([0-9a-f]{3})$/.exec(c);
    if (m) return m[1].split('').map(x => x + x).join('').toUpperCase();
    m = /^#([0-9a-f]{6})$/.exec(c);
    if (m) return m[1].toUpperCase();
    m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(c);
    if (m) {
      if (m[4] !== undefined && +m[4] === 0) return null;
      return [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    const named = { black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '008000', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500' };
    return named[c] || null;
  }
  function sizePt(v) {
    if (!v) return null;
    v = v.trim();
    if (SIZE_KEYWORDS[v]) return SIZE_KEYWORDS[v];
    let m = /^([\d.]+)pt$/.exec(v); if (m) return +m[1];
    m = /^([\d.]+)px$/.exec(v); if (m) return Math.round(+m[1] * 0.75);
    m = /^([\d.]+)em$/.exec(v); if (m) return Math.round(+m[1] * 11);
    return null;
  }

  /* ---------- Export ---------- */
  async function fromHtml(html, title) {
    if (!window.JSZip) await loadScript('vendor/jszip.min.js');
    const zip = new JSZip();
    const rels = []; // {id, type, target, external}
    const media = [];
    const numberings = []; // {abs: 0|1}
    let relSeq = 1, imgSeq = 1, docPrId = 1;
    const addRel = (type, target, external) => { const id = 'rId' + (100 + relSeq++); rels.push({ id, type, target, external }); return id; };

    const root = document.createElement('div');
    root.innerHTML = html;
    // obrázky potrebujú rozmery – vložíme dočasne do DOM
    root.style.cssText = 'position:absolute;left:-99999px;top:0;width:640px;visibility:hidden';
    document.body.appendChild(root);
    await Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));

    const body = [];
    try {
      blocks(root, { indent: 0 }, body);
    } finally { root.remove(); }

    function runProps(st) {
      let p = '';
      if (st.font) p += `<w:rFonts w:ascii="${esc(st.font)}" w:hAnsi="${esc(st.font)}" w:cs="${esc(st.font)}"/>`;
      if (st.b) p += '<w:b/>';
      if (st.i) p += '<w:i/>';
      if (st.s) p += '<w:strike/>';
      if (st.color) p += `<w:color w:val="${st.color}"/>`;
      if (st.size) p += `<w:sz w:val="${Math.round(st.size * 2)}"/><w:szCs w:val="${Math.round(st.size * 2)}"/>`;
      if (st.u) p += '<w:u w:val="single"/>';
      if (st.bg) p += `<w:shd w:val="clear" w:color="auto" w:fill="${st.bg}"/>`;
      if (st.mono) p += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>';
      if (st.sup) p += '<w:vertAlign w:val="superscript"/>';
      if (st.sub) p += '<w:vertAlign w:val="subscript"/>';
      return p ? `<w:rPr>${p}</w:rPr>` : '';
    }
    function textRun(text, st) {
      return `<w:r>${runProps(st)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
    }
    function styleFrom(el, st) {
      const n = { ...st };
      const tag = el.tagName;
      if (tag === 'B' || tag === 'STRONG') n.b = true;
      if (tag === 'I' || tag === 'EM') n.i = true;
      if (tag === 'U' || tag === 'INS') n.u = true;
      if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') n.s = true;
      if (tag === 'SUP') n.sup = true;
      if (tag === 'SUB') n.sub = true;
      if (tag === 'CODE') n.mono = true;
      if (tag === 'FONT') {
        if (el.getAttribute('color')) n.color = toHex(el.getAttribute('color')) || n.color;
        if (el.getAttribute('size')) n.size = FONT_TAG_SIZE[el.getAttribute('size')] || n.size;
        if (el.getAttribute('face')) n.font = el.getAttribute('face').split(',')[0].replace(/['"]/g, '').trim();
      }
      const s = el.style;
      if (s) {
        if (s.fontWeight === 'bold' || +s.fontWeight >= 600) n.b = true;
        if (s.fontWeight === 'normal' || s.fontWeight === '400') n.b = false;
        if (s.fontStyle === 'italic') n.i = true;
        const td = s.textDecorationLine || s.textDecoration || '';
        if (td.includes('underline')) n.u = true;
        if (td.includes('line-through')) n.s = true;
        if (s.color) n.color = toHex(s.color) || n.color;
        if (s.backgroundColor) n.bg = toHex(s.backgroundColor) || n.bg;
        if (s.fontSize) n.size = sizePt(s.fontSize) || n.size;
        if (s.fontFamily) n.font = s.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      }
      return n;
    }
    function imageRun(img) {
      const src = img.getAttribute('src') || '';
      const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(src);
      if (!m) return '';
      const ext = m[1].toLowerCase().replace('jpg', 'jpeg');
      const name = `image${imgSeq++}.${ext === 'jpeg' ? 'jpg' : ext}`;
      media.push({ name, data: m[2] });
      const rid = addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'media/' + name);
      let w = img.naturalWidth || img.width || 300, h = img.naturalHeight || img.height || 200;
      const maxW = 6 * 96; // 6 palcov pri 96 dpi
      const styleW = parseFloat(img.style.width) || parseFloat(img.getAttribute('width'));
      if (styleW && styleW < w) { h = h * styleW / w; w = styleW; }
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      const cx = Math.round(w * 9525), cy = Math.round(h * 9525), id = docPrId++;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Obrázok ${id}"/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }
    function inlines(node, st) {
      let out = '';
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) {
          const t = ch.nodeValue.replace(/[\r\n\t]+/g, ' ');
          if (t) out += textRun(t, st);
        } else if (ch.nodeType === 1) {
          const tag = ch.tagName;
          if (tag === 'BR') out += '<w:r><w:br/></w:r>';
          else if (tag === 'IMG') out += imageRun(ch);
          else if (tag === 'A' && ch.getAttribute('href')) {
            const rid = addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', ch.getAttribute('href'), true);
            out += `<w:hyperlink r:id="${rid}">${inlines(ch, { ...styleFrom(ch, st), color: '0563C1', u: true })}</w:hyperlink>`;
          } else if (!isBlock(ch)) out += inlines(ch, styleFrom(ch, st));
          else out += inlines(ch, styleFrom(ch, st)); // blok vnútri inline kontextu
        }
      }
      return out;
    }

    function paraProps(el, ctx, extra = '') {
      let p = '';
      const tag = el && el.tagName;
      if (/^H[1-6]$/.test(tag)) p += `<w:pStyle w:val="Heading${Math.min(+tag[1], 3)}"/>`;
      if (ctx.list) p += `<w:numPr><w:ilvl w:val="${ctx.list.level}"/><w:numId w:val="${ctx.list.numId}"/></w:numPr>`;
      if (ctx.pre) p += '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>';
      if (ctx.indent && !ctx.list) p += `<w:ind w:left="${ctx.indent * 720}"/>`;
      if (ctx.quote) p += '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BBBBCC"/></w:pBdr>';
      const align = (el && el.style && el.style.textAlign) || (el && el.getAttribute && el.getAttribute('align')) || ctx.align;
      const jc = { left: 'left', center: 'center', right: 'right', justify: 'both' }[align];
      if (jc) p += `<w:jc w:val="${jc}"/>`;
      p += extra;
      return p ? `<w:pPr>${p}</w:pPr>` : '';
    }
    function para(el, ctx, runs) {
      return `<w:p>${paraProps(el, ctx)}${runs}</w:p>`;
    }

    function blocks(container, ctx, out, st = {}) {
      let pending = null; // inline obsah mimo blokov
      const flush = () => {
        if (pending) { out.push(para(null, ctx, pending)); pending = null; }
      };
      for (const ch of container.childNodes) {
        if (ch.nodeType === 3) {
          if (ch.nodeValue.trim()) pending = (pending || '') + textRun(ch.nodeValue.replace(/\s+/g, ' '), st);
          continue;
        }
        if (ch.nodeType !== 1) continue;
        if (!isBlock(ch)) {
          if (ch.tagName === 'BR') { if (pending !== null) { flush(); } else out.push('<w:p/>'); continue; }
          pending = (pending || '') + (ch.tagName === 'IMG' ? imageRun(ch) : ch.tagName === 'A' ? inlines({ childNodes: [ch] }, st) : inlines(ch, styleFrom(ch, st)));
          continue;
        }
        flush();
        const tag = ch.tagName;
        const cst = styleFrom(ch, st);
        const alignCtx = { ...ctx, align: ch.style.textAlign || ctx.align };
        if (tag === 'HR') out.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>');
        else if (tag === 'UL' || tag === 'OL') {
          const level = ctx.list ? Math.min(ctx.list.level + 1, 8) : 0;
          let numId;
          if (ctx.list && ctx.list.ordered === (tag === 'OL')) numId = ctx.list.numId;
          else { numberings.push({ abs: tag === 'OL' ? 1 : 0 }); numId = numberings.length; }
          for (const li of ch.children) {
            if (li.tagName !== 'LI') { blocks({ childNodes: [li] }, ctx, out, cst); continue; }
            listItem(li, { ...alignCtx, list: { level, numId, ordered: tag === 'OL' } }, out, cst);
          }
        } else if (tag === 'TABLE') out.push(table(ch, ctx, cst));
        else if (tag === 'BLOCKQUOTE') {
          const ml = parseFloat(ch.style.marginLeft) || 0;
          const quote = !ml; // execCommand indent vytvára blockquote s margin-left
          blocks(ch, { ...alignCtx, indent: ctx.indent + 1, quote: quote || ctx.quote }, out, cst);
        } else if (tag === 'PRE') {
          ch.textContent.split('\n').forEach(line => out.push(para(null, { ...ctx, pre: true }, textRun(line, { ...cst, mono: true }))));
        } else if (tag === 'LI') listItem(ch, ctx, out, cst);
        else if (/^H[1-6]$/.test(tag) || tag === 'P') {
          const nested = [...ch.children].some(isBlock);
          if (nested) blocks(ch, alignCtx, out, cst);
          else { const r = inlines(ch, cst); out.push(para(ch, alignCtx, r)); }
        } else {
          // DIV a pod.
          const ml = parseFloat(ch.style.marginLeft) || parseFloat(ch.style.paddingLeft) || 0;
          const c2 = ml >= 30 ? { ...alignCtx, indent: ctx.indent + Math.round(ml / 40) } : alignCtx;
          if ([...ch.childNodes].some(n => n.nodeType === 1 && isBlock(n))) blocks(ch, c2, out, cst);
          else out.push(para(ch, c2, inlines(ch, cst)));
        }
      }
      flush();
    }
    function listItem(li, ctx, out, st) {
      // inline obsah položky = jeden odsek, vnorené zoznamy pokračujú
      let runs = '';
      const after = [];
      for (const n of li.childNodes) {
        if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) after.push(n);
        else if (n.nodeType === 1 && isBlock(n)) runs += inlines(n, styleFrom(n, st));
        else if (n.nodeType === 3) runs += n.nodeValue.trim() ? textRun(n.nodeValue.replace(/\s+/g, ' '), st) : '';
        else if (n.nodeType === 1) runs += n.tagName === 'BR' ? '<w:r><w:br/></w:r>' : n.tagName === 'IMG' ? imageRun(n) : inlines({ childNodes: [n] }, st);
      }
      out.push(para(li, ctx, runs));
      for (const l of after) blocks({ childNodes: [l] }, ctx, out, st);
    }
    function table(tbl, ctx, st) {
      const rows = [...tbl.rows];
      const cols = Math.max(1, ...rows.map(r => [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0)));
      const total = 9360; // šírka textu v twipoch (A4 s okrajmi ~ 6.5")
      const cw = Math.floor(total / cols);
      let x = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${total}" w:type="dxa"/>` +
        '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('') + '</w:tblBorders>' +
        '<w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' +
        Array(cols).fill(`<w:gridCol w:w="${cw}"/>`).join('') + '</w:tblGrid>';
      for (const r of rows) {
        x += '<w:tr>';
        for (const c of r.cells) {
          const span = c.colSpan || 1;
          const cst = styleFrom(c, c.tagName === 'TH' ? { ...st, b: true } : st);
          const inner = [];
          blocks(c, { indent: 0, align: c.style.textAlign || '' }, inner, cst);
          const bg = toHex(c.style.backgroundColor);
          x += `<w:tc><w:tcPr><w:tcW w:w="${cw * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : ''}</w:tcPr>` +
            (inner.length ? inner.join('') : '<w:p/>') + '</w:tc>';
        }
        x += '</w:tr>';
      }
      return x + '</w:tbl><w:p/>';
    }

    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join('') || '<w:p/>'}` +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';

    const heading = (n, sz, color) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="sk-SK"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      heading(1, 40, '1F3864') + heading(2, 32, '2F5496') + heading(3, 26, '2F5496') +
      '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="auto"/><w:left w:val="single" w:sz="4" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:color="auto"/><w:right w:val="single" w:sz="4" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:color="auto"/></w:tblBorders></w:tblPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style></w:styles>';

    const bullets = ['•', '◦', '▪'];
    const lvls = abs => Array.from({ length: 9 }, (_, i) =>
      `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${abs ? ['decimal', 'lowerLetter', 'lowerRoman'][i % 3] : 'bullet'}"/>` +
      `<w:lvlText w:val="${abs ? `%${i + 1}.` : bullets[i % 3]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr>` +
      (abs ? '' : '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>') + '</w:lvl>').join('');
    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvls(0)}</w:abstractNum>` +
      `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvls(1)}</w:abstractNum>` +
      numberings.map((n, i) => `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${n.abs}"/>${n.abs ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : ''}</w:num>`).join('') +
      '</w:numbering>';

    const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      rels.map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${esc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('') + '</Relationships>';

    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${esc(title || '')}</dc:title><dc:creator>Yankee Office</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Yankee Office</Application></Properties>');
    zip.file('word/document.xml', documentXml);
    zip.file('word/styles.xml', stylesXml);
    zip.file('word/numbering.xml', numberingXml);
    zip.file('word/_rels/document.xml.rels', docRels);
    media.forEach(m => zip.file('word/media/' + m.name, m.data, { base64: true }));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------- Import ---------- */
  async function toHtml(arrayBuffer) {
    if (!window.mammoth) await loadScript('vendor/mammoth.browser.min.js');
    const res = await mammoth.convertToHtml({ arrayBuffer }, {
      styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh", "u => u", "strike => s"]
    });
    return res.value;
  }

  return { fromHtml, toHtml };
})();
