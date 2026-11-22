/* Yankee Office – Google Drive (Google Identity Services + Drive REST API v3)
   Používa rozsah drive.file: aplikácia vidí len súbory, ktoré sama vytvorila
   alebo ktoré používateľ výslovne otvoril cez výber súborov (Google Picker). */
const GDrive = (() => {
  const CFG_KEY = 'yankee-office-gdrive';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  let token = null, expires = 0;

  const config = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; } };
  const setConfig = c => localStorage.setItem(CFG_KEY, JSON.stringify(c));
  const isConfigured = () => !!config().clientId;
  const canRun = () => location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  async function getToken(interactive = true) {
    if (token && Date.now() < expires - 60000) return token;
    if (!isConfigured()) throw new Error('Google Drive nie je nastavený.');
    if (!canRun()) throw new Error('Google Drive funguje len cez https:// alebo http://localhost (spustite Yankee Office cez spúšťač).');
    await loadScript('https://accounts.google.com/gsi/client');
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: config().clientId,
        scope: SCOPE,
        callback: r => {
          if (r.error) return reject(new Error(r.error_description || r.error));
          token = r.access_token; expires = Date.now() + (r.expires_in || 3600) * 1000;
          resolve(token);
        },
        error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'Prihlásenie bolo zrušené.' : e.type === 'popup_failed_to_open' ? 'Prehliadač zablokoval okno prihlásenia – povoľte vyskakovacie okná.' : (e.message || e.type)))
      });
      client.requestAccessToken({ prompt: interactive ? '' : 'none' });
    });
  }

  async function api(url, opts = {}, retry = true) {
    const t = await getToken();
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + t } });
    if (r.status === 401 && retry) { token = null; return api(url, opts, false); }
    if (!r.ok) {
      let msg = r.status + '';
      try { const j = await r.json(); msg = j.error?.message || msg; } catch (e) { }
      const err = new Error('Google Drive: ' + msg); err.status = r.status; throw err;
    }
    return r;
  }

  async function upload({ name, blob, mimeType, fileId }) {
    const boundary = 'yankee' + Math.random().toString(36).slice(2);
    const meta = { name, mimeType };
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, JSON.stringify(meta),
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, blob, `\r\n--${boundary}--`
    ]);
    const headers = { 'Content-Type': 'multipart/related; boundary=' + boundary };
    const fields = 'fields=id,name,webViewLink,modifiedTime';
    if (fileId) {
      try {
        const r = await api(`${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=multipart&${fields}`, { method: 'PATCH', headers, body });
        return r.json();
      } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; } // súbor zmazaný – vytvoríme nový
    }
    const r = await api(`${UPLOAD}/files?uploadType=multipart&${fields}`, { method: 'POST', headers, body });
    return r.json();
  }

  async function list() {
    const q = encodeURIComponent('trashed=false');
    const r = await api(`${API}/files?q=${q}&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,mimeType,modifiedTime,size)`);
    return (await r.json()).files || [];
  }

  const GOOGLE_EXPORT = {
    'application/vnd.google-apps.document': { mime: MIME.docx, ext: '.docx' },
    'application/vnd.google-apps.spreadsheet': { mime: MIME.xlsx, ext: '.xlsx' }
  };
  async function download(file) {
    const exp = GOOGLE_EXPORT[file.mimeType];
    if (file.mimeType === 'application/vnd.google-apps.presentation') throw new Error('Prezentácie Google zatiaľ nie je možné otvoriť.');
    const url = exp
      ? `${API}/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exp.mime)}`
      : `${API}/files/${encodeURIComponent(file.id)}?alt=media`;
    const r = await api(url);
    const name = exp && !file.name.endsWith(exp.ext) ? file.name + exp.ext : file.name;
    return { blob: await r.blob(), name, converted: !!exp };
  }

  /* Google Picker – výber ľubovoľného súboru z Disku (vyžaduje API kľúč) */
  async function pick() {
    const cfg = config();
    if (!cfg.apiKey) throw new Error('Pre výber súborov z celého Disku zadajte v nastaveniach aj API kľúč.');
    const t = await getToken();
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise(res => gapi.load('picker', res));
    return new Promise(resolve => {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setMimeTypes([MIME.docx, MIME.xlsx, 'application/vnd.ms-excel', 'text/csv', 'application/vnd.oasis.opendocument.spreadsheet',
          'application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet', 'text/plain', 'text/html', 'application/json'].join(','));
      const appId = (cfg.clientId.match(/^(\d+)-/) || [])[1];
      const builder = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(t)
        .setDeveloperKey(cfg.apiKey)
        .setLocale('sk')
        .setCallback(d => {
          if (d.action === google.picker.Action.PICKED) { const f = d.docs[0]; resolve({ id: f.id, name: f.name, mimeType: f.mimeType }); }
          else if (d.action === google.picker.Action.CANCEL) resolve(null);
        });
      if (appId) builder.setAppId(appId);
      builder.build().setVisible(true);
    });
  }

  function signOut() {
    if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => { });
    token = null; expires = 0;
  }

  return { config, setConfig, isConfigured, canRun, upload, list, download, pick, signOut, signedIn: () => !!token && Date.now() < expires };
})();

