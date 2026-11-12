'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const e=require('../src/engine.js');
const t=require('../src/tags.js');
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('src/ui.js','utf8');
const editor=fs.readFileSync('src/editor.js','utf8');
function data(){return {
 rows:[
  {id:'vir1',bank:'BoursoBank',date:'2026-10-01',desc:'VIR SEPA Revolut',currency:'EUR',amount:-1000},
  {id:'vir2',bank:'BPS',date:'2026-10-02',desc:'virement entrant',currency:'EUR',amount:1000},
  {id:'food',bank:'BPS',date:'2026-10-03',desc:'CB Boulangerie',currency:'EUR',amount:-20},
  {id:'fuel',bank:'BPS',date:'2026-10-04',desc:'CB ESSENCE',currency:'EUR',amount:-50},
  {id:'float',bank:'BPS',date:null,desc:'VIR futur flottant',currency:'EUR',amount:-250,manual:true,nature:'planned'}
 ],notes:{food:{tags:['alimentation']},vir2:{tags:['personnel']}},rules:{},accounts:['BoursoBank','BPS'],excludedAccounts:[],references:{BoursoBank:{date:'2026-10-04',balance:900},BPS:{date:'2026-10-04',balance:600}},tagCategories:[]
}}
test('recherche texte conservée et Regex insensible à la casse, sans automatisation implicite',()=>{
 const m=data();
 const regex=e.compileSearch('^vir|virement','regex');
 const filter={search:'^vir|virement',searchMode:'regex',searchRegex:regex};
 assert.equal(m.rows.filter(r=>e.operationMatchesFilter(m,r,filter)).length,3);
 assert.equal(m.rows.filter(r=>e.operationMatchesFilter(m,r,{search:'^vir|virement'})).length,0);
 assert.equal(m.rows.filter(r=>e.operationMatchesFilter(m,r,{search:'BPS'})).length,4);
 assert.equal(JSON.stringify(m.notes),JSON.stringify({food:{tags:['alimentation']},vir2:{tags:['personnel']}}));
});
test('regex invalides sont signalées plutôt que taguer tout',()=>{
 assert.throws(()=>e.compileSearch('(','regex'),/Regex invalide/);
 assert.throws(()=>e.compileSearch('x'.repeat(251),'regex'),/Regex trop longue/);
 assert.equal(e.compileSearch('','regex'),null);
 assert.equal(e.compileSearch('[','text'),null);
 const m=data();
 const filter={search:'[',searchMode:'regex',searchRegex:/(?!)/};
 assert.equal(m.rows.filter(r=>e.operationMatchesFilter(m,r,filter)).length,0);
});
test('regex, tags ET/OU et forecast partagent le même moteur de filtrage',()=>{
 const m=data();
 const filter={search:'(SEPA|entrant)',searchMode:'regex',tags:['personnel'],tagMode:'all'};
 assert.deepEqual(m.rows.filter(r=>e.operationMatchesFilter(m,r,filter)).map(r=>r.id),['vir2']);
 assert.deepEqual(m.rows.filter(r=>e.operationMatchesFilter(m,r,{...filter,tags:['personnel','inconnu'],tagMode:'any'})).map(r=>r.id),['vir2']);
 const predicted={id:'p',desc:'Virement prévu',bank:'BPS',amount:-10,forecast:true,date:'2026-11-01',tags:[]};
 assert.ok(e.operationMatchesFilter(m,predicted,{search:'^virement',searchMode:'regex'}));
 assert.ok(e.hasOperationFilter({search:'^virement'}));
});
test('appliquer un tag après confirmation ne modifie ni les montants, ni les soldes, ni les autres tags',()=>{
 const m=data(),at='2026-10-04',balance=e.totalBalance(m,at),audit=e.auditCsv(e.auditOperations(m,{scope:'actual',at,until:at}));
 const filter={search:'^VIR|virement',searchMode:'regex'};
 const ids=m.rows.filter(r=>!e.isFloating(r)&&e.operationMatchesFilter(m,r,filter)).map(r=>r.id);
 assert.deepEqual(ids,['vir1','vir2']);
 const result=t.addTag(m,ids,'transfert_intercomptes');
 assert.equal(result.changed,2);
 assert.deepEqual(e.tagsFor(m,m.rows[1]),['personnel','transfert_intercomptes']);
 assert.deepEqual(e.tagsFor(m,m.rows[4]),[]);
 const repeat=t.addTag(m,ids,'transfert_intercomptes');
 assert.equal(repeat.changed,0);
 assert.equal(e.totalBalance(m,at),balance);
 assert.equal(e.auditCsv(e.auditOperations(m,{scope:'actual',at,until:at})),audit);
});
test('recherche Regex affecte aussi la courbe d’impact sans changer les soldes bancaires',()=>{
 const m=data(),original=e.forecast(m,'2026-10-04','2026-11-04');
 const result=e.filteredImpact(m,{at:'2026-10-04',until:'2026-11-04',startDate:'2026-09-30',filter:{search:'^VIR|virement',searchMode:'regex'},includeRecurrences:false});
 assert.equal(result.actualCount,2);
 assert.equal(result.opening,0);
 assert.deepEqual(e.forecast(m,'2026-10-04','2026-11-04'),original);
});
test('les deux interfaces offrent aperçu, Regex, action groupée explicite et confirmation',()=>{
 for(const id of ['searchMode','searchError','searchPreview','applyMatchingTag','editorSearchMode','editorSearchError','editorApplyTag','editorBulkStatus'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(ui,/QBudgetEngine\.compileSearch\(search,searchMode\)/);
 assert.match(ui,/matchingSavedRows=rows\.filter\(r=>!r\.forecast\)/);
 assert.match(ui,/if\(!confirm\(`/);
 assert.match(ui,/QBudgetTags\.addTags\(model,matches\.map\(r=>r\.id\),tag\)/);
 assert.match(editor,/root\.QBudgetTags\.addTags\(getModel\(\),ids,tag\)/);
 assert.match(editor,/root\.confirm\(`/);
});
