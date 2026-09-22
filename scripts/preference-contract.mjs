// Local preference plumbing only. Native OpenEdit owns media cuts and timelines.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validate as validatePlan} from './editorial-plan.mjs';

const fail = message => { throw new Error(message); };
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const json = file => JSON.parse(read(file));
export const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
export function preferences(file) {
  const text = read(file), match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) fail(`Missing preference JSON: ${file}`);
  return {text, value: JSON.parse(match[1]), hash: sha(file)};
}
function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, val]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return val && typeof val === 'object' && !Array.isArray(val)
      ? Object.entries(flatten(val, name)) : [[name, val]];
  }));
}
function rootPath(relative, root) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) fail('Module paths must be relative to the skill root');
  const full = path.resolve(root, relative), rel = path.relative(path.resolve(root), full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail('Module path escapes skill root');
  return full;
}
export function validate(file, skillRoot, profileId, frozenDir) {
  const pref = preferences(file), p = pref.value;
  if (p.schemaVersion !== 1 || !Number.isInteger(p.revision) || p.revision < 1) fail('Migrate preference schema/revision explicitly');
  if (p.confirmed !== true) fail('Preference intent is not confirmed');
  if (p.captions || p.packaging || p.styleId || p.styleModule) fail('Duplicate legacy style settings: resolve them into profiles, not two authorities');
  if (p.conflicts?.length) fail('Unresolved preference conflicts; ask the user to choose or split scopes');
  if (!p.profiles || !p.profiles[p.activeProfile]) fail('Missing active profile');
  const selected = profileId || p.activeProfile;
  if (!p.profiles[selected]) fail(`Unknown profile: ${selected}`);
  const ids = frozenDir ? [selected] : Object.keys(p.profiles);
  let result;
  for (const id of ids) {
    const profile = p.profiles[id];
    for (const field of ['styleId','styleRevision','scope','module','settings','output','policies','validation']) {
      if (profile[field] == null) fail(`Profile ${id} is missing ${field}`);
    }
    if (!Number.isInteger(profile.styleRevision) || profile.styleRevision < 1) fail('Invalid styleRevision');
    if (profile.validation.intent !== 'confirmed') fail(`Profile ${id} needs intent confirmation`);
    if (!['pending','verified'].includes(profile.validation.implementation)) fail('Invalid implementation validation state');
    if (profile.validation.implementation === 'verified' && !profile.validation.evidence?.length) fail('Verified implementation needs evidence');
    if (!Array.isArray(profile.scope.orientations) || !profile.scope.orientations.length || profile.scope.orientations.some(x => !['landscape','portrait','square'].includes(x))) fail('Invalid orientation scope');
    const policyIds=new Set();
    if(!Array.isArray(profile.policies)) fail('Policies must declare their execution and verification mapping');
    for(const policy of profile.policies){
      if(!policy.id || policyIds.has(policy.id) || !policy.instruction?.trim() || !['edit','base','render','check'].includes(policy.stage) || policy.executor!=='agent' || policy.verification!=='evidence-review') fail('Invalid/duplicate policy capability mapping');
      policyIds.add(policy.id);
    }
    const output = profile.output;
    if (!(Number.isInteger(output.longEdge) && output.longEdge >= 240) || !['preserve','explicit'].includes(output.fpsPolicy) || (output.fpsPolicy === 'explicit' && !(output.fps > 0))) fail('Invalid output contract');
    const moduleFile = frozenDir ? path.join(frozenDir, 'module.ts') : rootPath(profile.module.path, skillRoot);
    const adapterFile = frozenDir ? path.join(frozenDir, 'adapter.json') : rootPath(profile.module.adapter, skillRoot);
    for (const [file, expected] of [[moduleFile,profile.module.sha256],[adapterFile,profile.module.adapterSha256]]) {
      if (!/^[a-f0-9]{64}$/i.test(expected || '') || sha(file).toLowerCase() !== expected.toLowerCase()) fail(`Module/adapter hash mismatch: ${file}`);
    }
    const adapter = json(adapterFile), fields = flatten(profile.settings);
    if (adapter.schemaVersion !== 1 || !adapter.fields) fail('Unsupported adapter schema');
    for (const key of Object.keys(fields)) if (!adapter.fields[key]) fail(`Unmapped preference field: ${key}`);
    for (const [key, rule] of Object.entries(adapter.fields)) {
      const value = fields[key];
      if (value === undefined) fail(`Missing mapped preference: ${key}`);
      if (typeof value !== rule.type || (rule.enum && !rule.enum.includes(value)) || (rule.pattern && !new RegExp(rule.pattern).test(value)) || (rule.min != null && value < rule.min) || (rule.max != null && value > rule.max)) fail(`Unsupported value for ${key}: ${value}`);
    }
    if (id === selected) result = {...pref, profileId:id, profile, moduleFile, adapterFile};
  }
  return result;
}
export function prepare(file, skillRoot, runDir, profileId) {
  fs.mkdirSync(runDir, {recursive:true});
  const snapshot = path.join(runDir,'preferences.snapshot.md'), frozen = path.join(runDir,'style');
  const selection = path.join(runDir,'style-selection.json');
  if (!fs.existsSync(snapshot)) {
    const source = validate(file,skillRoot,profileId);
    fs.copyFileSync(file,snapshot,fs.constants.COPYFILE_EXCL);
    write(selection,{profile:source.profileId,preferenceSha256:sha(snapshot)});
  }
  if (!fs.existsSync(selection)) fail('Legacy run: preserve its snapshot; explicitly migrate a new run instead');
  const chosen = json(selection);
  if (profileId && profileId !== chosen.profile) fail('Existing run profile is frozen; create an explicit revision');
  if (sha(snapshot) !== chosen.preferenceSha256) fail('Frozen preference snapshot changed');
  const r = validate(snapshot,skillRoot,chosen.profile,fs.existsSync(frozen) ? frozen : undefined);
  if (!fs.existsSync(frozen)) {
    fs.mkdirSync(frozen);
    fs.copyFileSync(r.moduleFile,path.join(frozen,'module.ts'));
    fs.copyFileSync(r.adapterFile,path.join(frozen,'adapter.json'));
  }
  return {Profile:r.profileId,StyleId:r.profile.styleId,StyleModule:path.join(frozen,'module.ts'),Snapshot:snapshot,SnapshotRevision:r.value.revision,CurrentRevision:preferences(file).value.revision};
}
const compact = text => String(text).replace(/\s/g,'');
export function preflight(runDir, moduleFile, skillRoot) {
  const editorial = validatePlan(runDir);
  const snapshot = path.join(runDir,'preferences.snapshot.md');
  const selection = json(path.join(runDir,'style-selection.json'));
  if (selection.preferenceSha256 !== sha(snapshot)) fail('Preference snapshot changed');
  const r = validate(snapshot,skillRoot,selection.profile,path.join(runDir,'style'));
  if (sha(moduleFile) !== r.profile.module.sha256.toLowerCase()) fail('Selected render module differs from frozen contract; rebind an explicit revision');
  const meta = json(path.join(runDir,'meta.json'));
  if(![meta.width,meta.height,meta.fps,meta.durationSec].every(x=>Number.isFinite(x)&&x>0)) fail('Invalid prepared media metadata');
  const orientation = meta.width > meta.height ? 'landscape' : meta.width < meta.height ? 'portrait' : 'square';
  if (!r.profile.scope.orientations.includes(orientation)) fail('Profile does not support this orientation');
  if (Math.max(meta.width,meta.height) !== r.profile.output.longEdge) fail('Normalize the uncaptioned base to contract resolution, then Prep before Render');
  if (r.profile.output.fpsPolicy === 'explicit' && Math.abs(meta.fps-r.profile.output.fps) > .01) fail('Normalize base frame rate before Render');
  const transcriptFile = path.join(runDir,'transcript.json'), timingsFile = path.join(runDir,'word-timings.json');
  const transcript = json(transcriptFile), timings = json(timingsFile);
  if (!transcript.chunks?.length || !timings.beats?.length) fail('Missing native transcript/caption timings');
  if (transcript.segmentation && transcript.segmentation.status !== 'final') fail('Transcript segmentation is still draft; review semantic boundaries before Render');
  const words = transcript.chunks.flatMap(c => c.words || []);
  const beats = timings.beats;
  if (!words.length || compact(words.map(w=>w.text).join('')) !== compact(beats.flatMap(b=>b.words || []).map(w=>w.w).join(''))) fail('Caption text differs from transcript; run native Prep after segmentation');
  const f = flatten(r.profile.settings); let previous = 0; const beatIds=new Set();
  for (const b of beats) {
    if(!Number.isInteger(b.i)||beatIds.has(b.i)||!Number.isFinite(b.cueDelayMs)||Math.abs(b.cueDelayMs-b.startSec*1000)>2||!Number.isFinite(b.cueDurMs)||Math.abs(b.cueDurMs-(b.endSec-b.startSec)*1000)>2) fail('Invalid native cue ID/window; rerun Prep');
    beatIds.add(b.i);
    if (!b.words?.length || !Number.isFinite(b.startSec) || !Number.isFinite(b.endSec) || b.startSec < previous-.03 || b.endSec <= b.startSec || b.endSec > meta.durationSec+.06) fail('Invalid/overlapping/out-of-bounds caption cue');
    if (b.endSec-b.startSec > f['captions.maxCueSeconds'] || compact(b.words.map(w=>w.w).join('')).length > f['captions.maxCueChars']) fail('Caption cue exceeds distilled limits; regroup native transcript words, not comments or guessed times');
    previous=b.endSec;
    for (const word of b.words) if (!Number.isFinite(word.delayMs) || word.delayMs < b.startSec*1000-30 || word.delayMs > b.endSec*1000+30) fail('Word timing outside cue');
  }
  // Per-cue presentation annotations use native beat IDs, not a new timeline.
  const presentationFile = path.join(runDir,'presentation.json'), presentation=json(presentationFile);
  if (presentation.status !== 'final' || presentation.planSha256 !== editorial.planSha256) fail('Presentation is not final or was not derived from the editorial plan');
  if (!Array.isArray(presentation.cues) || presentation.cues.length !== beats.length) fail('Presentation must cover each native cue exactly once');
  const seen = new Set();
  for (const item of presentation.cues) {
    const beat=beats.find(b=>b.i===item.beat);
    if (!beat || seen.has(item.beat) || !Array.isArray(item.keywords) || typeof item.card !== 'string') fail('Invalid presentation cue/duplicate beat');
    seen.add(item.beat);
    const text=compact(beat.words.map(w=>w.w).join(''));
    if (item.keywords.some(k=>typeof k !== 'string' || !k || !text.includes(k))) fail('Keyword must occur in actual caption');
    const planned=editorial.plan.beats.find(beat=>beat.id===item.beat);
    if (!planned || JSON.stringify(item.keywords)!==JSON.stringify(planned.keywords) || item.card!==planned.card) fail('Presentation differs from the final editorial plan');
  }
  const cardMode=f['packaging.cards'];
  if (cardMode==='none' && presentation.cues.some(c=>c.card)) fail('Cards disabled by selected contract');
  if (cardMode==='full' && presentation.cues.some(c=>!c.card)) fail('Full cards requested but a cue has no card');
  if (cardMode==='semantic' && !presentation.cues.some(c=>c.card) && !presentation.noCardsReason) fail('Semantic cards missing; supply a content reason rather than silent fallback');
  const policyFile=path.join(runDir,'policy-review.json');
  const policyReview=r.profile.policies.length?json(policyFile):{items:[]};
  if (r.profile.policies.length && (policyReview.status !== 'final' || policyReview.planSha256 !== editorial.planSha256)) fail('Policy review is not final or was not derived from the editorial plan');
  if(!Array.isArray(policyReview.items)) fail('Missing policy evidence review');
  for(const policy of r.profile.policies){
    const reviews=policyReview.items.filter(x=>x.id===policy.id);
    if(reviews.length!==1||!['pass','not-applicable','pending-visual','planned'].includes(reviews[0].status)||!reviews[0].evidence?.trim()) fail(`Missing policy evidence: ${policy.id}`);
    if(reviews[0].status==='pending-visual'&&!['render','check'].includes(policy.stage)) fail(`Pre-render policy not implemented: ${policy.id}`);
    // A final editorial plan may state a base/render/check strategy before that stage runs.
    // Edit decisions, however, must already be executable before Cut/Render.
    if(reviews[0].status==='planned'&&['edit','base'].includes(policy.stage)) fail(`Pre-render policy not implemented: ${policy.id}`);
  }
  const resolved={schemaVersion:1,profile:r.profileId,settings:r.profile.settings,presentation,policies:r.profile.policies,policyReview,
    evidence:{preference:sha(snapshot),module:sha(moduleFile),transcript:sha(transcriptFile),timings:sha(timingsFile),presentation:sha(presentationFile)},
    visualVerificationRequired:true,implementationStatus:r.profile.validation.implementation};
  if(r.profile.policies.length) resolved.evidence.policyReview=sha(policyFile);
  const contextPath=path.join(runDir,'style.resolved.json');write(contextPath,resolved);
  return {Status:'passed-structure-only',Context:contextPath,Cues:beats.length,Profile:r.profileId,VisualVerificationRequired:true};
}
export function update(target,candidate,skillRoot,expectedHash,evidence) {
  // User approval/semantic conflict assessment are agent duties, not inferred here.
  if (!evidence?.trim()) fail('User request/confirmation evidence required');
  const before=preferences(target), after=validate(candidate,skillRoot);
  if (before.hash.toLowerCase()!==String(expectedHash).toLowerCase()) fail('Preferences changed since review; reread and resolve before writing');
  if (after.value.revision!==before.value.revision+1) fail('Update must increment revision exactly once');
  const lock=target+'.update-lock', lockFd=fs.openSync(lock,'wx');
  let committed=false, backup;
  try {
    if (sha(target).toLowerCase()!==String(expectedHash).toLowerCase()) fail('Concurrent preference change');
    backup=target+`.rev-${before.value.revision}.${Date.now()}.bak`;
    fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);
    const temp=target+`.${crypto.randomUUID()}.tmp`;
    fs.copyFileSync(candidate,temp,fs.constants.COPYFILE_EXCL);
    fs.renameSync(temp,target);
    committed=true;
    const reread=validate(target,skillRoot);
    if (reread.text!==after.text) fail('Preference read-back mismatch');
    const record={at:new Date().toISOString(),revision:after.value.revision,previousHash:expectedHash,newHash:reread.hash,evidence,backup,semanticReview:'agent must reread the full text'};
    fs.appendFileSync(path.join(path.dirname(target),'preference-updates.jsonl'),JSON.stringify(record)+'\n');
    return {...record,fullText:reread.text};
  } catch(error) {
    if(committed) fs.copyFileSync(backup,target);
    throw error;
  } finally {fs.closeSync(lockFd);fs.unlinkSync(lock);}
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [command,...args]=process.argv.slice(2);
    const result=command==='validate' ? (()=>{const r=validate(...args);return {Status:'passed-structure-only',Revision:r.value.revision,Profile:r.profileId,Module:r.moduleFile};})()
      : command==='prepare' ? prepare(...args) : command==='preflight' ? preflight(...args) : command==='update' ? update(...args) : fail('Unknown preference command');
    console.log(JSON.stringify(result));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
