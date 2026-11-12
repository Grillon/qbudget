'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/engine.js');
const transfers=require('../src/transfers.js');
const repl=require('../src/repl.js');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {PassThrough}=require('node:stream');
const csv='Date;Banque;Compte;Libellé;Montant;Devise\n';
const a='2026-11-01;BPS;Courant;A;-10;EUR\n';
const b='2026-11-02;BPS;Courant;B;-20;EUR\n';
const empty=()=>({rows:[],notes:{},references:{BPS:{date:'2026-11-11',balance:100}},rules:{}});
const reimport=(model,lines)=>engine.reimportBankRows(model,engine.readCsv(csv+lines));

test('rattacher une annotation entre identités conserve les notes futures de la source',()=>{
 let m=reimport(empty(),a+b);const [from,to]=m.rows.map(r=>r.id);
 m.notes[from]={tags:['déplacée']};m=reimport(m,b);
 m=engine.reassignAnnotation(m,from,to);
 assert.equal(m.bankIdentities.find(e=>e.id===to).aliases.includes(from),false);
 m=reimport(m,a+b);m.notes[from]={tags:['nouvelle source']};
 const restored=reimport(m,a+b);
 assert.deepEqual(restored.notes[from],{tags:['nouvelle source']});
 assert.deepEqual(restored.notes[to],{tags:['déplacée']});
 assert.equal(restored.bankIdentities.length,2);
});

test('un ancien alias concurrent ne détourne jamais une annotation bancaire',()=>{
 const m=reimport(empty(),a+b),[from,to]=m.rows.map(r=>r.id);
 m.bankIdentities.find(e=>e.id===to).aliases.push(from);m.notes[from]={tags:['source']};
 const restored=reimport(m,a+b);
 assert.deepEqual(restored.notes[from],{tags:['source']});
 assert.equal(restored.notes[to],undefined);
 assert.equal(restored.bankIdentities.find(e=>e.id===to).aliases.includes(from),false);
});

test('les échéances anciennes et les horizons dépassant 600 occurrences restent complets',()=>{
 const m=empty();m.rules={daily:{id:'daily',account:'BPS',desc:'Quotidien',amount:-1,frequency:'quotidien',anchor:'2020-01-31'}};
 const f=engine.forecast(m,'2026-11-11','2026-11-18');
 assert.equal(f.events.length,7);assert.equal(f.closing,93);
 assert.deepEqual(engine.auditOperations(m,{at:f.at,until:f.until}).map(r=>r.date),f.events.map(r=>r.date));
 assert.equal(engine.forecast(m,'2026-01-01','2028-01-01').events.length,730);
 m.rules.daily.frequency='mensuel';m.rules.daily.anchor='1900-01-31';
 assert.deepEqual(engine.forecast(m,'2026-01-31','2026-03-31').events.map(r=>r.date),['2026-02-28','2026-03-31']);
 m.rules.daily.end='2026-02-28';assert.equal(engine.forecast(m,'2026-01-31','2026-03-31').events.length,1);
});

test('dates impossibles rejetées dans CSV, références, règles et calculs publics',()=>{
 assert.throws(()=>engine.readCsv(csv+a.replace('2026-11-01','2026-02-30')),/invalide/i);
 const m=empty();m.references.BPS.date='2026-02-30';assert.equal(engine.check(m).ok,false);
 m.references.BPS.date='2026-02-28';m.rules.r={id:'r',account:'BPS',anchor:'2026-01-31',end:'2026-02-30',amount:-1};assert.equal(engine.check(m).ok,false);
 assert.throws(()=>engine.forecast(empty(),'2026-02-30','2026-03-31'),/date/i);
 assert.throws(()=>engine.shiftDate('2026-02-30','mensuel',1),/date/i);
 assert.equal(engine.shiftDate('2024-02-29','annuel',1),'2025-02-28');
});

