/* ===========================================================================
 * 1. 5R_core.js : Data, State, Utility
 * (Update: 부분 폰트 확대/축소용 f태그 파싱 추가)
 * =========================================================================== */
{
  window.SELTE = window.SELTE || {};

  const DB_NAME='5RChecklistDB';
  const DB_VER=1;
  let db=null;

  // === State ===
  const state = {
    items: [], editingId: null, showUncheckedOnly: false,
    search: '', domainFilter: '', cursorIdx: -1,
    topicMapDomain: '', topicMapSearch: '',
    __dbg: { logs: [], lastSheetImagesCount: 0 }
  };

  // === IndexedDB ===
  function openDB(){
    return new Promise((res,rej)=>{
      const rq=indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded=(e)=>{
        const d=e.target.result;
        if(d.objectStoreNames.contains('items')) d.deleteObjectStore('items');
        if(d.objectStoreNames.contains('images')) d.deleteObjectStore('images');
        d.createObjectStore('items',{keyPath:'id'});
        d.createObjectStore('images',{keyPath:'id'});
      };
      rq.onsuccess=()=>{ db=rq.result; res(db); };
      rq.onerror=()=>rej(rq.error);
    });
  }
  function tx(store,mode='readonly'){
    if(!db) throw new Error('DB not opened');
    return db.transaction(store,mode).objectStore(store);
  }
  function putItem(item){
    return new Promise((res,rej)=>{
      const req=tx('items','readwrite').put(item);
      req.onsuccess=()=>res(true); req.onerror=()=>rej(req.error);
    });
  }
  function deleteItem(id){
    return new Promise((res,rej)=>{
      const req=tx('items','readwrite').delete(id);
      req.onsuccess=()=>res(true); req.onerror=()=>rej(req.error);
    });
  }
  function getAllItems(){
    return new Promise((res,rej)=>{
      const req=tx('items').getAll();
      req.onsuccess=()=>res(req.result||[]); req.onerror=()=>rej(req.error);
    });
  }

  // === Image Utils ===
  function putImageBlob(blob){
    if(!blob) return Promise.resolve('');
    const id='IMG_'+Math.random().toString(36).slice(2);
    return new Promise((res,rej)=>{
      const req=tx('images','readwrite').add({id, blob});
      req.onsuccess=()=>res(id); req.onerror=()=>rej(req.error);
    });
  }
  function putImageFromDataURL(dataURL){
    if(!dataURL) return Promise.resolve('');
    return fetch(dataURL).then(r=>r.blob()).then(b=>putImageBlob(b));
  }
  function getImageDataURL(id){
    if(!id) return Promise.resolve('');
    return new Promise((res, rej)=>{
      const req = tx('images').get(id);
      req.onsuccess = () => {
        const rec = req.result;
        if(!rec){ res(''); return; }
        res(URL.createObjectURL(rec.blob));
      };
      req.onerror = () => rej(req.error);
    });
  }

  // === Helpers ===
  const uid=()=>('S'+Math.random().toString(36).slice(2,8).toUpperCase());
  const nowISO=()=>new Date().toISOString();
  const escMap={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'};
  const esc=(s)=>String(s??'').replace(/[&<>"']/g,ch=>escMap[ch]);
  const escapeRegExp=(str)=>str.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const htmlDecode=(s)=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");

  function nextDomainSeq(domain){
    const d=(domain||'').trim();
    const maxSeq=state.items.filter(it=>(it.domain||'').trim()===d)
      .reduce((acc,it)=>Math.max(acc, Number.isFinite(it.domainSeq)?it.domainSeq:0),0);
    if (Math.abs(maxSeq - Math.floor(maxSeq)) < 1e-6) return maxSeq + 1.0;
    else return maxSeq + 0.0001;
  }

  // === Logic: HTML Normalization ===
  const ALLOWED_INLINE_TAGS=['mark','red','blue','green','del','u','dueum','hl1','hl2','hl3','hl4','hl5','hl6','hl7','f\\d+'];

  function standardToCustomHTML(src=''){
    let s = String(src);

    // 1. Dueum (Ctrl+Alt+M)
    s = s.replace(/<\s*span\b[^>]*style="[^"]*background-color:\s*(?:rgb\(\s*13,\s*58,\s*158\s*\)|#0d3a9e)[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '<dueum>$1</dueum>');

    // 2. 형광펜 (<mark>)
    s = s.replace(/<\s*span\b[^>]*style="[^"]*background-color:\s*(?:rgb\(\s*255,\s*229,\s*143\s*\)|#ffe58f|yellow)[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '<mark>$1</mark>');

    // 3. New Highlights 1~7 (Ctrl + 1~7)
    const hlMap = [
      { tag: 'hl1', hex: '#ffedd5', rgb: 'rgb(255, 237, 213)' },
      { tag: 'hl2', hex: '#e0f2fe', rgb: 'rgb(224, 242, 254)' },
      { tag: 'hl3', hex: '#fef08a', rgb: 'rgb(254, 240, 138)' },
      { tag: 'hl4', hex: '#dcfce7', rgb: 'rgb(220, 252, 231)' },
      { tag: 'hl5', hex: '#fce7f3', rgb: 'rgb(252, 231, 243)' },
      { tag: 'hl6', hex: '#e6d5c3', rgb: 'rgb(230, 213, 195)' },
      { tag: 'hl7', hex: '#e5e7eb', rgb: 'rgb(229, 231, 235)' }
    ];
    hlMap.forEach(h => {
        const rgbRegexStr = h.rgb.replace(/\(/g, '\\(\\s*').replace(/\)/g, '\\s*\\)').replace(/,\s*/g, '\\s*,\\s*');
        const re = new RegExp(`<\\s*span\\b[^>]*style="[^"]*background-color:\\s*(?:${rgbRegexStr}|${h.hex})[^"]*"[^>]*>([\\s\\S]*?)<\\s*\\/\\s*span\\s*>`, 'gi');
        s = s.replace(re, `<${h.tag}>$1</${h.tag}>`);
    });

    // 4. 글자색 (<red/blue/green>)
    s = s.replace(/<\s*span\b[^>]*style="[^"]*color:\s*(?:rgb\(\s*229,\s*57,\s*53\s*\)|#e53935)[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '<red>$1</red>');
    s = s.replace(/<\s*span\b[^>]*style="[^"]*color:\s*(?:rgb\(\s*30,\s*136,\s*229\s*\)|#1e88e5)[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '<blue>$1</blue>');
    s = s.replace(/<\s*span\b[^>]*style="[^"]*color:\s*(?:rgb\(\s*67,\s*160,\s*71\s*\)|#43a047)[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '<green>$1</green>');

    // 5. 부분 선택 폰트 크기 (<f숫자>)
    s = s.replace(/<\s*span\b[^>]*style="[^"]*font-size:\s*(\d+)px[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '<f$1>$2</f$1>');

    // 6. Cleanup utility spans
    s = s.replace(/<\s*span\b[^>]*style="[^"]*color:\s*(?:rgb\(\s*255,\s*255,\s*255\s*\)|#ffffff)[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '$1');
    s = s.replace(/<\s*span\b[^>]*style="[^"]*color:\s*(?:rgb\(\s*32,\s*33,\s*36\s*\)|#202124)[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '$1');
    s = s.replace(/<\s*span\b[^>]*style="[^"]*background-color:\s*(?:transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\))[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, '$1');

    // 7. 기타 태그 매핑
    s = s.replace(/<\s*strike\b[^>]*>([\s\S]*?)<\s*\/\s*strike\s*>/gi, '<del>$1</del>')
         .replace(/<\s*s\b[^>]*>([\s\S]*?)<\s*\/\s*s\s*>/gi, '<del>$1</del>')
         .replace(/<\s*b\b[^>]*>([\s\S]*?)<\s*\/\s*b\s*>/gi, '<mark>$1</mark>')
         .replace(/<\s*strong\b[^>]*>([\s\S]*?)<\s*\/\s*strong\s*>/gi, '<mark>$1</mark>');

    // 8. Strip empty styling spans
    s = s.replace(/<\s*span\s*>\s*([\s\S]*?)\s*<\s*\/\s*span\s*>/gi, '$1');

    return s;
  }

  function customToStandardHTML(src=''){
    let s = String(src);
    s = s.replace(/<\s*mark\s*>/gi, '<span style="background-color:#ffe58f; padding:0 2px; border-radius:2px;">').replace(/<\s*\/\s*mark\s*>/gi, '</span>');
    s = s.replace(/<\s*dueum\s*>/gi, '<span style="background-color:#0d3a9e; color:#ffffff; font-weight:bold; padding:1px 4px; border-radius:3px;">').replace(/<\s*\/\s*dueum\s*>/gi, '</span>');
    
    s = s.replace(/<\s*hl1\s*>/gi, '<span style="background-color:#ffedd5;">').replace(/<\s*\/\s*hl1\s*>/gi, '</span>');
    s = s.replace(/<\s*hl2\s*>/gi, '<span style="background-color:#e0f2fe;">').replace(/<\s*\/\s*hl2\s*>/gi, '</span>');
    s = s.replace(/<\s*hl3\s*>/gi, '<span style="background-color:#fef08a;">').replace(/<\s*\/\s*hl3\s*>/gi, '</span>');
    s = s.replace(/<\s*hl4\s*>/gi, '<span style="background-color:#dcfce7;">').replace(/<\s*\/\s*hl4\s*>/gi, '</span>');
    s = s.replace(/<\s*hl5\s*>/gi, '<span style="background-color:#fce7f3;">').replace(/<\s*\/\s*hl5\s*>/gi, '</span>');
    s = s.replace(/<\s*hl6\s*>/gi, '<span style="background-color:#e6d5c3;">').replace(/<\s*\/\s*hl6\s*>/gi, '</span>');
    s = s.replace(/<\s*hl7\s*>/gi, '<span style="background-color:#e5e7eb;">').replace(/<\s*\/\s*hl7\s*>/gi, '</span>');

    s = s.replace(/<\s*red\s*>/gi, '<span style="color:#e53935">').replace(/<\s*\/\s*red\s*>/gi, '</span>');
    s = s.replace(/<\s*blue\s*>/gi, '<span style="color:#1e88e5">').replace(/<\s*\/\s*blue\s*>/gi, '</span>');
    s = s.replace(/<\s*green\s*>/gi, '<span style="color:#43a047">').replace(/<\s*\/\s*green\s*>/gi, '</span>');

    // 폰트 크기 복원
    s = s.replace(/<\s*f(\d+)\s*>/gi, '<span style="font-size:$1px;">').replace(/<\s*\/\s*f\d+\s*>/gi, '</span>');
    return s;
  }

  function cleanBoundaryUnderscores(html=''){
    let s = String(html);
    ALLOWED_INLINE_TAGS.forEach(t => {
      s = s.replace(new RegExp(`<\\s*(${t})\\s*>\\s*_+`, 'gi'), `<$1>`)
           .replace(new RegExp(`_+\\s*<\\s*\\/\\s*(${t})\\s*>`, 'gi'), `</$1>`);
    });
    return s;
  }

  function normalizeForStore(s=''){
    let h = standardToCustomHTML(String(s));
    const keep = [
        /<\s*mark\s*>/gi, /<\s*\/\s*mark\s*>/gi,
        /<\s*u\s*>/gi, /<\s*\/\s*u\s*>/gi,
        /<\s*del\s*>/gi, /<\s*\/\s*del\s*>/gi,
        /<\s*red\s*>/gi, /<\s*\/\s*red\s*>/gi,
        /<\s*blue\s*>/gi, /<\s*\/\s*blue\s*>/gi,
        /<\s*green\s*>/gi, /<\s*\/\s*green\s*>/gi,
        /<\s*dueum\s*>/gi, /<\s*\/\s*dueum\s*>/gi,
        /<\s*hl1\s*>/gi, /<\s*\/\s*hl1\s*>/gi,
        /<\s*hl2\s*>/gi, /<\s*\/\s*hl2\s*>/gi,
        /<\s*hl3\s*>/gi, /<\s*\/\s*hl3\s*>/gi,
        /<\s*hl4\s*>/gi, /<\s*\/\s*hl4\s*>/gi,
        /<\s*hl5\s*>/gi, /<\s*\/\s*hl5\s*>/gi,
        /<\s*hl6\s*>/gi, /<\s*\/\s*hl6\s*>/gi,
        /<\s*hl7\s*>/gi, /<\s*\/\s*hl7\s*>/gi,
        /<\s*f\d+\s*>/gi, /<\s*\/\s*f\d+\s*>/gi
    ];
    
    for(const re of keep) h = h.replace(re, m => `__KEEP__${m}__`);
    h = h.replace(/[&<>"']/g, ch => escMap[ch]);
    h = h.replace(/__KEEP__&lt;/g, '<').replace(/__KEEP__&lt;\//g, '</').replace(/__KEEP__/g, '').replace(/&gt;__/g, '>');
    return cleanBoundaryUnderscores(h.replace(/<u>\s+/g, '<u>').replace(/\s+<\/u>/g, '</u>'));
  }

  function renderWithMark(s=''){ return customToStandardHTML(htmlDecode(String(s))); }
  function denormalizeForEdit(s=''){ return renderWithMark(s); }
  function stripStoredMarkTags(s=''){ return String(s).replace(new RegExp(`&lt;/?(${ALLOWED_INLINE_TAGS.join('|')})\\s*&gt;|</?\\s*(${ALLOWED_INLINE_TAGS.join('|')})\\s*>`,'gi'), ''); }
  
  let _tk='', _tt=0;
  function toast(msg, type='info'){
    const area=document.querySelector('#toast-area'); if(!area) return;
    const k=`${type}:${msg}`, n=Date.now();
    if(k===_tk && n-_tt<300) return; _tk=k; _tt=n;
    const el=document.createElement('div'); el.className='toast '+(type||'info');
    el.innerHTML=`<div class="t-icon">ℹ️</div><div class="t-body">${esc(msg)}</div><div class="t-close">×</div>`;
    el.querySelector('.t-close').onclick=()=>area.removeChild(el);
    area.appendChild(el);
    setTimeout(()=>{ if(el.parentNode===area) area.removeChild(el); }, 1000);
  }

  Object.assign(window.SELTE, {
    openDB, tx, putItem, deleteItem, getAllItems,
    putImageBlob, putImageFromDataURL, getImageDataURL,
    state, uid, nowISO, esc, nextDomainSeq,
    normalizeForStore, renderWithMark, denormalizeForEdit, stripStoredMarkTags,
    customToStandardHTML, htmlDecode, cleanBoundaryUnderscores,
    toast, db
  });
}