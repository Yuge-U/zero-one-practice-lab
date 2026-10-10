import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const file=join(process.argv[2],'web/practice-startup.js');let source=await readFile(file,'utf8');
function replace(before,after){assert.equal(source.split(before).length,2,before);source=source.replace(before,after);}
replace("function reload() { if (reloadGuard", "function reload() { if (!reloadGuard && !executing && get('searchPicker')) { show('起動コードの更新を確認できません。編集中の内容を保存してから、このPRACTICEタブを閉じて開き直してください。', true); return; } if (reloadGuard");
replace("code(error) === 'TypeError' && !executing", "code(error) === 'TypeError' && !executing && !get('searchPicker')");
await writeFile(file,source);
