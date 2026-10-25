'use strict';
// Mode interactif de qbudget. Aucune écriture sur disque hors commande export explicite.
// Le moteur financier est le même que pour le CLI et l'interface HTML.
const fs=require('node:fs');
const readline=require('node:readline');
const engine=require('./engine.js');
const VERSION=require('../package.json').version;
const formatAmount=n=>Number.isFinite(n)?new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' €':'indisponible';
function dateOK(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v}
function addMonths(iso,count){const d=new Date(iso+'T12:00:00Z');const target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+Number(count),1,12));const day=Math.min(d.getUTCDate(),new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0,12)).getUTCDate());target.setUTCDate(day);return target.toISOString().slice(0,10)}
// Espaces, guillemets simples/doubles et échappements simples autorisés.
function words(line){const values=[];let word='',quote='',started=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='\\'&&i+1<line.length&&(quote==='"'||(!quote&&['"',"'",' ','\\'].includes(line[i+1])))){word+=line[++i];started=true;continue}if(quote){if(c===quote)quote='';else word+=c;started=true;continue}if(c==='"'||c==="'"){quote=c;started=true;continue}if(/\s/.test(c)){if(started){values.push(word);word='';started=false}continue}word+=c;started=true}if(quote)throw Error('Guillemet non fermé');if(started)values.push(word);return values}
function cloneOverrides(dict){return {rules:Object.fromEntries(Object.entries(dict).map(([k,v])=>[k,{...v}]))}}
function parseRuleChange(change){const m=String(change||'').match(/^([^:]+):amount=(-?\d+(?:[.,]\d+)?)$/);if(!m)throw Error('Format : ID:amount=-25');const amount=Number(m[2].replace(',','.'));if(!Number.isFinite(amount))throw Error('Montant invalide');return {id:m[1],amount}}
function start({csv,annotations,at,months,until,account='all',format='table',input=process.stdin,output=process.stdout}={}){
 if(!Number.isInteger(Number(months))||Number(months)<1||Number(months)>240)throw Error('months invalide (1..240)');
 const state={at,months:Number(months),fixedUntil:!!until,until:until||addMonths(at,Number(months)),account,format,overrides:{}};
 if(!dateOK(state.at)||!dateOK(state.until))throw Error('Date invalide');
 function load(){if(!fs.existsSync(csv))throw Error('CSV introuvable : '+csv);const rows=engine.readCsv(fs.readFileSync(csv,'utf8'));const ann=fs.existsSync(annotations)?JSON.parse(fs.readFileSync(annotations,'utf8')):{};return engine.mergeAnnotations(rows,ann)}
 let model=load();
 const out=s=>output.write(String(s)+'\n');
 const checkAccount=name=>{if(name==='all')return '';const known=new Set(model.rows.map(r=>r.bank));if(!known.has(name))throw Error('Compte inconnu : '+name);return name};
 const accountName=()=>checkAccount(state.account);
 function currentForecast(extra={}){const changes=cloneOverrides(state.overrides);for(const [id,fields] of Object.entries(extra.rules||{}))changes.rules[id]={...changes.rules[id],...fields};return engine.forecast(model,state.at,state.until,accountName(),changes)}
 function reportForecast(result){if(state.format==='json'){out(JSON.stringify(result,null,2));return}out(`Prévision ${result.account} · ${result.at} → ${result.until}`);out(`  Départ : ${formatAmount(result.opening)}   Fin : ${formatAmount(result.closing)}   Minimum : ${formatAmount(result.minimum)}`);out(`  Événements : ${result.events.length} (aucune suppression automatique)`)}
 function reportStatus(){out(`Fichiers : CSV=${csv}  annotations=${annotations}`);out(`${model.rows.length} opérations | ${Object.keys(model.rules||{}).length} règles | ${[...new Set(model.rows.map(r=>r.bank))].length} comptes`);out(`Sélection : compte=${state.account}  date=${state.at}  fin=${state.until}  mois=${state.months}  format=${state.format}`);const keys=Object.keys(state.overrides);out(keys.length?'Simulations temporaires : '+keys.map(id=>`${id}=${state.overrides[id].amount}`).join(', '):'Aucune simulation temporaire')}
 function rules(){for(const [id,r] of Object.entries(model.rules||{}))out(`${id}  ${r.desc||''}  ${r.frequency||'mensuel'}  ${formatAmount(state.overrides[id]?.amount??Number(r.amount))}  ${r.anchor||r.start||''}${r.end?' → '+r.end:''}`)}
 function help(){out(`qbudget v${VERSION} — REPL (en mémoire, aucun scénario sauvegardé)
  status                      Résumé des données et hypothèses actives
  accounts                    Comptes connus
  rules                       Récurrences et montants du scénario
  balance [DATE] [COMPTE]     Solde à une date (fin de journée)
  forecast                    Prévision selon les paramètres courants
  check                       Vérification des données
  set at YYYY-MM-DD           Date de référence
  set until YYYY-MM-DD        Date finale (incluse)
  set months N                Horizon en mois à partir de at
  set account COMPTE|all      Compte suivi (guillemets si espaces)
  set format table|json       Format des résultats
  set-rule ID:amount=-25      Modifier une règle en mémoire uniquement
  unset-rule ID               Annuler une modification
  compare ID -10 -20 -30     Comparer des montants de règle (sans les appliquer)
  reset                       Effacer les modifications de règles
  reload                      Relire CSV et annotations depuis les fichiers
  export actual|all FICHIER [JUSQU_A]  Export CSV déterministe explicite
  help                        Aide
  quit                        Quitter
Pour l'automatisation : qbudget forecast / balance / export / check.`)}
 function handle(line){const tokens=words(line.trim());if(!tokens.length||tokens[0].startsWith('#'))return true;const [cmd,...args]=tokens;
  switch(cmd.toLowerCase()){
   case 'quit':case 'exit':case 'q':return false;
   case 'help':case '?':help();break;
   case 'status':reportStatus();break;
   case 'accounts':out([...new Set(model.rows.map(r=>r.bank))].sort().join(', ')||'(aucun compte)');break;
   case 'rules':rules();break;
   case 'balance':{const at=args[0]||state.at;const account=args.length>=2?args.slice(1).join(' '):state.account;if(!dateOK(at))throw Error('Date invalide');const name=checkAccount(account);const balance=engine.totalBalance(model,at,name);if(state.format==='json')out(JSON.stringify({account:account,at,balance},null,2));else out(`${account} au ${at} : ${formatAmount(balance)}`);break}
   case 'forecast':reportForecast(currentForecast());break;
   case 'check':{const result=engine.check(model);if(state.format==='json')out(JSON.stringify(result,null,2));else{out(result.ok?'OK':'ÉCHEC');for(const e of result.errors)out('ERREUR: '+e);for(const w of result.warnings)out('ATTENTION: '+w)}break}
   case 'set':{const key=args[0],value=args.slice(1).join(' ');if(!key||!value)throw Error('Usage : set at|until|months|account|format VALEUR');switch(key){case 'at':case 'until':if(!dateOK(value))throw Error('Date invalide');state[key]=value;if(key==='at'&&!state.fixedUntil)state.until=addMonths(value,state.months);if(key==='until')state.fixedUntil=true;break;case 'months':{const n=Number(value);if(!Number.isInteger(n)||n<1||n>240)throw Error('Nombre de mois invalide (1..240)');state.months=n;state.until=addMonths(state.at,n);state.fixedUntil=false;break}case 'account':checkAccount(value);state.account=value;break;case 'format':if(!['json','table'].includes(value))throw Error('Format attendu : json ou table');state.format=value;break;default:throw Error('Paramètre inconnu : '+key)}out(`${key} = ${state[key]}`);break}
   case 'set-rule':{const {id,amount}=parseRuleChange(args.join(''));if(!model.rules[id])throw Error('Règle inconnue : '+id);state.overrides[id]={amount};out(`${id} = ${formatAmount(amount)} (temporaire)`);break}
   case 'unset-rule':if(!model.rules[args[0]])throw Error('Règle inconnue : '+args[0]);delete state.overrides[args[0]];out(`${args[0]} : valeur initiale rétablie`);break;
   case 'reset':state.overrides={};out('Toutes les hypothèses temporaires ont été effacées');break;
   case 'reload':model=load();state.overrides={};out(`Rechargement : ${model.rows.length} opérations, ${Object.keys(model.rules||{}).length} règles`);break;
   case 'compare':{if(args.length<2)throw Error('Usage : compare ID -10 -20 -30');const id=args[0];if(!model.rules[id])throw Error('Règle inconnue : '+id);const amounts=args.slice(1).map(v=>Number(v.trim().replace(',','.')));if(!amounts.length||amounts.some(v=>!Number.isFinite(v)))throw Error('Liste de montants invalides');const baseline=currentForecast();out(`Comparaison pour ${id} (référence : ${formatAmount(state.overrides[id]?.amount??Number(model.rules[id].amount))})`);out(`  Base  : fin=${formatAmount(baseline.closing)} min=${formatAmount(baseline.minimum)}`);for(const amount of amounts){const f=currentForecast({rules:{[id]:{amount}}});const delta=f.closing===null||baseline.closing===null?null:Math.round((f.closing-baseline.closing)*100)/100;out(`  ${formatAmount(amount)} : fin=${formatAmount(f.closing)} min=${formatAmount(f.minimum)} Δfin=${formatAmount(delta)}`)}break}
   case 'export':{const [scope,target,end]=args;if(!['actual','all'].includes(scope)||!target)throw Error('Usage : export actual|all FICHIER [DATE_FIN]');const date=end||state.until;if(!dateOK(date))throw Error('Date de fin invalide');const ops=engine.auditOperations(model,{scope,at:state.at,until:date,account:accountName(),overrides:cloneOverrides(state.overrides)});fs.writeFileSync(target,engine.auditCsv(ops),'utf8');out(`${ops.length} opérations exportées vers ${target}`);break}
   default:throw Error('Commande inconnue : '+cmd+'. Tape help');
  }return true;
 }
 out(`qbudget v${VERSION} · mode interactif (CSV et annotations chargés une fois)`);
 out(`${model.rows.length} opérations, ${Object.keys(model.rules||{}).length} récurrences. Tape help pour les commandes.`);
 const rl=readline.createInterface({input,output,terminal:!!input.isTTY&&!!output.isTTY,historySize:500});
 if(input.isTTY)rl.setPrompt('qbudget> ');
 rl.on('line',line=>{try{if(!handle(line)){rl.close();return}}catch(e){out('Erreur : '+e.message)}if(input.isTTY)rl.prompt()});
 if(input.isTTY)rl.prompt();
 return new Promise(resolve=>rl.on('close',()=>resolve()));
}
module.exports={start,words,addMonths,parseRuleChange};
