'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const normalize=require('../src/normalize.js');
const engine=require('../src/engine.js');
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','banques.json'),'utf8'));
const root=path.resolve(__dirname,'..');
const fixtures=['bourso_exemple.csv','bps_exemple.csv','revolut_exemple.csv'];
const files=()=>fixtures.map(name=>({name,content:fs.readFileSync(path.join(__dirname,'fixtures',name))}));
function cliCsv(inputs,custom=cfg){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-bank-'));
 try{
  const names=inputs.map((x,i)=>{const file=path.join(dir,x.name||`test${i}.csv`);fs.writeFileSync(file,x.content);return file});
  const c=path.join(dir,'banques.json'),output=path.join(dir,'out.csv');fs.writeFileSync(c,JSON.stringify(custom));
  const text=execFileSync(process.execPath,['import_releves.js',...names,'-c',c,'-o',output],{cwd:root,encoding:'utf8'});
  assert.match(text,/OK/);
  return fs.readFileSync(output,'utf8');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('CSV normalisé du navigateur == CSV CLI Node, octet pour octet pour les trois banques',async()=>{
 const input=files(),result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.csv,cliCsv(input));assert.deepEqual(result.sources.map(s=>s.banque),['BoursoBank','BPS','Revolut']);
 assert.equal(result.rows.length,3);assert.equal(result.duplicates,0);
 assert.deepEqual(engine.readCsv(result.csv).map(x=>x.amount),[-23.45,100.5,-4.5]);
});
test('un débit BPS déjà négatif ne devient jamais un crédit',async()=>{
 const input=files().filter(x=>x.name==='bps_exemple.csv');
 input[0].content=Buffer.from(input[0].content.toString('utf8').replace(';0,00;100,50;', ';-50,25;0,00;'));
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows[0].montant,'-50.25');assert.equal(result.csv,cliCsv(input));
});
test('opérations identiques : conservées avec 2 IDs différents et doublon potentiel oui',async()=>{
 const input=files().filter(x=>x.name==='bps_exemple.csv');
 const text=input[0].content.toString('utf8').trimEnd().split('\n');
 input[0].content=Buffer.from([...text,text[1]].join('\n')+'\n');
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows.length,2);assert.equal(result.duplicates,2);
 assert.notEqual(result.rows[0].id,result.rows[1].id);
 assert.deepEqual(result.rows.map(r=>r.doublon_potentiel),['oui','oui']);
 assert.equal(result.csv,cliCsv(input));
 assert.equal(engine.readCsv(result.csv).length,2);
});
test('exports se chevauchant : rien ne disparaît ; mêmes lignes signalées',async()=>{
 const input=files().filter(x=>x.name==='revolut_exemple.csv');
 input.push({name:'revolut_other.csv',content:input[0].content});
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows.length,2);assert.equal(result.duplicates,2);assert.equal(result.csv,cliCsv(input));
});
test('CSV quoté, description avec virgules et retour ligne et encodage Windows-1252',async()=>{
 const input=files().filter(x=>x.name==='revolut_exemple.csv');
 let data=input[0].content.toString('utf8').trimEnd();
 data=data.replace('Café,','"Café, bistrot\nParis",');
 // Le caractère accentué en cp1252 fait échouer UTF-8 fatal : décodage cp1252 attendu.
 input[0].content=Buffer.from(data.replace('é','\xE9'),'latin1');
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows[0].description,'Café, bistrot\nParis');assert.equal(result.csv,cliCsv(input));
});
test('champ multiligne suivi d’une seconde opération : mêmes identifiants navigateur et importateur',async()=>{
 const input=files().filter(x=>x.name==='revolut_exemple.csv');
 const [header,record]=input[0].content.toString('utf8').trimEnd().split('\n');
 input[0].content=header+'\n'+record.replace('Café,','"Café\nParis",')+'\n'+record.replace('Café,','Boulangerie,')+'\n';
 const result=await normalize.normalizeFiles(input,cfg);
 assert.equal(result.rows.length,2);
 assert.equal(result.csv,cliCsv(input));
 assert.equal(result.rows.find(row=>row.description==='Boulangerie').id,'b2ea86e970a80c270134');
});
test('moteur navigateur sans require ni WebCrypto : BOM, CRLF, guillemets et IDs identiques au CLI',async()=>{
 const sandbox={TextEncoder,TextDecoder};
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/normalize.js'),'utf8'),sandbox);
 const input=files().filter(x=>x.name==='revolut_exemple.csv');
 const [header,record]=input[0].content.toString('utf8').trimEnd().split('\n');
 input[0].content='\ufeff'+header+'\r\n'+record.replace('Café,','"Café, ""Paris""\r\nFrance",')+'\r\n'+record.replace('Café,','Suite,')+'\r\n';
 const result=await sandbox.QBudgetNormalize.normalizeFiles(input,cfg);
 assert.equal(result.rows.length,2);
 assert.equal(result.rows.find(row=>row.description.startsWith('Café')).description,'Café, "Paris"\r\nFrance');
 assert.equal(result.csv,cliCsv(input));
});
test('lignes physiques : lignes vides et retours CR dans les champs conservent les diagnostics précis',async()=>{
 const input=files().filter(x=>x.name==='revolut_exemple.csv');
 const [header,record]=input[0].content.toString('utf8').trimEnd().split('\n');
 input[0].content='\r'+header+'\r'+record.replace('Café,','"Café\rParis",')+'\r'+record.replace('Café,-4.50,','Suite,incorrect,')+'\r';
 await assert.rejects(normalize.normalizeFiles(input,cfg),error=>{
  assert.match(error.details.join('\n'),/revolut_exemple.csv: ligne 5: montant invalide/);return true;
 });
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
 assert.equal(result.csv,cliCsv(input,custom));assert.match(result.csv,/Valeur\|Texte\|Jour/);
});
test('formats de date numériques configurables : résultats connus et parité navigateur / CLI',async()=>{
 const sandbox={TextEncoder,TextDecoder};
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/normalize.js'),'utf8'),sandbox);
 const examples=[
  ['%d-%m-%Y','22-10-2026','2026-10-22'],
  ['%Y/%m/%d','2026/10/22','2026-10-22'],
  ['%m/%d/%Y','10/22/2026','2026-10-22'],
  ['%Y%m%d','20261022','2026-10-22'],
  ['%d.%m.%Y','22.10.2026','2026-10-22'],
  ['%d/%m/%y','31/12/68','2068-12-31'],
  ['%d/%m/%y','01/01/69','1969-01-01'],
  ['%Y-%m-%d','2026-10-22T13:45:00Z','2026-10-22']
 ];
 for(const [format,value,expected] of examples){
  const custom=structuredClone(cfg);custom.banques.find(bank=>bank.nom==='Revolut').format_date=format;
  const input=files().filter(file=>file.name==='revolut_exemple.csv');
  input[0].content=input[0].content.toString('utf8').replaceAll('2026-10-22',value);
  const result=await sandbox.QBudgetNormalize.normalizeFiles(input,custom);
  assert.equal(result.rows[0].date,expected);
  assert.equal(result.csv,cliCsv(input,custom));
 }
 assert.equal(normalize.parseDate('9/2/2024','%d/%m/%Y'),'2024-02-09');
 assert.equal(normalize.parseDate('29.02.2000','%d.%m.%Y'),'2000-02-29');
});
test('formats numériques : calendrier invalide et directives non prises en charge refusés explicitement',async()=>{
 for(const [value,format] of [
  ['31-04-2026','%d-%m-%Y'],['20260229','%Y%m%d'],['29.02.1900','%d.%m.%Y'],
  ['13/22/2026','%m/%d/%Y'],['2026/00/22','%Y/%m/%d'],['0000/01/01','%Y/%m/%d'],
  ['1/1/6','%d/%m/%y'],['2026-10-22','%d/%m/%Y'],['22x10x2026','%d.%m.%Y']
 ])assert.throws(()=>normalize.parseDate(value,format),/date invalide/);
 for(const format of ['%d %b %Y','%G-%V-%u','%Y-%m-%d %H:%M:%S','%m/%d','%Y-%y-%m-%d','%Y-%m-%d%']){
  assert.throws(()=>normalize.parseDate('2026-10-22',format),/format_date non pris en charge/);
  const custom=structuredClone(cfg);custom.banques[0].format_date=format;
  await assert.rejects(normalize.normalizeFiles(files(),custom),/format_date non pris en charge/);
 }
});
test('SHA-256 natif de repli = SHA-256 officiel, y compris avec Unicode et longue chaîne',()=>{
 for(const text of ['', 'abc', 'Café à Paris 🎵', 'x'.repeat(100000)])
  assert.equal(normalize.sha256Fallback(text),crypto.createHash('sha256').update(text).digest('hex'));
});
test('le navigateur utilise un module sans dépendance et des configurations embarquées cohérentes',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['rawCsv','normalizeRaw','importRaw','downloadNormalized','normalizationPreview','bankConfigFile','csv'])assert.match(html,new RegExp(`id="${id}"`));
 for(const file of ['src/bank-config.js','src/normalize.js'])assert.ok(html.includes(file));
 execFileSync(process.execPath,['scripts/build-bank-config.js','--check'],{cwd:root});
 const sandbox={};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'src/bank-config.js'),'utf8'),sandbox);
 assert.deepEqual(JSON.parse(JSON.stringify(sandbox.QBudgetBankConfig)),cfg);
});
