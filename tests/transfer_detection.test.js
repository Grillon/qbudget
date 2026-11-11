'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../src/engine.js');
const tags=require('../src/tags.js');
const annotations=require('../src/annotations.js');
const transfers=require('../src/transfers.js');
const header='Date;Banque;Compte;Libellé;Montant;Devise\n';
const initial=header+'2026-11-01;BPS;Courant;Vers Qonto;-2000,00;EUR\n2026-11-01;Qonto;Courant;Depuis BPS;2000,00;EUR';
function model(csv=initial){return engine.mergeAnnotations(engine.readCsv(csv),{notes:{},references:{BPS:{date:'2026-11-02',balance:1000},Qonto:{date:'2026-11-02',balance:3000}}})}
const scan=m=>transfers.scan(m);
const pending=m=>m.transferBacklog.filter(c=>transfers.status(m,c)==='pending');

test('transferts : paire lisible proposée, comptes et montants exacts, aucune mutation avant validation',()=>{
 const m=model(),before=JSON.stringify(m),scanned=scan(m),c=pending(scanned)[0];
 assert.equal(pending(scanned).length,1);assert.deepEqual(c.evidence.map(e=>e.amount),[-2000,2000]);
 assert.equal(JSON.stringify(m),before);assert.deepEqual(scanned.rows,m.rows);assert.deepEqual(scanned.notes,m.notes);
 assert.deepEqual(engine.forecast(scanned,'2026-11-02','2026-12-31'),engine.forecast(m,'2026-11-02','2026-12-31'));
 assert.equal(engine.auditCsv(engine.auditOperations(scanned,{scope:'all',at:'2026-11-02',until:'2026-12-31'})),engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-02',until:'2026-12-31'})));
});
test('transferts : comptes sources distincts dans une banque, compte identique ou inconnu exclu',()=>{
 const csv=header+'2026-11-01;BPS;LDD;Vers courant;-2000;EUR\n2026-11-01;BPS;Courant;Depuis LDD;2000;EUR';
 assert.equal(pending(scan(model(csv))).length,1);
 assert.equal(pending(scan(model(csv.replace(';LDD;',';Courant;')))).length,0);
 const m=model(csv);delete m.rows[0].sourceAccount;assert.equal(pending(scan(m)).length,0);
});
test('transferts : deux débits, dates ou devises différentes, zéro et montants voisins jamais rapprochés',()=>{
 for(const text of [initial.replace(';2000,00;EUR',';-2000,00;EUR'),initial.replace('2026-11-01;Qonto','2026-11-02;Qonto'),initial.replace(';2000,00;EUR',';2000,00;USD'),initial.replace(/2000,00/g,'0,00'),initial.replace(';2000,00;EUR',';2000,01;EUR')])assert.equal(pending(scan(model(text))).length,0);
 const decimal=initial.replace(/2000,00/g,'0,10');assert.equal(pending(scan(model(decimal))).length,1);
 const close=initial.replace('-2000,00','-100,001').replace(';2000,00;EUR',';100,004;EUR');assert.equal(pending(scan(model(close))).length,0);
});
test('transferts : ambiguïtés multiples signalées, aucune préférence selon l’ordre ou les tags',()=>{
 const m=model(initial+'\n2026-11-01;Revolut;Courant;Autre virement;-2000;EUR');
 let a=transfers.analyze(m);assert.equal(a.candidates.length,0);assert.equal(a.ambiguous.length,3);
 tags.addTag(m,[m.rows[0].id],'transfert_intercomptes');
 a=transfers.analyze({...m,rows:[...m.rows].reverse()});assert.equal(a.candidates.length,0);assert.equal(a.ambiguous.length,3);
 assert.deepEqual(engine.manualTagsFor(m,m.rows[1]),[]);
});
test('transferts : identités incertaines ne rendent jamais un autre appariement artificiellement unique',()=>{
 const m=model(initial+'\n2026-11-01;Revolut;Courant;Autre virement;-2000;EUR');
 m.bankIdentities.find(e=>e.id===m.rows[2].id).pendingMatch={candidates:[],reason:'ambigu'};
 assert.equal(transfers.analyze(m).candidates.length,0);assert.equal(transfers.analyze(m).ambiguous.length,3);
 const single=model();single.bankIdentities[0].pendingMatch={candidates:[],reason:'ambigu'};
 assert.equal(transfers.analyze(single).candidates.length,0);
});
test('transferts : deux tags posés manuellement résolvent une paire ambiguë sans classer le troisième mouvement',()=>{
 const m=model(initial+'\n2026-11-01;Revolut;Courant;Autre crédit;2000;EUR');
 assert.equal(transfers.analyze(m).ambiguous.length,3);
 tags.addTag(m,[m.rows[0].id,m.rows[1].id],'transfert_intercomptes');
 const analysis=transfers.analyze(m);assert.equal(analysis.candidates.length,1);assert.equal(analysis.ambiguous.length,0);
 const scanned=scan(m);assert.equal(pending(scanned).length,0);assert.equal(transfers.status(scanned,scanned.transferBacklog[0]),'validated');
 assert.deepEqual(engine.manualTagsFor(scanned,m.rows[2]),[]);
});
test('transferts : flottantes, manuelles, prévues et prévisions calculées exclues',()=>{
 for(const change of [r=>r.date=null,r=>r.manual=true,r=>r.nature='planned',r=>r.forecast=true]){
  const m=model();change(m.rows[0]);assert.equal(pending(scan(m)).length,0);
 }
});
test('transferts : la validation est le tag sur les deux lignes, sans autre état de validation',()=>{
 let m=scan(model());const c=pending(m)[0];
 m.notes[c.evidence[0].id]={tags:['personnel'],tag:'personnel',ruleId:'r',extra:{x:1}};
 const rows=JSON.stringify(m.rows),backlog=JSON.stringify(m.transferBacklog);
 const accepted=transfers.accept(m,c.id);
 assert.equal(JSON.stringify(accepted.rows),rows);assert.equal(JSON.stringify(accepted.transferBacklog),backlog);
 assert.equal(transfers.status(accepted,c),'validated');assert.equal(pending(accepted).length,0);
 assert.deepEqual(engine.manualTagsFor(accepted,accepted.rows[0]),['personnel','transfert_intercomptes']);
 assert.equal(accepted.notes[c.evidence[0].id].ruleId,'r');assert.deepEqual(accepted.notes[c.evidence[0].id].extra,{x:1});
 tags.removeTag(accepted,[c.evidence[0].id],'transfert_intercomptes');assert.equal(transfers.status(accepted,c),'pending');
 tags.addTag(accepted,[c.evidence[0].id],'TRANSFERT_INTERCOMPTES');assert.equal(transfers.status(accepted,c),'validated');
});
test('transferts : ajout manuel du tag reconnu, suppression rouvre la proposition, ignorance réversible',()=>{
 let m=scan(model()),c=pending(m)[0];
 tags.addTag(m,[m.rows[0].id],'transfert_intercomptes');assert.equal(transfers.status(m,c),'pending');
 tags.addTag(m,[m.rows[1].id],'transfert_intercomptes');assert.equal(transfers.status(m,c),'validated');
 tags.removeTag(m,m.rows.map(r=>r.id),'transfert_intercomptes');assert.equal(transfers.status(m,c),'pending');
 m=transfers.ignore(m,c.id);assert.equal(pending(scan(m)).length,0);
 m=transfers.reopen(m,c.id);assert.equal(pending(m).length,1);
});
test('transferts : réordonnancement, scans répétés et import partiel préservent les décisions',()=>{
 let m=scan(model());const c=pending(m)[0];m=scan({...m,rows:[...m.rows].reverse()});assert.equal(m.transferBacklog.length,1);assert.equal(pending(m)[0].id,c.id);
 const partial=engine.reimportBankRows(m,[m.rows[0]]),before=JSON.stringify(partial);
 assert.deepEqual(partial.transferBacklog,m.transferBacklog);assert.throws(()=>transfers.accept(partial,c.id),/changé|disponible|relanc/i);assert.equal(JSON.stringify(partial),before);
 const stale=scan(partial);assert.equal(stale.transferBacklog[0].stale,true);
 const full=scan(engine.reimportBankRows(stale,engine.readCsv(initial)));assert.equal(pending(full).length,1);assert.ok(!pending(full)[0].stale);
});
test('transferts : validation groupée atomique, changement ou nouveau concurrent interdit toute attribution',()=>{
 const m=scan(model(initial+'\n2026-11-02;BPS;Courant;Second;-100;EUR\n2026-11-02;Qonto;Courant;Second;100;EUR'));
 assert.equal(pending(m).length,2);const ids=pending(m).map(c=>c.id);
 const changed={...m,rows:m.rows.slice(0,-1)},snapshot=JSON.stringify(changed);
 assert.throws(()=>transfers.acceptMany(changed,ids),/changé|disponible|relanc/i);assert.equal(JSON.stringify(changed),snapshot);
 const accepted=transfers.acceptMany(m,ids);assert.ok(accepted.rows.every(r=>engine.tagsFor(accepted,r).includes('transfert_intercomptes')));
 const competing={...m,rows:[...m.rows,{...m.rows[0],id:'nouveau',bank:'Revolut'}]},before=JSON.stringify(competing);
 assert.throws(()=>transfers.accept(competing,ids[0]),/changé|ambigu|relanc/i);assert.equal(JSON.stringify(competing),before);
});
test('transferts : tags filtrent les dépenses mais ne changent ni soldes, ni prévisions, ni audit',()=>{
 const m=scan(model()),before=engine.forecast(m,'2026-11-02','2026-12-31'),audit=engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-02',until:'2026-12-31'}));
 const accepted=transfers.accept(m,pending(m)[0].id);
 assert.deepEqual(engine.forecast(accepted,'2026-11-02','2026-12-31'),before);
 assert.equal(engine.auditCsv(engine.auditOperations(accepted,{scope:'all',at:'2026-11-02',until:'2026-12-31'})),audit);
 assert.equal(tags.withoutTag(accepted,accepted.rows,'transfert_intercomptes').length,0);
});
test('transferts : sauvegarde, import CSV après JSON et CLI préservent preuves, tags et ignorance',()=>{
 const m=scan(model()),c=pending(m)[0];
 for(const source of [m,transfers.ignore(m,c.id),transfers.accept(m,c.id)]){
  const saved=annotations.exportObject(source),restored=annotations.importInto(source,saved,tags);
  assert.deepEqual(restored.transferBacklog,source.transferBacklog);assert.equal(transfers.status(restored,c),transfers.status(source,c));
  const cli=engine.mergeAnnotations(engine.readCsv(initial),saved);assert.deepEqual(cli.transferBacklog,source.transferBacklog);assert.equal(transfers.status(cli,c),transfers.status(source,c));
 }
 const old=annotations.importInto(m,{notes:{},references:{}},tags);assert.deepEqual(old.transferBacklog,[]);
 const saved=annotations.exportObject(m);saved.transferBacklog=[{id:'cassé',evidence:[]}];const before=JSON.stringify(m);
 assert.throws(()=>annotations.importInto(m,saved,tags),/transfert/i);assert.equal(JSON.stringify(m),before);
});
test('transferts : même résultat Node et navigateur sans require',()=>{
 const context={TextEncoder};vm.createContext(context);
 for(const file of ['normalize','identity','engine','recurrences','transfers','tags','annotations'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),context);
 const browser=context.QBudgetTransfers.scan(context.QBudgetEngine.mergeAnnotations(context.QBudgetEngine.readCsv(initial),{}));
 assert.deepEqual(JSON.parse(JSON.stringify(browser)),scan(engine.mergeAnnotations(engine.readCsv(initial),{})));
});