test('les devises incompatibles rendent les soldes indisponibles et restent dans l’audit',()=>{
 const eur=reimport(empty(),a);assert.equal(engine.totalBalance(eur,'2026-11-11'),100);
 const mixed=reimport(empty(),a+b.replace('EUR','USD'));
 assert.equal(engine.totalBalance(mixed,'2026-11-11'),null);
 const result=engine.forecast(mixed,'2026-11-11','2026-12-01');
 assert.equal(result.opening,null);assert.equal(result.closing,null);
 assert.match(result.diagnostics.join(' '),/USD/);assert.match(engine.check(mixed).warnings.join(' '),/USD/);
 assert.deepEqual(engine.auditOperations(mixed,{scope:'actual',until:'2026-11-11'}).map(r=>r.devise),['EUR','USD']);
 const future=empty();future.rules.r={id:'r',account:'BPS',anchor:'2026-11-01',frequency:'mensuel',amount:20,currency:'USD'};
 assert.equal(engine.forecast(future,'2026-11-11','2026-12-11').closing,null);
 assert.equal(engine.auditOperations(future,{at:'2026-11-11',until:'2026-12-11'})[0].devise,'USD');
 const planned=empty();planned.rows=[{id:'planned',manual:true,bank:'BPS',nature:'planned',date:'2026-11-20',amount:20,currency:'USD'}];
 assert.equal(engine.totalBalance(planned,'2026-11-11'),100);
 assert.equal(engine.forecast(planned,'2026-11-11','2026-11-19').closing,100);
 assert.equal(engine.forecast(planned,'2026-11-11','2026-11-21').closing,null);
 planned.rows[0].date='2026-11-01';assert.equal(engine.forecast(planned,'2026-11-11','2026-11-21').closing,100);
 const separated={...mixed,accounts:['EUR seul'],excludedAccounts:['BPS'],references:{...mixed.references,'EUR seul':{date:'2026-11-11',balance:25}}};
 assert.equal(engine.totalBalance(separated,'2026-11-11'),25);assert.equal(engine.totalBalance(separated,'2026-11-11','BPS'),null);
});

test('un contexte de lecture compile les associations une fois et les lectures suivantes voient les mutations',()=>{
 const m=reimport(empty(),a+b);m.labelAssociations=[{tag:'A',patterns:['A']}];
 const context=engine.createReadContext(m),original=JSON.stringify;let count=0;
 JSON.stringify=function(value,...args){if(value===m.labelAssociations)count++;return original.call(this,value,...args)};
 try{for(let i=0;i<100;i++)assert.deepEqual(engine.tagsFor(m,m.rows[0],context),['A'])}finally{JSON.stringify=original}
 assert.equal(count,0);
 m.labelAssociations[0].patterns[0]='B';
 assert.deepEqual(engine.tagsFor(m,m.rows[0]),[]);
 assert.deepEqual(engine.tagsFor(m,m.rows[1],engine.createReadContext(m)),['A']);
});

test('statut transferts indexé conserve la priorité des lignes présentes et les modifications de tags',()=>{
 const m=reimport(empty(),a+b);const c={ignored:false,evidence:m.rows.map(r=>({...r}))};
 let context=engine.createReadContext(m);assert.equal(transfers.status(m,c,context),'pending');
 for(const r of m.rows)m.notes[r.id]={tags:['transfert_intercomptes']};
 context=engine.createReadContext(m);assert.equal(transfers.status(m,c,context),'validated');
 delete m.notes[m.rows[0].id];assert.equal(transfers.status(m,c,engine.createReadContext(m)),'pending');
});

test('REPL utilise les dates partagées et accepte les comptes configurés sans opération',async()=>{
 assert.equal(repl.addMonths,engine.addMonths);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-core-repl-'));
 try{
  const source=path.join(dir,'operations.csv'),annotations=path.join(dir,'annotations.json');
  fs.writeFileSync(source,csv+a);fs.writeFileSync(annotations,JSON.stringify({accounts:['Vide'],references:{Vide:{date:'2026-11-11',balance:7}}}));
  const input=new PassThrough(),output=new PassThrough();let result='';output.on('data',chunk=>result+=chunk);
  const complete=repl.start({csv:source,annotations,at:'2026-11-11',months:1,input,output});
  input.end('accounts\nset account Vide\nbalance\nset at 2026-02-30\nquit\n');await complete;
  assert.match(result,/BPS, Vide/);assert.match(result,/Vide au 2026-11-11 : 7,00/);assert.match(result,/Erreur : Date invalide/);assert.doesNotMatch(result,/Compte inconnu/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
