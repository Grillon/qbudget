'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/engine.js');
const annotations=require('../src/annotations.js');
const tags=require('../src/tags.js');
const recurrences=require('../src/recurrences.js');
const fs=require('node:fs');
const vm=require('node:vm');
function model(dates=['2026-08-31','2026-09-30','2026-10-31']){
 const rows=engine.readCsv('Date;Banque;Compte;Libellé;Montant;Devise\n'+dates.map(date=>`${date};BPS;Courant;NETFLIX;-15,99;EUR`).join('\n'));
 return engine.mergeAnnotations(rows,{notes:{},references:{BPS:{date:'2026-11-01',balance:1000}}});
}
const detect=m=>recurrences.scan(m);
const pending=m=>m.recurrenceBacklog.filter(c=>c.status==='pending');
const accept=(m,c,extra={})=>recurrences.accept(m,c.id,{id:'nouvelle-regle',...extra});

test('détection : calendrier mensuel, fins de mois, historique consultable et scan sans effet financier',()=>{
 const m=model(),before=JSON.stringify(m),forecast=engine.forecast(m,'2026-11-01','2027-01-31');
 const scanned=detect(m),c=pending(scanned)[0];
 assert.equal(pending(scanned).length,1);assert.equal(c.frequency,'mensuel');assert.equal(c.anchor,'2026-10-31');assert.equal(c.amount,-15.99);assert.equal(c.evidence.length,3);
 assert.equal(JSON.stringify(m),before);assert.deepEqual(scanned.notes,m.notes);assert.deepEqual(scanned.rules,m.rules);assert.deepEqual(scanned.rows,m.rows);
 assert.deepEqual(engine.forecast(scanned,'2026-11-01','2027-01-31'),forecast);
 assert.deepEqual(engine.auditOperations(scanned,{scope:'all',at:'2026-11-01',until:'2027-01-31'}),engine.auditOperations(m,{scope:'all',at:'2026-11-01',until:'2027-01-31'}));
});
test('détection : fréquences, décalages bancaires et montants strictement identiques',()=>{
 for(const [dates,frequency] of [
  [['2026-10-01','2026-10-02','2026-10-03'],'quotidien'],
  [['2026-10-02','2026-10-10','2026-10-16'],'hebdomadaire'],
  [['2026-01-05','2026-04-06','2026-07-05'],'trimestriel'],
  [['2025-05-05','2025-11-06','2026-05-05'],'semestriel'],
  [['2024-05-05','2025-05-06','2026-05-05'],'annuel']
 ])assert.equal(pending(detect(model(dates)))[0].frequency,frequency);
 const m=model();m.rows[0].amount=-12;m.rows[1].amount=-18;
 assert.equal(pending(detect(m)).length,0);
});
test('détection : libellés strictement égaux normalisés, sans regroupement par association ou tag',()=>{
 const m=model();m.rows[0].desc=' CB NETFLIX ';m.rows[1].desc='PRLV NFLX';m.rows[2].desc='cb  netflix';
 for(const r of m.rows)m.notes[r.id]={tags:['Perso']};
 assert.equal(pending(detect(m)).length,0);
 m.labelAssociations=[{tag:'Netflix',patterns:['NETFLIX','NFLX']}];
 assert.equal(pending(detect(m)).length,0);
 m.rows[1].desc='CB NETFLIX';const c=pending(detect(m))[0];
 assert.equal(c.desc,'cb  netflix');assert.equal(c.evidence.length,3);
 assert.deepEqual(c.evidence.map(e=>e.desc),m.rows.map(r=>r.desc));
});
test('détection : comptes sources, banques et sens des flux séparés',()=>{
 const m=model();m.rows[0].sourceAccount='Epargne';assert.equal(pending(detect(m))[0].evidence.length,2);
 m.rows[0].sourceAccount='Courant';m.rows[0].bank='Autre';assert.equal(pending(detect(m))[0].evidence.length,2);
 m.rows[0].bank='BPS';m.rows[0].amount=15.99;assert.equal(pending(detect(m))[0].evidence.length,2);
});
test('détection : deux dates suffisent ; dates irrégulières ou doublons du même jour',()=>{
 assert.equal(pending(detect(model(['2026-08-01','2026-09-01']))).length,1);
 assert.equal(pending(detect(model(['2026-08-01','2026-08-13','2026-10-22']))).length,0);
 const m=model();m.rows.push({...m.rows[0],id:'doublon'});assert.equal(pending(detect(m)).length,0);
});
test('détection : flottantes, prévisions, lignes prévues, ponctuelles et devises non prises en charge exclues',()=>{
 for(const change of [r=>r.date=null,r=>r.forecast=true,r=>r.nature='planned',r=>r.currency='USD',r=>r.amount=0]){
  const m=model();change(m.rows[0]);assert.equal(pending(detect(m))[0].evidence.length,2);
 }
 const m=model();m.notes[m.rows[0].id]={type:'ponctuel'};assert.equal(pending(detect(m))[0].evidence.length,2);
});
test('détection : règles existantes et rapprochements bancaires incertains jamais associés arbitrairement',()=>{
 const m=model();m.rules.r={id:'r',account:'BPS',desc:'netflix',amount:-15.99,frequency:'mensuel',anchor:'2026-10-31'};
 assert.equal(pending(detect(m)).length,0);delete m.rules.r;m.notes[m.rows[0].id]={ruleId:'regle-absente'};
 assert.equal(pending(detect(m)).length,0);delete m.notes[m.rows[0].id];
 m.bankIdentities.find(e=>e.id===m.rows[0].id).pendingMatch={candidates:[],reason:'doublon'};
 assert.equal(pending(detect(m))[0].evidence.length,2);
});
test('backlog : scans répétés et réordonnancement sans duplication, décisions ignorées conservées',()=>{
 let m=detect(model());const id=pending(m)[0].id;
 m=detect({...m,rows:[...m.rows].reverse()});assert.equal(m.recurrenceBacklog.length,1);assert.equal(pending(m)[0].id,id);
 m=recurrences.ignore(m,id);assert.equal(pending(detect(m)).length,0);assert.equal(detect(m).recurrenceBacklog.length,1);
 m=recurrences.reopen(m,id);assert.equal(pending(m).length,1);
});
test('backlog : acceptation explicite et modifiable, tags complets préservés, règle native auditable',()=>{
 const original=model();for(const r of original.rows)original.notes[r.id]={tags:['perso'],tag:'perso',extra:{x:1}};
 const m=detect(original),c=pending(m)[0],snapshot=JSON.stringify(m);
 const accepted=accept(m,c,{amount:-17,desc:'Netflix personnel',frequency:'mensuel',anchor:'2026-10-31'});
 assert.equal(JSON.stringify(m),snapshot);assert.deepEqual(accepted.rows,m.rows);
 for(const row of m.rows){assert.deepEqual(engine.manualTagsFor(accepted,row),['perso']);assert.deepEqual(accepted.notes[row.id].extra,{x:1});assert.equal(accepted.notes[row.id].ruleId,'nouvelle-regle')}
 const rule=accepted.rules['nouvelle-regle'];assert.equal(rule.amount,-17);assert.equal(rule.desc,'Netflix personnel');assert.equal(rule.anchor,'2026-10-31');
 assert.equal(pending(detect(accepted)).length,0);
 const events=engine.forecast(accepted,'2026-11-01','2026-12-31').events;assert.deepEqual(events.map(e=>[e.date,e.amount]),[['2026-11-30',-17],['2026-12-31',-17]]);
 assert.equal(engine.auditOperations(accepted,{scope:'all',at:'2026-11-01',until:'2026-12-31'}).filter(r=>r.origine==='recurrence').length,2);
 assert.throws(()=>accept(accepted,c),/traitée|introuvable/i);
});
test('backlog : données modifiées, import partiel et conflit d’annotations refusés sans mutation',()=>{
 for(const change of [m=>m.rows.pop(),m=>m.rows[0].amount=-200,m=>m.notes[m.rows[0].id]={ruleId:'autre'}]){
  const m=detect(model()),c=pending(m)[0];change(m);const before=JSON.stringify(m);
  assert.throws(()=>accept(m,c),/changé|relanc|règle|disponible/i);assert.equal(JSON.stringify(m),before);
 }
 const m=detect(model()),c=pending(m)[0];assert.throws(()=>accept(m,c,{anchor:'2026-08-01'}),/référence/i);assert.throws(()=>accept(m,c,{amount:NaN}),/montant/i);
});
test('backlog : export/restauration JSON et CLI conservent propositions, preuves et décisions',()=>{
 const m=detect(model()),c=pending(m)[0],ignored=recurrences.ignore(m,c.id);
 for(const source of [m,ignored,accept(m,c)]){
  const saved=annotations.exportObject(source),restored=annotations.importInto(source,saved,tags);
  assert.deepEqual(restored.recurrenceBacklog,source.recurrenceBacklog);
  const csv='Date;Banque;Compte;Libellé;Montant;Devise\n'+source.rows.map(r=>`${r.date};${r.bank};${r.sourceAccount};${r.desc};${r.amount};EUR`).join('\n');
  const cli=engine.mergeAnnotations(engine.readCsv(csv),saved);assert.deepEqual(cli.recurrenceBacklog,source.recurrenceBacklog);
  assert.deepEqual(engine.forecast(cli,'2026-11-01','2026-12-31'),engine.forecast(source,'2026-11-01','2026-12-31'));
 }
 const empty=annotations.importInto({rows:[],notes:{},references:{}},annotations.exportObject(m),tags);
 assert.equal(pending(empty)[0].evidence.length,3);assert.throws(()=>accept(empty,c),/disponible|relanc|changé/i);
});
test('backlog : compatibilité ancienne sauvegarde, import partiel et validation atomique',()=>{
 const m=detect(model()),saved=annotations.exportObject(m),before=JSON.stringify(m);
 saved.recurrenceBacklog=[{id:'invalide',status:'pending'}];assert.throws(()=>annotations.importInto(m,saved,tags),/récurrence|proposition/i);assert.equal(JSON.stringify(m),before);
 const legacy=annotations.importInto(m,{notes:{},references:{}},tags);assert.deepEqual(legacy.recurrenceBacklog,[]);
 const partial=engine.reimportBankRows(m,[m.rows[0]]);assert.deepEqual(partial.recurrenceBacklog,m.recurrenceBacklog);
 assert.equal(detect(partial).recurrenceBacklog.length,1);
});
test('détection : même résultat et restauration dans Node et un navigateur sans require',()=>{
 const context={TextEncoder};vm.createContext(context);
 for(const file of ['normalize','identity','engine','recurrences','transfers','tags','annotations'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),context);
 const csv=fs.readFileSync('examples/recurrences-potentielles.csv','utf8');
 const node=detect(engine.mergeAnnotations(engine.readCsv(csv),{}));assert.equal(pending(node).length,2);
 const browser=context.QBudgetRecurrences.scan(context.QBudgetEngine.mergeAnnotations(context.QBudgetEngine.readCsv(csv),{}));
 assert.deepEqual(JSON.parse(JSON.stringify(browser)),node);
 const saved=annotations.exportObject(node);
 const restored=context.QBudgetAnnotations.importInto(browser,saved,context.QBudgetTags);
 assert.deepEqual(JSON.parse(JSON.stringify(restored.recurrenceBacklog)),node.recurrenceBacklog);
});
test('backlog : scan actualisé après nouvel historique, proposition obsolète conservée puis réactivée',()=>{
 const m=detect(model()),id=pending(m)[0].id;
 const changed={...m,rows:[m.rows[0]]},stale=detect(changed);
 assert.equal(pending(stale)[0].stale,true);assert.equal(pending(stale)[0].evidence.length,3);
 const refreshed=detect({...stale,rows:m.rows});assert.equal(pending(refreshed)[0].id,id);assert.ok(!pending(refreshed)[0].stale);
 const updated=detect({...m,rows:[...m.rows,{...m.rows.at(-1),id:'suivante',date:'2026-11-30',amount:-18}]});
 assert.equal(updated.recurrenceBacklog.length,1);assert.equal(pending(updated)[0].evidence.length,3);assert.equal(pending(updated)[0].amount,-15.99);
});
