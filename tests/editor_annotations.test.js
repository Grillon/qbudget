'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const engine=require('../src/engine.js');
const annotations=require('../src/annotations.js');
const editor=require('../src/editor.js');
const tags=require('../src/tags.js');
function make(){const rows=engine.readCsv(fs.readFileSync(path.join(root,'tests/fixtures/life_2026_operations.csv'),'utf8'));const input=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/life_2026_annotations.json'),'utf8'));return {...engine.mergeAnnotations(rows,input),tagCategories:tags.defaults(),donutCategory:'Nature',sunburstDepth:3,hierarchyView:'treemap',excludeTransfersFromCharts:true,tagDefaultsVersion:2}}
const asJson=obj=>JSON.parse(JSON.stringify(obj));
test('annotations : même format natif et mêmes clés historiques',()=>{
 const m=make(),exported=annotations.exportObject(m);
 assert.deepEqual(Object.keys(exported).sort(),['labelAssociations','bankIdentities','version','notes','references','rules','accounts','excludedAccounts','tagCategories','donutCategory','sunburstDepth','hierarchyView','excludeTransfersFromCharts','tagDefaultsVersion','manualRows'].sort());
 assert.equal(exported.version,3);assert.equal(exported.manualRows.length,7);
 assert.equal(annotations.exportJson(m),JSON.stringify(exported,null,2));
 assert.deepEqual(asJson(annotations.exportObject(annotations.importInto(m,asJson(exported),tags))),asJson(exported));
});
test('annotations : aucune perte sur les hashes, liens et champs inconnus',()=>{
 const m=make(),first=m.rows.find(r=>!r.manual),original=JSON.stringify(m);
 const file={...annotations.exportObject(m),metadonneesPersonnalisees:{x:['a',2]}};
 file.notes[first.id]={...file.notes[first.id],objetLibre:{deep:['xyz']}};
 const restored=annotations.importInto(m,file,tags);
 assert.strictEqual(restored.rows.find(r=>r.id===first.id),first,'les écritures CSV restent la même référence');
 assert.deepEqual(restored.notes[first.id].objetLibre,{deep:['xyz']});
 assert.deepEqual(asJson(annotations.exportObject(restored)).metadonneesPersonnalisees,{x:['a',2]});
 assert.equal(JSON.stringify(m),original,'la fonction d’import ne modifie pas le modèle d’origine');
});
test('annotations : opérateur bancaire non modifiable via annotations, manuelles conservées',()=>{
 const m=make(),file=annotations.exportObject(m),allIds=m.rows.map(x=>x.id),audit=engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-10-25',until:'2026-11-30'}));
 file.notes[allIds[0]]={tags:['nouveau_tag']};const restored=annotations.importInto(m,file,tags);
 assert.deepEqual(restored.rows.map(r=>r.id),allIds);
 assert.deepEqual(restored.notes[allIds[0]].tags,['nouveau_tag']);
 assert.equal(engine.auditCsv(engine.auditOperations(restored,{scope:'all',at:'2026-10-25',until:'2026-11-30'})),audit);
 assert.equal(engine.totalBalance(restored,'2026-10-25'),engine.totalBalance(m,'2026-10-25'));
});
test('annotations : import invalide refuse sans mutation des données',()=>{
 const m=make(),before=JSON.stringify(m);
 assert.throws(()=>annotations.importInto(m,{notes:{},references:{},manualRows:[{id:'xx',amount:2}]},tags),/Opération manuelle/);
 assert.throws(()=>annotations.importInto(m,{notes:{},references:{},tagCategories:[{name:'A',tags:['X']},{name:'B',tags:['X']}]},tags),/tag/i);
 assert.equal(JSON.stringify(m),before);
});
test('éditeur : références et catégories se résolvent avec le modèle partagé',()=>{
 const m=make(),list=editor.itemList(m);
 assert.equal(list.filter(i=>i.kind==='bank').length,92);
 assert.equal(list.filter(i=>i.kind==='manual').length,7);
 assert.equal(list.filter(i=>i.kind==='rule').length,12);
 assert.ok(list.some(i=>i.kind==='account'&&i.id==='Qonto'));
 const first=m.rows.find(r=>!r.manual);assert.equal(list.find(i=>i.key==='row:'+first.id).label,first.desc);
 assert.equal(editor.commaTags(' SASU, IK , ik, mission ' ).join('|'),'SASU|ik|mission');
});
test('éditeur : les annotations orphelines apparaissent sans effacer les références',()=>{
 const m=make();m.notes['id-bancaire-encore-absent']={tags:['SASU']};
 assert.equal(editor.itemList(m).find(x=>x.key==='orphan:id-bancaire-encore-absent').kind,'orphan');
 assert.equal(annotations.exportObject(m).notes['id-bancaire-encore-absent'].tags[0],'SASU');
});
test('HTML : une seule interface de catégories et deux vues du même produit',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const ui=fs.readFileSync(path.join(root,'src/ui.js'),'utf8');
 for(const id of ['viewDashboard','viewEditor','dashboardScreen','editorScreen','editorDetail','editorCategoriesHost','editorCategoryOverview'])assert.match(html,new RegExp(`id="${id}"`));
 assert.equal((html.match(/id="tagCategoriesCard"/g)||[]).length,1);
 assert.match(ui,/\$\('editorCategoriesHost'\)\.append\(\$\('tagCategoriesCard'\)\)/);
 assert.match(ui,/QBudgetEditor\.mount\(\{getModel:\(\)=>model/);
 assert.match(ui,/QBudgetAnnotations\.exportJson\(model\)/);
 assert.match(ui,/QBudgetAnnotations\.importInto\(model/);
 assert.match(html,/src\/annotations\.js/);assert.match(html,/src\/editor\.js/);
});
