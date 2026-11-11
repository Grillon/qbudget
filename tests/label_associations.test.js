'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const engine=require('../src/engine.js');
const annotations=require('../src/annotations.js');
const tags=require('../src/tags.js');
const editor=require('../src/editor.js');
const csv=labels=>'Date;Banque;Compte;Libellé;Montant;Devise\n'+labels.map((label,i)=>`2026-11-${String(i+1).padStart(2,'0')};BPS;Courant;${label};-10,00;EUR`).join('\n');
function model(){
 const m=engine.mergeAnnotations(engine.readCsv(csv(['CB NETFLIX.COM','Prélèvement NFLX','ORANGE mobile','PANORAMA','SUPERORANGE','ORACLE'])),{});
 m.tagCategories=[{name:'Nature',tags:['Netflix','Orange'],source:'tags'}];
 m.references={BPS:{date:'2026-11-10',balance:1000}};
 return m;
}
const associations=()=>[{tag:'Netflix',patterns:['NETFLIX','NFLX']},{tag:'Orange',patterns:['ORANGE','ORA']}];

test('associations : OU, casse et limites de mots Unicode, sans recherche dans le compte ni les tags',()=>{
 const m=model();m.labelAssociations=associations();
 assert.deepEqual(m.rows.map(r=>engine.tagsFor(m,r)),[['Netflix'],['Netflix'],['Orange'],[],[],[]]);
 for(const desc of ['ORA','CB / ORA /','orange-mobile'])assert.ok(engine.automaticTagsFor(m,{desc}).includes('Orange'));
 for(const desc of ['PANORAMA','ORANGEADE','ORACLE','ÉORANGE','ORANGEÉ','𝔸ORANGE','ORANGE_ABC'])assert.deepEqual(engine.automaticTagsFor(m,{desc}),[]);
 assert.deepEqual(engine.automaticTagsFor(m,{desc:'Autre',bank:'NETFLIX',category:'Netflix'}),[]);
});

test('associations : expressions littérales, espaces et Unicode normalisés, aucun langage Regex implicite',()=>{
 const m=model();m.labelAssociations=[{tag:'Netflix',patterns:['CAFÉ   PARIS','A+B','[TEST]']}];
 for(const desc of ['cb Cafe\u0301 Paris','paiement A+B','libellé [TEST]'])assert.deepEqual(engine.automaticTagsFor(m,{desc}),['Netflix']);
 for(const desc of ['AAAB','T','CAFE PARIS'])assert.deepEqual(engine.automaticTagsFor(m,{desc}),[]);
});

test('associations : modification et suppression recalculent les tags sans changer les annotations manuelles',()=>{
 const m=model(),r=m.rows[0];m.notes[r.id]={tags:['personnel','NETFLIX'],tag:'personnel',ruleId:'ancien',extra:{x:1}};
 const before=JSON.stringify(m.notes);m.labelAssociations=associations();
 assert.deepEqual(engine.manualTagsFor(m,r),['personnel','NETFLIX']);
 assert.deepEqual(engine.tagsFor(m,r),['personnel','NETFLIX']);
 m.labelAssociations[0].patterns=['AUTRE'];
 assert.deepEqual(engine.automaticTagsFor(m,r),[]);
 m.labelAssociations=[];
 assert.deepEqual(engine.tagsFor(m,r),['personnel','NETFLIX']);
 assert.equal(JSON.stringify(m.notes),before);
});

test('associations : ajouter explicitement un tag déjà automatique le conserve comme tag manuel',()=>{
 const m=model(),row=m.rows[0];m.labelAssociations=associations();
 assert.deepEqual(engine.manualTagsFor(m,row),[]);
 assert.equal(tags.addTag(m,[row.id],'Netflix').changed,1);
 m.labelAssociations=[];
 assert.deepEqual(engine.tagsFor(m,row),['Netflix']);
});

test('associations : classement des échéances calculées sans historique, sans nouvelle règle ni montant changé',()=>{
 const m=model();m.labelAssociations=associations();
 m.rules={r:{id:'r',account:'BPS',desc:'NFLX',amount:-12,frequency:'mensuel',anchor:'2026-11-01'}};
 const before=JSON.stringify(m);
 const preview=engine.recurrencePreview(m,'2026-11-10','2026-12-10');
 assert.equal(preview.length,1);assert.deepEqual(preview[0].tags,['Netflix']);assert.equal(preview[0].amount,-12);
 assert.equal(JSON.stringify(m),before);
});

test('associations : aperçu pur sur toutes les opérations, y compris les flottantes',()=>{
 const m=model();m.rows.push({id:'flottante',manual:true,date:null,bank:'BPS',desc:'NETFLIX',amount:-15});
 const before=JSON.stringify(m);
 const rows=engine.labelAssociationPreview(m,associations()[0]);
 assert.equal(rows.length,3);assert.ok(rows.some(r=>r.id==='flottante'));
 assert.equal(JSON.stringify(m),before);assert.deepEqual(engine.tagsFor(m,m.rows[0]),[]);
});

test('associations : les imports futurs et réordonnés réutilisent les règles et les notes manuelles',()=>{
 const m=model();m.labelAssociations=associations();m.notes[m.rows[0].id]={tags:['personnel']};
 const incoming=engine.readCsv(csv(['CB NETFLIX.COM','Prélèvement NFLX','ORANGE mobile','PANORAMA','SUPERORANGE','ORACLE','ABONNEMENT NFLX'])).reverse();
 const restored=engine.reimportBankRows(m,incoming);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),['Netflix']);
 assert.deepEqual(engine.tagsFor(restored,restored.rows.at(-1)),['personnel','Netflix']);
 assert.equal(restored.rows.at(-1).id,m.rows[0].id);
});

