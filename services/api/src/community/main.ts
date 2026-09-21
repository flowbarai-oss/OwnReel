import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {buildCommunityApp} from './app.js';
import type {Queryable} from './store.js';
import {postgresParams} from './postgres-params.js';
const root=resolve(process.env.COMMUNITY_DATA_DIR??'data');await mkdir(root,{recursive:true});
const keyFile=join(root,'master.key');
try{await writeFile(keyFile,randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
await chmod(keyFile,0o600);const masterKey=await readFile(keyFile);if(masterKey.length!==32)throw new Error('invalid_master_key');
let db:Queryable,close:()=>Promise<unknown>;
if(process.env.COMMUNITY_DEV_DB==='1'){
 if(process.env.NODE_ENV==='production')throw new Error('development_database_forbidden_in_production');
 const {PGlite}=await import('@electric-sql/pglite');const pglite=new PGlite(join(root,'postgres-dev'));await pglite.waitReady;db=pglite;close=()=>pglite.close();
}else{
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL_required_see_README');
 const sql=postgres(process.env.DATABASE_URL,{max:5});db={async query<T>(text:string,params:unknown[]=[]){return {rows:await sql.unsafe(text,postgresParams(text,params) as never[]) as unknown as T[]};}};close=()=>sql.end();
}
const token=randomBytes(24).toString('base64url');
const app=await buildCommunityApp({db,mediaRoot:join(root,'media'),masterKey,origin:process.env.COMMUNITY_ORIGIN??'http://localhost:4420',setupToken:token,setupExpires:Date.now()+30*60000});
if(!await app.community.store.initialized()){await writeFile(join(root,'bootstrap-token'),token,{mode:0o600});console.log(`One-time setup token is in ${join(root,'bootstrap-token')} (expires in 30 minutes).`);}
let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{await app.community.runtime.tick();}catch{console.error('Worker tick failed; persisted jobs remain recoverable.');}finally{busy=false;}},1500);
await app.listen({host:process.env.COMMUNITY_BIND??'127.0.0.1',port:Number(process.env.COMMUNITY_API_PORT??4421)});
console.log('Community API ready. No production authentication or wallet is used.');
const stop=async()=>{clearInterval(timer);await app.close();await close();process.exit(0);};
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
