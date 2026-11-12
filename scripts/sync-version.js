#!/usr/bin/env node
'use strict';
// package.json est la source unique du numéro de distribution.
const fs=require('node:fs');
const path=require('node:path');
const {root,run}=require('./generated-file.js');
function content(){
 const {version}=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 if(typeof version!=='string'||!version)throw Error('Version absente de package.json');
 return '// Fichier généré par scripts/sync-version.js depuis package.json.\n'+
  '(function(root){\'use strict\';const meta=Object.freeze({version:'+JSON.stringify(version)+'});'+
  'if(typeof module===\'object\'&&module.exports)module.exports=meta;'+
  'root.QBudgetVersion=meta;})(typeof globalThis!==\'undefined\'?globalThis:this);\n';
}
if(require.main===module)process.exitCode=run({filename:'src/version.js',content,success:'Version navigateur et package.json cohérentes',generated:'Version synchronisée'});
module.exports={content};
