'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const engine=require('../src/engine.js');
const dir=path.join(__dirname,'fixtures');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const rows=engine.readCsv(read('life_2026_operations.csv'));
const annotations=JSON.parse(read('life_2026_annotations.json'));
const manifest=JSON.parse(read('life_2026_manifest.json'));
const expected=JSON.parse(read('life_2026_expected_forecast.json'));
const model=engine.mergeAnnotations(rows,annotations);
test('55 jours de vie fictive : taille, dates, comptes, valeurs',()=>{
 assert.equal(rows.length,92);
 assert.equal(rows[0].date,'2026-09-01');
 assert.equal(rows.at(-1).date,'2026-10-25');
 assert.deepEqual(Object.fromEntries(['BoursoBank','BPS','Revolut'].map(b=>[b,rows.filter(x=>x.bank===b).length])),manifest.by_bank);
 assert.equal(Math.round(rows.reduce((n,x)=>n+x.amount*100,0)),manifest.sum_cents);
 assert.ok(rows.every(x=>x.date>='2026-09-01'&&x.date<='2026-10-25'));
});
test('aucune écriture supprimée : deux tickets métro identiques sont réels',()=>{
 const same=rows.filter(x=>x.date==='2026-10-01'&&x.desc==='Ticket métro'&&x.amount===-2.5);
 assert.equal(same.length,2);
 assert.notEqual(same[0].id,same[1].id);
});
test('récurrences annotées : 12 règles et liens entre opérations',()=>{
 assert.equal(Object.keys(model.rules).length,12);
 assert.equal(rows.filter(x=>model.notes[x.id]?.ruleId).length,21);
 assert.ok(engine.check(model).ok);
});
test('prévision déterministe, taxe annuelle et copro trimestrielle',()=>{
 const f=engine.forecast(model,expected.at,expected.until);
 assert.equal(f.opening,expected.opening);
 assert.equal(f.closing,expected.closing);
 assert.equal(f.minimum,expected.minimum);
 assert.equal(f.events.length,expected.eventCount);
 assert.deepEqual(f.events.filter(x=>x.desc==='Taxe foncière').map(x=>x.date),expected.annualTaxDates);
 assert.deepEqual(f.events.filter(x=>x.desc==='Charges copro trimestrielles').map(x=>x.date),expected.quarterlyDates);
});
test('forecast ne modifie pas le modèle source',()=>{
 const before=JSON.stringify(model);
 engine.forecast(model,expected.at,expected.until,'',{rules:{r_netflix:{amount:-20}}});
 assert.equal(JSON.stringify(model),before);
});
