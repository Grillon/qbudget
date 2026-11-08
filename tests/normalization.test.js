'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const normalize=require('../src/normalize.js');
const engine=require('../src/engine.js');
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','banques.json'),'utf8'));
const root=path.resolve(__dirname,'..');
const fixtures=['bourso_exemple.csv','bps_exemple.csv','revolut_exemple.csv'];
const files=()=>fixtures.map(name=>({name,content:fs.readFileSync(path.join(__dirname,'fixtures',name))}));
function pythonCsv(inputs,custom=cfg){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-bank-'));
 try{
  const names=inputs.map((x,i)=>{const file=path.join(dir,x.name||`test${i}.csv`);fs.writeFileSync(file,x.content);return file});
  const c=path.join(dir,'banques.json'),output=path.join(dir,'out.csv');fs.writeFileSync(c,JSON.stringify(custom));
  const text=execFileSync('python3',['import_releves.py',...names,'-c',c,'-o',output],{cwd:root,encoding:'utf8'});
  assert.match(text,/OK/);
  return fs.readFileSync(output,'utf8');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('CSV normalisé du navigateur == CSV Python, octet pour octet pour les trois banques',async()=>{
 const input=files(),result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.csv,pythonCsv(input));assert.deepEqual(result.sources.map(s=>s.banque),['BoursoBank','BPS','Revolut']);
 assert.equal(result.rows.length,3);assert.equal(result.duplicates,0);
 assert.deepEqual(engine.readCsv(result.csv).map(x=>x.amount),[-23.45,100.5,-4.5]);
});
test('un débit BPS déjà négatif ne devient jamais un crédit',async()=>{
 const input=files().filter(x=>x.name==='bps_exemple.csv');
 input[0].content=Buffer.from(input[0].content.toString('utf8').replace(';0,00;100,50;', ';-50,25;0,00;'));
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows[0].montant,'-50.25');assert.equal(result.csv,pythonCsv(input));
});
test('opérations identiques : conservées avec 2 IDs différents et doublon potentiel oui',async()=>{
 const input=files().filter(x=>x.name==='bps_exemple.csv');
 const text=input[0].content.toString('utf8').trimEnd().split('\n');
 input[0].content=Buffer.from([...text,text[1]].join('\n')+'\n');
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows.length,2);assert.equal(result.duplicates,2);
 assert.notEqual(result.rows[0].id,result.rows[1].id);
 assert.deepEqual(result.rows.map(r=>r.doublon_potentiel),['oui','oui']);
 assert.equal(result.csv,pythonCsv(input));
 assert.equal(engine.readCsv(result.csv).length,2);
});
test('exports se chevauchant : rien ne disparaît ; mêmes lignes signalées',async()=>{
 const input=files().filter(x=>x.name==='revolut_exemple.csv');
 input.push({name:'revolut_other.csv',content:input[0].content});
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows.length,2);assert.equal(result.duplicates,2);assert.equal(result.csv,pythonCsv(input));
});
test('CSV quoté, description avec virgules et retour ligne et encodage Windows-1252',async()=>{
 const input=files().filter(x=>x.name==='revolut_exemple.csv');
 let data=input[0].content.toString('utf8').trimEnd();
 data=data.replace('Café,','"Café, bistrot\nParis",');
 // Le caractère accentué en cp1252 fait échouer UTF-8 fatal : décodage cp1252 attendu.
 input[0].content=Buffer.from(data.replace('é','\xE9'),'latin1');
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows[0].description,'Café, bistrot\nParis');assert.equal(result.csv,pythonCsv(input));
});
test('erreur sur une ligne : zéro import partiel, erreurs précises par fichier/ligne',async()=>{
 const input=files();input[1].content=Buffer.from(input[1].content.toString('utf8').replace('21/10/2026','31/02/2026'));
 await assert.rejects(normalize.normalizeFiles(input,cfg),err=>{
  assert.match(err.message,/interrompue/);assert.ok(err.details.some(d=>/bps_exemple.csv: ligne 2: date invalide/.test(d)));return true;
 });
});
test('configuration de sortie personnalisée et ordre des colonnes respectés',async()=>{
 const input=files().slice(0,1);const custom=structuredClone(cfg);
 custom.sortie={separateur:'|',decimal:'.',colonnes:[{champ:'montant',nom:'Valeur'},{champ:'description',nom:'Texte'},{champ:'date',nom:'Jour'}]};
 const result=await normalize.normalizeFiles(input,custom);
 assert.equal(result.csv,pythonCsv(input,custom));assert.match(result.csv,/Valeur\|Texte\|Jour/);
});
test('SHA-256 natif de repli = SHA-256 officiel, y compris avec Unicode et longue chaîne',()=>{
 for(const text of ['', 'abc', 'Café à Paris 🎵', 'x'.repeat(100000)])
  assert.equal(normalize.sha256Fallback(text),crypto.createHash('sha256').update(text).digest('hex'));
});
test('le navigateur utilise un module sans dépendance et des configurations embarquées cohérentes',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['rawCsv','normalizeRaw','importRaw','downloadNormalized','normalizationPreview','bankConfigFile','csv'])assert.match(html,new RegExp(`id="${id}"`));
 for(const file of ['src/bank-config.js','src/normalize.js'])assert.ok(html.includes(file));
 execFileSync('python3',['scripts/build-bank-config.py','--check'],{cwd:root});
 const sandbox={};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'src/bank-config.js'),'utf8'),sandbox);
 assert.deepEqual(JSON.parse(JSON.stringify(sandbox.QBudgetBankConfig)),cfg);
});
