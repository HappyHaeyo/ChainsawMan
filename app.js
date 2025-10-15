(function(){
  const $ = id => document.getElementById(id);

  // Elements
  const els = {
    tabs: document.querySelectorAll('.tab'),
    pages: {
      chat: $('page_chat'),
      editor: $('page_editor'),
      gallery: $('page_gallery')
    },
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
  // Restore tab on reload
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
  };

  // --- Chat
  function extractEmotion(text=''){ const m=text.match(/<emotion:([a-zA-Z_\-]+)>/); return m? m[1].toLowerCase(): null; }
  function assetUrlForKey(key){
    const base = (els.assetsBase?.value || 'assets/reze').replace(/\/$/,'');
    const exts = ['.jpg','.jpeg','.png','.gif','.webp'];
    return exts.map(ext => `${base}/${key}${ext}`)[0]; // 단순 반환(브라우저가 로드 실패시 무시)
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

  let controller=null;
  async function send(){
    const content = els.userInput.value.trim();
    if(!content) return;
    els.userInput.value=''; addMsg('user',content);

    // system injection
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
    try{
      const resp = await fetch(manifest,{cache:'no-store'});
      if(resp.ok){
        files = await resp.json(); if(!Array.isArray(files)) files=[];
        files = files.map(f => f.startsWith('http')||f.startsWith('/') ? f : `${base}/${f}`);
      }
    }catch(_){}
    if(files.length===0){
      const keys = Object.values(state.lore.emotionMap||{});
      const exts = ['.jpg','.jpeg','.png','.gif','.webp'];
      keys.forEach(k => exts.forEach(ext => files.push(`${base}/${k}${ext}`)));
    }
    const seen=new Set();
    files.filter(Boolean).forEach(p => {
      if(seen.has(p)) return; seen.add(p);
      const img=document.createElement('img'); img.src=p; img.alt=p;
      els.gallery.appendChild(img);
    });
  }
})();
