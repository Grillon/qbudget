(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.QBudgetEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const identity=root.QBudgetIdentity||(typeof require==='function'?require('./identity.js'):null);
const transfers=()=>root.QBudgetTransfers||(typeof require==='function'?require('./transfers.js'):null);
const recurrences=()=>root.QBudgetRecurrences||(typeof require==='function'?require('./recurrences.js'):null);
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00'));
function dateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function asDate(s){return new Date(s+'T12:00:00')}

function parseCsv(src,sep){let rows=[],row=[],field='',quoted=false;for(let i=0;i<src.length;i++){const c=src[i];if(quoted){if(c==='"'&&src[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===sep){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}else field+=c}if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}return rows}
function readCsv(raw){raw=raw.replace(/^\ufeff/,'');const first=raw.split(/\r?\n/,1)[0],sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';const cells=parseCsv(raw,sep);if(cells.length<2)throw Error('Fichier vide');const heads=cells.shift().map(x=>x.trim().toLowerCase());const get=(r,n)=>r[heads.indexOf(n)]||'';for(const col of ['date','banque','libellé','montant'])if(!heads.includes(col))throw Error('Colonne absente : '+col);return identity.prepare(cells.filter(r=>r.some(x=>x.trim())).map((r,i)=>{const date=get(r,'date'),rawAmount=get(r,'montant').replace(/\s/g,'').replace(',','.'),montant=Number(rawAmount);if(!validDate(date)||rawAmount===''||!Number.isFinite(montant))throw Error('Date ou montant invalide, ligne '+(i+2));const bank=get(r,'banque').trim(),account=bank,desc=get(r,'libellé');const signature=get(r,'identifiant')||`${bank}|${account}|${date}|${desc}|${montant}|${i}`;return {id:`${signature}|${i}`,legacyId:`${signature}|${i}`,sourceId:get(r,'identifiant'),sourceAccount:get(r,'compte').trim()||undefined,identityAmount:identity.canonicalAmount(rawAmount),bankReference:get(r,'référence bancaire').trim(),bank,account,date,desc,currency:get(r,'devise')||'EUR',amount:montant,balance:null,category:get(r,'catégorie'),duplicate:get(r,'doublon potentiel')}}))}
function mergeAnnotations(rows,annotations={},resolve){
 if(!annotations||typeof annotations!=='object'||Array.isArray(annotations))throw Error('Annotations JSON invalides');
 const manual=annotations.manualRows||[];
 for(const r of manual)if(rows.some(old=>!old.manual&&old.bank!==undefined&&old.desc!==undefined&&old.id===r.id))throw Error('Collision entre opération bancaire et manuelle');
 const result={rows:[...rows.filter(r=>r.manual),...manual.filter(r=>!rows.some(old=>old.id===r.id)).map(r=>({...r}))],notes:annotations.notes||{},references:annotations.references||{},rules:annotations.rules||{},accounts:annotations.accounts||[],excludedAccounts:annotations.excludedAccounts||[],tagCategories:Array.isArray(annotations.tagCategories)?annotations.tagCategories:[],labelAssociations:validateLabelAssociations(annotations.labelAssociations===undefined?[]:annotations.labelAssociations),...(annotations.transferBacklog!==undefined?{transferBacklog:transfers().validate(annotations.transferBacklog)}:{}),...(annotations.recurrenceBacklog!==undefined?{recurrenceBacklog:recurrences().validate(annotations.recurrenceBacklog)}:{}),...(annotations.bankIdentities!==undefined?{bankIdentities:annotations.bankIdentities}:{})};
 return identity.reconcile(result,rows,resolve);
}
function reimportBankRows(model,rows,resolve){return identity.reconcile({...model,labelAssociations:validateLabelAssociations(model.labelAssociations===undefined?[]:model.labelAssociations)},rows,resolve)}
function pendingBankMatches(model){return identity.pendingMatches(model)}
function resolveBankMatch(model,id,choice){return identity.resolvePending(model,id,choice)}
function reassignAnnotation(model,from,to){
 if(!model.rows.some(r=>r.id===to))throw Error('Opération cible introuvable');
 if(from===to||!Object.hasOwn(model.notes||{},from))throw Error('Annotation source introuvable');
 const notes={...model.notes};identity.moveNote(notes,from,to);
 const bankIdentities=(model.bankIdentities||[]).map(e=>e.id===to?{...e,aliases:[...new Set([...e.aliases,from])]}:e);
 return {...model,notes,bankIdentities};
}

// A pending operation is intentionally without date; it is never a cash movement.
function isFloating(row){return row.date===null||row.date===undefined||row.date===''}
function accountNames(model){return [...new Set([...(model.accounts||[]),...Object.keys(model.references||{}),...(model.rows||[]).map(r=>r.bank).filter(Boolean)])].sort()}
function cashAccountNames(model){return [...new Set([...(model.accounts||[]),...Object.keys(model.references||{}),...(model.rows||[]).filter(r=>!isFloating(r)).map(r=>r.bank).filter(Boolean)])].sort()}
// An excluded account is still a real account, searchable and independently forecast.
// Only implicit global calculations omit it. Audit exports remain exhaustive.
function includedAccountNames(model){const excluded=new Set(model.excludedAccounts||[]);return cashAccountNames(model).filter(name=>!excluded.has(name))}
function excludedAccountNames(model){const excluded=new Set(model.excludedAccounts||[]);return cashAccountNames(model).filter(name=>excluded.has(name))}
function manualTagsFor(model,row){const note=model.notes?.[row.id]||{};return [...new Set([...(Array.isArray(note.tags)?note.tags:[]),...(typeof note.tag==='string'?note.tag.split(','):[])].map(t=>String(t).trim()).filter(Boolean))]}
function uniqueTags(values){const seen=new Set();return values.filter(tag=>{const key=fold(tag);if(seen.has(key))return false;seen.add(key);return true})}
function tagsFor(model,row){return uniqueTags([...manualTagsFor(model,row),...automaticTagsFor(model,row)])}
// Le dictionnaire de tags est une lecture sémantique : il ne modifie jamais les écritures.
// Une catégorie peut afficher le champ de périodicité déjà existant (source='type').
const fold = x => String(x||'').trim().toLocaleLowerCase('fr');
const normalizeLabel = x => String(x??'').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('fr');
function validateLabelAssociations(input){
 if(!Array.isArray(input))throw Error('Liste d’associations de libellés invalide');
 const seen=new Set();
 return input.map(item=>{
  if(typeof item?.tag!=='string'||!item.tag.trim()||item.tag.includes(','))throw Error('Un tag est requis pour chaque association, sans virgule');
  const tag=item.tag.trim();
  if(seen.has(fold(tag)))throw Error('Une association existe déjà pour le tag « '+tag+' »');
  seen.add(fold(tag));
  if(!Array.isArray(item.patterns)||!item.patterns.length||item.patterns.some(p=>typeof p!=='string'||!p.trim()))throw Error('Au moins un motif de libellé est requis');
  const patterns=[],patternKeys=new Set();
  for(const pattern of item.patterns){const key=normalizeLabel(pattern);if(!patternKeys.has(key)){patternKeys.add(key);patterns.push(pattern.trim().replace(/\s+/gu,' '))}}
  return {tag,patterns};
 });
}
function compileLabelAssociation(association){
 const word=/[\p{L}\p{M}\p{N}_]/u;
 return {tag:association.tag,patterns:association.patterns.map(value=>{
  const text=normalizeLabel(value),chars=[...text],escaped=text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp((word.test(chars[0])?'(?:^|[^\\p{L}\\p{M}\\p{N}_])':'')+escaped+(word.test(chars.at(-1))?'(?=$|[^\\p{L}\\p{M}\\p{N}_])':''),'u');
 })};
}
const labelAssociationCache=new WeakMap();
function automaticTagsFor(model,row){
 const input=model.labelAssociations;
 if(!input?.length)return [];
 const signature=JSON.stringify(input);let cached=labelAssociationCache.get(input);
 if(!cached||cached.signature!==signature){cached={signature,compiled:validateLabelAssociations(input).map(compileLabelAssociation)};labelAssociationCache.set(input,cached)}
 const text=normalizeLabel(row.desc);
 return cached.compiled.filter(a=>a.patterns.some(pattern=>pattern.test(text))).map(a=>a.tag);
}
function labelAssociationPreview(model,association){
 const compiled=compileLabelAssociation(validateLabelAssociations([association])[0]);
 return (model.rows||[]).filter(row=>!row.forecast&&compiled.patterns.some(pattern=>pattern.test(normalizeLabel(row.desc))));
}
function knownTags(model){
 const values=[...(model.tagCategories||[]).flatMap(c=>c.tags||[]),...Object.keys(model.notes||{}).flatMap(id=>manualTagsFor(model,{id})),...(model.labelAssociations||[]).map(a=>a.tag)];
 return [...new Map(values.map(t=>[fold(t),t])).values()].sort((a,b)=>a.localeCompare(b,'fr'));
}
function tagCategories(model){return Array.isArray(model.tagCategories)?model.tagCategories:[]}
function rowTags(model,row){return row.forecast?(row.tags||[]):tagsFor(model,row)}
function operationType(model,row){return row.forecast?'recurrent':(model.notes?.[row.id]?.type||'')}
function tagsByCategory(model,row,category){
 const raw=rowTags(model,row),allowed=new Set((category.tags||[]).map(fold));
 const tagged=raw.filter(t=>allowed.has(fold(t)));
 if(category.source==='type'&&tagged.length===0){
  const type=operationType(model,row);
  if(type==='recurrent')return ['Récurrent'];
  if(type==='ponctuel')return ['Ponctuel'];
 }
 return tagged;
}
function organizedTags(model,row){
 const categories=tagCategories(model),raw=rowTags(model,row);
 const assigned=new Set(categories.flatMap(c=>(c.tags||[]).map(fold)));
 const values=categories.map(c=>({name:c.name,values:tagsByCategory(model,row,c)}));
 return {values,other:raw.filter(t=>!assigned.has(fold(t)))};
}
// La visualisation donne UNE destination à chaque montant dans chaque dimension.
// Si plusieurs tags coexistent dans une même catégorie, le tableau les montre tous,
// et le graphique retient le premier tag de cette catégorie (ordre des tags saisis).
function expenseBreakdown(model,rows,dimensions=[]){
 const chosen=dimensions.map(name=>tagCategories(model).find(c=>c.name===name)).filter(Boolean);
 const nodes=new Map();
 const root={id:'total',label:'Dépenses',parent:'',value:0};nodes.set(root.id,root);
 for(const row of rows){
  const value=-Number(row.amount);
  if(!(value>0))continue;
  root.value+=value;
  let path=[],parent='total';
  const labels=chosen.length?chosen.map(c=>tagsByCategory(model,row,c)[0]||'Non renseigné'):[rowTags(model,row)[0]||row.category||'Sans tag',(row.desc||'Sans libellé').trim()||'Sans libellé'];
  for(const label of labels){
   path.push(label);
   const id=JSON.stringify(path);
   let node=nodes.get(id);
   if(!node){node={id,label,parent,value:0};nodes.set(id,node)}
   node.value+=value;parent=id;
  }
 }
 const data=[...nodes.values()];
 return {ids:data.map(n=>n.id),labels:data.map(n=>n.label),parents:data.map(n=>n.parent),values:data.map(n=>Math.round(n.value*100)/100)};
}
function expenseCategoryTotals(model,rows,categoryName=''){
 const category=tagCategories(model).find(c=>c.name===categoryName);
 const totals=new Map();
 for(const row of rows){
  if(!(Number(row.amount)<0))continue;
  const label=category?(tagsByCategory(model,row,category)[0]||'Non renseigné'):(rowTags(model,row)[0]||row.category||'Sans tag');
  totals.set(label,Math.round(((totals.get(label)||0)-Number(row.amount))*100)/100);
 }
 return [...totals.entries()].sort((a,b)=>b[1]-a[1]);
}
function validateTagCategories(input){
 if(!Array.isArray(input))throw Error('Liste de catégories invalide');
 const categoryNames=new Set(),tagsSeen=new Map();
 return input.map(item=>{
  const name=String(item?.name||'').trim(),source=item?.source==='type'?'type':'tags';
  if(!name)throw Error('Nom de catégorie requis');
  if(categoryNames.has(fold(name)))throw Error('Catégorie en double : '+name);
  categoryNames.add(fold(name));
  if(!Array.isArray(item?.tags))throw Error('Liste de tags invalide : '+name);
  const tags=[...new Map(item.tags.map(t=>String(t).trim()).filter(Boolean).map(t=>[fold(t),t])).values()];
  for(const tag of tags){if(tagsSeen.has(fold(tag)))throw Error('Le tag « '+tag+' » appartient déjà à « '+tagsSeen.get(fold(tag))+' »');tagsSeen.set(fold(tag),name)}
  return {name,tags,source};
 });
}
// Recherche native du navigateur : même critère pour tableau, analyses et impact.
// L'expression est compilée UNE fois par rafraîchissement côté interface.
function compileSearch(search='',mode='text'){
 if(mode!=='regex'||!String(search).trim())return null;
 const source=String(search).trim();
 if(source.length>250)throw Error('Regex trop longue (250 caractères maximum).');
 try{return new RegExp(source,'i')}catch(e){throw Error('Regex invalide : '+e.message)}
}
// Filtre unique pour le tableau, les analyses et l'impact sur le graphique.
// Les tags ne créent aucune logique métier ni multiplication des montants.
function operationMatchesFilter(model,row,{search='',searchMode='text',searchRegex=null,type='',tags=[],tagMode='all'}={}){
 const rowTags=(row.forecast?(row.tags||[]):tagsFor(model,row)).map(t=>String(t).toLocaleLowerCase('fr'));
 const wanted=tags.map(t=>String(t).trim().toLocaleLowerCase('fr')).filter(Boolean);
 if(wanted.length&&!(tagMode==='any'?wanted.some(t=>rowTags.includes(t)):wanted.every(t=>rowTags.includes(t))))return false;
 const kind=row.forecast?'recurrent':(model.notes?.[row.id]?.type||'');
 if(type&&kind!==type)return false;
 const term=String(search).trim();
 if(!term)return true;
 const fields=[row.desc,row.bank,row.account,row.currency,...rowTags,...(row.forecast?['prévision récurrente','forecast']:[])];
 if(searchMode==='regex'){
  const regex=searchRegex||compileSearch(term,'regex');
  return fields.some(x=>regex.test(String(x||'')));
 }
 const lowered=term.toLocaleLowerCase('fr');
 return fields.some(x=>String(x||'').toLocaleLowerCase('fr').includes(lowered));
}
function hasOperationFilter({search='',type='',tags=[]}={}){
 return !!(String(search).trim()||String(type).trim()||tags.some(t=>String(t).trim()));
}
// Série analytique : cumul SIGNÉ des opérations sélectionnées, partant de 0.
// Elle ne constitue JAMAIS un solde bancaire et n'altère ni comptes ni écritures.
function filteredImpact(model,{at,until,account='',startDate=at,filter={},includeRecurrences=true}={}){
 if(!validDate(at)||!validDate(until)||!validDate(startDate))throw Error('Dates de l’impact filtré invalides');
 const scope=new Set(account?[account]:includedAccountNames(model));
 const selected=(model.rows||[]).filter(r=>scope.has(r.bank)&&!isFloating(r)&&(!r.currency||r.currency==='EUR')&&operationMatchesFilter(model,r,filter));
 const past=selected.filter(r=>r.date>startDate&&r.date<=at&&r.nature!=='planned');
 const future=selected.filter(r=>r.date>at&&r.date<=until);
 if(includeRecurrences&&until>=at){
  for(const r of recurrencePreview(model,at,until,account))if(scope.has(r.bank)&&operationMatchesFilter(model,r,filter))future.push(r);
 }
 const byDate=rows=>{
  const result=new Map();for(const r of rows)result.set(r.date,(result.get(r.date)||0)+Number(r.amount));
  return [...result].sort(([a],[b])=>a.localeCompare(b));
 };
 let sum=0;
 const history=[{date:startDate,value:0}];
 for(const [date,value] of byDate(past)){sum=Math.round((sum+value)*100)/100;history.push({date,value:sum})}
 if(startDate<at&&history[history.length-1].date!==at)history.push({date:at,value:sum});
 const opening=sum,projection=[{date:at,value:sum}];
 for(const [date,value] of byDate(future)){sum=Math.round((sum+value)*100)/100;projection.push({date,value:sum})}
 if(until>at&&projection[projection.length-1].date!==until)projection.push({date:until,value:sum});
 return {history,projection,opening,closing:sum,actualCount:past.length,futureCount:future.length};
}
function pendingOperations(model,{account='',tags=[],mode='all',search=''}={}){
 if(!['all','any'].includes(mode))throw Error('Mode de filtrage attendu : all ou any');
 const wanted=tags.map(t=>String(t).trim().toLocaleLowerCase('fr')).filter(Boolean);
 const term=String(search).trim().toLocaleLowerCase('fr');
 return (model.rows||[]).filter(r=>isFloating(r)&&(!account||r.bank===account)).filter(r=>{
  const rowTags=tagsFor(model,r).map(t=>t.toLocaleLowerCase('fr'));
  const matching=!wanted.length||(mode==='any'?wanted.some(t=>rowTags.includes(t)):wanted.every(t=>rowTags.includes(t)));
  return matching&&(!term||[r.desc,r.bank,...rowTags].some(x=>String(x||'').toLocaleLowerCase('fr').includes(term)));
 });
}
function balanceAt(rows, reference, date){
 if(!reference||!validDate(reference.date)||!Number.isFinite(Number(reference.balance))||!validDate(date))return null;
 let result=Number(reference.balance);
 for(const row of rows){if(row.nature==='planned'||isFloating(row))continue;
  if(row.date>reference.date&&row.date<=date)result+=Number(row.amount);
  if(row.date<=reference.date&&row.date>date)result-=Number(row.amount);
 }
 return Math.round(result*100)/100;
}
function totalBalance(model,date,account=''){
 const accounts=account?[account]:includedAccountNames(model);
 if(!accounts.length)return account||!cashAccountNames(model).length?null:0;
 let total=0;
 for(const bank of accounts){const value=balanceAt(model.rows.filter(r=>r.bank===bank),model.references[bank],date);if(value===null)return null;total+=value;}
 return Math.round(total*100)/100;
}
function shiftDate(iso,frequency,k){const d=asDate(iso);if(!validDate(iso))throw Error('Invalid anchor date');
 if(frequency==='quotidien'||frequency==='hebdomadaire'){d.setDate(d.getDate()+(frequency==='quotidien'?1:7)*k);return dateStr(d)}
 const step=({mensuel:1,trimestriel:3,annuel:12})[frequency];if(!step)throw Error('Unknown frequency: '+frequency);
 let m=d.getMonth()+step*k,y=d.getFullYear()+Math.floor(m/12);m=((m%12)+12)%12;
 return dateStr(new Date(y,m,Math.min(d.getDate(),new Date(y,m+1,0).getDate()),12));
}
function recurrenceEvents(model,start,end,account=''){
 const scope=new Set(account?[account]:includedAccountNames(model));
 const rows=model.rows.filter(r=>scope.has(r.bank)),events=[];
 for(const rule of Object.values(model.rules||{})){
  if(!scope.has(rule.account))continue;
  const anchor=rule.anchor||rule.start;if(!anchor)continue;
  for(let k=1;k<=600;k++){const d=shiftDate(anchor,rule.frequency||'mensuel',k);if(d>end)break;if(rule.end&&d>rule.end)break;if(d>start)events.push({date:d,amount:Number(rule.amount),desc:rule.desc,ruleId:rule.id,account:rule.account})}
 }
 for(const row of rows.filter(r=>!isFloating(r)&&r.date>start&&r.date<=end)){
  // Une opération datée et l’échéance calculée restent visibles toutes les deux.
  // Aucun rapprochement automatique : l’utilisateur décide.
  events.push({date:row.date,amount:Number(row.amount),desc:row.desc,account:row.bank});
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date));
}
function forecast(model,at,until,account='',overrides={}){
 // Overrides act on a copy only, leaving saved model untouched.
 const simulated={...model,rules:Object.fromEntries(Object.entries(model.rules||{}).map(([id,r])=>[id,{...r}]))};
 for(const [ruleId,fields] of Object.entries(overrides.rules||{})){if(!simulated.rules[ruleId])throw Error('Unknown rule '+ruleId);Object.assign(simulated.rules[ruleId],fields)}
 const balance=totalBalance(simulated,at,account),events=recurrenceEvents(simulated,at,until,account);
 let running=balance;const timeline=events.map(e=>({...e,balance:running===null?null:(running=Math.round((running+e.amount)*100)/100)}));
 return {account:account||'all',at,until,opening:balance,closing:running,minimum:running===null?null:Math.min(balance,...timeline.map(e=>e.balance)),events:timeline};
}
// CSV d'audit deterministe : les ecritures bancaires sont conservees, jamais dedupliquees.
const AUDIT_HEADERS=['date','compte','libelle','montant','devise','origine','identifiant','recurrence_id'];
function auditOperations(model,{scope='all',at,until,account='',overrides={}}={}){
 if(!['actual','all'].includes(scope))throw Error('Scope attendu : actual ou all');
 if(!validDate(until))throw Error('Date --until invalide');
 if(scope==='all'&&!validDate(at))throw Error('Date --at invalide');
 const saved=(model.rows||[]).filter(r=>!isFloating(r)&&(!account||r.bank===account)&&r.date<=until);
 const records=[];
 for(const row of saved){
  if(scope==='actual'&&row.nature==='planned')continue;
  const note=model.notes?.[row.id]||{};
  records.push({date:row.date,compte:row.bank||row.account||'',libelle:row.desc||'',montant:Number(row.amount),devise:row.currency||'EUR',origine:row.nature==='planned'?'manuel_prevu':row.nature==='manual'?'manuel':'reel',identifiant:String(row.id||''),recurrence_id:note.ruleId||''});
 }
 if(scope==='all'){
  const rules=Object.fromEntries(Object.entries(model.rules||{}).map(([id,r])=>[id,{...r}]));
  for(const [id,fields] of Object.entries(overrides.rules||{})){
   if(!rules[id])throw Error('Unknown rule '+id);
   Object.assign(rules[id],fields);
  }
  const banks=new Set(cashAccountNames(model));
  for(const [id,rule] of Object.entries(rules)){
   if(account&&rule.account!==account)continue;
   if(!banks.has(rule.account))continue;
   const anchor=rule.anchor||rule.start;
   if(!anchor||!validDate(anchor))continue;
   for(let k=1;k<=600;k++){
    const date=shiftDate(anchor,rule.frequency||'mensuel',k);
    if(date>until)break;
    if(rule.end&&date>rule.end)break;
    if(date<=at)continue;
    records.push({date,compte:rule.account,libelle:rule.desc||'',montant:Number(rule.amount),devise:'EUR',origine:'recurrence',identifiant:`rec:${id}:${date}`,recurrence_id:id});
   }
  }
 }
 records.sort((a,b)=>a.date.localeCompare(b.date)||a.compte.localeCompare(b.compte)||a.identifiant.localeCompare(b.identifiant)||a.origine.localeCompare(b.origine));
 return records;
}
// Vue en lecture seule, construite depuis le même audit déterministe que le CLI.
// Une échéance récurrente est calculée à la volée, jamais ajoutée au modèle.
function recurrencePreview(model,at,until,account=''){
 if(!validDate(at)||!validDate(until)||until<at)return [];
 const tagsByRule=new Map();
 for(const row of model.rows||[]){
  const id=model.notes?.[row.id]?.ruleId;
  if(!id)continue;
  const tags=tagsFor(model,row);
  if(!tagsByRule.has(id)||row.date>(tagsByRule.get(id).date||''))tagsByRule.set(id,{date:row.date,tags});
 }
 return auditOperations(model,{scope:'all',at,until,account})
  .filter(row=>row.origine==='recurrence')
  .map(row=>({id:row.identifiant,bank:row.compte,account:row.compte,
   date:row.date,amount:row.montant,desc:row.libelle,ruleId:row.recurrence_id,
   tags:tagsByRule.get(row.recurrence_id)?.tags||[],forecast:true}))
  .map(row=>({...row,tags:uniqueTags([...row.tags,...automaticTagsFor(model,row)])}));
}
function auditCsv(records){
 const quote=v=>{const text=String(v??'');return /[;"\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text};
 const amount=n=>{if(!Number.isFinite(n))throw Error('Montant invalide dans export');return n.toFixed(2).replace('.',',')};
 const lines=[AUDIT_HEADERS.join(';')];
 for(const r of records)lines.push(AUDIT_HEADERS.map(h=>quote(h==='montant'?amount(r.montant):r[h])).join(';'));
 return lines.join('\n')+'\n';
}
function check(model){const errors=[],warnings=[];
 for(const [bank,ref] of Object.entries(model.references||{}))if(!validDate(ref.date)||!Number.isFinite(Number(ref.balance)))errors.push('Invalid reference for '+bank);
 for(const r of model.rows||[]){
  if(!Number.isFinite(Number(r.amount))||r.amount===null||r.amount==='')errors.push('Invalid amount '+(r.id||r.desc));
  if(isFloating(r)){if(!r.manual||r.nature==='actual')errors.push('Invalid floating transaction '+(r.id||r.desc));}
  else if(!validDate(r.date))errors.push('Invalid date '+(r.id||r.desc));
 }
 for(const [id,rule] of Object.entries(model.rules||{})){if(!validDate(rule.anchor||rule.start)||!Number.isFinite(Number(rule.amount)))errors.push('Invalid rule '+id);if(rule.end&&rule.end<(rule.anchor||rule.start))warnings.push('End before anchor: '+id);}
 for(const bank of cashAccountNames(model))if(!model.references?.[bank])warnings.push('Missing reference: '+bank);
 const ids=new Set((model.rows||[]).map(r=>r.id));
 const pending=pendingBankMatches(model),waiting=new Set(pending.flatMap(p=>[p.id,...p.candidates.map(c=>c.id)]));
 if(pending.length)warnings.push(pending.length+' rapprochement(s) en attente dans l’éditeur ; les lignes importées restent comptées');
 const orphanCount=Object.keys(model.notes||{}).filter(id=>!ids.has(id)&&!waiting.has(id)).length;
 if(orphanCount)warnings.push(orphanCount+' annotation(s) sans opération chargée : conservées, rattachement possible dans l’éditeur');
 return {ok:errors.length===0,errors,warnings};
}
return {version:'0.19.11',compileSearch,readCsv,mergeAnnotations,reimportBankRows,reassignAnnotation,pendingBankMatches,resolveBankMatch,tagCategories,tagsByCategory,organizedTags,expenseBreakdown,expenseCategoryTotals,validateTagCategories,validateLabelAssociations,automaticTagsFor,manualTagsFor,labelAssociationPreview,knownTags,isFloating,accountNames,cashAccountNames,includedAccountNames,excludedAccountNames,tagsFor,operationMatchesFilter,hasOperationFilter,filteredImpact,pendingOperations,balanceAt,totalBalance,shiftDate,recurrenceEvents,forecast,check,auditOperations,auditCsv,recurrencePreview};
});
