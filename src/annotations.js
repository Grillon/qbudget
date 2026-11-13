// Annotations natives et sauvegarde complète, partagées par les deux vues.
// Le JSON d'annotations reste indépendant des opérations bancaires.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetAnnotations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.20.8';
 const fields=['transferBacklog','recurrenceBacklog','labelAssociations','bankIdentities','version','notes','references','rules','accounts','excludedAccounts','tagCategories','donutCategory','sunburstDepth','hierarchyView','hierarchyDimensions','excludeTransfersFromCharts','tagDefaultsVersion','manualRows'];
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function exportObject(model){
  const obj={...(model.annotationExtras||{}),version:3,transferBacklog:model.transferBacklog||[],recurrenceBacklog:model.recurrenceBacklog||[],labelAssociations:model.labelAssociations||[],bankIdentities:model.bankIdentities||[],notes:model.notes||{},references:model.references||{},rules:model.rules||{},accounts:model.accounts||[],excludedAccounts:model.excludedAccounts||[],tagCategories:model.tagCategories||[],donutCategory:model.donutCategory||'',sunburstDepth:model.sunburstDepth||2,hierarchyView:model.hierarchyView||'sunburst',...(Array.isArray(model.hierarchyDimensions)?{hierarchyDimensions:[...model.hierarchyDimensions]}:{}),excludeTransfersFromCharts:model.excludeTransfersFromCharts!==false,tagDefaultsVersion:model.tagDefaultsVersion||2,manualRows:(model.rows||[]).filter(r=>r.manual)};
  // Snapshot independant : manipuler la representation exportee ne modifie pas l'application.
  return JSON.parse(JSON.stringify(obj));
 }
 function validateInput(input){
  if(input?.format==='qbudget-backup')throw Error('Ce fichier est une sauvegarde complète. Utilise « Restaurer sauvegarde complète ».');
  if(!plain(input)||!plain(input.notes)||!plain(input.references))throw Error('Annotations qbudget incompatibles : notes et references attendus');
  if(input.rules!==undefined&&!plain(input.rules))throw Error('Règles invalides');
  if(input.accounts!==undefined&&!Array.isArray(input.accounts))throw Error('Liste de comptes invalide');
  if(input.manualRows!==undefined&&!Array.isArray(input.manualRows))throw Error('Opérations manuelles invalides');
  if(input.excludedAccounts!==undefined&&!Array.isArray(input.excludedAccounts))throw Error('Exclusions de comptes invalides');
  if(input.hierarchyDimensions!==undefined&&(!Array.isArray(input.hierarchyDimensions)||input.hierarchyDimensions.some(name=>typeof name!=='string')))throw Error('Dimensions du graphique invalides');
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
  const imported={...model,hierarchyDimensions:o.hierarchyDimensions===undefined?undefined:[...new Set(o.hierarchyDimensions)],labelAssociations,transferBacklog,recurrenceBacklog,bankIdentities:o.bankIdentities??model.bankIdentities??[],notes:o.notes,references:o.references,rules:o.rules||{},accounts:o.accounts||[],excludedAccounts:o.excludedAccounts||[],tagCategories:categories,tagDefaultsVersion:o.tagDefaultsVersion,donutCategory:o.donutCategory||'',excludeTransfersFromCharts:o.excludeTransfersFromCharts!==false,sunburstDepth:Math.max(1,Math.min(8,Number(o.sunburstDepth)||2)),hierarchyView:o.hierarchyView==='treemap'?'treemap':'sunburst',rows:[...oldBankRows,...manualRows.map(r=>({...r}))],annotationExtras:extras};
  return engine.reimportBankRows(tagsApi.normalizePersonalTag(tagsApi.upgradeCategories(imported)),imported.rows,resolve);
 }
 function exportJson(model){return JSON.stringify(exportObject(model),null,2)}
 // Le même export natif porte les annotations et les manuelles, sans duplication.
 function exportBackupObject(model,view={}){
  const engine=root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
  if(!plain(view))throw Error('Dates de consultation invalides');
  const dates={};
  for(const key of ['asof','horizon'])if(view[key]){
   if(!engine.validDate(view[key]))throw Error('Date de consultation invalide : '+key);
   dates[key]=view[key];
  }
  const annotations=exportObject(model);
  annotations.manualRows=annotations.manualRows.filter(row=>!row.forecast);
  const backup={format:'qbudget-backup',schemaVersion:1,bankRows:(model.rows||[]).filter(row=>!row.manual&&!row.forecast),annotations,view:dates};
  return JSON.parse(JSON.stringify(backup));
 }
 function exportBackupJson(model,view={}){return JSON.stringify(exportBackupObject(model,view),null,2)}
 function importBackup(input,tagsApi=root.QBudgetTags,resolve){
  if(!plain(input)||input.format!=='qbudget-backup')throw Error('Sauvegarde complète incompatible. Pour un fichier d’annotations, utilise « Importer mes annotations ».');
  if(input.schemaVersion!==1)throw Error('Version de sauvegarde complète non prise en charge');
  if(!Array.isArray(input.bankRows))throw Error('Opérations bancaires absentes de la sauvegarde');
  const engine=root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
  const ids=new Set();
  for(const row of input.bankRows){
   if(!plain(row)||typeof row.id!=='string'||!row.id||ids.has(row.id)||row.manual||row.forecast||typeof row.bank!=='string'||typeof row.desc!=='string'||!engine.validDate(row.date)||typeof row.amount!=='number'||!Number.isFinite(row.amount)||row.identityAmount!==undefined&&Number(row.identityAmount)!==row.amount)throw Error('Opération bancaire invalide ou dupliquée dans la sauvegarde');
   ids.add(row.id);
  }
  const a=validateInput(input.annotations);
  if(a.version!==3)throw Error('Version des annotations de la sauvegarde non prise en charge');
  if(!plain(a.rules)||['accounts','excludedAccounts','tagCategories','bankIdentities','labelAssociations','transferBacklog','recurrenceBacklog'].some(key=>!Array.isArray(a[key])))throw Error('Sauvegarde incomplète : comptes, règles ou annotations manquants');
  for(const reference of Object.values(a.references))if(!plain(reference)||!engine.validDate(reference.date)||typeof reference.balance!=='number'||!Number.isFinite(reference.balance))throw Error('Solde de référence invalide dans la sauvegarde');
  for(const rule of Object.values(a.rules)){
   if(!plain(rule)||typeof rule.amount!=='number'||!Number.isFinite(rule.amount)||typeof rule.account!=='string'||rule.frequency&&!['quotidien','hebdomadaire','mensuel','trimestriel','semestriel','annuel'].includes(rule.frequency)||['start','anchor','end'].some(key=>rule[key]&&!engine.validDate(rule[key])))throw Error('Règle de récurrence invalide dans la sauvegarde');
  }
  // Une sauvegarde complète récente contient toujours les manuelles explicitement.
  if(!Array.isArray(a.manualRows))throw Error('Opérations manuelles absentes de la sauvegarde');
  for(const row of a.manualRows){
   if(!plain(row)||row.manual!==true||row.forecast||typeof row.amount!=='number'||!Number.isFinite(row.amount)||typeof row.bank!=='string'||typeof row.desc!=='string'||row.date!==null&&row.date!==undefined&&row.date!==''&&!engine.validDate(row.date))throw Error('Opération manuelle invalide dans la sauvegarde');
  }
  const view=input.view===undefined?{}:input.view;
  if(!plain(view)||['asof','horizon'].some(key=>view[key]!==undefined&&!engine.validDate(view[key])))throw Error('Dates de consultation invalides dans la sauvegarde');
  // Détacher le fichier de l'état restauré ; ne jamais mélanger avec le budget courant.
  const copy=JSON.parse(JSON.stringify(input));
  const restored=importInto({rows:copy.bankRows},copy.annotations,tagsApi,resolve);
  return {model:restored,view:{...(view.asof?{asof:view.asof}:{}),...(view.horizon?{horizon:view.horizon}:{})}};
 }
 return Object.freeze({version,exportObject,exportJson,importInto,validateInput,exportBackupObject,exportBackupJson,importBackup});
});
