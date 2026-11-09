'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../src/engine.js');
const visual=require('../src/visual-select.js');
const tags=require('../src/tags.js');
const at='2026-10-25',until='2026-11-30';
function fixture(){
 const rows=[
  {id:'bank',bank:'BoursoBank',date:'2026-10-20',desc:'Achats',amount:-80,currency:'EUR',nature:'actual'},
  {id:'manual-real',bank:'BoursoBank',date:'2026-10-21',desc:'Essence saisie',amount:-30,currency:'EUR',nature:'actual',manual:true},
  {id:'manual-planned',bank:'BoursoBank',date:'2026-11-08',desc:'Péage prévu',amount:-50,currency:'EUR',nature:'planned',manual:true},
  {id:'manual-future',bank:'BoursoBank',date:'2026-11-18',desc:'Restaurant prévu',amount:-70,currency:'EUR',nature:'planned',manual:true},
  {id:'transfer',bank:'BoursoBank',date:'2026-10-19',desc:'Virement épargne',amount:-500,currency:'EUR',nature:'actual'},
  {id:'deposit',bank:'BoursoBank',date:'2026-11-12',desc:'Recette',amount:150,currency:'EUR',nature:'planned',manual:true},
  {id:'float',bank:'BoursoBank',date:null,desc:'IK en attente',amount:-700,currency:'EUR',nature:'planned',manual:true},
  {id:'after',bank:'BoursoBank',date:'2026-12-03',desc:'Après horizon',amount:-900,currency:'EUR',nature:'planned',manual:true},
  {id:'other-bank',bank:'Qonto',date:'2026-10-20',desc:'Autre compte',amount:-999,currency:'EUR',nature:'actual'},
  {id:'other-currency',bank:'BoursoBank',date:'2026-10-20',desc:'Devise',amount:-999,currency:'USD',nature:'actual'}
 ];
 const notes={
  bank:{tags:['courses']},
  'manual-real':{tags:['essence','transport']},
  'manual-planned':{tags:['peage','transport']},
  'manual-future':{tags:['restaurant']},
  transfer:{tags:['transfert_intercomptes']},
  ruleanchor:{tags:['telecom'],ruleId:'r1',type:'recurrent'}
 };
 const m={rows,notes,accounts:['BoursoBank','Qonto'],excludedAccounts:['Qonto'],references:{BoursoBank:{date:at,balance:1000},Qonto:{date:at,balance:0}},rules:{r1:{id:'r1',account:'BoursoBank',desc:'Abonnement',amount:-25,frequency:'mensuel',anchor:'2026-10-15',start:'2026-10-15',end:''}},tagCategories:[{name:'Nature',tags:['courses','essence','peage','transport','restaurant','telecom','transfert_intercomptes'],source:'tags'}]};
 // RecurrencePreview derive its tags from an attached operation.
 m.rows.push({id:'ruleanchor',bank:'BoursoBank',date:'2026-10-15',desc:'Abonnement',amount:-25,currency:'EUR',nature:'actual'});
 return m;
}
test('répartitions : les saisies manuelles datées (réalisées ET prévues) sont incluses, les flottantes exclues',()=>{
 const m=fixture(),before=JSON.stringify(m),balance=engine.totalBalance(m,at),forecast=engine.forecast(m,at,until);
 const data=visual.analysisRows(m,{at,until});
 for(const id of ['manual-real','manual-planned','manual-future','bank','transfer'])assert.ok(data.rows.some(r=>r.id===id),id);
 for(const id of ['float','after','other-bank','other-currency'])assert.ok(!data.rows.some(r=>r.id===id),id);
 assert.equal(data.plannedCount,3); // deux dépenses manuelles et une recette future
 assert.equal(data.forecastCount,1);
 const future=data.rows.find(r=>r.forecast);
 assert.equal(future.date,'2026-11-15');assert.equal(future.amount,-25);
 assert.ok(!m.rows.some(r=>r.id===future.id),'une récurrence ne devient pas une écriture enregistrée');
 assert.equal(JSON.stringify(m),before);
 assert.equal(engine.totalBalance(m,at),balance);assert.deepEqual(engine.forecast(m,at,until),forecast);
});
test('camembert, Sunburst et Treemap : total égal aux débits des opérations sélectionnées, sans double comptage',()=>{
 const m=fixture(),all=visual.analysisRows(m,{at,until}).rows;
 const visible=tags.withoutTag(m,all,'transfert_intercomptes');
 const debit=visible.filter(r=>r.amount<0).reduce((s,r)=>s-r.amount,0);
 assert.equal(debit,280); // 80+30+50+70+25+25
 assert.equal(engine.expenseCategoryTotals(m,visible,'Nature').reduce((s,entry)=>s+entry[1],0),debit);
 const tree=engine.expenseBreakdown(m,visible,['Nature']);
 assert.equal(tree.values[0],debit);
 assert.deepEqual(visual.select(m,visible,{kind:'hierarchy',nodeId:'total',dimensions:['Nature']}).total,debit);
 const transport=visual.select(m,visible,{kind:'pie',category:'Nature',label:'essence'});
 assert.deepEqual(transport,{ids:['manual-real'],count:1,total:30});
 const planned=visual.select(m,visible,{kind:'pie',category:'Nature',label:'peage'});
 assert.deepEqual(planned,{ids:['manual-planned'],count:1,total:50});
 const forecast=visual.select(m,visible,{kind:'pie',category:'Nature',label:'telecom'});
 assert.equal(forecast.count,2);assert.equal(forecast.total,50);
 assert.ok(forecast.ids.some(id=>id.startsWith('rec:')));
});
test('la date de fin limite les opérations manuelles et récurrentes sans modifier la consultation',()=>{
 const m=fixture();
 const narrow=visual.analysisRows(m,{at,until:'2026-11-10'});
 assert.ok(narrow.rows.some(r=>r.id==='manual-planned'));
 assert.ok(!narrow.rows.some(r=>r.id==='manual-future'));
 assert.equal(narrow.forecastCount,0);
 const wide=visual.analysisRows(m,{at,until:'2026-12-31',account:'Qonto'});
 assert.equal(wide.rows.length,1);assert.equal(wide.rows[0].id,'other-bank');
 const byTag=visual.analysisRows(m,{at,until,filter:{tags:['peage']}});
 assert.deepEqual(byTag.rows.map(r=>r.id),['manual-planned']);
});
test('lien graphique → tableau : les FORECAST peuvent être retrouvées même lorsque leur affichage normal est décoché',()=>{
 const ui=fs.readFileSync(require('node:path').join(__dirname,'../src/ui.js'),'utf8');
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 assert.match(ui,/\('showForecastRows'\)\.checked\|\|chartSelection/);
 assert.match(ui,/if\(chartSelection\)rows=rows\.filter\(r=>chartSelection\.ids\.has\(r\.id\)\)/);
 assert.match(ui,/QBudgetVisualSelect\.analysisRows/);
 assert.match(html,/id="analysisScopeInfo"/);
});
