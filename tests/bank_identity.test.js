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
const header='Date;Banque;Compte;Libellé;Montant;Devise;Identifiant;Référence bancaire\n';
const a='2026-10-01;BPS;Courant;Courses;-25,00;EUR;old-a;';
const b='2026-10-02;BPS;Courant;Salaire;1000,00;EUR;old-b;';
const csv=(...lines)=>header+lines.join('\n');
const empty=()=>({rows:[],notes:{},references:{BPS:{date:'2026-10-02',balance:500}},rules:{}});
const importRows=(model,text,resolve)=>engine.reimportBankRows(model,engine.readCsv(text),resolve);

test('identité : réordonnancement, renommage des sources et tags manuels conservés',()=>{
 const m=importRows(empty(),csv(a,b)),id=m.rows[0].id;
 assert.match(id,/^[a-f0-9]{64}-0000$/);
 m.notes[id]={tags:['courses'],type:'ponctuel',custom:{x:1}};
 const restored=importRows(m,csv(b,a.replace('old-a','renamed-file-id')));
 assert.equal(restored.rows[1].id,id);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[1]),['courses']);
 assert.deepEqual(restored.notes[id],m.notes[id]);
 assert.equal(engine.totalBalance(restored,'2026-10-02'),engine.totalBalance(m,'2026-10-02'));
 assert.equal(engine.forecast(restored,'2026-10-02','2026-11-02').closing,engine.forecast(m,'2026-10-02','2026-11-02').closing);
});

test('identité : canonisation du libellé, du montant, compte et devise',()=>{
 const id=engine.readCsv(csv(a))[0].id;
 assert.equal(engine.readCsv(csv(a.replace('Courses','  COURSES  ').replace('-25,00','-25')))[0].id,id);
 for(const line of [a.replace('Courant','Épargne'),a.replace('EUR','USD'),a.replace('BPS','Autre banque')])assert.notEqual(engine.readCsv(csv(line))[0].id,id);
});

test('identité : import partiel, registre exporté et restauration sans perte des suffixes',()=>{
 const m=importRows(empty(),csv(a,b));m.notes[m.rows[0].id]={tags:['courses']};
 const partial=importRows(m,csv(b));assert.equal(partial.rows.length,1);
 const saved=JSON.parse(annotations.exportJson(partial));
 const restored=annotations.importInto(empty(),saved,tags);
 const full=importRows(restored,csv(b,a));
 assert.equal(full.rows[1].id,m.rows[0].id);assert.deepEqual(engine.tagsFor(full,full.rows[1]),['courses']);
 assert.equal(full.bankIdentities.length,2);
});

test('identité : migration des notes historiques complète et annotations orphelines préservées',()=>{
 const input=engine.readCsv(csv(a+'old-a',b+'old-b'));
 const legacy={notes:{'old-a|0':{tags:['ancien'],ruleId:'r',custom:42},opaque:{tags:['orphelin']}},references:{},rules:{}};
 const m=engine.mergeAnnotations(input,legacy);
 assert.deepEqual(m.notes[m.rows[0].id],legacy.notes['old-a|0']);
 assert.deepEqual(m.notes.opaque,legacy.notes.opaque);
 const exported=annotations.exportObject(m);
 assert.deepEqual(annotations.exportObject(annotations.importInto(m,exported,tags)),annotations.exportObject(tags.upgradeCategories(m)));
 assert.deepEqual(engine.mergeAnnotations(input,exported).notes,m.notes);
});

test('identité : doublons indiscernables demandent une résolution atomique',()=>{
 const m=empty(),before=JSON.stringify(m);
 assert.throws(()=>importRows(m,csv(a,a)),/ambigu/i);
 assert.equal(JSON.stringify(m),before);
 assert.throws(()=>importRows(m,csv(a,a),()=>null),/annul/i);
 const first=importRows(m,csv(a,a),()=> 'new');
 assert.equal(new Set(first.rows.map(r=>r.id)).size,2);
 assert.deepEqual(first.rows.map(r=>r.id.slice(-4)).sort(),['0000','0001']);
 first.notes[first.rows[0].id]={tags:['un']};first.notes[first.rows[1].id]={tags:['deux']};
 assert.throws(()=>importRows(first,csv(a)),/ambigu/i);
 const selected=importRows(first,csv(a),()=>first.rows[1].id);
 assert.deepEqual(engine.tagsFor(selected,selected.rows[0]),['deux']);
 assert.equal(selected.bankIdentities.length,2);
});

