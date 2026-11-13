'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const e=require('../src/engine.js'),archives=require('../src/recurrences.js'),annotations=require('../src/annotations.js'),tags=require('../src/tags.js');
const fixture=require('./fixtures/recurrences_retired.json');
function load(){return e.mergeAnnotations(e.readCsv(fixture.csv),structuredClone(fixture.annotations));}
test('la détection est retirée ; les anciennes propositions restent des archives indépendantes et exportables',()=>{
 assert.deepEqual(Object.keys(archives).sort(),['validate','version']);
 const original=structuredClone(fixture.annotations),copy=archives.validate(original.recurrenceBacklog);
 assert.deepEqual(copy,original.recurrenceBacklog);copy[0].desc='modifié';assert.notEqual(original.recurrenceBacklog[0].desc,'modifié');
 const model=load(),before=JSON.stringify(model),restored=annotations.importInto(model,original,tags),exported=annotations.exportObject(restored);
 assert.equal(JSON.stringify(model),before);assert.deepEqual(exported.recurrenceBacklog,original.recurrenceBacklog);
 assert.deepEqual(exported.notes,original.notes);assert.deepEqual(exported.rules,original.rules);
 assert.ok(exported.recurrenceBacklog.some(c=>c.classificationOnly&&c.evidence.length===1));
 assert.ok(exported.recurrenceBacklog.some(c=>c.status==='pending'&&c.evidence.length===2));
 assert.ok(exported.recurrenceBacklog.some(c=>c.frequency==='semestriel'&&c.ruleId));
});
test('les règles déjà validées, dont semestriel, gardent exactement leurs prévisions et leur audit',()=>{
 const model=load();
 assert.deepEqual(e.forecast(model,'2026-11-01','2027-12-31'),fixture.forecast);
 assert.equal(e.auditCsv(e.auditOperations(model,{scope:'all',at:'2026-11-01',until:'2027-12-31'})),fixture.audit);
 const restored=annotations.importInto(model,annotations.exportObject(model),tags);
 assert.deepEqual(e.forecast(restored,'2026-11-01','2027-12-31'),fixture.forecast);
 assert.equal(e.shiftDate('2026-08-31','semestriel',1),'2027-02-28');
 assert.deepEqual(e.tagsByCategory(restored,restored.rows.find(row=>restored.notes[row.id]?.recurrenceFrequency==='mensuel'),restored.tagCategories.find(c=>c.source==='type')),['Récurrent']);
});
test('compatibilité des anciennes sauvegardes et archives invalides refusées sans altération',()=>{
 const model=load(),old=annotations.exportObject(model);delete old.recurrenceBacklog;
 assert.deepEqual(annotations.importInto(model,old,tags).recurrenceBacklog,[]);
 const record=fixture.annotations.recurrenceBacklog[0],evidence=record.evidence[0];
 const legacy={...record,id:'ancienne-proposition',frequency:'mensuel',status:'pending',evidence:[0,1,2].map(i=>({...evidence,id:'ancien-'+i,date:`2026-${String(8+i).padStart(2,'0')}-05`}))};delete legacy.classificationOnly;delete legacy.ruleId;
 assert.deepEqual(archives.validate([legacy]),[legacy]);
 const invalid=annotations.exportObject(model);invalid.recurrenceBacklog=[{id:'incomplet'}];const before=JSON.stringify(model);
 assert.throws(()=>annotations.importInto(model,invalid,tags),/récurrence|Proposition/);assert.equal(JSON.stringify(model),before);
});
test('mêmes archives importées dans un navigateur, sans fonction de rapprochement active',()=>{
 const sandbox={TextEncoder};vm.createContext(sandbox);
 for(const file of ['normalize','identity','engine','recurrences','transfers','tags','annotations'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),sandbox);
 assert.deepEqual(JSON.parse(JSON.stringify(sandbox.QBudgetRecurrences.validate(fixture.annotations.recurrenceBacklog))),fixture.annotations.recurrenceBacklog);
 const imported=sandbox.QBudgetAnnotations.importInto({rows:sandbox.QBudgetEngine.readCsv(fixture.csv),notes:{},references:{}},structuredClone(fixture.annotations),sandbox.QBudgetTags);
 assert.deepEqual(JSON.parse(JSON.stringify(imported.notes)),fixture.annotations.notes);
 for(const method of ['detect','scan','classify','accept','ignore','reopen'])assert.equal(sandbox.QBudgetRecurrences[method],undefined);
});
