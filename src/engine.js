(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.QBudgetEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00'));
function dateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function asDate(s){return new Date(s+'T12:00:00')}

function parseCsv(src,sep){let rows=[],row=[],field='',quoted=false;for(let i=0;i<src.length;i++){const c=src[i];if(quoted){if(c==='"'&&src[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===sep){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}else field+=c}if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}return rows}
function readCsv(raw){raw=raw.replace(/^\ufeff/,'');const first=raw.split(/\r?\n/,1)[0],sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';const cells=parseCsv(raw,sep);if(cells.length<2)throw Error('Fichier vide');const heads=cells.shift().map(x=>x.trim().toLowerCase());const get=(r,n)=>r[heads.indexOf(n)]||'';for(const col of ['date','banque','libellé','montant'])if(!heads.includes(col))throw Error('Colonne absente : '+col);return cells.filter(r=>r.some(x=>x.trim())).map((r,i)=>{const date=get(r,'date'),rawAmount=get(r,'montant').replace(/\s/g,'').replace(',','.'),montant=Number(rawAmount);if(!validDate(date)||rawAmount===''||!Number.isFinite(montant))throw Error('Date ou montant invalide, ligne '+(i+2));const bank=get(r,'banque').trim(),account=bank,desc=get(r,'libellé');const signature=get(r,'identifiant')||`${bank}|${account}|${date}|${desc}|${montant}|${i}`;return {id:`${signature}|${i}`,bank,account,date,desc,currency:get(r,'devise')||'EUR',amount:montant,balance:null,category:get(r,'catégorie'),duplicate:get(r,'doublon potentiel')}})}
function mergeAnnotations(rows,annotations={}){if(!annotations||typeof annotations!=='object'||Array.isArray(annotations))throw Error('Annotations JSON invalides');const result={rows:[...rows],notes:annotations.notes||{},references:annotations.references||{},rules:annotations.rules||{},accounts:annotations.accounts||[],excludedAccounts:annotations.excludedAccounts||[]};for(const row of annotations.manualRows||[]){if(!result.rows.some(r=>r.id===row.id))result.rows.push({...row})}return result}

// A pending operation is intentionally without date; it is never a cash movement.
function isFloating(row){return row.date===null||row.date===undefined||row.date===''}
function accountNames(model){return [...new Set([...(model.accounts||[]),...Object.keys(model.references||{}),...(model.rows||[]).map(r=>r.bank).filter(Boolean)])].sort()}
function cashAccountNames(model){return [...new Set([...(model.accounts||[]),...Object.keys(model.references||{}),...(model.rows||[]).filter(r=>!isFloating(r)).map(r=>r.bank).filter(Boolean)])].sort()}
// An excluded account is still a real account, searchable and independently forecast.
// Only implicit global calculations omit it. Audit exports remain exhaustive.
function includedAccountNames(model){const excluded=new Set(model.excludedAccounts||[]);return cashAccountNames(model).filter(name=>!excluded.has(name))}
function excludedAccountNames(model){const excluded=new Set(model.excludedAccounts||[]);return cashAccountNames(model).filter(name=>excluded.has(name))}
function tagsFor(model,row){const note=model.notes?.[row.id]||{};return [...new Set([...(Array.isArray(note.tags)?note.tags:[]),...(typeof note.tag==='string'?note.tag.split(','):[])].map(t=>String(t).trim()).filter(Boolean))]}
function pendingOperations(model,{account='',tags=[],mode='all',search=''}={}){
 if(!['all','any'].includes(mode))throw Error('Mode de filtrage attendu : all ou any');
 const wanted=tags.map(t=>String(t).trim().toLocaleLowerCase('fr')).filter(Boolean);
 const term=String(search).trim().toLocaleLowerCase('fr');
 return (model.rows||[]).filter(r=>isFloating(r)&&(!account||r.bank===account)).filter(r=>{
  const rowTags=tagsFor(model,r).map(t=>t.toLocaleLowerCase('fr'));
  const matching=!wanted.length||(mode==='any'?wanted.some(t=>rowTags.includes(t)):wanted.every(t=>rowTags.includes(t)));
  return matching&&(!term||[r.desc,r.bank,...rowTags].some(x=>String(x||'').toLocaleLowerCase('fr').includes(term)));
 });
}
function balanceAt(rows, reference, date){
 if(!reference||!validDate(reference.date)||!Number.isFinite(Number(reference.balance))||!validDate(date))return null;
 let result=Number(reference.balance);
 for(const row of rows){if(row.nature==='planned'||isFloating(row))continue;
  if(row.date>reference.date&&row.date<=date)result+=Number(row.amount);
  if(row.date<=reference.date&&row.date>date)result-=Number(row.amount);
 }
 return Math.round(result*100)/100;
}
function totalBalance(model,date,account=''){
 const accounts=account?[account]:includedAccountNames(model);
 if(!accounts.length)return account||!cashAccountNames(model).length?null:0;
 let total=0;
 for(const bank of accounts){const value=balanceAt(model.rows.filter(r=>r.bank===bank),model.references[bank],date);if(value===null)return null;total+=value;}
 return Math.round(total*100)/100;
}
function shiftDate(iso,frequency,k){const d=asDate(iso);if(!validDate(iso))throw Error('Invalid anchor date');
 if(frequency==='quotidien'||frequency==='hebdomadaire'){d.setDate(d.getDate()+(frequency==='quotidien'?1:7)*k);return dateStr(d)}
 const step=({mensuel:1,trimestriel:3,annuel:12})[frequency];if(!step)throw Error('Unknown frequency: '+frequency);
 let m=d.getMonth()+step*k,y=d.getFullYear()+Math.floor(m/12);m=((m%12)+12)%12;
 return dateStr(new Date(y,m,Math.min(d.getDate(),new Date(y,m+1,0).getDate()),12));
}
function recurrenceEvents(model,start,end,account=''){
 const scope=new Set(account?[account]:includedAccountNames(model));
 const rows=model.rows.filter(r=>scope.has(r.bank)),events=[];
 for(const rule of Object.values(model.rules||{})){
  if(!scope.has(rule.account))continue;
  const anchor=rule.anchor||rule.start;if(!anchor)continue;
  for(let k=1;k<=600;k++){const d=shiftDate(anchor,rule.frequency||'mensuel',k);if(d>end)break;if(rule.end&&d>rule.end)break;if(d>start)events.push({date:d,amount:Number(rule.amount),desc:rule.desc,ruleId:rule.id,account:rule.account})}
 }
 for(const row of rows.filter(r=>!isFloating(r)&&r.date>start&&r.date<=end)){
  // Une opération datée et l’échéance calculée restent visibles toutes les deux.
  // Aucun rapprochement automatique : l’utilisateur décide.
  events.push({date:row.date,amount:Number(row.amount),desc:row.desc,account:row.bank});
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date));
}
function forecast(model,at,until,account='',overrides={}){
 // Overrides act on a copy only, leaving saved model untouched.
 const simulated={...model,rules:Object.fromEntries(Object.entries(model.rules||{}).map(([id,r])=>[id,{...r}]))};
 for(const [ruleId,fields] of Object.entries(overrides.rules||{})){if(!simulated.rules[ruleId])throw Error('Unknown rule '+ruleId);Object.assign(simulated.rules[ruleId],fields)}
 const balance=totalBalance(simulated,at,account),events=recurrenceEvents(simulated,at,until,account);
 let running=balance;const timeline=events.map(e=>({...e,balance:running===null?null:(running=Math.round((running+e.amount)*100)/100)}));
 return {account:account||'all',at,until,opening:balance,closing:running,minimum:running===null?null:Math.min(balance,...timeline.map(e=>e.balance)),events:timeline};
}
// CSV d'audit deterministe : les ecritures bancaires sont conservees, jamais dedupliquees.
const AUDIT_HEADERS=['date','compte','libelle','montant','devise','origine','identifiant','recurrence_id'];
function auditOperations(model,{scope='all',at,until,account='',overrides={}}={}){
 if(!['actual','all'].includes(scope))throw Error('Scope attendu : actual ou all');
 if(!validDate(until))throw Error('Date --until invalide');
 if(scope==='all'&&!validDate(at))throw Error('Date --at invalide');
 const saved=(model.rows||[]).filter(r=>!isFloating(r)&&(!account||r.bank===account)&&r.date<=until);
 const records=[];
 for(const row of saved){
  if(scope==='actual'&&row.nature==='planned')continue;
  const note=model.notes?.[row.id]||{};
  records.push({date:row.date,compte:row.bank||row.account||'',libelle:row.desc||'',montant:Number(row.amount),devise:row.currency||'EUR',origine:row.nature==='planned'?'manuel_prevu':row.nature==='manual'?'manuel':'reel',identifiant:String(row.id||''),recurrence_id:note.ruleId||''});
 }
 if(scope==='all'){
  const rules=Object.fromEntries(Object.entries(model.rules||{}).map(([id,r])=>[id,{...r}]));
  for(const [id,fields] of Object.entries(overrides.rules||{})){
   if(!rules[id])throw Error('Unknown rule '+id);
   Object.assign(rules[id],fields);
  }
  const banks=new Set(cashAccountNames(model));
  for(const [id,rule] of Object.entries(rules)){
   if(account&&rule.account!==account)continue;
   if(!banks.has(rule.account))continue;
   const anchor=rule.anchor||rule.start;
   if(!anchor||!validDate(anchor))continue;
   for(let k=1;k<=600;k++){
    const date=shiftDate(anchor,rule.frequency||'mensuel',k);
    if(date>until)break;
    if(rule.end&&date>rule.end)break;
    if(date<=at)continue;
    records.push({date,compte:rule.account,libelle:rule.desc||'',montant:Number(rule.amount),devise:'EUR',origine:'recurrence',identifiant:`rec:${id}:${date}`,recurrence_id:id});
   }
  }
 }
 records.sort((a,b)=>a.date.localeCompare(b.date)||a.compte.localeCompare(b.compte)||a.identifiant.localeCompare(b.identifiant)||a.origine.localeCompare(b.origine));
 return records;
}
// Vue en lecture seule, construite depuis le même audit déterministe que le CLI.
// Une échéance récurrente est calculée à la volée, jamais ajoutée au modèle.
function recurrencePreview(model,at,until,account=''){
 if(!validDate(at)||!validDate(until)||until<at)return [];
 const tagsByRule=new Map();
 for(const row of model.rows||[]){
  const id=model.notes?.[row.id]?.ruleId;
  if(!id)continue;
  const tags=tagsFor(model,row);
  if(!tagsByRule.has(id)||row.date>(tagsByRule.get(id).date||''))tagsByRule.set(id,{date:row.date,tags});
 }
 return auditOperations(model,{scope:'all',at,until,account})
  .filter(row=>row.origine==='recurrence')
  .map(row=>({id:row.identifiant,bank:row.compte,account:row.compte,
   date:row.date,amount:row.montant,desc:row.libelle,ruleId:row.recurrence_id,
   tags:tagsByRule.get(row.recurrence_id)?.tags||[],forecast:true}));
}
function auditCsv(records){
 const quote=v=>{const text=String(v??'');return /[;"\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text};
 const amount=n=>{if(!Number.isFinite(n))throw Error('Montant invalide dans export');return n.toFixed(2).replace('.',',')};
 const lines=[AUDIT_HEADERS.join(';')];
 for(const r of records)lines.push(AUDIT_HEADERS.map(h=>quote(h==='montant'?amount(r.montant):r[h])).join(';'));
 return lines.join('\n')+'\n';
}
function check(model){const errors=[],warnings=[];
 for(const [bank,ref] of Object.entries(model.references||{}))if(!validDate(ref.date)||!Number.isFinite(Number(ref.balance)))errors.push('Invalid reference for '+bank);
 for(const r of model.rows||[]){
  if(!Number.isFinite(Number(r.amount))||r.amount===null||r.amount==='')errors.push('Invalid amount '+(r.id||r.desc));
  if(isFloating(r)){if(!r.manual||r.nature==='actual')errors.push('Invalid floating transaction '+(r.id||r.desc));}
  else if(!validDate(r.date))errors.push('Invalid date '+(r.id||r.desc));
 }
 for(const [id,rule] of Object.entries(model.rules||{})){if(!validDate(rule.anchor||rule.start)||!Number.isFinite(Number(rule.amount)))errors.push('Invalid rule '+id);if(rule.end&&rule.end<(rule.anchor||rule.start))warnings.push('End before anchor: '+id);}
 for(const bank of cashAccountNames(model))if(!model.references?.[bank])warnings.push('Missing reference: '+bank);
 return {ok:errors.length===0,errors,warnings};
}
return {readCsv,mergeAnnotations,isFloating,accountNames,cashAccountNames,includedAccountNames,excludedAccountNames,tagsFor,pendingOperations,balanceAt,totalBalance,shiftDate,recurrenceEvents,forecast,check,auditOperations,auditCsv,recurrencePreview};
});
