/* Yankee Prezentácie */
(() => {
  const W = 960, H = 540;
  const doc = openOrCreate('slides', 'Nová prezentácia', null);
  if (!doc.content || !Array.isArray(doc.content.slides) || !doc.content.slides.length) {
    doc.content = { theme: 'theme-light', slides: [{ layout: 'layout-title', title: '', body: '', notes: '' }] };
  }
  const data = doc.content;
  let idx = 0;

  const autosave = makeAutosave(doc, () => data, document.getElementById('status'));
  bindTitle(doc, document.getElementById('title'), autosave);

  const list = document.getElementById('list');
  const host = document.getElementById('slideHost');
  const notes = document.getElementById('notes');
  const stageInner = document.querySelector('.stage-inner');

  function slideHtml(s, editable) {
    const ce = editable ? 'contenteditable="true"' : '';
    return `<div class="slide ${data.theme} ${s.layout}">
      <div class="s-title" ${ce} data-f="title" data-placeholder="Kliknite a pridajte nadpis">${s.title || ''}</div>
      <div class="s-body" ${ce} data-f="body" data-placeholder="${s.layout === 'layout-title' ? 'Podnadpis' : 'Kliknite a pridajte text'}">${s.body || ''}</div>
    </div>`;
  }

  function fitStage() {
    const slide = host.querySelector('.slide'); if (!slide) return;
    const scale = Math.min(1, stageInner.clientWidth / W);
    slide.style.transform = `scale(${scale})`;
    host.style.height = H * scale + 'px';
    host.style.width = W * scale + 'px';
  }

  function renderThumbs() {
    list.innerHTML = data.slides.map((s, i) => `
      <div class="slide-thumb ${i === idx ? 'active' : ''}" data-i="${i}">
        <span class="num">${i + 1}</span>
        <div class="mini">${slideHtml(s, false)}</div>
      </div>`).join('');
    list.querySelectorAll('.mini').forEach(m => {
      const sc = m.clientWidth / W;
      m.querySelector('.slide').style.transform = `scale(${sc})`;
    });
  }

  function renderStage() {
    const s = data.slides[idx];
    host.innerHTML = slideHtml(s, true);
    notes.value = s.notes || '';
    document.getElementById('layout').value = s.layout;
    document.getElementById('theme').value = data.theme;
    fitStage();
    host.querySelectorAll('[contenteditable]').forEach(el =>
      el.addEventListener('input', () => { s[el.dataset.f] = el.innerHTML; changed(); }));
  }

  let thumbTimer;
  function changed() {
    autosave.schedule();
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(renderThumbs, 400);
  }
  function renderAll() { renderThumbs(); renderStage(); }

  list.addEventListener('click', e => {
    const t = e.target.closest('.slide-thumb'); if (!t) return;
    idx = +t.dataset.i; renderAll();
  });
  notes.addEventListener('input', () => { data.slides[idx].notes = notes.value; autosave.schedule(); });

  document.getElementById('add').onclick = () => {
    data.slides.splice(idx + 1, 0, { layout: 'layout-content', title: '', body: '', notes: '' });
    idx++; renderAll(); autosave.schedule();
  };
  document.getElementById('dup').onclick = () => {
    data.slides.splice(idx + 1, 0, JSON.parse(JSON.stringify(data.slides[idx])));
    idx++; renderAll(); autosave.schedule();
  };
  document.getElementById('del').onclick = () => {
    if (data.slides.length === 1) { alert('Prezentácia musí mať aspoň jednu snímku.'); return; }
    if (!confirm('Odstrániť túto snímku?')) return;
    data.slides.splice(idx, 1); idx = Math.min(idx, data.slides.length - 1); renderAll(); autosave.schedule();
  };
  function moveSlide(d) {
    const j = idx + d; if (j < 0 || j >= data.slides.length) return;
    [data.slides[idx], data.slides[j]] = [data.slides[j], data.slides[idx]]; idx = j; renderAll(); autosave.schedule();
  }
  document.getElementById('up').onclick = () => moveSlide(-1);
  document.getElementById('down').onclick = () => moveSlide(1);
  document.getElementById('layout').onchange = e => { data.slides[idx].layout = e.target.value; renderAll(); autosave.schedule(); };
  document.getElementById('theme').onchange = e => { data.theme = e.target.value; renderAll(); autosave.schedule(); };

  function exec(cmd, val) {
    document.execCommand(cmd, false, val ?? null);
    const el = document.activeElement;
    if (el && el.dataset && el.dataset.f) { data.slides[idx][el.dataset.f] = el.innerHTML; changed(); }
  }
  document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); exec(b.dataset.cmd); }));
  document.getElementById('fore').addEventListener('mousedown', () => { saved = saveSel(); });
  let saved = null;
  const saveSel = () => { const s = getSelection(); return s.rangeCount ? s.getRangeAt(0) : null; };
  document.getElementById('fore').oninput = e => {
    if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
    const el = saved && saved.startContainer.parentElement?.closest('[contenteditable]');
    if (el) el.focus();
    exec('foreColor', e.target.value);
  };
  document.getElementById('img').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const s = data.slides[idx];
      s.body = (s.body || '') + `<p style="text-align:center"><img src="${r.result}" style="max-height:300px;max-width:100%"></p>`;
      renderAll(); autosave.schedule();
    };
    r.readAsDataURL(f);
    e.target.value = '';
  };

  /* ---------- Prezentačný režim ---------- */
  function present(start) {
    let i = start;
    const ov = document.createElement('div');
    ov.className = 'present';
    document.body.appendChild(ov);
    function show() {
      ov.innerHTML = slideHtml(data.slides[i], false) + `<div class="counter">${i + 1} / ${data.slides.length}</div>`;
      const sc = Math.min(innerWidth / W, innerHeight / H);
      const sl = ov.querySelector('.slide');
      sl.style.transform = `scale(${sc})`;
      sl.style.flex = 'none';
    }
    function key(e) {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (i < data.slides.length - 1) { i++; show(); } else close(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); if (i > 0) { i--; show(); } }
      else if (e.key === 'Escape') close();
      else if (e.key === 'Home') { i = 0; show(); }
      else if (e.key === 'End') { i = data.slides.length - 1; show(); }
    }
    function close() {
      document.removeEventListener('keydown', key);
      removeEventListener('resize', show);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      ov.remove();
    }
    ov.addEventListener('click', () => { if (i < data.slides.length - 1) { i++; show(); } else close(); });
    document.addEventListener('keydown', key);
    addEventListener('resize', show);
    document.addEventListener('fullscreenchange', function fc() { if (!document.fullscreenElement && ov.isConnected) { document.removeEventListener('fullscreenchange', fc); close(); } });
    ov.requestFullscreen?.().catch(() => { });
    show();
  }
  document.getElementById('play').onclick = () => present(0);
  document.addEventListener('keydown', e => {
    if (e.key === 'F5') { e.preventDefault(); present(e.shiftKey ? idx : 0); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); autosave.saveNow(); }
  });

  /* ---------- Export ---------- */
  document.getElementById('export').onchange = async e => {
    const v = e.target.value; e.target.value = '';
    if (v === 'pdf') { printSlides(); return; }
    if (v === 'html') {
      const css = await fetch('css/style.css').then(r => r.text()).catch(() => '');
      const slides = JSON.stringify(data.slides.map(s => slideHtml(s, false)));
      const out = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.title)}</title><style>${css}
