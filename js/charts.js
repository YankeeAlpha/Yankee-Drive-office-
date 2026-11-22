/* Yankee Tabuľky – grafy (SVG) */
const Charts = (() => {
  // Kategorická paleta (overená na farbosleposť), pevné poradie
  const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const C = { surface: '#fcfcfb', text: '#0b0b0b', text2: '#52514e', muted: '#8a8984', grid: '#e7e6e2', axis: '#b9b8b2' };
  const W = 520, H = 300;
  const TYPES = { bar: 'Stĺpcový', hbar: 'Pruhový', line: 'Čiarový', area: 'Plošný', pie: 'Koláčový' };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = v => typeof v === 'number' ? v.toLocaleString('sk-SK', { maximumFractionDigits: 2 }) : '';

  /* ---------- Dáta z rozsahu ---------- */
  function extract(range, values) {
    const [a, b] = range.toUpperCase().split(':');
    const p1 = Formula.parseRef(a), p2 = Formula.parseRef(b || a);
    if (!p1 || !p2) return null;
    const r1 = Math.min(p1.r, p2.r), r2 = Math.max(p1.r, p2.r), c1 = Math.min(p1.c, p2.c), c2 = Math.max(p1.c, p2.c);
    const get = (c, r) => { const v = values[Formula.makeRef(c, r)]; return Formula.isErr(v) ? null : v; };
    const isText = v => typeof v === 'string' && v !== '';
    let header = false;
    for (let c = c1; c <= c2; c++) if (isText(get(c, r1)) && c > c1) header = true;
    if (c1 === c2 && isText(get(c1, r1))) header = true;
    const dataR1 = header ? r1 + 1 : r1;
    let catCol = false;
    if (c2 > c1) for (let r = dataR1; r <= r2; r++) if (isText(get(c1, r))) catCol = true;
    const sc1 = catCol ? c1 + 1 : c1;
    const categories = [];
    for (let r = dataR1; r <= r2; r++) categories.push(catCol ? String(get(c1, r) ?? '') : String(r - dataR1 + 1));
    const series = [];
    for (let c = sc1; c <= c2 && series.length < PALETTE.length; c++) {
      const name = header ? String(get(c, r1) ?? Formula.numToCol(c)) : 'Rad ' + (series.length + 1);
      const data = [];
      for (let r = dataR1; r <= r2; r++) { const v = get(c, r); data.push(typeof v === 'number' ? v : null); }
      series.push({ name, data, color: PALETTE[series.length] });
    }
    if (!series.length || !categories.length) return null;
    return { categories, series };
  }

  function niceTicks(min, max, count = 5) {
    if (min === max) { max = min + 1; }
    const span = max - min, step0 = span / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }
  const shortNum = v => Math.abs(v) >= 1e6 ? fmt(v / 1e6) + ' mil.' : Math.abs(v) >= 1e4 ? fmt(v / 1e3) + ' tis.' : fmt(v);
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  /* Obdĺžnik so zaobleným koncom pri dátovej hodnote (4px), ukotvený na nulovej osi */
  function barPath(x, y, w, h, dir) {
    const r = Math.min(4, w / 2, Math.abs(h));
    if (h <= 0.5) return '';
    if (dir === 'up') return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
    if (dir === 'down') return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
    if (dir === 'right') return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
    return `M${x + w},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w}Z`; // left
  }

  /* ---------- Vykreslenie ---------- */
  function render(spec, values) {
    const d = extract(spec.range, values);
    if (!d) return { svg: `<svg viewBox="0 0 ${W} 120" xmlns="http://www.w3.org/2000/svg"><text x="${W / 2}" y="60" text-anchor="middle" fill="${C.text2}" font-size="13" font-family="Segoe UI, Arial, sans-serif">Rozsah ${esc(spec.range)} neobsahuje čísla</text></svg>`, marks: [] };
    if (spec.type === 'pie') return pie(d);
    const marks = []; // {x,y,w,h, html} pre tooltip
    const multi = d.series.length > 1;
    const legendH = multi ? 26 : 0;
    const font = 'font-family="Segoe UI, Arial, sans-serif"';
    let out = '';
    if (multi) {
      let lx = 12;
      d.series.forEach(s => {
        const label = clip(s.name, 18);
        out += `<rect x="${lx}" y="9" width="10" height="10" rx="2" fill="${s.color}"/><text x="${lx + 15}" y="18" font-size="12" fill="${C.text2}" ${font}>${esc(label)}</text>`;
        lx += 30 + label.length * 6.5;
      });
    }
    const all = d.series.flatMap(s => s.data).filter(v => v !== null);
    let min = Math.min(0, ...all), max = Math.max(0, ...all);
    if (spec.type === 'line' && all.length) { min = Math.min(...all); max = Math.max(...all); if (min > 0 && min < max * 0.5) min = 0; }
    const ticks = niceTicks(min, max);
    const tMin = ticks[0], tMax = ticks[ticks.length - 1];
    const n = d.categories.length;

    if (spec.type === 'hbar') {
      const left = Math.min(130, 16 + Math.max(...d.categories.map(c => clip(c, 18).length)) * 6.4);
      const pl = left, pr = W - 16, pt = 10 + legendH, pb = H - 28;
      const sx = v => pl + (v - tMin) / (tMax - tMin) * (pr - pl);
      ticks.forEach(t => { out += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${pt}" y2="${pb}" stroke="${t === 0 ? C.axis : C.grid}" stroke-width="1"/><text x="${sx(t)}" y="${pb + 16}" text-anchor="middle" font-size="11" fill="${C.text2}" ${font}>${esc(shortNum(t))}</text>`; });
      const band = (pb - pt) / n, gw = band * 0.72, bh = Math.max(2, (gw - 2 * (d.series.length - 1)) / d.series.length);
      d.categories.forEach((cat, i) => {
        const y0 = pt + band * i + (band - gw) / 2;
        out += `<text x="${pl - 8}" y="${pt + band * i + band / 2 + 4}" text-anchor="end" font-size="11" fill="${C.text2}" ${font}>${esc(clip(cat, 18))}</text>`;
        d.series.forEach((s, k) => {
          const v = s.data[i]; if (v === null) return;
          const y = y0 + k * (bh + 2), x0 = sx(0), x1 = sx(v);
          out += `<path d="${barPath(Math.min(x0, x1), y, Math.abs(x1 - x0), bh, v >= 0 ? 'right' : 'left')}" fill="${s.color}"/>`;
          marks.push({ x: pl, y, w: pr - pl, h: bh + 2, html: tipRow(cat, [[s, v]]) });
        });
      });
    } else {
      const pl = 52, pr = W - 14, pt = 12 + legendH, pb = H - 30;
      const sy = v => pb - (v - tMin) / (tMax - tMin) * (pb - pt);
      ticks.forEach(t => { out += `<line x1="${pl}" x2="${pr}" y1="${sy(t)}" y2="${sy(t)}" stroke="${t === 0 ? C.axis : C.grid}" stroke-width="1"/><text x="${pl - 8}" y="${sy(t) + 4}" text-anchor="end" font-size="11" fill="${C.text2}" ${font}>${esc(shortNum(t))}</text>`; });
      const band = (pr - pl) / n;
      const every = Math.ceil(n / Math.floor((pr - pl) / 56));
      d.categories.forEach((cat, i) => {
        if (i % every) return;
        out += `<text x="${pl + band * i + band / 2}" y="${pb + 18}" text-anchor="middle" font-size="11" fill="${C.text2}" ${font}>${esc(clip(cat, Math.max(4, Math.floor(band * every / 6.5))))}</text>`;
      });
      if (spec.type === 'bar') {
        const gw = Math.min(band * 0.72, 40 * d.series.length), bw = Math.max(2, (gw - 2 * (d.series.length - 1)) / d.series.length);
        d.categories.forEach((cat, i) => {
          const x0 = pl + band * i + (band - gw) / 2;
          d.series.forEach((s, k) => {
            const v = s.data[i]; if (v === null) return;
            const x = x0 + k * (bw + 2), y0 = sy(0), y1 = sy(v);
            out += `<path d="${barPath(x, Math.min(y0, y1), bw, Math.abs(y1 - y0), v >= 0 ? 'up' : 'down')}" fill="${s.color}"/>`;
          });
          marks.push({ x: pl + band * i, y: pt, w: band, h: pb - pt, html: tipRow(cat, d.series.map(s => [s, s.data[i]])) });
        });
      } else { // line / area
        const cx = i => pl + band * i + band / 2;
        d.series.forEach(s => {
          const pts = s.data.map((v, i) => v === null ? null : [cx(i), sy(v)]);
          const segs = []; let cur = [];
          pts.forEach(p => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
          if (cur.length) segs.push(cur);
          segs.forEach(seg => {
            if (spec.type === 'area' && seg.length > 1) {
              const base = sy(Math.max(tMin, Math.min(0, tMax)));
              out += `<path d="M${seg[0][0]},${base}L${seg.map(p => p.join(',')).join('L')}L${seg[seg.length - 1][0]},${base}Z" fill="${s.color}" fill-opacity="${multi ? 0.18 : 0.22}"/>`;
            }
            out += `<polyline points="${seg.map(p => p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
          });
          if (n <= 24) pts.forEach(p => { if (p) out += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${s.color}" stroke="${C.surface}" stroke-width="2"/>`; });
        });
        d.categories.forEach((cat, i) => marks.push({ x: pl + band * i, y: pt, w: band, h: pb - pt, cross: cx(i), html: tipRow(cat, d.series.map(s => [s, s.data[i]])) }));
      }
    }
    const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(spec.title || TYPES[spec.type])}"><rect width="${W}" height="${H}" fill="${C.surface}"/>${out}<g class="hit"></g></svg>`;
    return { svg, marks };
  }

  function tipRow(cat, rows) {
    return `<div style="font-weight:600;margin-bottom:3px">${esc(cat)}</div>` + rows.map(([s, v]) =>
      `<div><span class="sw" style="background:${s.color}"></span><span class="muted">${esc(s.name)}:</span> ${v === null || v === undefined ? '–' : esc(fmt(v))}</div>`).join('');
  }

  function pie(d) {
    const s0 = d.series[0];
    let items = d.categories.map((c, i) => ({ name: c, v: s0.data[i] })).filter(x => x.v !== null && x.v > 0);
    if (items.length > 6) { // zvyšok zlúčime do „Ostatné"
      items.sort((a, b) => b.v - a.v);
      const rest = items.slice(5).reduce((s, x) => s + x.v, 0);
      items = items.slice(0, 5).concat([{ name: 'Ostatné', v: rest, other: true }]);
    }
    const total = items.reduce((s, x) => s + x.v, 0);
    const font = 'font-family="Segoe UI, Arial, sans-serif"';
    if (!total) return { svg: `<svg viewBox="0 0 ${W} 120" xmlns="http://www.w3.org/2000/svg"><text x="${W / 2}" y="60" text-anchor="middle" fill="${C.text2}" font-size="13" ${font}>Koláčový graf potrebuje kladné čísla</text></svg>`, marks: [] };
    const cx = 150, cy = H / 2, R = 115, r0 = 62;
    let a = -Math.PI / 2, out = '';
    const marks = [];
    items.forEach((it, i) => {
      const color = it.other ? '#a3a29c' : PALETTE[i];
      const ang = it.v / total * Math.PI * 2, a2 = a + ang;
      const large = ang > Math.PI ? 1 : 0;
      const p = (rad, ang) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      const [x1, y1] = p(R, a), [x2, y2] = p(R, a2), [x3, y3] = p(r0, a2), [x4, y4] = p(r0, a);
      const path = items.length === 1
        ? `M${cx - R},${cy}A${R},${R} 0 1 1 ${cx + R},${cy}A${R},${R} 0 1 1 ${cx - R},${cy}ZM${cx - r0},${cy}A${r0},${r0} 0 1 0 ${cx + r0},${cy}A${r0},${r0} 0 1 0 ${cx - r0},${cy}Z`
        : `M${x1},${y1}A${R},${R} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${r0},${r0} 0 ${large} 0 ${x4},${y4}Z`;
      out += `<path d="${path}" fill="${color}" stroke="${C.surface}" stroke-width="2" fill-rule="evenodd" data-m="${i}"/>`;
      const pct = (it.v / total * 100).toLocaleString('sk-SK', { maximumFractionDigits: 1 });
      marks.push({ slice: i, html: `<div><span class="sw" style="background:${color}"></span><b>${esc(it.name)}</b></div><div class="muted">${esc(fmt(it.v))} · ${pct} %</div>` });
      // legenda vpravo
      const ly = 40 + i * 30;
      out += `<rect x="300" y="${ly - 10}" width="12" height="12" rx="2" fill="${color}"/><text x="320" y="${ly}" font-size="12" fill="${C.text}" ${font}>${esc(clip(it.name, 22))}</text><text x="${W - 16}" y="${ly}" font-size="12" text-anchor="end" fill="${C.text2}" ${font}>${pct} %</text>`;
      a = a2;
    });
    out += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="18" font-weight="700" fill="${C.text}" ${font}>${esc(shortNum(total))}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="${C.text2}" ${font}>${esc(clip(s0.name, 16))}</text>`;
    return { svg: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"><rect width="${W}" height="${H}" fill="${C.surface}"/>${out}</svg>`, marks };
  }

  /* Pripojí tooltip a zvýraznenie k vykreslenému grafu */
  function attachHover(container, marks) {
    const svg = container.querySelector('svg'); if (!svg || !marks.length) return;
    let tip = document.getElementById('chartTip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'chartTip'; tip.className = 'chart-tip'; document.body.appendChild(tip); }
    const show = (e, html) => {
      tip.innerHTML = html; tip.style.display = 'block';
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + tw > innerWidth - 8) x = e.clientX - tw - 14;
      if (y + th > innerHeight - 8) y = e.clientY - th - 14;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    const hide = () => { tip.style.display = 'none'; };
    if (marks[0].slice !== undefined) {
      svg.querySelectorAll('[data-m]').forEach(p => {
        p.style.cursor = 'pointer';
        p.addEventListener('mousemove', e => { show(e, marks[+p.dataset.m].html); svg.querySelectorAll('[data-m]').forEach(q => q.style.opacity = q === p ? 1 : 0.45); });
        p.addEventListener('mouseleave', () => { hide(); svg.querySelectorAll('[data-m]').forEach(q => q.style.opacity = 1); });
      });
      return;
    }
    const g = svg.querySelector('.hit');
    const NS = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('stroke', C.muted); line.setAttribute('stroke-width', '1'); line.setAttribute('stroke-dasharray', '3 3'); line.style.display = 'none';
    const band = document.createElementNS(NS, 'rect');
    band.setAttribute('fill', '#000'); band.setAttribute('fill-opacity', '0.04'); band.style.display = 'none';
    g.append(band, line);
    marks.forEach(m => {
      const r = document.createElementNS(NS, 'rect');
      ['x', 'y', 'w', 'h'].forEach(k => r.setAttribute(k === 'w' ? 'width' : k === 'h' ? 'height' : k, m[k]));
      r.setAttribute('fill', 'transparent');
      r.addEventListener('mousemove', e => {
        show(e, m.html);
        if (m.cross !== undefined) { line.setAttribute('x1', m.cross); line.setAttribute('x2', m.cross); line.setAttribute('y1', m.y); line.setAttribute('y2', m.y + m.h); line.style.display = ''; }
        else { ['x', 'y'].forEach(k => band.setAttribute(k, m[k])); band.setAttribute('width', m.w); band.setAttribute('height', m.h); band.style.display = ''; }
      });
      r.addEventListener('mouseleave', () => { hide(); line.style.display = 'none'; band.style.display = 'none'; });
      g.appendChild(r);
    });
  }

  /* SVG -> PNG (2x) */
  function toPng(svgText, title) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const withTitle = title ? svgText.replace(/<rect width="520" height="(\d+)" fill="#fcfcfb"\/>/, (m) => m) : svgText;
      img.onload = () => {
        const scale = 2, vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svgText);
        const w = +vb[1], h = +vb[2], th = title ? 34 : 0;
        const cv = document.createElement('canvas');
        cv.width = w * scale; cv.height = (h + th) * scale;
        const ctx = cv.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = C.surface; ctx.fillRect(0, 0, w, h + th);
        if (title) { ctx.fillStyle = C.text; ctx.font = '600 15px Segoe UI, Arial, sans-serif'; ctx.fillText(title, 14, 23); }
        ctx.drawImage(img, 0, th, w, h);
        cv.toBlob(resolve, 'image/png');
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(withTitle);
    });
  }

  return { render, attachHover, toPng, extract, TYPES, PALETTE };
})();
