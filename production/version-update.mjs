import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {assertVersionIncrease} from './version-policy.mjs';
import assert from 'node:assert/strict';

// Historical patches reconstruct 1.3.4. The release descriptor owns the final version.
export async function stampVersion(app,version) {
  assertVersionIncrease('1.3.4',version);
  for(const [name,count] of [['config.mjs',2],['core/service.mjs',1],['index.html',2],['sw.js',4]]) {
    const path=join(app,'web',name),source=await readFile(path,'utf8');
    assert.equal(source.split('1.3.4').length-1,count,'Version patch target: '+name);
    await writeFile(path,source.replaceAll('1.3.4',version));
  }
  for(const name of await readdir(join(app,'tools'))) {
    if(!name.endsWith('.mjs'))continue;
    const path=join(app,'tools',name),source=await readFile(path,'utf8');
    const updated=source.replaceAll('1.3.4',version).replaceAll(String.raw`1\.3\.4`,version.replaceAll('.',String.raw`\.`));
    if(updated!==source)await writeFile(path,updated);
  }
}
