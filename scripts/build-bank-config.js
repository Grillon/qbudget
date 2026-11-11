#!/usr/bin/env node
'use strict';
// Embarque banques.json pour les documents file://, sans fetch.
const fs=require('node:fs');
const path=require('node:path');
const {root,run}=require('./generated-file.js');
function content(){
 const data=JSON.parse(fs.readFileSync(path.join(root,'banques.json'),'utf8'));
 return '// Fichier généré depuis banques.json ; ne pas éditer directement.\n'+
  '(function(root){"use strict";root.QBudgetBankConfig='+JSON.stringify(data).replace(/</g,'\\u003c')+
  ';})(typeof globalThis!=="undefined"?globalThis:this);\n';
}
if(require.main===module)process.exitCode=run({filename:'src/bank-config.js',content,success:'Configuration bancaire navigateur / Node.js cohérente',generated:'Configuration navigateur générée'});
module.exports={content};
