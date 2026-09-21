// Keep the same key after an ambiguous network failure; clear only on receipt.
export class SubmissionIntent {
 private pending=new Map<string,string>();
 key(kind:string,input:Record<string,unknown>){const hash=JSON.stringify([kind,input]);let key=this.pending.get(hash);if(!key){key=crypto.randomUUID();this.pending.set(hash,key);}return key;}
 acknowledge(kind:string,input:Record<string,unknown>){this.pending.delete(JSON.stringify([kind,input]));}
}
