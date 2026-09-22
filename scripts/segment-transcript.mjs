// Regroup native words using agent-selected end-exclusive word indices; never invent timestamps.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function segment(source, ends, output) {
  if(path.resolve(source)===path.resolve(output)||fs.existsSync(output)) throw Error('Preserve source/output: choose a new file');
  const input=JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
  const words=input.chunks.flatMap(c=>c.words || []);
  if(!words.length || !ends.length || ends.at(-1)!==words.length) throw Error('Boundary list must include every source word');
  let lastStart=-1;
  for(const word of words){
    if(typeof word.text!=='string'||!Array.isArray(word.timestamp)||word.timestamp.length!==2||!word.timestamp.every(Number.isFinite)||word.timestamp[0]<0||word.timestamp[0]<lastStart||word.timestamp[1]<word.timestamp[0]) throw Error('Invalid source word/timestamps');
    lastStart=word.timestamp[0];
  }
  let previous=0;
  const chunks=ends.map(end=>{
    if(!Number.isInteger(end)||end<=previous||end>words.length) throw Error('Invalid word boundary');
    const part=words.slice(previous,end);previous=end;
    if(part.some(w=>!Array.isArray(w.timestamp)||w.timestamp.length!==2||!w.timestamp.every(Number.isFinite))) throw Error('Missing word timestamps');
    return {text:part.map(w=>w.text).join(''),timestamp:[part[0].timestamp[0],part.at(-1).timestamp[1]],words:part};
  });
  fs.writeFileSync(output,JSON.stringify({...input,text:chunks.map(c=>c.text).join(''),chunks,segmentation:{source:path.resolve(source),boundaries:ends,status:'draft',reason:'Agent must review semantic boundaries before rendering'}},null,2)+'\n',{flag:'wx'});
  return {words:words.length,cues:chunks.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(segment(process.argv[2],JSON.parse(fs.readFileSync(process.argv[3],'utf8')),process.argv[4])));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
