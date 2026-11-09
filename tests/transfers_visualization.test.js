'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const e=require('../src/engine.js');
const tags=require('../src/tags.js');
const root=path.join(__dirname,'..');

function model(){return {
 rows:[
  {id:'out',bank:'BoursoBank',date:'2026-10-10',amount:-1000,currency:'EUR',desc:'Virement vers BPS',nature:'actual'},
  {id:'in',bank:'BPS',date:'2026-10-11',amount:1000,currency:'EUR',desc:'Virement depuis BoursoBank',nature:'actual'},
  {id:'resto',bank:'BoursoBank',date:'2026-10-12',amount:-70,currency:'EUR',desc:'Restaurant',nature:'actual'},
  {id:'salary',bank:'BPS',date:'2026-10-09',amount:2700,currency:'EUR',desc:'Revenu',nature:'actual'},
  {id:'pending',bank:'BPS',date:null,amount:-500,currency:'EUR',desc:'Virement à prévoir',nature:'planned'}
 ],notes:{out:{tags:['transfert_intercomptes','personnel']},in:{tags:['TRANSFERT_INTERCOMPTES','personnel']},resto:{tags:['restaurant','personnel']},pending:{tags:['transfert_intercomptes']}},references:{BoursoBank:{date:'2026-10-12',balance:750},BPS:{date:'2026-10-12',balance:5000}},rules:{},accounts:['BoursoBank','BPS'],excludedAccounts:[],tagCategories:tags.defaults()
};}

test('nouveau tag dans le dictionnaire par défaut et dans son export/import JSON',()=>{
 const data=tags.defaults();
 assert.ok(data.find(c=>c.name==='Traitement').tags.includes('transfert_intercomptes'));
 assert.deepEqual(tags.parseJson(tags.exportJson(data)),data);
 const example=JSON.parse(fs.readFileSync(path.join(root,'examples/categories-par-defaut.json'),'utf8'));
 assert.deepEqual(tags.parseJson(example),data);
});

test('migration seulement de la catégorie Traitement d’origine : préserve les personnalisations et la suppression',()=>{
 const old=tags.defaults();old.find(c=>c.name==='Traitement').tags.pop();
 const migrated=tags.upgradeDefaultTreatment(old);
 assert.notStrictEqual(migrated,old);
 assert.equal(migrated.find(c=>c.name==='Traitement').tags.at(-1),'transfert_intercomptes');
 assert.equal(old.find(c=>c.name==='Traitement').tags.includes('transfert_intercomptes'),false);
 assert.strictEqual(tags.upgradeDefaultTreatment(migrated),migrated);
 const custom=structuredClone(old);custom.find(c=>c.name==='Traitement').tags.push('mon_tag');
 assert.strictEqual(tags.upgradeDefaultTreatment(custom),custom);
 const removed=old.filter(c=>c.name!=='Traitement');
 assert.strictEqual(tags.upgradeDefaultTreatment(removed),removed);
});

test('filtre graphique : les virements sortants ne gonflent pas le donut ou le sunburst',()=>{
 const m=model(),rows=m.rows.filter(r=>r.date),original=JSON.stringify(m);
 const visible=tags.withoutTag(m,rows,'transfert_intercomptes');
 assert.deepEqual(visible.map(r=>r.id),['resto','salary']);
 const allPie=e.expenseCategoryTotals(m,rows,'Nature');
 const filteredPie=e.expenseCategoryTotals(m,visible,'Nature');
 const total=pie=>pie.reduce((s,[,v])=>s+v,0);
 assert.equal(total(allPie),1070);
 assert.equal(total(filteredPie),70);
 assert.equal(e.expenseBreakdown(m,rows,['Nature','Entité']).values[0],1070);
 assert.equal(e.expenseBreakdown(m,visible,['Nature','Entité']).values[0],70);
 assert.equal(JSON.stringify(m),original,'aucune écriture ni annotation modifiée');
});

test('comparaison des soldes, prévisions et audit avant/après filtrage graphique, indépendante des tags',()=>{
 const m=model(),at='2026-10-12',until='2027-01-01';
 const before={balance:e.totalBalance(m,at),forecast:e.forecast(m,at,until),audit:e.auditCsv(e.auditOperations(m,{scope:'all',at,until}))};
 tags.withoutTag(m,m.rows,'transfert_intercomptes');
 assert.equal(e.totalBalance(m,at),before.balance);
 assert.deepEqual(e.forecast(m,at,until),before.forecast);
 assert.equal(e.auditCsv(e.auditOperations(m,{scope:'all',at,until})),before.audit);
});

test('filtrage insensible à la casse et tag absent : aucune suppression, flottantes non comptées',()=>{
 const m=model(),rows=m.rows.filter(r=>r.date),visible=tags.withoutTag(m,rows,' TRANSFERT_INTERCOMPTES ');
 assert.equal(visible.length,2);
 assert.equal(tags.withoutTag(m,rows,'inexistant').length,4);
 assert.equal(m.rows.length,5);
 assert.equal(m.rows.find(r=>r.id==='pending').date,null);
});

test('les deux graphiques se synchronisent via la même préférence, qui est exportée',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'src/ui.js'),'utf8');
 assert.equal((html.match(/id="excludeTransfersDonut"/g)||[]).length,1);
 assert.equal((html.match(/id="excludeTransfersSunburst"/g)||[]).length,1);
 assert.match(js,/const breakdownRows=exclude\?QBudgetTags\.withoutTag/);
 assert.match(js,/expenseCategoryTotals\(model,breakdownRows/);
 assert.match(js,/expenseBreakdown\(model,breakdownRows/);
 assert.match(js,/excludeTransfersFromCharts:model\.excludeTransfersFromCharts!==false/);
 assert.match(js,/model\.excludeTransfersFromCharts=o\.excludeTransfersFromCharts!==false/);
 assert.match(js,/model\.excludeTransfersFromCharts=e\.target\.checked;save\(\);renderVisuals\(\)/);
});
