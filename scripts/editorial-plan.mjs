// The full-film editorial plan is the source of truth before any cut or render.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fail = message => { throw new Error(message); };
const wordsOf = transcript => transcript.chunks.flatMap(chunk => chunk.words || []);
const writeNew = (file, value) => {
  if (fs.existsSync(file)) fail(`Refusing to overwrite editorial plan: ${file}`);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag:'wx'});
};

export function initialize(runDir) {
  const transcriptFile = path.join(runDir, 'transcript.json');
  const transcript = read(transcriptFile), words = wordsOf(transcript);
  if (!words.length) fail('Missing transcript words');
  const plan = {
    schemaVersion: 1,
    status: 'draft',
    source: {transcript: 'transcript.json', transcriptSha256: sha(transcriptFile), wordCount: words.length},
    segmentation: {status: 'draft', boundaries: [words.length], reason: 'Agent must replace mechanical boundary with reviewed semantic boundaries'},
    cuts: [],
    beats: [{id: 1, startWord: 0, endWord: words.length, keep: true, reason: '', confidence: 'pending', keywords: [], card: ''}],
    policyReview: {status: 'draft', items: []}
  };
  writeNew(path.join(runDir, 'editorial-plan.json'), plan);
  return {status: plan.status, words: words.length, beats: plan.beats.length};
}

export function validate(runDir) {
  const planFile = path.join(runDir, 'editorial-plan.json');
  const plan = read(planFile), transcriptFile = path.join(runDir, plan.source?.transcript || 'transcript.json');
  const transcript = read(transcriptFile), words = wordsOf(transcript);
  if (plan.schemaVersion !== 1 || plan.status !== 'final') fail('Editorial plan is not final; complete the full-film decision pass before Cut');
  if (plan.source.transcriptSha256 !== sha(transcriptFile) || plan.source.wordCount !== words.length) fail('Editorial plan source transcript changed; rebuild the plan');
  const boundaries = plan.segmentation?.boundaries;
  if (plan.segmentation?.status !== 'final' || !Array.isArray(boundaries) || boundaries.at(-1) !== words.length) fail('Editorial segmentation is not final or does not cover every word');
  let previous = 0;
  for (const boundary of boundaries) {
    if (!Number.isInteger(boundary) || boundary <= previous || boundary > words.length) fail('Invalid editorial segmentation boundary');
    previous = boundary;
  }
  if (!Array.isArray(plan.beats) || plan.beats.length !== boundaries.length) fail('Editorial beats must match reviewed segmentation');
  previous = 0;
  for (let i = 0; i < plan.beats.length; i++) {
    const beat = plan.beats[i];
    if (beat.id !== i + 1 || beat.startWord !== previous || beat.endWord !== boundaries[i] || typeof beat.keep !== 'boolean' || !beat.reason?.trim() || beat.confidence === 'pending') fail('Editorial beat decision is incomplete');
    if (!Array.isArray(beat.keywords) || typeof beat.card !== 'string') fail('Editorial beat presentation is incomplete');
    previous = beat.endWord;
  }
  if (!Array.isArray(plan.cuts)) fail('Editorial cuts must be an array');
  const sourceDuration = Number(read(path.join(runDir, 'meta.json')).durationSec);
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) fail('Missing prepared source duration for editorial plan');
  const sortedCuts = [...plan.cuts].sort((a, b) => a.startSec - b.startSec);
  let previousCutEnd = 0;
  for (const cut of sortedCuts) {
    if (!Number.isFinite(cut.startSec) || !Number.isFinite(cut.endSec) || cut.startSec < 0 || cut.endSec <= cut.startSec || cut.endSec > sourceDuration + .1 || cut.startSec < previousCutEnd - .001 || !cut.reason?.trim() || cut.confidence === 'pending') fail('Editorial cut decision is incomplete or overlapping');
    previousCutEnd = cut.endSec;
  }
  if (plan.sourceWindow) {
    if (!Number.isFinite(plan.sourceWindow.startSec) || !Number.isFinite(plan.sourceWindow.endSec) || plan.sourceWindow.startSec < 0 || plan.sourceWindow.endSec <= plan.sourceWindow.startSec || plan.sourceWindow.endSec > sourceDuration + .1 || !plan.sourceWindow.reason?.trim()) fail('Editorial source window is invalid');
    if (sortedCuts.some(c => c.startSec < plan.sourceWindow.startSec - .001 || c.endSec > plan.sourceWindow.endSec + .001)) fail('Editorial cut falls outside the selected source window');
  }
  if (plan.policyReview?.status !== 'final' || !Array.isArray(plan.policyReview.items)) fail('Editorial policy review is not final');
  return {plan, planFile, planSha256: sha(planFile), transcriptFile};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [command, runDir] = process.argv.slice(2);
    console.log(JSON.stringify(command === 'initialize' ? initialize(runDir) : command === 'validate' ? validate(runDir) : fail('Unknown editorial plan command')));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
