// Leichtgewichtiges Debug-Overlay (nur geladen wenn DEBUG=true)
import { getBufferedLogs, flushLogs, setGlobalLogLevel, getGlobalLogLevel } from './logger.js';

(function(){
  if (window.__debugOverlayMounted) return;
  window.__debugOverlayMounted = true;
  const root = document.createElement('div');
  root.id = 'debug-overlay';
  Object.assign(root.style, {
    position:'fixed', bottom:'8px', left:'8px', width:'min(420px,90vw)', maxHeight:'40vh', background:'rgba(0,0,0,0.78)', color:'#eee', font:'12px/1.3 monospace',
    padding:'6px 6px 28px', border:'1px solid #444', borderRadius:'6px', zIndex:99999, backdropFilter:'blur(4px)', overflow:'hidden', display:'flex', flexDirection:'column'
  });
  const header = document.createElement('div');
  header.style.cssText='display:flex;align-items:center;gap:6px;margin-bottom:4px;font-weight:600;font-size:11px';
  header.innerHTML = `<span>Debug Overlay</span>`;
  const levelSel = document.createElement('select');
  ['error','warn','info','debug'].forEach(l=>{ const o=document.createElement('option'); o.value=l; o.textContent=l; levelSel.appendChild(o); });
  const setSel = () => { const cur = Object.entries(window.__logger.levels).find(([k,v]) => v===getGlobalLogLevel()); if (cur) levelSel.value=cur[0]; };
  setSel();
  levelSel.addEventListener('change', () => setGlobalLogLevel(levelSel.value));
  const btnClear = document.createElement('button'); btnClear.textContent='CLR'; btnClear.style.cssText='font:inherit;background:#333;color:#ddd;border:1px solid #555;border-radius:3px;padding:2px 6px;cursor:pointer';
  btnClear.onclick = () => { window.__logger.buffer.clear(); list.innerHTML=''; };
  const btnFlush = document.createElement('button'); btnFlush.textContent='FLUSH'; btnFlush.style.cssText=btnClear.style.cssText; btnFlush.onclick = () => {
    const data = flushLogs({});
    console.log('[overlay flush]', data);
  };
  const btnClose = document.createElement('button'); btnClose.textContent='×'; btnClose.style.cssText='margin-left:auto;font:inherit;background:#600;color:#fff;border:1px solid #933;border-radius:3px;padding:2px 6px;cursor:pointer'; btnClose.onclick=()=>root.remove();
  header.append(levelSel, btnClear, btnFlush, btnClose);

  const resize = document.createElement('div');
  resize.style.cssText='position:absolute;right:4px;bottom:4px;width:14px;height:14px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,#666 50%)';
  let startX=0,startY=0,startW=0,startH=0;
  resize.addEventListener('pointerdown',(e)=>{startX=e.clientX;startY=e.clientY;startW=root.offsetWidth;startH=root.offsetHeight;root.setPointerCapture(e.pointerId);});
  root.addEventListener('pointermove',(e)=>{
    if(!root.hasPointerCapture(e.pointerId)) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    root.style.width=Math.max(260,startW+dx)+'px';
    root.style.height=Math.max(160,startH+dy)+'px';
  });
  root.addEventListener('pointerup',(e)=>{ if(root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId); });

  const listWrap = document.createElement('div');
  listWrap.style.cssText='flex:1;overflow:auto;font-size:11px;border:1px solid #333;padding:4px;background:#111';
  const list = document.createElement('div'); listWrap.appendChild(list);

  function renderEntry(e){
    const row = document.createElement('div');
    row.style.cssText='padding:2px 0;border-bottom:1px solid #1e1e1e;word-break:break-word';
    const ts = new Date(e.ts).toLocaleTimeString();
    const colorMap = { error:'#ff7373', warn:'#ffcf63', info:'#8ecbff', debug:'#9d9d9d'};
    row.innerHTML = `<span style="color:${colorMap[e.level]||'#fff'}">${ts} ${e.level.padEnd(5)} ${e.namespace}:</span> ` + e.args.map(a=> formatArg(a)).join(' ');
    list.appendChild(row);
    listWrap.scrollTop = listWrap.scrollHeight;
  }
  function formatArg(a){
    if (a == null) return String(a);
    if (typeof a === 'object') { try { return `<code>${escapeHtml(JSON.stringify(a))}</code>`; } catch { return '<code>[object]</code>'; } }
    if (typeof a === 'string') return escapeHtml(a);
    return String(a);
  }
  function escapeHtml(str){ return String(str).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  // Initiale Logs
  getBufferedLogs().forEach(renderEntry);
  window.addEventListener('logEvent', (ev)=> renderEntry(ev.detail));

  root.append(header, listWrap, resize);
  document.body.appendChild(root);
})();
