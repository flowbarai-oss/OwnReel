import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loginLocal} from './login';
test('paid image → owned image-to-video → project editor → playable export',async({page})=>{
 test.skip(process.env.COMMUNITY_REAL_PROOF!=='1','Explicit paid acceptance only, never ordinary CI');test.setTimeout(1200000);
 const directory=process.env.COMMUNITY_EVIDENCE_DIR;if(!directory)throw new Error('Private evidence directory required');
 const path=join(directory,'ui-paid-journey.json');
 try{await readFile(path);throw new Error('Existing paid journey evidence found. Inspect and reconcile before another run.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const budgetPath=join(directory,'paid-acceptance.json'),budget=JSON.parse(await readFile(budgetPath,'utf8'));if(budget.reservedUsd+1.1>10)throw new Error('Approved budget exceeded');budget.reservedUsd+=1.1;await writeFile(budgetPath,JSON.stringify(budget,null,2));
 const proof:{reservedUsd:number;jobs:Array<{id:string;kind:string}>;project?:string;output?:string;passed?:boolean}={reservedUsd:1.1,jobs:[]};const save=()=>writeFile(path,JSON.stringify(proof,null,2));await save();
 await loginLocal(page);await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByLabel('Project name').fill('Real integrated journey');await page.getByRole('button',{name:'Create project',exact:true}).click();await expect(page.getByRole('heading',{name:'Real integrated journey',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Integrated creation',exact:true}).click();
 const generate=async(kind:string)=>{
  await page.getByRole('checkbox').check();const submitted=page.waitForResponse(r=>r.url().endsWith('/api/community/jobs')&&r.request().method()==='POST');await page.getByRole('button',{name:'Generate',exact:true}).click();const response=await submitted;expect(response.status()).toBe(200);const job=(await response.json()).data;proof.jobs.push({id:job.id,kind});await save();const row=page.locator('article.job').filter({hasText:job.id});await expect(row.getByRole('button',{name:'Preview',exact:true})).toBeVisible({timeout:900000});return {row,id:job.id};
 };
 await page.getByRole('textbox',{name:'Prompt / narration',exact:true}).fill('A blue ceramic coffee cup on a warm wooden table, soft morning light, original studio product photograph, no text or branding');
 const image=await generate('image');await image.row.getByRole('button',{name:'Use for image-to-video',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Reference image from assets',exact:true})).toHaveValue(image.id);
 await page.getByRole('textbox',{name:'Prompt / narration',exact:true}).fill('Slow gentle camera push in. The blue ceramic cup remains still. Warm morning light. No text.');
 const video=await generate('image-video');await video.row.getByRole('button',{name:'Add to current project',exact:true}).click();
 await video.row.getByRole('button',{name:'Preview',exact:true}).click();await expect.poll(()=>page.locator('dialog video').evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 const editorPromise=page.context().waitForEvent('page');await page.getByRole('link',{name:'Continue in editor ↗'}).click();const editor=await editorPromise;proof.project=editor.url();await save();
 await editor.getByTitle(`Add to timeline · image-video ${video.id.slice(0,8)}`,{exact:true}).first().click();await editor.getByRole('button',{name:'Export MP4',exact:true}).click();await editor.getByRole('button',{name:'Render locally',exact:true}).click();
 const output=editor.getByRole('link',{name:'Download MP4',exact:true});await expect(output).toBeVisible({timeout:180000});proof.output=(await output.getAttribute('href'))!;
 const player=editor.locator('dialog video');await expect.poll(()=>player.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);await player.evaluate((v:HTMLVideoElement)=>{v.currentTime=Math.max(0,v.duration-.4);});await expect.poll(()=>player.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(3);
 proof.passed=true;await save();await editor.screenshot({path:join(directory,'real-integrated-export.png')});
});
