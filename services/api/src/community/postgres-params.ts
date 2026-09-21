// Queryable receives serialized JSON for PGlite. postgres.js serializes jsonb
// parameters itself, so decode only explicitly JSON-cast parameters once.
export function postgresParams(statement:string,params:unknown[]):unknown[]{
 const jsonIndexes=new Set([...statement.matchAll(/\$(\d+)\s*::\s*jsonb?\b/gi)].map(match=>Number(match[1])-1));
 return params.map((value,index)=>jsonIndexes.has(index)&&typeof value==='string'?JSON.parse(value):value);
}
