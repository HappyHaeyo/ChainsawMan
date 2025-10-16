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
    miniSave: $('miniSave'), miniTest: $('miniTest'), miniState: $('miniState'),
    // editor
    systemPrompt: $('systemPrompt'), worldInfo: $('worldInfo'),
    charName: $('charName'), charPrompt: $('charPrompt'),
    lockSystem: $('lockSystem'), lockWorld: $('lockWorld'), lockChar: $('lockChar'),
    emotionMap: $('emotionMap'), saveLore: $('saveLore'),
    userAvatar: $('userAvatar'), assistantAvatar: $('assistantAvatar'), saveAvatars: $('saveAvatars'),
    greetingText: $('greetingText'), greetingOn: $('greetingOn'), saveGreeting: $('saveGreeting'),
    // gallery
    assetsBase: $('assetsBase'), manifestPath: $('manifestPath'),
    reload: $('reload'), gallery: $('gallery'),
    // misc
    newChat: $('newChat'), exportChat: $('exportChat'),
    importChat: $('importChat'), importChatFile: $('importChatFile'),
  };

  // State
  const state = {
    settings: load('settings', {
      apiKey:'', model:'gemini-2.5-pro',
      userAvatar:'assets/reze/profile/user.png',
      assistantAvatar:'assets/reze/profile/reze.png'
    }),
    lore: load('lore', {
      // === 완화된 시스템 프롬프트 ===
      systemPrompt: `역할: 너는 체인소맨의 ‘레제’ 캐릭터다.
가능하면 항상 아래 3줄 형식으로 답한다. 불가하거나 안전 정책에 걸리면 비슷한 형식으로 간단히 대체한다.

형식:
1) 첫 줄: <emotion:키>
2) 둘째 줄: "레제의 대사" — 따옴표 포함, 1–2문장, 한국어
3) 셋째 줄: 레제의 행동·표정·상황 서술 — 1–2문장, 한국어

규칙:
- emotion 키: neutral, listening, angry, happy, laughing, cold_smile, blush, cafe_work, slack_off, unpleasant, sad 중 하나.
- 모호하면 가장 가까운 감정을 선택한다(예: 조용히 경청 ⇒ listening, 즐거운 장난 ⇒ laughing, 차가운 미소 ⇒ cold_smile).
- 과장은 피하고 자연스러운 구어체로 간결하게 말한다.
- 현실 개인정보 요구, 과도한 민감/유해, 현실 행위 강요는 피한다. 이런 경우엔 짧은 농담·비유 등으로 가볍게 회피한다.
- 안전 정책 때문에 정상 답변이 어렵더라도 빈 응답은 하지 않는다. <emotion:neutral>로 3줄을 출력하고 간단한 대안을 제시한다.
- 한 턴 응답은 최대 3줄.`,

      worldInfo:'', charName:'레제',
      charPrompt:'레제 말투: 담담+장난기. 과한 애교 금지. 금지: 현실 개인정보 요구.',
      lockSystem:true, lockWorld:true, lockChar:true,
      emotionMap:{
        neutral:'reze_neutral.png',
        listening:'reze_listening.gif',
        angry:'reze_angry.gif',
        happy:'reze_happy.gif',
        laughing:'reze_laughing.gif',
        cold_smile:'reze_cold_smile.png',
        blush:'reze_blush.png',
        cafe_work:'reze_cafe_work.png',
        slack_off:'reze_slack_off.png',
        unpleasant:'reze_unpleasant.png',
        sad:'reze_unpleasant.png'
      },
      greetingText:'<emotion:neutral> 안녕! 난 레제야.',
      greetingOn:true
    }),
    messages: load('messages', [])
  };

  // Storage
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

  // Tabs
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

  // Sync UI
  function sync(){
    const s = state.settings, L = state.lore;
    els.miniApiKey.value = s.apiKey || '';
    els.miniModel.value  = s.model  || 'gemini-2.5-pro';
    ['systemPrompt','worldInfo','charName','charPrompt'].forEach(k => els[k].value = L[k] ?? '');
    els.lockSystem.checked = L.lockSystem; els.lockWorld.checked = L.lockWorld; els.lockChar.checked = L.lockChar;
    els.emotionMap.value = JSON.stringify(L.emotionMap || {}, null, 0);
    els.userAvatar.value = s.userAvatar || '';
    els.assistantAvatar.value = s.assistantAvatar || '';
    els.greetingText.value = L.greetingText || '';
    els.greetingOn.checked = !!L.greetingOn;

    // 기본 아바타 보정
    state.settings.userAvatar = state.settings.userAvatar || 'assets/reze/profile/user.png';
    state.settings.assistantAvatar = state.settings.assistantAvatar || 'assets/reze/profile/reze.png';

    renderChat(); renderGallery();
  }
  sync();

  // Mini connection
  els.miniSave.onclick = () => {
    state.settings.apiKey = els.miniApiKey.value.trim();
    state.settings.model  = (els.miniModel.value.trim() || 'gemini-2.5-pro').replace(/^models\//,'');
    save('settings', state.settings);
    els.miniState.textContent = '저장됨';
    setTimeout(()=> els.miniState.textContent='', 1200);
  };
  els.miniTest.onclick = async () => {
    const key = (els.miniApiKey.value || '').trim();
    if(!key){ els.miniState.textContent='API Key 필요'; return; }
    els.miniState.textContent = '테스트 중...';
    try{
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const r = await fetch(url);
      if(!r.ok){
        const t = await r.text();
        els.miniState.textContent = '실패: ' + (t || r.statusText);
      }else{
        els.miniState.textContent = '연결 OK';
      }
    }catch(e){
      els.miniState.textContent = '에러: ' + e.message;
    }
    setTimeout(()=> els.miniState.textContent='', 4000);
  };

  // Editor saves
  els.saveLore.onclick = () => {
    state.lore.systemPrompt = els.systemPrompt.value;
    state.lore.worldInfo    = els.worldInfo.value;
    state.lore.charName     = els.charName.value || '레제';
    state.lore.charPrompt   = els.charPrompt.value;
    state.lore.lockSystem   = els.lockSystem.checked;
    state.lore.lockWorld    = els.lockWorld.checked;
    state.lore.lockChar     = els.lockChar.checked;
    try { state.lore.emotionMap = JSON.parse(els.emotionMap.value || '{}'); }
    catch(e){ alert('감정 매핑 JSON 오류: '+e.message); return; }
    save('lore', state.lore);
    alert('저장됨'); renderGallery();
  };
  els.saveAvatars.onclick = ()=>{
    state.settings.userAvatar = els.userAvatar.value.trim() || 'assets/reze/profile/user.png';
    state.settings.assistantAvatar = els.assistantAvatar.value.trim() || 'assets/reze/profile/reze.png';
    save('settings', state.settings);
    alert('아바타 저장됨'); renderChat();
  };
  els.saveGreeting.onclick = ()=>{
    state.lore.greetingText = els.greetingText.value;
    state.lore.greetingOn = els.greetingOn.checked;
    save('lore', state.lore);
    alert('그리팅 저장됨');
  };

  // Chat helpers
  function extractEmotion(text=''){
    const m = text.match(/<emotion:([a-zA-Z_\-]+)>/);
    return m ? m[1].toLowerCase() : null;
  }

  // 텍스트 기반 감정 추론 (neutral/미기재 시 대체)
  function inferEmotionFromText(text=''){
    const t = (text||'').toLowerCase();
    if (/[ㅋ]{2,}|ㅎㅎ|하하|농담|장난|웃/.test(t)) return 'laughing';
    if (/(좋아|멋지|다행|기뻐|만족|잘됐)/.test(t)) return 'happy';
    if (/(응|음|알았|그래|들어줄|고마워|확인)/.test(t)) return 'listening';
    if (/(화나|분노|열받|짜증|왜 이래|싫어)/.test(t)) return 'angry';
    if (/(비웃|씁쓸|쿨하게|차갑)/.test(t)) return 'cold_smile';
    if (/(부끄|민망|얼굴이 붉|쑥스)/.test(t)) return 'blush';
    if (/(불편|곤란|애매|에휴)/.test(t)) return 'unpleasant';
    if (/(슬프|아쉬|속상|우울|미안)/.test(t)) return 'sad';
    if (/(작업|코딩|정리|카페|노트북|일하)/.test(t)) return 'cafe_work';
    if (/(놀자|빈둥|게으|쉬자|땡땡)/.test(t)) return 'slack_off';
    return null;
  }

  function roleHtml(role){
    const av = role==='user' ? (state.settings.userAvatar||'') : (state.settings.assistantAvatar||'');
    return av ? `<img src="${av}" alt="${role}" onerror="this.style.display='none'">` : (role==='user'?'U':'A');
  }

  // 확장자 지원: 매핑 값에 확장자가 있으면 그대로, 없으면 .jpg
  function assetUrlForKey(key){
    const base = (els.assetsBase?.value || 'assets/reze').replace(/\/$/,'');
    if (!key) return '';
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(key)) return `${base}/${key}`;
    return `${base}/${key}.jpg`;
  }

  function renderChat(){
    els.chat.innerHTML='';
    state.messages.forEach(m=>{
      const node = document.createElement('div');
      node.className = 'msg '+m.role;
      node.innerHTML = `
        <div class="role">${roleHtml(m.role)}</div>
        <div class="bubble">${m.meta && m.meta.typing
          ? '<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>'
          : md(m.content||'')}</div>`;
      const bubbleEl = node.querySelector('.bubble');

      if(m.role==='assistant'){
        let emo = (m.meta && m.meta.emotion) || extractEmotion(m.content);
        if (!emo || emo === 'neutral') {
          const inferred = inferEmotionFromText(m.content);
          if (inferred) emo = inferred;
        }
        if (emo){
          const raw = (state.lore.emotionMap||{})[emo] || `reze_${emo}`;
          const url = assetUrlForKey(raw);
          if(url){
            const img = document.createElement('img');
            img.src = url; img.alt = raw;
            img.style = 'display:block;margin:4px 0;max-width:260px;border-radius:12px';
            img.onerror = () => { img.style.display = 'none'; };
            bubbleEl.prepend(img);
          }
        }
      }

      els.chat.appendChild(node);
    });
    els.chat.scrollTop = els.chat.scrollHeight;
  }
  function addMsg(role,content,meta={}){ state.messages.push({role,content,meta}); save('messages',state.messages); renderChat(); }

  // ─────────────────────────────────────────────────────────────
  //  Gemini 호출부 (스트림 + 논스트림 폴백, 모델 문자열 정규화, SSE 헤더)
  // ─────────────────────────────────────────────────────────────
  let controller=null;

  const SAFETY_FALLBACK =
