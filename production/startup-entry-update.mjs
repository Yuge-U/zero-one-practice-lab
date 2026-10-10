import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const file=join(process.argv[2],'web/practice-startup.js'),source=await readFile(file,'utf8');
const before='  async function load() {\n    attempt++;';
assert.equal(source.split(before).length,2,'Startup entry patch target');
const after=`  async function load() {
    const entry = new URL(root.location.href);
    const authKeys = ['code', 'state', 'error', 'id_token', 'access_token'];
    const authReturn = [...entry.searchParams.keys(), ...new URLSearchParams(entry.hash.slice(1)).keys()].some(key => authKeys.includes(key));
    if ((entry.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(entry.hostname)) && !authReturn && entry.searchParams.get('brand') !== '20261007k') {
      entry.searchParams.set('brand', '20261007k'); root.location.replace(entry.href); return;
    }
    attempt++;`;
await writeFile(file,source.replace(before,after));
