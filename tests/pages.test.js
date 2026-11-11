'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {buildPages}=require('../scripts/build-pages.js');

function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-pages-'));
 for(const name of ['main','dev']){
  const source=path.join(dir,name);fs.mkdirSync(path.join(source,'src'),{recursive:true});
  fs.writeFileSync(path.join(source,'index.html'),`<html><body>${name}<script src="./plotly.min.js"></script><script src="./src/ui.js"></script></body></html>`);
  fs.writeFileSync(path.join(source,'plotly.min.js'),'/* vendor */');
  fs.writeFileSync(path.join(source,'src/ui.js'),`const KEY='qbudget-mvp-1',LAYOUT_KEY='qbudget-layout-v1';localStorage.setItem(KEY,'${name}');localStorage.setItem(LAYOUT_KEY,'layout-${name}');`);
  fs.writeFileSync(path.join(source,'.env'),'NE_PAS_PUBLIER');
  fs.writeFileSync(path.join(source,'annotations.json'),'NE_PAS_PUBLIER');
 }
 return {dir,main:path.join(dir,'main'),dev:path.join(dir,'dev'),output:path.join(dir,'public')};
}

test('Pages : racine conservée, aperçu complet et stockage séparé sur la même origine',()=>{
 const f=fixture();
 try{
  buildPages(f.main,f.dev,f.output);
  assert.equal(fs.readFileSync(path.join(f.output,'index.html'),'utf8'),fs.readFileSync(path.join(f.main,'index.html'),'utf8'));
  assert.match(fs.readFileSync(path.join(f.output,'dev/index.html'),'utf8'),/Version de développement/);
  const data=new Map(),localStorage={setItem:(k,v)=>data.set(k,v)};
  for(const file of ['src/ui.js','dev/src/ui.js'])vm.runInNewContext(fs.readFileSync(path.join(f.output,file),'utf8'),{localStorage});
  assert.deepEqual(Object.fromEntries(data),{'qbudget-mvp-1':'main','qbudget-layout-v1':'layout-main','qbudget-dev-mvp-1':'dev','qbudget-dev-layout-v1':'layout-dev'});
  for(const prefix of ['', 'dev/']){
   assert.ok(fs.existsSync(path.join(f.output,prefix,'plotly.min.js')));
   assert.ok(!fs.existsSync(path.join(f.output,prefix,'.env')));
   assert.ok(!fs.existsSync(path.join(f.output,prefix,'annotations.json')));
  }
  assert.equal(fs.readFileSync(path.join(f.dev,'src/ui.js'),'utf8').includes('qbudget-dev-'),false,'le code source reste indépendant de la publication');
 }finally{fs.rmSync(f.dir,{recursive:true,force:true})}
});

test('Pages : chemins sortants et liens symboliques refusés',()=>{
 const f=fixture();
 try{
  fs.writeFileSync(path.join(f.dev,'index.html'),'<body><script src="../annotations.json"></script>');
  assert.throws(()=>buildPages(f.main,f.dev,f.output),/non autorisé/);
  fs.rmSync(f.output,{recursive:true,force:true});
  fs.writeFileSync(path.join(f.dev,'index.html'),'<body><script src="./src/private.js"></script>');
  fs.symlinkSync(path.join(f.main,'annotations.json'),path.join(f.dev,'src/private.js'));
  assert.throws(()=>buildPages(f.main,f.dev,f.output),/hors du site/);
 }finally{fs.rmSync(f.dir,{recursive:true,force:true})}
});

test('Pages : ancienne interface avec stockage inline isolée également',()=>{
 const f=fixture();
 try{
  fs.writeFileSync(path.join(f.dev,'index.html'),'<body><script>const KEY="qbudget-mvp-1",LAYOUT_KEY="qbudget-layout-v1";</script>');
  buildPages(f.main,f.dev,f.output);
  assert.match(fs.readFileSync(path.join(f.output,'dev/index.html'),'utf8'),/qbudget-dev-mvp-1/);
  assert.match(fs.readFileSync(path.join(f.output,'dev/index.html'),'utf8'),/qbudget-dev-layout-v1/);
 }finally{fs.rmSync(f.dir,{recursive:true,force:true})}
});
