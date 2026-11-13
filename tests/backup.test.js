'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const e=require('../src/engine.js'),annotations=require('../src/annotations.js'),tags=require('../src/tags.js');
const csv=fs.readFileSync('tests/fixtures/life_2026_operations.csv','utf8');
function make(){
 const a=JSON.parse(fs.readFileSync('tests/fixtures/life_2026_annotations.json','utf8'));
 const m=tags.normalizePersonalTag({...e.mergeAnnotations(e.readCsv(csv),a),tagCategories:tags.defaults(),tagDefaultsVersion:tags.defaultsVersion,donutCategory:'Poste',hierarchyDimensions:['Entité','Poste'],hierarchyView:'treemap',sunburstDepth:2});
 m.rows.push({id:'saisie-ajoutee',manual:true,nature:'actual',bank:'Qonto',account:'Qonto',date:'2026-10-24',desc:'Ajout manuel après import',amount:-19.5,currency:'EUR'});
 m.notes['saisie-ajoutee']={tags:['qbudget','libre'],memo:{objet:'ne pas perdre'}};
 m.notes['operation-absente-du-csv']={tags:['historique'],champInconnu:42};
 m.annotationExtras={metadonneesPersonnelles:{conserver:true}};
 return m;
}
const dates={asof:'2026-10-25',horizon:'2026-11-30'};
test('sauvegarde complète : bancaires, manuelles et annotations séparées, aucune échéance calculée enregistrée',()=>{
 const m=make(),before=JSON.stringify(m),exported=annotations.exportBackupObject(m,dates);
 assert.equal(exported.format,'qbudget-backup');assert.equal(exported.schemaVersion,1);
 assert.equal(exported.bankRows.length,92);assert.equal(exported.annotations.manualRows.length,8);assert.equal(exported.annotations.manualRows.filter(e.isFloating).length,4);
 assert.equal(exported.annotations.manualRows.find(r=>r.id==='saisie-ajoutee').amount,-19.5);
 assert.ok(!exported.bankRows.some(r=>r.manual||r.forecast));assert.deepEqual(exported.view,dates);
 assert.deepEqual(JSON.parse(annotations.exportBackupJson(m,dates)),exported);assert.equal(JSON.stringify(m),before);
 assert.equal(annotations.exportObject(m).manualRows.length,8);assert.ok(!Object.hasOwn(annotations.exportObject(m),'bankRows'));
 // Même si une prévision était accidentellement présente dans rows, ne pas la figer en écriture.
 const forecasts=e.recurrencePreview(m,dates.asof,dates.horizon);assert.ok(forecasts.length>0);
 const withForecasts={...m,rows:[...m.rows,...forecasts,{...forecasts[0],manual:true}]};
 const clean=annotations.exportBackupObject(withForecasts);assert.equal(clean.bankRows.length,92);assert.equal(clean.annotations.manualRows.length,8);
});
test('restauration sans CSV : mêmes identifiants, tags, règles, opérations, soldes, forecast et audit',()=>{
 const m=make(),b=annotations.exportBackupObject(m,dates),before=JSON.stringify(b),restored=annotations.importBackup(b,tags);
 assert.equal(JSON.stringify(b),before);assert.deepEqual(restored.view,dates);
 assert.deepEqual(restored.model.rows,m.rows);assert.deepEqual(restored.model.notes,m.notes);assert.deepEqual(restored.model.rules,m.rules);
 assert.deepEqual(restored.model.references,m.references);assert.deepEqual(restored.model.bankIdentities,m.bankIdentities);
 assert.deepEqual(restored.model.hierarchyDimensions,m.hierarchyDimensions);assert.equal(restored.model.hierarchyView,'treemap');
 assert.deepEqual(restored.model.annotationExtras,m.annotationExtras);
 assert.deepEqual(e.forecast(restored.model,dates.asof,dates.horizon),e.forecast(m,dates.asof,dates.horizon));
 assert.equal(e.auditCsv(e.auditOperations(restored.model,{scope:'all',at:dates.asof,until:dates.horizon})),e.auditCsv(e.auditOperations(m,{scope:'all',at:dates.asof,until:dates.horizon})));
 const again=annotations.importBackup(annotations.exportBackupObject(restored.model,dates),tags).model;
 assert.equal(again.rows.length,m.rows.length);assert.deepEqual(again.notes,m.notes);
 const reimported=e.reimportBankRows(restored.model,e.readCsv(csv),()=> 'defer');
 assert.deepEqual(reimported.rows.map(r=>r.id),m.rows.map(r=>r.id));assert.deepEqual(reimported.notes,m.notes);
});
test('le fichier sauvegardé et le modèle restauré sont des copies indépendantes',()=>{
 const m=make(),b=annotations.exportBackupObject(m),restored=annotations.importBackup(b,tags).model;
 restored.notes['saisie-ajoutee'].memo.objet='modifié';restored.rows[0].desc='modifié';
 assert.equal(b.annotations.notes['saisie-ajoutee'].memo.objet,'ne pas perdre');assert.equal(m.notes['saisie-ajoutee'].memo.objet,'ne pas perdre');
 assert.notEqual(b.bankRows[0].desc,'modifié');assert.notEqual(m.rows[0].desc,'modifié');
});
test('sauvegardes invalides refusées intégralement : version, contenu manquant, montants, dates, collisions et prévisions',()=>{
 const original=make(),before=JSON.stringify(original),template=annotations.exportBackupObject(original,dates);
 for(const change of [b=>b.schemaVersion=99,b=>b.annotations.version=99,b=>delete b.bankRows,b=>delete b.annotations.manualRows,b=>delete b.annotations.rules,
  b=>b.bankRows[0].amount=null,b=>b.bankRows[0].amount='12',b=>b.bankRows[0].date='2026-02-30',b=>b.bankRows[0].forecast=true,b=>b.bankRows.push({...b.bankRows[0]}),
  b=>b.annotations.manualRows[0].id=b.bankRows[0].id,b=>b.annotations.manualRows[0].amount=null,b=>b.annotations.manualRows[0].date='invalide',b=>b.annotations.manualRows.push({...b.annotations.manualRows[0]}),
  b=>b.view.asof='2026-02-30',b=>b.annotations.references.Qonto.balance=null,b=>Object.values(b.annotations.rules)[0].frequency='inconnue',b=>b.annotations.recurrenceBacklog=[{id:'cassée'}]]){
  const b=structuredClone(template);change(b);assert.throws(()=>annotations.importBackup(b,tags));assert.equal(JSON.stringify(original),before);
 }
 assert.throws(()=>annotations.importBackup(annotations.exportObject(original),tags),/Importer mes annotations/);
 assert.throws(()=>annotations.importInto(original,template,tags),/Restaurer sauvegarde complète/);
});
test('budget vide ou uniquement manuel : sauvegarde et restauration sans fichier bancaire',()=>{
 for(const rows of [[],[{id:'f',manual:true,nature:'planned',bank:'',date:null,desc:'Flottante',amount:-25}]]){
  const m={rows,notes:{f:{tags:['libre']}},references:{},rules:{},accounts:[],tagCategories:tags.defaults(),tagDefaultsVersion:tags.defaultsVersion};
  const b=annotations.exportBackupObject(m,{asof:'',horizon:''}),r=annotations.importBackup(b,tags);
  assert.deepEqual(r.model.rows,rows);assert.deepEqual(r.model.notes,m.notes);assert.deepEqual(r.view,{});
 }
});
test('les rapprochements bancaires en attente et les annotations des lignes absentes restent inchangés',()=>{
 const duplicateCsv='Date;Banque;Compte;Libellé;Montant;Devise\n2026-11-01;BPS;Courant;Courses;-25;EUR\n2026-11-01;BPS;Courant;Courses;-25;EUR';
 let m=e.mergeAnnotations(e.readCsv(duplicateCsv),{},()=> 'new');
 for(const row of m.rows)m.notes[row.id]={tags:['historique-'+row.id.slice(-4)]};
 m=e.reimportBankRows(m,e.readCsv(duplicateCsv),()=> 'defer');
 assert.ok(e.pendingBankMatches(m).length>0);
 const r=annotations.importBackup(annotations.exportBackupObject(m),tags,()=> 'defer').model;
 assert.deepEqual(r.rows,m.rows);assert.deepEqual(r.notes,m.notes);assert.deepEqual(e.pendingBankMatches(r),e.pendingBankMatches(m));
});
test('archives de récurrences et règles semestrielles déjà validées restent restaurables',()=>{
 const fixture=require('./fixtures/recurrences_retired.json'),m=e.mergeAnnotations(e.readCsv(fixture.csv),fixture.annotations);
 const r=annotations.importBackup(annotations.exportBackupObject(m),tags).model;
 assert.deepEqual(r.recurrenceBacklog,m.recurrenceBacklog);assert.deepEqual(r.rules,m.rules);
 assert.deepEqual(e.forecast(r,'2026-11-01','2027-12-31'),fixture.forecast);
});
test('les devises et la précision des données bancaires sont conservées sans conversion',()=>{
 const csv='Date;Banque;Compte;Libellé;Montant;Devise\n2026-11-01;BPS;Courant;Euro;-10,01;EUR\n2026-11-02;BPS;Courant;Dollar;-20,25;USD';
 const m=e.mergeAnnotations(e.readCsv(csv),{notes:{},references:{BPS:{date:'2026-11-02',balance:1000}}});
 const restored=annotations.importBackup(annotations.exportBackupObject(m),tags).model;
 assert.deepEqual(restored.rows.map(r=>[r.amount,r.currency,r.identityAmount]),m.rows.map(r=>[r.amount,r.currency,r.identityAmount]));
 assert.deepEqual(e.forecast(restored,'2026-11-02','2027-01-01'),e.forecast(m,'2026-11-02','2027-01-01'));
 assert.equal(e.totalBalance(restored,'2026-11-02'),null);
});
