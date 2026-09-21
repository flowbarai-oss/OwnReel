import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loginLocal} from './login';

test('real generated storyboards and voices remain editable and export through the UI',async({page})=>{
 test.skip(process.env.COMMUNITY_REAL_SMART!=='1','Requires private evidence from explicitly approved model acceptance');test.setTimeout(600000);
 const directory=process.env.COMMUNITY_EVIDENCE_DIR;if(!directory)throw new Error('Evidence directory required');
 const records=JSON.parse(await readFile(join(directory,'composition-proof.json'),'utf8')) as Array<{language:string;projectId:string;name:string}>;
 await loginLocal(page);
 for(const record of records.slice(0,2)){
  await page.getByRole('button',{name:'Smart movie',exact:true}).click();
  await page.getByRole('combobox',{name:'Current project',exact:true}).selectOption(record.projectId);
  await expect(page.getByRole('combobox',{name:'Visual asset',exact:true})).toHaveCount(3);
  for(let i=0;i<3;i++){await expect(page.getByRole('combobox',{name:'Visual asset',exact:true}).nth(i)).not.toHaveValue('');await expect(page.getByRole('combobox',{name:'Voice asset',exact:true}).nth(i)).not.toHaveValue('');}
  await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption(record.language==='en'?'9:16':'16:9');
  await page.getByRole('textbox',{name:'Caption',exact:true}).first().fill(record.language==='en'?'Create your next story':'开启你的创作');
  await page.getByRole('spinbutton',{name:'Seconds',exact:true}).first().fill('1');
  await page.getByRole('button',{name:'Save storyboard',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Saved');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:join(directory,`real-smart-${record.language}-mobile.png`),fullPage:true});
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('button',{name:'Build editable timeline',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'voice_longer_than_scene'})).toBeVisible();
  await page.getByRole('checkbox',{name:/Extend still-image scenes/}).check();
  await page.getByRole('button',{name:'Build editable timeline',exact:true}).click();
  const opened=page.context().waitForEvent('page');await page.getByRole('link',{name:'Open editor and export ↗'}).click();const editor=await opened;
  await editor.getByRole('button',{name:'Export MP4',exact:true}).click();
  for(let attempt=0;attempt<5;attempt++){
   const response=editor.waitForResponse(r=>r.url().endsWith('/api/community/jobs')&&r.request().method()==='POST');
   await editor.getByRole('button',{name:'Render locally',exact:true}).click();const submitted=await response;
   if(submitted.status()!==429){expect(submitted.ok()).toBe(true);break;}
   // Explicit rejected local render, not an uncertain paid submission.
   await editor.waitForTimeout(15000);
  }
  await expect(editor.getByRole('link',{name:'Download MP4',exact:true})).toBeVisible({timeout:180000});
  const player=editor.locator('dialog video');await expect.poll(()=>player.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);
  for(const fraction of [.05,.5,.95]){await player.evaluate((v:HTMLVideoElement,f:number)=>{v.currentTime=v.duration*f;},fraction);await expect.poll(()=>player.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);}
  await editor.screenshot({path:join(directory,`real-smart-${record.language}-export.png`)});
  await editor.keyboard.press('Escape');await expect(editor.getByRole('dialog')).toHaveCount(0);
  await editor.evaluate(()=>{document.body.style.zoom='1.25';});await editor.getByRole('button',{name:'Export MP4',exact:true}).click();await expect(editor.getByRole('button',{name:'Close',exact:true})).toBeVisible();await editor.screenshot({path:join(directory,`editor-${record.language}-125pct.png`)});
  await editor.keyboard.press('Escape');await editor.evaluate(()=>{document.body.style.zoom='1';});await editor.setViewportSize({width:390,height:844});await editor.getByRole('button',{name:'Export MP4',exact:true}).click();await expect(editor.getByRole('link',{name:'Download MP4',exact:true})).toBeVisible();await editor.screenshot({path:join(directory,`editor-${record.language}-mobile.png`)});await editor.close();
 }
});
