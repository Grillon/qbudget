'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const e=require('../src/engine.js'),tags=require('../src/tags.js'),annotations=require('../src/annotations.js');
function make(){return {rows:[{id:'a',bank:'Perso',date:'2026-10-24',amount:-100,desc:'Courses'}],notes:{a:{tags:['personnel','Perso','courses','libre'],tag:'personnel, ancien_libre',ruleId:'r',memo:{x:1}},absente:{tag:'PERSONNEL',champLibre:42}},rules:{r:{id:'r',account:'Perso',desc:'Courses',amount:-100,frequency:'mensuel',anchor:'2026-10-24'}},references:{Perso:{date:'2026-10-25',balance:1000}},accounts:[],excludedAccounts:[],tagCategories:[...tags.defaults(),{name:'Mes catégories',tags:['mon_tag'],source:'tags'}],tagDefaultsVersion:tags.defaultsVersion,labelAssociations:[{tag:'personnel',patterns:['Courses','FRAIS']},{tag:'Perso',patterns:['frais','Restaurant']}],hierarchyDimensions:['Entité','Mes catégories']};}
test('fusion personnel → Perso dans toutes les annotations, sans doublons ni perte de champs',()=>{
 const m=make(),before=JSON.stringify(m),next=tags.normalizePersonalTag(m);
 assert.equal(JSON.stringify(m),before);
 assert.deepEqual(next.notes.a.tags,['Perso','courses','libre']);assert.equal(next.notes.a.tag,'Perso, ancien_libre');
 assert.equal(next.notes.absente.tag,'Perso');assert.equal(next.notes.absente.champLibre,42);
 assert.deepEqual(next.notes.a.memo,{x:1});assert.equal(next.notes.a.ruleId,'r');
 assert.strictEqual(next.rows,m.rows);assert.strictEqual(next.rules,m.rules);assert.deepEqual(next.tagCategories,m.tagCategories);
 assert.strictEqual(tags.normalizePersonalTag(next),next);
});
test('associations fusionnées avec tous leurs motifs, catégories personnalisées conservées',()=>{
 const m=make();m.tagCategories[0].tags.push('personnel');
 const next=tags.normalizePersonalTag(m);
 assert.equal(next.tagCategories.some(c=>c.tags.some(t=>t.toLowerCase()==='personnel')),false);
 assert.ok(next.tagCategories.some(c=>c.name==='Mes catégories'&&c.tags.includes('mon_tag')));
 assert.deepEqual(next.labelAssociations,[{tag:'Perso',patterns:['Courses','FRAIS','Restaurant']}]);
 assert.deepEqual(e.validateLabelAssociations(next.labelAssociations),next.labelAssociations);
 assert.deepEqual(e.automaticTagsFor(next,next.rows[0]),['Perso']);
 assert.deepEqual(next.hierarchyDimensions,m.hierarchyDimensions);
 const onlyOld={tagCategories:[{name:'Custom',tags:['personnel','libre'],source:'tags'}]};
 assert.deepEqual(tags.normalizePersonalTag(onlyOld).tagCategories[0].tags,['Perso','libre']);
});
test('import normalisé et calculs financiers inchangés',()=>{
 const original=make(),m=e.reimportBankRows(original,original.rows),at='2026-10-25',until='2026-12-31';
 const forecast=e.forecast(m,at,until),audit=e.auditCsv(e.auditOperations(m,{scope:'all',at,until}));
 const restored=annotations.importInto(m,annotations.exportObject(m),tags);
 assert.deepEqual(restored.notes[restored.rows[0].id],tags.normalizePersonalTag(m).notes[m.rows[0].id]);
 assert.deepEqual(restored.notes.absente,tags.normalizePersonalTag(m).notes.absente);
 assert.deepEqual(restored.labelAssociations,tags.normalizePersonalTag(m).labelAssociations);
 assert.deepEqual(e.forecast(restored,at,until),forecast);assert.equal(e.auditCsv(e.auditOperations(restored,{scope:'all',at,until})),audit);
 assert.deepEqual(annotations.importInto(restored,annotations.exportObject(restored),tags).tagCategories,restored.tagCategories);
});
