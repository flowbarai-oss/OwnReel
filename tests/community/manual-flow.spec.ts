import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {join} from 'node:path';
test('local user creates a project, uploads an image, edits and exports a real MP4',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');
 const status=await page.request.get('/api/community/status');
 if(!(await status.json()).data.initialized){
  await expect(page.getByRole('heading',{name:'Make your first movie'})).toBeVisible();
  await page.getByLabel('Setup token').fill((await readFile(join(process.env.COMMUNITY_DATA_DIR??'data','bootstrap-token'),'utf8')).trim());
  await page.getByLabel('Username').fill('community-test');await page.getByLabel('Password',{exact:true}).fill('Local-only-test-password-2026');
  await page.getByRole('button',{name:'Create local account'}).click();
 }else{
  await page.getByLabel('Username').fill('community-test');await page.getByLabel('Password',{exact:true}).fill('Local-only-test-password-2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 }
 await expect(page.getByRole('button',{name:'Projects',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Projects',exact:true}).click();
 await page.getByLabel('Project name').fill('Manual film');await page.getByRole('button',{name:'Create project',exact:true}).click();
 await expect(page.getByText('Manual film',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Assets',exact:true}).click();
 const buffer=await sharp({create:{width:640,height:360,channels:3,background:'#3b42aa'}}).png().toBuffer();
 await page.getByLabel('Upload media').setInputFiles({name:'original.png',mimeType:'image/png',buffer});
 await expect(page.getByText('original.png',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Projects',exact:true}).click();
 const popup=page.context().waitForEvent('page');await page.getByRole('link',{name:'Open editor'}).first().click();const editor=await popup;
 await expect(editor.getByRole('textbox',{name:'Timeline name'})).toBeVisible();
 await editor.getByTitle('Add to timeline · original.png',{exact:true}).first().click();
 let disrupted=false,polls=0;
 await editor.route('**/api/community/jobs/*',async route=>{if(route.request().method()==='GET'){polls++;if(!disrupted){disrupted=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'temporary_test_disconnect'})});return;}}await route.continue();});
 await editor.getByRole('button',{name:'Export MP4',exact:true}).click();
 await editor.getByRole('button',{name:'Render locally',exact:true}).click();
 await expect.poll(()=>polls,{timeout:10000}).toBeGreaterThanOrEqual(2);
 const downloadLink=editor.getByRole('link',{name:'Download MP4',exact:true});
 await expect(downloadLink).toBeVisible({timeout:120000});
 const media=await editor.request.get((await downloadLink.getAttribute('href'))!);
 expect(media.status()).toBe(200);expect(media.headers()['content-type']).toContain('video/mp4');
 expect((await media.body()).subarray(4,8).toString()).toBe('ftyp');
 await editor.getByRole('button',{name:'Close',exact:true}).click();
 await editor.screenshot({path:'test-results/editor-initial.png'});
 await editor.evaluate(()=>localStorage.setItem('community-language','zh-CN'));await editor.reload();
 await expect(editor.getByRole('button',{name:'导出 MP4',exact:true})).toBeVisible();
 await editor.setViewportSize({width:390,height:844});await editor.getByRole('button',{name:'导出 MP4',exact:true}).click();
 await expect(editor.getByRole('button',{name:'关闭',exact:true})).toBeVisible();await editor.keyboard.press('Escape');await expect(editor.getByRole('dialog')).toHaveCount(0);
});
