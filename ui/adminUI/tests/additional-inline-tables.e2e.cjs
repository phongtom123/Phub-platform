/** Real Next pages; every API request is intercepted, including draft updates. */
const assert=require("node:assert/strict");
const {chromium}=require(process.env.PHUB_PLAYWRIGHT_MODULE||"playwright");
const base=process.env.PHUB_ADMIN_TEST_URL||"http://localhost:3000";
const column=(name,type="varchar",extra={})=>({name,type,required:false,generated:false,immutable:false,choices:null,system:false,default:null,...extra});
const status=()=>column("trang_thai","int",{required:true});
const resources=[
  {name:"suppliers",title:"Nhà cung cấp",keys:["ma_ncc"],writable:true,columns:[column("ma_ncc","int",{generated:true}),column("ten_ncc"),column("sdt"),status()]},
  {name:"employees",title:"Nhân viên",keys:["ma_nhan_vien"],writable:true,columns:[column("ma_nhan_vien"),column("ho_ten"),column("ma_kho","int"),column("loai_nhan_vien","varchar",{choices:["ADMIN","NHAN_VIEN"]}),status()]},
  {name:"promotions",title:"Khuyến mãi",keys:["ma_ctkm"],writable:true,columns:[column("ma_ctkm","int"),column("ten_chuong_trinh"),column("ngay_bat_dau","datetime"),column("ngay_ket_thuc","datetime"),column("trang_thai","varchar",{choices:["NHAP","HOAT_DONG","TAM_DUNG","KET_THUC"]}),column("ngay_tao","datetime",{system:true})]},
  {name:"vouchers",title:"Voucher",keys:["ma_voucher"],writable:true,columns:[column("ma_voucher","int"),column("ma_code"),column("loai_giam","varchar",{choices:["PHAN_TRAM","SO_TIEN"]}),column("gia_tri_giam","decimal(18,2)"),column("trang_thai","varchar",{choices:["HOAT_DONG","TAM_DUNG"]}),column("ngay_tao","datetime",{system:true})]},
  {name:"receipts",title:"Phiếu nhập",keys:["ma_phieu_nhap"],writable:false,draft_update_path:"/api/admin/warehouse-drafts/receipts",draft_update_fields:["ma_phieu_code","ma_ncc","ma_kho","ghi_chu"],columns:[column("ma_phieu_nhap","int"),column("ma_phieu_code"),column("ma_ncc","int"),column("ma_kho","int"),column("trang_thai"),column("ghi_chu","text")]},
  {name:"transfers",title:"Chuyển kho",keys:["ma_phieu_chuyen"],writable:false,draft_update_path:"/api/admin/warehouse-drafts/transfers",draft_update_fields:["ma_kho_xuat","ma_kho_nhan","ghi_chu"],columns:[column("ma_phieu_chuyen","int"),column("ma_kho_xuat","int"),column("ma_kho_nhan","int"),column("trang_thai"),column("ghi_chu","text")]},
];
const rows={
 suppliers:[{ma_ncc:-5,ten_ncc:"NCC thử",sdt:null,trang_thai:1}],
 employees:[{ma_nhan_vien:"NV1",ho_ten:"Nhân viên thử",ma_kho:7,loai_nhan_vien:"NHAN_VIEN",trang_thai:1}],
 promotions:[{ma_ctkm:1,ten_chuong_trinh:"Chương trình cũ",ngay_bat_dau:"2026-10-25T01:00:00Z",ngay_ket_thuc:"2026-10-27T01:00:00Z",trang_thai:"NHAP",ngay_tao:"2026-10-20T00:00:00Z"}],
 vouchers:[{ma_voucher:1,ma_code:"SAVE10",loai_giam:"PHAN_TRAM",gia_tri_giam:"10.00",trang_thai:"HOAT_DONG",ngay_tao:"2026-10-20T00:00:00Z"}],
 receipts:[{ma_phieu_nhap:-5,ma_phieu_code:"PN-NHAP",ma_ncc:1,ma_kho:-1,trang_thai:"NHAP",ghi_chu:"Ghi chú phiếu nhập"},{ma_phieu_nhap:-6,ma_phieu_code:"PN-XONG",ma_ncc:1,ma_kho:-1,trang_thai:"DA_NHAP",ghi_chu:"Đã nhập"}],
 transfers:[{ma_phieu_chuyen:-7,ma_kho_xuat:-1,ma_kho_nhan:-2,trang_thai:"NHAP",ghi_chu:"Ghi chú chuyển kho"},{ma_phieu_chuyen:-8,ma_kho_xuat:-1,ma_kho_nhan:-2,trang_thai:"DANG_CHUYEN",ghi_chu:"Đang chuyển"}],
};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PHUB_CHROMIUM_EXECUTABLE});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),writes=[],errors=[];
  let conflict=false;
  page.on("pageerror",error=>errors.push(error.message));page.on("dialog",dialog=>dialog.accept());
  await page.route("**/*",async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==new URL(base).origin)return route.abort();
   if(!url.pathname.startsWith("/api/"))return route.continue();
   const reply=(body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
   if(url.pathname.endsWith("/auth/me"))return reply({account_id:"AD1",username:"admin",name:"Admin",role:"ADMIN"});
   if(url.pathname.endsWith("/data/resources"))return reply(resources);
   const resource=resources.find(item=>url.pathname===`/api/backend/data/${item.name}`||url.pathname===`/api/backend/admin/warehouse-drafts/${item.name}`);
   assert.ok(resource,"Unexpected API: "+url.pathname);
   const key=url.searchParams.get("key");
   const data=key?rows[resource.name].filter(row=>JSON.stringify(resource.keys.map(field=>row[field]))===key):rows[resource.name];
   if(request.method()==="PATCH"){
    const patch=request.postDataJSON();writes.push({resource:resource.name,patch,path:url.pathname,key:JSON.parse(key)});
    assert.ok(resource.keys.every(field=>!(field in patch)));
    if(resource.draft_update_path){assert.ok(url.pathname.includes("/admin/warehouse-drafts/"));assert.equal(data[0].trang_thai,"NHAP");assert.ok(Object.keys(patch).every(field=>resource.draft_update_fields.includes(field)));}
    if(conflict){conflict=false;return reply({detail:"Phiếu vừa được xử lý. Hãy làm mới."},409);}
    Object.assign(data[0],patch);return reply({data});
   }
   assert.equal(request.method(),"GET");return reply({data,total:data.length,page:1,page_size:20});
  });
  const row=id=>page.locator("tbody tr").filter({has:page.getByRole("link",{name:String(id),exact:true})});
  const open=async name=>{await page.goto(base+"/data/"+name);await page.locator("tbody tr").first().waitFor();assert.equal(await page.getByRole("link",{name:"Sửa",exact:true}).count(),0);};
  const edit=async(id,field)=>row(id).locator(`[data-field="${field}"]`).dblclick();
  const saved=()=>page.getByRole("status").filter({hasText:"Đã lưu thay đổi."}).waitFor();

  await open("suppliers");await edit(-5,"ten_ncc");await page.getByLabel("Tên nhà cung cấp -5",{exact:true}).fill("Nhà cung cấp mới");await page.getByLabel("Số điện thoại -5",{exact:true}).fill("0012345678");await page.getByLabel("Tên nhà cung cấp -5",{exact:true}).press("Enter");await saved();
  assert.deepEqual(writes.at(-1).patch,{ten_ncc:"Nhà cung cấp mới",sdt:"0012345678"});

  await open("employees");await edit("NV1","ho_ten");
  await page.getByLabel("Vai trò NV1",{exact:true}).selectOption({label:"Quản trị viên"});await page.getByLabel("Mã kho NV1",{exact:true}).fill("");await page.getByLabel("Họ tên NV1",{exact:true}).press("Enter");await saved();
  assert.deepEqual(writes.at(-1).patch,{ma_kho:null,loai_nhan_vien:"ADMIN"});

  await open("promotions");assert.ok(!(await page.locator("thead").innerText()).includes("Ngày tạo"));await edit(1,"ten_chuong_trinh");
  assert.equal(await page.getByLabel("Ngày bắt đầu 1",{exact:true}).inputValue(),"2026-10-25T08:00");
  await page.getByLabel("Tên chương trình 1",{exact:true}).fill("Chương trình mới");await page.getByLabel("Tên chương trình 1",{exact:true}).press("Enter");await saved();assert.deepEqual(writes.at(-1).patch,{ten_chuong_trinh:"Chương trình mới"});
  await page.getByLabel("Trạng thái 1",{exact:true}).selectOption({label:"Tạm dừng"});await saved();assert.deepEqual(writes.at(-1).patch,{trang_thai:"TAM_DUNG"});

  await open("vouchers");assert.ok(!(await page.locator("thead").innerText()).includes("Ngày tạo"));await edit(1,"gia_tri_giam");await page.getByLabel("Loại giảm 1",{exact:true}).selectOption({label:"Số tiền"});await page.getByLabel("Giá trị giảm 1",{exact:true}).fill("100000");await page.getByLabel("Giá trị giảm 1",{exact:true}).press("Enter");await saved();assert.deepEqual(writes.at(-1).patch,{loai_giam:"SO_TIEN",gia_tri_giam:"100000"});

  await open("receipts");assert.ok(!(await page.locator("thead").innerText()).includes("Ghi chú"));await edit(-6,"ma_phieu_code");assert.equal(await page.locator("tbody input").count(),0);
  await edit(-5,"ma_phieu_code");await page.getByLabel("Mã phiếu -5",{exact:true}).fill("PN-MOI");conflict=true;await page.getByLabel("Mã phiếu -5",{exact:true}).press("Enter");await page.getByRole("alert").filter({hasText:"Phiếu vừa được xử lý"}).waitFor();assert.equal(await page.getByLabel("Mã phiếu -5",{exact:true}).inputValue(),"PN-MOI");await page.getByLabel("Mã phiếu -5",{exact:true}).press("Enter");await saved();assert.deepEqual(writes.at(-1).patch,{ma_phieu_code:"PN-MOI"});assert.deepEqual(writes.at(-1).key,[-5]);

  await open("transfers");assert.ok(!(await page.locator("thead").innerText()).includes("Ghi chú"));await edit(-8,"ma_kho_nhan");assert.equal(await page.locator("tbody input").count(),0);
  await edit(-7,"ma_kho_nhan");await page.getByLabel("Kho nhận -7",{exact:true}).fill("-3");await page.getByLabel("Kho nhận -7",{exact:true}).press("Enter");await saved();assert.deepEqual(writes.at(-1).patch,{ma_kho_nhan:-3});
  assert.equal(await page.locator("tbody select").count(),0,"Document state must not be written as a table field");
  await row(-7).getByRole("link",{name:"Chi tiết",exact:true}).click();await page.locator(".live-field").filter({hasText:"Ghi chú chuyển kho"}).waitFor();
  assert.deepEqual(errors,[]);
  console.log("PASS: six tables, hidden list-only columns, Vietnamese enums, exact numeric/string payloads, dates, draft-only updates, finalized guards, conflict drafts, full detail notes. Mocked writes only.");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
