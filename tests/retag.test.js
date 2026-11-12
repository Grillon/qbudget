'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const e=require('../src/engine.js'),tags=require('../src/tags.js'),annotations=require('../src/annotations.js');
function make(){return {rows:[{id:'a',bank:'Perso',date:'2026-10-24',amount:-100,desc:'Courses'},{id:'b',bank:'Perso',date:'2026-10-24',amount:-20,desc:'Repas'}],notes:{a:{tags:['perso','courses','repas','tag_libre'],tag:'autre_libre',type:'ponctuel',ruleId:'r',memo:{texte:'conserver'}},b:{tags:['restaurant']}},tagCategories:tags.defaults(),tagDefaultsVersion:tags.defaultsVersion,labelAssociations:[],rules:{r:{id:'r',account:'Perso',desc:'Courses',amount:-100,frequency:'mensuel',anchor:'2026-10-24'}},references:{Perso:{date:'2026-10-25',balance:1000}},accounts:[],excludedAccounts:[]};}
test('un choix remplace tous les tags de sa catégorie, conserve les tags libres et autres annotations',()=>{
 const m=make(),other=structuredClone(m.notes.b),rows=JSON.stringify(m.rows),rules=JSON.stringify(m.rules);
 assert.equal(tags.retagOperation(m,'a',{'Poste':'restaurant','Projet':'qbudget'}).changed,true);
 assert.deepEqual(m.notes.a.tags,['perso','tag_libre','autre_libre','restaurant','qbudget']);
 assert.equal(m.notes.a.tag,'perso');assert.deepEqual(m.notes.a.memo,{texte:'conserver'});
 assert.equal(m.notes.a.ruleId,'r');assert.equal(m.notes.a.type,'ponctuel');
 assert.deepEqual(m.notes.b,other);assert.equal(JSON.stringify(m.rows),rows);assert.equal(JSON.stringify(m.rules),rules);
});
test('catégories non touchées et choix sans changement ne réécrivent aucune note',()=>{
 const m=make(),before=JSON.stringify(m),notes=m.notes;
 assert.equal(tags.retagOperation(m,'a',{}).changed,false);
 assert.equal(tags.retagOperation(m,'a',{'Entité':'Perso'}).changed,false);
 assert.equal(JSON.stringify(m),before);assert.strictEqual(m.notes,notes);
});
test('sans tag retire uniquement la catégorie demandée, jamais les tags libres',()=>{
 const m=make();tags.retagOperation(m,'a',{'Poste':''});
 assert.ok(!m.notes.a.tags.includes('courses'));assert.ok(!m.notes.a.tags.includes('repas'));
 assert.ok(m.notes.a.tags.includes('tag_libre'));assert.ok(m.notes.a.tags.includes('autre_libre'));
});
test('catégories personnalisées prises en charge et erreurs atomiques',()=>{
 const m=make();m.tagCategories.push({name:'Ma catégorie',tags:['tag_libre','mon_choix'],source:'tags'});
 tags.retagOperation(m,'a',{'Ma catégorie':'mon_choix'});assert.ok(m.notes.a.tags.includes('mon_choix'));
 const before=JSON.stringify(m);
 for(const choices of [{'Poste':'restaurant','absente':'tag'},{'Poste':'tag_inconnu'},{'Périodicité':'Ponctuel'},[]])assert.throws(()=>tags.retagOperation(m,'a',choices));
 assert.equal(JSON.stringify(m),before);
 assert.throws(()=>tags.retagOperation(m,'absente',{}),/introuvable/);
 m.rows.push({id:'f',forecast:true});assert.throws(()=>tags.retagOperation(m,'f',{'Poste':'repas'}),/introuvable/);
});
test('associations explicites : impossible de masquer un tag automatique avec un autre choix',()=>{
 const m=make();m.labelAssociations=[{tag:'courses',patterns:['Courses']}];const before=JSON.stringify(m);
 for(const selected of ['restaurant',''])assert.throws(()=>tags.retagOperation(m,'a',{'Entité':'SASU','Poste':selected}),/association/);
 assert.equal(JSON.stringify(m),before);
 tags.retagOperation(m,'a',{'Poste':'courses'});
 assert.deepEqual(e.tagsByCategory(m,m.rows[0],m.tagCategories.find(c=>c.name==='Poste')),['courses']);
 assert.ok(!e.manualTagsFor(m,m.rows[0]).includes('courses'));assert.ok(m.notes.a.tags.includes('tag_libre'));
 m.labelAssociations.push({tag:'repas',patterns:['Courses']});
 assert.throws(()=>tags.retagOperation(m,'a',{'Poste':'courses'}),/association/);
});
test('retagage conservé à l’export/import, sans effet sur soldes, forecast, audit ou total des dépenses',()=>{
 const m=make(),at='2026-10-25',until='2026-12-31';
 const forecast=e.forecast(m,at,until),audit=e.auditCsv(e.auditOperations(m,{scope:'all',at,until}));
 tags.retagOperation(m,'a',{'Poste':'restaurant','Entité':'SASU'});
 assert.deepEqual(e.forecast(m,at,until),forecast);assert.equal(e.auditCsv(e.auditOperations(m,{scope:'all',at,until})),audit);
 assert.equal(e.expenseBreakdown(m,m.rows,['Entité','Poste']).values[0],120);
 const restored=annotations.importInto(m,annotations.exportObject(m),tags);
 for(const row of restored.rows)assert.deepEqual(e.manualTagsFor(restored,row),e.manualTagsFor(m,m.rows.find(r=>r.desc===row.desc)));
});
