'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../src/engine.js');
const annotations=require('../src/annotations.js');
const tags=require('../src/tags.js');
const ui=fs.readFileSync('src/ui.js','utf8');
const editor=fs.readFileSync('src/editor.js','utf8');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function node(tag='div'){
 const n={tagName:tag.toUpperCase(),children:[],dataset:{},style:{},hidden:false,open:false,value:'',textContent:'',className:'',listeners:{},
  classList:{toggle(){},add(){},remove(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},add(item){this.append(item)},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn},
  querySelectorAll(selector){const all=this.children.flatMap(c=>c&&typeof c==='object'?[c,...(c.querySelectorAll?.(selector)||[])]:[]);return all.filter(c=>selector==='details'?c.tagName==='DETAILS':selector==='[data-field]'?!!c.dataset?.field:selector==='[data-candidate]'?!!c.dataset?.candidate:false)}};
 return n;
}
function environment(model={rows:[],notes:{},references:{},rules:{},accounts:[],excludedAccounts:[]}){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
 const context={model,$:get,KEY:'test',QBudgetEngine:engine,QBudgetAnnotations:annotations,QBudgetTags:tags,resolveBankIdentity:()=> 'defer',showOrphanAnnotations(){},document:{createElement:node},Option:function(text,value){return {text,value}},today:'2026-10-25',selected:'',amount:n=>String(n),editorApi:null,numeric:Number,uid:()=> 'new-rule',shiftDate:engine.shiftDate,clearChartSelection(){},clearBulkSelection(){},render(){},save:()=>true};
 vm.createContext(context);return {context,get};
}
function loadFunctions(context){vm.runInContext(section(ui,'function initModel()','function accounts()'),context)}
test('stockage indisponible : avertissement distinct persistant et modèle exportable',()=>{
 const {context,get}=environment();context.localStorage={setItem(){throw Error('quota')},getItem(){return null}};
 loadFunctions(context);assert.equal(vm.runInContext('save()',context),false);
 vm.runInContext(section(ui,'function render(){','// Prévisualisation isolée'),Object.assign(context,{renderBankMatches(){},renderRecurrenceBacklog(){},renderTransferBacklog(){},renderTagCategories(){},editorApi:null,accounts:()=>[]}));
 vm.runInContext('render()',context);
 assert.equal(get('storageWarning').hidden,false);assert.match(get('storageWarning').textContent,/stockage|en mémoire/);
 assert.deepEqual(annotations.exportObject(context.model).manualRows,[]);
});
test('éditeur : un callback de sauvegarde false ne doit pas annoncer une sauvegarde réussie',()=>{
 const statuses=[];const context={getModel:()=>({}),options:{onChange:()=>false},status:(...args)=>statuses.push(args)};
 vm.runInNewContext(section(editor,'function commit(change){','function renderDetail(')+'\ncommit(()=>{});',context);
 assert.equal(statuses.at(-1)[1],true);assert.match(statuses.at(-1)[0],/mémoire|stockage/);assert.doesNotMatch(statuses.at(-1)[0],/Modifications enregistrées/);
});
test('chargement : noms modernes contenant le séparateur conservés avec soldes et règles',()=>{
 const model={rows:[{id:'modern-bank',bank:'Budget · commun',account:'Budget · commun',date:'2026-10-25',desc:'Courses',amount:-5,currency:'EUR'}],notes:{},references:{'Budget · commun':{date:'2026-10-25',balance:100},Budget:{date:'2026-10-25',balance:20}},rules:{r:{id:'r',account:'Budget · commun',desc:'Loyer',amount:-10,frequency:'mensuel',anchor:'2026-10-25'}},accounts:['Budget · commun','Budget'],excludedAccounts:[]};
 const {context}=environment();context.localStorage={getItem:()=>JSON.stringify(model)};loadFunctions(context);vm.runInContext('load()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.model.references)),model.references);assert.equal(context.model.rules.r.account,'Budget · commun');assert.equal(context.model.rows[0].bank,'Budget · commun');assert.equal(engine.totalBalance(context.model,'2026-10-25'),120);
});
test('chargement ancien : migration seulement prouvée et sans collision de référence',()=>{
 const row=(account,i)=>({id:`BPS|${account}|2026-10-01|Courses|-5|${i}|${i}`,bank:'BPS',account,date:'2026-10-01',desc:'Courses',amount:-5,currency:'EUR'});
 for(const collision of [false,true]){
  const refs={'BPS · Courant':{date:'2026-10-01',balance:10},...(collision?{BPS:{date:'2026-10-01',balance:20}}:{})};
  const m={rows:[row('BPS · Courant',0)],notes:{},references:refs,rules:{},accounts:[],excludedAccounts:[]};
  const {context}=environment();context.localStorage={getItem:()=>JSON.stringify(m)};loadFunctions(context);vm.runInContext('load()',context);
  const expected=collision?refs:{BPS:refs['BPS · Courant']};assert.deepEqual(JSON.parse(JSON.stringify(context.model.references)),expected);
 }
});
test('export CLI : les sept manuelles de la démo dont quatre flottantes sont dans manualRows',()=>{
 const demoContext={};vm.runInNewContext(fs.readFileSync('src/demo.js','utf8'),demoContext);
 const model=engine.mergeAnnotations(engine.readCsv(demoContext.QBudgetDemo.csv),demoContext.QBudgetDemo.annotations);
 const {context,get}=environment(model);let exported;
 context.download=data=>{exported=JSON.parse(data)};
 vm.runInContext(section(ui,"$('exportCli').onclick=","$('auditAt').value="),context);get('exportCli').onclick();
 assert.equal(exported.manualRows.length,7);assert.equal(exported.manualRows.filter(engine.isFloating).length,4);
 assert.equal(annotations.importInto({rows:[]},exported,tags).rows.filter(r=>r.manual).length,7);
});
test('backlog récurrences : une vue cachée ne reconstruit pas son contenu',()=>{
 const {context,get}=environment();get('recurrenceBacklogDetails').open=true;get('editorScreen').hidden=true;
 const old=node();get('recurrenceBacklogList').append(old);
 vm.runInContext(section(ui,'function renderRecurrenceBacklog(){',"$('openRecurrenceBacklog').onclick="),context);context.renderRecurrenceBacklog();
 assert.strictEqual(get('recurrenceBacklogList').children[0],old);
});
test('backlog récurrences : brouillons et détails ouverts survivent au rendu',()=>{
 const row={id:'r1',bank:'BPS',date:'2026-10-01',desc:'Courses',amount:-5};
 const second={...row,id:'r2',date:'2026-11-01'};
 const m={rows:[row,second],notes:{},references:{},rules:{},recurrenceBacklog:[{id:'c1',status:'pending',desc:'Courses',account:'BPS',frequency:'mensuel',amount:-5,anchor:'2026-11-01',evidence:[row,second]}]};
 const {context,get}=environment(m);get('recurrenceBacklogDetails').open=true;
 vm.runInContext(section(ui,'function renderRecurrenceBacklog(){',"$('openRecurrenceBacklog').onclick="),context);context.renderRecurrenceBacklog();
 let card=get('recurrenceBacklogList').children[0];card.open=true;card.querySelectorAll('details')[0].open=true;card.querySelectorAll('[data-field]').find(n=>n.dataset.field==='desc').value='Mon brouillon';
 context.renderRecurrenceBacklog();card=get('recurrenceBacklogList').children[0];
 assert.equal(card.open,true);assert.equal(card.querySelectorAll('details')[0].open,true);assert.equal(card.querySelectorAll('[data-field]').find(n=>n.dataset.field==='desc').value,'Mon brouillon');
});
test('résumé : prévision et points de courbe viennent du moteur avec ses arrondis',()=>{
 const m={rows:[1,2,3].map((v,i)=>({id:String(v),bank:'BPS',date:'2026-11-0'+v,desc:'prévue',amount:0.1,nature:'planned'})),references:{BPS:{date:'2026-10-25',balance:0}},rules:{},accounts:[],excludedAccounts:[]};
 const {context,get}=environment(m);get('asof').value='2026-10-25';get('horizon').value='2026-11-30';let projected;
 Object.assign(context,{aggregateRows:()=>m.rows,historicBalance:()=>0,recurrenceEvents:()=>engine.recurrenceEvents(m,'2026-10-25','2026-11-30'),addMonths:()=>'',asDate:s=>new Date(s),dateStr:d=>d.toISOString().slice(0,10),QBudgetHistoryPlot:{points:()=>[]},drawChart:(past,future)=>{projected=future},renderVisuals(){}});
 vm.runInContext(section(ui,'function renderSummary(){','function clearBulkSelection()'),context);context.renderSummary();
 const forecast=engine.forecast(m,'2026-10-25','2026-11-30');assert.equal(get('projection').textContent,String(forecast.closing));assert.equal(projected.at(-1).v,forecast.closing);
});
test('dashboard : une date prévue antérieure à la consultation est refusée avant mutation',()=>{
 const row={id:'m1',manual:true,bank:'BPS',date:'2026-11-01',desc:'Prévue',amount:-5,nature:'planned'};
 const {context,get}=environment({rows:[row],notes:{},references:{},rules:{},accounts:['BPS'],excludedAccounts:[]});get('asof').value='2026-10-25';get('horizon').value='2026-11-30';get('sort').value='asc';let alerts=0;
 Object.assign(context,{inAccount:()=>[row],operationFilter:()=>({}),filteredAnalysisRows:rows=>rows,chartSelection:null,matchingSavedRows:[],tableRowLimit:150,selectedRowIds:new Set(),updateMatchingTagButton(){},updateBulkStatus(){},notes:()=>({}),key:r=>r.bank,alert(){alerts++},connectRule(){},setTags(){},update(){}});
 vm.runInContext(section(ui,'function renderRows(){','function update(r,patch)'),context);context.renderRows();
 const date=get('rows').children[0].children[1].children[0];date.value='2026-10-20';date.listeners.change();
 assert.equal(row.date,'2026-11-01');assert.equal(date.value,'2026-11-01');assert.equal(alerts,1);
});
test('transferts : un statut par proposition et contexte frais après mutation des tags',()=>{
 const rows=[{id:'out',bank:'A',desc:'virement',amount:-10},{id:'in',bank:'B',desc:'virement',amount:10}];
 const candidate={id:'pair',ignored:false,evidence:rows};
 const {context,get}=environment({rows,notes:{},rules:{},references:{},transferBacklog:[candidate]});
 let calls=0;const contexts=[];
 context.QBudgetTransfers={status(model,c,read){calls++;contexts.push(read);return c.evidence.every(e=>model.notes[read.rowsById.get(e.id).id]?.tags?.includes('transfert_intercomptes'))?'validated':'pending'}};
 get('editorScreen').hidden=true;
 vm.runInContext(section(ui,'function renderTransferBacklog(){',"$('detectTransfers').onclick="),context);
 context.renderTransferBacklog();assert.equal(get('transferBacklogCount').textContent,1);assert.equal(calls,1);
 context.model.notes.out={tags:['transfert_intercomptes']};context.model.notes.in={tags:['transfert_intercomptes']};
 context.renderTransferBacklog();assert.equal(get('transferBacklogCount').textContent,0);assert.equal(calls,2);assert.notStrictEqual(contexts[0],contexts[1]);
});
test('chargement : les correspondances anciennes incertaines restent distinctes',()=>{
 const make=(account,id)=>({id,bank:'BPS',account,date:'2026-10-01',desc:'Courses',amount:-5,currency:'EUR'});
 const refs={'BPS · Courant':{date:'2026-10-01',balance:10},'BPS · Épargne':{date:'2026-10-01',balance:20}};
 for(const rows of [[make('BPS · Courant','identifiant-fourni')],[make('BPS · Courant','BPS|BPS · Courant|2026-10-01|Courses|-5|0|0'),make('BPS · Épargne','BPS|BPS · Épargne|2026-10-01|Courses|-5|1|1')]]){
  const m={rows,notes:{},references:refs,rules:{r:{account:'BPS · Courant'}},accounts:[],excludedAccounts:[]};
  const {context}=environment();context.localStorage={getItem:()=>JSON.stringify(m)};loadFunctions(context);vm.runInContext('load()',context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.model.references)),refs);assert.equal(context.model.rules.r.account,'BPS · Courant');
 }
});
test('horizon UI : fin du mois cible conservée, distincte du mois anniversaire moteur',()=>{
 const context={QBudgetEngine:engine};
 vm.runInNewContext(section(ui,'function addMonths(iso,n){','function plotLayout('),context);
 assert.equal(context.addMonths('2026-11-11',1),'2026-12-31');
 assert.equal(context.addMonths('2027-01-31',1),'2027-02-28');
 assert.equal(context.addMonths('2028-01-31',1),'2028-02-29');
 assert.equal(engine.addMonths('2026-11-11',1),'2026-12-11');
 assert.equal(engine.addMonths('2027-01-31',1),'2027-02-28');
});
