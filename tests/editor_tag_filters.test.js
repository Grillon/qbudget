'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/engine.js');
const editor=require('../src/editor.js');
const tags=require('../src/tags.js');
const annotations=require('../src/annotations.js');
function model(){return {
 rows:[...Array.from({length:5},(_,i)=>({id:'c'+i,bank:'BPS',sourceAccount:'Courant',desc:i===3?'  carrefour   ':'CARREFOUR',date:'2026-11-0'+(i+1),amount:-10})),
  {id:'autre',bank:'BPS',sourceAccount:'Courant',desc:'LIBELLÉ UNIQUE',date:'2026-11-06',amount:-20},
  {id:'auto',bank:'BPS',desc:'NETFLIX',date:'2026-11-06',amount:-15},
  {id:'flottante',manual:true,nature:'planned',bank:'BPS',desc:'En attente',date:null,amount:-8},
  {id:'forecast',forecast:true,bank:'BPS',sourceAccount:'Courant',desc:'CARREFOUR',date:'2026-12-01',amount:-10}],
 notes:{c0:{tags:['courses']},c1:{tag:'courses'},c2:{tags:['courses']},orpheline:{tags:['courses']}},
 references:{BPS:{date:'2026-11-07',balance:1000}},rules:{},labelAssociations:[{tag:'Netflix',patterns:['NETFLIX']}]
}}
const ids=(m,options)=>{const review=editor.tagReview(m);return m.rows.filter(r=>editor.matchesTagReview(r,review,options)).map(r=>r.id)};
test('filtres de tags : trois Carrefour tagués et deux sans tag, groupe complet et intersection',()=>{
 const m=model();
 assert.deepEqual(ids(m,{withoutTags:true}),['c3','c4','autre','flottante']);
 assert.deepEqual(ids(m,{partialTags:true}),['c0','c1','c2','c3','c4']);
 assert.deepEqual(ids(m,{withoutTags:true,partialTags:true}),['c3','c4']);
});
test('filtres de tags : normalisation Unicode et espaces, sans rapprochement approximatif ni mélange de comptes',()=>{
 const m=model();
 m.rows.push({id:'different',bank:'BPS',sourceAccount:'Courant',desc:'CARREFOUR MARKET',date:'2026-11-07',amount:-10});
 m.rows.push({id:'banque',bank:'Autre',sourceAccount:'Courant',desc:'CARREFOUR',date:'2026-11-07',amount:-10});
 m.rows.push({id:'compte',bank:'BPS',sourceAccount:'Epargne',desc:'CARREFOUR',date:'2026-11-07',amount:-10});
 m.rows.push({id:'e1',bank:'BPS',desc:'CAFÉ',amount:-2,date:'2026-11-01'},{id:'e2',bank:'BPS',desc:'cafe\u0301',amount:-2,date:'2026-11-02'});m.notes.e1={tags:['repas']};
 const partial=ids(m,{partialTags:true});
 assert.ok(!partial.includes('different'));assert.ok(!partial.includes('banque'));assert.ok(!partial.includes('compte'));
 assert.ok(partial.includes('e1'));assert.ok(partial.includes('e2'));
});
test('filtres de tags : tags automatiques et historique tag comptent, périodicité seule ne compte pas',()=>{
 const m=model();m.notes.flottante={type:'recurrent'};m.notes.autre={tags:['  ',''],tag:' , '};
 const untagged=ids(m,{withoutTags:true});
 assert.ok(!untagged.includes('auto'));assert.ok(!untagged.includes('c1'));assert.ok(untagged.includes('flottante'));assert.ok(untagged.includes('autre'));
 m.labelAssociations.push({tag:'courses',patterns:['CARREFOUR']});
 assert.deepEqual(ids(m,{partialTags:true}),[]);
});
test('filtres de tags : comparaison sur tout l’historique, puis cumul avec date, montant et recherche',()=>{
 const m=model(),review=editor.tagReview(m),bounds=editor.parseEditorFilters({from:'2026-11-04',to:'2026-11-05',min:'10',max:'10'});
 const filtered=m.rows.filter(r=>editor.matchesTagReview(r,review,{partialTags:true})&&editor.matchesEditorFilters(r,bounds)&&engine.operationMatchesFilter(m,r,{search:'carrefour'}));
 assert.deepEqual(filtered.map(r=>r.id),['c3','c4']);
 assert.equal(editor.matchesTagReview(null,review,{partialTags:true}),false);
 assert.equal(editor.matchesTagReview(null,review,{}),true);
 assert.ok(!ids(m,{partialTags:true}).includes('forecast'));
});
test('filtres de tags : annotations, opérations, soldes, prévisions et exports inchangés',()=>{
 const m=model();m.rows=m.rows.filter(r=>!r.forecast);
 const before=JSON.stringify(m),saved=annotations.exportJson(m),forecast=engine.forecast(m,'2026-11-07','2026-12-31'),audit=engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-07',until:'2026-12-31'}));
 ids(m,{withoutTags:true});ids(m,{partialTags:true});
 assert.equal(JSON.stringify(m),before);assert.equal(annotations.exportJson(m),saved);
 assert.deepEqual(engine.forecast(m,'2026-11-07','2026-12-31'),forecast);assert.equal(engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-07',until:'2026-12-31'})),audit);
});
test('filtres de tags : tous les résultats au-delà de 120, puis actualisation après ajout et retrait',()=>{
 const m={rows:[],notes:{},references:{},rules:{}};
 for(let i=0;i<205;i++)m.rows.push({id:'r'+i,bank:'BPS',desc:'CARREFOUR',date:'2026-11-01',amount:-10});
 m.notes.r0={tags:['courses']};
 assert.equal(ids(m,{partialTags:true}).length,205);
 const missing=ids(m,{withoutTags:true,partialTags:true});assert.equal(missing.length,204);
 assert.equal(tags.addTags(m,missing,'courses, personnel').changed,204);
 assert.deepEqual(ids(m,{partialTags:true}),[]);assert.deepEqual(ids(m,{withoutTags:true}),[]);
 tags.removeTag(m,['r0'],'courses');assert.deepEqual(ids(m,{withoutTags:true,partialTags:true}),['r0']);
});
test('suggestion : tags communs du libellé, contexte différent exclu, pas de choix arbitraire',()=>{
 const m=model();m.notes.c0.tags.push('personnel');m.notes.c1.tag='COURSES, mission';
 let review=editor.tagReview(m);
 assert.deepEqual(editor.tagSuggestions(review,['c3','c4']),['courses']);
 assert.deepEqual(editor.tagSuggestions(review,['c3','autre']),[]);
 assert.deepEqual(editor.tagSuggestions(review,[]),[]);
 m.notes.c2={tags:['travail']};review=editor.tagReview(m);
 assert.deepEqual(editor.tagSuggestions(review,['c3','c4']),[]);
 assert.deepEqual(m.notes.c0.tags,['courses','personnel']);
});
test('suggestion : intersection entre plusieurs libellés et absence de changement des notes',()=>{
 const m=model();m.rows.push({id:'a1',bank:'BPS',desc:'AUCHAN',date:'2026-11-01',amount:-10},{id:'a2',bank:'BPS',desc:'AUCHAN',date:'2026-11-02',amount:-10});
 m.notes.a1={tags:['Courses','personnel']};const before=JSON.stringify(m);
 const review=editor.tagReview(m);
 assert.deepEqual(editor.tagSuggestions(review,['c3','a2']),['courses']);
 assert.equal(JSON.stringify(m),before);
});
