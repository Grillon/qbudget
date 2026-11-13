// Détection indicative : aucune règle ni annotation avant validation explicite.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetRecurrences=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.20.6';
 const engine=()=>root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
 const identity=()=>root.QBudgetIdentity||(typeof require==='function'?require('./identity.js'):null);
 const normalize=x=>String(x??'').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('fr');
 const frequencies={quotidien:0,hebdomadaire:2,mensuel:5,trimestriel:7,semestriel:7,annuel:7};
 const validFrequency=f=>f==='ponctuel'||Object.hasOwn(frequencies,f);
 const accountScope=row=>JSON.stringify([row.bank,row.sourceAccount||'',row.currency||'EUR']);
 const validDate=s=>engine().validDate(s);
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const exactAmount=r=>identity().canonicalAmount(r.identityAmount!==undefined&&Number(r.identityAmount)===Number(r.amount)?r.identityAmount:r.amount);
 const snapshot=r=>({id:r.id,date:r.date,desc:r.desc,amount:Number(r.amount),identityAmount:exactAmount(r),bank:r.bank,sourceAccount:r.sourceAccount||'',currency:r.currency||'EUR'});
 const groupFor=row=>JSON.stringify([row.bank,row.sourceAccount||'',row.currency||'EUR',normalize(row.desc),exactAmount(row)]);
 const cadenceGroupFor=row=>JSON.stringify([row.bank,row.sourceAccount||'',row.currency||'EUR',normalize(row.desc),Math.sign(Number(row.amount))]);
 const evidenceValid=e=>plain(e)&&typeof e.id==='string'&&!!e.id&&validDate(e.date)&&typeof e.desc==='string'&&Number.isFinite(e.amount)&&typeof e.bank==='string'&&typeof e.sourceAccount==='string'&&e.currency==='EUR'&&(e.identityAmount===undefined||typeof e.identityAmount==='string'&&Number(e.identityAmount)===e.amount);
 // Une occurrence par cycle du calendrier, même si certains cycles sont absents.
 function cycleIndices(rows,frequency){
  const anchor=rows[0].date,monthStep=({mensuel:1,trimestriel:3,semestriel:6,annuel:12})[frequency],indices=[0];
  for(const row of rows.slice(1)){
   const months=(Number(row.date.slice(0,4))-Number(anchor.slice(0,4)))*12+Number(row.date.slice(5,7))-Number(anchor.slice(5,7));
   const approximate=monthStep?months/monthStep:(Date.parse(row.date)-Date.parse(anchor))/(86400000*(frequency==='hebdomadaire'?7:1));
   const base=Math.floor(approximate),possible=[base-1,base,base+1].filter(k=>k>indices.at(-1)).map(k=>({k,error:Math.abs(Date.parse(row.date)-Date.parse(engine().shiftDate(anchor,frequency,k)))/86400000})).sort((a,b)=>a.error-b.error);
   if(!possible.length||possible[0].error>frequencies[frequency])return null;
   indices.push(possible[0].k);
  }
  return indices;
 }
 function cadenceFor(rows){
  if(rows.length<3||new Set(rows.map(r=>r.date)).size!==rows.length)return null;
  // Deux intervalles directs au minimum ; une majorité des intervalles doit
  // confirmer ce rythme, pour ne pas généraliser une paire courte isolée.
  return Object.keys(frequencies).find(f=>{
   const indices=cycleIndices(rows,f);if(!indices)return false;
   const direct=indices.slice(1).filter((index,i)=>index===indices[i]+1).length;
   return direct>=2&&direct*2>=indices.length-1;
  })||null;
 }
 function validate(input=[]){
  if(!Array.isArray(input))throw Error('Backlog de récurrences invalide');
  const ids=new Set();
  for(const c of input){
   if(!plain(c)||typeof c.id!=='string'||!c.id||ids.has(c.id)||!['pending','ignored','accepted'].includes(c.status)||
    typeof c.account!=='string'||!c.account||typeof c.sourceAccount!=='string'||c.currency!=='EUR'||typeof c.desc!=='string'||!c.desc.trim()||
    !validFrequency(c.frequency)||!Number.isFinite(c.amount)||!c.amount||!validDate(c.anchor)||
    c.classificationOnly!==undefined&&typeof c.classificationOnly!=='boolean'||
    c.detectedFrequency!==undefined&&!validFrequency(c.detectedFrequency)||
    !Array.isArray(c.evidence)||c.evidence.length<(c.frequency==='ponctuel'?1:2)||!c.evidence.every(evidenceValid)||
    c.coverageEvidence!==undefined&&(!Array.isArray(c.coverageEvidence)||c.coverageEvidence.length!==2||!c.coverageEvidence.every(evidenceValid)||engine().shiftDate(c.coverageEvidence[0].date,'annuel',1)>c.coverageEvidence[1].date)||
    c.evidence.length===1&&!c.coverageEvidence||
    c.cadenceEvidence!==undefined&&(!Array.isArray(c.cadenceEvidence)||c.cadenceEvidence.length<3||!c.cadenceEvidence.every(evidenceValid)||new Set(c.cadenceEvidence.map(e=>e.id)).size!==c.cadenceEvidence.length||!c.evidence.every(e=>c.cadenceEvidence.some(other=>other.id===e.id)))||
    new Set(c.evidence.map(e=>e.id)).size!==c.evidence.length||c.status==='accepted'&&!c.classificationOnly&&(typeof c.ruleId!=='string'||!c.ruleId))throw Error('Proposition de récurrence invalide');
   ids.add(c.id);
  }
  return JSON.parse(JSON.stringify(input));
 }
 function existingRule(model,rows,key){
  const names=new Set(rows.map(r=>normalize(r.desc)));
  return rows.some(r=>model.notes?.[r.id]?.ruleId)||Object.values(model.rules||{}).some(rule=>
   rule.account===rows[0].bank&&(rule.recurrenceKey===key||
    (!rule.sourceAccount||rule.sourceAccount===(rows[0].sourceAccount||''))&&Math.sign(Number(rule.amount))===Math.sign(Number(rows[0].amount))&&names.has(normalize(rule.desc))));
 }
 function detect(model){
  const groups=new Map(),cadenceGroups=new Map(),coverage=new Map(),observedCounts=new Map(),uncertain=new Set(engine().pendingBankMatches(model).flatMap(p=>[p.id,...p.candidates.map(c=>c.id)]));
  for(const row of model.rows||[]){
   if(row.forecast||row.nature==='planned'||!validDate(row.date)||!row.bank||!normalize(row.desc)||!Number.isFinite(Number(row.amount))||!Number(row.amount)||
    (row.currency||'EUR')!=='EUR'||uncertain.has(row.id))continue;
   const key=groupFor(row);observedCounts.set(key,(observedCounts.get(key)||0)+1);
   if(!row.manual){
    const scope=accountScope(row),window=coverage.get(scope);
    if(!window)coverage.set(scope,[row,row]);else{if(row.date<window[0].date)window[0]=row;if(row.date>window[1].date)window[1]=row}
   }
   const cadenceKey=cadenceGroupFor(row);if(!cadenceGroups.has(cadenceKey))cadenceGroups.set(cadenceKey,[]);cadenceGroups.get(cadenceKey).push(row);
   if(model.notes?.[row.id]?.type==='ponctuel'&&model.notes?.[row.id]?.recurrenceFrequency!=='ponctuel')continue;
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const cadenceCache=new Map();
  for(const [key,rows] of cadenceGroups){rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));cadenceCache.set(key,cadenceFor(rows))}
  const candidates=[];
  for(const [key,rows] of groups){
   if(existingRule(model,rows,key))continue;
   if(rows.length===1){
    const row=rows[0],window=coverage.get(accountScope(row));
    if(observedCounts.get(key)!==1||!window||row.date<window[0].date||row.date>window[1].date||engine().shiftDate(window[0].date,'annuel',1)>window[1].date)continue;
    candidates.push({id:key,status:'pending',account:row.bank,sourceAccount:row.sourceAccount||'',currency:'EUR',desc:row.desc,frequency:'ponctuel',amount:Number(row.amount),anchor:row.date,evidence:[snapshot(row)],coverageEvidence:window.map(snapshot)});
    continue;
   }
   rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
   if(new Set(rows.map(r=>r.date)).size!==rows.length)continue;
   const order=Object.keys(frequencies);
   const localFrequency=order.find(f=>rows.every((row,i)=>!i||Math.abs(Date.parse(row.date)-Date.parse(engine().shiftDate(rows[0].date,f,i)))/86400000<=frequencies[f]));
   const cadenceKey=cadenceGroupFor(rows[0]),cadence=cadenceCache.get(cadenceKey);
   const useCadence=cadence&&(!localFrequency||order.indexOf(cadence)<order.indexOf(localFrequency))&&cycleIndices(rows,cadence);
   const frequency=useCadence?cadence:localFrequency;
   if(!frequency)continue;
   const latest=rows.at(-1);
   candidates.push({id:key,status:'pending',account:latest.bank,sourceAccount:latest.sourceAccount||'',currency:'EUR',
    desc:latest.desc,frequency,amount:Number(latest.amount),anchor:latest.date,evidence:rows.map(snapshot),...(useCadence?{cadenceEvidence:cadenceGroups.get(cadenceKey).map(snapshot)}:{})});
  }
  return candidates.sort((a,b)=>a.id.localeCompare(b.id));
 }
 // Reprendre les anciennes propositions strictement identiques malgré leur ancien identifiant.
 const legacyKey=c=>c.evidence.every(e=>groupFor(e)===groupFor(c.evidence[0]))?groupFor(c.evidence[0]):null;
 function scan(model){
  const old=validate(model.recurrenceBacklog),found=detect(model),current=new Map(found.map(c=>[c.id,c]));
  const claimed=new Set(),backlog=old.map(c=>{
   const fresh=current.get(c.id)||current.get(legacyKey(c));
   const previousFrequency=c.detectedFrequency||c.frequency;
   const faster=fresh&&fresh.frequency!=='ponctuel'&&(previousFrequency==='ponctuel'||Object.keys(frequencies).indexOf(fresh.frequency)<Object.keys(frequencies).indexOf(previousFrequency));
   const needsReview=c.status==='accepted'&&c.classificationOnly&&fresh&&(fresh.evidence.some(e=>model.notes?.[e.id]?.recurrenceFrequency!==c.frequency)||faster);
   if(c.status!=='pending'&&!needsReview)return c;
   if(fresh){if(claimed.has(fresh.id))return null;claimed.add(fresh.id);return fresh}
   return {...c,stale:true};
  }).filter(Boolean);
  // Une ancienne décision d'ignorer un groupe reste valable pour ses sous-groupes exacts.
  const known=new Set(old.map(c=>c.id));
  const ignored=new Set(old.filter(c=>c.status==='ignored').flatMap(c=>c.evidence.map(groupFor)));
  backlog.push(...found.filter(c=>!known.has(c.id)&&!claimed.has(c.id)&&!ignored.has(c.id)));
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
 function freshFor(model,candidate){
  return detect(model).find(c=>c.id===candidate.id||c.id===legacyKey(candidate));
 }
 function reopen(model,id){
  const previous=(model.recurrenceBacklog||[]).find(c=>c.id===id);
  const {backlog,candidate}=entry(model,id,previous?.status==='accepted'&&previous.classificationOnly?'accepted':'ignored'),fresh=freshFor(model,candidate);
  if(!fresh)throw Error('Les opérations nécessaires ne sont plus disponibles ou ont changé. Relance la détection.');
  return {...model,recurrenceBacklog:backlog.map(c=>c===candidate?fresh:c)};
 }
 function checked(model,id){
  const result=entry(model,id),fresh=freshFor(model,result.candidate);
  if(!fresh||fresh.frequency!==result.candidate.frequency||JSON.stringify(fresh.evidence.map(snapshot))!==JSON.stringify(result.candidate.evidence.map(snapshot))||JSON.stringify((fresh.cadenceEvidence||[]).map(snapshot))!==JSON.stringify((result.candidate.cadenceEvidence||[]).map(snapshot))||JSON.stringify((fresh.coverageEvidence||[]).map(snapshot))!==JSON.stringify((result.candidate.coverageEvidence||[]).map(snapshot)))throw Error('Les opérations ont changé ou ne sont plus disponibles. Relance la détection avant de valider.');
  return result;
 }
 function classify(model,id,{frequency}={}){
  const {backlog,candidate}=checked(model,id),selected=frequency??candidate.frequency;
  if(!validFrequency(selected))throw Error('Fréquence de récurrence invalide');
  if(candidate.evidence.length===1&&selected!=='ponctuel')throw Error('Deux occurrences sont nécessaires pour valider une récurrence');
  const notes={...model.notes};
  for(const evidence of candidate.evidence)notes[evidence.id]={...notes[evidence.id],type:selected==='ponctuel'?'ponctuel':'recurrent',recurrenceFrequency:selected};
  candidate.detectedFrequency=candidate.frequency;candidate.status='accepted';candidate.classificationOnly=true;candidate.frequency=selected;
  return {...model,notes,recurrenceBacklog:backlog};
 }
 function accept(model,id,options={}){
  const {backlog,candidate}=checked(model,id);
  if(candidate.evidence.length<2)throw Error('Une opération isolée ne suffit pas pour créer une règle depuis la détection');
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
 return Object.freeze({version,validate,detect,scan,ignore,reopen,classify,accept});
});
