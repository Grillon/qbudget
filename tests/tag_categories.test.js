'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const e=require('../src/engine.js');
function make(){return {
 rows:[
  {id:'a',bank:'Perso',date:'2026-10-24',amount:-100,desc:'Carburant',currency:'EUR'},
  {id:'b',bank:'Perso',date:'2026-10-24',amount:-50,desc:'Restaurant',currency:'EUR'},
  {id:'c',bank:'Qonto',date:'2026-10-24',amount:-70,desc:'Fournitures',currency:'EUR'},
  {id:'d',bank:'Perso',date:'2026-10-25',amount:200,desc:'Remboursement',currency:'EUR'},
  {id:'f',bank:'Qonto',date:null,amount:-1000,desc:'IK flottante',currency:'EUR',manual:true,nature:'planned'}
 ],notes:{a:{tags:['SASU','Carburant','Transport','Autre','Récurrent','mission']},b:{tags:['personnel','Restaurant','Ponctuel']},c:{tags:['SASU','Ponctuel']},d:{tags:['personnel']},f:{tags:['SASU','IK']}},
 references:{Perso:{date:'2026-10-25',balance:1000},Qonto:{date:'2026-10-25',balance:250}},rules:{},accounts:['Qonto'],excludedAccounts:[],tagCategories:[
  {name:'Entité',tags:['SASU','personnel'],source:'tags'},
  {name:'Nature',tags:['Carburant','Transport','Restaurant','IK'],source:'tags'},
  {name:'Périodicité',tags:['Récurrent','Ponctuel'],source:'type'}
 ]};}
test('catégories de tags : saisie libre organisée par dimensions',()=>{
 const m=make(),r=m.rows[0];
 const organized=e.organizedTags(m,r);
 assert.deepEqual(organized.values.map(v=>[v.name,v.values]),[
  ['Entité',['SASU']],['Nature',['Carburant','Transport']],['Périodicité',['Récurrent']]]);
 assert.deepEqual(organized.other,['Autre','mission']);
 assert.deepEqual(e.tagsByCategory(m,m.rows[1],m.tagCategories[2]),['Ponctuel']);
});
test('deux tags d’une même catégorie ne multiplient jamais une dépense',()=>{
 const m=make(),expenses=m.rows.filter(r=>r.date&&r.amount<0);
 for(const ordered of [m.tagCategories,[...m.tagCategories].reverse(),m.tagCategories.slice(0,2)]){
  const dim=ordered.map(x=>x.name),tree=e.expenseBreakdown(m,expenses,dim);
  assert.equal(tree.values[0],220);
  assert.equal(tree.values.filter((v,i)=>tree.parents[i]==='total').reduce((a,b)=>a+b,0),220);
  assert.equal(tree.values.filter((v,i)=>tree.parents[i]==='total').length,2+(dim[0]==='Périodicité'?0:0));
 }
 assert.deepEqual(e.expenseCategoryTotals(m,expenses,'Nature'),[['Carburant',100],['Non renseigné',70],['Restaurant',50]]);
});
test('changer l’ordre des dimensions change l’arborescence, jamais le total',()=>{
 const m=make(),rows=m.rows.filter(r=>r.date);
 const a=e.expenseBreakdown(m,rows,['Entité','Nature']);
 const b=e.expenseBreakdown(m,rows,['Nature','Entité']);
 assert.notDeepEqual(a.parents,b.parents);
 assert.equal(a.values[0],220);assert.equal(b.values[0],220);
 assert.equal(e.totalBalance(m,'2026-10-25'),1250);
});
test('profondeur 2 à 8 : une branche par dimension, pas de libellé ajouté par magie',()=>{
 const m=make();m.notes.a.tags=[...m.notes.a.tags,...Array.from({length:8},(_,i)=>`tag${i}`)];
 const dimensions=Array.from({length:8},(_,i)=>({name:`Dimension ${i+1}`,tags:[`tag${i}`],source:'tags'}));
 m.tagCategories=e.validateTagCategories(dimensions);
 for(let depth=2;depth<=8;depth++){
  const tree=e.expenseBreakdown(m,[m.rows[0]],dimensions.slice(0,depth).map(c=>c.name));
  assert.equal(tree.values.length,depth+1); // racine + N niveaux
  assert.equal(tree.values.at(-1),100);
  assert.equal(tree.parents.at(-1),tree.ids.at(-2));
 }
});
test('périodicité classée explicitement ou d’après une annotation : jamais déduite de la date',()=>{
 const m=make(),cat=m.tagCategories[2];
 assert.deepEqual(e.tagsByCategory(m,m.rows[1],cat),['Ponctuel']);
 assert.deepEqual(e.tagsByCategory(m,m.rows[3],cat),[]);
 m.notes.d.type='recurrent';
 assert.deepEqual(e.tagsByCategory(m,m.rows[3],cat),['Récurrent']);
 m.notes.d.tags=['Ponctuel'];
 assert.deepEqual(e.tagsByCategory(m,m.rows[3],cat),['Ponctuel']); // choix explicite prioritaire
});
test('validation : catégorisation libre mais sans collisions ambiguës',()=>{
 const m=make();assert.equal(e.validateTagCategories(m.tagCategories).length,3);
 assert.throws(()=>e.validateTagCategories([{name:'X',tags:['IK']},{name:'x',tags:['Autre']}]),/Catégorie en double/);
 assert.throws(()=>e.validateTagCategories([{name:'X',tags:['IK']},{name:'Y',tags:['ik']}]),/appartient déjà/);
});
test('tags catégorisés, flottantes et exclusions ne modifient jamais les soldes ni l’audit',()=>{
 const m=make(),at='2026-10-25',until='2027-01-01';
 const orig=e.forecast(m,at,until),audit=e.auditCsv(e.auditOperations(m,{scope:'all',at,until}));
 m.tagCategories=[...m.tagCategories].reverse();
 assert.deepEqual(e.forecast(m,at,until),orig);
 assert.equal(e.auditCsv(e.auditOperations(m,{scope:'all',at,until})),audit);
 m.excludedAccounts=['Qonto'];
 assert.equal(e.totalBalance(m,at),1000);
 assert.equal(e.totalBalance(m,at,'Qonto'),250);
});
test('sauvegarde / rechargement : dictionnaire persistant sans perte des tags',()=>{
 const m=make(),saved=JSON.parse(JSON.stringify({notes:m.notes,references:m.references,rules:m.rules,accounts:m.accounts,tagCategories:m.tagCategories,manualRows:m.rows.filter(r=>r.manual)}));
 const fresh=e.mergeAnnotations(m.rows.filter(r=>!r.manual),saved);
 assert.deepEqual(fresh.tagCategories,m.tagCategories);
 assert.deepEqual(e.organizedTags(fresh,fresh.rows[0]),e.organizedTags(m,m.rows[0]));
 assert.equal(fresh.rows.length,m.rows.length);
});
test('l’interface expose le slider, les radios camembert et le tableau en deux lignes distinctement',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8')+fs.readFileSync(path.join(__dirname,'../src/ui.js'),'utf8');
 for(const id of ['sunburstDepth','sunburstDepthText','donutRadios','tagCategoryList','addTagCategory','rows'])assert.match(ui,new RegExp(`id="${id}"`));
 assert.match(ui,/max="8"/);assert.match(ui,/min="1"/);
 assert.match(ui,/organizedTags\(model,r(?:,context)?\)/);assert.match(ui,/renderDonutRadios/);
});

