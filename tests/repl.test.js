'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const engine=require('../src/engine.js');
const repl=require('../src/repl.js');
const root=path.resolve(__dirname,'..');
const csv=path.join(root,'tests/fixtures/life_2026_operations.csv');
const annotations=path.join(root,'tests/fixtures/life_2026_annotations.json');
const args=['src/cli.js','repl','--csv',csv,'--annotations',annotations,'--at','2026-10-25','--months','2'];
function execute(input,argv=args,cwd=root){
 const result=spawnSync(process.execPath,argv,{cwd,input,encoding:'utf8',timeout:15000});
 if(result.error)throw result.error;
 assert.equal(result.status,0,`stderr=${result.stderr}\nstdout=${result.stdout}`);
 return result.stdout;
}

test('REPL : mêmes 92 opérations et 12 règles, vérification de soldes',()=>{
 const out=execute('status\naccounts\nbalance 2026-10-25\nforecast\nquit\n');
 assert.match(out,/92 opérations \| 12 règles/);
 assert.match(out,/BPS, BoursoBank, Revolut/);
 assert.match(out,/all au 2026-10-25 : 4[^\n]*120,00/);
 assert.match(out,/Prévision all · 2026-10-25 → 2026-12-25/);
});

test('REPL : compare temporaire ne modifie pas le modèle ni les fichiers',()=>{
 const before=fs.readFileSync(annotations,'utf8');
 const out=execute('forecast\ncompare r_netflix -16 -20 -25\nforecast\nset-rule r_netflix:amount=-25\nforecast\nreset\nforecast\nquit\n');
 const finals=[...out.matchAll(/Fin : ([^\n]+?)   Minimum/g)].map(m=>m[1]);
 assert.equal(finals.length,4,out);
 assert.equal(finals[0],finals[1]);
 assert.notEqual(finals[1],finals[2]);
 assert.equal(finals[0],finals[3]);
 assert.match(out,/Δfin=/);
 assert.equal(fs.readFileSync(annotations,'utf8'),before);
});

test('REPL : export identique au CLI et aucune déduplication',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-repl-'));
 try{
  const dest=path.join(d,'actual.csv');
  const out=execute(`export actual "${dest}" 2026-10-25\nquit\n`);
  assert.match(out,/92 opérations exportées/);
  const model=engine.mergeAnnotations(engine.readCsv(fs.readFileSync(csv,'utf8')),JSON.parse(fs.readFileSync(annotations,'utf8')));
  const expected=engine.auditCsv(engine.auditOperations(model,{scope:'actual',until:'2026-10-25'}));
  assert.equal(fs.readFileSync(dest,'utf8'),expected);
  assert.equal(expected.trim().split('\n').length,93);
 }finally{fs.rmSync(d,{recursive:true,force:true})}
});

test('REPL : erreurs non fatales et montants avec virgule',()=>{
 const out=execute('set-rule r_netflix:amount=-20,50\nset account BanqueInconnue\nstatus\nquit\n');
 assert.match(out,/r_netflix = -20,50/);
 assert.match(out,/Erreur : Compte inconnu/);
 assert.match(out,/Simulations temporaires : r_netflix=-20\.5/);
});

test('CLI sans arguments non interactif reste un forecast configuré par .env',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-env-'));
 try{
  fs.writeFileSync(path.join(dir,'.env'),[
   `QBUDGET_CSV=${csv}`,`QBUDGET_ANNOTATIONS=${annotations}`,
   'QBUDGET_MONTHS=2','QBUDGET_AT=2026-10-25','QBUDGET_FORMAT=json'
  ].join('\n'));
  const text=execute('',[path.join(root,'src/cli.js')],dir);
  const result=JSON.parse(text);
  assert.equal(result.at,'2026-10-25');assert.equal(result.until,'2026-12-25');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('analyse des commandes saisies au REPL',()=>{
 assert.deepEqual(repl.words('balance 2026-10-25 "Compte personnel"'),['balance','2026-10-25','Compte personnel']);
 assert.deepEqual(repl.parseRuleChange('r_netflix:amount=-20,50'),{id:'r_netflix',amount:-20.5});
 assert.equal(repl.addMonths('2026-10-25',2),'2026-12-25');
});
