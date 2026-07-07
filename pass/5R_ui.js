/* ===========================================================================
 * 3. 5R_ui.js : UI, Events, Init
 * (Update: 폰트 확대/축소를 전체에서 "선택한 텍스트만" 가능하도록 변경)
 * =========================================================================== */
{
  const S = window.SELTE;
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  const LEVEL_NAMES = ['Refuge', 'Root', 'Regular', 'Rule', 'Rush'];

  function bindClick(id, handler) {
      const el = typeof id === 'string' ? $(id) : id;
      if (el && handler) el.onclick = handler;
  }

  function toggleFocusMode() {
      const isFocus = document.body.classList.toggle('focus-mode');
      const btn = $('#btn-focus-mode');
      if (btn) {
          btn.classList.toggle('btn-focus-active', isFocus);
          btn.innerHTML = isFocus ? 
              '<i class="fas fa-compress"></i> <span class="btn-label">복귀</span>' : 
              '<i class="fas fa-expand"></i> <span class="btn-label">몰입</span>';
      }
      S.toast(isFocus ? '몰입 모드 활성화 (H로 해제)' : '몰입 모드 해제', 'info');
  }

  function setupMemo() {
    const btnOpen = $('#btn-memo');
    const btnClose = $('#btn-close-memo');
    const sidebar = $('#memo-sidebar');
    const textarea = $('#memo-textarea');
    const status = $('#memo-status');
    const btnCopy = $('#btn-copy-memo');
    const btnClear = $('#btn-clear-memo');

    if(!btnOpen || !sidebar) return; 

    bindClick(btnOpen, () => sidebar.classList.toggle('open'));
    bindClick(btnClose, () => sidebar.classList.remove('open'));

    const saved = localStorage.getItem('5R_checklist_memo');
    if (saved && textarea) textarea.value = saved;

    if(textarea) {
        textarea.oninput = () => {
            localStorage.setItem('5R_checklist_memo', textarea.value);
            if(status) {
                status.textContent = 'Saved';
                setTimeout(() => status.textContent = 'Ready', 1000);
            }
        };
    }

    bindClick(btnCopy, () => {
        if(textarea) {
            textarea.select();
            document.execCommand('copy');
            S.toast('메모 복사 완료', 'ok');
        }
    });
    bindClick(btnClear, () => {
        if(confirm('메모를 모두 지우시겠습니까?')) {
            if(textarea) textarea.value = '';
            localStorage.removeItem('5R_checklist_memo');
        }
    });
  }

  function setupTTS() {
    const btnTTS = $('#btn-tts');
    const panel = $('#tts-panel');
    const btnClose = $('#btn-close-tts');
    const btnPlay = $('#tts-play');
    const btnStop = $('#tts-stop');
    const checkLoop = $('#tts-loop');
    const statusText = $('#tts-status-text');
    const voiceSelect = $('#tts-voice-select'); 

    if(!btnTTS || !panel) return;

    let synth = window.speechSynthesis;
    let currentUtterance = null;
    let isPlaying = false;
    let voices = [];

    function loadVoices() {
        voices = synth.getVoices().filter(v => v.lang.includes('ko') || v.lang.includes('KR'));
        
        voiceSelect.innerHTML = '';
        if(voices.length === 0) {
            const op = document.createElement('option');
            op.text = "한국어 음성 없음";
            voiceSelect.appendChild(op);
            return;
        }

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.value = voice.name;
            if(voice.name.includes('Google') || voice.name.includes('Natural')) {
                option.selected = true;
            }
            voiceSelect.appendChild(option);
        });
    }

    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
    loadVoices(); 

    bindClick(btnTTS, () => {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        if(panel.style.display === 'flex') {
             statusText.textContent = "Ready to play";
             if(voices.length === 0) loadVoices(); 
        }
    });
    bindClick(btnClose, () => { stop(); panel.style.display = 'none'; });

    function extractContent() {
        const getPlain = (id) => {
            const raw = $(`#${id}`)?.value || '';
            const noTag = raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
            return S.htmlDecode(noTag).trim();
        };

        const topic = getPlain('topic'); const def = getPlain('definition');
        const mne = getPlain('mnemonic'); const note = getPlain('notes');
        
        let fullText = "";
        if(topic) fullText += `${topic}. \n`;
        if(def) fullText += `${def}. \n`;
        if(mne) fullText += `암기팁. ${mne}. \n`; 
        if(note) fullText += `노트. ${note}.`;
        return fullText.trim();
    }

    function speak() {
        if (synth.speaking) synth.cancel(); 
        const text = extractContent();
        if(!text) { statusText.textContent = "내용이 없습니다."; return; }

        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'ko-KR'; currentUtterance.rate = 1.0; 

        const selectedVoiceName = voiceSelect.value;
        const targetVoice = voices.find(v => v.name === selectedVoiceName);
        if(targetVoice) currentUtterance.voice = targetVoice;

        currentUtterance.onstart = () => {
            isPlaying = true; btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
            statusText.textContent = "Speaking...";
        };

        currentUtterance.onend = () => {
            isPlaying = false; btnPlay.innerHTML = '<i class="fas fa-play"></i>';
            statusText.textContent = "Done.";
            if (checkLoop.checked) { statusText.textContent = "Looping..."; setTimeout(() => speak(), 1000); }
        };

        currentUtterance.onerror = (e) => {
            if (e.error === 'interrupted' || e.error === 'canceled') {
                statusText.textContent = "Stopped."; isPlaying = false;
                btnPlay.innerHTML = '<i class="fas fa-play"></i>'; return;
            }
            isPlaying = false; btnPlay.innerHTML = '<i class="fas fa-play"></i>';
            statusText.textContent = "Error: " + e.error;
        };

        synth.speak(currentUtterance);
    }

    function stop() { synth.cancel(); }

    bindClick(btnPlay, () => {
        if(synth.speaking && !synth.paused) {
            synth.pause(); statusText.textContent = "Paused"; btnPlay.innerHTML = '<i class="fas fa-play"></i>';
        } else if(synth.paused) {
            synth.resume(); statusText.textContent = "Resumed"; btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
        } else speak();
    });
    bindClick(btnStop, stop);
  }

  function convertToWysiwyg(id){
    const ta = $(`#${id}`);
    if(!ta || ta.style.display==='none') return;
    if(ta.previousElementSibling && ta.previousElementSibling.classList.contains('wysiwyg-editor')) return;
    
    const div = document.createElement('div');
    div.className = 'wysiwyg-editor';
    div.contentEditable = true;
    div.spellcheck = false; 
    div.dataset.for = id; 
    div.style.fontSize = '18px';  // ✨ 기본 폰트 사이즈 확대
    div.style.lineHeight = '1.6'; // ✨ 줄간격 확보
    
    div.innerHTML = S.renderWithMark(ta.value);
    
    div.addEventListener('input', () => { 
        ta.value = div.innerHTML; 
        updateHiddenPreview(null); 
    });
    
    div.addEventListener('paste', (e) => {
        const items = (e.clipboardData || window.clipboardData).items;
        let hasImage = false;
        for(let i=0; i<items.length; i++) {
            if(items[i].type.indexOf('image') !== -1) { hasImage = true; break; }
        }
        if(!hasImage) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
        }
    });

    ta.style.display = 'none';
    ta.parentNode.insertBefore(div, ta);
  }

  function setEditorContent(id, htmlVal){
      const ta = $(`#${id}`);
      if(ta) ta.value = htmlVal;
      const div = ta?.previousElementSibling;
      if(div && div.classList.contains('wysiwyg-editor')) div.innerHTML = S.renderWithMark(htmlVal);
  }

  function installHotkeys() {
    document.addEventListener('keydown', (e) => {
      const key = (e.key || '').toLowerCase();
      const isCtrl = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const isShift = e.shiftKey;
      const activeEl = document.activeElement;

      if (activeEl && activeEl.isContentEditable) {
          // 1. 선택 영역만 줌인/줌아웃 (Ctrl + '+' / '-' / '=')
          if (isCtrl && !isAlt && (key === '+' || key === '=' || key === '-')) {
              e.preventDefault();
              const sel = window.getSelection();
              
              if (sel.rangeCount > 0 && !sel.isCollapsed) {
                  // 선택 영역의 시작 노드의 폰트 사이즈를 기준으로 확대/축소
                  const parentEl = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
                  let sizeStr = window.getComputedStyle(parentEl).fontSize;
                  let size = parseInt(sizeStr) || 18; // ✨ 기준 폰트 18px

                  if (key === '+' || key === '=') size = Math.min(size + 4, 80); // ✨ 최대 80px, 증가폭 +4
                  else if (key === '-') size = Math.max(size - 4, 10);           // ✨ 최소 10px, 감소폭 -4

                  // execCommand의 브라우저 표준 변환 트릭을 사용해 폰트 태그를 씌우고 리플레이스
                  document.execCommand('styleWithCSS', false, false);
                  document.execCommand('fontSize', false, "7");
                  
                  const markers = activeEl.querySelectorAll('font[size="7"], span[style*="xx-large"], span[style*="48px"]');
                  markers.forEach(el => {
                      const span = document.createElement('span');
                      span.style.fontSize = size + 'px';
                      span.innerHTML = el.innerHTML;
                      el.replaceWith(span);
                  });
              } else {
                  S.toast('확대/축소할 텍스트를 드래그하여 선택해주세요.', 'info');
              }
              return;
          }

          // 2. 서식 지우기 (Ctrl + Shift + X)
          if (isCtrl && isShift && key === 'x') {
              e.preventDefault();
              document.execCommand('removeFormat', false, null);
              document.execCommand('styleWithCSS', false, true);
              document.execCommand('hiliteColor', false, 'transparent');
              document.execCommand('foreColor', false, '#202124');
              return;
          }

          // 3. 취소선 (Ctrl + 0)
          if (isCtrl && !isAlt && !isShift && key === '0') {
              e.preventDefault();
              document.execCommand('strikeThrough');
              return;
          }

          // 4. 두음 강조 (Ctrl + Alt + M) - 남색 배경 + 흰색 텍스트
          if (isCtrl && isAlt && key === 'm') {
              e.preventDefault();
              document.execCommand('styleWithCSS', false, true);
              document.execCommand('hiliteColor', false, '#0d3a9e');
              document.execCommand('foreColor', false, '#ffffff');
              return;
          }

          // 5. 텍스트 컬러 (Ctrl + Alt + R/B/G)
          if (isCtrl && isAlt) {
              const map = { r:'#d93025', b:'#1a73e8', g:'#188038' }; 
              if (map[key]) {
                  e.preventDefault(); 
                  document.execCommand('styleWithCSS', false, true);
                  document.execCommand('foreColor', false, isShift ? '#202124' : map[key]);
                  return;
              }
          }

          // 6. 7가지 형광펜 (Ctrl + 1~7)
          if (isCtrl && !isAlt && !isShift && ['1','2','3','4','5','6','7'].includes(key)) {
              e.preventDefault();
              const hlMap = {
                  '1': '#ffedd5', '2': '#e0f2fe', '3': '#fef08a', '4': '#dcfce7',
                  '5': '#fce7f3', '6': '#e6d5c3', '7': '#e5e7eb'
              };
              document.execCommand('styleWithCSS', false, true);
              document.execCommand('hiliteColor', false, hlMap[key]);
              return;
          }
      }

      // 7. 문서 저장 / 생성 제어
      if (isCtrl && isAlt && key === 'n') { e.preventDefault(); clearInputs(); return; }
      if (isCtrl && (key === 's' || key === 'enter')) { e.preventDefault(); saveCurrent(); }
      
      // 8. 포커스 바깥에서의 글로벌 핫키
      if (!activeEl.isContentEditable && activeEl.tagName!=='INPUT' && activeEl.tagName!=='TEXTAREA') {
          if (key === 'h') { e.preventDefault(); toggleFocusMode(); }
          if (key === ' ') { e.preventDefault(); toggleCheck(); }
          if (key === 'arrowleft') { e.preventDefault(); navigateList(-1); }
          if (key === 'arrowright') { e.preventDefault(); navigateList(1); }
      }
    }, true);

    // Ctrl + 휠 줌 기본 동작 방지
    window.addEventListener('wheel', e => {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
    }, { passive: false });
  }

  function handleGlobalPaste(e) {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      let blob = null;

      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) { blob = items[i].getAsFile(); break; }
      }

      if (blob) {
          e.preventDefault();
          S.toast('이미지 붙여넣기 감지... 변환 중', 'info');

          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width; canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0);

                  canvas.toBlob((pngBlob) => {
                      const fileName = `clipboard_${Date.now()}.png`;
                      const file = new File([pngBlob], fileName, { type: 'image/png' });
                      addFileToSlot(file);
                  }, 'image/png');
              };
              img.src = event.target.result;
          };
          reader.readAsDataURL(blob);
      }
  }

  function addFileToSlot(file) {
      const cur = S.state.editingId ? S.state.items.find(x => x.id === S.state.editingId) : null;
      let added = false;

      for (let i = 1; i <= 5; i++) {
          const input = $(`#imgFile${i}`);
          const rmCheck = $(`#img${i}-remove`);
          if (!input) continue;

          const hasPending = input.files && input.files.length > 0;
          const hasDbImg = cur && cur[`img${i}Id`];
          const isRemoved = rmCheck && rmCheck.checked;

          if (!hasPending && (!hasDbImg || isRemoved)) {
              const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
              if (rmCheck) rmCheck.checked = false;
              renderImageSection(); S.toast(`이미지 ${i}번에 붙여넣기 완료`, 'ok');
              added = true; break;
          }
      }
      if (!added) S.toast('이미지 슬롯(5개)이 모두 꽉 찼습니다.', 'warn');
  }

  function renderList(){
    const listBody = $('#sidebar-list-body'); 
    if(!listBody) return;
    listBody.innerHTML = '';
    
    const items = getFilteredItems();
    $('#list-count').textContent = items.length;

    const filterSelect = $('#domain-filter');
    const topicMapSelect = $('#topic-map-domain-filter');
    if(filterSelect && S.state.domainFilter) filterSelect.value = S.state.domainFilter;
    if(topicMapSelect && S.state.domainFilter) topicMapSelect.value = S.state.domainFilter;

    const frag = document.createDocumentFragment();

    items.forEach(it => {
        const div = document.createElement('div');
        div.className = 'list-item';
        if(it.id === S.state.editingId) div.classList.add('active');
        if(it.checked) div.classList.add('checked');
        
        const pName = LEVEL_NAMES[it.priority||0] || 'Refuge';
        const seq = Number.isFinite(it.domainSeq) ? it.domainSeq : '';
        const topicTxt = (it.topic || '').replace(/<[^>]+>/g, '').trim() || '(No Topic)';
        
        div.innerHTML = `
            <div class="item-meta"><span>${S.esc(it.domain)} ${seq ? ' · '+seq : ''}</span><span class="badge-level badge-${it.priority||0}">${pName}</span></div>
            <div class="item-title">${S.esc(topicTxt)}</div>
        `;
        div.onclick = () => loadItem(it);
        frag.appendChild(div);
    });

    if(items.length === 0) listBody.innerHTML = '<div style="padding:20px; text-align:center; color:#ccc;">항목 없음</div>';
    else listBody.appendChild(frag);
  }

  function getFilteredItems(){
    const q = (S.state.search || $('#list-search-input')?.value || '').trim().toLowerCase();
    const df = S.state.domainFilter;
    const lvl = $('#level-filter')?.value;
    
    return S.state.items.filter(x=>{
      if(S.state.showUncheckedOnly && x.checked) return false;
      if(df && x.domain!==df) return false;
      if(lvl !== '' && lvl !== undefined && (x.priority||0) != lvl) return false;
      if(!q) return true;
      const plain = S.htmlDecode([x.domain, x.topic, x.definition, x.mnemonic, x.notes].join(' ')).replace(/<[^>]+>/g, ' '); 
      return plain.toLowerCase().includes(q);
    }).sort((a,b)=>{
      if(a.domain!==b.domain) return (a.domain||'').localeCompare(b.domain||'');
      return (a.domainSeq||0)-(b.domainSeq||0);
    });
  }

  function navigateList(delta){
      const items = getFilteredItems();
      if(items.length === 0) return;
      let curIdx = items.findIndex(x => x.id === S.state.editingId);
      if(curIdx === -1) loadItem(items[0]);
      else {
          let nextIdx = curIdx + delta;
          if(nextIdx < 0) nextIdx = 0; if(nextIdx >= items.length) nextIdx = items.length - 1;
          if(nextIdx !== curIdx) loadItem(items[nextIdx]);
      }
  }

  function updateHiddenPreview(itOverride){
      const it = itOverride || {
        domain: $('#domainInput')?.value || '', domainSeq: $('#domainSeqInput')?.value || '',
        topic: $('#topic')?.value || '', definition: $('#definition')?.value || '',
        mnemonic: $('#mnemonic')?.value || '', notes: $('#notes')?.value || '', priority: $('#priority')?.value || 0
      };

      $('#prev-domain-seq').textContent = `${it.domain} · ${it.domainSeq}`;
      const pName = LEVEL_NAMES[it.priority] || 'Refuge';
      $('#prev-priority').innerHTML = `<span class="badge-level badge-${it.priority}">${pName}</span>`;

      const setHtml = (id, val) => {
         const el = $(`#${id}`); 
         if(el) { 
             const htmlContent = itOverride ? S.renderWithMark(val) : val;
             el.innerHTML = htmlContent; 
             const plainText = (val || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
             if (!plainText && !(val || '').toLowerCase().includes('<img')) el.style.display = 'none';
             else el.style.display = 'block';
         }
      };

      setHtml('prev-topic', it.topic); setHtml('prev-definition', it.definition);
      setHtml('prev-mnemonic', it.mnemonic); setHtml('prev-notes', it.notes);

      (async ()=>{
          const cur = (S.state.editingId ? S.state.items.find(x=>x.id===S.state.editingId) : null) || itOverride;
          for(let i=1;i<=5;i++){
            const img=$(`#prev-img${i}`); if(!img) continue;
            img.style.display='none'; img.src='';
            const input = $(`#imgFile${i}`);
            if(input && input.files && input.files[0]) { img.src = URL.createObjectURL(input.files[0]); img.style.display='block'; }
            else if(cur && cur[`img${i}Id`]){ const url = await S.getImageDataURL(cur[`img${i}Id`]); if(url) { img.src = url; img.style.display='block'; } }
          }
      })();
  }

  async function loadItem(it){
    S.state.editingId = it.id;
    $('#domainInput').value = it.domain;
    $('#domainSeqInput').value = Number.isFinite(it.domainSeq) ? it.domainSeq : '';
    $('#priority').value = it.priority || 0;
    syncPrioUI(it.priority || 0);
    
    const checkBtn = $('#btn-check');
    if(checkBtn) {
        if(it.checked) { checkBtn.classList.add('btn-check-active'); checkBtn.innerHTML='<i class="fas fa-check"></i> 완료됨'; }
        else { checkBtn.classList.remove('btn-check-active'); checkBtn.innerHTML='<i class="fas fa-check"></i> 완료 체크'; }
    }

    ['topic','definition','mnemonic','notes'].forEach(k => setEditorContent(k, S.denormalizeForEdit(it[k])));

    for(let i=1;i<=5;i++){ const f=$(`#imgFile${i}`), rm=$(`#img${i}-remove`); if(f) f.value=''; if(rm) rm.checked=false; }
    
    $$('.list-item').forEach(el => el.classList.remove('active'));
    const activeEl = $(`.list-item[data-id="${it.id}"]`);
    if(activeEl) { activeEl.classList.add('active'); activeEl.scrollIntoView({ block: 'nearest' }); }

    renderImageSection(); updateHiddenPreview(it);
  }

  async function clearInputs(){
    S.state.editingId = null;
    $$('#editor-container input[type="text"], #editor-container input[type="number"]').forEach(el=>el.value='');
    $$('.wysiwyg-editor').forEach(el => el.innerHTML = '');
    $$('textarea').forEach(el=>el.value='');
    $('#priority').value='0'; syncPrioUI(0);
    
    const checkBtn = $('#btn-check');
    if(checkBtn) { checkBtn.classList.remove('btn-check-active'); checkBtn.innerHTML='<i class="fas fa-check"></i> 완료 체크'; }

    for(let i=1;i<=5;i++){ const f=$(`#imgFile${i}`), rm=$(`#img${i}-remove`); if(f) f.value=''; if(rm) rm.checked=false; }
    renderImageSection();
    $$('.list-item').forEach(el => el.classList.remove('active'));
    S.toast('새 항목 작성 대기', 'ok');
  }

  function renderImageSection() {
    const container = $('#image-display-area'); const addBtnContainer = $('#btn-add-image-container');
    if(!container) return; container.innerHTML = '';
    
    const cur = S.state.editingId ? S.state.items.find(x => x.id === S.state.editingId) : null;
    let filledCount = 0;

    for (let i = 1; i <= 5; i++) {
        const fileInput = $(`#imgFile${i}`); const removeCheck = $(`#img${i}-remove`);
        let hasImage = false;
        if (fileInput && fileInput.files && fileInput.files[0]) hasImage = true;
        else if (cur && cur[`img${i}Id`] && (!removeCheck || !removeCheck.checked)) hasImage = true;

        if (hasImage) {
            filledCount++;
            const div = document.createElement('div');
            div.className = 'img-list-item';
            div.innerHTML = `
                <div class="img-item-header">
                    <span><i class="far fa-image"></i> Image ${i}</span>
                    <button class="btn-delete-img" data-idx="${i}"><i class="fas fa-times"></i> 삭제</button>
                </div>
                <div class="img-viewer" id="img-viewer-${i}"><span style="color:#ccc; font-size:12px;">Loading...</span></div>
            `;
            container.appendChild(div);

            const delBtn = div.querySelector('.btn-delete-img');
            delBtn.onclick = () => { if(fileInput) fileInput.value = ''; if(removeCheck) removeCheck.checked = true; renderImageSection(); };

            const viewer = div.querySelector(`#img-viewer-${i}`);
            if (fileInput && fileInput.files[0]) {
                const r = new FileReader();
                r.onload = (e) => { viewer.innerHTML = `<img src="${e.target.result}" onclick="document.getElementById('modal-img').src=this.src; document.getElementById('img-modal').style.display='flex';">`; };
                r.readAsDataURL(fileInput.files[0]);
            } else if (cur && cur[`img${i}Id`]) {
                S.getImageDataURL(cur[`img${i}Id`]).then(url => { viewer.innerHTML = `<img src="${url}" onclick="document.getElementById('modal-img').src=this.src; document.getElementById('img-modal').style.display='flex';">`; });
            }
        }
    }

    if (filledCount >= 5) addBtnContainer.style.display = 'none';
    else {
        addBtnContainer.style.display = 'block';
        $('#btn-add-image').onclick = () => {
            for (let i = 1; i <= 5; i++) {
                const fileInput = $(`#imgFile${i}`); const removeCheck = $(`#img${i}-remove`);
                if (!(fileInput && fileInput.files.length > 0) && (!cur || !cur[`img${i}Id`] || (removeCheck && removeCheck.checked))) {
                    if(removeCheck) removeCheck.checked = false; 
                    fileInput.click(); fileInput.onchange = () => renderImageSection(); break;
                }
            }
        };
    }
  }

  function renderTopicMap(){
      const tb = $('#topic-map-table tbody'); if(!tb) return; tb.innerHTML = '';
      const d = $('#topic-map-domain-filter')?.value || S.state.domainFilter || '';
      const q = ($('#topic-map-search-input')?.value || '').toLowerCase();

      const list = S.state.items.filter(x => (!d || x.domain === d) && (!q || (x.topic+x.domain).toLowerCase().includes(q))).sort((a,b) => (a.domainSeq||0) - (b.domainSeq||0));

      list.forEach(it => {
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid #f1f3f4'; tr.dataset.id = it.id;
          tr.innerHTML = `
            <td style="padding:8px;"><input type="number" step="any" class="tm-seq-input" value="${it.domainSeq}" data-id="${it.id}"></td>
            <td style="padding:8px; color:#666; font-size:12px;">${it.domain}</td>
            <td style="padding:8px; font-weight:500;">${S.denormalizeForEdit(it.topic)}</td>
            <td style="text-align:center; padding:8px; white-space:nowrap;">
                <button class="tm-btn tm-btn-del" onclick="SELTE.deleteFromMap('${it.id}')">삭제</button>
                <button class="tm-btn tm-btn-clear" onclick="SELTE.clearFormatFromMap('${it.id}')">초기화</button>
                <button class="tm-btn tm-btn-load" onclick="SELTE.loadById('${it.id}')">로드</button>
            </td>`;
          tb.appendChild(tr);
      });

      if (d) { 
          const nextSeq = S.nextDomainSeq(d); 
          const trNew = document.createElement('tr'); trNew.className = 'tm-new-row';
          trNew.innerHTML = `
            <td style="padding:8px; text-align:center;"><span style="font-weight:bold; color:#1a73e8;">${nextSeq}</span></td>
            <td style="padding:8px; text-align:center; font-weight:bold; color:#1a73e8;">${d}</td>
            <td style="padding:8px;"><input type="text" id="tm-new-topic" placeholder="새 토픽 입력 후 엔터..." autocomplete="off"></td>
            <td style="text-align:center; padding:8px;"><button class="btn btn-primary" id="btn-tm-add" style="height:30px; font-size:12px;">추가</button></td>
          `;
          tb.appendChild(trNew);

          setTimeout(() => {
              const input = $('#tm-new-topic'); const btn = $('#btn-tm-add');
              const addAction = async () => {
                  const topic = input.value.trim(); if(!topic) return S.toast('토픽명을 입력하세요', 'warn');
                  const currentDomain = $('#topic-map-domain-filter').value;
                  const newItem = { id: S.uid(), domain: d, domainSeq: nextSeq, topic: S.normalizeForStore(topic), definition: '', mnemonic: '', notes: '', priority: 0, checked: false, ts: S.nowISO() };
                  await S.putItem(newItem); await refreshAll();
                  if($('#topic-map-domain-filter')) $('#topic-map-domain-filter').value = currentDomain;
                  renderTopicMap(); setTimeout(() => $('#tm-new-topic')?.focus(), 100);
              };
              if(btn) btn.onclick = addAction;
              if(input) { input.focus(); input.onkeydown = (e) => { if(e.key === 'Enter') addAction(); }; }
          }, 0);
      } else {
          const trInfo = document.createElement('tr');
          trInfo.innerHTML = `<td colspan="4" style="padding:15px; text-align:center; color:#888; background:#f8f9fa;">도메인을 선택하면 신규 항목을 추가할 수 있습니다.</td>`;
          tb.appendChild(trInfo);
      }
  }

  async function saveBatchTopicMap() {
      const inputs = $$('.tm-seq-input'); if (inputs.length === 0) return;
      const currentDomain = $('#topic-map-domain-filter')?.value;
      let changeCount = 0;
      for (const input of inputs) {
          const id = input.dataset.id; const newSeq = parseFloat(input.value);
          if (!id || isNaN(newSeq)) continue;
          const item = S.state.items.find(x => x.id === id);
          if (item && item.domainSeq !== newSeq) { item.domainSeq = newSeq; await S.putItem(item); changeCount++; }
      }
      if (changeCount > 0) {
          await refreshAll();
          if($('#topic-map-domain-filter') && currentDomain) $('#topic-map-domain-filter').value = currentDomain;
          renderTopicMap(); S.toast(`${changeCount}건 저장 완료`, 'ok');
      } else S.toast('변경사항이 없습니다.', 'info');
  }

  async function deleteFromMap(id) {
      if(confirm('정말 삭제하시겠습니까?')) {
          const currentDomain = $('#topic-map-domain-filter')?.value;
          await S.deleteItem(id); await refreshAll();
          if($('#topic-map-domain-filter') && currentDomain) $('#topic-map-domain-filter').value = currentDomain;
          renderTopicMap(); S.toast('삭제되었습니다.', 'ok');
      }
  }

  async function clearFormatFromMap(id) {
      if(confirm('이 항목의 서식(강조, 색상 등)을 모두 지우시겠습니까?')) {
          const item = S.state.items.find(x => x.id === id);
          if(!item) return;

          const currentDomain = $('#topic-map-domain-filter')?.value;
          
          const strip = (val) => {
              let s = String(val || '');
              s = S.stripStoredMarkTags(s);
              s = s.replace(/<\/?(span|b|strong|i|em|u|strike|s|font|mark|red|blue|green|del|dueum|hl[1-7]|f\d+)\b[^>]*>/gi, '');
              s = s.replace(/&lt;\/?(span|b|strong|i|em|u|strike|s|font|mark|red|blue|green|del|dueum|hl[1-7]|f\d+)\b[^>]*&gt;/gi, '');
              return s;
          };

          item.topic = strip(item.topic);
          item.definition = strip(item.definition);
          item.mnemonic = strip(item.mnemonic);
          item.notes = strip(item.notes);

          await S.putItem(item); 
          await refreshAll();
          
          if($('#topic-map-domain-filter') && currentDomain) $('#topic-map-domain-filter').value = currentDomain;
          renderTopicMap(); 

          if (S.state.editingId === id) loadItem(S.state.items.find(x => x.id === id));
          
          S.toast('서식이 초기화되었습니다.', 'ok');
      }
  }

  async function renameCurrentDomain() {
      const currentDomain = $('#topic-map-domain-filter') ? $('#topic-map-domain-filter').value : '';
      if (!currentDomain) return alert('이름을 변경할 도메인을 먼저 선택해주세요.');
      const newDomain = prompt(`'${currentDomain}' 도메인의 새 이름을 입력하세요:`, currentDomain);
      if (!newDomain || newDomain.trim() === '' || newDomain === currentDomain) return;

      const itemsToRename = S.state.items.filter(x => x.domain === currentDomain);
      if (itemsToRename.length === 0) return alert('변경할 항목이 없습니다.');

      let count = 0;
      for (const it of itemsToRename) { it.domain = newDomain.trim(); await S.putItem(it); count++; }
      await refreshAll();
      
      if ($('#topic-map-domain-filter')) $('#topic-map-domain-filter').value = newDomain.trim();
      if($('#domain-filter') && $('#domain-filter').value === currentDomain) { $('#domain-filter').value = newDomain.trim(); S.state.domainFilter = newDomain.trim(); }
      
      renderTopicMap(); renderList(); S.toast(`도메인명 일괄 변경 완료 (${count}건)`, 'ok');
  }

  async function clearFormatDomain() {
      const currentDomain = $('#topic-map-domain-filter') ? $('#topic-map-domain-filter').value : '';
      if (!currentDomain) return alert('초기화할 도메인을 먼저 선택해주세요.');
      const itemsToClear = S.state.items.filter(x => x.domain === currentDomain);
      if (itemsToClear.length === 0) return alert('초기화할 항목이 없습니다.');
      if (!confirm(`⚠️ 정말 '${currentDomain}' 도메인에 포함된 모든 항목(${itemsToClear.length}개)의 서식을 일괄 초기화하시겠습니까?`)) return;

      const strip = (val) => {
          let s = String(val || '');
          s = S.stripStoredMarkTags(s);
          s = s.replace(/<\/?(span|b|strong|i|em|u|strike|s|font|mark|red|blue|green|del|dueum|hl[1-7]|f\d+)\b[^>]*>/gi, '');
          s = s.replace(/&lt;\/?(span|b|strong|i|em|u|strike|s|font|mark|red|blue|green|del|dueum|hl[1-7]|f\d+)\b[^>]*&gt;/gi, '');
          return s;
      };

      let count = 0;
      for (const it of itemsToClear) {
          it.topic = strip(it.topic);
          it.definition = strip(it.definition);
          it.mnemonic = strip(it.mnemonic);
          it.notes = strip(it.notes);
          await S.putItem(it);
          count++;
      }
      await refreshAll();
      
      if ($('#topic-map-domain-filter')) $('#topic-map-domain-filter').value = currentDomain;
      
      renderTopicMap(); 
      if (S.state.editingId && itemsToClear.find(x => x.id === S.state.editingId)) {
          loadItem(S.state.items.find(x => x.id === S.state.editingId));
      }
      S.toast(`'${currentDomain}' 도메인 서식 일괄 초기화 완료 (${count}건)`, 'ok');
  }

  async function deleteCurrentDomain() {
      const currentDomain = $('#topic-map-domain-filter') ? $('#topic-map-domain-filter').value : '';
      if (!currentDomain) return alert('삭제할 도메인을 먼저 선택해주세요.');
      const itemsToDelete = S.state.items.filter(x => x.domain === currentDomain);
      if (itemsToDelete.length === 0) return alert('삭제할 항목이 없습니다.');
      if (!confirm(`⚠️ 정말 '${currentDomain}' 도메인과 포함된 모든 항목(${itemsToDelete.length}개)을 일괄 삭제하시겠습니까?\n이 작업은 되돌릴 수 재활용 불가합니다.`)) return;

      for (const it of itemsToDelete) await S.deleteItem(it.id);
      await refreshAll();
      
      if ($('#topic-map-domain-filter')) $('#topic-map-domain-filter').value = '';
      if($('#domain-filter') && $('#domain-filter').value === currentDomain) { $('#domain-filter').value = ''; S.state.domainFilter = ''; }
      
      renderTopicMap(); renderList(); S.toast(`'${currentDomain}' 도메인 삭제 완료 (${itemsToDelete.length}건)`, 'ok');
  }

  let isSaving=false;
  async function saveCurrent(){
    if(isSaving) return; 
    const d = $('#domainInput').value.trim(); const t = $('#topic').value.trim();
    if(!d || !t) return alert('Domain, Topic 필수');
    
    isSaving=true;
    try{
      const read = (id) => S.normalizeForStore($(`#${id}`)?.value || '');
      const seqVal = parseFloat($('#domainSeqInput').value);
      
      const item = {
        domain: d, domainSeq: (Number.isFinite(seqVal) && seqVal > 0) ? seqVal : S.nextDomainSeq(d),
        topic: read('topic'), definition: read('definition'), mnemonic: read('mnemonic'), notes: read('notes'),
        priority: parseInt($('#priority').value)||0, ts: S.nowISO(), checked: false
      };

      if(S.state.editingId){ item.id = S.state.editingId; const cur = S.state.items.find(x=>x.id===S.state.editingId); if(cur) item.checked = cur.checked; } 
      else { item.id = S.uid(); S.state.editingId = item.id; }

      const cur = S.state.items.find(x=>x.id===item.id); 
      for(let i=1;i<=5;i++){
        const f=$(`#imgFile${i}`); const rm=$(`#img${i}-remove`);
        if(f && f.files[0]) item[`img${i}Id`] = await S.putImageBlob(f.files[0]);
        else if(rm && rm.checked) item[`img${i}Id`] = '';
        else if(cur && cur[`img${i}Id`]) item[`img${i}Id`] = cur[`img${i}Id`];
        else item[`img${i}Id`] = '';
      }

      await S.putItem(item); await refreshAll(); loadItem(item); S.toast('저장 완료', 'ok'); 
    } catch(e){ console.error(e); S.toast('저장 실패', 'bad'); } finally { isSaving=false; }
  }

  async function toggleCheck() {
      if(!S.state.editingId) return S.toast('항목을 먼저 선택하세요.', 'warn');
      const cur = S.state.items.find(x => x.id === S.state.editingId); if(!cur) return;
      cur.checked = !cur.checked; 
      const btn = $('#btn-check');
      if(btn) {
          if(cur.checked) { btn.classList.add('btn-check-active'); btn.innerHTML = '<i class="fas fa-check"></i> 완료됨'; }
          else { btn.classList.remove('btn-check-active'); btn.innerHTML = '<i class="fas fa-check"></i> 완료 체크'; }
      }
      try {
          await S.putItem(cur); await refreshAll(); 
          const activeEl = $(`.list-item[data-id="${cur.id}"]`);
          if(activeEl) { activeEl.classList.add('active'); if(cur.checked) activeEl.classList.add('checked'); else activeEl.classList.remove('checked'); }
      } catch(e) { console.error(e); S.toast('상태 저장 실패', 'bad'); }
  }

  function syncPrioUI(val){ $$('.prio-btn').forEach(b => b.classList.toggle('is-active', b.dataset.prio==val)); $('#priority').value = val; }

  async function refreshAll(){
    S.state.items = await S.getAllItems();
    const domains = [...new Set(S.state.items.map(x=>x.domain))].sort();
    const opts = '<option value="">전체 도메인</option>' + domains.map(d=>`<option>${d}</option>`).join('');
    
    const df = $('#domain-filter'); if(df) { const v=df.value; df.innerHTML=opts; df.value=v; }
    const tmDf = $('#topic-map-domain-filter'); if(tmDf) tmDf.innerHTML=opts;
    renderList();
  }

  function __replaceMarkInPlace(root){
    root.querySelectorAll('mark').forEach(m=>{
      const span=document.createElement('span');
      span.style.background='#fce8b2'; span.style.padding='0 .2em';
      while(m.firstChild) span.appendChild(m.firstChild);
      m.replaceWith(span);
    });
  }
  async function __capturePreviewCanvas(){
    const el=$('#preview'); const clone = el.cloneNode(true);
    clone.style.width = '750px'; clone.style.position = 'absolute'; clone.style.left='-9999px'; clone.style.top='0';
    document.body.appendChild(clone); __replaceMarkInPlace(clone);
    try{ return await html2canvas(clone, { scale: 2, backgroundColor: '#ffffff' }); } finally { document.body.removeChild(clone); }
  }
  function __addCanvasToPdf(pdf, canvas){
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 190; const pageHeight = 295; 
    const imgHeight = canvas.height * imgWidth / canvas.width;
    let heightLeft = imgHeight, position = 10;
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight); heightLeft -= pageHeight;
    while (heightLeft >= 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight); heightLeft -= pageHeight; }
  }

  async function exportPreviewAsPDF(){
      S.toast('PDF 생성 중...', 'warn'); const canvas = await __capturePreviewCanvas();
      const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
      __addCanvasToPdf(pdf, canvas);
      let topicName = $('#topic')?.value || 'Item'; topicName = topicName.replace(/<[^>]+>/g, '').trim().replace(/[\\/:*?"<>|]/g, '_');
      if(!topicName) topicName = 'Item';
      pdf.save(`5R_${topicName}.pdf`); S.toast('PDF 완료', 'ok');
  }

  async function exportDomainAsPDF(){
      const d = S.state.domainFilter; if(!d) return alert('도메인을 선택하세요.');
      const items = getFilteredItems(); if(!items.length) return alert('항목 없음');
      const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
      S.toast(`전체 PDF 생성 중 (${items.length}건)`, 'warn');
      const oldId = S.state.editingId;
      for(let i=0; i<items.length; i++){
          await loadItem(items[i]); await new Promise(r=>setTimeout(r, 80));
          const canvas = await __capturePreviewCanvas(); if(i>0) pdf.addPage(); __addCanvasToPdf(pdf, canvas);
      }
      pdf.save(`5R_${d}.pdf`); S.toast('완료', 'ok');
      if(oldId) { const org = S.state.items.find(x=>x.id===oldId); if(org) loadItem(org); }
  }

  (async ()=>{
    try {
        await S.openDB();
        
        convertToWysiwyg('topic'); convertToWysiwyg('definition'); 
        convertToWysiwyg('mnemonic'); convertToWysiwyg('notes');
        installHotkeys(); setupMemo(); setupTTS(); 

        bindClick('#btn-new', clearInputs); bindClick('#btn-save', saveCurrent);
        bindClick('#btn-check', toggleCheck); bindClick('#btn-focus-mode', toggleFocusMode);
        bindClick('#btn-del', async () => { if(S.state.editingId && confirm('삭제?')) { await S.deleteItem(S.state.editingId); await refreshAll(); clearInputs(); } });

        const df = $('#domain-filter'); if(df) df.onchange = (e) => { S.state.domainFilter=e.target.value; renderList(); };
        const sf = $('#list-search-input'); if(sf) sf.onkeyup = (e) => { S.state.search=e.target.value; renderList(); };
        const lf = $('#level-filter'); if(lf) lf.onchange = () => renderList();
        const uc = $('#toggle-unchecked-preview'); if(uc) uc.onchange = (e) => { S.state.showUncheckedOnly=e.target.checked; renderList(); };

        bindClick('#btn-export-xlsx', () => S.exportToExcel());
        const fImp = $('#fileImport'); if(fImp) fImp.onchange = (e)=>S.importFromExcel(e.target.files[0], refreshAll);

        bindClick('#btn-export-json', () => S.exportJSON());
        const jsonImp = $('#jsonImport'); if(jsonImp) jsonImp.onchange = (e) => S.importJSON(e.target.files[0], refreshAll);

        bindClick('#btn-preview-pdf', exportPreviewAsPDF); bindClick('#btn-batch-pdf', exportDomainAsPDF);
        bindClick('#btn-export-anki', ()=>S.exportAnki(getFilteredItems(), S.state.domainFilter));
        bindClick('#btn-export-brainscape', ()=>S.exportBrainscape(getFilteredItems(), S.state.domainFilter));

        const getPopupFeatures = () => `left=0,top=0,width=${screen.width},height=${screen.height},scrollbars=yes,resizable=yes`;
        bindClick('#btn-image', () => window.open('5Rchecklist_image.html', 'checklist_image', getPopupFeatures()));
        bindClick('#btn-topic-search', () => window.open('5Rchecklist_topic.html','checklist_topic_search', getPopupFeatures()));
        bindClick('#btn-pdfstd-note', () => window.open('5Rchecklist_pdf.html','checklist_pdfstd_note', getPopupFeatures()));
        bindClick('#btn-videostd-note', () => window.open('5Rchecklist_video.html','checklist_videostd_note', getPopupFeatures()));

        bindClick('#btn-topic-map-open', ()=>{ 
            $('#topic-map-modal').style.display='flex'; 
            if($('#topic-map-domain-filter') && S.state.domainFilter) $('#topic-map-domain-filter').value = S.state.domainFilter;
            renderTopicMap(); 
        });
        bindClick('#btn-topic-map-close', ()=>{ $('#topic-map-modal').style.display='none'; });
        
        if($('#topic-map-domain-filter')) $('#topic-map-domain-filter').onchange = () => renderTopicMap();
        if($('#topic-map-search-input')) $('#topic-map-search-input').onkeyup = () => renderTopicMap();
        
        bindClick('#btn-topic-map-save-seq', saveBatchTopicMap);
        bindClick('#btn-topic-map-rename-domain', renameCurrentDomain);
        bindClick('#btn-topic-map-clear-domain', clearFormatDomain);
        bindClick('#btn-topic-map-delete-domain', deleteCurrentDomain);

        $('.close-modal').onclick = () => $('#img-modal').style.display='none';
        $('#img-modal').onclick = (e) => { if(e.target.id==='img-modal') $('#img-modal').style.display='none'; };
        $$('.prio-btn').forEach(b => b.onclick = () => syncPrioUI(b.dataset.prio));

        window.SELTE.loadById = (id) => { const it = S.state.items.find(x=>x.id===id); if(it) { loadItem(it); $('#topic-map-modal').style.display='none'; } };
        window.SELTE.deleteFromMap = deleteFromMap;
        window.SELTE.clearFormatFromMap = clearFormatFromMap;
        
        document.addEventListener('paste', handleGlobalPaste);

        await refreshAll(); clearInputs();
    } catch(e) { console.error(e); alert('Init Error: '+e.message); }
  })();
}