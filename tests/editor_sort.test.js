'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/engine.js');
const editor=require('../src/editor.js');
const annotations=require('../src/annotations.js');
const tags=require('../src/tags.js');
function model(){return {
 rows:[{id:'a',bank:'Qonto',desc:'École 10',date:'2026-11-03',amount:10},
  {id:'b',bank:'BPS',desc:'école 2',date:'2026-11-01',amount:-9},
  {id:'c',bank:'Revolut',desc:'Alpha',date:'2026-11-02',amount:-100},
  {id:'d',bank:'BPS',desc:'Beta',date:null,amount:0,manual:true,nature:'planned'},
  {id:'e',bank:'BPS',desc:'alpha',date:'2026-11-02',amount:2}],
 notes:{a:{tags:['Zèbre']},b:{tag:'achat 12'},e:{tags:['achat 2']},orphelin:{tag:'Alpha'}},
 references:{Qonto:{date:'2026-11-04',balance:1000},BPS:{date:'2026-11-04',balance:2000},Revolut:{date:'2026-11-04',balance:3000}},rules:{},labelAssociations:[{tag:'automatique',patterns:['Alpha']}]
}}
const sorted=(m,column,direction='asc',items=editor.itemList(m).filter(i=>i.kind==='bank'||i.kind==='manual'))=>editor.sortItems(m,items,{column,direction}).map(i=>i.id);
test('tri éditeur : montants signés numériques et zéro, dans les deux sens',()=>{
 const m=model();assert.deepEqual(sorted(m,'amount'),['c','b','d','e','a']);assert.deepEqual(sorted(m,'amount','desc'),['a','e','d','b','c']);
});
test('tri éditeur : dates chronologiques, flottantes et valeurs absentes toujours en fin',()=>{
 const m=model();assert.deepEqual(sorted(m,'date'),['b','c','e','a','d']);assert.deepEqual(sorted(m,'date','desc'),['a','c','e','b','d']);
 m.rules.r={id:'r',account:'BPS',desc:'Règle',frequency:'mensuel',amount:-5,anchor:'2026-11-01'};
 const items=editor.itemList(m),sortedAll=editor.sortItems(m,items,{column:'date',direction:'desc'});
 assert.deepEqual(sortedAll.slice(0,4).map(i=>i.id),['a','c','e','b']);
 assert.ok(sortedAll.slice(4).some(i=>i.kind==='rule'));
});
test('tri éditeur : libellés français et chiffres naturels, égalités stables',()=>{
 const m=model();assert.deepEqual(sorted(m,'label'),['c','e','d','b','a']);assert.deepEqual(sorted(m,'label','desc'),['a','b','d','c','e']);
 assert.deepEqual(sorted(m,'account'),['b','d','e','a','c']);assert.deepEqual(sorted(m,'account','desc'),['c','a','b','d','e']);
});
test('tri éditeur : tags affichés, associations et champ historique, valeurs vides en fin',()=>{
 const m=model();assert.deepEqual(sorted(m,'tags'),['e','b','c','a','d']);
 assert.deepEqual(sorted(m,'tags','desc'),['a','c','b','e','d']);
 const orphan=editor.itemList(m).find(i=>i.kind==='orphan');
 const items=[orphan,...editor.itemList(m).filter(i=>i.kind==='bank')];
 assert.equal(editor.sortItems(m,items,{column:'tags'})[2].id,'orphelin');
});
test('tri éditeur : aucune mutation de l’ordre bancaire, des annotations, des règles ou des calculs',()=>{
 const m=model(),items=editor.itemList(m),before=JSON.stringify(m),keys=items.map(i=>i.key),json=annotations.exportJson(m),forecast=engine.forecast(m,'2026-11-04','2026-12-31');
 for(const column of ['date','account','label','amount','tags'])for(const direction of ['asc','desc']){
  const result=editor.sortItems(m,items,{column,direction});assert.equal(result.length,items.length);assert.notStrictEqual(result,items);
 }
 assert.equal(JSON.stringify(m),before);assert.deepEqual(items.map(i=>i.key),keys);assert.equal(annotations.exportJson(m),json);
 assert.deepEqual(engine.forecast(m,'2026-11-04','2026-12-31'),forecast);
 assert.deepEqual(editor.sortItems(m,items,{}),items);
});
test('tri éditeur : tri global avant découpage et sélection Shift selon l’ordre affiché',()=>{
 const m={rows:[],notes:{},references:{},rules:{}};
 for(let i=0;i<600;i++)m.rows.push({id:'r'+i,bank:'BPS',desc:'Libellé '+(600-i),date:'2026-11-01',amount:600-i});
 const items=editor.sortItems(m,editor.itemList(m).filter(i=>i.kind==='bank'),{column:'amount'}),keys=items.map(i=>i.key);
 assert.equal(items[0].id,'r599');assert.equal(items.slice(0,250).at(-1).id,'r350');
 const selected=editor.selectKeys(new Set([keys[0]]),keys,keys[0],keys[2],{shift:true});
 assert.deepEqual([...selected.keys],['row:r599','row:r598','row:r597']);
 tags.addTags(m,items.filter(i=>selected.keys.has(i.key)).map(i=>i.id),'tri, test');
 assert.deepEqual(Object.keys(m.notes).sort(),['r597','r598','r599']);assert.equal(m.rows[0].id,'r0');
});
