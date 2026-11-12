'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/engine.js');
const annotations=require('../src/annotations.js');
const tags=require('../src/tags.js');
const header='Date;Banque;Compte;Libellé;Montant;Devise;Identifiant;Référence bancaire\n';
const row=ref=>`2026-11-01;BPS;Courant;Courses;-25,00;EUR;;${ref||''}`;
const salary='2026-11-02;BPS;Courant;Salaire;1000,00;EUR;;salaire';
const csv=(...rows)=>header+rows.join('\n');
const deferred=(m,text)=>engine.reimportBankRows(m,engine.readCsv(text),()=> 'defer');
function original(){
 const m=engine.mergeAnnotations(engine.readCsv(csv(row('A'),row('B'),salary)),{});
 m.references={BPS:{date:'2026-11-03',balance:2000}};
 m.notes[m.rows[0].id]={tags:['premier'],ruleId:'r',extra:{x:1}};
 m.notes[m.rows[1].id]={tags:['second']};
 return m;
}

test('backlog : import complet sans interruption, aucune attribution incertaine et montants inchangés',()=>{
 const m=original(),before=JSON.stringify(m);
 const imported=deferred(m,csv(row(),salary,row()));
 assert.equal(imported.rows.length,3);assert.equal(engine.pendingBankMatches(imported).length,2);
 for(const r of imported.rows.filter(r=>r.desc==='Courses'))assert.deepEqual(engine.manualTagsFor(imported,r),[]);
 assert.equal(engine.totalBalance(imported,'2026-11-03'),2000);
 assert.deepEqual(engine.forecast(imported,'2026-11-03','2026-12-03'),engine.forecast(m,'2026-11-03','2026-12-03'));
 assert.deepEqual(imported.notes,m.notes);assert.equal(JSON.stringify(m),before);
});

test('backlog : rattachement après import, identité historique et note complète récupérées',()=>{
 const m=original(),imported=deferred(m,csv(row(),row(),salary));
 const pending=engine.pendingBankMatches(imported),target=m.rows[1].id;
 const resolved=engine.resolveBankMatch(imported,pending[0].id,target);
 assert.equal(engine.pendingBankMatches(resolved).length,1);
 assert.deepEqual(resolved.notes[target],m.notes[target]);assert.ok(resolved.rows.some(r=>r.id===target));
 assert.equal(resolved.rows.length,imported.rows.length);
 const audit=m=>engine.auditOperations(m,{scope:'actual',until:'2026-12-03'}).map(({identifiant,...rest})=>rest);
 assert.deepEqual(audit(resolved),audit(imported));
 assert.ok(!engine.pendingBankMatches(resolved)[0].candidates.some(c=>c.id===target));
});

test('backlog : confirmer une opération distincte garde son identité et ses annotations',()=>{
 const m=deferred(original(),csv(row(),salary)),pending=engine.pendingBankMatches(m)[0];
 m.notes[pending.id]={tags:['nouveau']};
 const resolved=engine.resolveBankMatch(m,pending.id,'new');
 assert.equal(engine.pendingBankMatches(resolved).length,0);
 assert.deepEqual(resolved.rows,m.rows);assert.deepEqual(resolved.notes,m.notes);
});

test('backlog : conflit d’annotations et double utilisation d’une identité refusés atomiquement',()=>{
 const old=original(),m=deferred(old,csv(row(),row(),salary));
 const first=engine.pendingBankMatches(m)[0];m.notes[first.id]={tags:['ajout manuel']};
 const before=JSON.stringify(m);
 assert.throws(()=>engine.resolveBankMatch(m,first.id,old.rows[0].id),/conflit/i);assert.equal(JSON.stringify(m),before);
 delete m.notes[first.id];
 const resolved=engine.resolveBankMatch(m,first.id,old.rows[0].id);
 const next=engine.pendingBankMatches(resolved)[0],snapshot=JSON.stringify(resolved);
 assert.throws(()=>engine.resolveBankMatch(resolved,next.id,old.rows[0].id),/déjà|invalide|indisponible/i);
 assert.equal(JSON.stringify(resolved),snapshot);
});

