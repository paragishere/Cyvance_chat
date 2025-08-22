(function(){
  const cfg = window.CHAT_CONFIG || {};
  const messagesEl = document.getElementById('messages');
  const expiryEl = document.getElementById('expiryCountdown'); // optional countdown badge in room header
  let lastTimestamp = null;
  let polling = false;

  // Countdown state
  let expiresAt = null;         // ISO string from server (api_messages)
  let countdownTimer = null;    // interval id

  // ---------- Utils ----------
  function esc(str){
    return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function smoothScrollToBottom(){
    if (!messagesEl) return;
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
  }
  function unprefixLang(content){
    if (!content) return '';
    const m = content.match(/^\[(.+?)\]\n/);
    return m ? content.slice(m[0].length) : content;
  }
  function formatRemaining(ms){
    if (ms <= 0) return 'Expired';
    const totalSec = Math.floor(ms/1000);
    const h = Math.floor(totalSec/3600);
    const m = Math.floor((totalSec%3600)/60);
    const s = totalSec%60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }
  function setBusy(form, busy, hintEl){
    if (!form) return;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = busy;
    if (hintEl) hintEl.textContent = busy ? 'Sending…' : '';
  }
  function disableForms(){
    ['textForm','codeForm','imageForm'].forEach(id=>{
      const f = document.getElementById(id);
      if (f){
        f.querySelectorAll('input,textarea,button').forEach(el=> el.disabled = true);
      }
    });
  }

  // ---------- Clipboard (Copy for code) ----------
  async function copyToClipboard(text, statusEl){
    try {
      await navigator.clipboard.writeText(text);
      if (statusEl) {
        const old = statusEl.textContent;
        statusEl.textContent = 'Copied!';
        setTimeout(()=> statusEl.textContent = old || '', 1200);
      }
    } catch (e) {
      alert('Copy failed. Your browser may block clipboard access.');
    }
  }

  // ---------- Rendering ----------
  function renderMessage(m){
    const el = document.createElement('div');
    el.className = 'bubble';
    const who = esc(m.nickname || 'anon');
    const time = new Date(m.created_at).toLocaleString();
    let meta = `<div class="meta"><span class="dot"></span><span>${who}</span><span>•</span><span>${time}</span>`;
    let body = '';

    if (m.type === 'code' && /^\[(.+?)\]\n/.test(m.content||'')) {
      const lang = (m.content.match(/^\[(.+?)\]\n/)||[])[1];
      if (lang) meta += ` <span class="tag">${esc(lang)}</span>`;
    }
    meta += `</div>`;

    if (m.type === 'text') {
      body = `<div>${esc(m.content)}</div>`;
      el.innerHTML = meta + body;
    } else if (m.type === 'code') {
      let content = m.content || '';
      const langMatch = content.match(/^\[(.+?)\]\n/);
      if (langMatch) content = content.slice(langMatch[0].length); // correct slice by full match length
      const codeEsc = esc(content);
      el.innerHTML = `${meta}
        <div class="code-actions">
          <button class="btn copy" type="button">Copy</button>
          <span class="copy-done"></span>
        </div>
        <pre><code>${codeEsc}</code></pre>`;
      // Attach copy handler
      const copyBtn = el.querySelector('.btn.copy');
      const statusEl = el.querySelector('.copy-done');
      copyBtn?.addEventListener('click', ()=>{
        const codeEl = el.querySelector('pre > code');
        const text = codeEl ? codeEl.textContent : content;
        copyToClipboard(text, statusEl);
      });
    } else if (m.type === 'image') {
      body = `<img class="msg" src="${m.image_url}" alt="image message">`;
      el.innerHTML = meta + body;
    }

    messagesEl.appendChild(el);
  }

  // ---------- Countdown ----------
  function startCountdown(){
    if (!expiryEl || !expiresAt) return;
    if (countdownTimer) clearInterval(countdownTimer);
    function tick(){
      const now = Date.now();
      const rem = new Date(expiresAt).getTime() - now;
      expiryEl.textContent = `Closes in ${formatRemaining(rem)}`;
      if (rem <= 0) {
        expiryEl.textContent = 'Expired';
        disableForms();
        clearInterval(countdownTimer);
      }
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // ---------- Networking ----------
  async function fetchMessages(){
    if (polling) return;
    polling = true;
    try {
      const url = new URL(cfg.messagesUrl, window.location.origin);
      if (lastTimestamp) url.searchParams.set('since', lastTimestamp);
      const res = await fetch(url, {headers: {'X-Requested-With':'fetch'}});
      if (res.ok) {
        const data = await res.json();
        const arr = data.messages || [];
        if (arr.length) {
          arr.forEach(renderMessage);
          smoothScrollToBottom();
        }
        lastTimestamp = data.server_time;

        // countdown sync from server (requires api to return expires_at)
        if (data.expires_at) {
          expiresAt = data.expires_at;
          startCountdown();
        }
      }
    } catch(e) {
      // silent error to keep polling lightweight
    } finally {
      polling = false;
    }
  }

  async function submit(url, body, form, hintEl){
    setBusy(form, true, hintEl);
    try {
      const res = await fetch(url, { method: 'POST', body, headers: {'X-Requested-With':'fetch'} });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        alert('Error: ' + JSON.stringify(err.errors || err));
      } else {
        form.reset();
        await fetchMessages();
      }
    } catch(e) {
      alert('Network error');
    } finally {
      setBusy(form, false, hintEl);
    }
  }

  // ---------- Forms and Modes ----------
  const textForm = document.getElementById('textForm');
  const codeForm = document.getElementById('codeForm');
  const imageForm = document.getElementById('imageForm');

  const panels = Array.from(document.querySelectorAll('.mode-panel'));
  function setMode(mode){
    panels.forEach(p => p.style.display = (p.dataset.mode === mode) ? '' : 'none');
  }
  document.querySelectorAll('input[name="mode"]').forEach(r=>{
    r.addEventListener('change', ()=> setMode(r.value));
  });
  setMode('text');

  // Text
  textForm?.addEventListener('submit', e=>{
    e.preventDefault();
    const hint = document.getElementById('textHint');
    const body = new URLSearchParams(new FormData(textForm));
    submit(cfg.sendTextUrl, body, textForm, hint);
  });
  document.getElementById('openTxtPreview')?.addEventListener('click', ()=>{
    const fd = new FormData(textForm);
    const content = String(fd.get('content') || '');
    const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
  });

  // Code
  codeForm?.addEventListener('submit', e=>{
    e.preventDefault();
    const hint = document.getElementById('codeHint');
    const body = new URLSearchParams(new FormData(codeForm));
    submit(cfg.sendCodeUrl, body, codeForm, hint);
  });
  document.getElementById('downloadCodeBtn')?.addEventListener('click', ()=>{
    const fd = new FormData(codeForm);
    let content = String(fd.get('content') || '');
    const lang = String(fd.get('language') || '');
    if (lang) content = `[${lang}]\n` + content;
    const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (lang ? `code_${lang}` : 'code') + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  });

  // File: if .txt -> send as text; else image endpoint
  imageForm?.addEventListener('submit', async e=>{
    e.preventDefault();
    const hint = document.getElementById('imageHint');
    const fileInput = document.getElementById('fileInput');
    const file = fileInput?.files?.[0];
    if (!file) return alert('Choose a file first');

    if (file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain') {
      const nickname = imageForm.querySelector('input[name="nickname"]')?.value || '';
      const content = await file.text();
      const body = new URLSearchParams();
      if (nickname) body.set('nickname', nickname);
      body.set('content', content);
      submit(cfg.sendTextUrl, body, imageForm, hint);
      return;
    }

    const fd = new FormData(imageForm);
    submit(cfg.sendImageUrl, fd, imageForm, hint);
  });

  // ---------- Boot ----------
  fetchMessages();
  setInterval(fetchMessages, 3000);
})();
