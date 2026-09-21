import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportSource} from './export-source.mjs';

test('exports only explicit source files with reproducible content hashes', async () => {
  const root=await mkdtemp(join(tmpdir(),'gen-export-'));
  try {
    await mkdir(join(root,'source')); await writeFile(join(root,'source','core.ts'),'export const value = 1;');
    await writeFile(join(root,'source','.env'),'SECRET=private');
    const result=await exportSource(join(root,'source'),join(root,'out'),['core.ts']);
    assert.equal(await readFile(join(root,'out','core.ts'),'utf8'),'export const value = 1;');
    assert.equal(result.length,1); assert.match(result[0].sha256,/^[a-f0-9]{64}$/);
    await assert.rejects(readFile(join(root,'out','.env')));
  } finally {await rm(root,{recursive:true,force:true});}
});
test('rejects credential paths, traversal and existing output files before copying',async()=>{
  for(const path of ['../secret','.env','nested/.env.production','.git/config','logs/access.log']) {
    await assert.rejects(exportSource('/unused','/unused-out',[path]),/unsafe_export_path/);
  }
});
