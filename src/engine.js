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
function mergeAnnotations(rows,annotations={}){if(!annotations||typeof annotations!=='object'||Array.isArray(annotations))throw Error('Annotations JSON invalides');const result={rows:[...rows],notes:annotations.notes||{},references:annotations.references||{},rules:annotations.rules||{}};for(const row of annotations.manualRows||[]){if(!result.rows.some(r=>r.id===row.id))result.rows.push({...row})}return result}

function balanceAt(rows, reference, date){
 if(!reference||!validDate(reference.date)||!Number.isFinite(Number(reference.balance))||!validDate(date))return null;
 let result=Number(reference.balance);
 for(const row of rows){if(row.nature==='planned')continue;
  if(row.date>reference.date&&row.date<=date)result+=Number(row.amount);
  if(row.date<=reference.date&&row.date>date)result-=Number(row.amount);
 }
 return Math.round(result*100)/100;
}
function totalBalance(model,date,account=''){
 const accounts=account?[account]:[...new Set(model.rows.map(r=>r.bank))];
 if(!accounts.length)return null;
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
 const rows=model.rows.filter(r=>!account||r.bank===account),events=[];
 const scope=new Set(rows.map(r=>r.bank));
 for(const rule of Object.values(model.rules||{})){
  if(!scope.has(rule.account))continue;
  const anchor=rule.anchor||rule.start;if(!anchor)continue;
  for(let k=1;k<=600;k++){const d=shiftDate(anchor,rule.frequency||'mensuel',k);if(d>end)break;if(rule.end&&d>rule.end)break;if(d>start)events.push({date:d,amount:Number(rule.amount),desc:rule.desc,ruleId:rule.id,account:rule.account})}
 }
 for(const row of rows.filter(r=>r.date>start&&r.date<=end)){
  const linked=(model.notes?.[row.id]||{}).ruleId;
  if(linked){const i=events.findIndex(e=>e.ruleId===linked&&e.date===row.date);if(i>=0)events.splice(i,1)}
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
function check(model){const errors=[],warnings=[];
 for(const [bank,ref] of Object.entries(model.references||{}))if(!validDate(ref.date)||!Number.isFinite(Number(ref.balance)))errors.push('Invalid reference for '+bank);
 for(const r of model.rows||[]){if(!validDate(r.date)||!Number.isFinite(Number(r.amount)))errors.push('Invalid transaction '+(r.id||r.desc));}
 for(const [id,rule] of Object.entries(model.rules||{})){if(!validDate(rule.anchor||rule.start)||!Number.isFinite(Number(rule.amount)))errors.push('Invalid rule '+id);if(rule.end&&rule.end<(rule.anchor||rule.start))warnings.push('End before anchor: '+id);}
 for(const bank of new Set((model.rows||[]).map(r=>r.bank)))if(!model.references?.[bank])warnings.push('Missing reference: '+bank);
 return {ok:errors.length===0,errors,warnings};
}
return {readCsv,mergeAnnotations,balanceAt,totalBalance,shiftDate,recurrenceEvents,forecast,check};
});
