const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
function load(fetch) {
  const scope={exports:{},require:()=>({adminFetch:fetch}),AbortSignal};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/product-gallery.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText,scope);
  return scope.exports;
}
test('gallery accepts multiple valid files, caps at 20, and rejects the whole invalid batch',()=>{
  const {validateGalleryFiles}=load(); const file={name:'a.png',size:100,type:'image/png'};
  validateGalleryFiles([file,file],18);
  assert.throws(()=>validateGalleryFiles([file,file],19),/20/);
  for(const invalid of [{...file,size:0},{...file,size:5242881},{...file,type:'image/svg+xml'}])assert.throws(()=>validateGalleryFiles([file,invalid],0));
});
test('choosing primary or moving images preserves all identifiers and does not mutate the draft',()=>{
  const {moveGalleryImage}=load(); const original=['A','B','C'];
  assert.equal(JSON.stringify(moveGalleryImage(original,2,0)),JSON.stringify(['C','A','B']));
  assert.deepEqual(original,['A','B','C']);
  assert.equal(JSON.stringify(moveGalleryImage(original,0,-1)),JSON.stringify(original));
});
test('gallery save sends explicit optimistic snapshot, identifiers and URLs; no raw file or full product update',async()=>{
  const calls=[]; const base={product_id:'SP1',legacy_url:'/old.png',images:[{media_id:'A',url:'/old.png'}]};
  const {galleryRequest}=load(async(url,options)=>{calls.push({url,options});return Response.json({product_id:'SP1',legacy_url:null,images:[]});});
  await galleryRequest('SP1',new AbortController().signal,{items:[{media_id:'B'},{url:'/new.png'}],base});
  assert.equal(calls[0].url,'/api/backend/admin/media/products/SP1/images');
  assert.equal(calls[0].options.method,'PUT');
  assert.deepEqual(JSON.parse(calls[0].options.body),{items:[{media_id:'B'},{url:'/new.png'}],expected_ids:['A'],expected_legacy_url:'/old.png'});
});
test('gallery missing backend, conflict and malformed responses are not accepted as successful saves',async()=>{
  for(const [status,body] of [[404,{}],[409,{detail:'Gallery đã thay đổi'}],[200,{product_id:'OTHER',images:[]}],[200,{product_id:'SP1',images:[{}]}]]) {
    const {galleryRequest}=load(async()=>Response.json(body,{status}));
    await assert.rejects(galleryRequest('SP1',new AbortController().signal));
  }
});