test('identité : références bancaires explicites distinguent les doublons indépendamment de leur ordre',()=>{
 const x=a+'ref-X',y=a+'ref-Y';
 const m=importRows(empty(),csv(x,y));m.notes[m.rows[0].id]={tags:['X']};
 const saved=annotations.exportObject(m);
 const restored=engine.mergeAnnotations(engine.readCsv(csv(y,x)),saved);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[1]),['X']);
 assert.equal(restored.rows[1].id,m.rows[0].id);
});

test('identité : collision avec une manuelle et conflit de notes refusés sans mutation',()=>{
 const rows=engine.readCsv(csv(a+'old-a'));
 const m={...empty(),rows:[{id:rows[0].id,manual:true,date:null,amount:5}]};
 const before=JSON.stringify(m);assert.throws(()=>engine.reimportBankRows(m,rows),/conflit|collision/i);assert.equal(JSON.stringify(m),before);
 assert.throws(()=>engine.mergeAnnotations(rows,{notes:{[rows[0].id]:{tags:['A']},'old-a|0':{tags:['B']}}}),/conflit/i);
});

test('identité : flottantes datées et annotations manuelles restent intactes',()=>{
 const manual={id:'uuid-manuel',manual:true,bank:'BPS',date:null,amount:-8,nature:'planned'};
 const m={...empty(),rows:[manual],notes:{'uuid-manuel':{tags:['IK']}}};
 const first=importRows(m,csv(a));first.rows.find(r=>r.manual).date='2026-11-01';
 const restored=engine.mergeAnnotations(engine.readCsv(csv(a)),annotations.exportObject(first));
 assert.equal(restored.rows.find(r=>r.manual).id,manual.id);
 assert.deepEqual(restored.notes[manual.id],m.notes[manual.id]);
 assert.equal(restored.rows.find(r=>r.manual).date,'2026-11-01');
});

test('identité : même résultat dans un navigateur sans require ni crypto et dans Node',()=>{
 const context={TextEncoder};vm.createContext(context);
 for(const file of ['normalize','identity','engine'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),context);
 const browser=context.QBudgetEngine.mergeAnnotations(context.QBudgetEngine.readCsv(csv(b,a)),{});
 assert.deepEqual(JSON.parse(JSON.stringify(browser)),engine.mergeAnnotations(engine.readCsv(csv(b,a)),{}));
});

test('identité : ancien modèle local migré avant ou pendant le réimport, sans perte de note',()=>{
 const legacy={...empty(),rows:[{id:'old-a|0',bank:'BPS',account:'BPS',date:'2026-10-01',desc:'Courses',amount:-25,currency:'EUR'}],notes:{'old-a|0':{tags:['ancien'],ruleId:'r'}}};
 for(const model of [legacy,engine.reimportBankRows(legacy,legacy.rows)]){
  const before=JSON.stringify(model),restored=importRows(model,csv(a));
  assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),['ancien']);
  assert.equal(restored.rows[0].sourceAccount,'Courant');
  assert.equal(restored.bankIdentities.length,1);
  assert.equal(JSON.stringify(model),before);
  const saved=annotations.exportObject(restored);
  assert.deepEqual(engine.mergeAnnotations(engine.readCsv(csv(a)),saved).notes,restored.notes);
 }
});

test('identité : restauration depuis le JSON seul après migration d’un compte source inconnu',()=>{
 const old={...empty(),rows:[{id:'ancien',bank:'BPS',account:'BPS',date:'2026-10-01',desc:'Courses',amount:-25}],notes:{ancien:{tags:['conservé']}}};
 const migrated=engine.reimportBankRows(old,old.rows);
 const saved=annotations.exportObject(migrated);
 const restored=engine.mergeAnnotations(engine.readCsv(csv(a)),saved);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),['conservé']);
});

