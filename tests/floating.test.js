'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const e=require('../src/engine.js');
const root=path.join(__dirname,'..');
function fixture(){return {
 rows:[
  {id:'a',bank:'BoursoBank',account:'BoursoBank',date:'2026-10-24',amount:-100,desc:'Courses',currency:'EUR'},
  {id:'b',bank:'BoursoBank',account:'BoursoBank',date:'2026-10-25',amount:500,desc:'Salaire',currency:'EUR'}
 ],notes:{},references:{BoursoBank:{date:'2026-10-25',balance:2000}},rules:{},accounts:[]
}}
const floating=(id,bank,amount,desc='IK')=>({id,bank,account:bank,date:null,amount,desc,nature:'planned',manual:true,currency:'EUR'});
test('Qonto enregistré sans transaction : global et compte visibles, solde Qonto=0',()=>{
 const m=fixture();m.accounts.push('Qonto');m.references.Qonto={date:'2026-10-25',balance:0};
 assert.deepEqual(e.accountNames(m),['BoursoBank','Qonto']);
 assert.equal(e.totalBalance(m,'2026-10-25','Qonto'),0);
 assert.equal(e.totalBalance(m,'2026-10-25'),2000);
 assert.equal(e.forecast(m,'2026-10-25','2026-11-30').closing,2000);
});
test('flottante seule sur Qonto sans compte initial déclaré ne change pas le total',()=>{
 const m=fixture(),before=e.forecast(m,'2026-10-25','2027-12-31');
 m.rows.push(floating('floatQ','Qonto',-420));
 assert.deepEqual(e.accountNames(m),['BoursoBank','Qonto']);
 assert.deepEqual(e.cashAccountNames(m),['BoursoBank']);
 assert.deepEqual(e.forecast(m,'2026-10-25','2027-12-31'),before);
 assert.deepEqual(e.check(m),{ok:true,errors:[],warnings:[]});
});
test('flottantes +/- sur comptes existants ne modifient ni historique, ni prévision, ni audit',()=>{
 const m=fixture(),at='2026-10-25',until='2027-12-31';
 m.accounts=['Qonto'];m.references.Qonto={date:at,balance:0};
 const historical=e.totalBalance(m,'2026-10-23');const base=e.forecast(m,at,until);
 const actual=e.auditCsv(e.auditOperations(m,{scope:'actual',at,until}));
 const all=e.auditCsv(e.auditOperations(m,{scope:'all',at,until}));
 m.rows.push(floating('ikMinus','Qonto',-420),floating('ikPlus','BoursoBank',420));
 assert.equal(e.totalBalance(m,'2026-10-23'),historical);
 assert.deepEqual(e.forecast(m,at,until),base);
 assert.equal(e.auditCsv(e.auditOperations(m,{scope:'actual',at,until})),actual);
 assert.equal(e.auditCsv(e.auditOperations(m,{scope:'all',at,until})),all);
 assert.equal(e.pendingOperations(m).length,2);
});
test('dater une opération prévue l’intègre une fois à la prévision, sans toucher au solde actuel',()=>{
 const m=fixture();m.rows.push(floating('dep','BoursoBank',-120));
 const start=e.forecast(m,'2026-10-25','2026-11-30','BoursoBank').closing;
 const row=m.rows.at(-1);row.date='2026-11-10';
 assert.equal(e.totalBalance(m,'2026-10-25','BoursoBank'),2000);
 assert.equal(e.forecast(m,'2026-10-25','2026-11-30','BoursoBank').closing,start-120);
 assert.equal(e.auditOperations(m,{scope:'all',at:'2026-10-25',until:'2026-11-30'}).filter(x=>x.identifiant==='dep').length,1);
 row.date=null;
 assert.equal(e.forecast(m,'2026-10-25','2026-11-30','BoursoBank').closing,start);
});
test('dater comme opération réalisée influe sur le solde et la rétroprojection',()=>{
 const m=fixture();const row=floating('pay','BoursoBank',-25);m.rows.push(row);
 assert.equal(e.totalBalance(m,'2026-10-26','BoursoBank'),2000);
 row.date='2026-10-26';row.nature='actual';
 assert.equal(e.totalBalance(m,'2026-10-26','BoursoBank'),1975);
 assert.equal(e.totalBalance(m,'2026-10-25','BoursoBank'),2000);
});
test('tags exacts : filtres ET/OU, recherche, comptes et insensibilité à la casse',()=>{
 const m=fixture();m.rows.push(floating('ik','Qonto',-420,'Trajet Lille'),floating('dev','Qonto',-35,'Dev'),floating('perso','BoursoBank',200,'Vacances'));
 m.notes={ik:{tags:['SASU','IK','enCoursDeCreation'],tag:'SASU'},dev:{tag:'SASU, Logiciel'},perso:{tags:['personnel']}};
 assert.deepEqual(e.pendingOperations(m,{tags:['sasu','ik']}).map(r=>r.id),['ik']);
 assert.deepEqual(e.pendingOperations(m,{tags:['SASU','personnel'],mode:'any'}).map(r=>r.id),['ik','dev','perso']);
 assert.deepEqual(e.pendingOperations(m,{account:'Qonto',search:'lille'}).map(r=>r.id),['ik']);
 assert.deepEqual(e.pendingOperations(m,{tags:['creation']}).map(r=>r.id),[]);
 assert.deepEqual(e.tagsFor(m,m.rows.find(r=>r.id==='dev')),['SASU','Logiciel']);
});
test('sauvegarde annotations JSON puis rechargement CSV : flottantes intactes et aucun doublon',()=>{
 const source=fixture();source.accounts=['Qonto'];source.excludedAccounts=[];source.references.Qonto={date:'2026-10-25',balance:0};
 source.rows.push(floating('f1','Qonto',-170));source.notes.f1={tags:['SASU','IK','enCoursDeCreation'],tag:'SASU'};
 const annotations={version:3,accounts:source.accounts,excludedAccounts:source.excludedAccounts,notes:source.notes,references:source.references,rules:source.rules,manualRows:source.rows.filter(r=>r.manual)};
 const json=JSON.stringify(annotations);const copies=JSON.parse(json);
 const loaded=e.mergeAnnotations(source.rows.filter(r=>!r.manual),copies);
 assert.deepEqual(loaded,source);
 assert.equal(e.pendingOperations(loaded)[0].date,null);
 assert.equal(e.auditOperations(loaded,{scope:'all',at:'2026-10-25',until:'2027-12-31'}).some(r=>r.identifiant==='f1'),false);
 assert.equal(e.mergeAnnotations(loaded.rows,copies).rows.length,loaded.rows.length);
});
test('vérification : opérations importées sans date ou réalisées flottantes refusées',()=>{
 const m=fixture();m.rows.push(floating('bad','Qonto',10));m.rows.at(-1).nature='actual';
 assert.equal(e.check(m).ok,false);
 m.rows.at(-1).nature='planned';m.rows.at(-1).manual=false;
 assert.equal(e.check(m).ok,false);
});
test('CLI check et forecast utilisent les mêmes données de Qonto/flottantes après export',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-float-'));
 try{
  const csv=path.join(__dirname,'fixtures','operations.csv'),orig=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','annotations.json'),'utf8'));
  orig.accounts=['Qonto'];orig.references.Qonto={date:'2026-10-25',balance:0};orig.manualRows=[floating('floating','Qonto',-9000)];orig.notes={...orig.notes,floating:{tags:['SASU','IK']}};
  const jsonfile=path.join(directory,'annotations.json');fs.writeFileSync(jsonfile,JSON.stringify(orig));
  const check=JSON.parse(execFileSync(process.execPath,['src/cli.js','check','--csv',csv,'--annotations',jsonfile,'--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(check.ok,true);
  const result=JSON.parse(execFileSync(process.execPath,['src/cli.js','forecast','--csv',csv,'--annotations',jsonfile,'--at','2026-10-25','--until','2026-11-30','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(result.closing,1984);
  const csvText=execFileSync(process.execPath,['src/cli.js','export','--csv',csv,'--annotations',jsonfile,'--at','2026-10-25','--until','2026-11-30'],{cwd:root,encoding:'utf8'});
  assert.doesNotMatch(csvText,/floating/);
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
});
test('l’interface propose le compte Qonto, la file filtrable et la datation',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['newAccountName','addAccount','manualTags','manualDate','pendingRows','pendingCount','pendingSearch','pendingTags','pendingTagMode'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/QBudgetEngine\.pendingOperations/);
 assert.match(html,/manualRows:model\.rows\.filter\(r=>r\.manual\)/);
 assert.match(html,/model\.accounts=o\.accounts\|\|\[\]/);
});
