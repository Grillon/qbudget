'use strict';
// Vérification commune aux trois assets embarqués ; aucune dépendance externe.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run({filename,content,success,generated},args=process.argv.slice(2)){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage : node '+path.relative(root,process.argv[1])+' [--check]');return 0}
 if(args.some(arg=>arg!=='--check')||args.length>1){console.error('Option inconnue. Utiliser --check ou --help.');return 2}
 try{
  const target=path.join(root,filename),expected=content();
  if(args.includes('--check')){
   if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==expected){console.error('ERREUR : '+filename+' désynchronisé de ses sources');return 1}
   console.log(success);
  }else{fs.writeFileSync(target,expected,'utf8');console.log(generated)}
  return 0;
 }catch(error){console.error(error.message);return 1}
}
module.exports={root,run};
