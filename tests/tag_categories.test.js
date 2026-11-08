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
test('catégories de tags : saisie libre réorganisée dans les colonnes',()=>{
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
test('l’interface expose le slider, les radios camembert et les colonnes du tableau distinctement',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const id of ['sunburstDepth','sunburstDepthText','donutRadios','tagCategoryList','addTagCategory','typeColumnHeader'])assert.match(ui,new RegExp(`id="${id}"`));
 assert.match(ui,/max="8"/);assert.match(ui,/min="2"/);
 assert.match(ui,/renderTagColumnHeaders/);assert.match(ui,/renderDonutRadios/);
});
