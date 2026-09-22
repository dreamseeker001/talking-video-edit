// Materialize execution files from the reviewed full-film editorial plan.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validate as validatePlan} from './editorial-plan.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const writeNew = (file, value) => {
  if (fs.existsSync(file)) throw new Error(`Refusing to overwrite existing annotation: ${file}`);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag:'wx'});
};

export function initialize(runDir) {
  for (const name of ['presentation.json','policy-review.json']) {
    if (fs.existsSync(path.join(runDir,name))) throw new Error(`Refusing to overwrite existing annotation: ${name}; preserve the pair before regenerating`);
  }
  const plan = validatePlan(runDir);
  const timings = readJson(path.join(runDir, 'word-timings.json'));
  if (!Array.isArray(timings.beats) || !timings.beats.length) throw new Error('Missing native word-timings beats');
  if (timings.beats.length !== plan.plan.beats.length) throw new Error('Native Prep beats do not match the final editorial plan; rebind the plan after segmentation');
  const presentation = {
    schemaVersion: 1,
    status: 'final',
    planSha256: plan.planSha256,
    ...(plan.plan.beats.some(beat => beat.card) ? {} : {noCardsReason: '本片全片无卡片：见 editorial plan 的语义判断。'}),
    cues: plan.plan.beats.map(beat => ({beat: beat.id, keywords: beat.keywords, card: beat.card}))
  };
  writeNew(path.join(runDir, 'presentation.json'), presentation);
  writeNew(path.join(runDir, 'policy-review.json'), {
    schemaVersion: 1,
    status: 'final',
    planSha256: plan.planSha256,
    items: plan.plan.policyReview.items
  });
  return {cues: presentation.cues.length, policies: plan.plan.policyReview.items.length, status: 'final'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(initialize(process.argv[2]))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
