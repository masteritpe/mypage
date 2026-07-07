/* ===========================================================================
 * 2. 5R_export.js : Import / Export Logic
 * =========================================================================== */
{
  const S = window.SELTE;
  const XL_COLOR={ red:'FFE53935', blue:'FF1E88E5', green:'FF43A047', ink:'FF1A202C', navy: 'FF0D3A9E' };

  function cssColorToArgb(colorStr) {
    if(!colorStr) return null;
    try {
        colorStr = String(colorStr).replace(/['"\s]/g, '').toLowerCase();
        if(colorStr.startsWith('#')) {
            let hex = colorStr.slice(1);
            if(hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
            return 'FF' + hex.toUpperCase();
        }
        const match = colorStr.match(/rgba?\((\d+),(\d+),(\d+)/);
        if(match) {
            const r = parseInt(match[1]).toString(16).padStart(2,'0');
            const g = parseInt(match[2]).toString(16).padStart(2,'0');
            const b = parseInt(match[3]).toString(16).padStart(2,'0');
            return 'FF' + (r+g+b).toUpperCase();
        }
    } catch(e) { return null; }
    return null;
  }

  function toRichTextFromStored(input){
    const raw = String(input ?? '');
    if(!raw.trim()) return null;

    try {
        let preProcess = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n');
        const div = document.createElement('div');
        div.innerHTML = S.htmlDecode(preProcess);

        const runs = [];
        function traverse(node, currentStyle) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (text && (text.trim().length > 0 || text.includes('\n'))) {
                    runs.push({ text: text, font: { ...currentStyle } });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const newStyle = { ...currentStyle };
                const tag = node.tagName.toLowerCase();
                const s = node.style;

                if (['b','strong','mark','dueum'].includes(tag) || s.fontWeight === 'bold') newStyle.bold = true;
                if (tag === 'mark') newStyle.underline = true;
                if (['u','ins'].includes(tag) || s.textDecoration.includes('underline')) newStyle.underline = true;
                if (['del','strike','s'].includes(tag) || s.textDecoration.includes('line-through')) newStyle.strike = true;
                
                if (tag === 'red') newStyle.color = { argb: XL_COLOR.red };
                if (tag === 'blue') newStyle.color = { argb: XL_COLOR.blue };
                if (tag === 'green') newStyle.color = { argb: XL_COLOR.green };
                if (tag === 'dueum') newStyle.color = { argb: XL_COLOR.navy }; // 엑셀 배경색 미지원 이슈로 텍스트 남색 처리
                
                if (s.color) {
                    const argb = cssColorToArgb(s.color);
                    if (argb) newStyle.color = { argb };
                }

                if(node.childNodes && node.childNodes.length > 0) {
                    node.childNodes.forEach(child => traverse(child, newStyle));
                }
            }
        }

        const baseStyle = { size: 11, color: { argb: XL_COLOR.ink }, name: 'Malgun Gothic' };
        traverse(div, baseStyle);

        if (runs.length === 0) return div.textContent || raw.replace(/<[^>]+>/g, '');
        return runs;

    } catch (e) {
        return raw.replace(/<[^>]+>/g, '');
    }
  }

  function fromRichTextToCustom(runs){
    if(!Array.isArray(runs)) return '';
    let out='', cur=[];
    for(const r of runs){
      const font=r.font||{}; const tags=[];
      if(font.bold) tags.push('mark'); 
      else if(font.underline) tags.push('u');
      if(font.strike) tags.push('del');
      const c=(font.color?.argb||'').toUpperCase();
      if(c===XL_COLOR.red) tags.push('red');
      else if(c===XL_COLOR.blue) tags.push('blue');
      else if(c===XL_COLOR.green) tags.push('green');
      else if(c===XL_COLOR.navy) tags.push('dueum');
      
      while(cur.length && !cur.every((t,i)=>tags[i]===t)) out+=`</${cur.pop()}>`;
      tags.slice(cur.length).forEach(t=>{ out+=`<${t}>`; cur.push(t); });
      out+=(r.text || '');
    }
    while(cur.length) out+=`</${cur.pop()}>`;
    return out;
  }

  function blobToBase64(blob){ 
      return new Promise((res,rej)=>{ 
          const r=new FileReader(); 
          r.onload=()=> {
              const result = r.result;
              if(result.includes(',')) res(result.split(',')[1]);
              else res(result);
          }; 
          r.onerror=rej; 
          r.readAsDataURL(blob); 
      }); 
  }

  async function exportToExcel(setStatus){
    try{
      if(!S.db) await S.openDB();
      const workbook=new ExcelJS.Workbook();
      
      const currentFilter = (S.state.domainFilter || '').trim();
      const targetItems = currentFilter 
          ? S.state.items.filter(it => (it.domain||'').trim() === currentFilter)
          : S.state.items;

      if(targetItems.length === 0) { alert('내보낼 데이터가 없습니다.'); return; }

      const groups={};
      targetItems.forEach(it=>{ (groups[(it.domain||'기타').trim()]||=[]).push(it); });

      for(const [domain, arr] of Object.entries(groups)){
        arr.sort((a,b)=> (a.domainSeq||0)-(b.domainSeq||0));
        
        const safeName = domain.replace(/[\\/?*\[\]]/g, '_').substring(0, 31) || 'Sheet1';
        const ws=workbook.addWorksheet(safeName);
        
        ws.columns=[
          { header:'연번', key:'seq', width:8 },
          { header:'토픽', key:'topic', width:36 }, 
          { header:'정의', key:'def', width:40 },
          { header:'두음', key:'mne', width:24 }, 
          { header:'추가설명', key:'note', width:40 },
          { header:'Img1', key:'img1', width:15 }, 
          { header:'Img2', key:'img2', width:15 }, 
          { header:'Img3', key:'img3', width:15 }, 
          { header:'Img4', key:'img4', width:15 }, 
          { header:'Img5', key:'img5', width:15 }
        ];
        
        for(let i=0; i<arr.length; i++){
            const it = arr[i];
            
            const setCell = (val) => {
                const rt = toRichTextFromStored(val);
                if (Array.isArray(rt)) return { richText: rt };
                else if (typeof rt === 'string') return rt;
                return '';
            };

            const row = ws.addRow({ seq: it.domainSeq, topic: setCell(it.topic), def: setCell(it.definition), mne: setCell(it.mnemonic), note: setCell(it.notes) });
            const rowNum = row.number;
            row.alignment = { vertical:'top', wrapText: true, horizontal:'left' };
            
            let hasImg = false;
            for(let n=1; n<=5; n++){
                const id = it[`img${n}Id`];
                if(id){
                    try {
                        const url = await S.getImageDataURL(id);
                        if(url){
                            hasImg = true;
                            const b64 = await fetch(url).then(r=>r.blob()).then(blobToBase64);
                            const imgId = workbook.addImage({ base64: b64, extension: 'png' });
                            ws.addImage(imgId, { tl: { col: 4+n + 0.1, row: rowNum - 1 + 0.1 }, ext: { width: 100, height: 100 }, editAs: 'oneCell' });
                        }
                    } catch(e) { console.warn('Img err', e); }
                }
            }
            row.height = hasImg ? 100 : 45; 
        }
      }
      
      const buf=await workbook.xlsx.writeBuffer();
      const fileName = currentFilter ? `5R_${currentFilter}.xlsx` : '5Rchecklist_All.xlsx';
      const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([buf])); a.download=fileName; a.click();
      if(setStatus) setStatus(`${targetItems.length}건 저장 완료`,'ok');
    } catch(e){ console.error('Export Error:', e); if(setStatus) setStatus('엑셀 저장 실패','bad'); }
  }

  async function importFromExcel(file, refreshCallback){
    if(!file) return;
    try{
      const wb=new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const imported=[];
      
      for(const ws of wb.worksheets){
        const headers={}; 
        ws.getRow(1).eachCell((c,i)=>headers[String(c.value).trim()]=i);
        const domain=(ws.name||'기타').trim();
        const imgMap={}; 
        
        if(ws.getImages){
          for(const img of ws.getImages()){
             try {
                 const row = Math.floor(img.range.tl.row) + 1;
                 const col = img.range.tl.col; 
                 const meta = wb.getImage(img.imageId);
                 let blob = null;

                 if (meta && meta.buffer) {
                     const ext = meta.extension ? String(meta.extension).toLowerCase() : 'png';
                     const type = {png:'image/png',jpeg:'image/jpeg',jpg:'image/jpeg',gif:'image/gif'}[ext] || 'image/png';
                     blob = new Blob([meta.buffer], {type});
                 } else if (meta && meta.base64) {
                     const b64Str = meta.base64.includes(',') ? meta.base64 : `data:image/png;base64,${meta.base64}`;
                     const res = await fetch(b64Str);
                     blob = await res.blob();
                 }

                 if (blob) {
                     const id = await S.putImageBlob(blob);
                     if(!imgMap[row]) imgMap[row] = [];
                     imgMap[row].push({ col, id });
                 }
             } catch (imgErr) { console.warn("건너뜀:", imgErr); }
          }
        }

        ws.eachRow((row,rn)=>{
          if(rn===1) return;
          if(row.values.every(v=>!v)) return; 
          
          const getVal = (key) => {
              const idx = headers[key];
              if(!idx) return '';
              const cell = row.getCell(idx);
              if (cell && cell.value && cell.value.richText) return fromRichTextToCustom(cell.value.richText);
              return S.normalizeForStore(String(cell ? (cell.value || '') : ''));
          };

          const seqCell = row.getCell(headers['연번']||1);
          const seqVal = parseFloat(String(seqCell ? seqCell.value : ''));
          
          const rowImgs = imgMap[rn] || [];
          rowImgs.sort((a,b) => a.col - b.col);
          const imgData = {};
          rowImgs.forEach((imgObj, idx) => { if (idx < 5) imgData[`img${idx+1}Id`] = imgObj.id; });

          imported.push({
            id: S.uid(), ts: S.nowISO(), checked:false, domain,
            domainSeq: (Number.isFinite(seqVal) && seqVal>0) ? seqVal : 0, 
            topic: getVal('토픽'), definition: getVal('정의'), mnemonic: getVal('두음'), notes: getVal('추가설명'),
            ...imgData
          });
        });
      }
      
      for(const it of imported){
          if(it.domainSeq===0) it.domainSeq = S.nextDomainSeq(it.domain);
          await S.putItem(it);
      }
      refreshCallback();
      S.toast('엑셀 불러오기 완료','ok');
    }catch(e){ console.error(e); S.toast('불러오기 실패.','bad'); }
  }

  function exportAnki(items, domainName){
    if(!items.length) return alert('항목 없음');
    let content="";
    items.forEach(it=>{
      const fs=(s)=>S.renderWithMark(s||'').replace(/\t/g,' ').replace(/\n/g,'<br>');
      content += `${fs(it.topic)}\t${fs(it.definition)}\t${fs(it.mnemonic)}\t${(it.domain||'').replace(/\s/g,'_')}\n`;
    });
    const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`5R_Anki_${domainName||'All'}.txt`; a.click();
    S.toast('Anki 저장 완료','ok');
  }

  function exportBrainscape(items, domainName){
    if(!items.length) return alert('항목 없음');
    const toPlain=(html)=>{
      let s=String(html).replace(/<br\s*\/?>/gi,'\n').replace(/<\/div>/gi,'\n').replace(/<\/p>/gi,'\n');
      s=s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/(^|\n)\s*\*\s/g, '$1- ').replace(/<[^>]+>/g,'').trim();
      return s;
    };
    const csvEsc=(t)=>`"${String(t).replace(/"/g,'""')}"`;
    let csv="Question,Answer\n";
    items.forEach(it=>{
      const q=toPlain(S.renderWithMark(it.topic));
      let a=toPlain(S.renderWithMark(it.definition));
      const m=toPlain(S.renderWithMark(it.mnemonic));
      if(m) a += `\n${m}`;
      csv+=`${csvEsc(q)},${csvEsc(a)}\n`;
    });
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`5R_Brainscape_${domainName||'All'}.csv`; a.click();
    S.toast('Brainscape CSV 저장 완료','ok');
  }

  async function exportJSON(){
    try {
      const currentFilter = (S.state.domainFilter || '').trim();
      const targetItems = currentFilter 
          ? S.state.items.filter(it => (it.domain||'').trim() === currentFilter)
          : S.state.items;

      if(targetItems.length === 0) return alert('백업할 데이터가 없습니다.');

      S.toast('JSON 백업 생성 중...', 'warn');
      const exportData = [];
      
      for(const it of targetItems) {
        const clone = { ...it };
        for(let i=1; i<=5; i++) {
          const imgId = clone[`img${i}Id`];
          if(imgId) {
            try {
              const objUrl = await S.getImageDataURL(imgId);
              if(objUrl) {
                const res = await fetch(objUrl);
                const blob = await res.blob();
                const r = new FileReader();
                const b64Data = await new Promise((resolve) => { r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
                clone[`_img${i}Data`] = b64Data;
              }
            } catch(e) { console.warn('Img extract err', e); }
          }
        }
        exportData.push(clone);
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = currentFilter ? `5R_${currentFilter}_backup.json` : '5R_All_backup.json';
      
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
      S.toast('JSON 백업 완료', 'ok');
    } catch(e) { console.error(e); S.toast('JSON 백업 실패', 'bad'); }
  }

  async function importJSON(file, refreshCallback){
    if(!file) return;
    try {
      S.toast('JSON 복구 중...', 'warn');
      const text = await file.text();
      const items = JSON.parse(text);
      
      if(!Array.isArray(items)) throw new Error("유효하지 않은 JSON 포맷입니다.");

      for(const it of items) {
        for(let i=1; i<=5; i++) {
          const b64 = it[`_img${i}Data`];
          if(b64) { it[`img${i}Id`] = await S.putImageFromDataURL(b64); }
          delete it[`_img${i}Data`];
        }
        await S.putItem(it);
      }
      
      refreshCallback();
      S.toast(`${items.length}건 JSON 복구 완료`, 'ok');
    } catch(e) { console.error(e); S.toast('JSON 복구 실패', 'bad'); } 
    finally { const fileInput = document.getElementById('jsonImport'); if(fileInput) fileInput.value = ''; }
  }

  Object.assign(window.SELTE, { exportToExcel, importFromExcel, exportAnki, exportBrainscape, exportJSON, importJSON });
}