'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const e=require('../src/engine.js'),r=require('../src/recurrences.js'),tags=require('../src/tags.js'),annotations=require('../src/annotations.js');
function make(entries){
 const csv='Date;Banque;Compte;Libellé;Montant;Devise\n'+entries.map(([date,amount=-100,desc='ABONNEMENT',account='Courant'])=>`${date};BPS;${account};${desc};${amount};EUR`).join('\n');
 return {...e.mergeAnnotations(e.readCsv(csv),{notes:{},references:{BPS:{date:'2027-01-31',balance:1000}}}),tagCategories:tags.defaults(),tagDefaultsVersion:tags.defaultsVersion};
}
function series(frequency='mensuel',count=24){return Array.from({length:count},(_,i)=>[e.shiftDate('2025-01-31',frequency,i),i%12===0?-100:-90]);}
const pending=m=>m.recurrenceBacklog.filter(c=>c.status==='pending');
test('24 échéances mensuelles : aucun rapprochement annuel par paires entre les deux années',()=>{
 const m=make(series().map(([date])=>[date,-100])),found=r.detect(m);
 assert.equal(found.length,1);assert.equal(found[0].frequency,'mensuel');assert.equal(found[0].evidence.length,24);
});
test('mensuel prioritaire malgré un même montant présent une fois par an ; seules les preuves de même montant sont classées',()=>{
 const m=make(series()),before=JSON.stringify(m),found=r.detect(m);
 assert.equal(found.length,2);assert.ok(found.every(c=>c.frequency==='mensuel'));
 const selected=found.find(c=>c.amount===-100);assert.equal(selected.evidence.length,2);assert.equal(selected.cadenceEvidence.length,24);
 const scanned=r.scan(m),forecast=e.forecast(m,'2027-01-31','2027-12-31');
 const next=r.classify(scanned,selected.id);
 assert.equal(JSON.stringify(m),before);assert.equal(next.rows.filter(row=>next.notes[row.id]?.recurrenceFrequency==='mensuel').length,2);
 assert.ok(next.rows.filter(row=>row.amount===-90).every(row=>!next.notes[row.id]?.recurrenceFrequency));
 assert.deepEqual(e.forecast(next,'2027-01-31','2027-12-31'),forecast);
 assert.deepEqual(annotations.importInto(next,annotations.exportObject(next),tags).recurrenceBacklog,next.recurrenceBacklog);
});
test('les dates déjà classées ponctuelles éclairent le rythme sans modifier ces classifications',()=>{
 const m=make(series());for(const row of m.rows)if(row.amount===-90)m.notes[row.id]={type:'ponctuel',tags:['libre']};
 const before=JSON.stringify(m),found=r.detect(m);
 assert.equal(found.length,1);assert.equal(found[0].frequency,'mensuel');assert.equal(found[0].evidence.length,2);assert.equal(found[0].cadenceEvidence.length,24);
 assert.equal(JSON.stringify(m),before);
});
test('quotidien, hebdo, trimestriel et semestriel prioritaires sur les sous-groupes espacés',()=>{
 for(const [frequency,count,repeat] of [['quotidien',14,7],['hebdomadaire',53,52],['trimestriel',8,4],['semestriel',4,2]]){
  const entries=Array.from({length:count},(_,i)=>[e.shiftDate('2025-01-31',frequency,i),i%repeat===0?-100:-90]);
  const found=r.detect(make(entries)).filter(c=>c.frequency!=='ponctuel');
  assert.ok(found.length>0);assert.ok(found.every(c=>c.frequency===frequency),frequency);
 }
});
test('cycles manquants : deux séquences mensuelles sur deux années restent mensuelles',()=>{
 const found=r.detect(make([['2025-01-31',-100],['2025-02-28',-90],['2026-01-31',-100],['2026-02-28',-90]]));
 assert.equal(found.length,2);assert.ok(found.every(c=>c.frequency==='mensuel'));
});
test('un intervalle annuel réel est requis ; changer simplement de millésime ne suffit pas',()=>{
 for(const dates of [['2025-01-31','2026-01-31'],['2024-02-29','2025-02-28']])assert.equal(r.detect(make(dates.map(d=>[d])))[0].frequency,'annuel');
 assert.equal(r.detect(make([['2025-12-31'],['2026-01-01']]))[0].frequency,'quotidien');
 assert.equal(r.detect(make([['2025-12-15'],['2026-01-15']]))[0].frequency,'mensuel');
 assert.equal(r.detect(make([['2025-01-31'],['2027-01-31']])).length,0);
});
test('une seule paire courte isolée ne change pas arbitrairement une vraie série annuelle',()=>{
 const found=r.detect(make([['2025-01-01',-100],['2025-01-02',-90],['2026-01-01',-100]]));
 assert.equal(found.find(c=>c.amount===-100).frequency,'annuel');
});
test('backlog : ancienne détection annuelle remplacée par mensuel au scan, y compris après une classification déjà validée',()=>{
 const old=r.scan(make([series()[0],series()[12]])),oldCandidate=old.recurrenceBacklog[0];assert.equal(oldCandidate.frequency,'annuel');
 const accepted=r.classify(old,oldCandidate.id);
 for(const previous of [old,accepted]){
  const full=e.reimportBankRows(previous,make(series()).rows),rescanned=r.scan(full);
  assert.equal(pending(rescanned).find(c=>c.id===oldCandidate.id).frequency,'mensuel');
  assert.equal(rescanned.recurrenceBacklog.filter(c=>c.id===oldCandidate.id).length,1);
  if(previous===accepted)assert.equal(rescanned.notes[rescanned.rows[0].id].recurrenceFrequency,'annuel');
 }
});
test('les preuves de contexte sont revérifiées ; les décisions explicites de l’utilisateur restent respectées',()=>{
 const m=r.scan(make(series())),c=m.recurrenceBacklog.find(c=>c.amount===-100);
 const incomplete={...m,rows:m.rows.filter(row=>row.amount===-100)},before=JSON.stringify(incomplete);
 assert.throws(()=>r.classify(incomplete,c.id),/changé|relanc/);assert.equal(JSON.stringify(incomplete),before);
 const overridden=r.classify(m,c.id,{frequency:'annuel'});
 assert.equal(r.scan(overridden).recurrenceBacklog.find(entry=>entry.id===c.id).status,'accepted');
 const ignored=r.ignore(m,c.id);assert.equal(r.scan(ignored).recurrenceBacklog.find(entry=>entry.id===c.id).status,'ignored');
});
function oneOff(end='2026-01-01',source='Courant'){
 const m=make([['2025-01-01',-1,'DEBUT',source],['2025-06-15',-400,'MATERIEL','Courant'],[end,-2,'FIN',source]]);
 for(const row of m.rows)if(row.desc!=='MATERIEL')m.notes[row.id]={type:'ponctuel'};
 return m;
}
test('ponctuel : une seule occurrence et un historique couvrant au moins un an sur le même compte',()=>{
 const m=oneOff(),found=r.detect(m);assert.equal(found.length,1);assert.equal(found[0].frequency,'ponctuel');assert.equal(found[0].evidence.length,1);
 assert.deepEqual(found[0].coverageEvidence.map(e=>e.date),['2025-01-01','2026-01-01']);
 assert.equal(r.detect(oneOff('2025-12-31')).length,0);assert.equal(r.detect(oneOff('2026-01-01','Livret')).length,0);
});
test('valider ponctuel conserve tags, annotations et forecast ; nouvelle occurrence annuelle soumise à validation',()=>{
 const m=oneOff(),row=m.rows.find(row=>row.desc==='MATERIEL');m.notes[row.id]={tags:['Récurrent','libre'],memo:'garder'};
 const scanned=r.scan(m),c=scanned.recurrenceBacklog[0],forecast=e.forecast(m,'2026-01-01','2027-12-31');
 const next=r.classify(scanned,c.id);assert.equal(next.notes[row.id].type,'ponctuel');assert.equal(next.notes[row.id].memo,'garder');assert.deepEqual(next.notes[row.id].tags,['Récurrent','libre']);
 assert.deepEqual(e.tagsByCategory(next,row,next.tagCategories.find(c=>c.source==='type')),['Ponctuel']);
 assert.deepEqual(e.forecast(next,'2026-01-01','2027-12-31'),forecast);assert.deepEqual(r.scan(next).recurrenceBacklog,next.recurrenceBacklog);
 assert.equal(r.reopen(next,c.id).recurrenceBacklog[0].status,'pending');
 assert.throws(()=>r.accept(scanned,c.id,{id:'r'}),/isolée/);assert.throws(()=>r.classify(scanned,c.id,{frequency:'annuel'}),/Deux occurrences/);
 const newRow=make([['2026-06-15',-400,'MATERIEL']]).rows[0],expanded={...next,rows:[...next.rows,newRow]};
 assert.equal(pending(r.scan(expanded)).find(c=>c.desc==='MATERIEL').frequency,'annuel');
 assert.deepEqual(annotations.importInto(next,annotations.exportObject(next),tags).recurrenceBacklog,next.recurrenceBacklog);
});
test('ponctuel : impossible de valider si la plage d’un an n’est plus présente',()=>{
 const m=r.scan(oneOff()),c=m.recurrenceBacklog[0];m.rows=m.rows.filter(row=>row.desc!=='FIN');const before=JSON.stringify(m);
 assert.throws(()=>r.classify(m,c.id),/changé|relanc/);assert.equal(JSON.stringify(m),before);
});
