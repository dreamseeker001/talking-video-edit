// Values come from the resolved project contract, never from a style name.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {canvasFor,cueDiv,docShell,eachBeat,escapeHtml,templateRecipe} =
  await import(pathToFileURL(join(process.env.OPEN_EDIT_ROOT!, 'pipeline/recipes/template-lib.ts')).href);
export default templateRecipe('contract-captions-cards', (meta,timings,opts) => {
  if (!process.env.VIDEO_STYLE_CONTEXT) throw Error('Run contract preflight first');
  const context=JSON.parse(readFileSync(process.env.VIDEO_STYLE_CONTEXT,'utf8'));
  const s=context.settings, a=s.captions, p=s.packaging, canvas=canvasFor(meta);
  const scale=Math.min(canvas.W,canvas.H)/1080;
  const cues=eachBeat(meta,timings,opts,'none',b=>{
    const annotation=context.presentation.cues.find(x=>x.beat===b.n);
    if (!annotation) throw Error('Missing cue presentation: '+b.n);
    const text=b.units.map(u=>u.spans.map(t=>t.text).join('')).join('');
    const keys=[...annotation.keywords].sort((x,y)=>y.length-x.length);
    let parts='', index=0;
    while(index<text.length){
      const keyword=keys.find(k=>text.startsWith(k,index));
      const value=keyword || String.fromCodePoint(text.codePointAt(index)!);
      parts+='<span'+(keyword?' class="keyword"':'')+'>'+escapeHtml(value)+'</span>';
      index+=value.length;
    }
    const card=p.cards!=='none' && annotation.card ? '<div class="card">'+escapeHtml(annotation.card)+'</div>' : '';
    // End at the native cue end, rather than carrying the caption through a long pause.
    return cueDiv(b.n,b.cueDelayMs,Math.min(b.winMs,b.beat.cueDurMs),card+'<div class="cap" id="b'+b.n+'p1"><div class="panel">'+parts+'</div></div>');
  });
  return docShell({canvas,videoPath:meta.videoPath,fonts:['Noto+Sans+SC:wght@500;700'],body:cues.join('\n'),css:`
  .cap{position:absolute;left:${a.margin*scale}px;right:${a.margin*scale}px;bottom:${a.bottom*scale}px;display:flex;justify-content:${a.align==='center'?'center':a.align==='left'?'flex-start':'flex-end'};align-items:center;font-family:'Noto Sans SC';font-weight:700;font-size:${a.fontSize*scale}px;color:${a.textColor};line-height:1.15;}
  .panel{padding:${a.paddingY*scale}px ${a.paddingX*scale}px;border-radius:${a.radius*scale}px;background:${a.plateColor};text-align:${a.align};max-width:100%;}
  .keyword{color:${a.keywordColor};}
  .card{position:absolute;${p.position==='top-right'?'right':'left'}:${p.margin*scale}px;top:${p.top*scale}px;padding:${12*scale}px ${18*scale}px;border-left:${4*scale}px solid ${p.accentColor};border-radius:${p.radius*scale}px;background:${p.backgroundColor};font-family:'Noto Sans SC';font-weight:700;font-size:${p.fontSize*scale}px;color:${p.textColor};max-width:${canvas.W*.42}px;}
  `});
});
