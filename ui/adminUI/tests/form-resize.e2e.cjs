/** Focused CSS regression only: no backend, fixtures, database, or full app build. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../../..');
const css = file => fs.readFileSync(path.join(root,file),'utf8').replace(/@import[^;]+;/g,'');

async function main() {
  const browser=await chromium.launch({headless:true,executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE||undefined});
  try {
    const page=await browser.newPage();
    for(const surface of ['admin','warehouse']) {
      const styles=css(`ui/${surface==='admin'?'adminUI':'warehouseUI'}/app/globals.css`)+css('ui/shared/data-manager.css')+
        (surface==='admin'?css('ui/adminUI/src/features/support/support.css')+css('ui/adminUI/src/features/operations/operations.css'):'');
      for(const width of [1140,390]) {
        await page.setViewportSize({width,height:850});
        await page.setContent(`<style>${styles}</style><main style="padding:16px">
          <section class="live-data"><form class="live-form"><fieldset class="live-form-fields" style="display:contents">
            <label>Mô tả<textarea rows="4"></textarea></label><label>Thông số kỹ thuật<textarea rows="4"></textarea></label>
            <label>Đơn vị<input value="Cái"></label><label>Trường tiếp theo<input value="Không được che"></label>
          </fieldset></form></section>
          <section class="live-data"><form class="operation-form"><label class="operation-wide">Ghi chú / lý do kiểm kê<textarea></textarea></label></form></section>
          <section class="live-data support-page"><form class="support-response"><label>Phản hồi<textarea></textarea></label></form></section>
          <form class="form-grid"><label>Nội dung<textarea></textarea></label><label>Ô bên cạnh<input></label></form>
          </main>`);
        for(const textarea of await page.locator('textarea').all()) {
          const before=await textarea.evaluate(element=>({width:element.getBoundingClientRect().width,resize:getComputedStyle(element).resize}));
          assert.equal(before.resize,'vertical',`${surface}/${width}: horizontal resize must be disabled`);
          await textarea.evaluate(element=>{element.style.width='1600px';element.style.height='360px';element.value='Long text '.repeat(100);});
          const after=await textarea.evaluate(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height,parent:element.parentElement.getBoundingClientRect().width,right:element.getBoundingClientRect().right}));
          assert.ok(after.width<=after.parent+1,`${surface}/${width}: resized textarea escapes its label`);
          assert.ok(after.right<=width+1,`${surface}/${width}: resized textarea escapes viewport`);
          assert.ok(after.height>=359,`${surface}/${width}: vertical resizing remains usable`);
        }
        const boxes=await page.locator('.live-form input,.live-form textarea').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};}));
        for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++) {
          const first=boxes[a],second=boxes[b];
          assert.ok(first.right<=second.left||second.right<=first.left||first.bottom<=second.top||second.bottom<=first.top,`${surface}/${width}: neighboring controls overlap`);
        }
      }
    }
    console.log('Form resize passed: admin/warehouse generic forms, operations notes, support and form-grid at desktop/mobile sizes.');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
