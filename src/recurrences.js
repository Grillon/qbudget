// Compatibilité des sauvegardes : les anciennes propositions restent des archives passives.
// Aucune détection, validation de périodicité ou création de règle depuis ces archives.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetRecurrences=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.20.7';
 const engine=()=>root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
 const validFrequency=f=>['ponctuel','quotidien','hebdomadaire','mensuel','trimestriel','semestriel','annuel'].includes(f);
 const validDate=s=>engine().validDate(s);
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const evidenceValid=e=>plain(e)&&typeof e.id==='string'&&!!e.id&&validDate(e.date)&&typeof e.desc==='string'&&Number.isFinite(e.amount)&&typeof e.bank==='string'&&typeof e.sourceAccount==='string'&&e.currency==='EUR'&&(e.identityAmount===undefined||typeof e.identityAmount==='string'&&Number(e.identityAmount)===e.amount);
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
 return Object.freeze({version,validate});
});
