// Détection indicative : aucune règle ni annotation avant validation explicite.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetRecurrences=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.19.7';
 const engine=()=>root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
 const normalize=x=>String(x??'').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('fr');
 const frequencies={quotidien:0,hebdomadaire:2,mensuel:5,trimestriel:7,annuel:7};
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const snapshot=r=>({id:r.id,date:r.date,desc:r.desc,amount:Number(r.amount),bank:r.bank,sourceAccount:r.sourceAccount||'',currency:r.currency||'EUR'});
 function validate(input=[]){
  if(!Array.isArray(input))throw Error('Backlog de récurrences invalide');
  const ids=new Set();
  for(const c of input){
   if(!plain(c)||typeof c.id!=='string'||!c.id||ids.has(c.id)||!['pending','ignored','accepted'].includes(c.status)||
    typeof c.account!=='string'||!c.account||typeof c.sourceAccount!=='string'||c.currency!=='EUR'||typeof c.desc!=='string'||!c.desc.trim()||
    !Object.hasOwn(frequencies,c.frequency)||!Number.isFinite(c.amount)||!c.amount||!validDate(c.anchor)||
    !Array.isArray(c.evidence)||c.evidence.length<3||c.evidence.some(e=>!plain(e)||typeof e.id!=='string'||!e.id||!validDate(e.date)||typeof e.desc!=='string'||!Number.isFinite(e.amount)||typeof e.bank!=='string'||typeof e.sourceAccount!=='string'||e.currency!=='EUR')||
    new Set(c.evidence.map(e=>e.id)).size!==c.evidence.length||c.status==='accepted'&&(typeof c.ruleId!=='string'||!c.ruleId))throw Error('Proposition de récurrence invalide');
   ids.add(c.id);
  }
  return JSON.parse(JSON.stringify(input));
 }
 function groupFor(model,row){
  const automatic=engine().automaticTagsFor(model,row);
  // Plusieurs associations : conserver le libellé, sans choisir un groupe arbitraire.
  const label=automatic.length===1?['alias',normalize(automatic[0])]:['libelle',normalize(row.desc)];
  return JSON.stringify([row.bank,row.sourceAccount||'',row.currency||'EUR',Math.sign(Number(row.amount)),...label]);
 }
 function existingRule(model,rows,key){
  const names=new Set(rows.map(r=>normalize(r.desc)));
  const aliases=rows.flatMap(r=>engine().automaticTagsFor(model,r)).map(normalize);
  return rows.some(r=>model.notes?.[r.id]?.ruleId)||Object.values(model.rules||{}).some(rule=>
   rule.account===rows[0].bank&&(rule.recurrenceKey===key||
    (!rule.sourceAccount||rule.sourceAccount===(rows[0].sourceAccount||''))&&Math.sign(Number(rule.amount))===Math.sign(Number(rows[0].amount))&&
    (names.has(normalize(rule.desc))||aliases.includes(normalize(rule.desc)))));
 }
 function detect(model){
  const groups=new Map(),uncertain=new Set(engine().pendingBankMatches(model).flatMap(p=>[p.id,...p.candidates.map(c=>c.id)]));
  for(const row of model.rows||[]){
   if(row.forecast||row.nature==='planned'||!validDate(row.date)||!row.bank||!normalize(row.desc)||!Number.isFinite(Number(row.amount))||!Number(row.amount)||
    (row.currency||'EUR')!=='EUR'||uncertain.has(row.id)||model.notes?.[row.id]?.type==='ponctuel')continue;
   const key=groupFor(model,row);
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const candidates=[];
  for(const [key,rows] of groups){
   if(rows.length<3||existingRule(model,rows,key))continue;
   rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
   // Deux occurrences le même jour ne sont pas distinguables avec ce modèle simple.
   if(new Set(rows.map(r=>r.date)).size!==rows.length)continue;
   const frequency=Object.keys(frequencies).find(f=>rows.every((row,i)=>!i||Math.abs(Date.parse(row.date)-Date.parse(engine().shiftDate(rows[0].date,f,i)))/86400000<=frequencies[f]));
   if(!frequency)continue;
   const latest=rows.at(-1),automatic=engine().automaticTagsFor(model,latest);
   candidates.push({id:key,status:'pending',account:latest.bank,sourceAccount:latest.sourceAccount||'',currency:'EUR',
    desc:automatic.length===1?automatic[0]:latest.desc,frequency,amount:Number(latest.amount),anchor:latest.date,evidence:rows.map(snapshot)});
  }
  return candidates.sort((a,b)=>a.id.localeCompare(b.id));
 }
 function scan(model){
  const old=validate(model.recurrenceBacklog),found=detect(model),current=new Map(found.map(c=>[c.id,c]));
  const backlog=old.map(c=>c.status==='pending'?(current.get(c.id)||{...c,stale:true}):c);
  const known=new Set(old.map(c=>c.id));backlog.push(...found.filter(c=>!known.has(c.id)));
  return {...model,recurrenceBacklog:backlog};
 }
 function entry(model,id,status='pending'){
  const backlog=validate(model.recurrenceBacklog),candidate=backlog.find(c=>c.id===id&&c.status===status);
  if(!candidate)throw Error('Proposition introuvable ou déjà traitée');
  return {backlog,candidate};
 }
 function ignore(model,id){
  const {backlog,candidate}=entry(model,id);candidate.status='ignored';return {...model,recurrenceBacklog:backlog};
 }
 function reopen(model,id){
  const {backlog,candidate}=entry(model,id,'ignored'),fresh=detect(model).find(c=>c.id===id);
  if(!fresh)throw Error('Les opérations nécessaires ne sont plus disponibles ou ont changé. Relance la détection.');
  return {...model,recurrenceBacklog:backlog.map(c=>c===candidate?fresh:c)};
 }
 function accept(model,id,options={}){
  const {backlog,candidate}=entry(model,id),fresh=detect(model).find(c=>c.id===id);
  if(!fresh||JSON.stringify(fresh.evidence)!==JSON.stringify(candidate.evidence))throw Error('Les opérations ont changé ou ne sont plus disponibles. Relance la détection avant de créer la règle.');
  const ruleId=options.id,desc=String(options.desc??candidate.desc).trim(),amount=options.amount??candidate.amount,frequency=options.frequency??candidate.frequency,anchor=options.anchor??candidate.anchor;
  if(typeof ruleId!=='string'||!ruleId||Object.hasOwn(model.rules||{},ruleId))throw Error('Identifiant de règle invalide ou déjà utilisé');
  if(!desc||!Object.hasOwn(frequencies,frequency))throw Error('Libellé ou fréquence de récurrence invalide');
  if(typeof amount!=='number'||!Number.isFinite(amount)||!amount)throw Error('Montant de récurrence invalide');
  if(!validDate(anchor)||anchor<candidate.anchor)throw Error('La date de référence doit être au moins celle de la dernière opération observée');
  const notes={...model.notes};
  for(const evidence of candidate.evidence)notes[evidence.id]={...notes[evidence.id],type:'recurrent',ruleId};
  const rule={id:ruleId,account:candidate.account,sourceAccount:candidate.sourceAccount,desc,amount,frequency,start:anchor,anchor,end:'',recurrenceKey:candidate.id};
  candidate.status='accepted';candidate.ruleId=ruleId;
  return {...model,notes,rules:{...model.rules,[ruleId]:rule},recurrenceBacklog:backlog};
 }
 return Object.freeze({version,validate,detect,scan,ignore,reopen,accept});
});
