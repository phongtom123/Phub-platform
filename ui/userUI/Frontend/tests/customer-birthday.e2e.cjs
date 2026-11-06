// Targeted profile fixture. No live accounts, customer writes or external requests.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_USER_TEST_URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PHUB_CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}}), errors=[], writes=[];
    let failSave=false;
    let profile={customer_id:'KH-FIXTURE',name:'Khách kiểm thử',phone:'0901234567',address_line:'123 Test',province:'TP Hồ Chí Minh',ward:'Phường 1',birthday:'2000-02-29'};
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==new URL(base).origin)return route.abort();
      if(!url.pathname.startsWith('/api/'))return route.continue();
      const respond=(json,status=200)=>route.fulfill({status,json});
      if(url.pathname.endsWith('/auth/me'))return respond({account_id:'TK-FIXTURE',username:'fixture',role:'KHACH_HANG',name:profile.name,customer_id:profile.customer_id});
      if(url.pathname==='/api/backend/customer/me' && request.method()==='PUT'){
        writes.push(request.postDataJSON());
        if(failSave)return respond({error:{message:'Không lưu được ngày sinh kiểm thử.'}},503);
        profile={...profile,...request.postDataJSON()}; return respond(profile);
      }
      assert.equal(request.method(),'GET','Never forward a write to a live service');
      if(url.pathname.endsWith('/customer/me'))return respond(profile);
      if(url.pathname.endsWith('/customer/addresses'))return respond({items:[],item:null});
      if(url.pathname.startsWith('/api/catalog/'))return respond({items:[]});
      throw new Error('Unexpected API: '+url.pathname);
    });
    await page.goto(base+'/main/profile');
    const info=page.getByRole('region',{name:'Thông tin cá nhân',exact:true});
    await info.getByText('29/02/2000',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Chỉnh sửa thông tin',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Thông tin cá nhân và nhận hàng'}), birthday=dialog.getByLabel('Ngày sinh',{exact:true});
    assert.equal(await birthday.inputValue(),'2000-02-29');
    assert.ok(await birthday.getAttribute('max'));
    await birthday.fill('1999-11-05');
    failSave=true;
    await dialog.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
    await dialog.getByRole('alert').filter({hasText:'Không lưu được ngày sinh kiểm thử.'}).waitFor();
    assert.equal(await birthday.inputValue(),'1999-11-05');
    failSave=false;
    await dialog.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
    await info.getByText('05/11/1999',{exact:true}).waitFor();
    assert.equal(writes.at(-1).birthday,'1999-11-05');
    assert.ok(!('age' in writes.at(-1)),'Age is calculated, never submitted or stored');
    assert.deepEqual(errors,[]);
    console.log('PASS: customer birthday edit, calculated age display, validation bound and API-error draft preservation. Mocked HTTP only.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
