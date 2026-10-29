/** Isolated PostgreSQL: no live database, credentials, network or Storage writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

async function main() {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(read('Backend/migrations/001_initial_schema.sql'));
    await db.exec(read('Backend/migrations/20261029062340_product_gallery.sql'));
    await db.exec(`insert into "LOAI_SP" values ('L','Loại',1);
      insert into "LOAI_SP_CON" values ('C','Con','L',1);
      insert into "SAN_PHAM" (ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,duong_dan_anh)
      values ('P','S','Product','L','C',10,'/images/old.png'),('P2','S2','Other','L','C',10,'/images/other.png');
      insert into "MEDIA" (url) values ('/images/new.png'),('/images/third.png'),('/images/avatar.png');
      insert into "KHACH_HANG" (ma_kh,ten_kh) values ('K','Customer');
      insert into "TAI_KHOAN" (ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh,ma_media_anh_dai_dien)
      select 'A','test','fixture','K',ma_media from "MEDIA" where url='/images/avatar.png';`);
    const all = (await db.query('select ma_media,url from "MEDIA"')).rows;
    const id = url => all.find(row => row.url === url).ma_media;
    const old = id('/images/old.png'), second = id('/images/new.png'), third = id('/images/third.png');
    const call = async (items, expected, legacy, product='P') => (await db.query(
      'select public.admin_product_gallery_v1($1,$2::jsonb,$3::uuid[],$4) as gallery',
      [product, JSON.stringify(items), expected, legacy])).rows[0].gallery;
    const entries = ids => ids.map(media_id => ({media_id}));
    const ids = gallery => gallery.images.map(image => image.media_id);
    let gallery = await call(entries([old,second,third]), [old], '/images/old.png');
    assert.deepEqual(ids(gallery), [old,second,third]);
    assert.deepEqual(gallery.images.map(image => image.primary), [true,false,false]);
    gallery = await call(entries([third,old,second]), ids(gallery), gallery.legacy_url);
    assert.deepEqual(ids(gallery), [third,old,second]);
    assert.equal(gallery.legacy_url, '/images/third.png');
    assert.equal((await db.query('select duong_dan_anh from "SAN_PHAM" where ma_sp=\'P\'')).rows[0].duong_dan_anh, gallery.legacy_url);

    await assert.rejects(call([], [old], '/images/old.png'), error => error.code === 'PT409');
    for (const foreignId of [id('/images/other.png'), id('/images/avatar.png'), '00000000-0000-0000-0000-000000000099']) {
      await assert.rejects(call(entries([foreignId]), ids(gallery), gallery.legacy_url), error => error.code === 'PT422');
    }
    await assert.rejects(call([{media_id:third},{url:'/images/third.png'}], ids(gallery), gallery.legacy_url), error => error.code === 'PT422');
    await assert.rejects(call([{url:'javascript:alert(1)'}], ids(gallery), gallery.legacy_url), error => error.code === 'PT422');
    assert.equal((await db.query('select count(*)::int n from "MEDIA" where ma_sp=\'P\'')).rows[0].n, 3, 'failed writes roll back');

    gallery = await call([{url:'https://example.test/external.png'},{media_id:third}], ids(gallery), gallery.legacy_url);
    assert.equal(gallery.images.length, 2);
    assert.equal(gallery.images[0].url, 'https://example.test/external.png');
    assert.equal((await db.query('select ma_sp from "MEDIA" where ma_media=$1',[second])).rows[0].ma_sp, null);
    const mediaCount = (await db.query('select count(*)::int n from "MEDIA"')).rows[0].n;
    gallery = await call([], ids(gallery), gallery.legacy_url);
    assert.deepEqual(gallery.images, []); assert.equal(gallery.legacy_url, null);
    assert.equal((await db.query('select count(*)::int n from "MEDIA"')).rows[0].n, mediaCount, 'unlink never deletes media');
    await assert.rejects(call([],[],null,'missing'), error=>error.code==='PT404');
    const privileges = (await db.query(`select has_function_privilege('anon','public.admin_product_gallery_v1(text,jsonb,uuid[],text)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.admin_product_gallery_v1(text,jsonb,uuid[],text)','EXECUTE') as authenticated,
      has_function_privilege('service_role','public.admin_product_gallery_v1(text,jsonb,uuid[],text)','EXECUTE') as backend`)).rows[0];
    assert.deepEqual(privileges, {anon:false,authenticated:false,backend:true});
    await db.exec('set role service_role');
    const empty = await call([],[],null); assert.deepEqual(empty.images, []);
    console.log('Product gallery SQL passed: multi-image/reorder/primary/legacy/unlink/ownership/rollback/conflict/privileges.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
