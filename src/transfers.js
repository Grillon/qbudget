// Hypothèses de transferts : la validation est exclusivement le tag des deux lignes.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetTransfers=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.20.0',tag='transfert_intercomptes';
 const engine=()=>root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
 const identity=()=>root.QBudgetIdentity||(typeof require==='function'?require('./identity.js'):null);
 const tags=()=>root.QBudgetTags||(typeof require==='function'?require('./tags.js'):null);
 const normalize=s=>String(s??'').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('fr');
 const validDate=s=>engine().validDate(s);
 const currency=r=>String(r.currency||'EUR').trim().toUpperCase()||'EUR';
 function magnitude(r){
  const exact=identity().canonicalAmount(r.identityAmount??r.amount);
  return Number(exact)===Number(r.amount)?exact.replace(/^-/,''):null;
 }
 const differentAccounts=(a,b)=>normalize(a.bank)!==normalize(b.bank)||
  !!normalize(a.sourceAccount)&&!!normalize(b.sourceAccount)&&normalize(a.sourceAccount)!==normalize(b.sourceAccount);
 const snapshot=r=>({id:r.id,bank:r.bank,sourceAccount:r.sourceAccount||'',date:r.date,desc:r.desc||'',amount:Number(r.amount),identityAmount:identity().canonicalAmount(r.identityAmount??r.amount),currency:currency(r)});
 const pairId=e=>JSON.stringify(e.map(r=>r.id));
 function validate(input=[]){
  if(!Array.isArray(input))throw Error('Backlog de transferts invalide');
  const ids=new Set();
  for(const c of input){
   const e=c?.evidence;
   if(!c||typeof c.id!=='string'||ids.has(c.id)||typeof c.ignored!=='boolean'||!Array.isArray(e)||e.length!==2||e.some(r=>
    !r||typeof r.id!=='string'||!r.id||typeof r.bank!=='string'||!r.bank||typeof r.sourceAccount!=='string'||typeof r.desc!=='string'||
    !validDate(r.date)||!Number.isFinite(r.amount)||!r.amount||typeof r.identityAmount!=='string'||!magnitude(r)||typeof r.currency!=='string'||!r.currency)||
    e[0].id===e[1].id||e[0].amount>=0||e[1].amount<=0||e[0].date!==e[1].date||currency(e[0])!==currency(e[1])||magnitude(e[0])!==magnitude(e[1])||!differentAccounts(e[0],e[1])||c.id!==pairId(e))throw Error('Proposition de transfert invalide');
   ids.add(c.id);
  }
  return JSON.parse(JSON.stringify(input));
 }
 const hasTag=(model,row,context)=>engine().tagsFor(model,row,context).some(t=>normalize(t)===tag);
 function status(model,candidate,context=engine().createReadContext(model)){
  if(candidate.evidence.every(e=>hasTag(model,context.rowsById.get(e.id)||e,context)))return 'validated';
  return candidate.ignored?'ignored':'pending';
 }
 function analyze(model,context=engine().createReadContext(model)){
  const groups=new Map(),candidates=[],ambiguous=[];
  const taggedIds=new Set((model.rows||[]).filter(r=>hasTag(model,r,context)).map(r=>r.id));
  const uncertain=new Set(engine().pendingBankMatches(model).flatMap(p=>[p.id,...p.candidates.map(c=>c.id)]));
  for(const r of model.rows||[]){
   if(r.manual||r.forecast||r.nature==='planned'||!validDate(r.date)||!normalize(r.bank)||!Number.isFinite(Number(r.amount))||!Number(r.amount)||!magnitude(r))continue;
   const key=JSON.stringify([r.date,currency(r),magnitude(r)]);
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  const connections=rows=>{
   const outgoing=rows.filter(r=>Number(r.amount)<0),incoming=rows.filter(r=>Number(r.amount)>0),links=new Map(rows.map(r=>[r.id,[]]));
   for(const a of outgoing)for(const b of incoming)if(differentAccounts(a,b)){links.get(a.id).push(b);links.get(b.id).push(a)}
   return {outgoing,links};
  };
  const addPair=(a,b)=>{const evidence=[snapshot(a),snapshot(b)];candidates.push({id:pairId(evidence),ignored:false,evidence})};
  for(const rows of groups.values()){
   // Le tag posé sur UNE ligne ne l'enlève pas de la comparaison. Une paire
   // uniquement identifiable parmi les lignes déjà taguées est en revanche traitée.
   const tagged=connections(rows.filter(r=>taggedIds.has(r.id))),classified=new Set();
   for(const a of tagged.outgoing){
    const matches=tagged.links.get(a.id),b=matches[0];
    if(matches.length===1&&tagged.links.get(b.id).length===1&&!uncertain.has(a.id)&&!uncertain.has(b.id)){addPair(a,b);classified.add(a.id);classified.add(b.id)}
   }
   const {outgoing,links}=connections(rows.filter(r=>!classified.has(r.id)));
   const unclear=new Set();
   for(const a of outgoing){
    const matches=links.get(a.id),b=matches[0];
    if(matches.length===1&&links.get(b.id).length===1&&!uncertain.has(a.id)&&!uncertain.has(b.id)){
     addPair(a,b);
    }else if(matches.length){unclear.add(a);for(const other of matches)unclear.add(other)}
   }
   // Les lignes partiellement taguées participent aussi aux ambiguïtés.
   if([...unclear].some(r=>!taggedIds.has(r.id)))ambiguous.push(...[...unclear].map(snapshot));
  }
  candidates.sort((a,b)=>a.evidence[0].date.localeCompare(b.evidence[0].date)||a.id.localeCompare(b.id));
  ambiguous.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  return {candidates,ambiguous};
 }
 function scan(model){
  const old=validate(model.transferBacklog),found=analyze(model).candidates,current=new Map(found.map(c=>[c.id,c])),known=new Set(old.map(c=>c.id));
  const backlog=old.map(c=>current.has(c.id)?{...current.get(c.id),ignored:c.ignored}:{...c,stale:true});
  backlog.push(...found.filter(c=>!known.has(c.id)));
  return {...model,transferBacklog:backlog};
 }
 function ignore(model,id){
  const backlog=validate(model.transferBacklog),c=backlog.find(c=>c.id===id);
  if(!c)throw Error('Proposition de transfert introuvable');
  c.ignored=true;return {...model,transferBacklog:backlog};
 }
 function reopen(model,id){
  const backlog=validate(model.transferBacklog),fresh=analyze(model).candidates.find(c=>c.id===id);
  if(!backlog.some(c=>c.id===id)||!fresh)throw Error('Les opérations ont changé ou ne sont plus disponibles. Relance la détection.');
  return {...model,transferBacklog:backlog.map(c=>c.id===id?fresh:c)};
 }
 function acceptMany(model,ids){
  if(!Array.isArray(ids)||!ids.length)throw Error('Aucun transfert sélectionné');
  const backlog=validate(model.transferBacklog),fresh=new Map(analyze(model).candidates.map(c=>[c.id,c])),rows=[];
  for(const id of new Set(ids)){
   const c=backlog.find(c=>c.id===id),current=fresh.get(id);
   if(!c||c.ignored||!current||JSON.stringify(current.evidence)!==JSON.stringify(c.evidence))throw Error('Les opérations ont changé, sont ambiguës ou ne sont plus disponibles. Relance la détection.');
   rows.push(...c.evidence.map(e=>e.id));
  }
  const result={...model};tags().addTag(result,rows,tag);return result;
 }
 function accept(model,id){return acceptMany(model,[id])}
 return Object.freeze({version,tag,validate,status,analyze,scan,ignore,reopen,accept,acceptMany});
});
