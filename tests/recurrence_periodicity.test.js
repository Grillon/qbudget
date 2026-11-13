'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../src/engine.js'),recurrences=require('../src/recurrences.js'),tags=require('../src/tags.js'),annotations=require('../src/annotations.js'),editor=require('../src/editor.js');
function make(dates=['2026-01-31','2026-07-31']){
 const csv='Date;Banque;Compte;Libellé;Montant;Devise\n'+dates.map(date=>`${date};BPS;Courant;ASSURANCE;-300;EUR`).join('\n');
 const m=engine.mergeAnnotations(engine.readCsv(csv),{notes:{},references:{BPS:{date:'2026-11-01',balance:1000}}});
 m.tagCategories=tags.defaults();m.tagDefaultsVersion=tags.defaultsVersion;
 for(const r of m.rows)m.notes[r.id]={tags:['assurance','libre'],tag:'assurance',memo:{a:1}};
 return m;
}
test('deux occurrences suffisent pour les six fréquences ; différences de montant ou dates irrégulières exclues',()=>{
 const m=engine.mergeAnnotations(engine.readCsv(fs.readFileSync('examples/recurrences-periodicites.csv','utf8')),{});
 const before=JSON.stringify(m),found=recurrences.detect(m).filter(c=>c.frequency!=='ponctuel');
 assert.deepEqual(found.map(c=>c.frequency).sort(),['quotidien','hebdomadaire','mensuel','trimestriel','semestriel','annuel'].sort());
 assert.ok(found.every(c=>c.evidence.length===2));assert.equal(JSON.stringify(m),before);
});
test('validation de périodicité : tags et annotations conservés, aucune règle ni effet sur le forecast ou l’audit',()=>{
 const m=recurrences.scan(make()),c=m.recurrenceBacklog[0],before=JSON.stringify(m),at='2026-11-01',until='2027-12-31';
 const forecast=engine.forecast(m,at,until),audit=engine.auditCsv(engine.auditOperations(m,{scope:'all',at,until}));
 const result=recurrences.classify(m,c.id);
 assert.equal(JSON.stringify(m),before);assert.strictEqual(result.rows,m.rows);assert.strictEqual(result.rules,m.rules);
 for(const row of result.rows){
  assert.deepEqual(result.notes[row.id].tags,m.notes[row.id].tags);assert.deepEqual(result.notes[row.id].memo,{a:1});
  assert.equal(result.notes[row.id].type,'recurrent');assert.equal(result.notes[row.id].recurrenceFrequency,'semestriel');assert.ok(!result.notes[row.id].ruleId);
  assert.deepEqual(engine.tagsByCategory(result,row,result.tagCategories.find(c=>c.source==='type')),['semestriel']);
 }
 assert.deepEqual(engine.forecast(result,at,until),forecast);assert.equal(engine.auditCsv(engine.auditOperations(result,{scope:'all',at,until})),audit);
 assert.equal(engine.expenseBreakdown(result,result.rows,['Périodicité']).values[0],600);
 assert.ok(editor.itemList(result).filter(i=>i.kind==='bank').every(i=>i.search.includes('semestriel')));
 assert.equal(result.recurrenceBacklog[0].classificationOnly,true);assert.equal(result.recurrenceBacklog[0].status,'accepted');
 assert.deepEqual(recurrences.scan(result).recurrenceBacklog,result.recurrenceBacklog);
 assert.throws(()=>recurrences.classify(result,c.id),/traitée|introuvable/);
 const reopened=recurrences.reopen(result,c.id);assert.equal(reopened.recurrenceBacklog[0].status,'pending');assert.deepEqual(reopened.notes,result.notes);
 const restored=annotations.importInto(result,annotations.exportObject(result),tags);
 assert.deepEqual(restored.notes,result.notes);assert.deepEqual(restored.recurrenceBacklog,result.recurrenceBacklog);
});
test('validation quotidienne, hebdo, mensuelle et annuelle affichée par la dimension automatique',()=>{
 for(const [dates,frequency,label] of [
  [['2026-10-01','2026-10-02'],'quotidien','quotidien'],
  [['2026-10-01','2026-10-08'],'hebdomadaire','hebdo'],
  [['2026-08-31','2026-09-30'],'mensuel','mensuel'],
  [['2025-10-31','2026-10-31'],'annuel','annuel']
 ]){
  const m=recurrences.scan(make(dates)),next=recurrences.classify(m,m.recurrenceBacklog[0].id);
  assert.equal(next.notes[next.rows[0].id].recurrenceFrequency,frequency);
  assert.deepEqual(engine.tagsByCategory(next,next.rows[0],next.tagCategories.find(c=>c.source==='type')),[label]);
 }
});
test('validation refusée sans mutation si une preuve manque ou change, ou si la fréquence est inconnue',()=>{
 for(const change of [m=>m.rows.pop(),m=>m.rows[0].amount=-301,m=>m.notes[m.rows[0].id].ruleId='autre']){
  const m=recurrences.scan(make()),id=m.recurrenceBacklog[0].id;change(m);const before=JSON.stringify(m);
  assert.throws(()=>recurrences.classify(m,id),/changé|disponible|relanc/);assert.equal(JSON.stringify(m),before);
 }
 const m=recurrences.scan(make()),before=JSON.stringify(m);assert.throws(()=>recurrences.classify(m,m.recurrenceBacklog[0].id,{frequency:'inconnue'}),/Fréquence/);assert.equal(JSON.stringify(m),before);
});
test('nouvelle occurrence après classification : groupe soumis de nouveau à validation, sans doublon ni modification silencieuse',()=>{
 const m=recurrences.scan(make()),classified=recurrences.classify(m,m.recurrenceBacklog[0].id);
 const newRows=engine.readCsv('Date;Banque;Compte;Libellé;Montant;Devise\n2026-01-31;BPS;Courant;ASSURANCE;-300;EUR\n2026-07-31;BPS;Courant;ASSURANCE;-300;EUR\n2027-01-31;BPS;Courant;ASSURANCE;-300;EUR');
 const updated=engine.reimportBankRows(classified,newRows),scanned=recurrences.scan(updated);
 assert.equal(scanned.recurrenceBacklog.length,1);assert.equal(scanned.recurrenceBacklog[0].status,'pending');assert.equal(scanned.recurrenceBacklog[0].evidence.length,3);
 assert.equal(scanned.notes[scanned.rows[2].id]?.recurrenceFrequency,undefined);assert.equal(Object.keys(scanned.rules).length,0);
});
test('compatibilité des anciennes propositions : identifiants migrés sans doublon, décisions ignorées conservées',()=>{
 const current=recurrences.detect(make())[0],legacy={...current,id:'ancien-identifiant',evidence:current.evidence.map(({identityAmount,...e})=>e)};
 const m=make();m.recurrenceBacklog=[legacy];
 const scanned=recurrences.scan(m);assert.equal(scanned.recurrenceBacklog.length,1);assert.equal(scanned.recurrenceBacklog[0].id,current.id);
 assert.equal(recurrences.classify(m,legacy.id).recurrenceBacklog[0].status,'accepted');
 const ignored={...m,recurrenceBacklog:[{...legacy,status:'ignored'}]};
 assert.deepEqual(recurrences.scan(ignored).recurrenceBacklog,ignored.recurrenceBacklog);
 assert.equal(recurrences.reopen(ignored,legacy.id).recurrenceBacklog[0].id,current.id);
});
test('montants exacts, comptes et devises distincts : pas de rapprochement approché',()=>{
 for(const change of [r=>r.amount=-300.01,r=>r.bank='Autre',r=>r.sourceAccount='Livret',r=>r.currency='USD',r=>r.desc='AUTRE ASSURANCE']){
  const m=make();change(m.rows[1]);assert.equal(recurrences.detect(m).length,0);
 }
});
test('semestriel : calendrier ancré, prévision, audit et affichage depuis une règle liée',()=>{
 assert.equal(engine.shiftDate('2026-08-31','semestriel',1),'2027-02-28');assert.equal(engine.shiftDate('2026-08-31','semestriel',2),'2027-08-31');
 const m=recurrences.scan(make()),c=m.recurrenceBacklog[0],next=recurrences.accept(m,c.id,{id:'assurance-semestrielle'});
 const at='2026-11-01',until='2027-12-31';
 assert.deepEqual(engine.forecast(next,at,until).events.map(e=>[e.date,e.amount]),[['2027-01-31',-300],['2027-07-31',-300]]);
 assert.equal(engine.auditOperations(next,{scope:'all',at,until}).filter(r=>r.origine==='recurrence').length,2);
 const period=next.tagCategories.find(c=>c.source==='type');assert.deepEqual(engine.tagsByCategory(next,next.rows[0],period),['semestriel']);
 for(const row of engine.recurrencePreview(next,at,until))assert.deepEqual(engine.tagsByCategory(next,row,period),['semestriel']);
});
