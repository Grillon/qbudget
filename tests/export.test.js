const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const eng=require('../src/engine.js');
const d=path.join(__dirname,'fixtures');
const model=eng.mergeAnnotations(eng.readCsv(fs.readFileSync(path.join(d,'life_2026_operations.csv'),'utf8')),JSON.parse(fs.readFileSync(path.join(d,'life_2026_annotations.json'),'utf8')));
const params={at:'2026-10-25',until:'2027-12-31'};
test('scope actual conserve les 92 opérations importées, 3 payées en perso et les deux tickets identiques',()=>{
 const r=eng.auditOperations(model,{...params,scope:'actual'});
 assert.equal(r.length,95);assert.equal(r.filter(x=>x.identifiant.startsWith('DEMO-PERSO-')).length,3);assert.equal(r.filter(x=>x.date==='2026-10-01'&&x.libelle==='Ticket métro'&&x.montant===-2.5).length,2);
});
test('all prolonge les récurrences trimestrielles et annuelles sans multiplier historique',()=>{
 const r=eng.auditOperations(model,{...params,scope:'all'});
 assert.equal(r.filter(x=>x.origine==='reel').length,95);assert.equal(r.filter(x=>x.identifiant.startsWith('DEMO-IK-')||x.identifiant.startsWith('DEMO-NDF-')).length,0);
 assert.ok(r.some(x=>x.origine==='recurrence'&&x.libelle==='Taxe foncière'));
 assert.ok(r.some(x=>x.origine==='recurrence'&&x.libelle==='Charges copro trimestrielles'));
 assert.equal(eng.auditCsv(r),eng.auditCsv(eng.auditOperations(model,{...params,scope:'all'})));
});
test('CLI CSV identique au moteur, fichiers sources inchangés',()=>{
 const input=path.join(d,'life_2026_operations.csv'), ann=path.join(d,'life_2026_annotations.json');
 const before=fs.readFileSync(ann);
 const result=execFileSync(process.execPath,['src/cli.js','export','--csv',input,'--annotations',ann,'--scope','all','--at',params.at,'--until',params.until],{encoding:'utf8',cwd:path.join(__dirname,'..')});
 assert.equal(result,eng.auditCsv(eng.auditOperations(model,{...params,scope:'all'})));
 assert.deepEqual(fs.readFileSync(ann),before);
});

test('export utilise la virgule décimale et le point-virgule CSV',()=>{
 const csv=eng.auditCsv([{date:'2026-10-01',compte:'BPS',libelle:'Test',montant:-12.5,devise:'EUR',origine:'reel',identifiant:'test',recurrence_id:''}]);
 assert.match(csv, /;-12,50;/);
 assert.ok(!csv.includes('-12.50'));
 assert.equal(csv.trim().split('\n')[0].split(';').length,8);
});