/* ---------- Používateľské rozhranie pre Drive (spoločné pre všetky aplikácie) ---------- */
const DriveUI = (() => {
  function dialog(title, body, buttons = []) {
    const d = document.createElement('dialog');
    d.className = 'dlg';
    d.innerHTML = `<header><span>${escapeHtml(title)}</span><button type="button" data-close aria-label="Zavrieť">×</button></header>
      <div class="body">${body}</div>${buttons.length ? '<footer></footer>' : ''}`;
    const foot = d.querySelector('footer');
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'btn' + (b.primary ? ' primary' : ''); el.textContent = b.label;
      el.onclick = () => b.onClick(d);
      foot.appendChild(el);
    });
    d.querySelector('[data-close]').onclick = () => d.close();
    d.addEventListener('close', () => d.remove());
    document.body.appendChild(d);
    d.showModal();
    return d;
  }

  function settings(onSaved) {
    const cfg = GDrive.config();
    const origin = location.protocol.startsWith('http') ? location.origin : 'http://localhost:8765';
    const d = dialog('Nastavenie Google Drive', `
      <p>Aby Yankee Office mohol ukladať a otvárať súbory na vašom Google Disku, potrebuje vlastný (bezplatný) prístupový kľúč od Google. Nastavuje sa raz:</p>
      <ol>
        <li>Otvorte <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a>, vytvorte projekt a zapnite <b>Google Drive API</b> (pre výber súborov aj <b>Google Picker API</b>).</li>
        <li>V časti <b>APIs &amp; Services → OAuth consent screen</b> nastavte aplikáciu (typ External, pridajte svoj e-mail ako testovacieho používateľa).</li>
        <li>V <b>Credentials → Create credentials → OAuth client ID</b> zvoľte <b>Web application</b> a do <b>Authorized JavaScript origins</b> pridajte: <code>${escapeHtml(origin)}</code></li>
        <li>Skopírujte <b>Client ID</b> sem. Voliteľne vytvorte aj <b>API key</b> – umožní otvárať ľubovoľné súbory z Disku.</li>
      </ol>
      ${GDrive.canRun() ? '' : '<p style="color:#c62828"><b>Pozor:</b> Yankee Office je teraz otvorený priamo zo súboru. Google Drive funguje len cez spúšťač (http://localhost:8765) alebo cez webovú adresu https.</p>'}
      <label for="gdClient">OAuth Client ID</label>
      <input type="text" id="gdClient" placeholder="123456789-abc….apps.googleusercontent.com" value="${escapeHtml(cfg.clientId || '')}">
      <label for="gdKey">API kľúč (voliteľné)</label>
      <input type="text" id="gdKey" placeholder="AIza…" value="${escapeHtml(cfg.apiKey || '')}">
    `, [
      { label: 'Odhlásiť z Google', onClick: () => { GDrive.signOut(); toast('Odhlásené z Google Drive.'); } },
      { label: 'Uložiť', primary: true, onClick: dlg => {
        const clientId = dlg.querySelector('#gdClient').value.trim(), apiKey = dlg.querySelector('#gdKey').value.trim();
        if (clientId && !/\.apps\.googleusercontent\.com$/.test(clientId)) { alert('Client ID by mal končiť na .apps.googleusercontent.com'); return; }
        GDrive.setConfig({ clientId, apiKey });
        dlg.close(); toast('Nastavenia Google Drive uložené.');
        if (onSaved && clientId) onSaved();
      } }
    ]);
    return d;
  }

  function ensureReady(then) {
    if (!GDrive.isConfigured()) { settings(then); return false; }
    return true;
  }

  const ICON = name => /\.docx?$|google-apps\.document/i.test(name) ? ['T', 'writer'] : /\.(xlsx|xls|ods|csv)$|spreadsheet/i.test(name) ? ['X', 'sheet'] : /yslides|\.pptx$|presentation/i.test(name) ? ['P', 'slides'] : ['?', ''];

  async function openFromDrive() {
    if (!ensureReady(openFromDrive)) return;
    const hasPicker = !!GDrive.config().apiKey;
    const d = dialog('Otvoriť z Google Drive', '<p>Načítavam zoznam súborov…</p>', [
      ...(hasPicker ? [{ label: 'Vybrať iný súbor z Disku…', onClick: async dlg => {
        try { const f = await GDrive.pick(); if (f) { dlg.close(); openFile(f); } } catch (e) { alert(e.message); }
      } }] : []),
      { label: 'Zrušiť', onClick: dlg => dlg.close() }
    ]);
    const body = d.querySelector('.body');
    try {
      const files = (await GDrive.list()).filter(f => !/folder|shortcut/.test(f.mimeType));
      if (!files.length) {
        body.innerHTML = `<p>Na Disku zatiaľ nie sú žiadne súbory uložené z Yankee Office.</p>${hasPicker ? '<p>Tlačidlom nižšie môžete vybrať ľubovoľný súbor z Disku.</p>' : '<p>Ak chcete otvárať aj iné súbory z Disku, doplňte v nastaveniach API kľúč.</p>'}`;
        return;
      }
      body.innerHTML = files.map((f, i) => {
        const [l, cls] = ICON(f.name + ' ' + f.mimeType);
        return `<div class="file-row" data-i="${i}"><div class="ico ${cls}" style="width:28px;height:28px;border-radius:6px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:13px;background:${cls ? '' : '#999'}">${l}</div>
          <span class="n">${escapeHtml(f.name)}</span><span class="d">${new Date(f.modifiedTime).toLocaleString('sk-SK')}</span></div>`;
      }).join('');
      body.onclick = e => { const row = e.target.closest('.file-row'); if (row) { d.close(); openFile(files[+row.dataset.i]); } };
    } catch (e) { body.innerHTML = `<p style="color:#c62828">${escapeHtml(e.message)}</p>`; }
  }

  async function openFile(f) {
    toast('Sťahujem „' + f.name + '“…', 10000);
    try {
      const { blob, name, converted } = await GDrive.download(f);
      const doc = await importFile(blob, name);
      // ďalšie uloženie prepíše pôvodný súbor (okrem Google Docs/Sheets, z ktorých sa vytvorí kópia)
      if (!converted && /\.(docx|xlsx|yslides\.json)$/i.test(name)) { doc.drive = { id: f.id, name }; Store.save(doc); }
      location.href = PAGE_FOR[doc.type] + '?id=' + doc.id;
    } catch (e) { toast(''); alert(e.message); }
  }

  /* makeFile: async () => ({ blob, name, mimeType }) */
  async function save(doc, makeFile, statusEl) {
    if (!ensureReady(() => save(doc, makeFile, statusEl))) return;
    try {
      if (statusEl) statusEl.textContent = 'Ukladám na Drive…';
      const f = await makeFile();
      const sameKind = doc.drive && doc.drive.name && doc.drive.name.split('.').pop() === f.name.split('.').pop();
      const res = await GDrive.upload({ ...f, fileId: sameKind ? doc.drive.id : null });
      doc.drive = { id: res.id, name: res.name, link: res.webViewLink };
      Store.save(doc);
      if (statusEl) statusEl.textContent = 'Uložené na Drive ' + new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
      toast('Uložené na Google Drive: ' + res.name);
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Chyba ukladania na Drive';
      alert(e.message);
    }
  }

  /* Pridá rozbaľovacie menu „Google Drive" do hornej lišty */
  function menu(container, doc, options) {
    const sel = document.createElement('select');
    sel.className = 'tb-btn'; sel.setAttribute('aria-label', 'Google Drive');
    sel.innerHTML = '<option value="">☁ Google Drive</option>' +
      options.saves.map((s, i) => `<option value="s${i}">${escapeHtml(s.label)}</option>`).join('') +
      '<option value="open">Otvoriť z Drive…</option>' +
      (doc.drive?.link ? '<option value="link">Zobraziť na Drive</option>' : '') +
      '<option value="cfg">Nastavenia…</option>';
    sel.onchange = () => {
      const v = sel.value; sel.value = '';
      if (v[0] === 's') save(doc, options.saves[+v.slice(1)].make, options.statusEl);
      else if (v === 'open') openFromDrive();
      else if (v === 'link') window.open(doc.drive.link, '_blank', 'noopener');
      else if (v === 'cfg') settings();
    };
    container.appendChild(sel);
    return sel;
  }

  return { dialog, settings, openFromDrive, save, menu };
})();
