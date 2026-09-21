import type {FastifyInstance} from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import {scrypt,randomBytes,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {sha256Hex,opaqueToken} from '../crypto.js';
import type {CommunityStore,User} from './store.js';
declare module 'fastify' {interface FastifyRequest {communityUser:User|null}}
const credentials=z.object({name:z.string().trim().min(3).max(80).regex(/^[\p{L}\p{N}_.@-]+$/u),password:z.string().min(1).max(256)});
const derive=(value:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(value,salt,64,(e,key)=>e?reject(e):resolve(key)));
const safeEqual=(a:string,b:string)=>timingSafeEqual(Buffer.from(sha256Hex(a),'hex'),Buffer.from(sha256Hex(b),'hex'));
export async function registerCommunityAuth(app:FastifyInstance,store:CommunityStore,options:{origin:string;setupToken:string;setupExpires:number}){
 const origin=new URL(options.origin).origin;
 const secure=origin.startsWith('https:');const cookieName=secure?'__Host-community_session':'community_session';
 await app.register(cookie);await app.register(rateLimit,{max:process.env.COMMUNITY_E2E==='1'?1000:120,timeWindow:'1 minute'});
 app.decorateRequest('communityUser',null);
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin!==origin)return reply.code(403).send({success:false,code:'origin_rejected'});
  const path=req.url.split('?')[0];
  if(['/health','/api/community/status','/api/community/setup','/api/community/login'].includes(path))return;
  const token=req.cookies[cookieName];const user=token?await store.session(sha256Hex(token)):null;
  if(!user)return reply.code(401).send({success:false,code:'authentication_required'});
  req.communityUser=user;
 });
 app.get('/api/community/status',async()=>({success:true,data:{initialized:await store.initialized()}}));
 app.post('/api/community/setup',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
  if(await store.initialized())return reply.code(409).send({success:false,code:'already_initialized'});
  const parsed=credentials.extend({password:z.string().min(12).max(256),token:z.string()}).safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({success:false,code:'invalid_setup'});
  if(Date.now()>options.setupExpires || !safeEqual(parsed.data.token,options.setupToken))return reply.code(403).send({success:false,code:'setup_token_invalid_or_expired'});
  const salt=randomBytes(16).toString('hex');const hash=(await derive(parsed.data.password,salt)).toString('hex');
  try{await store.initialize(parsed.data.name,`${salt}:${hash}`);}catch(e){if((e as Error).message==='already_initialized')return reply.code(409).send({success:false,code:'already_initialized'});throw e;}
  return {success:true,data:{initialized:true}};
 });
 app.post('/api/community/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
  const parsed=credentials.safeParse(req.body);if(!parsed.success)return reply.code(400).send({success:false,code:'invalid_credentials'});
  const user=await store.userByName(parsed.data.name);const [salt,hash]=(user?.password_hash??`${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const valid=safeEqual((await derive(parsed.data.password,salt)).toString('hex'),hash);
  if(!user||!valid)return reply.code(401).send({success:false,code:'invalid_credentials'});
  const token=opaqueToken();await store.createSession(user.id,sha256Hex(token),new Date(Date.now()+7*86400000));
  reply.setCookie(cookieName,token,{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge:7*86400});
  return {success:true,data:{id:user.id,name:user.name}};
 });
 app.get('/api/community/me',async(req)=>({success:true,data:{id:req.communityUser!.id,name:req.communityUser!.name}}));
 app.post('/api/community/logout',async(req,reply)=>{
  await store.deleteSession(sha256Hex(req.cookies[cookieName]??''));reply.clearCookie(cookieName,{path:'/',secure,httpOnly:true,sameSite:'strict'});return {success:true,data:{loggedOut:true}};
 });
}
