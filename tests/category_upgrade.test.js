'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const tags=require('../src/tags.js'),e=require('../src/engine.js'),annotations=require('../src/annotations.js'),visual=require('../src/visual-select.js');
const root=path.resolve(__dirname,'..');
const legacy=()=>structuredClone(require('./fixtures/categories_legacy.json').categories);
function make(){
 const m=e.mergeAnnotations(e.readCsv(fs.readFileSync(path.join(__dirname,'fixtures/life_2026_operations.csv'),'utf8')),JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/life_2026_annotations.json'),'utf8')));
 m.tagCategories=[...legacy(),{name:'Ancienne catégorie',tags:['tag_libre'],source:'tags'}];m.tagDefaultsVersion=2;m.hierarchyDimensions=['Nature','Traitement','Ancienne catégorie'];m.donutCategory='Nature';
 const row=m.rows.find(r=>!r.manual);m.notes[row.id]={...m.notes[row.id],tags:[...(m.notes[row.id]?.tags||[]),'tag_libre'],commentaire:{valeur:'ne pas effacer'}};
 m.notes.absente={tags:['un_autre_tag'],description:'annotation orpheline'};
 return m;
}
test('catalogue version 1 identique aux exemples et sans collisions, y compris sans moteur',()=>{
 const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/tags.js'),'utf8'),sandbox);
 for(const file of ['categories-par-defaut.json','categories-exploration.json']){
  const input=fs.readFileSync(path.join(root,'examples',file),'utf8');
  assert.deepEqual(tags.parseJson(input),tags.defaults());
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.QBudgetTags.parseJson(input))),tags.defaults());
 }
 const categories=tags.defaults(),all=categories.flatMap(c=>c.tags.map(t=>t.toLocaleLowerCase('fr')));
 assert.equal(new Set(all).size,all.length);
 assert.equal(categories.find(c=>c.tags.includes('loisirs')).name,'Poste');
 assert.equal(categories.find(c=>c.tags.includes('quotidien')).name,'Contexte');
 assert.equal(categories.find(c=>c.tags.includes('remboursement')).name,'Traitement / État');
 assert.ok(!categories.some(c=>c.name==='Flux'||c.name==='Compte'));
 assert.deepEqual(categories.find(c=>c.name==='Périodicité'),{name:'Périodicité',tags:['Récurrent','Ponctuel'],source:'type'});
 assert.deepEqual(visual.perspectives({tagCategories:categories}).map(p=>p.id),['activities','contexts','projects','purpose']);
});
test('remplacement du dictionnaire sans mutation des tags, liens, annotations ou calculs',()=>{
 const m=make(),before=JSON.stringify(m),at='2026-10-25',until='2026-11-30';
 const forecast=e.forecast(m,at,until),audit=e.auditCsv(e.auditOperations(m,{scope:'all',at,until}));
 const next=tags.upgradeCategories(m);
 assert.equal(JSON.stringify(m),before);
 assert.deepEqual(next.tagCategories,tags.defaults());
 for(const field of ['rows','notes','rules','references','labelAssociations','bankIdentities'])assert.strictEqual(next[field],m[field]);
 assert.deepEqual(next.hierarchyDimensions,['Poste','Traitement / État']);assert.equal(next.donutCategory,'Poste');
 assert.ok(next.rows.some(r=>e.organizedTags(next,r).other.includes('tag_libre')));
 assert.deepEqual(e.forecast(next,at,until),forecast);
 assert.equal(e.auditCsv(e.auditOperations(next,{scope:'all',at,until})),audit);
 const rows=next.rows.filter(r=>r.date),tree=e.expenseBreakdown(next,rows,['Entité','Projet','Poste']);
 assert.equal(tree.values[0],e.expenseBreakdown(m,rows,['Nature']).values[0]);
 assert.strictEqual(tags.upgradeCategories(next),next);
});
test('anciens imports remplacés ; nouvelles catégories et tags libres exportables sans perte',()=>{
 for(const marker of [undefined,1,2]){
  const m=make();m.tagDefaultsVersion=marker;
  const restored=annotations.importInto(m,annotations.exportObject(m),tags);
  assert.deepEqual(restored.tagCategories,tags.defaults());assert.deepEqual(restored.notes,tags.normalizePersonalTag(m).notes);
  assert.deepEqual(restored.hierarchyDimensions,['Poste','Traitement / État']);
 }
 const m=tags.upgradeCategories(make());
 m.tagCategories.push({name:'Mes frais spécifiques',tags:['tag_libre'],source:'tags'});
 const restored=annotations.importInto(m,annotations.exportObject(m),tags);
 assert.deepEqual(restored.tagCategories,m.tagCategories);assert.deepEqual(restored.notes,tags.normalizePersonalTag(m).notes);
 assert.ok(restored.rows.some(r=>e.organizedTags(restored,r).values.some(c=>c.name==='Mes frais spécifiques'&&c.values.includes('tag_libre'))));
 const empty={...m,tagCategories:[],hierarchyDimensions:[]};
 assert.deepEqual(annotations.importInto(empty,annotations.exportObject(empty),tags).tagCategories,[]);
});
