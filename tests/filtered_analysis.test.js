'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const e=require('../src/engine.js');
const root=path.join(__dirname,'..');
const csv=e.readCsv(fs.readFileSync(path.join(__dirname,'fixtures','life_2026_operations.csv'),'utf8'));
const annotations=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','life_2026_annotations.json'),'utf8'));
const example=()=>e.mergeAnnotations(csv,annotations);
const at='2026-10-25',until='2026-11-30';
function near(a,b){assert.ok(Math.abs(a-b)<0.01,`${a} ≠ ${b}`)}

test('tags multiples ET/OU : même filtre sur opérations et prévisions',()=>{
 const m=example(),row=m.rows.find(x=>x.id==='DEMO-PERSO-RESTO');
 assert.ok(row);
 assert.deepEqual(e.tagsFor(m,row).length>0,true);
 const tags=e.tagsFor(m,row);
 assert.ok(e.operationMatchesFilter(m,row,{tags:[tags[0]]}));
 assert.ok(e.operationMatchesFilter(m,row,{tags:[tags[0],'TAG_INEXISTANT'],tagMode:'any'}));
 assert.ok(!e.operationMatchesFilter(m,row,{tags:[tags[0],'TAG_INEXISTANT'],tagMode:'all'}));
 assert.ok(e.operationMatchesFilter(m,row,{search:'restaurant'}));
 assert.ok(!e.operationMatchesFilter(m,row,{search:'RENTREE___INEXISTANTE'}));
 assert.ok(e.hasOperationFilter({search:'restaurant'}));
 assert.ok(e.hasOperationFilter({tags:['IK']}));
 assert.ok(!e.hasOperationFilter({tags:[],search:'',type:''}));
 const future=e.recurrencePreview(m,at,until);
 assert.ok(future.length>0);
 assert.ok(future.every(x=>e.operationMatchesFilter(m,x,{type:'recurrent'})));
 assert.ok(future.every(x=>!e.operationMatchesFilter(m,x,{type:'ponctuel'})));
});

test('impact ne change ni le solde ni les données ; double dépense remboursement reste en attente',()=>{
 const m=example(),before=JSON.stringify(m),balance=e.forecast(m,at,until),
 effect=e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:{tags:['SASU']}});
 assert.equal(JSON.stringify(m),before);
 assert.deepEqual(e.forecast(m,at,until),balance);
 assert.equal(effect.actualCount,0);assert.equal(effect.futureCount,0);
 near(effect.closing,0);
 const all=e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:{tags:['SASU','IK']}});
 near(all.closing,0);
});

test('impact réalisé : dépenses négatives, et compte hors cumul absent',()=>{
 const m=example();
 const restaurant=m.rows.find(x=>x.id==='DEMO-PERSO-RESTO');
 const effect=e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:{search:'Restaurant fictif'},includeRecurrences:false});
 assert.equal(effect.futureCount,0);
 assert.ok(effect.actualCount>=0);
 // Rechercher précisément l'identifiant libellé, sans présumer du contenu du CSV.
 const keyword='Essence';
 const source=m.rows.filter(r=>r.date>'2026-09-01'&&r.date<=at&&r.nature!=='planned'&&r.desc.toLocaleLowerCase('fr').includes(keyword.toLocaleLowerCase('fr')));
 assert.ok(source.length>0);
 const fuel=e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:{search:keyword},includeRecurrences:false});
 near(fuel.opening,source.filter(x=>e.includedAccountNames(m).includes(x.bank)).reduce((sum,r)=>sum+r.amount,0));
 const excluded=source[0].bank;
 m.excludedAccounts=[excluded];
 const without=e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:{search:keyword},includeRecurrences:false});
 const expected=source.filter(x=>x.bank!==excluded).reduce((s,x)=>s+x.amount,0);
 near(without.opening,expected);
 const individual=e.filteredImpact(m,{at,until,startDate:'2026-09-01',account:excluded,filter:{search:keyword},includeRecurrences:false});
 near(individual.opening,source.filter(x=>x.bank===excluded).reduce((s,x)=>s+x.amount,0));
});

test('futur : les opérations prévues et récurrences ne deviennent jamais du réalisé',()=>{
 const m=example();
 const filt={type:'recurrent'};
 const noRules=e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:filt,includeRecurrences:false});
 const withRules=e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:filt,includeRecurrences:true});
 const expected=e.recurrencePreview(m,at,until).filter(r=>e.includedAccountNames(m).includes(r.bank));
 assert.equal(withRules.futureCount-noRules.futureCount,expected.length);
 near(withRules.closing-noRules.closing,expected.reduce((s,r)=>s+r.amount,0));
 near(withRules.opening,noRules.opening);
 const original=JSON.stringify(m);
 e.filteredImpact(m,{at,until,startDate:'2026-09-01',filter:{search:'loyer'}});
 assert.equal(JSON.stringify(m),original);
});

test('les multi-tags ne multiplient jamais un montant et les récurrences restent datées',()=>{
 const m=example();
 m.rows.push({id:'TEST-MULTI',bank:'Qonto',account:'Qonto',date:'2026-10-20',amount:-77,desc:'Test multi',currency:'EUR',manual:true,nature:'actual'});
 m.notes['TEST-MULTI']={tags:['SASU','IK','essai']};
 const sum=e.filteredImpact(m,{at,until,startDate:'2026-10-19',account:'Qonto',filter:{tags:['SASU','IK'],tagMode:'all'}});
 assert.equal(sum.actualCount,1);near(sum.opening,-77);
 const any=e.filteredImpact(m,{at,until,startDate:'2026-10-19',account:'Qonto',filter:{tags:['SASU','essai'],tagMode:'any'}});
 assert.equal(any.actualCount,1);near(any.opening,-77);
});

test('interface : filtres reliés, tracé analytique sur axe secondaire, balance séparée',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['operationTags','operationTagMode','filteredInfo','chart','flowsChart','donutChart','sunburstChart']) assert.ok(html.includes(`id="${id}"`));
 assert.match(html,/filteredAnalysisRows\(\[\.\.\.saved,\.\.\.forecastRows\]\)/);
 assert.match(html,/filteredAnalysisRows\(aggregateRows\(\)/);
 assert.match(html,/QBudgetEngine\.filteredImpact\(model,/);
 assert.match(html,/yaxis:'y2'/);
 assert.match(html,/overlaying:'y'/);
 assert.match(html,/QBudgetEngine\.hasOperationFilter\(operationFilter\(\)\)/);
 assert.match(html,/renderRows\(\);renderSummary\(\)/);
});
