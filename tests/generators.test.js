'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(script,args,cwd){
 const result=spawnSync(process.execPath,[path.join(cwd,'scripts',script+'.js'),...args],{cwd,encoding:'utf8'});
 if(result.error)throw result.error;
 return result;
}
const generators=[['build-demo','demo','QBudgetDemo'],['build-bank-config','bank-config','QBudgetBankConfig'],['sync-version','version','QBudgetVersion']];
test('générateurs Node : données embarquées conservées, sortie reproductible et contrôles sans écriture',()=>{
 for(const [script,target,globalName] of generators){
  const current=fs.readFileSync(path.join(root,'src',target+'.js'),'utf8');
  const expected=require('../scripts/'+script+'.js').content();
  assert.equal(current,expected);
  const sandbox={};vm.runInNewContext(expected,sandbox);
  assert.ok(sandbox[globalName]);
  assert.equal(run(script,['--check'],root).status,0);
 }
});
test('générateurs Node : --check échoue sur un asset périmé et ne le modifie pas',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-generators-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const subdir of ['scripts','src','tests/fixtures'])fs.mkdirSync(path.join(dir,subdir),{recursive:true});
 for(const file of ['package.json','banques.json','tests/fixtures/life_2026_operations.csv','tests/fixtures/life_2026_annotations.json','scripts/generated-file.js',...generators.map(([script])=>'scripts/'+script+'.js')])fs.copyFileSync(path.join(root,file),path.join(dir,file));
 for(const [script,target] of generators){
  const file=path.join(dir,'src',target+'.js');
  fs.writeFileSync(file,'contenu périmé');
  const stale=run(script,['--check'],dir);
  assert.equal(stale.status,1);assert.match(stale.stderr,/désynchronisé/);
  assert.equal(fs.readFileSync(file,'utf8'),'contenu périmé');
  assert.equal(run(script,[],dir).status,0);
  assert.equal(run(script,['--check'],dir).status,0);
  assert.equal(run(script,['--help'],dir).status,0);
  assert.equal(run(script,['--unknown'],dir).status,2);
 }
});
