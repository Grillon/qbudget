// Deuxieme interface sur le modele qbudget existant : aucun stockage ni format propre.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.19.3';
 const lower=x=>String(x??'').toLocaleLowerCase('fr');
 const commaTags=text=>[...new Map(String(text||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>[lower(t),t])).values()];
 const matchesTag=(model,row,tag)=>{const category=(model.tagCategories||[]).find(c=>(c.tags||[]).some(t=>lower(t)===lower(tag)));return (category?root.QBudgetEngine.tagsByCategory(model,row,category):root.QBudgetEngine.tagsFor(model,row)).some(t=>lower(t)===lower(tag))};
 const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00'));
 // Sélection tabulaire standard, indépendante des filtres et des calculs financiers.
 // ordered contient seulement les objets taguables dans l'ordre des lignes filtrées.
 function selectKeys(current,ordered,anchor,key,{ctrl=false,shift=false}={}){
  const previous=new Set(current),position=ordered.indexOf(key);
  if(position<0)return {keys:previous,anchor};
  if(shift){
   const start=ordered.indexOf(anchor),from=start<0?position:start;
   const keys=ctrl?previous:new Set();
   for(let i=Math.min(from,position);i<=Math.max(from,position);i++)keys.add(ordered[i]);
   return {keys,anchor:start<0?key:anchor};
  }
  if(ctrl){if(previous.has(key))previous.delete(key);else previous.add(key);return {keys:previous,anchor:key}}
  return {keys:new Set([key]),anchor:key};
 }

 // Filtres d'analyse de lots : montants en valeur absolue (inclut débits et crédits),
 // dates inclusives. Valeurs absentes = aucune contrainte. Aucune modification des opérations.
 function parseEditorFilters(input={}){
  const asAmount=(raw,label)=>{
   const v=String(raw??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
   if(!v)return null;
   if(!/^\d+(?:\.\d{1,2})?$/.test(v))throw Error(`${label} : montant positif attendu (ex. 1 200,50)`);
   const n=Number(v);
   if(!Number.isFinite(n))throw Error(`${label} : montant invalide`);
   return n;
  };
  const min=asAmount(input.min,'Montant minimum'),max=asAmount(input.max,'Montant maximum');
  const from=String(input.from||''),to=String(input.to||'');
  if(min!==null&&max!==null&&min>max)throw Error('Montant minimum supérieur au maximum');
  if(from&&!validDate(from))throw Error('Date de début invalide');
  if(to&&!validDate(to))throw Error('Date de fin invalide');
  if(from&&to&&from>to)throw Error('Date de début postérieure à la date de fin');
  return {min,max,from,to,active:min!==null||max!==null||!!from||!!to};
 }
 function matchesEditorFilters(row,filters){
  if(!filters.active)return true;
  if(!row)return false;
  const amount=Math.abs(Number(row.amount));
  if(!Number.isFinite(amount))return false;
  if(filters.min!==null&&amount+1e-9<filters.min)return false;
  if(filters.max!==null&&amount-1e-9>filters.max)return false;
  if((filters.from||filters.to)&&(!row.date||(filters.from&&row.date<filters.from)||(filters.to&&row.date>filters.to)))return false;
  return true;
 }

 function itemList(model){
  const list=[];
  const rowIds=new Set();
  for(const r of model.rows||[]){
   rowIds.add(r.id);const n=model.notes?.[r.id]||{};
   list.push({key:'row:'+r.id,kind:r.manual?'manual':'bank',id:r.id,label:r.desc||'Sans libellé',detail:`${r.bank||'Sans compte'} · ${r.date||'En attente'} · ${Number(r.amount).toFixed(2)} €`,search:[r.desc,r.bank,r.date,r.amount,...(n.tags||[]),n.tag].join(' ')});
  }
  for(const id of Object.keys(model.notes||{})){
   if(rowIds.has(id))continue;
   const n=model.notes[id];list.push({key:'orphan:'+id,kind:'orphan',id,label:'Annotation sans opération chargée',detail:'Référence '+id.slice(0,18)+'…',search:[id,n.tag,...(n.tags||[])].join(' ')});
  }
  for(const [id,r] of Object.entries(model.rules||{}))list.push({key:'rule:'+id,kind:'rule',id,label:r.desc||'Règle sans nom',detail:`${r.account||'Sans compte'} · ${r.frequency||'—'} · ${Number(r.amount).toFixed(2)} €`,search:[id,r.desc,r.account,r.frequency].join(' ')});
  const accounts=root.QBudgetEngine?.accountNames?.(model)||[...(model.accounts||[])];
  for(const name of accounts)list.push({key:'account:'+name,kind:'account',id:name,label:name,detail:model.references?.[name]?'Solde de référence : '+model.references[name].balance+' €':'Sans solde de référence',search:name});
  return list;
 }
 function mount(options){
  const doc=root.document,host=doc.getElementById('editorScreen');
  if(!host)throw Error('Vue éditeur introuvable');
  const byId=id=>doc.getElementById(id),getModel=options.getModel;
  let selectedKey='',selectedTag='',categoryOverviewOpen=false,visibleLimit=120;
  let matchingEditableIds=[],matchingEditableKeys=[],visibleItems=[];
  let selectedKeys=new Set(),selectionAnchor='';
  const elt=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e};
  function field(parent,label,value,type='text',opts={}){
   const wrap=elt('label',undefined,'editor-field'),name=elt('span',label),input=elt(type==='select'?'select':type==='textarea'?'textarea':'input');
   if(type==='select')for(const [val,caption] of opts.items||[])input.add(new Option(caption,val));
   else if(type!=='textarea')input.type=type;
   input.value=value??'';
   if(opts.step)input.step=opts.step;if(opts.readOnly)input.readOnly=true;
   wrap.append(name,input);parent.append(wrap);return input;
  }
  function link(parent,label,key){const b=elt('button',label,'secondary editor-link');b.type='button';b.onclick=()=>{byId('editorScope').value='all';byId('editorSearch').value='';selectedTag='';render();openDetail(key)};parent.append(b)}
  function status(text,failed=false){const e=byId('editorStatus');e.textContent=text;e.classList.toggle('editor-error',failed)}
  function commit(change){try{change(getModel());options.onChange();status('Modifications enregistrées dans qbudget. Exporte tes annotations pour créer un fichier.')}catch(e){status(e.message,true)}}
  function renderDetail(list){
   const panel=byId('editorDetail');panel.replaceChildren();const model=getModel();
   const item=list.find(i=>i.key===selectedKey);
   if(!item){panel.append(elt('p','Sélectionne un élément du tableau pour voir et modifier ses propriétés.','mutednote'));return}
   panel.append(elt('h3',item.label));panel.append(elt('p',item.detail,'mutednote'));
   const form=elt('div',undefined,'editor-form');panel.append(form);
   const row=(item.kind==='manual'||item.kind==='bank')?(model.rows||[]).find(r=>r.id===item.id):null;
   const n=(item.kind==='manual'||item.kind==='bank'||item.kind==='orphan')?model.notes?.[item.id]||{}:null;
   if(n){
    if(row){
     const info=elt('p',row.manual?'Opération manuelle : les champs ci-dessous seront exportés dans manualRows.':'Opération bancaire : ses montants, date et libellé viennent du CSV ; seuls les annotations et liens sont éditables.','mutednote');form.append(info);
    }else form.append(elt('p','Le CSV contenant cette opération n’est pas chargé. Tu peux néanmoins éditer ses annotations : son identifiant est conservé.','mutednote'));
    let desc,amount,date,account,nature;
    if(row?.manual){
     desc=field(form,'Libellé',row.desc);
     amount=field(form,'Montant signé (€)',row.amount,'number',{step:'0.01'});
     date=field(form,'Date (vide = flottante)',row.date||'','date');
     account=field(form,'Compte',row.bank||'','select',{items:[['','Sans compte (en attente)'],...root.QBudgetEngine.accountNames(model).map(a=>[a,a])]});
     nature=field(form,'État',row.nature==='actual'?'actual':'planned','select',{items:[['planned','Prévu'],['actual','Réalisé']]});
    }
    const tags=field(form,'Tags (séparés par des virgules)',row?root.QBudgetEngine.tagsFor(model,row).join(', '):(n.tags||[]).join(', ')||n.tag||'','textarea');
    const type=field(form,'Périodicité',n.type||'','select',{items:[['','Non définie'],['ponctuel','Ponctuel'],['recurrent','Récurrent']]});
    const choices=[['','Aucune règle'],...Object.entries(model.rules||{}).map(([id,r])=>[id,(r.desc||id)+' · '+r.account+' ('+r.frequency+')'])];
    if(n.ruleId&&!model.rules?.[n.ruleId])choices.push([n.ruleId,'Règle introuvable : '+n.ruleId]);
    const rule=field(form,'Récurrence liée',n.ruleId||'','select',{items:choices});
    if(n.ruleId&&model.rules?.[n.ruleId])link(form,'Voir la règle « '+model.rules[n.ruleId].desc+' »','rule:'+n.ruleId);
    const save=elt('button','Enregistrer','');save.type='button';save.onclick=()=>commit(m=>{
     const old=m.notes[item.id]||{};const next={...old,tags:commaTags(tags.value)};next.tag=next.tags[0]||'';
     if(type.value)next.type=type.value;else delete next.type;
     if(rule.value){if(!m.rules[rule.value])throw Error('La règle associée n’existe plus');next.ruleId=rule.value}else delete next.ruleId;
     if(row?.manual){
      const r=m.rows.find(r=>r.id===item.id);const val=Number(amount.value);
      if(!desc.value.trim()||amount.value.trim()===''||!Number.isFinite(val))throw Error('Libellé ou montant invalide');
      if(date.value&&!validDate(date.value))throw Error('Date invalide');
      if(date.value&&!account.value)throw Error('Attribue un compte à une opération datée');
      if(!date.value&&nature.value==='actual')throw Error('Une opération flottante ne peut pas être réalisée');
      if(date.value&&nature.value==='planned'&&(date.value!==(r.date||'')||nature.value!==r.nature)&&date.value<=options.asOf())throw Error('Pour une opération prévue, choisis une date après la consultation ou passe-la en « Réalisé ».');
      r.desc=desc.value.trim();r.amount=val;r.date=date.value||null;r.bank=account.value;r.account=account.value;r.nature=nature.value;
     }
     m.notes[item.id]=next;
    });form.append(save);
   }else if(item.kind==='rule'){
    const r=model.rules[item.id];
    const desc=field(form,'Libellé',r.desc),amount=field(form,'Montant signé (€)',r.amount,'number',{step:'0.01'}),account=field(form,'Compte',r.account,'select',{items:root.QBudgetEngine.accountNames(model).map(a=>[a,a])}),frequency=field(form,'Fréquence',r.frequency,'select',{items:['quotidien','hebdomadaire','mensuel','trimestriel','annuel'].map(s=>[s,s])}),anchor=field(form,'Date de référence',r.anchor||r.start,'date'),end=field(form,'Fin facultative',r.end||'','date');
    const linked=(model.rows||[]).filter(row=>model.notes?.[row.id]?.ruleId===item.id);
    const connections=elt('div',undefined,'editor-connections');connections.append(elt('strong',`${linked.length} opération(s) liées`));
    for(const row of linked.slice(0,12))link(connections,(row.desc||'Sans libellé')+' · '+(row.date||'en attente'),'row:'+row.id);form.append(connections);
    const save=elt('button','Enregistrer la règle');save.type='button';save.onclick=()=>commit(m=>{
     const v=Number(amount.value);if(!desc.value.trim()||amount.value.trim()===''||!Number.isFinite(v)||!validDate(anchor.value)||!account.value)throw Error('Règle invalide : libellé, montant, date et compte nécessaires');
     if(end.value&&(!validDate(end.value)||end.value<anchor.value))throw Error('Date de fin invalide');
     Object.assign(m.rules[item.id],{desc:desc.value.trim(),amount:v,account:account.value,frequency:frequency.value,anchor:anchor.value,end:end.value});
    });form.append(save);
   }else if(item.kind==='account'){
    const ref=model.references?.[item.id];
    form.append(elt('p','Le nom du compte n’est pas modifié ici pour ne pas casser ses liens avec les opérations.','mutednote'));
    const date=field(form,'Date du solde de référence',ref?.date||'','date'),balance=field(form,'Solde de référence (€)',ref?.balance??'','number',{step:'0.01'});
    const included=field(form,'Inclure dans le cumul', (model.excludedAccounts||[]).includes(item.id)?'no':'yes','select',{items:[['yes','Oui'],['no','Non · courbe séparée']]});
    const linked=(model.rows||[]).filter(r=>r.bank===item.id);const connections=elt('div',undefined,'editor-connections');connections.append(elt('strong',linked.length+' opération(s) sur ce compte'));for(const row of linked.slice(0,12))link(connections,(row.desc||'Sans libellé')+' · '+(row.date||'en attente'),'row:'+row.id);form.append(connections);
    const save=elt('button','Enregistrer le compte');save.type='button';save.onclick=()=>commit(m=>{
     if(date.value||balance.value!==''){
      if(!validDate(date.value)||balance.value===''||!Number.isFinite(Number(balance.value)))throw Error('Solde et date de référence nécessaires');
      m.references[item.id]={date:date.value,balance:Number(balance.value)};
     }else delete m.references[item.id];
     const excluded=new Set(m.excludedAccounts||[]);if(included.value==='no')excluded.add(item.id);else excluded.delete(item.id);m.excludedAccounts=[...excluded].sort();
    });form.append(save);
   }
   const meta=elt('details',undefined,'editor-technical'),summary=elt('summary','Afficher la référence technique (lecture seule)'),code=elt('code',item.id);meta.append(summary,code);panel.append(meta);
  }
  function renderCategoryOverview(model){
   const host=byId('editorCategoryOverview');host.replaceChildren();
   const details=elt('details'),summary=elt('summary','Catégories → tags → opérations : retrouver les liens');
   details.open=categoryOverviewOpen;
   details.addEventListener('toggle',()=>{
    if(categoryOverviewOpen===details.open)return;
    categoryOverviewOpen=details.open;
    if(categoryOverviewOpen)renderCategoryOverview(getModel());
   });
   details.append(summary);
   // Les liens sont calculés UNIQUEMENT si la rubrique est ouverte.
   // Un seul parcours de chaque opération remplace un parcours par tag.
   if(!categoryOverviewOpen){host.append(details);return}
   const counts=new Map();
   const categories=model.tagCategories||[];
   for(const row of model.rows||[]){
    for(const category of categories){
     const unique=new Set(root.QBudgetEngine.tagsByCategory(model,row,category).map(lower));
     for(const tag of unique)counts.set(tag,(counts.get(tag)||0)+1);
    }
   }
   const buttonWrap=elt('p',undefined,'mutednote');buttonWrap.append(elt('span','Choisis un tag pour afficher exactement les opérations annotées avec celui-ci. '));
   const clear=elt('button','Voir tout','secondary editor-link');clear.onclick=()=>{selectedTag='';byId('editorSearch').value='';visibleLimit=120;selectedKeys.clear();selectionAnchor='';render()};buttonWrap.append(clear);details.append(buttonWrap);
   for(const category of categories){
    const line=elt('div',undefined,'editor-category-line');line.append(elt('strong',category.name));
    for(const tag of category.tags||[]){
     const b=elt('button',tag+' ('+(counts.get(lower(tag))||0)+')','secondary editor-link');b.type='button';
     b.onclick=()=>{selectedTag=tag;selectedKey='';selectedKeys.clear();selectionAnchor='';visibleLimit=120;byId('editorScope').value='all';byId('editorSearch').value='';render();byId('editorItems').scrollIntoView({behavior:'smooth',block:'nearest'})};
     line.append(b);
    }
    details.append(line);
   }
   host.append(details);
  }
  function detailOpen(){return !byId('editorDetailBackdrop').hidden}
  function closeDetail(){byId('editorDetailBackdrop').hidden=true}
  function openDetail(key){
   selectedKey=key;
   renderDetail(itemList(getModel()));
   byId('editorDetailBackdrop').hidden=false;
   byId('editorClose').focus();
  }
  byId('editorClose').onclick=closeDetail;
  byId('editorDetailBackdrop').addEventListener('click',event=>{if(event.target===byId('editorDetailBackdrop'))closeDetail()});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&detailOpen())closeDetail()});
  function updateSelection(){
   const matching=new Set(matchingEditableKeys);
   selectedKeys=new Set([...selectedKeys].filter(k=>matching.has(k)));
   const count=selectedKeys.size,tag=byId('editorBulkTag').value.trim(),term=byId('editorSearch').value.trim();
   byId('editorSelectedCount').textContent=`${count} opération(s) sélectionnée(s)`;
   byId('editorApplySelectedTag').disabled=!count||!tag||!!byId('editorSearchError').textContent;
   byId('editorApplyTag').disabled=!matchingEditableIds.length||!(term||['editorAmountMin','editorAmountMax','editorDateFrom','editorDateTo'].some(id=>byId(id).value.trim()))||!!byId('editorSearchError').textContent||!tag;
   const lines=byId('editorItems').querySelectorAll('tr[data-key]');
   for(const row of lines){
    const active=selectedKeys.has(row.dataset.key);
    row.classList.toggle('active',active);
    row.setAttribute('aria-selected',String(active));
    const cb=row.querySelector('input.editor-checkbox');if(cb)cb.checked=active;
   }
  }
  function selectVisible(key,modifiers){
   const result=selectKeys(selectedKeys,matchingEditableKeys,selectionAnchor,key,modifiers);
   selectedKeys=result.keys;selectionAnchor=result.anchor;updateSelection();
  }
  function render(){
   const model=getModel(),scope=byId('editorScope').value||'all',term=byId('editorSearch').value.trim(),mode=byId('editorSearchMode').value;
   const rawBounds={min:byId('editorAmountMin').value,max:byId('editorAmountMax').value,from:byId('editorDateFrom').value,to:byId('editorDateTo').value};
   let regex=null,searchError='',bounds={active:false,min:null,max:null,from:'',to:''};
   try{regex=root.QBudgetEngine.compileSearch(term,mode)}catch(e){searchError=e.message}
   try{bounds=parseEditorFilters(rawBounds)}catch(e){searchError=[searchError,e.message].filter(Boolean).join(' · ')}
   byId('editorSearchError').textContent=searchError;
   const all=itemList(model),rowById=new Map((model.rows||[]).map(r=>[r.id,r]));
   const visible=all.filter(i=>{
    if(scope!=='all'&&i.kind!==scope)return false;
    if(searchError)return false;
    if(bounds.active&&!matchesEditorFilters(rowById.get(i.id),bounds))return false;
    if(term){const content=[i.label,i.detail,i.search].join(' ');if(mode==='regex'?!regex.test(content):!lower(content).includes(lower(term)))return false}
    if(!selectedTag)return true;
    const row=rowById.get(i.id);
    if(row)return matchesTag(model,row,selectedTag);
    if(i.kind==='orphan')return (model.notes[i.id]?.tags||[]).some(t=>lower(t)===lower(selectedTag));
    return false;
   });
   visibleItems=visible;
   const editable=visible.filter(i=>i.kind==='manual'||i.kind==='bank');
   matchingEditableIds=editable.map(i=>i.id);
   matchingEditableKeys=editable.map(i=>i.key);
   byId('editorCount').textContent=`${visible.length} / ${all.length} élément(s)`+(selectedTag?' · tag '+selectedTag:'')+(bounds.active?' · filtre montant/période':'')+(visible.length>visibleLimit?` · ${visibleLimit} affichés`:'')+` · ${matchingEditableIds.length} opération(s) taguables`;
   renderCategoryOverview(model);
   const host=byId('editorItems');host.replaceChildren();
   const fragment=doc.createDocumentFragment();
   for(const i of visible.slice(0,visibleLimit)){
    const bankOrManual=i.kind==='bank'||i.kind==='manual',row=rowById.get(i.id);
    const tr=elt('tr',undefined,'editor-item');tr.dataset.key=i.key;
    tr.tabIndex=0;tr.setAttribute('aria-label',i.label+' '+i.detail);tr.setAttribute('aria-selected','false');
    const checkCell=elt('td'),cb=elt('input',undefined,'editor-checkbox');cb.type='checkbox';cb.disabled=!bankOrManual;cb.setAttribute('aria-label','Sélectionner '+i.label);
    cb.addEventListener('click',event=>event.stopPropagation());
    cb.addEventListener('change',()=>{if(!bankOrManual)return;selectVisible(i.key,{ctrl:true})});
    checkCell.append(cb);tr.append(checkCell);
    const date=elt('td',row?.date||'—');date.title=row?.date||'Sans date';tr.append(date);
    const account=elt('td',row?.bank||((i.kind==='rule')?model.rules?.[i.id]?.account:'')||'—','editor-account-cell');account.title=account.textContent;tr.append(account);
    const name=elt('td',undefined,'editor-row-desc'),label=elt('span',i.label);label.title=i.label;
    name.append(label);if(i.kind==='manual')name.append(elt('span','Manuel','editor-badge'));
    if(i.kind==='rule')name.append(elt('span','Règle','editor-badge'));
    if(i.kind==='account')name.append(elt('span','Compte','editor-badge'));
    if(i.kind==='orphan')name.append(elt('span','Référence','editor-badge'));
    tr.append(name);
    const amount=elt('td',row?new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(row.amount))+' €':i.kind==='rule'?new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(model.rules?.[i.id]?.amount||0))+' €':'—','editor-amount'+(Number(row?.amount??(i.kind==='rule'?model.rules?.[i.id]?.amount:0))<0?' negative':''));tr.append(amount);
    const tags=root.QBudgetEngine.tagsFor&&row?root.QBudgetEngine.tagsFor(model,row):model.notes?.[i.id]?.tags||[];
    const tagCell=elt('td',tags.length?tags.join(' · '):'—','editor-row-tags');tagCell.title=tags.join(' · ');tr.append(tagCell);
    const editCell=elt('td');const edit=elt('button','Modifier','secondary editor-row-detail');edit.type='button';edit.onclick=event=>{event.stopPropagation();openDetail(i.key)};editCell.append(edit);tr.append(editCell);
    tr.addEventListener('click',event=>{if(bankOrManual)selectVisible(i.key,{ctrl:event.ctrlKey||event.metaKey,shift:event.shiftKey});else openDetail(i.key)});
    tr.addEventListener('keydown',event=>{
     if(event.target!==tr)return;
     if(event.key==='Enter'||event.key===' '){event.preventDefault();if(bankOrManual)selectVisible(i.key,{ctrl:event.ctrlKey||event.metaKey,shift:event.shiftKey});else openDetail(i.key)}
     if(event.key==='F2'){event.preventDefault();openDetail(i.key)}
    });
    fragment.append(tr);
   }
   host.append(fragment);
   const more=byId('editorMore');more.hidden=visible.length<=visibleLimit;
   if(detailOpen()){
    if(!all.some(i=>i.key===selectedKey))closeDetail();else renderDetail(all);
   }
   updateSelection();
  }
  byId('editorMore').onclick=()=>{visibleLimit+=120;render()};
  byId('editorSelectMatching').onclick=()=>{selectedKeys=new Set(matchingEditableKeys);selectionAnchor=matchingEditableKeys[0]||'';updateSelection()};
  byId('editorClearSelection').onclick=()=>{selectedKeys.clear();selectionAnchor='';updateSelection()};
  byId('editorBulkTag').addEventListener('input',updateSelection);
  function bulkTag(ids,kind){
   const tag=byId('editorBulkTag').value.trim();
   if(!ids.length||!tag||byId('editorSearchError').textContent)return;
   if(!root.confirm(`Ajouter « ${tag} » aux ${ids.length} opération(s) ${kind} ?\nAucune prévision FORECAST ne sera modifiée.`))return;
   try{const result=root.QBudgetTags.addTag(getModel(),ids,tag);options.onChange();byId('editorBulkStatus').textContent=`${result.changed} opération(s) modifiée(s) · ${result.alreadyPresent} déjà taguée(s).`}
   catch(e){byId('editorBulkStatus').textContent=e.message}
  }
  byId('editorApplySelectedTag').onclick=()=>{
   const selected=new Set(selectedKeys);
   const ids=visibleItems.filter(i=>selected.has(i.key)&&(i.kind==='bank'||i.kind==='manual')).map(i=>i.id);
   bulkTag(ids,'sélectionnée(s)');
  };
  byId('editorApplyTag').onclick=()=>{
   const ids=[...matchingEditableIds];
   if(!byId('editorSearch').value.trim()&&!['editorAmountMin','editorAmountMax','editorDateFrom','editorDateTo'].some(id=>byId(id).value.trim()))return;
   bulkTag(ids,'trouvée(s)');
  };
  function resetFilter(){selectedKey='';selectedTag='';selectedKeys.clear();selectionAnchor='';visibleLimit=120;closeDetail();render()}
  byId('editorScope').onchange=resetFilter;
  byId('editorSearchMode').onchange=resetFilter;
  byId('editorSearch').oninput=resetFilter;
  for(const id of ['editorAmountMin','editorAmountMax','editorDateFrom','editorDateTo'])byId(id).addEventListener('input',resetFilter);
  byId('editorClearRange').onclick=()=>{
   for(const id of ['editorAmountMin','editorAmountMax','editorDateFrom','editorDateTo'])byId(id).value='';
   resetFilter();
  };
  byId('editorExport').onclick=()=>options.exportAnnotations();
  byId('editorImport').onclick=()=>options.importAnnotations();
  byId('editorExportCategories').onclick=()=>options.exportCategories();
  byId('editorImportCategories').onclick=()=>options.importCategories();
  return Object.freeze({render});
 }
 return Object.freeze({version,mount,itemList,commaTags,selectKeys,parseEditorFilters,matchesEditorFilters});
});
