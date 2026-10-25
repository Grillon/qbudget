#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const engine=require('./engine.js');
const VERSION=require('../package.json').version;
function usage(){console.log(`qbudget v${VERSION} — CLI local (CSV normalisé + annotations JSON)
Usage:
  qbudget [forecast] [--csv PATH] [--annotations PATH] [--months N] [--at YYYY-MM-DD] [--account NAME] [--json]
  qbudget balance --at YYYY-MM-DD [--account NAME] [--json]
  qbudget check [--json]\n  qbudget export --scope actual|all --at YYYY-MM-DD --until YYYY-MM-DD -o resultat.csv
  qbudget forecast --set-rule RULE_ID:amount=-35 [--months 14]
  qbudget --version
  qbudget --help
Configuration : .env local, arguments prioritaires. Les scénarios CLI ne sont pas sauvegardés.`)}
function parseArgs(argv){let command='forecast';if(argv[0]&&!argv[0].startsWith('-'))command=argv.shift();const opts={};for(let i=0;i<argv.length;i++){const s=argv[i];if(s==='--json'){opts.json=true;continue}if(s==='--help'||s==='-h'){opts.help=true;continue}if(s==='--version'||s==='-V'){opts.version=true;continue}if(s==='-o'){const val=argv[++i];if(!val||val.startsWith('-'))throw Error('Valeur manquante : -o');opts.output=val;continue}if(!s.startsWith('--'))throw Error('Argument inattendu: '+s);const name=s.slice(2);if(!['csv','annotations','months','at','until','account','format','set-rule','scope','output'].includes(name))throw Error('Option inconnue : '+s);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw Error('Valeur manquante : '+s);if(name==='set-rule')(opts[name]??=[]).push(value);else opts[name]=value}return {command,opts}}
function envRead(filepath){if(!fs.existsSync(filepath))return {};const env={};for(const line of fs.readFileSync(filepath,'utf8').split(/\r?\n/)){const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(!match)continue;let v=match[2];if((v[0]==='"'&&v.at(-1)==='"')||(v[0]==="'"&&v.at(-1)==="'"))v=v.slice(1,-1);env[match[1]]=v}return env}
function main(argv=process.argv.slice(2)){const {command,opts}=parseArgs([...argv]);if(opts.version||command==='version'){console.log(VERSION);return}if(opts.help||command==='help'){usage();return}
 const home=process.cwd(),env=envRead(path.join(home,'.env'));const setting=(key,fallback)=>opts[key]??env['QBUDGET_'+key.toUpperCase()]??fallback;
 const csv=setting('csv','./data/operations.csv'),annotations=setting('annotations','./data/annotations.json');
 const months=Number(setting('months',14));if(!Number.isInteger(months)||months<1||months>240)throw Error('--months doit être un entier entre 1 et 240');
 const account=setting('account','all'),fmt=opts.json?'json':setting('format','table');if(!['json','table'].includes(fmt))throw Error('Format attendu : json ou table');
 if(!fs.existsSync(csv))throw Error('CSV introuvable : '+csv);
 const rows=engine.readCsv(fs.readFileSync(csv,'utf8'));
 const ann=fs.existsSync(annotations)?JSON.parse(fs.readFileSync(annotations,'utf8')):{};
 const model=engine.mergeAnnotations(rows,ann);
 const at=setting('at',new Date().toISOString().slice(0,10));if(!/^\d{4}-\d{2}-\d{2}$/.test(at))throw Error('Date --at invalide');
 const end=new Date(at+'T12:00:00');end.setMonth(end.getMonth()+months);const until=opts.until||end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0');
 const overrides={rules:{}};for(const change of opts['set-rule']||[]){const match=change.match(/^([^:]+):amount=(-?\d+(?:\.\d+)?)$/);if(!match)throw Error('Syntaxe : --set-rule RULE_ID:amount=-35');overrides.rules[match[1]]={amount:Number(match[2])}}
 if(command==='export'){const scope=opts.scope||'all';const records=engine.auditOperations(model,{scope,at,until,account:account==='all'?'':account,overrides});const csvText=engine.auditCsv(records);const target=opts.output;if(target){fs.writeFileSync(target,csvText,'utf8');console.log(`Export : ${records.length} opérations → ${target}`)}else process.stdout.write(csvText);return}
 let result;switch(command){case 'check':result=engine.check(model);break;case 'balance':result={account,at,balance:engine.totalBalance(model,at,account==='all'?'':account)};break;case 'forecast':result=engine.forecast(model,at,until,account==='all'?'':account,overrides);break;default:throw Error('Commande inconnue: '+command)}
 if(fmt==='json')console.log(JSON.stringify(result,null,2));else if(command==='check'){console.log(result.ok?'OK':'ÉCHEC');for(const s of result.errors)console.log('ERREUR:',s);for(const s of result.warnings)console.log('ATTENTION:',s)}else if(command==='balance')console.log(`${account} au ${at} : ${result.balance===null?'solde indisponible':result.balance.toFixed(2)+' EUR'}`);else console.log(`${result.account} (${result.at} → ${result.until}) : ouverture=${result.opening}, clôture=${result.closing}, minimum=${result.minimum}, mouvements=${result.events.length}`);
 if(command==='check'&&!result.ok)process.exitCode=1;
}
if(require.main===module){try{main()}catch(e){console.error('Erreur:',e.message);process.exitCode=1}}
module.exports={main,envRead,parseArgs};
