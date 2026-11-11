'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../src/engine.js');
const annotations=require('../src/annotations.js');
const tags=require('../src/tags.js');
const csv=fs.readFileSync('tests/fixtures/life_2026_operations.csv','utf8');
function previousExport(){return JSON.parse(JSON.stringify(engine.mergeAnnotations(engine.readCsv(csv),JSON.parse(fs.readFileSync('tests/fixtures/life_2026_annotations.json','utf8')))))}
test('ancien export CLI rows : manuelles et flottantes restaurées dans le CLI et le navigateur',()=>{
 const old=previousExport(),snapshot=JSON.stringify(old),cli=engine.mergeAnnotations(engine.readCsv(csv),old);
 const browser=annotations.importInto({rows:engine.readCsv(csv),notes:{},references:{}},old,tags);
 for(const restored of [cli,browser]){
  assert.equal(restored.rows.length,99);assert.equal(restored.rows.filter(r=>r.manual).length,7);assert.equal(restored.rows.filter(r=>r.manual&&engine.isFloating(r)).length,4);
  assert.deepEqual(restored.rows.filter(r=>r.manual),old.rows.filter(r=>r.manual));assert.deepEqual(restored.notes,old.notes);
 }
 assert.equal(JSON.stringify(old),snapshot);
 const canonical=annotations.exportObject(browser);assert.equal(canonical.manualRows.length,7);assert.ok(!Object.hasOwn(canonical,'rows'));
});
test('manualRows explicite reste prioritaire sur un ancien champ rows',()=>{
 const old={...previousExport(),manualRows:[]};
 assert.equal(engine.mergeAnnotations(engine.readCsv(csv),old).rows.filter(r=>r.manual).length,0);
 const restored=annotations.importInto({rows:engine.readCsv(csv),notes:{},references:{}},old,tags);
 assert.equal(restored.rows.filter(r=>r.manual).length,0);
});
test('migration ancien export CLI ne remplace jamais les lignes CSV par celles du JSON',()=>{
 const old=previousExport(),changed='Date;Banque;Compte;Libellé;Montant\n2026-11-01;Nouveau;Courant;Nouvel import;-12';
 const loaded=engine.mergeAnnotations(engine.readCsv(changed),old);
 assert.equal(loaded.rows.filter(r=>!r.manual).length,1);assert.equal(loaded.rows.find(r=>!r.manual).desc,'Nouvel import');assert.equal(loaded.rows.filter(r=>r.manual).length,7);
});
