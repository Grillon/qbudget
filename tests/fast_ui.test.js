'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../src/engine.js');
const history=require('../src/history-plot.js');
const tags=require('../src/tags.js');
const ui=fs.readFileSync('src/ui.js','utf8');
const editor=fs.readFileSync('src/editor.js','utf8');
const html=fs.readFileSync('index.html','utf8');
function model(){
 const rows=engine.readCsv(fs.readFileSync('tests/fixtures/life_2026_operations.csv','utf8'));
 const notes=JSON.parse(fs.readFileSync('tests/fixtures/life_2026_annotations.json','utf8'));
 return engine.mergeAnnotations(rows,notes);
}
test('courbe rapide : même solde que le moteur à chaque date, avec plusieurs comptes et transferts',()=>{
 const m=model(),at='2026-10-25';
 for(const account of ['',...engine.accountNames(m)]){
  const scope=new Set(account?[account]:engine.includedAccountNames(m));
  const rows=m.rows.filter(r=>scope.has(r.bank)&&r.date&&r.date<=at&&r.nature!=='planned');
  const dates=[...new Set([...rows.map(r=>r.date),at,'2026-08-31','2026-10-01'])].sort();
  const closing=engine.totalBalance(m,at,account);
  const points=history.points(rows,dates,closing);
  if(closing===null){assert.deepEqual(points,[]);continue}
  for(const point of points)assert.equal(point.v,engine.totalBalance(m,point.date,account),`${account||'global'} : ${point.date}`);
 }
});
test('courbe rapide : opérations simultanées, montants réels, valeur d’ouverture et données immuables',()=>{
 const rows=[{date:'2026-01-03',amount:-2.17},{date:'2026-01-03',amount:-2.17},{date:'2026-01-06',amount:5.34}];
 const original=JSON.stringify(rows);
 assert.deepEqual(history.points(rows,['2026-01-02','2026-01-03','2026-01-06'],101),[
  {date:'2026-01-02',v:100},{date:'2026-01-03',v:95.66},{date:'2026-01-06',v:101}
 ]);
 assert.equal(JSON.stringify(rows),original);
 assert.deepEqual(history.points(rows,['2026-01-02'],null),[]);
});
test('vues séparées : aucun rendu de Plotly depuis l’éditeur et aucune reconstructions de l’éditeur pendant save',()=>{
 assert.match(ui,/if\(!\$\('editorScreen'\)\.hidden\)\{renderTagCategories\(\);editorApi\?\.render\(\)\}/);
 assert.match(ui,/else\{renderAccounts\(\);renderSummary\(\);renderRows\(\);renderPending\(\);renderRules\(\)\}/);
 const save=ui.slice(ui.indexOf('function save()'),ui.indexOf('function load()'));
 assert.doesNotMatch(save,/editorApi\?\.render/);
 assert.match(ui,/QBudgetHistoryPlot\.points\(history,/);
 assert.match(ui,/QBudgetHistoryPlot\.points\(actual,/);
});
test('affichage progressif : toutes les opérations restent accessibles et aucun FORECAST modifiable',()=>{
 assert.match(html,/id="moreOperations"/);
 assert.match(html,/id="editorMore"/);
 assert.match(ui,/tableRowLimit\+=150/);
 assert.match(ui,/rows\.slice\(0,tableRowLimit\)\.filter\(r=>!r\.forecast\)/);
 assert.match(editor,/visible\.slice\(0,visibleLimit\)/);
 assert.match(editor,/visibleLimit\+=120/);
 assert.match(editor,/if\(!categoryOverviewOpen\)/);
 const m=model(),before=JSON.stringify(m),balance=engine.totalBalance(m,'2026-10-25');
 assert.ok(tags.defaults().length);
 assert.equal(engine.totalBalance(m,'2026-10-25'),balance);
 assert.equal(JSON.stringify(m),before);
});
