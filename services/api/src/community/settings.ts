import type {Queryable} from './store.js';
import {SecretBox} from '../crypto.js';
export class ProviderSettings {
 private readonly box:SecretBox;
 constructor(readonly db:Queryable,key:Buffer){this.box=new SecretBox(key);}
 async migrate(){await this.db.query('CREATE TABLE IF NOT EXISTS community_provider_settings (owner text PRIMARY KEY,ciphertext text NOT NULL,iv text NOT NULL,tag text NOT NULL)');}
 async save(owner:string,key:string){
  const v=this.box.encrypt(key,`fal:${owner}`);
  await this.db.query('INSERT INTO community_provider_settings(owner,ciphertext,iv,tag) VALUES($1,$2,$3,$4) ON CONFLICT(owner) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,iv=EXCLUDED.iv,tag=EXCLUDED.tag',[owner,v.ciphertext.toString('base64'),v.iv.toString('base64'),v.tag.toString('base64')]);
 }
 async key(owner:string){
  const row=(await this.db.query<{ciphertext:string;iv:string;tag:string}>('SELECT * FROM community_provider_settings WHERE owner=$1',[owner])).rows[0];
  return row?this.box.decrypt<string>({ciphertext:Buffer.from(row.ciphertext,'base64'),iv:Buffer.from(row.iv,'base64'),tag:Buffer.from(row.tag,'base64')},`fal:${owner}`):null;
 }
 async publicStatus(owner:string){return {configured:!!await this.key(owner)};}
 async clear(owner:string){await this.db.query('DELETE FROM community_provider_settings WHERE owner=$1',[owner]);}
}
