import type {Queryable} from './store.js';
import {randomUUID} from 'node:crypto';
import {sha256Hex} from '../crypto.js';
export type JobState='queued'|'processing'|'submitting'|'polling'|'reconciling'|'ready'|'failed'|'cancelled';
export interface CommunityJob {id:string;owner:string;kind:string;input:Record<string,unknown>;state:JobState;lease_token:string;lease_until:Date;provider:Record<string,unknown>|null;result:Record<string,unknown>|null;created_at:Date;updated_at:Date;deadline_at:Date}
export class JobQueue {
 constructor(readonly db:Queryable){}
 async migrate(){await this.db.query(`CREATE TABLE IF NOT EXISTS community_jobs (
  id uuid PRIMARY KEY,owner uuid NOT NULL REFERENCES community_users(id),idempotency_key text NOT NULL,input_hash text NOT NULL,kind text NOT NULL,input jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued',lease_token text,lease_until timestamptz,available_at timestamptz NOT NULL DEFAULT now(),
  provider jsonb,result jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner,idempotency_key))`);
  await this.db.query("ALTER TABLE community_jobs ADD COLUMN IF NOT EXISTS deadline_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours')");}
 async submit(owner:string,key:string,kind:string,input:Record<string,unknown>){
  const encoded=JSON.stringify(input),hash=sha256Hex(kind+':'+encoded);
  await this.db.query('INSERT INTO community_jobs(id,owner,idempotency_key,input_hash,kind,input) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(owner,idempotency_key) DO NOTHING',[randomUUID(),owner,key,hash,kind,encoded]);
  const row=(await this.db.query<CommunityJob & {input_hash:string}>('SELECT * FROM community_jobs WHERE owner=$1 AND idempotency_key=$2',[owner,key])).rows[0];
  if(row.input_hash!==hash)throw new Error('idempotency_conflict');return row;
 }
 async claim(){
  await this.db.query("UPDATE community_jobs SET state='reconciling',lease_token=NULL,updated_at=now() WHERE state='submitting' AND lease_until<now()");
  return (await this.db.query<CommunityJob>(`UPDATE community_jobs SET lease_token=$1,lease_until=now()+interval '5 minutes',state=CASE WHEN state='queued' THEN 'processing' ELSE state END,updated_at=now()
   WHERE id=(SELECT id FROM community_jobs WHERE (state IN ('queued','polling') OR state='processing' AND lease_until<now()) AND (lease_until IS NULL OR lease_until<now()) AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[randomUUID()])).rows[0]??null;
 }
 async markSubmitting(id:string,lease:string){await this.change(id,lease,"state='submitting'");}
 private async change(id:string,lease:string,clause:string,params:unknown[]=[]){
  const rows=(await this.db.query(`UPDATE community_jobs SET ${clause},updated_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now() RETURNING id`,[id,lease,...params])).rows;
  if(!rows.length)throw new Error('lease_lost');
 }
 async finish(id:string,lease:string,state:JobState,result:Record<string,unknown>){await this.change(id,lease,'state=$3,result=$4::jsonb,lease_token=NULL,lease_until=NULL',[state,JSON.stringify(result)]);}
 async get(owner:string,id:string){return (await this.db.query<CommunityJob>('SELECT * FROM community_jobs WHERE owner=$1 AND id=$2',[owner,id])).rows[0]??null;}
 async defer(id:string,lease:string,provider:Record<string,unknown>){await this.change(id,lease,"state='polling',provider=$3::jsonb,lease_token=NULL,lease_until=NULL,available_at=now()+interval '5 seconds'",[JSON.stringify(provider)]);}
 async heartbeat(id:string,lease:string){await this.change(id,lease,"lease_until=now()+interval '5 minutes'");}
}