`<emotion:neutral>
"미안, 이건 그대로 답하기 어려워."
잠깐 미소 지으며 선을 지키자고 손짓하고, 가볍게 다른 화제로 돌린다.`;

  function buildSystemInstruction(){
    const L = state.lore;
    const sysPieces=[];
    if(L.lockSystem && L.systemPrompt) sysPieces.push(L.systemPrompt);
    if(L.lockWorld  && L.worldInfo)    sysPieces.push('### World Info\n'+L.worldInfo);
    if(L.lockChar   && L.charPrompt)   sysPieces.push(`### Character (${L.charName||'레제'})\n`+L.charPrompt);
    return sysPieces.join('\n\n');
  }

  function buildHistory(){
    return (state.messages||[])
      .filter(m => m.content && typeof m.content === 'string')
      .map(m => ({ role: (m.role === 'assistant' ? 'model' : 'user'), parts: [{ text: m.content }] }));
  }

  function normalizeModel(m){ return (m || 'gemini-2.5-pro').trim().replace(/^models\//,''); }

  async function sendNonStream(model, key, payload){
    model = normalizeModel(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const finish = j.candidates?.[0]?.finishReason || '';
    return { text, finish };
  }

  async function send(){
    const content = els.userInput.value.trim();
    if(!content) return;

    // 사용자 메시지 먼저 push
    els.userInput.value='';
    addMsg('user',content);

    const systemInstruction = buildSystemInstruction();
    const history = buildHistory();

    const payload = {
      generationConfig: { maxOutputTokens:1024, temperature:0.7, topP:1 },
      contents: history,
      ...(systemInstruction ? { systemInstruction: { role:'system', parts:[{text:systemInstruction}] } } : {})
    };

    // 타이핑 버블 출력
    addMsg('assistant','', {typing:true});
    const idx = state.messages.length-1;
    renderChat();

    let gotAny = false;
    try{
      const key = (state.settings.apiKey || els.miniApiKey.value).trim();
      if(!key) throw new Error('API Key 누락');
      const model = normalizeModel(state.settings.model || els.miniModel.value || 'gemini-2.5-pro');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(key)}`;
      controller = new AbortController();

      const resp = await fetch(url, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Accept':'text/event-stream'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if(!resp.ok){
        let detail=''; try{ detail = await resp.text(); }catch(_){}
        throw new Error(`HTTP ${resp.status} ${resp.statusText} ${detail}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf='';

      while(true){
        const {done,value}=await reader.read();
        if(done) break;
        buf += decoder.decode(value,{stream:true});

        const lines = buf.split('\n');
        buf = lines.pop();

        for(const line of lines){
          const s = line.trim();
          if(!s.startsWith('data:')) continue;
          const data = s.slice(5).trim();
          if(!data || data === '[DONE]') continue;

          try{
            const j = JSON.parse(data);

            const finish = j.candidates?.[0]?.finishReason;
            if (finish === 'SAFETY') {
              state.messages[idx].meta = {};
              state.messages[idx].content = SAFETY_FALLBACK;
              gotAny = true; renderChat(); continue;
            }

            const parts = j.candidates?.[0]?.content?.parts || [];
            for(const p of parts){
              if(p.text){
                if(!gotAny){ gotAny=true; state.messages[idx].meta = {}; state.messages[idx].content=''; }
                state.messages[idx].content += p.text;
              }
            }
            renderChat();
          }catch{
            // 조각 파싱 실패는 무시
          }
        }
      }

      if(!gotAny){
        try{
          const { text, finish } = await sendNonStream(model, key, payload);
          state.messages[idx].meta = {};
          state.messages[idx].content = (finish==='SAFETY')
            ? SAFETY_FALLBACK
            : (text || SAFETY_FALLBACK);
          renderChat();
        }catch(e2){
          state.messages[idx].meta = {};
          state.messages[idx].content = SAFETY_FALLBACK;
          renderChat();
        }
      }

      save('messages',state.messages);
    }catch(err){
      state.messages[idx].meta={};
      state.messages[idx].content=SAFETY_FALLBACK;
      renderChat();
    }finally{
      controller=null;
    }
  }

  els.send.onclick = send;
  els.userInput.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }});
  els.stop.onclick = ()=>{ if(controller) controller.abort(); };

  // Chat mgmt + greeting
  els.newChat.onclick = ()=>{
    if(!confirm('현재 대화를 지우고 새로 시작할까요?')) return;
    state.messages=[]; save('messages',state.messages);
    if(state.lore.greetingOn && state.lore.greetingText){
      state.messages.push({role:'assistant', content: state.lore.greetingText});
      save('messages', state.messages);
    }
    renderChat();
  };
  els.exportChat.onclick = ()=>{
    const blob=new Blob([JSON.stringify({messages:state.messages, meta:{date:new Date().toISOString(), model:state.settings.model}},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='reze_chat.json'; a.click();
  };
  els.importChat.onclick = ()=> els.importChatFile.click();
  els.importChatFile.onchange = e => {
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader(); r.onload=()=>{ try{
      const j=JSON.parse(r.result);
      if(Array.isArray(j.messages)){ state.messages=j.messages; save('messages',state.messages); renderChat(); }
    }catch(err){ alert('JSON 파싱 실패: '+err.message) } };
    r.readAsText(file);
  };

  // Gallery
  els.reload.onclick = renderGallery;
  async function renderGallery(){
    els.gallery.innerHTML='';
    const base = (els.assetsBase.value || 'assets/reze').replace(/\/$/,'');
    const manifest = els.manifestPath.value.trim();
    let files = [];

    try{
      const resp = await fetch(manifest,{cache:'no-store'});
      if(resp.ok){
        files = await resp.json();
        if(!Array.isArray(files)) files = [];
      }
    }catch(_){}

    if(files.length===0){
      const keys = Object.values(state.lore.emotionMap||{});
      const exts = ['.png','.jpg','.jpeg','.gif','.webp'];
      keys.forEach(k => {
        if (/\.(png|jpg|jpeg|gif|webp)$/i.test(k)) files.push(`${base}/${k}`);
        else exts.forEach(ext => files.push(`${base}/${k}${ext}`));
      });
    }

    const normalize = f => (typeof f === 'string')
      ? { src: (f.startsWith('http')||f.startsWith('/')) ? f : `${base}/${f.replace(new RegExp(`^${base}/`),'')}`, tag: tagFromPath(f) }
      : { src: (f.src && (f.src.startsWith('http')||f.src.startsWith('/'))) ? f.src : `${base}/${(f.src||'').replace(new RegExp(`^${base}/`),'')}`, tag: f.tag || tagFromPath(f.src) };

    const seen = new Set();
    files.map(normalize).forEach(({src,tag})=>{
      if(seen.has(src)) return; seen.add(src);
      const item = document.createElement('div'); item.className = 'item';
      const img  = document.createElement('img'); img.src = src; img.alt = tag || src;
      img.onerror = () => { img.style.display = 'none'; };
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

  // Lightbox
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

  // BGM (autoplay with fallback)
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
  if (unmuteBtn){ unmuteBtn.onclick = async () => { await tryAutoplay(); }; }

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

  // 초기 그리팅(대화가 비어있으면)
  if((state.messages||[]).length===0 && state.lore.greetingOn && state.lore.greetingText){
    state.messages.push({role:'assistant', content: state.lore.greetingText});
    save('messages', state.messages);
    renderChat();
  }
})();
