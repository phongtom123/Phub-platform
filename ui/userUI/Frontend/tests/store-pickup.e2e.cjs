// Mocked checkout API: never creates a real order or changes stock/payments.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PHUB_USER_TEST_URL||'http://localhost:3001';
const contact={name:'Pickup Test',phone:'0901234567'};
const profile={customer_id:'PICKUP-C',...contact,address_line:null,province:null,ward:null};
const product={id:'PICKUP-P',sku:'PICKUP-S',name:'Pickup Product',is_active:true,price:'100.00',currency:'VND',
 category:{id:'PC',name:'PC'},subcategory:{id:'SC',name:'Custom'},brand:null,description:null,unit:'unit',warranty_months:12,images:[],specifications:[]};
const line={sku:product.sku,warehouse_id:1,name:product.name,unit:'unit',quantity:1,unit_price:'100.00',gross_total:'100.00',discount:'0.00',tax_rate:'10.00',tax_amount:'0.00',line_total:'100.00'};
const quote={items:[line],voucher_code:null,currency:'VND',tax_application:'invoice',shipping_status:'not_quoted',subtotal:'100.00',discount_total:'0.00',tax_total:'0.00',total:'100.00'};
const address={id:'00000000-0000-4000-8000-000000000001',...contact,address_line:'Saved address',province:'City',ward:'Ward',is_default:true};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-features=LocalNetworkAccessChecks']});
 try{
  for(const [width,kind] of [[1440,'empty'],[390,'empty'],[1440,'saved'],[1440,'unavailable']]){
   const context=await browser.newContext({viewport:{width,height:1000}});
   try{
    const page=await context.newPage(),errors=[],writes=[];let receipt,posted,cancelled=false,cancelAllowed=false,releaseCancel;
    const cancelCase=width===1440&&kind==='empty';
    const currentOrder=()=>({...receipt,status:cancelled?'HUY':kind==='saved'?'DA_XUAT_KHO':'MOI',total:'110.00',items:[{...line,tax_amount:'10.00',line_total:'110.00'}]});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('phub-cart-v1:PICKUP-C',JSON.stringify([{product_id:'PICKUP-P',sku:'PICKUP-S',quantity:1,selected:true}])));
    await page.route('**/api/**',async route=>{
     const request=route.request(),p=new URL(request.url()).pathname,ok=json=>route.fulfill({json});
     if(request.method()!=='GET')writes.push(p);
     if(p.endsWith('/auth/me'))return ok({account_id:'A',username:'test',role:'KHACH_HANG',name:contact.name,customer_id:profile.customer_id,employee_id:null,warehouse_id:null});
     if(p.endsWith('/customer/me'))return ok({...profile,payment_bypass_enabled:cancelCase});
     if(p.endsWith('/customer/vouchers'))return ok({currency:'VND',items:[]});
     if(p.endsWith('/customer/addresses'))return kind==='unavailable'?route.fulfill({status:503,json:{error:{message:'Address book temporarily unavailable'}}}):ok({items:kind==='saved'?[address]:[],item:null});
     if(p===`/api/catalog/products/${product.id}`)return ok(product);
     if(p==='/api/catalog/availability')return ok({items:[{sku:product.sku,available_quantity:20}],tax_rate:'10.00',currency:'VND'});
     if(p.startsWith('/api/catalog/'))return ok({items:[]});
     if(p.endsWith('/checkout/quote'))return ok(quote);
     if(p.endsWith('/customer/orders')&&request.method()==='POST'){
      posted=request.postDataJSON();assert.equal(posted.fulfillment_method,'TAI_CUA_HANG');
      assert.deepEqual(posted.recipient,{name:'Collector',phone:'+84901234567'});
      receipt={...quote,id:'PICKUP-ORDER',status:'MOI',sales_channel:'ONLINE',created_at:new Date().toISOString(),
       recipient:{...posted.recipient,address_line:null,province:null,ward:null},fulfillment_method:'TAI_CUA_HANG',note:null};
      return ok(receipt);
     }
     if(p.endsWith('/customer/orders/PICKUP-ORDER/cancel')){
      assert.equal(request.method(),'POST');
      if(!cancelAllowed)return route.fulfill({status:409,json:{error:{code:'ORDER_REFUND_REQUIRED',message:'Đơn đã thu tiền. Vui lòng liên hệ cửa hàng để xác nhận hoàn tiền trước khi hủy.'}}});
      await new Promise(resolve=>{releaseCancel=resolve;});cancelled=true;
      return ok(currentOrder());
     }
     if(p.endsWith('/invoice'))return ok({order_id:receipt.id,currency:'VND',items:[{...line,tax_amount:'10.00',line_total:'110.00'}],
      invoice:{issued_at:receipt.created_at,subtotal:'100.00',discount_total:'0.00',tax_total:'10.00',total:'110.00'},
      payment_deadline:{expires_at:new Date(Date.now()+86400000).toISOString(),server_now:new Date().toISOString(),expired_at:null,status:cancelled?'closed':'awaiting_payment'}});
     if(p.endsWith('/customer/orders/PICKUP-ORDER'))return ok(currentOrder());
     if(p.endsWith('/payments'))return ok({order_id:receipt.id,currency:'VND',latest_transaction:null,message:'Unpaid'});
     if(p.endsWith('/transactions'))return ok({order_id:receipt.id,currency:'VND',items:[],pagination:{page:1,page_size:10,total:0,total_pages:0}});
     throw new Error(`Unexpected API request ${request.method()} ${p}`);
    });
    await page.goto(base+'/checkout');
    await page.getByRole('radio',{name:'Nhận tại cửa hàng',exact:true}).check();
    const name=page.getByLabel('Tên người đến nhận *',{exact:true}),phone=page.getByLabel('Số điện thoại người đến nhận *',{exact:true});
    await name.fill('Collector');await phone.fill('+84 901 234 567');
    if(kind==='saved'){
     await page.getByRole('radio',{name:'Giao hàng tận nơi',exact:true}).check();
     await page.getByText('Saved address, Ward, City',{exact:true}).waitFor();
     await page.getByRole('radio',{name:'Nhận tại cửa hàng',exact:true}).check();
     assert.equal(await name.inputValue(),'Collector');
    }
    assert.equal(await page.getByLabel(/Địa chỉ chi tiết/).count(),0);
    await page.getByText('Thanh toán tại cửa hàng',{exact:true}).waitFor();
    await phone.fill('bad');assert.equal(await page.getByRole('button',{name:'Đặt hàng',exact:true}).isDisabled(),true);
    await phone.fill('+84 901 234 567');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(width===1440&&kind==='empty')await page.screenshot({path:process.env.TEMP+'/phub-store-pickup.png',fullPage:true});
    await page.getByRole('button',{name:'Đặt hàng',exact:true}).click();
    await page.getByRole('region',{name:'Kết quả đặt hàng',exact:true}).waitFor();
    await page.getByText('Thanh toán trong vòng 24 giờ',{exact:true}).waitFor();
    if(cancelCase){
     const confirmation=page.getByRole('region',{name:'Kết quả đặt hàng',exact:true});
     const cancel=confirmation.getByRole('button',{name:'Hủy đơn hàng',exact:true});
     await cancel.waitFor();
     await page.getByRole('button',{name:'Thanh toán bypass',exact:true}).waitFor();
     assert.deepEqual(await cancel.evaluate(node=>{const style=getComputedStyle(node);return [style.backgroundColor,style.borderTopColor,style.color];}),['rgb(255, 255, 255)','rgb(220, 38, 38)','rgb(220, 38, 38)']);
     page.once('dialog',dialog=>dialog.dismiss());await cancel.click();
     assert.equal(writes.filter(p=>p.endsWith('/cancel')).length,0);
     page.on('dialog',dialog=>dialog.accept());await cancel.click();
     await confirmation.getByRole('alert').getByText(/Đơn đã thu tiền/).waitFor();
     assert.equal(await cancel.count(),1);
     cancelAllowed=true;await cancel.click();
     await confirmation.getByRole('button',{name:'Đang hủy đơn…',exact:true}).waitFor();
     assert.ok(await confirmation.getByRole('button',{name:'Đang hủy đơn…',exact:true}).isDisabled());
     assert.equal(writes.filter(p=>p.endsWith('/cancel')).length,2);
     releaseCancel();await page.getByRole('heading',{name:'Đơn hàng đã hủy',exact:true}).waitFor();
     assert.equal(await cancel.count(),0);
     await page.getByText('Đơn hàng này đã bị hủy. Không thể thực hiện thanh toán mới.',{exact:true}).waitFor();
     await page.getByRole('status',{name:'Hạn thanh toán',exact:true}).waitFor({state:'detached'});
     assert.equal(await page.getByRole('button',{name:'Thanh toán bypass',exact:true}).count(),0);
     await page.screenshot({path:process.env.TEMP+'/phub-checkout-cancelled.png',fullPage:true});
    }
    if(kind==='saved'){
     await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(button=>button.textContent==='Hủy đơn hàng'));
     assert.equal(await page.getByRole('button',{name:'Hủy đơn hàng',exact:true}).count(),0);
    }
    await page.getByRole('link',{name:/Xem chi tiết đơn/}).click();
    await page.waitForURL('**/main/orders/PICKUP-ORDER');
    await page.getByText('Nhận tại cửa hàng',{exact:true}).waitFor();
    assert.equal(await page.getByText('Chưa ghi nhận địa chỉ',{exact:true}).count(),0);
    assert.deepEqual(writes.sort(),['/api/customer/checkout/quote','/api/customer/orders',...(cancelCase?['/api/customer/orders/PICKUP-ORDER/cancel','/api/customer/orders/PICKUP-ORDER/cancel']:[])].sort());
    assert.deepEqual(errors,[]);assert.ok(posted);
    console.log(`PASS ${width}px ${kind} address book: contact-only pickup, delivery switch, no address write, 24h invoice and order detail`);
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
