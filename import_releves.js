#!/usr/bin/env node
'use strict';
// L’adaptateur CLI lit les fichiers ; src/normalize.js assure toute la normalisation.
const fs=require('node:fs/promises');
const path=require('node:path');
const {parseArgs}=require('node:util');
const normalize=require('./src/normalize.js');
const {version}=require('./package.json');

const HELP=`Importer des relevés CSV bancaires avec banques.json (Node.js natif).

Usage : node import_releves.js [options] bourso.csv bps.csv revolut.csv

  -c, --config FICHIER  Configuration (défaut : banques.json du projet)
  -o, --output FICHIER  Sortie (défaut : operations_normalisees.csv)
      --version         Afficher la version de qbudget
  -h, --help            Afficher cette aide
`;

async function main(args=process.argv.slice(2),io={stdout:process.stdout,stderr:process.stderr}){
 let options;
 try{
  options=parseArgs({args,allowPositionals:true,options:{
   config:{type:'string',short:'c',default:path.join(__dirname,'banques.json')},
   output:{type:'string',short:'o',default:'operations_normalisees.csv'},
   version:{type:'boolean'},help:{type:'boolean',short:'h'}
  }});
 }catch(error){io.stderr.write(error.message+'\n'+HELP);return 2}
 const {values,positionals}=options;
 if(values.help){io.stdout.write(HELP);return 0}
 if(values.version){io.stdout.write(version+'\n');return 0}
 if(!positionals.length){io.stderr.write('Sélectionne au moins un relevé CSV brut\n'+HELP);return 2}
 let settings;
 try{
  settings=JSON.parse(await fs.readFile(values.config,'utf8'));
  normalize.validateSettings(settings);
 }catch(error){io.stderr.write('Configuration invalide : '+error.message+'\n');return 1}
 const files=[],errors=[];
 for(const filename of positionals){
  try{files.push({name:path.basename(filename),content:await fs.readFile(filename)})}
  catch(error){errors.push(filename+': '+error.message)}
 }
 let result;
 if(files.length)try{result=await normalize.normalizeFiles(files,settings)}
 catch(error){errors.push(...(error.details||[error.message]))}
 if(errors.length){
  io.stderr.write('Erreurs détectées (aucun fichier écrit) :\n'+errors.map(error=>' - '+error+'\n').join(''));
  return 1;
 }
 try{await fs.writeFile(values.output,result.csv,'utf8')}
 catch(error){io.stderr.write('Écriture impossible : '+error.message+'\n');return 1}
 for(const source of result.sources)io.stdout.write(source.banque+': '+source.name+': '+source.count+' opérations lues\n');
 io.stdout.write('OK : '+result.rows.length+' opérations, '+result.duplicates+' signalées, sortie : '+values.output+'\n');
 return 0;
}
if(require.main===module)main().then(code=>{process.exitCode=code}).catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={main};
