import {expect,type Page} from '@playwright/test';
export async function loginLocal(page:Page){
 await page.goto('/');
 for(let attempt=0;attempt<15;attempt++){
  if(await page.getByLabel('Username').isVisible())break;
  const retry=page.getByRole('button',{name:'Retry connection',exact:true});
  if(await retry.isVisible()){await page.waitForTimeout(5000);await retry.click();}else await page.waitForTimeout(500);
 }
 await page.getByLabel('Username').fill('community-test');await page.getByLabel('Password',{exact:true}).fill('Local-only-test-password-2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await waitForWorkspace(page);
}
export async function waitForWorkspace(page:Page){
 for(let attempt=0;attempt<15;attempt++){
  if(await page.getByRole('button',{name:'Projects',exact:true}).isVisible())break;
  const retry=page.getByRole('button',{name:'Retry connection',exact:true});
  if(await retry.isVisible()){await page.waitForTimeout(5000);await retry.click();}else await page.waitForTimeout(500);
 }
 await expect(page.getByRole('button',{name:'Projects',exact:true})).toBeVisible();
}
