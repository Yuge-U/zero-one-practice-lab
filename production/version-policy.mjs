import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function versionParts(value) {
  assert.match(value,/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,'Use a major.minor.patch app version');
  assert.equal(value,value.trim(),'Version must not contain whitespace');
  const parts=value.split('.').map(Number);assert(parts.every(Number.isSafeInteger),'Version component is too large');return parts;
}
export function assertVersionIncrease(previous,next) {
  const before=versionParts(previous),after=versionParts(next);
  const changed=after.findIndex((part,index)=>part!==before[index]);
  assert(changed>=0&&after[changed]>before[changed],`Published changes must increase the app version: ${previous} → ${next}`);
}
export function comparisonCommit(eventName,event,repository) {
  if(eventName==='workflow_dispatch')return null; // Rebuilding the same release is allowed.
  assert(['pull_request','push'].includes(eventName),'Unsupported release event');
  if(eventName==='pull_request') {
    assert.equal(event.pull_request?.base?.repo?.full_name,repository,'Unexpected base repository');
    assert.equal(event.pull_request.base.ref,'main','Release PR must target main');
  }else assert.equal(event.ref,'refs/heads/main','Release push must target main');
  const sha=eventName==='pull_request'?event.pull_request.base.sha:event.before;
  assert.match(sha,/^[a-f0-9]{40}$/,'Missing release comparison commit');assert(!/^0+$/.test(sha));return sha;
}
async function checkRelease() {
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const base=comparisonCommit(process.env.GITHUB_EVENT_NAME,event,process.env.GITHUB_REPOSITORY);
  const release=JSON.parse(await readFile('production/release.json','utf8'));versionParts(release.version);
  if(!base){console.log('Rebuilding version',release.version);return;}
  const previous=JSON.parse(execFileSync('git',['show',`${base}:production/release.json`],{encoding:'utf8'}));
  assertVersionIncrease(previous.version,release.version);console.log('Release version increases:',previous.version,'→',release.version);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await checkRelease();
