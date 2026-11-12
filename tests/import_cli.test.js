'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const importer=path.join(root,'import_releves.js');
const fixtures=path.join(__dirname,'fixtures');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'banques.json'),'utf8'));
function run(args,cwd=root){
 const result=spawnSync(process.execPath,[importer,...args],{cwd,encoding:'utf8'});
 if(result.error)throw result.error;
 return result;
}
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-import-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir}
test('import CLI : configuration par défaut indépendante du dossier courant et sortie par défaut',t=>{
 const dir=temporary(t),result=run([path.join(fixtures,'bps_exemple.csv')],dir);
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/BPS: bps_exemple.csv: 1 opérations lues/);
 assert.match(result.stdout,/OK : 1 opérations, 0 signalées/);
 const output=fs.readFileSync(path.join(dir,'operations_normalisees.csv'),'utf8');
 assert.match(output,/100,50;EUR/);
});
test('import CLI : options longues, configuration de sortie personnalisée et décimales exactes',t=>{
 const dir=temporary(t),config=path.join(dir,'config.json'),output=path.join(dir,'résultat.csv');
 const custom=structuredClone(cfg);
 custom.sortie={separateur:'|',decimal:'.',colonnes:[{champ:'montant',nom:'Valeur'},'description','date']};
 fs.writeFileSync(config,JSON.stringify(custom));
 const input=path.join(dir,'revolut.csv');
 fs.writeFileSync(input,fs.readFileSync(path.join(fixtures,'revolut_exemple.csv'),'utf8').replace('Café,-4.50,','Café,-9007199254740993.05,'));
 const result=run(['--config='+config,'--output',output,input]);
 assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(output,'utf8'),'Valeur|description|date\r\n-9007199254740993.05|Café|2026-10-22\r\n');
});
test('import CLI : plusieurs erreurs détaillées, sortie existante conservée et aucune sortie partielle',t=>{
 const dir=temporary(t),output=path.join(dir,'operations.csv'),invalid=path.join(dir,'incorrect.csv');
 fs.writeFileSync(output,'sortie à préserver');
 fs.writeFileSync(invalid,fs.readFileSync(path.join(fixtures,'bps_exemple.csv'),'utf8').replace('21/10/2026','31/02/2026'));
 const result=run([path.join(fixtures,'bourso_exemple.csv'),invalid,path.join(dir,'absent.csv'),'-o',output]);
 assert.equal(result.status,1);
 assert.match(result.stderr,/aucun fichier écrit/);
 assert.match(result.stderr,/incorrect.csv: ligne 2: date invalide/);
 assert.match(result.stderr,/absent.csv/);
 assert.equal(fs.readFileSync(output,'utf8'),'sortie à préserver');
 fs.rmSync(output);
 assert.equal(run([invalid,'-o',output]).status,1);
 assert.equal(fs.existsSync(output),false);
});
test('import CLI : configuration invalide, aide, version et erreurs d’arguments',t=>{
 const dir=temporary(t),config=path.join(dir,'config.json'),input=path.join(fixtures,'bps_exemple.csv'),output=path.join(dir,'out.csv');
 fs.writeFileSync(config,JSON.stringify({...cfg,sortie:{separateur:''}}));
 const invalid=run([input,'-c',config,'-o',output]);
 assert.equal(invalid.status,1);assert.match(invalid.stderr,/Configuration invalide.*sortie.separateur/);
 assert.equal(fs.existsSync(output),false);
 assert.equal(run(['--help']).status,0);assert.match(run(['-h']).stdout,/--config/);
 assert.equal(run(['--version']).stdout.trim(),require('../package.json').version);
 for(const args of [[],['--unknown'],['-c'],['--output']])assert.equal(run(args).status,2);
});
test('import CLI : erreur d’écriture signalée sans trace interne',t=>{
 const dir=temporary(t),result=run([path.join(fixtures,'bps_exemple.csv'),'-o',path.join(dir,'absent','out.csv')]);
 assert.equal(result.status,1);assert.match(result.stderr,/Écriture impossible/);assert.doesNotMatch(result.stderr,/\n\s+at /);
});
