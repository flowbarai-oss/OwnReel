import {test,expect} from '@playwright/test';
test('signed-out entry offers local authentication without a main-site account requirement',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Make your first movie'})).toBeVisible();
 await expect(page.getByLabel('Username')).toBeVisible();
 const initialized=(await (await page.request.get('/api/community/status')).json()).data.initialized;
 if(!initialized){await expect(page.getByLabel('Setup token')).toBeVisible();await expect(page.getByRole('button',{name:'Create local account'})).toBeVisible();}
 else await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});
