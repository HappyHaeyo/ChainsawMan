(function(){
  const $ = id => document.getElementById(id);

  // Elements
  const els = {
    tabs: document.querySelectorAll('.tab'),
    pages: { chat: $('page_chat'), editor: $('page_editor'), gallery: $('page_gallery') },
    // chat
    chat: $('chat'), userInput: $('userInput'),
    send: $('send'), stop: $('stop'),
    miniApiKey: $('miniApiKey'), miniModel: $('miniModel'),
    miniSave: $('miniSave'), miniState: $('miniState'),
    // editor
    systemPrompt: $('systemPrompt'), worldInfo: $('worldInfo'),
    charName: $('charName'), charPrompt: $('charPrompt'),
    lockSystem: $('lockSystem'), lockWorld: $('lockWorld'), lockChar: $('lockChar'),
    emotionMap: $('emotionMap'), saveLore: $('saveLore'),
    // gallery
    assetsBase: $('assetsBase'), manifestPath: $('manifestPath'),
    reload: $('reload'), gallery: $('gallery'),
    // misc
    newChat: $('newChat'), exportChat: $('exportChat'),
    importChat: $('importChat'), importChatFile: $('importChatFile'),
  };

  // State
  const state = {
    settings: load('settings', { apiKey:'', model:'gemini-2.5-pro' }),
    lore: load('lore', {
      systemPrompt:'응답 첫 줄에 <emotion:neutral> 태그 1개. 감정 키: happy/sad/angry/neutral. 한국어로 간결히 답하기.',
      worldInfo:'', charName:'레제',
      charPrompt:'레제 말투: 담담+장난기. 과한 애교 금지. 금지: 현실 개인정보 요구.',
      lockSystem:true, lockWorld:true, lockChar:true,
      emotionMap:{ happy:'reze_happy', sad:'reze_sad', angry:'reze_angry', neutral:'reze_neutral' }
    }),
    messages: load('messages', [])
  };

  // Storage helpers
  function save(k,v){ localStorage.setItem('reze_'+k, JSON.stringify(v)); }
  function load(k,def){ try{ return JSON.parse(localStorage.getItem('reze_'+k)) ?? def }catch{ return def } }

  // Markdown-lite
  function md(s=''){
    s = s.replace(/[&<>]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]));
    s = s.replace(/```([\s\S]*?)```/g,(m,code)=>`<pre><code>${code}</code></pre>`);
    s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g,'<em>$1</em>');
    s = s.replace(/`([^`]+)`/g,'<code>$1</code>');
    s = s.replace(/\n/g,'<br>');
    return s;
  }

  // --- Tabs
  els.tabs.forEach(t => t.addEventListener('click', () => {
    els.tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    Object.values(els.pages).forEach(p => p.classList.remove('active'));
    els.pages[t.dataset.tab].classList.add('active');
    location.hash = t.dataset.tab;
  }));
  if(location.hash){
    const k = location.hash.replace('#','');
    const tab = [...els.tabs].find(x => x.dataset.tab === k);
    if(tab) tab.click();
  }

  // --- Sync UI
  function sync(){
    const s = state.settings, L = state.lore;
    els.miniApiKey.value = s.apiKey || '';
    els.miniModel.value  = s.model  || 'gemini-2.5-pro';
    ['systemPrompt','worldInfo','charName','charPrompt'].forEach(k => els[k].value = L[k] ?? '');
    els.lockSystem.checked = L.lockSystem; els.lockWorld.checked = L.lockWorld; els.lockChar.checked = L.lockChar;
    els.emotionMap.value = JSON.stringify(L.emotionMap || {}, null, 0);
    renderChat(); renderGallery();
  }
  sync();

  // --- Mini connection
  els.miniSave.onclick = () => {
    state.settings.apiKey = els.miniApiKey.value.trim();
    state.settings.model  = els.miniModel.value.trim() || 'gemini-2.5-pro';
    save('settings', state.settings);
    els.miniState.textContent = '저장됨';
    setTimeout(()=> els.miniState.textContent='', 1200);
  };

  // --- Editor save
  els.saveLore.onclick = () => {
    state.lore.systemPrompt = els.systemPrompt.value;
    state.lore.worldInfo    = els.worldInfo.value;
    state.lore.charName     = els.charName.value || '레제';
    state.lore.charPrompt   = els.charPrompt.value;
    state.lore.lockSystem   = els.lockSystem.checked;
    state.lore.lockWorld    = els.lockWorld.checked;
    state.lore.lockChar     = els.lockChar.checked;
    try {
      state.lore.emotionMap = JSON.parse(els.emotionMap.value || '{}');
    } catch(e){ alert('감정 매핑 JSON 오류: '+e.message); return; }
    save('lore', state.lore);
    alert('저장됨');
    renderGallery();
  };

  // --- Chat
  function extractEmotion(text=''){ const m=text.match(/<emotion:([a-zA-Z_\-]+)>/); return m? m[1].toLowerCase(): null; }
  function assetUrlForKey(key){
    const base = (els.assetsBase?.value || 'assets/reze').replace(/\/$/,'');
    const exts = ['.jpg','.jpeg','.png','.gif','.webp'];
    return `${base}/${key}${exts[0]}`;
  }
  function renderChat(){
    els.chat.innerHTML='';
    state.messages.forEach(m=>{
      const node = document.createElement('div');
      node.className = 'msg '+m.role;
      node.innerHTML = `
        <div class="role">${m.role==='user'?'U':'A'}</div>
        <div class="bubble">${md(m.content||'')}</div>`;
      const emo = (m.meta && m.meta.emotion) || extractEmotion(m.content);
      if(m.role==='assistant' && emo){
        const key = (state.lore.emotionMap||{})[emo] || `reze_${emo}`;
        const url = assetUrlForKey(key);
        if(url){
          const img = document.createElement('img');
          img.src = url; img.alt = key;
          img.style = 'display:block;margin:4px 0;max-width:260px;border-radius:12px';
          node.querySelector('.bubble').prepend(img);
        }
      }
      els.chat.appendChild(node);
    });
    els.chat.scrollTop = els.chat.scrollHeight;
  }
  function addMsg(role,content,meta={}){ state.messages.push({role,content,meta}); save('messages',state.messages); renderChat(); }

  // Send via Gemini
  let controller=null;
  async function send(){
    const content = els.userInput.value.trim();
    if(!content) return;
    els.userInput.value=''; addMsg('user',content);

    const L = state.lore;
    const sysPieces=[];
    if(L.lockSystem && L.systemPrompt) sysPieces.push(L.systemPrompt);
    if(L.lockWorld  && L.worldInfo)    sysPieces.push('### World Info\n'+L.worldInfo);
    if(L.lockChar   && L.charPrompt)   sysPieces.push(`### Character (${L.charName||'레제'})\n`+L.charPrompt);
    const systemInstruction = sysPieces.join('\n\n');

    const history = state.messages.map(m=>({ role: m.role==='assistant'?'model':'user', parts:[{text:m.content}] }));
    const payload = {
      model: state.settings.model || 'gemini-2.5-pro',
      generationConfig: { maxOutputTokens:1024, temperature:0.7, topP:1 },
      contents: history,
      systemInstruction: systemInstruction? { role:'system', parts:[{text:systemInstruction}] }: undefined
    };

    addMsg('assistant',''); const idx = state.messages.length-1;
    try{
      const key = state.settings.apiKey || els.miniApiKey.value.trim();
      if(!key) throw new Error('API Key 누락');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(payload.model)}:streamGenerateContent?key=${encodeURIComponent(key)}`;
      controller = new AbortController();
      const resp = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), signal: controller.signal });
      if(!resp.ok) throw new Error('HTTP '+resp.status+' '+resp.statusText);
      const reader = resp.body.getReader(); const decoder = new TextDecoder(); let buf='';
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        buf+=decoder.decode(value,{stream:true});
        const lines = buf.split('\n'); buf = lines.pop();
        for(const line of lines){
          const s=line.trim(); if(!s.startsWith('data:')) continue;
          const data=s.slice(5).trim(); if(!data || data==='[DONE]') continue;
          try{
            const j=JSON.parse(data); const parts=j.candidates?.[0]?.content?.parts||[];
            for(const p of parts){ if(p.text){ state.messages[idx].content += p.text; } }
            renderChat();
          }catch{}
        }
      }
      save('messages',state.messages);
    }catch(err){
      state.messages[idx].content='**오류:** '+err.message; renderChat();
    }finally{ controller=null; }
  }
  els.send.onclick = send;
  els.userInput.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }});
  els.stop.onclick = ()=>{ if(controller) controller.abort(); };

  // Chat mgmt
  els.newChat.onclick = ()=>{ if(confirm('현재 대화를 지우고 새로 시작할까요?')){ state.messages=[]; save('messages',state.messages); renderChat(); } };
  els.exportChat.onclick = ()=>{ const blob=new Blob([JSON.stringify({messages:state.messages, meta:{date:new Date().toISOString(), model:state.settings.model}},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='reze_chat.json'; a.click(); };
  els.importChat.onclick = ()=> els.importChatFile.click();
  els.importChatFile.onchange = e => {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader(); r.onload=()=>{ try{
      const j=JSON.parse(r.result);
      if(Array.isArray(j.messages)){ state.messages=j.messages; save('messages',state.messages); renderChat(); }
    }catch(err){ alert('JSON 파싱 실패: '+err.message) } };
    r.readAsText(file);
  };

  // --- Gallery
  els.reload.onclick = renderGallery;
  async function renderGallery(){
    els.gallery.innerHTML='';
    const base = (els.assetsBase.value || 'assets/reze').replace(/\/$/,'');
    const manifest = els.manifestPath.value.trim();
    let files = [];

    // 1) manifest.json 읽기
    try{
      const resp = await fetch(manifest,{cache:'no-store'});
      if(resp.ok){
        files = await resp.json();
        if(!Array.isArray(files)) files = [];
      }
    }catch(_){}

    // 2) manifest 없으면 emotionMap 키로 추정 경로
    if(files.length===0){
      const keys = Object.values(state.lore.emotionMap||{});
      const exts = ['.jpg','.jpeg','.png','.gif','.webp'];
      keys.forEach(k => exts.forEach(ext => files.push(`${base}/${k}${ext}`)));
    }

    // 3) 정규화(문자열 or {src,tag})
    const normalize = f => (typeof f === 'string')
      ? { src: (f.startsWith('http')||f.startsWith('/')) ? f : `${base}/${f}`, tag: tagFromPath(f) }
      : { src: (f.src && (f.src.startsWith('http')||f.src.startsWith('/'))) ? f.src : `${base}/${f.src}`, tag: f.tag || tagFromPath(f.src) };

    const seen = new Set();
    files.map(normalize).forEach(({src,tag})=>{
      if(seen.has(src)) return; seen.add(src);
      const item = document.createElement('div'); item.className = 'item';
      const img  = document.createElement('img'); img.src = src; img.alt = tag || src;
      const cap  = document.createElement('div'); cap.className = 'caption'; cap.textContent = tag || src;
      item.appendChild(img); item.appendChild(cap);
      item.addEventListener('click', ()=> openLightbox(src, tag||src));
      els.gallery.appendChild(item);
    });
  }

  function tagFromPath(p){
    try{
      const fn = (typeof p==='string'?p:'').split('/').pop().split('?')[0];
      return fn.replace(/\.[a-z0-9]+$/i,'').replace(/^reze[_-]?/i,'').replace(/[_-]+/g,' ').trim();
    }catch{ return p; }
  }

  // --- Lightbox
  function openLightbox(src, title){
    $('lightboxImg').src = src;
    $('lightboxTitle').textContent = title || '';
    $('lightbox').classList.add('active');
  }
  window.openLightbox = openLightbox;
  $('lightboxClose').onclick = ()=> $('lightbox').classList.remove('active');
  $('lightbox').addEventListener('click', e=>{
    if(e.target && e.target.id === 'lightbox') $('lightbox').classList.remove('active');
  });

  // --- BGM (autoplay with fallback)
  const DEFAULT_BGM = 'assets/bgm/track.mp3';
  const bgm = load('bgm', { url: DEFAULT_BGM, loop:true, vol:0.4 });
  if (!bgm.url) { bgm.url = DEFAULT_BGM; save('bgm', bgm); }
  const audio = $('bgmAudio');
  const unmuteBtn = $('bgmUnmute');

  function syncBgmUI(){
    $('bgmUrl').value = bgm.url;
    $('bgmLoop').checked = !!bgm.loop;
    $('bgmVol').value = bgm.vol ?? 0.4;
    audio.loop = !!bgm.loop;
    audio.volume = bgm.vol ?? 0.4;
    audio.src = bgm.url;
  }
  syncBgmUI();

  async function tryAutoplay(){
    try{
      await audio.play();
      if (unmuteBtn) unmuteBtn.style.display = 'none';
    }catch{
      if (unmuteBtn) unmuteBtn.style.display = 'inline-flex';
    }
  }
  document.addEventListener('DOMContentLoaded', tryAutoplay);
  ['pointerdown','keydown'].forEach(ev=>{
    window.addEventListener(ev, tryAutoplay, { once:true, capture:true });
  });
  if (unmuteBtn){
    unmuteBtn.onclick = async () => { await tryAutoplay(); };
  }

  // Optional controls
  $('bgmVol').oninput = (e)=>{
    audio.volume = Number(e.target.value)||0.4;
    bgm.vol = audio.volume; save('bgm', bgm);
  };
  $('bgmLoop').onchange = (e)=>{
    audio.loop = e.target.checked; bgm.loop = audio.loop; save('bgm', bgm);
  };
  $('bgmPlay').onclick = ()=>{
    if(audio.paused){ audio.play().catch(()=>{}); } else { audio.pause(); }
  };

})();