test('identité : références bancaires nouvelles ne récupèrent pas les tags d’une autre occurrence',()=>{
 const m=importRows(empty(),csv(a+'ref-X'));m.notes[m.rows[0].id]={tags:['X']};
 const second=importRows(m,csv(a+'ref-Y'));
 assert.notEqual(second.rows[0].id,m.rows[0].id);
 assert.deepEqual(engine.tagsFor(second,second.rows[0]),[]);
 const restored=engine.mergeAnnotations(engine.readCsv(csv(a+'ref-Y',a+'ref-X')),annotations.exportObject(second));
 assert.deepEqual(engine.tagsFor(restored,restored.rows[1]),['X']);
});

test('identité : plusieurs comptes possibles lors de la migration exigent un choix',()=>{
 const old={...empty(),rows:[{id:'ancien',bank:'BPS',account:'BPS',date:'2026-10-01',desc:'Courses',amount:-25}],notes:{ancien:{tags:['Courant']}}};
 assert.throws(()=>importRows(old,csv(a,a.replace('Courant','Épargne'))),/ambigu/i);
 const resolved=importRows(old,csv(a,a.replace('Courant','Épargne')),issue=>issue.stage==='migration'?'Courant':'new');
 assert.deepEqual(engine.tagsFor(resolved,resolved.rows[0]),['Courant']);
 assert.deepEqual(engine.tagsFor(resolved,resolved.rows[1]),[]);
});

test('identité : les identifiants normalisés ne sont pas traités comme des références bancaires fiables',()=>{
 const line=a.replace('old-a','a'.repeat(20));
 const m=importRows(empty(),csv(line,line.replace('a'.repeat(20),'b'.repeat(20))),()=> 'new');
 assert.throws(()=>importRows(m,csv(line)),/ambigu/i);
});

test('identité : ancienne annotation importée après le CSV, alias persistants et rattachement manuel',()=>{
 const m=importRows(empty(),csv(a));
 const restored=annotations.importInto(m,{notes:{'old-a|0':{tags:['ancien']}},references:{}},tags);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),[]);
 assert.deepEqual(restored.notes['old-a|0'],{tags:['ancien']});
 restored.notes.opaque={tags:['orphelin']};
 restored.notes[restored.rows[0].id]={tags:['autre']};
 assert.throws(()=>engine.reassignAnnotation(restored,'opaque',restored.rows[0].id),/conflit/i);
 const fresh=importRows(empty(),csv(a));fresh.notes.opaque={tags:['orphelin']};
 const attached=engine.reassignAnnotation(fresh,'opaque',fresh.rows[0].id);
 const saved=annotations.exportObject(attached);
 assert.deepEqual(engine.mergeAnnotations(engine.readCsv(csv(a)),saved).notes,attached.notes);
 assert.ok(saved.bankIdentities[0].aliases.includes('opaque'));
});

test('identité : collision d’empreinte détectée, registre invalide refusé',()=>{
 const normalize=require('../src/normalize.js'),original=normalize.sha256Fallback;
 normalize.sha256Fallback=()=> '0'.repeat(64);
 try{assert.throws(()=>importRows(empty(),csv(a,b)),/collision/i)}finally{normalize.sha256Fallback=original}
 const m=importRows(empty(),csv(a));const saved=annotations.exportObject(m);
 saved.bankIdentities.push({...saved.bankIdentities[0]});
 assert.throws(()=>engine.mergeAnnotations(engine.readCsv(csv(a)),saved),/collision|invalide/i);
});

