import {randomUUID} from 'node:crypto';
export interface Queryable {query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>}
export interface User {id:string;name:string;password_hash:string}
export interface Document {id:string;owner:string;kind:string;revision:number;data:Record<string,unknown>;created_at:Date;updated_at:Date}
export class CommunityStore {
 constructor(readonly db:Queryable){}
 async migrate(){
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS community_users (id uuid PRIMARY KEY, name text UNIQUE NOT NULL, password_hash text NOT NULL, singleton boolean UNIQUE NOT NULL DEFAULT true CHECK(singleton))',
   'CREATE TABLE IF NOT EXISTS community_sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES community_users(id), expires_at timestamptz NOT NULL)',
   'CREATE TABLE IF NOT EXISTS community_documents (id uuid PRIMARY KEY, owner uuid NOT NULL REFERENCES community_users(id), kind text NOT NULL, revision integer NOT NULL DEFAULT 1, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())',
   'CREATE INDEX IF NOT EXISTS community_documents_owner_kind ON community_documents(owner,kind)',
  ])await this.db.query(sql);
 }
 async initialized(){return (await this.db.query('SELECT id FROM community_users LIMIT 1')).rows.length>0;}
 async initialize(name:string,hash:string){
  const row=(await this.db.query<User>('INSERT INTO community_users(id,name,password_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *',[randomUUID(),name,hash])).rows[0];
  if(!row)throw new Error('already_initialized');return row;
 }
 async userByName(name:string){return (await this.db.query<User>('SELECT * FROM community_users WHERE name=$1',[name])).rows[0]??null;}
 async createSession(id:string,token:string,expires:Date){await this.db.query('INSERT INTO community_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[token,id,expires]);}
 async session(token:string){return (await this.db.query<User>('SELECT u.* FROM community_users u JOIN community_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()',[token])).rows[0]??null;}
 async deleteSession(token:string){await this.db.query('DELETE FROM community_sessions WHERE token_hash=$1',[token]);}
 async createDocument(owner:string,kind:string,data:Record<string,unknown>){return (await this.db.query<Document>('INSERT INTO community_documents(id,owner,kind,data) VALUES($1,$2,$3,$4::jsonb) RETURNING *',[randomUUID(),owner,kind,JSON.stringify(data)])).rows[0];}
 async updateDocument(owner:string,kind:string,id:string,revision:number,data:Record<string,unknown>){
  const row=(await this.db.query<Document>('UPDATE community_documents SET data=$5::jsonb,revision=revision+1,updated_at=now() WHERE owner=$1 AND kind=$2 AND id=$3 AND revision=$4 RETURNING *',[owner,kind,id,revision,JSON.stringify(data)])).rows[0];
  if(!row)throw new Error('revision_conflict');return row;
 }
 async document(owner:string,kind:string,id:string){return (await this.db.query<Document>('SELECT * FROM community_documents WHERE owner=$1 AND kind=$2 AND id=$3',[owner,kind,id])).rows[0]??null;}
}
