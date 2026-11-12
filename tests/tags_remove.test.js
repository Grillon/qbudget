'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/engine.js');
const tags=require('../src/tags.js');
const annotations=require('../src/annotations.js');
function model(){return {
 rows:[{id:'a',bank:'BPS',account:'BPS',date:'2026-11-01',desc:'Courses',amount:-25},
  {id:'b',bank:'BPS',account:'BPS',date:'2026-11-02',desc:'NETFLIX',amount:-15},
  {id:'c',bank:'BPS',date:null,desc:'En attente',amount:-8,manual:true,nature:'planned'},
  {id:'forecast',bank:'BPS',date:'2026-12-01',desc:'Courses',amount:-25,forecast:true}],
 notes:{a:{tags:['mission','SASU'],tag:'mission',type:'recurrent',ruleId:'r',extra:{x:1}},b:{tags:['Mission','personnel'],tag:'Mission'},c:{tag:'MISSION, IK'},forecast:{tags:['mission']}},
 references:{BPS:{date:'2026-11-03',balance:1000}},rules:{r:{id:'r',account:'BPS',desc:'Courses',amount:-25,frequency:'mensuel',anchor:'2026-11-01'}}
}}

test('retrait groupé : sélection exacte, casse, identifiants répétés et prévisions ignorées',()=>{
 const m=model();
 const result=tags.removeTag(m,['a','a','c','forecast','inconnu'],' MISSION ');
 assert.equal(result.selected,2);assert.equal(result.changed,2);assert.equal(result.notPresent,0);
 assert.deepEqual(engine.manualTagsFor(m,m.rows[0]),['SASU']);
 assert.deepEqual(engine.manualTagsFor(m,m.rows[1]),['Mission','personnel']);
 assert.deepEqual(engine.manualTagsFor(m,m.rows[2]),['IK']);
 assert.deepEqual(m.notes.forecast,{tags:['mission']});
 assert.equal(m.notes.a.ruleId,'r');assert.equal(m.notes.a.type,'recurrent');assert.deepEqual(m.notes.a.extra,{x:1});
 assert.equal(m.notes.a.tag,'SASU');assert.equal(m.notes.c.tag,'IK');
});

test('retrait groupé : aperçu pur, aucun tag voisin supprimé, répétition sans effet',()=>{
 const m=model();m.notes.a.tags.push('mission-2026');
 const before=JSON.stringify(m),ids=['a','b'];
 assert.equal(tags.removeTagPreview(m,ids,'mission').changed,2);assert.equal(JSON.stringify(m),before);
 tags.removeTag(m,ids,'mission');assert.ok(m.notes.a.tags.includes('mission-2026'));
 const snapshot=JSON.stringify(m),notes=m.notes;
 assert.equal(tags.removeTag(m,ids,'mission').changed,0);assert.equal(JSON.stringify(m),snapshot);assert.strictEqual(m.notes,notes);
});

test('retrait groupé : entrées invalides refusées sans mutation ni création d’annotations',()=>{
 const m=model();delete m.notes.b;const before=JSON.stringify(m);
 for(const tag of ['',' ','a,b'])assert.throws(()=>tags.removeTag(m,['a'],tag));
 assert.throws(()=>tags.removeTag(m,'a','mission'));
 assert.equal(JSON.stringify(m),before);
 assert.equal(tags.removeTag(m,['b'],'mission').changed,0);assert.ok(!Object.hasOwn(m.notes,'b'));
 assert.equal(tags.removeTag(m,[],'mission').selected,0);
});

test('retrait groupé : tag hérité d’une association signalé sans modifier sa définition',()=>{
 const m=model();m.labelAssociations=[{tag:'mission',patterns:['NETFLIX']}];
 const before=JSON.stringify(m.labelAssociations);
 const preview=tags.removeTagPreview(m,['a','b'],'mission');assert.equal(preview.changed,2);assert.equal(preview.automatic,1);
 const result=tags.removeTag(m,['a','b'],'mission');assert.equal(result.automatic,1);
 assert.deepEqual(engine.manualTagsFor(m,m.rows[1]),['personnel']);
 assert.deepEqual(engine.tagsFor(m,m.rows[1]),['personnel','mission']);
 assert.equal(JSON.stringify(m.labelAssociations),before);
 assert.equal(tags.removeTagPreview(m,['b'],'mission').changed,0);
});