test('identité : doublons migrés sans compte source, sauvegarde seule puis import partiel ambigu',()=>{
 const old={...empty(),rows:[
  {id:'ancien-1',bank:'BPS',account:'BPS',date:'2026-10-01',desc:'Courses',amount:-25},
  {id:'ancien-2',bank:'BPS',account:'BPS',date:'2026-10-01',desc:'Courses',amount:-25}
 ],notes:{'ancien-1':{tags:['un']},'ancien-2':{tags:['deux']}}};
 const migrated=engine.reimportBankRows(old,old.rows,()=> 'new');
 const saved=annotations.exportObject(migrated);
 assert.throws(()=>engine.mergeAnnotations(engine.readCsv(csv(a)),saved),/ambigu/i);
 const selected=engine.mergeAnnotations(engine.readCsv(csv(a)),saved,issue=>issue.candidates.find(c=>c.note.tags?.includes('deux')).id);
 assert.deepEqual(engine.tagsFor(selected,selected.rows[0]),['deux']);
});

test('identité : collision d’une manuelle importée ou absente du CSV refusée',()=>{
 const m=importRows(empty(),csv(a)),id=m.rows[0].id;
 const manual={id,manual:true,amount:1,date:null};
 assert.throws(()=>engine.mergeAnnotations(engine.readCsv(csv(a)),{manualRows:[manual]}),/collision/i);
 assert.throws(()=>engine.reimportBankRows({...m,rows:[manual]},engine.readCsv(csv(b))),/collision/i);
 assert.throws(()=>engine.mergeAnnotations(engine.readCsv(csv(a+'old-a')),{
  manualRows:[{id:'old-a|0',manual:true,amount:1,date:null}],notes:{'old-a|0':{tags:['manuel']}}
 }),/conflit/i);
});

test('identité : migration répétable, projections, graphiques et audit financièrement inchangés',()=>{
 const old={...empty(),rows:[
  {id:'ancien-a',bank:'BPS',account:'BPS',date:'2026-10-01',desc:'Courses',amount:-25,currency:'EUR'},
  {id:'ancien-b',bank:'BPS',account:'BPS',date:'2026-10-02',desc:'Salaire',amount:1000,currency:'EUR'}
 ],notes:{'ancien-a':{tags:['courses'],ruleId:'r'},'ancien-b':{tags:['revenu']}},rules:{r:{id:'r',account:'BPS',desc:'Courses',amount:-25,frequency:'mensuel',anchor:'2026-10-01'}}};
 const imported=importRows(old,csv(b,a));
 assert.deepEqual(engine.reimportBankRows(imported,imported.rows),imported);
 assert.deepEqual(engine.forecast(imported,'2026-10-02','2026-12-31'),engine.forecast(old,'2026-10-02','2026-12-31'));
 const monetary=m=>engine.auditOperations(m,{scope:'all',at:'2026-10-02',until:'2026-12-31'}).map(({identifiant,...rest})=>rest);
 assert.deepEqual(monetary(imported),monetary(old));
 assert.deepEqual(engine.expenseBreakdown(imported,imported.rows),engine.expenseBreakdown(old,old.rows));
 assert.deepEqual(engine.expenseCategoryTotals(imported,imported.rows),engine.expenseCategoryTotals(old,old.rows));
 const options={at:'2026-10-02',until:'2026-12-31',startDate:'2026-09-30',filter:{tags:['courses']}};
 assert.deepEqual(engine.filteredImpact(imported,options),engine.filteredImpact(old,options));
});

test('identité : CSV sans compte source complété ultérieurement sans perdre les tags',()=>{
 const noAccount='Date;Banque;Libellé;Montant;Devise\n2026-10-01;BPS;Courses;-25;EUR';
 const m=importRows(empty(),noAccount);m.notes[m.rows[0].id]={tags:['conservé']};
 const restored=engine.mergeAnnotations(engine.readCsv(csv(a)),annotations.exportObject(m));
 assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),['conservé']);
});

test('identité : identifiant stable répété dans le CSV exige une décision, sans fusion',()=>{
 const m=importRows(empty(),csv(a));m.notes[m.rows[0].id]={tags:['original']};
 const line=a.replace('old-a',m.rows[0].id);
 assert.throws(()=>importRows(m,csv(line,line)),/ambigu/i);
 const restored=importRows(m,csv(line,line),()=> 'new');
 assert.equal(restored.rows.length,2);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),['original']);
 assert.deepEqual(engine.tagsFor(restored,restored.rows[1]),[]);
});