body{background:#000;margin:0;overflow:hidden}.present{cursor:default}</style></head><body>
<div class="present" id="p"></div>
<script>const S=${slides.replace(/</g, '\\u003c')};let i=0;const p=document.getElementById('p');
function show(){p.innerHTML=S[i]+'<div class="counter">'+(i+1)+' / '+S.length+'</div>';const sc=Math.min(innerWidth/${W},innerHeight/${H});const s=p.querySelector('.slide');s.style.transform='scale('+sc+')';s.style.flex='none';}
addEventListener('keydown',e=>{if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].includes(e.key)&&i<S.length-1){i++;show();}else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)&&i>0){i--;show();}else if(e.key==='f'){document.documentElement.requestFullscreen();}});
p.addEventListener('click',()=>{if(i<S.length-1){i++;show();}});addEventListener('resize',show);show();<\/script></body></html>`;
      download(safeName(doc.title) + '.html', out, 'text/html;charset=utf-8');
    }
  };

  function printSlides() {
    const w = window.open('', '_blank');
    if (!w) { alert('Povoľte vyskakovacie okná pre tlač.'); return; }
    fetch('css/style.css').then(r => r.text()).then(css => {
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>${css}
@page{size:${W}px ${H}px;margin:0}body{background:#fff;margin:0}.slide{page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>
<body>${data.slides.map(s => slideHtml(s, false)).join('')}</body></html>`);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 300);
    });
  }

  document.getElementById('new').onclick = () => { autosave.saveNow(); location.href = 'slides.html'; };
  addEventListener('resize', () => { fitStage(); renderThumbs(); });

  renderAll();
})();
