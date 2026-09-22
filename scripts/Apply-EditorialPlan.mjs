// Turn a final full-film editorial plan into OpenEdit-native execution files.
// This deliberately emits sources/transcripts/ranges rather than introducing a second timeline format.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validate as validatePlan} from './editorial-plan.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeNew = (file, value) => {
  if (fs.existsSync(file)) {
    const existing = read(file);
    if (JSON.stringify(existing) === JSON.stringify(value)) return false;
    throw new Error(`Refusing to overwrite existing execution file: ${file}`);
  }
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  return true;
};
const wordsOf = transcript => transcript.chunks.flatMap(chunk => chunk.words || []);

function segmentedTranscript(runDir, plan, sourceFile, outputFile) {
  const source = read(sourceFile), words = wordsOf(source), ends = plan.segmentation.boundaries;
  let previous = 0;
  const chunks = ends.map(end => {
    const part = words.slice(previous, end); previous = end;
    return {text: part.map(w => w.text).join(''), timestamp: [part[0].timestamp[0], part.at(-1).timestamp[1]], words: part};
  });
  const derived = {...source, text: chunks.map(c => c.text).join(''), chunks,
    segmentation: {source: path.resolve(sourceFile), boundaries: ends, status: 'final', reason: plan.segmentation.reason}};
  if (fs.existsSync(outputFile)) {
    const existing = read(outputFile);
    const sameWords = JSON.stringify(wordsOf(existing)) === JSON.stringify(wordsOf(derived));
    const sameBounds = JSON.stringify(existing.segmentation?.boundaries) === JSON.stringify(derived.segmentation.boundaries);
    if (!sameWords || !sameBounds || existing.segmentation?.status !== 'final') throw new Error(`Existing derived transcript differs from the final plan: ${outputFile}`);
  } else writeNew(outputFile, derived);
  return outputFile;
}

function rangesFor(plan, duration) {
  const window = plan.sourceWindow || {startSec: 0, endSec: duration};
  const cuts = [...plan.cuts].sort((a, b) => a.startSec - b.startSec);
  const ranges = [];
  let cursor = window.startSec;
  for (const cut of cuts) {
    if (cut.startSec > cursor + .001) ranges.push({start: cursor, end: cut.startSec, note: '保留：全片计划决定'});
    cursor = Math.max(cursor, cut.endSec);
  }
  if (window.endSec > cursor + .001) ranges.push({start: cursor, end: window.endSec, note: '保留：全片计划决定'});
  if (!ranges.length) throw new Error('Editorial plan keeps no source range');
  return ranges.map(r => ({source: 'talk', start: Number(r.start.toFixed(3)), end: Number(r.end.toFixed(3)), note: r.note}));
}

export function apply(runDir) {
  const validated = validatePlan(runDir), plan = validated.plan;
  const meta = read(path.join(runDir, 'meta.json'));
  const transcript = path.join(runDir, plan.source.transcript);
  const plannedTranscript = path.join(runDir, 'plan-transcript.json');
  segmentedTranscript(runDir, plan, transcript, plannedTranscript);
  const media = meta.videoPath || read(path.join(runDir, 'source-identity.json')).Prepared;
  const edlFile = path.join(runDir, 'editorial-plan.edl.json');
  const edl = {
    sources: {talk: media},
    transcripts: {talk: plannedTranscript},
    ranges: rangesFor(plan, Number(meta.durationSec)),
    editorialPlan: {file: path.join(runDir, 'editorial-plan.json'), sha256: validated.planSha256}
  };
  writeNew(edlFile, edl);
  return {status: 'materialized', planSha256: validated.planSha256, transcript: plannedTranscript, edl: edlFile, ranges: edl.ranges.length};
}

