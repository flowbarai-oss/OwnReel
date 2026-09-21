import {expect,test} from 'vitest';
import {readableError} from './api';
test('provider balance, permissions and unsupported settings have bilingual corrective guidance',()=>{
 for(const code of ['provider_http_402','provider_http_403','provider_http_422'])for(const locale of ['en','zh-CN']){
  const result=readableError(new Error(code),locale);expect(result).not.toContain(code);expect(result.length).toBeGreaterThan(20);
 }
 expect(readableError(new Error('provider_http_402'))).toContain('fal.ai');
});