test('onglets glissables : changer leur ordre ne modifie que les dimensions, jamais les soldes',()=>{
 const tags=require('../src/tags.js'),m=make();
 const baseline=e.forecast(m,'2026-10-25','2026-12-31');
 const audit=e.auditCsv(e.auditOperations(m,{scope:'all',at:'2026-10-25',until:'2026-12-31'}));
 const before=e.tagCategories(m);
 const reordered=tags.moveCategory(before,0,2);
 assert.deepEqual(reordered.map(c=>c.name),['Nature','Périodicité','Entité']);
 assert.deepEqual(before.map(c=>c.name),['Entité','Nature','Périodicité']);
 assert.equal(tags.moveCategory(before,1,1),null);
 assert.equal(tags.moveCategory(before,3,0),null);
 m.tagCategories=reordered;
 assert.equal(e.totalBalance(m,'2026-10-25'),1250);
 assert.deepEqual(e.forecast(m,'2026-10-25','2026-12-31'),baseline);
 assert.equal(e.auditCsv(e.auditOperations(m,{scope:'all',at:'2026-10-25',until:'2026-12-31'})),audit);
 const saved=tags.parseJson(tags.exportJson(m.tagCategories));
 assert.deepEqual(saved,reordered);
});

test('interface : curseur de profondeur séparé du texte variable, onglets glissables et raccourci clavier',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../src/ui.js'),'utf8');
 assert.match(html,/class="sunburst-heading"/);
 assert.match(html,/class="field sunburst-depth-control"/);
 assert.match(html,/class="sunburst-dimensions"/);
 assert.match(html,/id="tagCategoryOrder"/);
 assert.match(html,/category-tab/);
 assert.match(js,/tab\.draggable=true/);
 assert.match(js,/addEventListener\('drop'/);
 assert.match(js,/event\.altKey/);
 assert.doesNotMatch(js,/button\('↑','Monter la dimension'/);
});

test('V0.18.1 : les onglets sont dans le panneau Sunburst, sans saut vers l’éditeur',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../src/ui.js'),'utf8');
 const positionTabs=html.indexOf('id="tagCategoryOrder"');
 const positionChart=html.indexOf('id="sunburstChart"');
 const positionEditor=html.indexOf('id="tagCategoriesCard"');
 assert.ok(positionTabs>0 && positionChart>0 && positionEditor>0);
 assert.ok(positionTabs<positionChart,'onglets immédiatement avant le graphique');
 assert.ok(positionEditor>positionChart,'éditeur séparé, plus bas dans le document');
 assert.equal((html.match(/id="tagCategoryOrder"/g)||[]).length,1);
 assert.match(html,/class="sunburst-tab-controls"/);
 // Un clic sur le graphique peut mener au tableau ; un déplacement d'onglet ne doit jamais faire défiler.
 const tabsLogic=js.slice(js.indexOf('function renderCategoryTabs('),js.indexOf('function renderTagCategories('));
 assert.doesNotMatch(tabsLogic,/scrollIntoView/);
 assert.match(js,/reorderTagCategories\(source,target\)/);
});

// La séparation des lignes est une présentation seulement : les filtres, tags et actions
// doivent rester attachés à une unique écriture, et les prévisions restent intouchables.
test('V0.18.2 : deux lignes visuelles par opération, sans duplication de données',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../src/ui.js'),'utf8');
 assert.match(html,/class="tablewrap"/);
 assert.match(html,/<th title="Sélection individuelle">✓<\/th><th>Date<\/th>/);
 assert.doesNotMatch(html,/id="tagsColumnHeader"|id="typeColumnHeader"/);
 assert.match(js,/const organized=QBudgetEngine\.organizedTags\(model,r(?:,context)?\)/);
 assert.match(js,/detailCell\.colSpan=6/);
 assert.match(js,/body\.append\(tr,detail\)/);
 assert.match(js,/if\(r\.forecast\)\{/);
 assert.match(js,/setTags\(r,tag\.value\)/);
 assert.match(js,/check\.checked=selectedRowIds\.has\(r\.id\)/);
});
