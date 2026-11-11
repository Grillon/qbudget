#!/usr/bin/env node
'use strict';
// Un seul déploiement Pages contient main à la racine et dev dans /dev/.
const fs=require('node:fs');
const path=require('node:path');

function copySite(source,target,preview=false){
 const html=fs.readFileSync(path.join(source,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1].replace(/^\.\//,''));
 for(const asset of new Set(['index.html',...scripts])){
  if(asset!=='index.html'&&!/^(?:plotly\.min\.js|src\/[A-Za-z0-9_.-]+\.js)$/.test(asset))throw Error('Asset non autorisé : '+asset);
  const input=path.join(source,asset),output=path.join(target,asset);
  if(fs.realpathSync(input)!==path.join(fs.realpathSync(source),asset))throw Error('Asset hors du site ou lien symbolique : '+asset);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  if(preview&&(asset==='index.html'||asset==='src/ui.js')){
   let text=fs.readFileSync(input,'utf8');
   text=text.replace(/(['"])qbudget-(mvp-1|layout-v1)\1/g,(_,quote,key)=>quote+'qbudget-dev-'+key+quote);
   if(asset==='index.html')text=text.replace(/<body\b[^>]*>/i,tag=>tag+'<aside style="padding:10px 20px;background:#fff3cd;color:#664d03" aria-label="Version de développement">Version de développement · données locales séparées · <a href="../">Version principale</a></aside>');
   fs.writeFileSync(output,text);
  }else fs.copyFileSync(input,output);
 }
}

function buildPages(main,dev,output){
 main=path.resolve(main);dev=path.resolve(dev);output=path.resolve(output);
 if(fs.existsSync(output))throw Error('Le dossier de publication existe déjà : '+output);
 for(const source of [main,dev])if(output===source||output.startsWith(source+path.sep))throw Error('La publication doit être hors des dossiers sources');
 copySite(main,output);
 copySite(dev,path.join(output,'dev'),true);
 fs.writeFileSync(path.join(output,'.nojekyll'),'');
}

if(require.main===module){
 const [main,dev,output]=process.argv.slice(2);
 if(!main||!dev||!output){console.error('Usage: node scripts/build-pages.js MAIN_DIR DEV_DIR OUTPUT_DIR');process.exitCode=1}
 else try{buildPages(main,dev,output)}catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={buildPages};
