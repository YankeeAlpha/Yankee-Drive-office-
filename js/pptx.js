/* Yankee Prezentácie – export do PowerPointu (.pptx) cez PptxGenJS */
const PptxExport = (() => {
  const THEMES = {
    'theme-light': { bg: 'FFFFFF', text: '222222', title: 'D9622B' },
    'theme-blue': { bg: '24488A', text: 'FFFFFF', title: 'FFFFFF' },
    'theme-dark': { bg: '1B1F27', text: 'F1F1F1', title: 'F1F1F1' },
    'theme-green': { bg: 'D8EFDA', text: '1B4D2B', title: '1B4D2B' },
    'theme-orange': { bg: 'FD7D5D', text: 'FFFFFF', title: 'FFFFFF' }
  };
  const PX = 96; // 960x540 px = 10 x 5.625 palca
  const pt = px => Math.round(px * 0.75);

  function hex(c) {
    if (!c) return null;
    let m = /^#([0-9a-f]{6})$/i.exec(c.trim()); if (m) return m[1].toUpperCase();
    m = /^#([0-9a-f]{3})$/i.exec(c.trim()); if (m) return m[1].split('').map(x => x + x).join('').toUpperCase();
    m = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c); if (m) return [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    return null;
  }

  /* HTML obsah snímky -> odseky s formátovaním + obrázky */
  function parse(html) {
    const root = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html').body;
    const paras = [], images = [];
    const style = (el, st) => {
      const n = { ...st }, t = el.tagName, s = el.style;
      if (t === 'B' || t === 'STRONG' || s.fontWeight === 'bold' || +s.fontWeight >= 600) n.bold = true;
      if (t === 'I' || t === 'EM' || s.fontStyle === 'italic') n.italic = true;
      if (t === 'U' || (s.textDecoration || '').includes('underline')) n.underline = { style: 'sng' };
      if (t === 'S' || t === 'STRIKE' || (s.textDecoration || '').includes('line-through')) n.strike = 'sngStrike';
      const col = hex(s.color || el.getAttribute('color')); if (col) n.color = col;
      return n;
    };
    function inline(node, st, runs) {
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) { if (ch.nodeValue) runs.push({ text: ch.nodeValue.replace(/\s+/g, ' '), options: { ...st } }); }
        else if (ch.nodeType === 1) {
          if (ch.tagName === 'IMG') images.push(ch.getAttribute('src'));
          else if (ch.tagName === 'BR') runs.push({ text: '', options: { softBreakBefore: true } });
          else if (ch.tagName === 'UL' || ch.tagName === 'OL') { /* spracované v block */ }
          else inline(ch, style(ch, st), runs);
        }
      }
    }
    function block(node, st, level, align) {
      let loose = [];
      const flush = () => { if (loose.length && loose.some(r => r.text.trim())) paras.push({ runs: loose, align }); loose = []; };
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) { if (ch.nodeValue.trim()) loose.push({ text: ch.nodeValue.replace(/\s+/g, ' '), options: { ...st } }); continue; }
        if (ch.nodeType !== 1) continue;
        const t = ch.tagName;
        if (t === 'UL' || t === 'OL') {
          flush();
          for (const li of ch.children) {
            const runs = []; inline(li, style(li, st), runs);
            if (runs.length) paras.push({ runs, bullet: t === 'OL' ? { type: 'number' } : true, level, align: li.style.textAlign || align });
            li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => block({ childNodes: [sub] }, st, level + 1, align));
          }
        } else if (/^(P|DIV|H[1-6]|BLOCKQUOTE|LI)$/.test(t)) {
          flush();
          if ([...ch.children].some(c => /^(UL|OL|P|DIV)$/.test(c.tagName))) block(ch, style(ch, st), level, ch.style.textAlign || align);
          else { const runs = []; inline(ch, style(ch, st), runs); if (runs.some(r => r.text.trim())) paras.push({ runs, align: ch.style.textAlign || align }); else { const imgs = ch.querySelectorAll('img'); imgs.forEach(i => images.push(i.getAttribute('src'))); } }
        } else if (t === 'IMG') images.push(ch.getAttribute('src'));
        else if (t === 'BR') flush();
        else inline({ childNodes: [ch] }, st, loose);
      }
      flush();
    }
    block(root, {}, 0, '');
    return { paras, images: images.filter(src => /^data:image\//.test(src || '')) };
  }

  function toTextObjects(paras, base) {
    const out = [];
    paras.forEach((p, pi) => {
      p.runs.forEach((r, ri) => {
        const o = { ...base, ...r.options };
        if (ri === 0) {
          if (p.bullet) { o.bullet = p.bullet; o.indentLevel = p.level || 0; }
          if (p.align) o.align = p.align === 'justify' ? 'justify' : p.align;
        }
        if (ri === p.runs.length - 1 && pi < paras.length - 1) o.breakLine = true;
        out.push({ text: r.text, options: o });
      });
    });
    return out;
  }
  const plain = html => new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html').body.textContent.trim();

  async function build(data, title) {
    if (!window.JSZip) await loadScript('vendor/jszip.min.js');
    if (!window.PptxGenJS) await loadScript('vendor/pptxgen.min.js');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = title || 'Prezentácia';
    pptx.company = 'Yankee Office';
    const th = THEMES[data.theme] || THEMES['theme-light'];
    for (const s of data.slides) {
      const sl = pptx.addSlide();
      sl.background = { color: th.bg };
      const isTitle = s.layout === 'layout-title';
      const titleText = plain(s.title);
      if (titleText) {
        const { paras } = parse(s.title);
        sl.addText(toTextObjects(paras, {}), {
          x: 60 / PX, y: (isTitle ? 160 : 40) / PX, w: 840 / PX, h: (isTitle ? 110 : 90) / PX,
          fontSize: pt(isTitle ? 54 : 44), bold: true, color: th.title, fontFace: 'Segoe UI', align: isTitle ? 'center' : 'left', valign: 'middle'
        });
      }
      const { paras, images } = parse(s.body);
      const bodyY = isTitle ? 285 : 150, bodyH = 540 - bodyY - 40;
      let textH = paras.length ? bodyH : 0;
      if (paras.length) {
        if (images.length) textH = Math.min(bodyH, 40 + paras.length * 44);
        sl.addText(toTextObjects(paras, {}), {
          x: 60 / PX, y: bodyY / PX, w: 840 / PX, h: textH / PX,
          fontSize: pt(isTitle ? 28 : 26), color: th.text, fontFace: 'Segoe UI', valign: 'top', align: isTitle ? 'center' : 'left', paraSpaceAfter: 6
        });
      }
      // obrázky pod text, zachovaný pomer strán
      const imgTop = bodyY + textH + (textH ? 10 : 0), imgH = 540 - imgTop - 30;
      for (const [k, src] of images.entries()) {
        if (imgH < 60) break;
        const dim = await new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([4, 3]); im.src = src; });
        const slotW = 840 / images.length;
        const scale = Math.min(slotW / dim[0], imgH / dim[1], 1.5);
        const w = dim[0] * scale, h = dim[1] * scale;
        sl.addImage({ data: src, x: (60 + slotW * k + (slotW - w) / 2) / PX, y: imgTop / PX, w: w / PX, h: h / PX });
      }
      if (s.notes) sl.addNotes(s.notes);
    }
    return pptx.write({ outputType: 'blob' });
  }

  return { build };
})();
