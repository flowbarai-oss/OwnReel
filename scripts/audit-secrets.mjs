import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{40,}/,/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[a-f0-9]{24,}\b/i,/\bsk-(?:live|test)-[A-Za-z0-9]{24,}\b/];
const forbidden=/(^|\/)(?:\.env(?!\.example$)|master\.key|bootstrap-token|postgres-dev|receipts)(\/|$)|\.(?:pem|pfx|sqlite|dump|bak)$/i;
const findings=[];
for(const file of [...new Set(files)]){if(forbidden.test(file)){findings.push(`${file}: forbidden artifact`);continue;}const text=await readFile(file,'utf8');if(patterns.some(p=>p.test(text)))findings.push(`${file}: credential-like content`);}
// Inspect all committed blobs as well as the current candidate tree.
const commits=execFileSync('git',['rev-list','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const commit of commits){const names=execFileSync('git',['ls-tree','-r','--name-only',commit],{encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of names){const text=execFileSync('git',['show',`${commit}:${file}`],{encoding:'utf8',maxBuffer:20*1024*1024});if(forbidden.test(file)||patterns.some(p=>p.test(text)))findings.push(`${commit.slice(0,7)}:${file}: committed credential-like content`);}}
if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}else console.log(`PASS: ${files.length} working-tree files and ${commits.length} commits scanned. No recognized credentials; manual review still required.`);
