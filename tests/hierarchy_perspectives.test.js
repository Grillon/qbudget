'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const e=require('../src/engine.js'),v=require('../src/visual-select.js'),tags=require('../src/tags.js'),annotations=require('../src/annotations.js');
function make(){return {rows:[{id:'a',bank:'Perso',date:'2026-10-24',amount:-100,desc:'Courses'},{id:'b',bank:'Perso',date:'2026-10-24',amount:-50,desc:'Repas'}],notes:{a:{tags:['Perso','courses','repas','mission'],memo:'conserver'},b:{tags:['SASU','repas','mission']}},rules:{},references:{Perso:{date:'2026-10-25',balance:1000}},accounts:[],excludedAccounts:[],tagCategories:structuredClone(require('./fixtures/categories_legacy.json').categories),tagDefaultsVersion:tags.defaultsVersion,sunburstDepth:2,donutCategory:'Nature'};}
test('anciennes configurations : ordre existant ; sélection vide explicite respectée',()=>{
 const m=make();assert.deepEqual(v.hierarchyDimensions(m),m.tagCategories.map(c=>c.name));
 m.hierarchyDimensions=[];assert.deepEqual(v.hierarchyDimensions(m),[]);
 m.hierarchyDimensions=['Entité','absente','Nature','Entité'];assert.deepEqual(v.hierarchyDimensions(m),['Entité','Nature']);
});
test('perspectives disponibles : Nature historique, Poste prioritaire, aucun axe calculé simulé',()=>{
 const m=make();assert.deepEqual(v.perspectives(m).map(p=>p.id),['activities','contexts']);
 assert.deepEqual(v.perspectives(m)[0].dimensions,['Entité','Nature']);
 m.tagCategories.push({name:'Poste',tags:[],source:'tags'},{name:'Projet',tags:['qbudget'],source:'tags'},{name:'Finalité',tags:['épargne'],source:'tags'});
 assert.deepEqual(v.perspectives(m).map(p=>p.id),['activities','contexts','projects','purpose']);
 assert.deepEqual(v.perspectives(m)[2].dimensions,['Entité','Projet','Poste']);
 m.tagCategories=[];assert.deepEqual(v.perspectives(m),[]);assert.equal(v.applyPerspective(m,'projects'),m);
});
test('perspective puis exploration : annotations, totaux, forecast et clics cohérents',()=>{
 const m=make(),before=JSON.stringify(m),forecast=e.forecast(m,'2026-10-25','2026-11-30');
 const next=v.applyPerspective(m,'activities');
 assert.equal(JSON.stringify(m),before);assert.equal(next.tagCategories,m.tagCategories);assert.equal(next.notes,m.notes);
 assert.equal(next.donutCategory,m.donutCategory);assert.equal(next.sunburstDepth,2);
 assert.deepEqual(e.forecast(next,'2026-10-25','2026-11-30'),forecast);
 for(const dimensions of [next.hierarchyDimensions,[...next.hierarchyDimensions].reverse(),['Nature']]){
  const tree=e.expenseBreakdown(next,next.rows,dimensions);
  assert.equal(tree.values[0],150);
  assert.equal(v.select(next,next.rows,{kind:'hierarchy',dimensions,nodeId:'total'}).total,150);
  const index=tree.parents.findIndex(p=>p==='total');
  const selection=v.select(next,next.rows,{kind:'hierarchy',dimensions,nodeId:tree.ids[index]});
  assert.equal(selection.total,tree.values[index]);
 }
});
test('export/import des dimensions, dont une seule et aucune ; ancien fichier sans préférence',()=>{
 for(const dimensions of [['Entité','Nature'],['Nature'],[]]){
  const m=make();m.hierarchyDimensions=dimensions;m.sunburstDepth=1;
  const exported=annotations.exportObject(m),restored=annotations.importInto(make(),exported,tags);
  assert.deepEqual(v.hierarchyDimensions(restored),dimensions);assert.equal(restored.sunburstDepth,1);
  for(const row of restored.rows)assert.deepEqual(restored.notes[row.id],m.notes[m.rows.find(r=>r.desc===row.desc).id]);
  exported.hierarchyDimensions.push('Contexte');assert.deepEqual(m.hierarchyDimensions,dimensions);
 }
 const old=annotations.exportObject(make()),current=make();current.hierarchyDimensions=['Entité'];
 const restored=annotations.importInto(current,old,tags);
 assert.deepEqual(v.hierarchyDimensions(restored),old.tagCategories.map(c=>c.name));
 assert.throws(()=>annotations.importInto(make(),{...old,hierarchyDimensions:'Entité'},tags),/Dimensions/);
});
