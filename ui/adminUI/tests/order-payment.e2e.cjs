/** Real Next UI, isolated HTTP fixtures. Never submits a live payment. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PHUB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PHUB_ADMIN_TEST_URL || 'http://localhost:3000';
const column = name => ({name,type:'varchar',required:false,generated:false,immutable:false,choices:null,system:false,default:null});
const resources = [{name:'orders',title:'Đơn hàng',keys:['ma_donhang'],writable:false,columns:['ma_donhang','trang_thai','kenh_ban','ten_nguoi_nhan'].map(column)}];
const order = {ma_donhang:'PAYMENT-TEST',trang_thai:'XAC_NHAN',kenh_ban:'ONLINE',ten_nguoi_nhan:'Khách kiểm thử'};
const payment = (id, amount, type='THU', status='THANH_CONG', method='TIEN_MAT') => ({ma_thanh_toan:id,ma_donhang:order.ma_donhang,so_tien:amount,loai_giao_dich:type,trang_thai:status,phuong_thuc:method,ma_giao_dich:method==='TIEN_MAT'?null:`OLD-${id}`,thoi_gian:'2026-11-01T10:00:00'});

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PHUB_CHROMIUM_EXECUTABLE?{executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE}:{})});
  try {
    const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[],consoleErrors=[],writes=[],reads=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('status of 503'))consoleErrors.push(message.text());});
    page.on('dialog',dialog=>dialog.accept());
    let mode='normal',timeout=false;
    await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',body:''});
      if(url.origin!==new URL(base).origin)return route.abort();
      if(!url.pathname.startsWith('/api/backend/'))return route.continue();
      const path=url.pathname.replace('/api/backend/','');
      const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(path==='auth/me')return json({account_id:'AD1',username:'admin',name:'Admin',role:'ADMIN',employee_id:'NV1'});
      if(path==='data/resources')return json(resources);
      if(request.method()==='POST'){
        assert.equal(path,'admin/operations/orders');
        writes.push({body:request.postDataJSON(),key:request.headers()['idempotency-key']});
        if(timeout){timeout=false;return json({detail:'Tạm mất kết nối'},503);}
        return json({data:[order],replayed:writes.length>1});
      }
      if(path==='data/orders')return json({data:[order],total:1,page:1,page_size:20,filters:{}});
      if(['data/invoices','data/payments'].includes(path)){
        reads.push({path,page:url.searchParams.get('page')});
        assert.equal(url.searchParams.get('order_id'),order.ma_donhang);
        if(mode==='unavailable')return json({detail:'API tạm chưa sẵn sàng'},503);
        let rows=path==='data/invoices'
          ? mode==='missing'?[]:[{ma_hoadon:'HD-TEST',ma_donhang:order.ma_donhang,tong_tien_sau_thue:mode==='large'?'9999999999999999.99':'1000.30'}]
          : mode==='paid'?[payment(1,'1000.30')]
          : mode==='pages'?Array.from({length:101},(_,i)=>payment(i+1,'0.01'))
          : [payment(1,'200.10'),payment(2,'50.05','HOAN_TIEN'),payment(3,'999.00','THU','CHO_XU_LY','CHUYEN_KHOAN'),payment(4,'999.00','THU','THAT_BAI')];
        if(mode==='large'&&path==='data/payments')rows=[];
        if(mode==='wrong'&&path==='data/payments')rows=[{...payment(1,'100.00'),ma_donhang:'OTHER'}];
        const total=rows.length,index=Number(url.searchParams.get('page')||1)-1;
        rows=rows.slice(index*100,index*100+100);
        if(mode==='incomplete'&&path==='data/payments')return json({data:[],total:1,order_id:order.ma_donhang});
        return json({data:rows,total,page:index+1,page_size:100,order_id:order.ma_donhang});
      }
      if(path==='admin/operations/read/notifications')return json([]);
      return json({data:[],total:0});
    });
    await page.goto(`${base}/data/orders?key=${encodeURIComponent(JSON.stringify([order.ma_donhang]))}`);
    const open=()=>page.getByRole('button',{name:'Ghi nhận thu tiền',exact:true}).click();
    const close=()=>page.getByRole('button',{name:'Đóng',exact:true}).click();
    const submit=page.getByRole('button',{name:'Xác nhận đã thu',exact:true});
    const summary=page.getByLabel('Tình hình thanh toán của đơn');
    await open();
    await summary.getByText('850,25 ₫',{exact:true}).waitFor();
    await summary.getByText('150,05 ₫',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Số tiền thu lần này',{exact:true}).count(),0,'full collection does not ask for an amount');
    assert.equal(await page.getByLabel('Phương thức thanh toán',{exact:true}).inputValue(),'CHUYEN_KHOAN');
    const reference=page.getByLabel('Mã đối soát của khoản thu mới',{exact:true});
    assert.equal(await reference.inputValue(),'','never reuse an existing transaction reference');
    assert.ok(await submit.isDisabled());
    await reference.fill('NEW-REF-1');
    assert.ok(await submit.isEnabled());
    await open();assert.ok(await submit.isEnabled(),'reopening the active form must not disable it');
    const before=reads.length;
    await page.getByLabel('Khách chỉ thanh toán một phần',{exact:true}).check();
    const amount=page.getByLabel('Số tiền thu lần này',{exact:true});
    await amount.fill('850.26');assert.ok(await submit.isDisabled(),'must reject overpayment');
    await amount.fill('0');assert.ok(await submit.isDisabled());
    await amount.fill('5.001');assert.ok(await submit.isDisabled());
    await amount.fill('5,25');assert.ok(await submit.isEnabled());
    assert.equal(reads.length,before,'editing uses the loaded balance without repeated API requests');
    await page.getByLabel('Khách chỉ thanh toán một phần',{exact:true}).uncheck();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-order-payment-desktop.png'),fullPage:true});
    timeout=true;
    await submit.click();
    await page.getByRole('button',{name:'Thử lại cùng yêu cầu',exact:true}).waitFor();
    assert.deepEqual(writes[0].body,{action:'payment',record_id:order.ma_donhang,expected_status:'XAC_NHAN',data:{amount:'850.25',method:'CHUYEN_KHOAN',reference:'NEW-REF-1'}});
    assert.ok(await submit.isDisabled());
    await page.getByRole('button',{name:'Thử lại cùng yêu cầu',exact:true}).click();
    await page.getByRole('status').filter({hasText:'không ghi lặp'}).waitFor();
    assert.equal(writes.length,2);assert.deepEqual(writes[1],writes[0],'retry must preserve the idempotency key and exact payment');

    mode='paid';await open();await page.getByText('Đơn hàng đã thu đủ tiền',{exact:true}).waitFor();assert.ok(await submit.isDisabled());await close();
    mode='missing';await open();await page.getByText('Đơn hàng chưa có hóa đơn',{exact:true}).waitFor();assert.ok(await submit.isDisabled());
    await page.getByRole('button',{name:'Lập hóa đơn từ đơn hàng',exact:true}).waitFor();assert.equal(writes.length,2,'missing invoice must never create an automatic payment or invoice');await close();
    for(const invalid of ['wrong','incomplete','unavailable']){
      mode=invalid;await open();await page.getByRole('button',{name:'Tải lại thông tin thanh toán',exact:true}).waitFor();assert.ok(await submit.isDisabled());await close();
    }
    assert.equal(writes.length,2);
    mode='pages';await open();await summary.getByText('999,29 ₫',{exact:true}).waitFor();assert.ok(reads.some(read=>read.path==='data/payments'&&read.page==='2'),'read every payment page');await close();
    mode='large';await open();await summary.getByText('9.999.999.999.999.999,99 ₫',{exact:true}).first().waitFor();assert.ok(await submit.isEnabled());await close();
    mode='normal';await open();await reference.waitFor();await reference.fill('NEW-REF-MOBILE');
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'payment form must fit a mobile screen');
    await page.getByRole('heading',{name:'Ghi nhận khoản thu',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'phub-order-payment-mobile.png'),fullPage:true});
    await page.getByLabel('Khách chỉ thanh toán một phần',{exact:true}).check();
    await amount.fill('5,25');
    await page.getByLabel('Phương thức thanh toán',{exact:true}).selectOption('TIEN_MAT');
    assert.equal(await reference.count(),0,'cash needs no external reference');
    await submit.click();
    await page.getByRole('status').filter({hasText:'không ghi lặp'}).waitFor();
    assert.deepEqual(writes.at(-1).body.data,{amount:'5.25',method:'TIEN_MAT'});
    assert.notEqual(writes.at(-1).key,writes[0].key,'a different payment uses a new idempotency key');
    assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
    console.log('PASS: exact outstanding balance/refunds, suggested method, no repeated input, optional partial payment, immutable retry, paid/missing/invalid states, pagination, large amounts, mobile, no runtime errors');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
