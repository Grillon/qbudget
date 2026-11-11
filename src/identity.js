// Identités bancaires et rapprochement, partagés par le navigateur et Node.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetIdentity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const format=/^[a-f0-9]{64}-\d{4,}$/;
 const normalize=s=>String(s??'').normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase();
 const hash=s=>(root.QBudgetNormalize||(typeof require==='function'?require('./normalize.js'):null)).sha256Fallback(s);
 const bankRow=r=>!r.manual&&r.bank!==undefined&&r.desc!==undefined&&r.date;
 function canonicalAmount(value){
  const text=String(value);
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return String(Number(value));
  const [integer,fraction='']=text.replace(/^[+-]/,'').split('.');
  const whole=(integer||'0').replace(/^0+(?=\d)/,''),decimal=fraction.replace(/0+$/,'');
  return (text.startsWith('-')&&(whole!=='0'||decimal)?'-':'')+whole+(decimal?'.'+decimal:'');
 }
 function key(row){
  const amount=Number(row.amount);
  if(row.amount===null||row.amount===''||!Number.isFinite(amount))throw Error('Montant invalide pour une identité bancaire');
  return JSON.stringify([String(row.bank).trim(),String(row.sourceAccount??row.account??row.bank).trim(),normalize(row.desc),row.date,canonicalAmount(row.identityAmount??row.amount),row.currency||'EUR']);
 }
 const groups=rows=>{const map=new Map();for(const r of rows){const k=key(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r)}return map};
 const makeId=(k,n)=>hash(k)+'-'+String(n).padStart(4,'0');
 const withoutAccount=k=>{const values=JSON.parse(k);values.splice(1,1);return JSON.stringify(values)};
 function copyEntries(model){
  if(model.bankIdentities!==undefined&&!Array.isArray(model.bankIdentities))throw Error('Registre d’identités bancaires invalide');
  return (model.bankIdentities||[]).map(e=>{
   if(!e||!Array.isArray(e.aliases))throw Error('Registre d’identités bancaires invalide');
   const pending=e.pendingMatch;
   if(pending&&(!Array.isArray(pending.candidates)||pending.candidates.some(id=>typeof id!=='string')||typeof pending.reason!=='string'))throw Error('Rapprochement en attente invalide');
   return {...e,aliases:[...e.aliases],...(pending?{pendingMatch:{...pending,candidates:[...pending.candidates]}}:{})};
  });
 }
 function findEntry(entries,id){
  const direct=entries.find(e=>e.id===id);if(direct)return direct;
  const owners=entries.filter(e=>e.aliases.includes(id));
  return owners.length===1?owners[0]:null;
 }
 function pendingMatches(model){
  const entries=model.bankIdentities||[],rows=new Map((model.rows||[]).map(r=>[r.id,r]));
  return entries.filter(e=>e.pendingMatch).map(entry=>{
   const [bank,sourceAccount,desc,date,amount,currency]=JSON.parse(entry.key);
   const candidates=[...new Set(entry.pendingMatch.candidates.map(id=>findEntry(entries,id)?.id).filter(Boolean))]
    .filter(id=>id!==entry.id&&!rows.has(id))
    .map(id=>{const e=entries.find(e=>e.id===id);return {id,reference:e.reference||'',note:model.notes?.[id]||{}}});
   return {id:entry.id,present:rows.has(entry.id),row:rows.get(entry.id)||{id:entry.id,bank,sourceAccount,desc,date,amount:Number(amount),currency},reason:entry.pendingMatch.reason,candidates};
  });
 }
 function resolvePending(model,id,choice){
  const entries=copyEntries(model),source=entries.find(e=>e.id===id&&e.pendingMatch);
  if(!source)throw Error('Rapprochement en attente introuvable');
  if(choice==='new'){delete source.pendingMatch;return {...model,bankIdentities:entries}}
  const issue=pendingMatches(model).find(p=>p.id===id);
  if(!issue.candidates.some(c=>c.id===choice))throw Error('Identité indisponible ou déjà utilisée dans cet import');
  const target=entries.find(e=>e.id===choice),notes={...(model.notes||{})};
  if(target.key!==source.key&&(!target.accountUnknown||withoutAccount(target.key)!==withoutAccount(source.key)))throw Error('Identité incompatible avec cette opération');
  const winner=target.key===source.key?target:source,retired=winner===target?source:target;
  moveNote(notes,retired.id,winner.id);
  winner.aliases=[...new Set([...winner.aliases,...retired.aliases,retired.id])];
  winner.reference=winner.reference||retired.reference;delete winner.pendingMatch;
  const rows=(model.rows||[]).map(r=>r.id===retired.id?{...r,id:winner.id,identityConfirmed:true}:r);
  return {...model,rows,notes,bankIdentities:entries.filter(e=>e!==retired)};
 }
 function prepare(rows){
  const result=new Map();
  for(const [k,list] of groups(rows)){
   const refs=list.map(r=>r.bankReference).filter(Boolean);
   const ordered=refs.length===list.length&&new Set(refs).size===list.length
    ?[...list].sort((a,b)=>a.bankReference<b.bankReference?-1:1):null;
   list.forEach((r,i)=>{
    const sourceIdentity=format.test(r.sourceId||'')?r.sourceId:null;
    if(sourceIdentity&&!sourceIdentity.startsWith(hash(k)+'-'))throw Error('Identifiant bancaire incompatible avec les caractéristiques de la ligne');
    // Les identifiants pending sont uniquement des clés de lecture, jamais sauvegardées.
    const id=sourceIdentity||(list.length===1?makeId(k,0):ordered?makeId(k,ordered.indexOf(r)):'pending:'+hash(k)+':'+i);
    result.set(r,{...r,id,identityConfirmed:false});
   });
  }
  return rows.map(r=>result.get(r));
 }
 function moveNote(notes,from,to){
  if(!from||from===to||!Object.hasOwn(notes,from))return;
  if(Object.hasOwn(notes,to)&&JSON.stringify(notes[to])!==JSON.stringify(notes[from]))throw Error('Conflit d’annotations : '+from+' → '+to);
  Object.defineProperty(notes,to,{value:notes[from],enumerable:true,writable:true,configurable:true});delete notes[from];
 }
 function reconcile(model,incoming,resolve){
  let entries=copyEntries(model);
  const notes={...(model.notes||{})},usedIds=new Set(),byId=new Map(),hashes=new Map();
  const manual=(model.rows||[]).filter(r=>r.manual),manualIds=new Set(manual.map(r=>r.id));
  const occupied=id=>byId.has(id)||entries.some(e=>e.aliases.includes(id));
  const annotated=e=>[e.id,...e.aliases].some(id=>Object.hasOwn(notes,id));
  const register=e=>{
   const prefix=e.id.slice(0,64);
   if(hashes.has(prefix)&&hashes.get(prefix)!==e.key)throw Error('Collision d’empreinte bancaire');
   hashes.set(prefix,e.key);byId.set(e.id,e);
  };
  for(const e of entries){
   if(!format.test(e.id)||typeof e.key!=='string'||!e.id.startsWith(hash(e.key)+'-')||byId.has(e.id)||!e.aliases.every(x=>typeof x==='string'))throw Error('Collision ou registre d’identités bancaires invalide');
   if(manualIds.has(e.id))throw Error('Collision avec une opération manuelle');
   register(e);
  }
  // Un ancien modèle ne conservait pas le compte CSV. Compléter ce renseignement
  // uniquement si les caractéristiques restantes désignent un compte sans ambiguïté.
  const incomingKeys=[...new Set(incoming.filter(bankRow).map(key))];
  for(const entry of [...entries]){
   if(!entry.accountUnknown)continue;
   if(entries.filter(e=>e.key===entry.key).length!==1)continue;
   const matches=incomingKeys.filter(k=>withoutAccount(k)===withoutAccount(entry.key));
   if(matches.length!==1||matches[0]===entry.key)continue;
   const targetKey=matches[0];
   if(entries.some(e=>e!==entry&&e.key===targetKey))continue;
   let n=0;while(occupied(makeId(targetKey,n)))n++;
   const oldId=entry.id,newId=makeId(targetKey,n);
   moveNote(notes,oldId,newId);entry.aliases.push(oldId);
   byId.delete(oldId);entry.id=newId;entry.key=targetKey;entry.accountUnknown=false;register(entry);
  }
  for(const entry of entries)for(const alias of entry.aliases){
   if(manualIds.has(alias))throw Error('Conflit entre annotation bancaire historique et opération manuelle');
   if(!Object.hasOwn(notes,alias))continue;
   if(entries.filter(e=>e.aliases.includes(alias)).length!==1)throw Error('Conflit de correspondances historiques : '+alias);
   moveNote(notes,alias,entry.id);
  }
  function assign(rows,stage){
   const assigned=new Map();
   for(const [k,list] of groups(rows)){
    const candidates=entries.filter(e=>(!e.pendingMatch||annotated(e))&&(e.key===k||(e.accountUnknown&&withoutAccount(e.key)===withoutAccount(k))));
    const references=list.map(r=>r.bankReference).filter(Boolean);
    const distinctReferences=references.length===list.length&&new Set(references).size===list.length;
    const ordered=distinctReferences?[...list].sort((a,b)=>a.bankReference<b.bankReference?-1:1):list;
    const taken=new Set();
    for(const r of ordered){
     let deferred=null;
     const ref=r.bankReference||'';
     const explicit=r.identityConfirmed&&format.test(r.id)?r.id:format.test(r.sourceId||'')?r.sourceId:null;
     let entry=explicit?(byId.get(explicit)||findEntry(entries,explicit)):null;
     if(explicit&&(!explicit.startsWith(hash(k)+'-')||(entry&&entry.key!==k)))throw Error('Collision d’identité bancaire : '+explicit);
     if(explicit&&!entry){
      if(!explicit.startsWith(hash(k)+'-')||byId.has(explicit))throw Error('Collision d’identité bancaire : '+explicit);
      entry={id:explicit,key:k,reference:ref,aliases:[],ambiguous:!distinctReferences&&list.length>1,accountUnknown:r.sourceAccount===undefined};entries.push(entry);register(entry);
     }
     if(!entry&&distinctReferences)entry=candidates.find(e=>e.reference===ref);
     const knownNewReference=distinctReferences&&candidates.every(e=>e.reference&&e.reference!==ref);
     const accountCertain=!candidates[0]?.accountUnknown||incomingKeys.filter(other=>withoutAccount(other)===withoutAccount(k)).length<=1;
     if(!entry&&accountCertain&&list.length===1&&candidates.length===1&&!candidates[0].ambiguous&&(!ref||!candidates[0].reference||ref===candidates[0].reference))entry=candidates[0];
     let create=!entry&&!candidates.length&&(list.length===1||distinctReferences);
     if(!entry&&knownNewReference)create=true;
     if((!entry&&!create)||(entry&&taken.has(entry.id))){
      const choices=candidates.filter(e=>!taken.has(e.id)&&(!ref||!e.reference||ref===e.reference)).map(e=>({id:e.id,reference:e.reference,note:notes[e.id]||{},aliases:e.aliases}));
      const issue={stage,row:{...r},note:notes[r.legacyId||r.id]||{},candidates:choices,message:'Correspondance bancaire ambiguë : '+r.desc+' ('+r.date+', '+r.amount+')'};
      if(typeof resolve!=='function'){const error=Error(issue.message+' — résoudre dans l’interface.');error.code='BANK_IDENTITY_AMBIGUOUS';error.issue=issue;throw error}
      const choice=resolve(issue);
      if(choice===null||choice===undefined)throw Error('Import annulé : rapprochement non résolu');
      entry=choices.some(e=>e.id===choice)?byId.get(choice):null;
      create=choice==='new'||choice==='defer';
      if(choice==='defer')deferred={candidates:choices.map(c=>c.id),reason:issue.message};
      if(!entry&&!create)throw Error('Choix de rapprochement invalide');
     }
     if(create){
      let n=0;while(occupied(makeId(k,n)))n++;
      const id=makeId(k,n);
      entry={id,key:k,reference:ref,aliases:[],ambiguous:!!deferred||!distinctReferences&&list.length>1,accountUnknown:r.sourceAccount===undefined,...(deferred?{pendingMatch:deferred}:{})};
      entries.push(entry);register(entry);
     }
     if(entry.key!==k){
      if(!entry.accountUnknown)throw Error('Conflit de compte source');
      let n=0;while(occupied(makeId(k,n)))n++;
      const oldId=entry.id,newId=makeId(k,n);
      moveNote(notes,oldId,newId);entry.aliases.push(oldId);
      byId.delete(oldId);entry.id=newId;entry.key=k;entry.accountUnknown=false;register(entry);
     }
     if(taken.has(entry.id)||manualIds.has(entry.id))throw Error('Collision avec une opération existante ou manuelle');
     taken.add(entry.id);
     // Les anciens identifiants servent à migrer les notes, jamais à prouver un rapprochement.
     for(const alias of [r.legacyId,!format.test(r.id)&&!r.id.startsWith('pending:')?r.id:null].filter(Boolean)){
      if(deferred&&stage==='import')continue;
      // Un ancien JSON seul ne prouve pas que le numéro de ligne désigne encore
      // la même opération. Sans photographie locale, référence ou décision connue,
      // laisser cette note orpheline pour un rattachement manuel explicite.
      const verified=(alias===r.id&&r.identityConfirmed!==false)||entry.aliases.includes(alias)||(r.bankReference&&r.bankReference===r.sourceId);
      if(!verified)continue;
      if(manualIds.has(alias))throw Error('Conflit entre annotation bancaire historique et opération manuelle');
      if(Object.hasOwn(notes,alias)&&entries.some(e=>e!==entry&&e.aliases.includes(alias)))throw Error('Conflit de correspondances historiques : '+alias);
      moveNote(notes,alias,entry.id);if(!entry.aliases.includes(alias))entry.aliases.push(alias);
     }
     if(!entry.reference&&ref)entry.reference=ref;
     assigned.set(r,r.id===entry.id&&r.identityConfirmed?r:{...r,id:entry.id,identityConfirmed:true});
    }
   }
   return rows.map(r=>assigned.get(r));
  }
  // Migration du modèle local : préserver aussi les lignes absentes du nouvel import.
  const oldBank=(model.rows||[]).filter(bankRow);
  const migrationRows=oldBank.map(r=>{
   if(r.sourceAccount!==undefined)return r;
   const matches=incoming.filter(n=>bankRow(n)&&n.sourceAccount!==undefined&&n.bank===r.bank&&normalize(n.desc)===normalize(r.desc)&&n.date===r.date&&Number(n.amount)===Number(r.amount)&&(n.currency||'EUR')===(r.currency||'EUR'));
   const accounts=new Set(matches.map(n=>n.sourceAccount??n.account));
   let sourceAccount;
   if(accounts.size>1){
    const candidates=[...accounts].map(account=>({id:account,reference:account,note:notes[r.id]||{}}));
    const issue={stage:'migration',row:{...r},note:notes[r.id]||{},candidates,message:'Compte source ambigu : '+r.desc};
    if(typeof resolve!=='function'){const error=Error(issue.message+' — résoudre dans l’interface.');error.code='BANK_IDENTITY_AMBIGUOUS';throw error}
    sourceAccount=resolve(issue);
    if(sourceAccount==null)throw Error('Import annulé : compte source non résolu');
    if(sourceAccount==='new'||sourceAccount==='defer')return r;
    if(!accounts.has(sourceAccount))throw Error('Choix de compte source invalide');
   }else if(accounts.size===1)sourceAccount=[...accounts][0];
   else return r;
   const updated={...r,sourceAccount};
   const upgraded=entries.find(e=>e.aliases.includes(r.id)&&e.key===key(updated));
   if(upgraded)return {...updated,id:upgraded.id};
   return format.test(r.id)&&!r.id.startsWith(hash(key(updated))+'-')?{...updated,identityConfirmed:false,sourceId:'',legacyId:r.id}:updated;
  });
  const migrated=assign(migrationRows,'migration');
  for(const r of migrated){
   const obsolete=entries.find(e=>e.id===r.legacyId&&e.accountUnknown&&e.key!==key(r));
   if(obsolete){entries.splice(entries.indexOf(obsolete),1);byId.delete(obsolete.id)}
  }
  // Le même tableau est utilisé lors de la migration au chargement du navigateur.
  const bank=incoming===model.rows?migrated:assign(incoming.filter(bankRow),'import');
  const other=incoming.filter(r=>!r.manual&&!bankRow(r));
  if(incoming!==model.rows&&incoming.some(bankRow)){
   const present=new Set(bank.map(r=>r.id));
   entries=entries.filter(e=>!e.pendingMatch||present.has(e.id)||annotated(e));
  }
  for(const r of [...bank,...other,...manual]){if(usedIds.has(r.id))throw Error('Collision d’identifiants dans le modèle');usedIds.add(r.id)}
  return {...model,rows:[...bank,...other,...manual],notes,bankIdentities:entries};
 }
 return Object.freeze({key,prepare,reconcile,moveNote,canonicalAmount,pendingMatches,resolvePending});
});