// Project the full-film decisions onto the retimed transcript produced by Cut.
// OpenEdit preserves source chunk boundaries when retiming, so kept beats map by
// their original chunk index; deleted beats simply disappear from the execution plan.
export function projectAfterCut(sourcePlanFile, cutRunDir, outputFile = path.join(cutRunDir, 'editorial-plan.json')) {
  sourcePlanFile = fs.statSync(sourcePlanFile).isDirectory() ? path.join(sourcePlanFile, 'editorial-plan.json') : sourcePlanFile;
  cutRunDir = path.resolve(cutRunDir);
  const original = read(sourcePlanFile), cutTranscriptFile = path.join(cutRunDir, 'transcript.json');
  const cutTranscript = read(cutTranscriptFile), chunks = cutTranscript.chunks || [];
  const kept = original.beats.filter(beat => beat.keep);
  const sourceTranscript = read(path.join(path.dirname(sourcePlanFile), original.source.transcript));
  const sourceWords = wordsOf(sourceTranscript);
  // Native retiming owns frame snapping. Map only complete, unchanged chunks;
  // partial cuts or mismatches need Agent inspection rather than guessed tolerance.
  if(chunks.length !== kept.length) throw new Error('Agent recovery required: cut chunk count differs from kept semantic beats');
  const counts = kept.map((beat,index) => {
    const expected=sourceWords.slice(beat.startWord,beat.endWord).map(w=>w.text);
    const actual=chunks[index].words.map(w=>w.text);
    if(JSON.stringify(expected)!==JSON.stringify(actual)) throw new Error('Agent recovery required: cut words differ from reviewed beat');
    return actual.length;
  });
  let cursor = 0;
  const beats = kept.map((beat, index) => {
    const count = counts[index], startWord = cursor; cursor += count;
    return {...beat, id: index + 1, startWord, endWord: cursor};
  });
  const projected = {
    ...original,
    source: {transcript: 'transcript.json', transcriptSha256: sha(cutTranscriptFile), wordCount: cursor, parentPlan: path.resolve(sourcePlanFile), parentPlanSha256: sha(sourcePlanFile)},
    sourceWindow: undefined,
    segmentation: {status: 'final', boundaries: beats.map(b => b.endWord), reason: '由 OpenEdit Cut 的重定时转录保留原计划中的语义 beat'},
    cuts: [], beats,
    policyReview: original.policyReview
  };
  delete projected.sourceWindow;
  writeNew(outputFile, projected);
  return {plan: outputFile, beats: beats.length, words: cursor, parentPlanSha256: projected.source.parentPlanSha256};
}

// Make the reviewed semantic transcript the native transcript for a fresh source run while retaining
// the provider output. This is opt-in because it changes which transcript Prep reads.
export function materialize(runDir) {
  const first = apply(runDir);
  const source = path.join(runDir, 'transcript.json'), archive = path.join(runDir, 'transcript.source.json');
  if (fs.existsSync(archive)) throw new Error(`Refusing to replace an already materialized run: ${runDir}`);
  fs.renameSync(source, archive);
  fs.copyFileSync(path.join(runDir, 'plan-transcript.json'), source, fs.constants.COPYFILE_EXCL);
  const planFile = path.join(runDir, 'editorial-plan.json'), reviewed = path.join(runDir, 'editorial-plan.reviewed.json');
  fs.copyFileSync(planFile, reviewed, fs.constants.COPYFILE_EXCL);
  const plan = read(planFile);
  plan.source.transcript = 'transcript.source.json';
  plan.source.transcriptSha256 = sha(archive);
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2) + '\n');
  // The first pass already produced the reviewed semantic transcript. Do not run the
  // derivation a second time: it would try to overwrite the preserved derived file.
  const edl = read(first.edl); edl.transcripts.talk = source;
  fs.writeFileSync(first.edl, JSON.stringify(edl, null, 2) + '\n');
  return {...first, transcript: source, archivedTranscript: archive, reviewedPlan: reviewed};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [command, runDir, cutDir, outputFile] = process.argv.slice(2);
    const result = command === 'apply' ? apply(runDir) : command === 'materialize' ? materialize(runDir) : command === 'project-after-cut' ? projectAfterCut(path.resolve(runDir), path.resolve(cutDir), outputFile ? path.resolve(outputFile) : undefined) : (() => { throw new Error('Unknown editorial plan command'); })();
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