test('retrait groupé : montants, soldes, règles, audit et flottantes inchangés',()=>{
 const m=model();m.rows=m.rows.filter(r=>!r.forecast);
 const rows=JSON.stringify(m.rows),rules=JSON.stringify(m.rules),forecast=engine.forecast(m,'2026-11-03','2027-01-01');
 const audit=engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-03',until:'2027-01-01'}));
 tags.removeTag(m,m.rows.map(r=>r.id),'mission');
 assert.equal(JSON.stringify(m.rows),rows);assert.equal(JSON.stringify(m.rules),rules);
 assert.deepEqual(engine.forecast(m,'2026-11-03','2027-01-01'),forecast);
 assert.equal(engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-03',until:'2027-01-01'})),audit);
 assert.equal(engine.totalBalance(m,'2026-11-03'),1000);assert.equal(m.rows[2].date,null);
});

test('retrait groupé : tous les résultats filtrés sont traités au-delà des limites d’affichage',()=>{
 const m={rows:[],notes:{},references:{},rules:{}};
 for(let i=0;i<220;i++){m.rows.push({id:'row'+i,desc:i<200?'FRAIS '+i:'Autre',bank:'BPS',date:'2026-11-01',amount:-10});m.notes['row'+i]={tags:['erreur','conservé']}}
 const selected=m.rows.filter(r=>engine.operationMatchesFilter(m,r,{search:'^FRAIS ',searchMode:'regex'}));
 assert.equal(tags.removeTag(m,selected.map(r=>r.id),'erreur').changed,200);
 for(const row of selected)assert.deepEqual(m.notes[row.id].tags,['conservé']);
 for(const row of m.rows.slice(200))assert.ok(m.notes[row.id].tags.includes('erreur'));
});

test('retrait groupé : export/restauration sans réapparition du champ tag historique',()=>{
 const m=engine.mergeAnnotations(engine.readCsv('Date;Banque;Compte;Libellé;Montant\n2026-11-01;BPS;Courant;Test;-25'),{});
 const row=m.rows[0];m.notes[row.id]={tag:'mission, IK',extra:{x:1}};
 tags.removeTag(m,[row.id],'mission');
 const restored=annotations.importInto(m,JSON.parse(annotations.exportJson(m)),tags);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),['IK']);
 assert.deepEqual(restored.notes[row.id].extra,{x:1});
});

test('retrait groupé : enlever le dernier tag supprime seulement une annotation devenue vide',()=>{
 const m=model();m.notes.b={tag:'mission'};
 tags.removeTag(m,['b'],'mission');assert.ok(!Object.hasOwn(m.notes,'b'));
 m.notes.b={tags:['mission'],tag:'mission',ruleId:'r',type:'recurrent',extra:{}};
 tags.removeTag(m,['b'],'mission');
 assert.deepEqual(m.notes.b,{tags:[],tag:'',ruleId:'r',type:'recurrent',extra:{}});
});

test('retrait groupé : corriger un tag erroné dans le backlog permet ensuite le rattachement',()=>{
 const header='Date;Banque;Compte;Libellé;Montant;Référence bancaire\n';
 const line='2026-11-01;BPS;Courant;Courses;-25;';
 const old=engine.mergeAnnotations(engine.readCsv(header+line+'A\n'+line+'B'),{});
 tags.addTag(old,[old.rows[0].id],'correct');
 const m=engine.reimportBankRows(old,engine.readCsv(header+line+'\n'+line),()=> 'defer');
 const id=engine.pendingBankMatches(m)[0].id;
 tags.addTag(m,[id],'erreur');tags.removeTag(m,[id],'erreur');
 const restored=engine.resolveBankMatch(m,id,old.rows[0].id);
 assert.deepEqual(engine.manualTagsFor(restored,restored.rows.find(r=>r.id===old.rows[0].id)),['correct']);
});