test('associations : export/rechargement, champs inconnus et vieux fichiers sans associations',()=>{
 const m=model();m.labelAssociations=associations();m.annotationExtras={custom:{x:1}};
 const saved=JSON.parse(annotations.exportJson(m));
 assert.deepEqual(saved.labelAssociations,associations());
 const restored=annotations.importInto({rows:[],notes:{},references:{}},saved,tags);
 const loaded=engine.reimportBankRows(restored,engine.readCsv(csv(['CB NETFLIX.COM'])));
 assert.deepEqual(engine.tagsFor(loaded,loaded.rows[0]),['Netflix']);
 assert.deepEqual(annotations.exportObject(loaded).custom,{x:1});
 const cli=engine.mergeAnnotations(engine.readCsv(csv(['CB NETFLIX.COM'])),saved);
 assert.deepEqual(engine.tagsFor(cli,cli.rows[0]),['Netflix']);
 delete saved.labelAssociations;
 assert.deepEqual(annotations.importInto(m,saved,tags).labelAssociations,[]);
});

test('associations : validation et import invalides atomiques',()=>{
 const m=model(),before=JSON.stringify(m);
 for(const input of [null,{},[{tag:'',patterns:['A']}],[{tag:'A,B',patterns:['A']}],[{tag:'A',patterns:[]}],[{tag:'A',patterns:['']}],[{tag:'A',patterns:'NETFLIX'}],[{tag:'A',patterns:['X']},{tag:'a',patterns:['Y']}]]){
  assert.throws(()=>engine.validateLabelAssociations(input));
  assert.throws(()=>annotations.importInto(m,{notes:{},references:{},labelAssociations:input},tags));
 }
 assert.equal(JSON.stringify(m),before);
 assert.deepEqual(engine.validateLabelAssociations([{tag:' Netflix ',patterns:[' NETFLIX ','netflix',' NFLX ']}]),[{tag:'Netflix',patterns:['NETFLIX','NFLX']}]);
});

test('associations : filtres, éditeur et graphiques utilisent les tags effectifs, sans multiplier les dépenses',()=>{
 const m=model();m.labelAssociations=associations();
 assert.equal(m.rows.filter(r=>engine.operationMatchesFilter(m,r,{tags:['Netflix']})).length,2);
 assert.match(editor.itemList(m).find(i=>i.id===m.rows[0].id).search,/Netflix/);
 assert.deepEqual(engine.expenseCategoryTotals(m,m.rows,'Nature'),[['Non renseigné',30],['Netflix',20],['Orange',10]]);
 assert.equal(engine.expenseBreakdown(m,m.rows,['Nature']).values[0],60);
});

test('associations : identifiants, libellés originaux, soldes, règles et montants d’audit inchangés',()=>{
 const m=model();m.rules={r:{id:'r',account:'BPS',desc:'NETFLIX',amount:-10,frequency:'mensuel',anchor:'2026-11-01'}};
 m.notes[m.rows[0].id]={tags:['personnel'],ruleId:'r'};
 const before=JSON.stringify(m),forecast=engine.forecast(m,'2026-11-10','2027-01-01');
 const audit=engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-10',until:'2027-01-01'}));
 m.labelAssociations=associations();
 assert.equal(engine.totalBalance(m,'2026-11-10'),1000);
 assert.deepEqual(engine.forecast(m,'2026-11-10','2027-01-01'),forecast);
 assert.equal(engine.auditCsv(engine.auditOperations(m,{scope:'all',at:'2026-11-10',until:'2027-01-01'})),audit);
 assert.deepEqual(m.rows,JSON.parse(before).rows);
 assert.deepEqual(m.notes,JSON.parse(before).notes);
 assert.deepEqual(m.rules,JSON.parse(before).rules);
 m.labelAssociations=[];
 assert.deepEqual(engine.recurrencePreview(m,'2026-11-10','2027-01-01')[0].tags,['personnel']);
});

test('associations : même classement dans Node et un navigateur sans require',()=>{
 const m=model();m.labelAssociations=associations();
 const context={TextEncoder};vm.createContext(context);
 for(const file of ['normalize','identity','engine'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),context);
 const result=vm.runInContext(`QBudgetEngine.tagsFor(${JSON.stringify(m)},${JSON.stringify(m.rows[0])})`,context);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),engine.tagsFor(m,m.rows[0]));
});

test('associations : le CLI charge le même format et refuse une association invalide sans écrire les fichiers',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-associations-'));
 try{
  const input=path.join(dir,'operations.csv'),settings=path.join(dir,'annotations.json');
  fs.writeFileSync(input,csv(['NETFLIX']));
  const m=model();m.labelAssociations=associations();const saved=annotations.exportObject(m);
  fs.writeFileSync(settings,JSON.stringify(saved));
  const run=()=>spawnSync(process.execPath,['src/cli.js','check','--csv',input,'--annotations',settings,'--json'],{encoding:'utf8'});
  const valid=run();assert.equal(valid.status,0,valid.stderr);assert.equal(JSON.parse(valid.stdout).ok,true);
  saved.labelAssociations[0].patterns=[];const invalid=JSON.stringify(saved);fs.writeFileSync(settings,invalid);
  const refused=run();assert.equal(refused.status,1);assert.match(refused.stderr,/motif/i);
  assert.equal(fs.readFileSync(settings,'utf8'),invalid);assert.equal(fs.readFileSync(input,'utf8'),csv(['NETFLIX']));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
