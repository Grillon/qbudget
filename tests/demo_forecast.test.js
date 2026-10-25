'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const e=require('../src/engine.js');
const dir=path.join(__dirname,'fixtures');
const csv=e.readCsv(fs.readFileSync(path.join(dir,'life_2026_operations.csv'),'utf8'));
const annotations=JSON.parse(fs.readFileSync(path.join(dir,'life_2026_annotations.json'),'utf8'));
const demo=()=>e.mergeAnnotations(csv,annotations);
const at='2026-10-25',until='2027-12-31';
const byId=(m,id)=>m.rows.find(r=>r.id==='DEMO-'+id);
test('démo : Qonto distinct avec référence et trois dépenses personnelles réellement payées',()=>{
 const m=demo();
 assert.ok(e.accountNames(m).includes('Qonto'));
 assert.deepEqual(m.references.Qonto,{date:at,balance:0});
 for(const [id,bank,amount] of [['PERSO-ESSENCE','BPS',-68.4],['PERSO-PEAGE','BPS',-28.1],['PERSO-RESTO','Revolut',-42.5]]){
  const r=byId(m,id);assert.equal(r.bank,bank);assert.equal(r.amount,amount);assert.equal(r.nature,'actual');assert.equal(e.isFloating(r),false);
  assert.ok(r.date<=at);assert.ok(e.tagsFor(m,r).includes('personnel'));
 }
 assert.equal(m.rows.filter(r=>r.manual).length,7);
 assert.deepEqual(e.check(m),{ok:true,errors:[],warnings:[]});
});
test('démo : IK et restaurant 2 contreparties chacune, flottantes et non comptabilisées',()=>{
 const m=demo();
 for(const [kind,amount] of [['IK',350],['NDF',42.5]]){
  const pro=byId(m,kind+'-PRO'),perso=byId(m,kind+'-PERSO');
  assert.equal(pro.bank,'Qonto');assert.notEqual(perso.bank,'Qonto');
  assert.equal(pro.amount,-amount);assert.equal(perso.amount,+amount);assert.equal(pro.amount+perso.amount,0);
  for(const row of [pro,perso]){assert.equal(e.isFloating(row),true);assert.equal(row.nature,'planned')}
 }
 assert.equal(e.pendingOperations(m,{account:'Qonto',tags:['SASU','enCoursDeCreation']}).length,2);
 assert.equal(e.pendingOperations(m,{tags:['IK']}).length,2);
 assert.equal(e.pendingOperations(m,{tags:['noteDeFrais']}).length,2);
 assert.equal(e.totalBalance(m,at,'Qonto'),0);
 assert.equal(e.forecast(m,at,until,'Qonto').closing,0);
 const actual=e.auditOperations(m,{scope:'actual',at,until});
 const all=e.auditOperations(m,{scope:'all',at,until});
 assert.equal(actual.filter(r=>r.identifiant.startsWith('DEMO-')).length,3);
 assert.equal(all.filter(r=>r.identifiant.startsWith('DEMO-')).length,3);
});
test('prévisualisation des récurrences exactement identique aux lignes d’audit, sans enregistrer ou dupliquer',()=>{
 const m=demo(),before=JSON.stringify(m),params={scope:'all',at,until};
 const lines=e.recurrencePreview(m,at,until);
 const audit=e.auditOperations(m,params).filter(row=>row.origine==='recurrence');
 assert.equal(lines.length,audit.length);
 assert.deepEqual(lines.map(row=>row.id),audit.map(row=>row.identifiant));
 assert.ok(lines.every(row=>row.forecast&&row.date>at&&row.date<=until&&row.id.startsWith('rec:')));
 assert.ok(lines.every(row=>!m.rows.some(saved=>saved.id===row.id)));
 assert.equal(JSON.stringify(m),before);
 assert.equal(e.recurrencePreview(m,at,until,'Qonto').length,0);
 assert.equal(e.recurrencePreview(m,until,at).length,0);
 assert.equal(e.recurrencePreview(m,at,until,'BPS').length,audit.filter(row=>row.compte==='BPS').length);
 assert.ok(lines.some(row=>row.desc==='Loyer'&&row.tags.includes('logement')));
});
test('prévisualisation insensible à l’ajout de flottantes et séquences reproductibles',()=>{
 const m=demo(),without={...m,rows:m.rows.filter(row=>!e.isFloating(row))};
 assert.deepEqual(e.recurrencePreview(m,at,until),e.recurrencePreview(without,at,until));
 assert.deepEqual(e.forecast(m,at,until),e.forecast(without,at,until));
 assert.equal(e.totalBalance(m,at),4120);
 // Une datation des deux contreparties impacte les comptes indépendamment,
 // mais n'ajoute ni ne retire les lignes récurrentes.
 const count=e.recurrencePreview(m,at,until).length;
 byId(m,'IK-PRO').date='2026-11-10';byId(m,'IK-PERSO').date='2026-11-12';
 assert.equal(e.forecast(m,at,'2026-11-11','Qonto').closing,-350);
 assert.equal(e.forecast(m,at,'2026-11-12','Qonto').closing,-350);
 assert.equal(e.forecast(m,at,'2026-11-12').closing,e.forecast(without,at,'2026-11-12').closing);
 assert.equal(e.recurrencePreview(m,at,until).length,count);
});
test('import/export annotations avec la démo pro/perso (aucune duplication, dates null conservées)',()=>{
 const m=demo();
 const saved=JSON.parse(JSON.stringify({version:3,notes:m.notes,rules:m.rules,accounts:m.accounts,references:m.references,manualRows:m.rows.filter(r=>r.manual)}));
 const restored=e.mergeAnnotations(csv,saved);
 assert.deepEqual(restored,m);
 assert.equal(restored.rows.filter(r=>r.manual).length,7);
 assert.equal(restored.rows.filter(r=>r.manual&&e.isFloating(r)).length,4);
 assert.deepEqual(e.mergeAnnotations(restored.rows,saved),restored);
});
test('interface : bascule forecast + différenciation visuelle + API DevTools',()=>{
 const h=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(h,/id="showForecastRows" checked/);
 assert.match(h,/QBudgetEngine\.recurrencePreview\(model,at,until,selected\)/);
 assert.match(h,/FORECAST · calculé/);
 assert.match(h,/className='forecast-row'/);
 assert.match(h,/globalThis\.qbudget=qbudget/);
 for(const cmd of ['help','test','demo','pending','forecast','recurrences','snapshot'])assert.match(h,new RegExp(cmd+'\\('));
});
