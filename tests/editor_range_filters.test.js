'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const editor=require('../src/editor.js');
const tags=require('../src/tags.js');
const engine=require('../src/engine.js');
const html=fs.readFileSync('index.html','utf8');
const src=fs.readFileSync('src/editor.js','utf8');
const operations=[
 {id:'a',bank:'BPS',date:'2026-09-01',desc:'VIR Epargne',amount:-2000,currency:'EUR'},
 {id:'b',bank:'BoursoBank',date:'2026-09-12',desc:'VIR de BPS',amount:2000,currency:'EUR'},
 {id:'c',bank:'BPS',date:'2026-10-01',desc:'VIR Epargne',amount:-1000,currency:'EUR'},
 {id:'d',bank:'Revolut',date:'2026-10-31',desc:'RESTAURANT',amount:-42.5,currency:'EUR'},
 {id:'e',bank:'Qonto',date:'2026-11-01',desc:'VIR en attente',amount:-1000,currency:'EUR',nature:'planned',manual:true},
 {id:'f',bank:'BPS',date:null,desc:'FLOTTANT',amount:-1200,currency:'EUR',nature:'planned',manual:true}
];
function model(){return {rows:structuredClone(operations),notes:{d:{tags:['repas']}},references:{},rules:{},accounts:['BPS','BoursoBank','Revolut','Qonto'],tagCategories:[]}}

test('montants absolus : virgules, espaces, bornes incluses et absence de mutation',()=>{
 const m=model(),before=JSON.stringify(m);
 const f=editor.parseEditorFilters({min:'1 000,00',max:'2 000'});
 assert.equal(f.active,true);
 assert.deepEqual(m.rows.filter(r=>editor.matchesEditorFilters(r,f)).map(r=>r.id),['a','b','c','e','f']);
 assert.equal(JSON.stringify(m),before);
 assert.deepEqual(editor.parseEditorFilters(),{min:null,max:null,from:'',to:'',active:false});
 assert.equal(editor.matchesEditorFilters(null,editor.parseEditorFilters()),true);
});
test('période : dates incluses, exclusion des flottantes, combinaison montant et Regex',()=>{
 const m=model(),f=editor.parseEditorFilters({min:'1000',max:'2000',from:'2026-09-12',to:'2026-10-01'});
 const re=engine.compileSearch('VIR','regex');
 const ids=m.rows.filter(r=>editor.matchesEditorFilters(r,f)&&engine.operationMatchesFilter(m,r,{search:'VIR',searchMode:'regex',searchRegex:re})).map(r=>r.id);
 assert.deepEqual(ids,['b','c']);
 assert.equal(editor.matchesEditorFilters(m.rows[5],f),false);
 assert.equal(editor.matchesEditorFilters(m.rows[4],f),false);
});
test('filtres invalides sont bloquants : montants, ordre, période',()=>{
 for(const min of ['-100','1a','NaN','Infinity','1,234'])assert.throws(()=>editor.parseEditorFilters({min}),/montant/i,min);
 assert.throws(()=>editor.parseEditorFilters({min:'200',max:'100'}),/minimum supérieur/);
 assert.throws(()=>editor.parseEditorFilters({from:'2026-12-31',to:'2026-01-01'}),/postérieure/);
 assert.throws(()=>editor.parseEditorFilters({from:'pas-une-date'}),/Date de début/);
 assert.throws(()=>editor.parseEditorFilters({from:'2026-02-30'}),/Date de début/);
 assert.throws(()=>editor.parseEditorFilters({to:'2026-02-29'}),/Date de fin/);
});
test('sélection filtrée puis taggage : seul le bon groupe change, jamais les montants',()=>{
 const m=model(),f=editor.parseEditorFilters({min:'1000',max:'2000',from:'2026-09-12',to:'2026-10-01'});
 const ids=m.rows.filter(r=>editor.matchesEditorFilters(r,f)).map(r=>r.id);
 const originalAmounts=m.rows.map(r=>r.amount),originalRows=JSON.stringify(m.rows);
 assert.deepEqual(ids,['b','c']);
 const result=tags.addTag(m,ids,'transfert_intercomptes');
 assert.equal(result.changed,2);
 assert.deepEqual(engine.tagsFor(m,m.rows[1]),['transfert_intercomptes']);
 assert.deepEqual(engine.tagsFor(m,m.rows[2]),['transfert_intercomptes']);
 assert.deepEqual(engine.tagsFor(m,m.rows[3]),['repas']);
 assert.deepEqual(m.rows.map(r=>r.amount),originalAmounts);
 assert.equal(JSON.stringify(m.rows),originalRows);
});
test('l’éditeur conserve la recherche, la sélection Ctrl/Shift et applique le filtre aux lots complets',()=>{
 for(const id of ['editorAmountMin','editorAmountMax','editorDateFrom','editorDateTo','editorClearRange'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(src,/matchesEditorFilters\(rowById\.get\(i\.id\),bounds\)/);
 assert.match(src,/matchingEditableIds=editable\.map\(i=>i\.id\)/);
 assert.match(src,/selectKeys\(selectedKeys,matchingEditableKeys/);
 assert.match(src,/root\.QBudgetEngine\.compileSearch\(term,mode\)/);
 assert.match(src,/byId\('editorApplySelectedTag'\)\.onclick/);
 assert.match(src,/byId\('editorApplyTag'\)\.onclick/);
 assert.match(src,/byId\('editorClearRange'\)\.onclick/);
});
