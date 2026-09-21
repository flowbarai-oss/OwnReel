import {test,expect} from '@playwright/test';
import {loginLocal,waitForWorkspace} from './login';
test.beforeEach(async({request})=>{
 test.setTimeout(120000);
 // A rapid visual matrix shares one host/IP. Respect, rather than disable, its rate limit.
 for(let attempt=0;attempt<7;attempt++){
  const response=await request.get('/api/community/status');if(response.status()!==429){expect(response.status()).toBe(200);return;}
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 throw new Error('Service remained rate-limited beyond its one-minute window');
});
for(const locale of ['en','zh-CN'])for(const size of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}]){
 test(`workspace navigation ${locale} ${size.width}`,async({page})=>{
  await page.setViewportSize(size);const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
  await loginLocal(page);
  await expect(page.getByRole('button',{name:'Projects',exact:true})).toBeVisible();
  if(locale==='zh-CN')await page.getByRole('button',{name:'中文',exact:true}).click();
  for(const label of locale==='en'?['Integrated creation','Smart movie','Projects','Assets','Settings']:['一体化创作','智能成片','项目','资产库','设置']){
   await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.screenshot({path:`test-results/workspace-${locale}-${size.width}.png`,fullPage:true});
  expect(failures).toEqual([]);
 });
}
test('manual smart storyboard saves, builds an editable timeline, duplicates and deletes without losing assets',async({page})=>{
 await loginLocal(page);
 await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByLabel('Project name').fill('Smart manual proof');await page.getByRole('button',{name:'Create project',exact:true}).click();
 await page.getByRole('button',{name:'Smart movie',exact:true}).click();
 await page.getByRole('button',{name:'Use manual template (no AI)',exact:true}).click();
 const selectors=page.getByRole('combobox',{name:'Visual asset',exact:true});await expect(selectors).toHaveCount(3);
 for(let i=0;i<3;i++)await selectors.nth(i).selectOption({label:'original.png · 640×360'});
 await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('16:9');
 await page.getByRole('combobox',{name:'Export size',exact:true}).selectOption('1080p');
 await page.getByRole('button',{name:'Save storyboard',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Saved');
 await page.reload();await page.getByRole('button',{name:'Smart movie',exact:true}).click();await page.getByRole('combobox',{name:'Current project',exact:true}).selectOption({label:'Smart manual proof'});await expect(page.getByRole('combobox',{name:'Visual asset',exact:true})).toHaveCount(3);
 await expect(page.getByRole('combobox',{name:'Aspect ratio',exact:true})).toHaveValue('16:9');
 await expect(page.getByRole('combobox',{name:'Export size',exact:true})).toHaveValue('1080p');
 await page.getByRole('button',{name:'Build editable timeline',exact:true}).click();await expect(page.getByRole('link',{name:'Open editor and export ↗'})).toBeVisible();
 await page.screenshot({path:'test-results/smart-storyboard.png',fullPage:true});
 await page.getByRole('button',{name:'Projects',exact:true}).click();const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Smart manual proof',exact:true})});
 await card.getByRole('button',{name:'Duplicate',exact:true}).click();await expect(page.getByRole('heading',{name:'Smart manual proof (copy)',exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await card.getByRole('button',{name:'Delete project',exact:true}).click();await expect(page.getByRole('heading',{name:'Smart manual proof',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Assets',exact:true}).click();await expect(page.getByRole('heading',{name:'original.png',exact:true})).toBeVisible();
});

test('editor deep links select the available community module instead of a missing commercial tool',async({page})=>{
 await loginLocal(page);await page.goto('/?view=assets');await waitForWorkspace(page);await expect(page.getByRole('heading',{name:'Assets',exact:true})).toBeVisible();
 await page.goto('/?view=projects');await waitForWorkspace(page);await expect(page.getByRole('heading',{name:'Projects',exact:true})).toBeVisible();
 await page.goto('/?view=create&kind=tts');await waitForWorkspace(page);await expect(page.getByRole('heading',{name:'Integrated creation',exact:true})).toBeVisible();
 await expect(page.locator('select').filter({has:page.locator('option[value="tts"]')})).toHaveValue('tts');
});

test('temporary session-check failure does not pretend the saved login is invalid',async({page})=>{
 await loginLocal(page);let failed=false;
 await page.route('**/api/community/me',async route=>{if(!failed){failed=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'temporarily_unavailable'})});}else await route.continue();});
 await page.reload();await expect(page.getByRole('button',{name:'Retry connection',exact:true})).toBeVisible();await expect(page.getByLabel('Username')).toHaveCount(0);
 await page.getByRole('button',{name:'Retry connection',exact:true}).click();await waitForWorkspace(page);
});
