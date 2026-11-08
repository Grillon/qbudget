'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const e=require('../src/engine.js');
const tags=require('../src/tags.js');
const root=path.resolve(__dirname,'..');
function demo(){const rows=e.readCsv(fs.readFileSync(path.join(root,'tests/fixtures/life_2026_operations.csv'),'utf8'));const a=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/life_2026_annotations.json'),'utf8'));return e.mergeAnnotations(rows,a)}
test('catégories de départ indépendantes, sans collision et réutilisables',()=>{
 const a=tags.defaults(),b=tags.defaults();
 assert.equal(a.length,6);
 assert.deepEqual(a.map(x=>x.name),['Nature','Périodicité','Contexte','Entité','Traitement','Variabilité']);
 assert.deepEqual(e.validateTagCategories(a),a);
 a[0].name='Altération';a[0].tags.push('invention');
 assert.equal(b[0].name,'Nature');assert.ok(!b[0].tags.includes('invention'));
 assert.equal(b.find(c=>c.name==='Périodicité').source,'type');
});
test('JSON de catégories indépendant des opérations, validation avant remplacement',()=>{
 const original=tags.defaults();
 const json=tags.exportJson(original),parsed=tags.parseJson(json);
 assert.deepEqual(parsed,original);
 assert.equal(JSON.parse(json).format,'qbudget-tag-categories');
 assert.equal(JSON.parse(json).schemaVersion,1);
 assert.throws(()=>tags.parseJson(JSON.stringify({format:'qbudget-tag-categories',schemaVersion:27,categories:original})),/incompatible/);
 assert.throws(()=>tags.parseJson(JSON.stringify({format:'qbudget-tag-categories',schemaVersion:1,categories:[{name:'X',tags:['A']},{name:'Y',tags:['a']}]})),/appartient déjà|double/i);
 assert.throws(()=>tags.parseJson('json incomplet'),SyntaxError);
 assert.deepEqual(tags.parseJson(tags.exportJson([])),[]); // choix volontaire de zéro catégorie
 const m=demo(),before=JSON.stringify(m);tags.parseJson(json);assert.equal(JSON.stringify(m),before);
});
test('ajout groupé sur résultats filtrés : conserve tags et montants, jamais les prévisions',()=>{
 const m=demo(),date='2026-10-25',end='2027-12-31';
 const beforeForecast=e.forecast(m,date,end),beforeAudit=e.auditCsv(e.auditOperations(m,{scope:'all',at:date,until:end}));
 const selected=m.rows.filter(r=>e.operationMatchesFilter(m,r,{search:'supermarché'}));
 assert.ok(selected.length>=10);const tag='mission';
 const prior=new Map(selected.map(r=>[r.id,e.tagsFor(m,r)]));
 const result=tags.addTag(m,[...selected.map(r=>r.id),'rec:does-not-exist'],tag);
 assert.equal(result.selected,selected.length);
 assert.equal(result.changed,selected.length);
 for(const r of selected){assert.ok(e.tagsFor(m,r).includes(tag));for(const old of prior.get(r.id))assert.ok(e.tagsFor(m,r).includes(old))}
 const again=tags.addTag(m,selected.map(r=>r.id),'MISSION');
 assert.equal(again.changed,0);assert.equal(again.alreadyPresent,selected.length);
 assert.deepEqual(e.forecast(m,date,end),beforeForecast);
 assert.equal(e.auditCsv(e.auditOperations(m,{scope:'all',at:date,until:end})),beforeAudit);
 assert.equal(tags.addTag(m,[],tag).selected,0);
});
test('un seul tag et aucun effacement implicite de données',()=>{
 const m=demo(),before=JSON.stringify(m);
 assert.throws(()=>tags.addTag(m,[m.rows[0].id],' '),/seul tag/);
 assert.throws(()=>tags.addTag(m,[m.rows[0].id],'a,b'),/sans virgule/);
 assert.equal(JSON.stringify(m),before);
 const row=m.rows.find(r=>r.id==='DEMO-IK-PRO');
 assert.equal(e.isFloating(row),true);
 const result=tags.addTag(m,[row.id],'simulation');
 assert.equal(result.changed,1);assert.ok(e.tagsFor(m,row).includes('simulation'));
 assert.ok(e.isFloating(row));
});
test('interface : modules séparés, contrôle JSON et sélection visible des écritures non calculées',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const ui=fs.readFileSync(path.join(root,'src/ui.js'),'utf8');
 for(const path of ['./src/engine.js','./src/normalize.js','./src/tags.js','./src/ui.js'])assert.ok(html.includes(path));
 for(const id of ['modulesPanel','modulesVersions','exportTagCategories','importTagCategories','tagCategoriesFile','resetTagCategories','selectVisibleRows','clearSelectedRows','bulkTag','applyBulkTag','bulkStatus'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(ui,/displayedEditableIds=rows\.slice\(0,1000\)\.filter\(r=>!r\.forecast\)/);
 assert.match(ui,/QBudgetTags\.addTag\(model,/);
 assert.match(ui,/QBudgetTags\.parseJson/);
 assert.match(ui,/QBudgetTags\.exportJson/);
 assert.match(ui,/renderModuleVersions/);
 for(const [n,version] of [['engine',e.version],['tags',tags.version]])assert.match(version,/^\d+\.\d+\.\d+$/);
});
