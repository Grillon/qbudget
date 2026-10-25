#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const engine=require('./engine.js');
const [csv,json]=process.argv.slice(2);
if(!csv){console.error('Usage: node src/audit.js operations.csv [annotations.json]');process.exit(2)}
const input=engine.readCsv(fs.readFileSync(csv,'utf8'));
const ann=json&&fs.existsSync(json)?JSON.parse(fs.readFileSync(json,'utf8')):{};
const model=engine.mergeAnnotations(input,ann);
const byBank={};for(const r of model.rows){const key=r.bank||'inconnue';const b=byBank[key]??={csv:0,manuel:0,prevu:0,realise:0,somme:0};r.manual?b.manuel++:b.csv++;r.nature==='planned'?b.prevu++:b.realise++;b.somme+=r.amount}
console.log(JSON.stringify({lignesCSV:input.length,operationsFinales:model.rows.length,ajoutsManuels:model.rows.length-input.length,parBanque:byBank,identifiantsEnDouble:model.rows.length-new Set(model.rows.map(r=>r.id)).size},null,2));
