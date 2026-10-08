// Browser regressions exercise the visible menu after the toolbar was consolidated.
import assert from 'node:assert/strict';
async function openMenu(page) {
  if (!await page.locator('.zoc-dialog').isVisible()) await page.locator('#zeroOneConnection .zoc-primary').click();
  assert.equal(await page.locator('.zoc-dialog').isVisible(), true);
}
export async function connectFromMenu(page) {
  await openMenu(page);
  if (await page.locator('.zoc-connect').isVisible()) await page.locator('.zoc-connect').click();
  else { await page.locator('.zoc-sync').click(); await page.locator('.zoc-close').click(); }
}
export async function syncFromMenu(page) {
  await openMenu(page);
  if(await page.locator('#syncNow').isVisible()){await page.locator('#syncNow').click();await page.locator('.zoc-close').click();}
  else await page.locator('.zoc-connect').click();
}
export async function openSettings(page) {
  // Upgrade tests also visit the immutable release before this menu existed.
  if(!await page.locator('#zeroOneConnection').count()){await page.getByRole('button',{name:'接続・バックアップ',exact:true}).click();return;}
  await openMenu(page); await page.locator('.zoc-more').click();
}
export async function menuText(page, selector) {
  await openMenu(page); const text = await page.locator(selector).innerText(); await page.locator('.zoc-close').click(); return text;
}
export async function menuVisible(page, selector) {
  await openMenu(page); const visible = await page.locator(selector).isVisible(); await page.locator('.zoc-close').click(); return visible;
}
export async function menuBox(page, selector) {
  await openMenu(page); const box = await page.locator(selector).boundingBox(); await page.locator('.zoc-close').click(); return box;
}
