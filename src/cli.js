#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const engine=require('./engine.js');
function usage(){console.log(`qbudget CLI (données locales JSON)
Usage:
  node src/cli.js check --data data.json [--json]
  node src/cli.js balance --data data.json --account BoursoBank --at 2026-10-25 [--json]
  node src/cli.js forecast --data data.json --account BoursoBank --at 2026-10-25 --until 2027-12-25 [--set-rule RULE_ID:amount=1200] [--json]

Pour préparer data.json : exporter les données locales depuis l'interface (bouton « Exporter les données CLI »).
Les simulations --set-rule ne sont jamais enregistrées.
`)}
function argsParse(args){const p={};for(let i=0;i<args.length;i++){const s=args[i];if(!s.startsWith('--'))throw Error('Argument inattendu: '+s);const k=s.slice(2);if(k==='json'){p.json=true;continue}if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Valeur manquante : '+s);if(k==='set-rule')(p[k]??=[]).push(args[++i]);else p[k]=args[++i]}return p}
function main(){const [cmd,...raw]=process.argv.slice(2);if(!cmd||['help','--help','-h'].includes(cmd)){usage();return}const p=argsParse(raw);if(!p.data)throw Error('--data obligatoire');const model=JSON.parse(fs.readFileSync(p.data,'utf8'));const overrides={rules:{}};
 for(const setting of p['set-rule']||[]){const match=setting.match(/^([^:]+):amount=(-?\d+(?:\.\d+)?)$/);if(!match)throw Error('Syntaxe attendue: --set-rule RULE_ID:amount=123');overrides.rules[match[1]]={amount:Number(match[2])}}
 let result;
 switch(cmd){case 'check':result=engine.check(model);break;
 case 'balance':if(!p.at)throw Error('--at obligatoire');result={account:p.account||'all',at:p.at,balance:engine.totalBalance(model,p.at,p.account||'')};break;
 case 'forecast':if(!p.at||!p.until)throw Error('--at et --until obligatoires');result=engine.forecast(model,p.at,p.until,p.account||'',overrides);break;
 default:throw Error('Commande inconnue: '+cmd)}
 if(p.json)console.log(JSON.stringify(result,null,2));else if(cmd==='check')console.log(result.ok?'OK':`ÉCHEC`,...result.errors.map(x=>'ERREUR: '+x),...result.warnings.map(x=>'ATTENTION: '+x));else if(cmd==='balance')console.log(`${result.account} au ${result.at} : ${result.balance===null?'solde indisponible':result.balance.toFixed(2)+' EUR'}`);else console.log(`${result.account} (${result.at} → ${result.until}) : ouverture=${result.opening}, clôture=${result.closing}, minimum=${result.minimum}, mouvements=${result.events.length}`);
 if(cmd==='check'&&!result.ok)process.exitCode=1;
}
try{main()}catch(err){console.error('Erreur:',err.message);process.exitCode=1}
