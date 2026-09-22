import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha,preferences,validate,prepare,preflight,update} from './preference-contract.mjs';
import {segment} from './segment-transcript.mjs';
import {initialize} from './Initialize-VideoAnnotations.mjs';
import {apply as applyEditorialPlan,projectAfterCut} from './Apply-EditorialPlan.mjs';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const put=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2));
const putPref=(file,value)=>fs.writeFileSync(file,'# Test contract\n\n```json\n'+JSON.stringify(value,null,2)+'\n```\n\nEvidence is synthetic.\n');
function fixture(t,change=()=>{}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'video-contract-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'assets'));
  for(const name of ['captions-semantic-cards.ts','captions-semantic-cards.adapter.json']) fs.copyFileSync(path.join(skill,'assets',name),path.join(root,'assets',name));
  const profile={styleId:'arbitrary-test-name',styleRevision:1,scope:{orientations:['landscape'],content:'synthetic'},
    module:{path:'assets/captions-semantic-cards.ts',adapter:'assets/captions-semantic-cards.adapter.json',sha256:sha(path.join(root,'assets/captions-semantic-cards.ts')),adapterSha256:sha(path.join(root,'assets/captions-semantic-cards.adapter.json'))},
    settings:{captions:{plateColor:'#101010',textColor:'#EEEEEE',keywordColor:'#AABBCC',align:'center',fontSize:50,margin:40,bottom:70,paddingX:20,paddingY:10,radius:8,maxCueChars:20,maxCueSeconds:5},packaging:{cards:'semantic',position:'top-left',margin:40,top:40,fontSize:32,radius:8,backgroundColor:'#111111',textColor:'#FFFFFF',accentColor:'#ABCDEF'}},
    output:{longEdge:1920,fpsPolicy:'preserve'},policies:[{id:'base',instruction:'Check synthetic base',stage:'base',executor:'agent',verification:'evidence-review'}],validation:{intent:'confirmed',implementation:'pending',evidence:[]}};
  const pref={schemaVersion:1,revision:1,confirmed:true,activeProfile:'default',profiles:{default:profile},references:[],knownNames:[],conflicts:[],candidates:[]};
  change(pref);
  const file=path.join(root,'preferences.md'),run=path.join(root,'run');putPref(file,pref);
  const binding=()=>prepare(file,root,run);
  const populate=()=>{
    const words=[{text:'测试',timestamp:[0,.4]},{text:'字幕',timestamp:[.4,.9]},{text:'下一句',timestamp:[1,1.8]}];
    put(path.join(run,'meta.json'),{width:1920,height:1080,fps:30,durationSec:3,videoPath:'synthetic.mp4'});
    put(path.join(run,'transcript.json'),{text:'测试字幕下一句',chunks:[{text:'测试字幕',timestamp:[0,1],words:words.slice(0,2)},{text:'下一句',timestamp:[1,2],words:words.slice(2)}]});
    put(path.join(run,'word-timings.json'),{beats:[{i:1,startSec:0,endSec:1,cueDelayMs:0,cueDurMs:1000,words:[{w:'测试',delayMs:0},{w:'字幕',delayMs:400}]},{i:2,startSec:1,endSec:2,cueDelayMs:1000,cueDurMs:1000,words:[{w:'下一句',delayMs:1000}]}]});
    const plan={schemaVersion:1,status:'final',source:{transcript:'transcript.json',transcriptSha256:sha(path.join(run,'transcript.json')),wordCount:3},segmentation:{status:'final',boundaries:[2,3]},cuts:[],beats:[{id:1,startWord:0,endWord:2,keep:true,reason:'完整短语',confidence:'high',keywords:['测试'],card:'第一个意思'},{id:2,startWord:2,endWord:3,keep:true,reason:'独立句子',confidence:'high',keywords:[],card:''}],policyReview:{status:'final',items:[{id:'base',status:'pass',evidence:'Synthetic fixture, not visual validation'}]}};
    put(path.join(run,'editorial-plan.json'),plan);
    const planHash=sha(path.join(run,'editorial-plan.json'));
    put(path.join(run,'presentation.json'),{status:'final',planSha256:planHash,cues:[{beat:1,keywords:['测试'],card:'第一个意思'},{beat:2,keywords:[],card:''}]});
    put(path.join(run,'policy-review.json'),{status:'final',planSha256:planHash,items:[{id:'base',status:'pass',evidence:'Synthetic fixture, not visual validation'}]});
  };
  return {root,file,run,pref,profile,binding,populate,preflight:()=>preflight(run,path.join(run,'style/module.ts'),root)};
}
test('same contract validates, freezes and drives preflight regardless of style name',t=>{
  const f=fixture(t);assert.equal(validate(f.file,f.root).profile.styleId,'arbitrary-test-name');
  f.binding();f.populate();assert.equal(f.preflight().Status,'passed-structure-only');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.run,'style.resolved.json'))).settings,f.profile.settings);
});
test('unknown fields, unsupported values and module drift cannot be ignored',t=>{
  const f=fixture(t);f.profile.settings.captions.unmapped='x';putPref(f.file,f.pref);
  assert.throws(()=>validate(f.file,f.root),/Unmapped/);delete f.profile.settings.captions.unmapped;
  f.profile.settings.captions.align='diagonal';putPref(f.file,f.pref);assert.throws(()=>validate(f.file,f.root),/Unsupported value/);
  f.profile.settings.captions.align='left';putPref(f.file,f.pref);fs.appendFileSync(path.join(f.root,f.profile.module.path),'\n// modified');
  assert.throws(()=>validate(f.file,f.root),/hash mismatch/);
});
test('adapter drift, absent mappings and unresolved conflicts fail',t=>{
  const f=fixture(t);f.pref.conflicts=['scope needs decision'];putPref(f.file,f.pref);assert.throws(()=>validate(f.file,f.root),/conflicts/);
  f.pref.conflicts=[];delete f.profile.settings.captions.align;putPref(f.file,f.pref);assert.throws(()=>validate(f.file,f.root),/Missing mapped/);
  f.profile.settings.captions.align='center';putPref(f.file,f.pref);fs.appendFileSync(path.join(f.root,f.profile.module.adapter),' ');assert.throws(()=>validate(f.file,f.root),/hash mismatch/);
});
test('long cues fail; comments cannot bypass segmentation',t=>{
  const f=fixture(t,p=>p.profiles.default.settings.captions.maxCueChars=3);f.binding();f.populate();
  fs.appendFileSync(path.join(f.run,'task.md'),'manual-segmentation');assert.throws(f.preflight,/exceeds distilled limits/);
});
test('missing transcript/timings and mismatched words fail',t=>{
  const f=fixture(t);f.binding();f.populate();const file=path.join(f.run,'word-timings.json');fs.unlinkSync(file);assert.throws(f.preflight,/ENOENT/);
  f.populate();const data=JSON.parse(fs.readFileSync(file));data.beats[0].words[0].w='丢字';put(file,data);assert.throws(f.preflight,/differs from transcript/);
  f.populate();fs.unlinkSync(path.join(f.run,'transcript.json'));assert.throws(f.preflight,/ENOENT/);
});
test('cue timing, policy execution and resolution are real pre-render gates',t=>{
  const f=fixture(t);f.binding();f.populate();let file=path.join(f.run,'meta.json');const meta=JSON.parse(fs.readFileSync(file));meta.width=3840;meta.height=2160;put(file,meta);assert.throws(f.preflight,/Normalize/);
  f.populate();file=path.join(f.run,'word-timings.json');const timing=JSON.parse(fs.readFileSync(file));timing.beats[0].cueDelayMs=999;put(file,timing);assert.throws(f.preflight,/window/);
  f.populate();const policy=JSON.parse(fs.readFileSync(path.join(f.run,'policy-review.json')));policy.items[0].status='pending-visual';put(path.join(f.run,'policy-review.json'),policy);assert.throws(f.preflight,/not implemented/);
});
test('global updates do not restyle frozen runs; snapshot tampering is rejected',t=>{
  const f=fixture(t);f.binding();f.populate();f.pref.revision++;f.profile.settings.captions.textColor='#FF0000';putPref(f.file,f.pref);
  fs.appendFileSync(path.join(f.root,f.profile.module.path),'\n// changed after prepare');
  assert.equal(f.binding().SnapshotRevision,1);f.preflight();assert.equal(JSON.parse(fs.readFileSync(path.join(f.run,'style.resolved.json'))).settings.captions.textColor,'#EEEEEE');
  fs.appendFileSync(path.join(f.run,'preferences.snapshot.md'),'changed');assert.throws(f.preflight,/snapshot changed/);
});
test('profile selection is explicit and orientation scope is enforced',t=>{
  const f=fixture(t,p=>{p.profiles.portrait=structuredClone(p.profiles.default);p.profiles.portrait.scope.orientations=['portrait'];});
  prepare(f.file,f.root,f.run,'portrait');f.populate();assert.throws(f.preflight,/orientation/);
  assert.throws(()=>prepare(f.file,f.root,f.run,'default'),/frozen/);
});
test('preference updates back up old contents and reject stale or invalid writes',t=>{
  const f=fixture(t),before=preferences(f.file),candidate=path.join(f.root,'candidate.md');f.pref.revision=2;putPref(candidate,f.pref);
  assert.throws(()=>update(f.file,candidate,f.root,'0'.repeat(64),'request'),/changed since/);assert.equal(sha(f.file),before.hash);
  const result=update(f.file,candidate,f.root,before.hash,'explicit user request');assert.equal(fs.readFileSync(result.backup,'utf8'),before.text);assert.equal(result.fullText,preferences(f.file).text);
  const good=sha(f.file);f.pref.revision=3;f.profile.settings.bad='ignored?';putPref(candidate,f.pref);assert.throws(()=>update(f.file,candidate,f.root,good,'request'),/Unmapped/);assert.equal(sha(f.file),good);
});
test('segmentation retains every word and timestamp and works with Chinese CLI paths',t=>{
  const f=fixture(t);f.binding();f.populate();const source=path.join(f.run,'transcript.json'),out=path.join(f.root,'分段.json'),bounds=path.join(f.root,'边界.json');
  put(bounds,[1,3]);const result=spawnSync(process.execPath,[path.join(skill,'scripts/segment-transcript.mjs'),source,bounds,out],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const segmented=JSON.parse(fs.readFileSync(out));assert.deepEqual(segmented.chunks.flatMap(c=>c.words),JSON.parse(fs.readFileSync(source)).chunks.flatMap(c=>c.words));assert.equal(segmented.segmentation.status,'draft');
  assert.throws(()=>segment(source,[1,2],path.join(f.root,'bad.json')),/every source word/);assert.throws(()=>segment(source,[3],source),/Preserve/);
});
test('generator changes actual document when colors, alignment and card choice change',async t=>{
  if(!process.env.OPEN_EDIT_ROOT){t.skip('Set OPEN_EDIT_ROOT to the pinned runtime for generator verification');return;}
  const f=fixture(t);f.binding();f.populate();f.preflight();
  const old=process.env.VIDEO_STYLE_CONTEXT;t.after(()=>{if(old===undefined)delete process.env.VIDEO_STYLE_CONTEXT;else process.env.VIDEO_STYLE_CONTEXT=old;});
  process.env.VIDEO_STYLE_CONTEXT=path.join(f.run,'style.resolved.json');
  const recipe=(await import(pathToFileURL(path.join(f.run,'style/module.ts')).href)).default;
  const meta=JSON.parse(fs.readFileSync(path.join(f.run,'meta.json'))),timings=JSON.parse(fs.readFileSync(path.join(f.run,'word-timings.json')));
  const first=recipe.generate(meta,timings,{}).wv;assert.match(first,/<div class="card">第一个意思/);assert.match(first,/color:#EEEEEE/);
  const other=fixture(t,p=>{const s=p.profiles.default.settings;s.captions.textColor='#123456';s.captions.keywordColor='#654321';s.captions.align='left';s.packaging.cards='none';});other.binding();other.populate();
  assert.throws(other.preflight,/Cards disabled/);const otherPlan=JSON.parse(fs.readFileSync(path.join(other.run,'editorial-plan.json')));otherPlan.beats[0].card='';put(path.join(other.run,'editorial-plan.json'),otherPlan);const otherPlanHash=sha(path.join(other.run,'editorial-plan.json'));const presentation=JSON.parse(fs.readFileSync(path.join(other.run,'presentation.json')));presentation.planSha256=otherPlanHash;presentation.cues=[{beat:1,keywords:['测试'],card:''},{beat:2,keywords:[],card:''}];put(path.join(other.run,'presentation.json'),presentation);const otherPolicy=JSON.parse(fs.readFileSync(path.join(other.run,'policy-review.json')));otherPolicy.planSha256=otherPlanHash;put(path.join(other.run,'policy-review.json'),otherPolicy);other.preflight();
  process.env.VIDEO_STYLE_CONTEXT=path.join(other.run,'style.resolved.json');const second=recipe.generate(meta,timings,{}).wv;
  assert.match(second,/color:#123456/);assert.match(second,/color:#654321/);assert.match(second,/justify-content:flex-start/);assert.doesNotMatch(second,/<div class="card">/);assert.notEqual(first,second);
  assert.match(second,/animation-delay:1000ms;animation-duration:1000ms/);
});
test('annotation initializer materializes final execution files from a final plan',t=>{
  const f=fixture(t);f.binding();f.populate();f.preflight();
  fs.rmSync(path.join(f.run,'presentation.json'));fs.rmSync(path.join(f.run,'policy-review.json'));
  const result=initialize(f.run);assert.equal(result.status,'final');assert.equal(result.cues,2);assert.equal(result.policies,1);
  const presentation=JSON.parse(fs.readFileSync(path.join(f.run,'presentation.json')));
  assert.equal(presentation.cues.length,2);assert.equal(presentation.cues[0].card,'第一个意思');
  const review=JSON.parse(fs.readFileSync(path.join(f.run,'policy-review.json')));
  assert.equal(review.items[0].status,'pass');assert.throws(()=>initialize(f.run),/Refusing to overwrite/);
});
test('full-film plan derives native transcript and EDL without inventing a timeline',t=>{
  const f=fixture(t);f.binding();f.populate();
  const result=applyEditorialPlan(f.run);
  assert.equal(result.ranges,1);
  const planned=JSON.parse(fs.readFileSync(result.transcript));
  assert.equal(planned.segmentation.status,'final');
  assert.deepEqual(planned.chunks.flatMap(c=>c.words).map(w=>w.text),['测试','字幕','下一句']);
  const edl=JSON.parse(fs.readFileSync(result.edl));
  assert.deepEqual(Object.keys(edl),['sources','transcripts','ranges','editorialPlan']);
  assert.equal(edl.transcripts.talk,result.transcript);
});
test('post-cut projection keeps only reviewed beats and follows retimed chunk boundaries',t=>{
  const f=fixture(t);f.binding();f.populate();
  const sourcePlan=path.join(f.run,'editorial-plan.json');
  const cut=path.join(f.root,'cut');fs.mkdirSync(cut);put(path.join(cut,'transcript.json'),{chunks:[
    {text:'测试字幕',words:[{text:'测试',timestamp:[0,.4]},{text:'字幕',timestamp:[.4,.9]}]}
  ]});
  put(path.join(f.run,'editorial-plan.edl.json'),{ranges:[{start:0,end:2}]});
  const p=JSON.parse(fs.readFileSync(sourcePlan));p.beats[1].keep=false;put(sourcePlan,p);
  const result=projectAfterCut(sourcePlan,cut);const projected=JSON.parse(fs.readFileSync(result.plan));
  assert.equal(result.beats,1);assert.deepEqual(projected.segmentation.boundaries,[2]);assert.equal(projected.beats[0].id,1);
  const bad={chunks:[{words:[{text:'不同',timestamp:[0,.4]},{text:'字幕',timestamp:[.4,.9]}]}]};
  put(path.join(cut,'transcript.json'),bad);
  assert.throws(()=>projectAfterCut(sourcePlan,cut,path.join(cut,'bad-plan.json')),/cut words differ/);
});
test('unfinished base policy cannot pass pre-render and partial annotations are preserved',t=>{
  const f=fixture(t);f.binding();f.populate();
  const file=path.join(f.run,'policy-review.json'),p=JSON.parse(fs.readFileSync(file));
  p.items[0].status='planned';put(file,p);assert.throws(f.preflight,/not implemented/);
  fs.unlinkSync(path.join(f.run,'presentation.json'));
  assert.throws(()=>initialize(f.run),/Refusing to overwrite/);
  assert.equal(fs.existsSync(path.join(f.run,'presentation.json')),false);
});
