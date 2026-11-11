'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/engine.js');
const tags=require('../src/tags.js');
const annotations=require('../src/annotations.js');
function model(){return {
 rows:[{id:'a',bank:'BPS',date:'2026-11-01',desc:'Test A',amount:-10},
  {id:'b',bank:'BPS',date:'2026-11-02',desc:'Test B',amount:-20},
  {id:'m',bank:'BPS',date:null,manual:true,desc:'Flottante',amount:-8,nature:'planned'},
  {id:'forecast',bank:'BPS',date:'2026-12-01',desc:'Test calculé',amount:-10,forecast:true}],
 notes:{a:{tags:['personnel'],tag:'historique, IK',ruleId:'r',type:'recurrent',extra:{x:1}},b:{tags:['sasu','IK','mission'],tag:'sasu'}},
 references:{BPS:{date:'2026-11-03',balance:1000}},rules:{},recurrenceBacklog:[]
}}
test('plusieurs tags : virgules, espaces, éléments vides et doublons insensibles à la casse',()=>{
 assert.deepEqual(tags.parseTagList(' SASU, IK, mission, sasu, , ik, '),['SASU','IK','mission']);
 for(const value of ['',null,' , , '])assert.throws(()=>tags.parseTagList(value),/au moins un tag/i);
});
test('plusieurs tags : ajout unique par opération, champs historiques et autres annotations conservés',()=>{
 const m=model(),unchangedB=m.notes.b;
 const result=tags.addTags(m,['a','b','a','m','forecast','inconnu'],' SASU, IK, mission, sasu, ');
 assert.deepEqual(result,{selected:3,changed:2,alreadyPresent:1});
 assert.deepEqual(engine.manualTagsFor(m,m.rows[0]),['personnel','historique','IK','SASU','mission']);
 assert.deepEqual(engine.manualTagsFor(m,m.rows[2]),['SASU','IK','mission']);
 assert.strictEqual(m.notes.b,unchangedB);assert.equal(m.notes.a.tag,'personnel');
 assert.equal(m.notes.a.ruleId,'r');assert.equal(m.notes.a.type,'recurrent');assert.deepEqual(m.notes.a.extra,{x:1});
 assert.ok(!Object.hasOwn(m.notes,'forecast'));assert.ok(!Object.hasOwn(m.notes,'inconnu'));assert.equal(m.rows[2].date,null);
 const snapshot=JSON.stringify(m),notes=m.notes;
 assert.deepEqual(tags.addTags(m,['a','b','m'],'SASU, ik, MISSION'),{selected:3,changed:0,alreadyPresent:3});
 assert.equal(JSON.stringify(m),snapshot);assert.strictEqual(m.notes,notes);
});
test('plusieurs tags : erreurs sans ajout partiel et API historique à un tag compatible',()=>{
 const m=model(),before=JSON.stringify(m);
 assert.throws(()=>tags.addTags(m,['a'],' , , '));assert.throws(()=>tags.addTags(m,'a','SASU, IK'));
 assert.equal(JSON.stringify(m),before);
 assert.throws(()=>tags.addTag(m,['a'],'SASU, IK'),/sans virgule/);
 assert.equal(tags.addTag(m,['a'],'unique').changed,1);
});
test('plusieurs tags : tous les résultats filtrés au-delà de la pagination, aucun montant ni règle modifiés',()=>{
 const m=model();m.rows=m.rows.filter(r=>!r.forecast);
 for(let i=0;i<220;i++)m.rows.push({id:'row'+i,bank:'BPS',date:'2026-11-01',desc:i<200?'FRAIS '+i:'Autre',amount:-10});
 const before={rows:JSON.stringify(m.rows),rules:JSON.stringify(m.rules),forecast:engine.forecast(m,'2026-11-03','2026-12-31'),audit:engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-03',until:'2026-12-31'}))};
 const matching=m.rows.filter(r=>engine.operationMatchesFilter(m,r,{search:'^FRAIS ',searchMode:'regex'}));
 assert.equal(tags.addTags(m,matching.map(r=>r.id),'SASU, IK, mission').changed,200);
 for(const row of matching)assert.deepEqual(engine.manualTagsFor(m,row),['SASU','IK','mission']);
 for(const row of m.rows.filter(r=>r.desc==='Autre'))assert.deepEqual(engine.manualTagsFor(m,row),[]);
 assert.equal(JSON.stringify(m.rows),before.rows);assert.equal(JSON.stringify(m.rules),before.rules);
 assert.deepEqual(engine.forecast(m,'2026-11-03','2026-12-31'),before.forecast);
 assert.equal(engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-03',until:'2026-12-31'})),before.audit);
});
test('plusieurs tags : sauvegarde/restauration JSON, puis retrait d’un tag sans affecter les autres',()=>{
 const m=engine.mergeAnnotations(engine.readCsv('Date;Banque;Compte;Libellé;Montant\n2026-11-01;BPS;Courant;Test;-10'),{});
 const row=m.rows[0];tags.addTags(m,[row.id],'SASU, IK, mission');
 const restored=annotations.importInto(m,annotations.exportObject(m),tags);
 assert.deepEqual(engine.manualTagsFor(restored,restored.rows[0]),['SASU','IK','mission']);
 tags.removeTag(restored,[row.id],'ik');assert.deepEqual(engine.manualTagsFor(restored,restored.rows[0]),['SASU','mission']);
});
