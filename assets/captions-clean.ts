// Copy into the project before customization; the upstream runtime is selected by setup.
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {canvasFor,cueDiv,docShell,eachBeat,escapeHtml,templateRecipe,wrapByWidth,paginate,pageGateStyle,unitDelay} =
  await import(pathToFileURL(join(process.env.OPEN_EDIT_ROOT!, 'pipeline/recipes/template-lib.ts')).href);

export default templateRecipe('zh-centered-clean', (meta, timings, opts) => {
  const c=canvasFor(meta), scale=c.portrait ? c.W/1080 : c.H/1080;
  const font=Math.round((c.portrait?48:52)*scale), margin=Math.round((c.portrait?80:70)*scale);
  const cues=eachBeat(meta,timings,opts,'none',b=>{
    const size=Math.round(font*Math.pow(.92,b.rows));
    const maxChars=Math.floor((c.W-2*margin-48*scale)/size);
    const pages=paginate(b.units,maxChars*2-2,maxChars);
    const content=pages.map((page,pi)=>{
      const lines=wrapByWidth(page,maxChars,u=>u.chars,0);
      const rows=lines.map(line=>`<div class="line">${escapeHtml(line.map(u=>u.spans.map(s=>s.text).join('')).join(''))}</div>`).join('');
      const gate=pageGateStyle(pi,unitDelay(page[0]),pi+1<pages.length?unitDelay(pages[pi+1][0]):null);
      return `<div class="pg cap" id="b${b.n}p${pi+1}" style="font-size:${size}px;${gate}"><div class="panel">${rows}</div></div>`;
    }).join('');
    return cueDiv(b.n,b.cueDelayMs,b.winMs,content);
  });
  return docShell({canvas:c,videoPath:meta.videoPath,fonts:['Noto+Sans+SC:wght@500;700'],body:cues.join('\n'),css:`
  .cap{position:absolute;left:${margin}px;right:${margin}px;bottom:${Math.round((c.portrait?240:48)*scale)}px;display:flex;justify-content:center;align-items:center;font-family:'Noto Sans SC';font-weight:700;color:#fff;line-height:1;}
  .panel{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${Math.round(16*scale)}px ${Math.round(24*scale)}px;background:rgba(12,17,19,.88);border-radius:${Math.round(8*scale)}px;}
  .line{display:block;line-height:1.1;}
  `});
});
