'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function cli(...options){return spawnSync(process.execPath,['src/cli.js','forecast','--csv','tests/fixtures/operations.csv','--annotations','tests/fixtures/annotations.json','--json',...options],{cwd:root,encoding:'utf8'})}
test('CLI : horizon en mois borné à la fin du mois, cohérent avec les dates partagées',()=>{
 for(const [at,months,until] of [['2026-01-31','1','2026-02-28'],['2024-01-31','1','2024-02-29'],['2026-11-30','3','2027-02-28']]){
  const result=cli('--at',at,'--months',months);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).until,until);
 }
});
test('CLI : dates calendaires impossibles refusées avec échec explicite',()=>{
 for(const [option,date] of [['--at','2026-02-30'],['--at','2026-99-99'],['--until','2026-02-29'],['--until','invalide']]){
  const result=cli('--at','2026-01-01',option,date);assert.notEqual(result.status,0);assert.match(result.stderr,/date|Date/);
 }
});
test('CLI : cumul de devises indisponible avec diagnostic en JSON et en texte',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-cli-currency-'));
 try{
  const csv=path.join(dir,'operations.csv'),ann=path.join(dir,'annotations.json');
  fs.writeFileSync(csv,'Date;Banque;Compte;Libellé;Montant;Devise\n2026-11-01;BPS;Courant;EUR;10;EUR\n2026-11-01;BPS;Courant;USD;100;USD');
  fs.writeFileSync(ann,JSON.stringify({notes:{},references:{BPS:{date:'2026-10-31',balance:100}}}));
  for(const command of ['balance','forecast'])for(const json of [true,false]){
   const result=spawnSync(process.execPath,['src/cli.js',command,'--csv',csv,'--annotations',ann,'--at','2026-11-01','--until','2026-11-02',...(json?['--json']:[])],{cwd:root,encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);
   if(json){const data=JSON.parse(result.stdout);assert.equal(command==='balance'?data.balance:data.closing,null);assert.ok(data.diagnostics.some(d=>/USD/.test(d)))}
   else{assert.match(result.stdout,/ATTENTION:.*USD/);assert.doesNotMatch(result.stdout,/210\.00 EUR/)}
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
