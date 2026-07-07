
/*! monthlyplanner_export_patch.js
 * Robust export patch for local (file://) environments.
 * - Tries to load XLSX from CDN when online.
 * - Falls back to CSV when offline or loading fails.
 * - Adds !ref guard to avoid empty-sheet errors.
 * - Normalizes line breaks for Excel.
 * How to use: include this file after your app scripts, near </body>.
 * <script src="monthlyplanner_export_patch.js"></script>
 */
(function(){
  // ---- Safe helpers ----
  const dayNamesFallback = ["일","월","화","수","목","금","토"];
  function getDayNames(){ return (typeof dayNames !== 'undefined' && Array.isArray(dayNames) && dayNames.length===7) ? dayNames : dayNamesFallback; }
  function toast(msg, warn){
    try { if (typeof showToast === 'function') return showToast(msg, warn); } catch(e){}
    // lightweight fallback
    console[(warn?'warn':'log')](msg);
    try{
      const el = document.createElement('div');
      el.textContent = msg;
      el.style.position='fixed'; el.style.left='50%'; el.style.top='16px'; el.style.transform='translateX(-50%)';
      el.style.background= warn ? '#b91c1c' : '#065f46';
      el.style.color='white'; el.style.padding='8px 12px'; el.style.borderRadius='8px'; el.style.zIndex=99999; el.style.fontSize='14px';
      document.body.appendChild(el); setTimeout(()=>el.remove(), 1800);
    }catch{}
  }
  function getMonthName(){
    try { return (monthInput && monthInput.value || '').replace('-','_') || 'calendar'; } catch{ return 'calendar'; }
  }
  function getCalendarData(){
    if (typeof calendarData !== 'undefined' && calendarData) return calendarData;
    // best-effort empty dataset; user app should define window.calendarData
    return {};
  }

  // ---- Dynamic loader for XLSX ----
  async function ensureXLSX() {
    if (window.XLSX) return true;
    const cdns = [
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
      "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"
    ];
    for (const src of cdns) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.async = true;
          s.onload = () => res();
          s.onerror = () => rej(new Error('load fail'));
          document.head.appendChild(s);
        });
        if (window.XLSX) return true;
      } catch(e) {}
    }
    return false;
  }

  // ---- CSV builder ----
  function exportCSV(rows, name){
    const headers = ['날짜','요일','내용','배경색','중요도'];
    const esc = (s)=> '"' + String(s ?? '').replace(/"/g,'""').replace(/\r?\n/g,'\r\n') + '"';
    const csv = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => [r.날짜, r.요일, r.내용, r.배경색, r.중요도].map(esc).join(','))
    ].join('\r\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `월간일정_${name}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('CSV로 내보냈어요');
  }

  // ---- Core export (overrides existing exportFile if present) ----
  async function exportFilePatched(format){
    try {
      const data = getCalendarData();
      const rows = Object.entries(data)
        .map(([date, v]) => ({
          날짜: date,
          요일: getDayNames()[new Date(date).getDay()] ?? "",
          내용: (v && v.content) || "",
          배경색: (v && v.color) || "",
          중요도: (v && v.priority) || ""
        }))
        .sort((a,b)=> String(a.날짜).localeCompare(String(b.날짜)));
      const name = getMonthName();

      // CSV branch
      if (format === 'csv') return exportCSV(rows, name);

      // Try XLSX
      const ok = await ensureXLSX();
      if (!ok || !window.XLSX) {
        toast('오프라인 등으로 XLSX 로딩 실패: CSV로 내보냅니다', true);
        return exportCSV(rows, name);
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      if (!ws['!ref']) ws['!ref'] = 'A1'; // guard for empty
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = Math.max(range.s.r + 1, 1); R <= range.e.r; ++R) {
        const ref = XLSX.utils.encode_cell({ r: R, c: 2 }); // "내용" column
        const cell = ws[ref];
        if (cell && typeof cell.v === 'string') { cell.v = cell.v.replace(/\r?\n/g, '\r\n'); cell.t = 's'; }
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '일정');
      XLSX.writeFile(wb, `월간일정_${name}.xlsx`);
      toast('XLSX로 내보냈어요');
    } catch (err) {
      console.error('[exportFilePatched]', err);
      toast('내보내기 중 오류가 발생했어요: ' + (err && err.message || err), true);
      try { if (format !== 'csv') return exportCSV([], getMonthName()); } catch {}
    }
  }

  // Expose & override
  window.exportFile = exportFilePatched;

  // Attach to existing export button if present
  function attach(){
    const btn = document.getElementById('exportBtn') || document.querySelector('[data-role="export"]');
    if (btn && !btn.__patched_export__) {
      btn.addEventListener('click', (e)=> { window.exportFile(e && e.shiftKey ? 'csv' : 'xlsx'); });
      btn.__patched_export__ = true;
    }
  }
  // Attach now and on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach, { once:true });
  } else {
    attach();
  }
})();
