import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
const directory=await mkdtemp(join(tmpdir(),'gen-community-e2e-'));
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,COMMUNITY_E2E:'1',COMMUNITY_DATA_DIR:directory,COMMUNITY_DEV_DB:'1',COMMUNITY_API_PORT:'4431',COMMUNITY_ORIGIN:'http://localhost:4430',COMMUNITY_API_ORIGIN:'http://127.0.0.1:4431'}});
const code=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',done);});
// Only the exact OS-created isolated test directory is removed.
if(resolve(directory).startsWith(resolve(tmpdir())+requireSeparator()))await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:1000});
process.exitCode=code??1;
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