test('backlog : sauvegarde, rechargement et import partiel conservent les dossiers et les notes utiles',()=>{
 const m=deferred(original(),csv(row(),row(),salary));
 const saved=JSON.parse(annotations.exportJson(m));
 const restored=annotations.importInto(m,saved,tags);
 assert.deepEqual(engine.pendingBankMatches(restored),engine.pendingBankMatches(m));
 const empty=annotations.importInto({rows:[],notes:{},references:{}},saved,tags);
 assert.equal(engine.pendingBankMatches(empty).length,2);
 const pending=engine.pendingBankMatches(m)[0];m.notes[pending.id]={tags:['à garder']};
 const partial=deferred(m,csv(salary));
 const preserved=engine.pendingBankMatches(partial).find(p=>p.id===pending.id);
 assert.ok(preserved);assert.equal(preserved.present,false);assert.deepEqual(partial.notes[pending.id],{tags:['à garder']});
});

test('backlog : réimports répétés n’accumulent pas les dossiers provisoires sans annotations',()=>{
 let m=deferred(original(),csv(row(),row(),salary));
 for(let i=0;i<4;i++)m=deferred(m,csv(row(),salary,row()));
 assert.equal(engine.pendingBankMatches(m).length,2);
 assert.equal(m.bankIdentities.length,5);
});

test('backlog : migration d’un compte source inconnu reportée, résolution après import sans perte',()=>{
 const old={rows:[{id:'ancien',bank:'BPS',account:'BPS',desc:'Courses',date:'2026-11-01',amount:-25}],notes:{ancien:{tags:['historique']}},references:{},rules:{}};
 const m=deferred(old,csv(row(),row().replace('Courant','Épargne')));
 assert.equal(m.rows.length,2);assert.equal(engine.pendingBankMatches(m).length,2);
 const first=engine.pendingBankMatches(m).find(p=>p.row.sourceAccount==='Courant');
 const target=first.candidates.find(c=>c.note.tags?.includes('historique'));
 const resolved=engine.resolveBankMatch(m,first.id,target.id);
 assert.deepEqual(engine.manualTagsFor(resolved,resolved.rows.find(r=>r.sourceAccount==='Courant')),['historique']);
 assert.deepEqual(engine.manualTagsFor(resolved,resolved.rows.find(r=>r.sourceAccount==='Épargne')),[]);
});

test('backlog : opérations flottantes, associations et mode CLI strict préservés',()=>{
 const m=original();m.rows.push({id:'manuel',manual:true,date:null,bank:'BPS',amount:-8,desc:'Courses',nature:'planned'});m.notes.manuel={tags:['IK']};
 m.labelAssociations=[{tag:'achats',patterns:['Courses']}];
 const imported=deferred(m,csv(row(),row(),salary));
 assert.equal(imported.rows.find(r=>r.manual).id,'manuel');assert.deepEqual(imported.notes.manuel,{tags:['IK']});
 for(const p of engine.pendingBankMatches(imported))assert.deepEqual(engine.tagsFor(imported,p.row),['achats']);
 assert.throws(()=>engine.reimportBankRows(m,engine.readCsv(csv(row(),row()))),/ambigu/i);
});

test('backlog : ancienne identité provisoire reconnue après résolution et suffixe jamais réattribué',()=>{
 const old=original(),m=deferred(old,csv(row(),row(),salary));
 const pending=engine.pendingBankMatches(m)[0],target=old.rows[1].id;
 const resolved=engine.resolveBankMatch(m,pending.id,target);
 const line=row().split(';');line[6]=pending.id;
 const restored=engine.mergeAnnotations(engine.readCsv(csv(line.join(';'))),annotations.exportObject(resolved));
 assert.equal(restored.rows[0].id,target);assert.deepEqual(restored.notes[target],old.notes[target]);
 const next=deferred(resolved,csv(row(),row(),salary));
 assert.ok(!next.rows.some(r=>r.id===pending.id));
});

test('backlog : doublons au premier import et registre invalide, sans fausse association',()=>{
 const m=deferred({rows:[],notes:{},references:{},rules:{}},csv(row(),row(),salary));
 assert.equal(m.rows.length,3);assert.equal(engine.pendingBankMatches(m).length,2);
 const saved=annotations.exportObject(m);saved.bankIdentities.find(e=>e.pendingMatch).pendingMatch.candidates='invalide';
 const before=JSON.stringify(m);
 assert.throws(()=>annotations.importInto(m,saved,tags),/invalide/i);assert.equal(JSON.stringify(m),before);
});