test('identité : un ancien JSON seul ne prouve pas l’identité d’un doublon devenu unique dans un import partiel',()=>{
 const sourceId='a'.repeat(20),line=a.replace('old-a',sourceId);
 const saved={notes:{[sourceId+'|0']:{tags:['première occurrence']}},references:{}};
 const m=engine.mergeAnnotations(engine.readCsv(csv(line)),saved);
 assert.deepEqual(engine.tagsFor(m,m.rows[0]),[]);
 assert.deepEqual(m.notes[sourceId+'|0'],saved.notes[sourceId+'|0']);
 assert.match(engine.check(m).warnings.join(' '),/annotation.*sans opération/);
 const attached=engine.reassignAnnotation(m,sourceId+'|0',m.rows[0].id);
 const restored=engine.mergeAnnotations(engine.readCsv(csv(line)),annotations.exportObject(attached));
 assert.deepEqual(engine.tagsFor(restored,restored.rows[0]),['première occurrence']);
});

test('identité : vrai chemin UI, annulation sans mutation et décision exportée réutilisée',()=>{
 const ui=fs.readFileSync('src/ui.js','utf8');
 const context={model:empty(),QBudgetEngine:engine,confirm:()=>true,resolveBankIdentity:()=>null,showOrphanAnnotations(){},clearChartSelection(){},clearBulkSelection(){},save(){},render(){}};
 vm.createContext(context);
 vm.runInContext(ui.slice(ui.indexOf('function applyBankRows(items){'),ui.indexOf("$('importRaw').onclick=")),context);
 const original=JSON.stringify(context.model);
 assert.throws(()=>context.applyBankRows(engine.readCsv(csv(a,a))),/annul/i);
 assert.equal(JSON.stringify(context.model),original);
 context.applyBankRows(engine.readCsv(csv(a+'ref-X',a+'ref-Y')));
 context.model.notes[context.model.rows[0].id]={tags:['X']};
 const saved=annotations.exportObject(context.model);
 context.model=annotations.importInto(empty(),saved,tags);
 context.resolveBankIdentity=()=>assert.fail('Aucune nouvelle confirmation attendue');
 context.applyBankRows(engine.readCsv(csv(a+'ref-Y',a+'ref-X')));
 assert.deepEqual(engine.tagsFor(context.model,context.model.rows[1]),['X']);
});

test('identité : CLI et REPL restaurent les notes et refusent les ambiguïtés sans modifier les fichiers',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qbudget-identity-'));
 try{
  const csvFile=path.join(dir,'operations.csv'),annFile=path.join(dir,'annotations.json');
  const m=importRows(empty(),csv(a,b));m.notes[m.rows[0].id]={tags:['conservé'],ruleId:'r'};
  const saved=annotations.exportJson(m);fs.writeFileSync(annFile,saved);fs.writeFileSync(csvFile,csv(b,a));
  const args=['--csv',csvFile,'--annotations',annFile,'--at','2026-10-02'];
  const cli=spawnSync(process.execPath,['src/cli.js','export',...args,'--scope','actual','--until','2026-10-02'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);assert.match(cli.stdout,new RegExp(m.rows[0].id+';r'));
  const repl=spawnSync(process.execPath,['src/cli.js','repl',...args,'--json'],{input:'check\nquit\n',encoding:'utf8'});
  assert.equal(repl.status,0,repl.stderr);assert.match(repl.stdout,/"ok": true/);
  fs.writeFileSync(csvFile,csv(a,a));
  const ambiguous=spawnSync(process.execPath,['src/cli.js','check',...args],{encoding:'utf8'});
  assert.equal(ambiguous.status,1);assert.match(ambiguous.stderr,/ambigu/i);
  assert.equal(fs.readFileSync(annFile,'utf8'),saved);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
