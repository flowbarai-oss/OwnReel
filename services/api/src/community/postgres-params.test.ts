import {expect,test} from 'vitest';
import {postgresParams} from './postgres-params.js';
test('postgres JSON parameters are not double-encoded and unrelated strings stay untouched',()=>{
 expect(postgresParams('SELECT $1,$2::jsonb,$3::json,$4',['name','{"assetIds":[]}','{"state":"ready"}','{"literal":true}'])).toEqual(['name',{assetIds:[]},{state:'ready'},'{"literal":true}']);
 expect(()=>postgresParams('SELECT $1::jsonb',['not json'])).toThrow();
});
