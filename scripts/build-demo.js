#!/usr/bin/env node
'use strict';
// Construit la démonstration à partir des mêmes fixtures que les tests.
const fs=require('node:fs');
const path=require('node:path');
const {root,run}=require('./generated-file.js');
function content(){
 const fixtures=path.join(root,'tests','fixtures');
 const csv=fs.readFileSync(path.join(fixtures,'life_2026_operations.csv'),'utf8');
 const annotations=JSON.parse(fs.readFileSync(path.join(fixtures,'life_2026_annotations.json'),'utf8'));
 const dataset={csv,annotations,asof:'2026-10-25',until:'2026-11-30'};
 return '// Démo synthétique générée par scripts/build-demo.js (source : fixtures des tests).\n'+
  '(function(root){"use strict";root.QBudgetDemo='+JSON.stringify(dataset)+';})(typeof globalThis!=="undefined"?globalThis:this);\n';
}
if(require.main===module)process.exitCode=run({filename:'src/demo.js',content,success:'Démonstration et fixtures cohérentes',generated:'Démonstration synchronisée'});
module.exports={content};
