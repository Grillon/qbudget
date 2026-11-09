// Deuxieme interface sur le modele qbudget existant : aucun stockage ni format propre.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.19.0';
 const lower=x=>String(x??'').toLocaleLowerCase('fr');
 const commaTags=text=>[...new Map(String(text||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>[lower(t),t])).values()];
 const matchesTag=(model,row,tag)=>{const category=(model.tagCategories||[]).find(c=>(c.tags||[]).some(t=>lower(t)===lower(tag)));return (category?root.QBudgetEngine.tagsByCategory(model,row,category):root.QBudgetEngine.tagsFor(model,row)).some(t=>lower(t)===lower(tag))};
 const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00'));
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
  let selectedKey='',selectedTag='',categoryOverviewOpen=false;
  const elt=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e};
  function field(parent,label,value,type='text',opts={}){
   const wrap=elt('label',undefined,'editor-field'),name=elt('span',label),input=elt(type==='select'?'select':type==='textarea'?'textarea':'input');
   if(type==='select')for(const [val,caption] of opts.items||[])input.add(new Option(caption,val));
   else if(type!=='textarea')input.type=type;
   input.value=value??'';
   if(opts.step)input.step=opts.step;if(opts.readOnly)input.readOnly=true;
   wrap.append(name,input);parent.append(wrap);return input;
  }
  function link(parent,label,key){const b=elt('button',label,'secondary editor-link');b.type='button';b.onclick=()=>{selectedKey=key;byId('editorScope').value='all';byId('editorSearch').value='';selectedTag='';render()};parent.append(b)}
  function status(text,failed=false){const e=byId('editorStatus');e.textContent=text;e.classList.toggle('editor-error',failed)}
  function commit(change){try{change(getModel());options.onChange();status('Modifications enregistrées dans qbudget. Exporte tes annotations pour créer un fichier.')}catch(e){status(e.message,true)}}
  function renderDetail(){
   const panel=byId('editorDetail');panel.replaceChildren();const model=getModel();const list=itemList(model);
   const item=list.find(i=>i.key===selectedKey);
   if(!item){panel.append(elt('p','Sélectionne un élément à gauche pour voir et modifier ses propriétés.','mutednote'));return}
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
   const details=elt('details'),summary=elt('summary','Catégories → tags → opérations : retrouver les liens');details.open=categoryOverviewOpen;
   details.ontoggle=()=>{categoryOverviewOpen=details.open};details.append(summary);
   const buttonWrap=elt('p',undefined,'mutednote');buttonWrap.append(elt('span','Choisis un tag pour afficher exactement les opérations annotées avec celui-ci. '));
   const clear=elt('button','Voir tout','secondary editor-link');clear.onclick=()=>{selectedTag='';byId('editorSearch').value='';render()};buttonWrap.append(clear);details.append(buttonWrap);
   for(const category of model.tagCategories||[]){
    const line=elt('div',undefined,'editor-category-line');line.append(elt('strong',category.name));
    for(const tag of category.tags||[]){
     const count=(model.rows||[]).filter(r=>matchesTag(model,r,tag)).length;
     const b=elt('button',tag+' ('+count+')','secondary editor-link');b.type='button';b.onclick=()=>{selectedTag=tag;selectedKey='';byId('editorScope').value='all';byId('editorSearch').value='';render();byId('editorItems').scrollIntoView({behavior:'smooth',block:'nearest'})};
     line.append(b);
    }
    details.append(line);
   }
   host.append(details);
  }
  function render(){
   const model=getModel(),scope=byId('editorScope').value||'all',term=lower(byId('editorSearch').value.trim());
   const all=itemList(model),visible=all.filter(i=>{
    if(scope!=='all'&&i.kind!==scope)return false;
    if(term&&!lower([i.label,i.detail,i.search].join(' ')).includes(term))return false;
    if(!selectedTag)return true;
    const row=(model.rows||[]).find(r=>r.id===i.id);
    if(row)return matchesTag(model,row,selectedTag);
    if(i.kind==='orphan')return (model.notes[i.id]?.tags||[]).some(t=>lower(t)===lower(selectedTag));
    return false;
   });
   byId('editorCount').textContent=`${visible.length} / ${all.length} élément(s)`+(selectedTag?' · tag '+selectedTag:'');
   renderCategoryOverview(model);
   const host=byId('editorItems');host.replaceChildren();
   for(const i of visible){const b=elt('button',undefined,'editor-item'+(i.key===selectedKey?' active':''));b.type='button';b.append(elt('strong',i.label),elt('small',i.detail));b.onclick=()=>{selectedKey=i.key;render()};host.append(b)}
   if(!all.some(i=>i.key===selectedKey))selectedKey=visible[0]?.key||'';
   renderDetail();
  }
  byId('editorScope').onchange=()=>{selectedKey='';selectedTag='';render()};byId('editorSearch').oninput=()=>{selectedKey='';selectedTag='';render()};
  byId('editorExport').onclick=()=>options.exportAnnotations();
  byId('editorImport').onclick=()=>options.importAnnotations();
  byId('editorExportCategories').onclick=()=>options.exportCategories();
  byId('editorImportCategories').onclick=()=>options.importCategories();
  return Object.freeze({render});
 }
 return Object.freeze({version,mount,itemList,commaTags});
});
