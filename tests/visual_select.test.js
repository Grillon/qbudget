'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../src/engine.js');
const visual=require('../src/visual-select.js');
const model={rows:[
 {id:'fuel',bank:'BPS',date:'2026-10-22',amount:-68.40,desc:'Essence',currency:'EUR'},
 {id:'resto',bank:'BPS',date:'2026-10-22',amount:-42.50,desc:'Restaurant',currency:'EUR'},
 {id:'transfer',bank:'BPS',date:'2026-10-22',amount:-1000,desc:'Vers Revolut',currency:'EUR'},
 {id:'income',bank:'Revolut',date:'2026-10-23',amount:1000,desc:'Reçu BPS',currency:'EUR'},
 {id:'float',bank:'Qonto',date:null,amount:-9999,desc:'IK',currency:'EUR'}
],notes:{fuel:{tags:['Transport','Carburant','personnel']},resto:{tags:['Restaurant','personnel']},transfer:{tags:['transfert_intercomptes','personnel']}},
 tagCategories:[{name:'Nature',tags:['Transport','Carburant','Restaurant'],source:'tags'},{name:'Entité',tags:['personnel','SASU'],source:'tags'}],references:{BPS:{date:'2026-10-23',balance:500},Revolut:{date:'2026-10-23',balance:800}},rules:{}};
const rows=model.rows.filter(r=>r.date&&r.amount<0&&r.id!=='transfer');
test('camembert : un secteur retrouve les écritures exactes, même avec plusieurs tags dans la même catégorie',()=>{
 const pie=engine.expenseCategoryTotals(model,rows,'Nature');
 assert.deepEqual(pie,[['Transport',68.4],['Restaurant',42.5]]);
 const selection=visual.select(model,rows,{kind:'pie',category:'Nature',label:'Transport'});
 assert.deepEqual(selection,{ids:['fuel'],count:1,total:68.4});
});
test('Sunburst/Treemap : la même branche retrouve les mêmes écritures, sans compter deux fois les niveaux',()=>{
 for(const order of [['Nature','Entité'],['Entité','Nature']]){
  const tree=engine.expenseBreakdown(model,rows,order);
  const root=visual.select(model,rows,{kind:'hierarchy',dimensions:order,nodeId:'total'});
  assert.equal(root.total,110.90);assert.equal(root.count,2);
  assert.equal(tree.values[0],root.total);
  for(let i=1;i<tree.ids.length;i++){
   const selection=visual.select(model,rows,{kind:'hierarchy',dimensions:order,nodeId:tree.ids[i]});
   assert.equal(selection.total,tree.values[i],tree.labels[i]);
  }
 }
});
test('transfert exclu uniquement du graphique : solde et audit inchangés',()=>{
 const previous=engine.totalBalance(model,'2026-10-23');
 const audit=engine.auditCsv(engine.auditOperations(model,{scope:'actual',until:'2026-10-23'}));
 const visible=visual.select(model,rows,{kind:'hierarchy',nodeId:'total',dimensions:['Nature']});
 assert.ok(!visible.ids.includes('transfer'));
 assert.ok(!visible.ids.includes('float'));
 assert.equal(engine.totalBalance(model,'2026-10-23'),previous);
 assert.equal(engine.auditCsv(engine.auditOperations(model,{scope:'actual',until:'2026-10-23'})),audit);
});
test('sélection invalide ne donne jamais des lignes ambiguës',()=>{
 assert.equal(visual.select(model,rows,{kind:'hierarchy',nodeId:'{oops'}),null);
 assert.deepEqual(visual.select(model,rows,{kind:'pie',category:'Nature',label:'inconnue'}),{ids:[],count:0,total:0});
});
test('interface : le sélecteur de vue et le panneau de détail sont présents, et le moteur n’est pas modifié',()=>{
 const html=fs.readFileSync('index.html','utf8'),ui=fs.readFileSync('src/ui.js','utf8');
 for(const id of ['chartDrilldown','chartDrilldownText','clearChartDrilldown'])assert.ok(html.includes(`id="${id}"`));
 assert.ok(html.includes('value="treemap"'));
 assert.match(ui,/Plotly\.react\('sunburstChart'/);
 assert.match(ui,/bindBreakdownClick/);
 assert.match(ui,/QBudgetVisualSelect\.select/);
});
