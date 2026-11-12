// Format natif des annotations qbudget, partage par le tableau de bord et l'editeur.
// Ne cree aucun format supplementaire et ne modifie jamais les lignes bancaires.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetAnnotations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.20.0';
 const fields=['transferBacklog','recurrenceBacklog','labelAssociations','bankIdentities','version','notes','references','rules','accounts','excludedAccounts','tagCategories','donutCategory','sunburstDepth','hierarchyView','excludeTransfersFromCharts','tagDefaultsVersion','manualRows'];
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function exportObject(model){
  const obj={...(model.annotationExtras||{}),version:3,transferBacklog:model.transferBacklog||[],recurrenceBacklog:model.recurrenceBacklog||[],labelAssociations:model.labelAssociations||[],bankIdentities:model.bankIdentities||[],notes:model.notes||{},references:model.references||{},rules:model.rules||{},accounts:model.accounts||[],excludedAccounts:model.excludedAccounts||[],tagCategories:model.tagCategories||[],donutCategory:model.donutCategory||'',sunburstDepth:model.sunburstDepth||2,hierarchyView:model.hierarchyView||'sunburst',excludeTransfersFromCharts:model.excludeTransfersFromCharts!==false,tagDefaultsVersion:model.tagDefaultsVersion||2,manualRows:(model.rows||[]).filter(r=>r.manual)};
  // Snapshot independant : manipuler la representation exportee ne modifie pas l'application.
  return JSON.parse(JSON.stringify(obj));
 }
 function validateInput(input){
  if(!plain(input)||!plain(input.notes)||!plain(input.references))throw Error('Annotations qbudget incompatibles : notes et references attendus');
  if(input.rules!==undefined&&!plain(input.rules))throw Error('Règles invalides');
  if(input.accounts!==undefined&&!Array.isArray(input.accounts))throw Error('Liste de comptes invalide');
  if(input.manualRows!==undefined&&!Array.isArray(input.manualRows))throw Error('Opérations manuelles invalides');
  if(input.excludedAccounts!==undefined&&!Array.isArray(input.excludedAccounts))throw Error('Exclusions de comptes invalides');
  return input;
 }
 function importInto(model,input,tagsApi=root.QBudgetTags,resolve){
  const o=validateInput(input);
  const engine=root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
  const labelAssociations=engine.validateLabelAssociations(o.labelAssociations===undefined?[]:o.labelAssociations);
  const recurrences=root.QBudgetRecurrences||(typeof require==='function'?require('./recurrences.js'):null);
  const recurrenceBacklog=recurrences.validate(o.recurrenceBacklog);
  const transfers=root.QBudgetTransfers||(typeof require==='function'?require('./transfers.js'):null);
  const transferBacklog=transfers.validate(o.transferBacklog);
  const categories=tagsApi.validate(o.tagCategories===undefined?tagsApi.defaults():o.tagCategories);
  const validCategories=o.tagDefaultsVersion?categories:tagsApi.upgradeDefaultTreatment(categories);
  const legacyRows=o.manualRows===undefined&&Array.isArray(o.rows);
  const manualRows=legacyRows?o.rows.filter(r=>r?.manual):o.manualRows||[];
  const ids=new Set();
  for(const r of manualRows){
   if(!plain(r)||!r.manual||typeof r.id!=='string'||!r.id||ids.has(r.id)||!Number.isFinite(Number(r.amount)))throw Error('Opération manuelle invalide ou dupliquée');
   ids.add(r.id);
  }
  const oldBankRows=(model.rows||[]).filter(r=>!r.manual);
  const bankIds=new Set(oldBankRows.map(r=>r.id));
  if(manualRows.some(r=>bankIds.has(r.id)))throw Error('Identifiant manuel en conflit avec un relevé bancaire');
  const extras=Object.fromEntries(Object.entries(o).filter(([k])=>!fields.includes(k)&&!(legacyRows&&k==='rows')));
  const imported={...model,labelAssociations,transferBacklog,recurrenceBacklog,bankIdentities:o.bankIdentities??model.bankIdentities??[],notes:o.notes,references:o.references,rules:o.rules||{},accounts:o.accounts||[],excludedAccounts:o.excludedAccounts||[],tagCategories:validCategories,tagDefaultsVersion:2,donutCategory:o.donutCategory||'',excludeTransfersFromCharts:o.excludeTransfersFromCharts!==false,sunburstDepth:Math.max(2,Math.min(8,Number(o.sunburstDepth)||2)),hierarchyView:o.hierarchyView==='treemap'?'treemap':'sunburst',rows:[...oldBankRows,...manualRows.map(r=>({...r}))],annotationExtras:extras};
  return engine.reimportBankRows(imported,imported.rows,resolve);
 }
 function exportJson(model){return JSON.stringify(exportObject(model),null,2)}
 return Object.freeze({version,exportObject,exportJson,importInto,validateInput});
});
