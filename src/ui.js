// Interface navigateur, comportement et disposition.
'use strict';
const UI_VERSION='0.18.4';
globalThis.QBudgetUI=Object.freeze({version:UI_VERSION});
const $=id=>document.getElementById(id),KEY='qbudget-mvp-1',LAYOUT_KEY='qbudget-layout-v1';
$('appVersion').textContent='V'+QBudgetVersion.version;document.title='qbudget V'+QBudgetVersion.version+' — navigation & prévisions';let model={rows:[],notes:{},references:{},rules:{},accounts:[],excludedAccounts:[],tagCategories:QBudgetTags.defaults(),donutCategory:'',sunburstDepth:2,hierarchyView:'sunburst',excludeTransfersFromCharts:true,tagDefaultsVersion:2};let selected='';const selectedRowIds=new Set();let displayedEditableIds=[];let chartSelection=null;let breakdownSnapshot=null;const amount=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n);const numeric=v=>{const x=String(v??'').trim().replace(/\s/g,'').replace(',','.');return x===''?null:Number.isFinite(Number(x))?Number(x):null};const dateStr=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const asDate=s=>new Date(s+'T12:00:00');const today=dateStr(new Date());$('asof').value=today;
const readCsv=QBudgetEngine.readCsv;
function initModel(){model.rules??={};model.notes??={};model.references??={};model.rows??=[];model.accounts??=[];model.excludedAccounts??=[];model.tagCategories??=QBudgetTags.defaults();model.donutCategory??='';model.sunburstDepth??=2;model.hierarchyView=['sunburst','treemap'].includes(model.hierarchyView)?model.hierarchyView:'sunburst';model.excludeTransfersFromCharts??=true;if(!model.tagDefaultsVersion){model.tagCategories=QBudgetTags.upgradeDefaultTreatment(model.tagCategories);model.tagDefaultsVersion=2}}function save(){try{localStorage.setItem(KEY,JSON.stringify(model));return true}catch(e){$('importStatus').textContent='Attention : stockage du navigateur indisponible. Exporte tes annotations en JSON.';return false}}
function load(){try{const s=localStorage.getItem(KEY);if(s)model=JSON.parse(s);initModel();for(const r of model.rows){r.account=r.bank;r.balance=null}const refs={};for(const [k,v] of Object.entries(model.references)){const bank=k.split(' · ')[0];if(!(bank in refs))refs[bank]=v}model.references=refs;for(const rule of Object.values(model.rules))rule.account=(rule.account||'').split(' · ')[0]}catch{}finally{initModel()}}function accounts(){return QBudgetEngine.accountNames(model)};function key(r){return r.bank}function inAccount(){return model.rows.filter(r=>!selected||key(r)===selected)}function aggregateRows(){const allowed=new Set(selected?[selected]:QBudgetEngine.includedAccountNames(model));return model.rows.filter(r=>allowed.has(key(r)))}function notes(r){return model.notes[r.id]||{}}
function renderModuleVersions(){const entries=[['Interface',QBudgetUI.version],['Moteur',QBudgetEngine.version],['Tags & lots',QBudgetTags.version],['Normalisation',QBudgetNormalize.version],['Sélection graphique',QBudgetVisualSelect.version]];const host=$('modulesVersions');host.replaceChildren();for(const [name,v] of entries){const node=document.createElement('span');node.textContent=name+' · v'+v;host.append(node)}$('modulesVersionSummary').textContent=entries.map(([n,v])=>n+' '+v).join(' · ')}
function renderAccounts(){const list=accounts();$('account').replaceChildren(new Option('Tous les comptes',''),...list.map(a=>new Option(a,a)));if(selected&&!list.includes(selected))selected='';$('account').value=selected;const ref=model.references[selected];$('refBalance').value=ref?.balance??'';$('refDate').value=ref?.date??'';$('saveRef').disabled=!selected;const ma=$('manualAccount'),previous=ma.value;ma.replaceChildren(new Option('À attribuer (file d’attente)',''),...list.map(a=>new Option(a,a)));ma.value=list.includes(previous)?previous:(selected||list[0]||'');
 const toggles=$('accountToggles');toggles.replaceChildren();const excluded=new Set(model.excludedAccounts);
 for(const name of list){const label=document.createElement('label');label.className='account-toggle'+(excluded.has(name)?' excluded':'');label.title='Activé : inclus dans le cumul global. Désactivé : visible séparément sur le graphique.';
  const input=document.createElement('input');input.type='checkbox';input.checked=!excluded.has(name);input.setAttribute('aria-label','Inclure '+name+' dans le cumul global');input.onchange=()=>{const set=new Set(model.excludedAccounts);if(input.checked)set.delete(name);else set.add(name);model.excludedAccounts=[...set].sort();save();render()};label.append(input,document.createTextNode(name));toggles.append(label)}
}
function historicBalance(rows,on){return QBudgetEngine.totalBalance(model,on,selected)}
function shiftDate(iso,frequency,k){return QBudgetEngine.shiftDate(iso,frequency,k)}
function recurrenceEvents(rows,start,end){return QBudgetEngine.recurrenceEvents(model,start,end,selected)}
function uid(){return crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
function normalizedLabel(label){return String(label||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr')}
function connectRule(r){
  const n=notes(r),current=model.rules[n.ruleId];
  if(current){alert('Cette opération est déjà liée à la récurrence « '+current.desc+' ».');return}
  if(QBudgetEngine.isFloating(r)){alert('Attribue une date avant de créer une récurrence.');return}
  const matches=Object.values(model.rules).filter(q=>q.account===key(r)&&normalizedLabel(q.desc)===normalizedLabel(r.desc));
  if(matches.length){
    // Le libellé est la clé fonctionnelle; on ne propose jamais une autre récurrence au libellé différent.
    const choice=matches.length===1?matches[0]:matches.reduce((a,b)=>(a.anchor||a.start)>=(b.anchor||b.start)?a:b);
    if(confirm('La récurrence « '+choice.desc+' » existe déjà sur '+key(r)+'.\nRattacher cette opération à la même récurrence ?\n\nAnnuler = créer une nouvelle récurrence avec le même libellé.')){
      if(r.date>=(choice.anchor||choice.start)){choice.anchor=r.date;choice.amount=r.amount}
      model.notes[r.id]={...n,type:'recurrent',ruleId:choice.id};save();render();return;
    }
  }
  const dialog=$('ruleDialog');
  $('ruleDialogDescription').textContent='« '+r.desc+' » · '+key(r);
  $('newRuleFrequency').value='mensuel';
  dialog.onclose=()=>{
    if(dialog.returnValue!=='confirm')return;
    const f=$('newRuleFrequency').value;
    if(!['quotidien','hebdomadaire','mensuel','trimestriel','annuel'].includes(f))return;
    const id=uid();model.rules[id]={id,account:key(r),desc:r.desc,amount:r.amount,frequency:f,start:r.date,anchor:r.date,end:''};
    model.notes[r.id]={...notes(r),type:'recurrent',ruleId:id};save();render();
  };
  dialog.showModal();
}
function renderRules(){const tbody=$('rules');tbody.replaceChildren();for(const r of Object.values(model.rules).filter(r=>!selected||r.account===selected)){const tr=document.createElement('tr');const cell=t=>{const td=document.createElement('td');td.textContent=t;tr.append(td);return td};cell(r.account);cell(r.desc);cell(amount(r.amount));const f=document.createElement('select');for(const name of ['quotidien','hebdomadaire','mensuel','trimestriel','annuel'])f.add(new Option(name,name));f.value=r.frequency;f.onchange=()=>{r.frequency=f.value;save();renderSummary()};let td=cell('');td.append(f);const anchor=document.createElement('input');anchor.type='date';anchor.value=r.anchor;anchor.onchange=()=>{if(anchor.value){r.anchor=anchor.value;save();renderSummary()}};td=cell('');td.append(anchor);const fin=document.createElement('input');fin.type='date';fin.value=r.end||'';fin.onchange=()=>{r.end=fin.value;save();renderSummary()};td=cell('');td.append(fin);const del=document.createElement('button');del.className='warn';del.textContent='Supprimer';del.onclick=()=>{if(!confirm('Supprimer cette récurrence (les opérations restent conservées) ?'))return;delete model.rules[r.id];for(const n of Object.values(model.notes))if(n.ruleId===r.id){delete n.ruleId;n.type='ponctuel'}save();render()};td=cell('');td.append(del);tbody.append(tr)}}
function addMonths(iso,n){const d=asDate(iso),target=new Date(d.getFullYear(),d.getMonth()+Number(n)+1,0,12);return dateStr(target)}
function plotLayout(extra={}){return {paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{family:'system-ui, sans-serif',color:'#334155',size:12},margin:{l:65,r:20,t:24,b:46},...extra}}
function curveFor(account,at,end){
 const rows=model.rows.filter(r=>r.bank===account&&!QBudgetEngine.isFloating(r));
 const actual=rows.filter(r=>r.date<=at&&r.nature!=='planned').sort((a,b)=>a.date.localeCompare(b.date));
 const dates=new Set(actual.map(r=>r.date));const reference=model.references[account]?.date;
 if(reference&&reference<=at)dates.add(reference);
 if(actual.length){const prev=asDate(actual[0].date);prev.setDate(prev.getDate()-1);dates.add(dateStr(prev))}
 dates.add(at);
 const history=[...dates].filter(d=>d<=at).sort().map(date=>({date,v:QBudgetEngine.totalBalance(model,date,account)})).filter(p=>p.v!==null);
 const calculated=QBudgetEngine.forecast(model,at,end,account);
 const future=calculated.opening===null?[]:[{date:at,v:calculated.opening},...calculated.events.map(ev=>({date:ev.date,v:ev.balance}))];
 if(calculated.closing!==null&&end>=at)future.push({date:end,v:calculated.closing});
 return {history,future};
}
function operationFilter(){return {search:$('search').value,type:$('typeFilter').value,tags:$('operationTags').value.split(',').map(t=>t.trim()).filter(Boolean),tagMode:$('operationTagMode').value}}
function filteredAnalysisRows(rows){const filter=operationFilter();return rows.filter(r=>QBudgetEngine.operationMatchesFilter(model,r,filter))}

// La sélection du graphique agit seulement sur les lignes du tableau, jamais sur les soldes.
function clearChartSelection(){
 chartSelection=null;
 $('chartDrilldown').classList.add('hidden');
}
function chooseGraphRows(kind,source,label,nodeId=''){
 if(!breakdownSnapshot)return;
 const result=QBudgetVisualSelect.select(model,breakdownSnapshot.rows,{
  kind,category:breakdownSnapshot.category,dimensions:breakdownSnapshot.dimensions,label,nodeId
 });
 if(!result||!result.count)return;
 chartSelection={ids:new Set(result.ids),source,label,total:result.total,count:result.count};
 $('chartDrilldownText').textContent=`${source} · ${label} · ${result.count} écriture(s) · ${amount(result.total)} de dépenses. Somme vérifiable dans le tableau.`;
 $('chartDrilldown').classList.remove('hidden');
 clearBulkSelection();renderRows();
 $('chartDrilldown').scrollIntoView({behavior:'smooth',block:'center'});
}
$('clearChartDrilldown').onclick=()=>{clearChartSelection();clearBulkSelection();renderRows()};
function bindBreakdownClick(element,kind){
 const chart=$(element);
 if(chart.__qbudgetClickBound)return;
 chart.__qbudgetClickBound=true;
 chart.on('plotly_click',event=>{
  const point=event?.points?.[0];if(!point)return;
  if(kind==='pie')chooseGraphRows('pie','Camembert',point.label||point.data?.labels?.[point.pointNumber]||'');
  else {
   const nodeId=point.id||point.data?.ids?.[point.pointNumber]||point.data?.ids?.[point.pointIndex];
   if(!nodeId)return;
   const name=point.label||point.data?.labels?.[point.pointNumber]||'Dépenses';
   chooseGraphRows('hierarchy',model.hierarchyView==='treemap'?'Treemap':'Sunburst',name,nodeId);
  }
 });
}

function drawChart(actual,forecast,limit){
 const name=selected?selected:'Global (comptes actifs)';
 const traces=[{x:actual.map(q=>q.date),y:actual.map(q=>q.v),name,type:'scatter',mode:'lines+markers',line:{color:'#2563eb',width:2.5},marker:{size:5},legendgroup:'global',hovertemplate:'%{x}<br>%{y:,.2f} €<extra>'+name+' · historique</extra>'},
 {x:forecast.map(q=>q.date),y:forecast.map(q=>q.v),name:name+' · prévision',type:'scatter',mode:'lines+markers',showlegend:false,legendgroup:'global',line:{color:'#ea8b23',dash:'dash',width:2.5},marker:{size:5},hovertemplate:'%{x}<br>%{y:,.2f} €<extra>'+name+' · prévision</extra>'}];
 const active=QBudgetEngine.hasOperationFilter(operationFilter());
 if(active){
  const at=$('asof').value||today;
  const start=actual.length?actual[0].date:at;
  const effect=QBudgetEngine.filteredImpact(model,{at,until:limit,account:selected,startDate:start,filter:operationFilter(),includeRecurrences:$('showForecastRows').checked});
  const name='Impact filtré · cumul net (hors solde)';
  traces.push({x:effect.history.map(p=>p.date),y:effect.history.map(p=>p.value),name,type:'scatter',mode:'lines+markers',yaxis:'y2',line:{color:'#0891b2',width:3},marker:{size:5},legendgroup:'filtered',hovertemplate:'%{x}<br>%{y:,.2f} €<extra>Impact filtré · réalisé</extra>'});
  traces.push({x:effect.projection.map(p=>p.date),y:effect.projection.map(p=>p.value),name:name+' · projeté',type:'scatter',mode:'lines+markers',yaxis:'y2',line:{color:'#0891b2',width:2.5,dash:'dash'},marker:{size:5},showlegend:false,legendgroup:'filtered',hovertemplate:'%{x}<br>%{y:,.2f} €<extra>Impact filtré · projeté</extra>'});
  $('filteredInfo').textContent=`Impact des filtres, départ à 0 € au ${start} · ${effect.actualCount} mouvement(s) réalisé(s) · ${effect.futureCount} mouvement(s) futur(s) · cumul net à la consultation ${amount(effect.opening)}, à l’horizon ${amount(effect.closing)}. Axe droit : ce n’est PAS un solde bancaire. Les comptes hors cumul sont exclus de cet impact en vue globale.`;
 }else $('filteredInfo').textContent='Active Recherche, Type ou Tags dans « Opérations datées » pour superposer le cumul des flux filtrés. Les soldes restent inchangés.';
 if(!selected){const palette=['#8756b3','#0d9488','#c05785','#5865b6','#b45309','#64748b'];
  QBudgetEngine.excludedAccountNames(model).forEach((account,index)=>{
   const {history,future}=curveFor(account,$('asof').value||today,limit);
   const series=[...history,...future.filter((p,i)=>i>0||!history.length)].filter((p,i,arr)=>i===0||p.date!==arr[i-1].date||p.v!==arr[i-1].v);
   traces.push({x:series.map(p=>p.date),y:series.map(p=>p.v),name:account+' (hors cumul)',type:'scatter',mode:'lines+markers',line:{color:palette[index%palette.length],width:2,dash:'dot'},marker:{size:4},hovertemplate:'%{x}<br>%{y:,.2f} €<extra>'+account+' · hors cumul</extra>'});
  });
 }
 Plotly.react('chart',traces,plotLayout({height:390,hovermode:'x unified',margin:{l:65,r:active?80:20,t:24,b:46},xaxis:{type:'date',rangeslider:{visible:true}},yaxis:{title:'Solde bancaire (€)',tickformat:',.0f'},...(active?{yaxis2:{title:'Flux filtrés cumulés (€)',overlaying:'y',side:'right',showgrid:false,zeroline:true,tickformat:',.0f'}}:{}),legend:{orientation:'h',y:1.15}}),{responsive:true,displaylogo:false,locale:'fr'});
}
// Les catégories sont des dimensions sémantiques, sans impact sur les soldes.
function selectedDonutCategory(){
 const categories=QBudgetEngine.tagCategories(model);
 return categories.some(c=>c.name===model.donutCategory)?model.donutCategory:(categories[0]?.name||'');
}
function renderDonutRadios(){
 const host=$('donutRadios'),categories=QBudgetEngine.tagCategories(model);
 const signature=JSON.stringify(categories.map(c=>c.name));
 if(host.dataset.signature===signature){for(const radio of host.querySelectorAll('input[type=radio]'))radio.checked=radio.value===selectedDonutCategory();return}
 host.dataset.signature=signature;host.replaceChildren();
 if(!categories.length){host.textContent='Premier tag (aucune catégorie configurée)';return}
 for(const category of categories){
  const label=document.createElement('label');label.className='donut-radio';
  const radio=document.createElement('input');radio.type='radio';radio.name='donutCategory';radio.value=category.name;
  radio.checked=category.name===selectedDonutCategory();
  radio.onchange=()=>{model.donutCategory=category.name;save();renderVisuals()};
  label.append(radio,document.createTextNode(category.name));host.append(label);
 }
}
function renderVisuals(){
 const until=$('asof').value||today,rows=filteredAnalysisRows(aggregateRows().filter(r=>!QBudgetEngine.isFloating(r)&&r.date<=until&&r.nature!=='planned'&&r.currency==='EUR'));
 const monthly=new Map();
 for(const r of rows){const m=r.date.slice(0,7),v=monthly.get(m)||{income:0,expense:0};if(r.amount>=0)v.income+=r.amount;else v.expense+=-r.amount;monthly.set(m,v)}
 const months=[...monthly.keys()].sort();
 Plotly.react('flowsChart',[{x:months,y:months.map(m=>monthly.get(m).income),name:'Recettes',type:'bar',marker:{color:'#12805c'}},{x:months,y:months.map(m=>-monthly.get(m).expense),name:'Dépenses',type:'bar',marker:{color:'#dc5e69'}}],plotLayout({height:340,barmode:'relative',xaxis:{title:'Mois'},yaxis:{title:'Flux (€)'},legend:{orientation:'h',y:1.17}}),{responsive:true,displaylogo:false,locale:'fr'});
 const noData={annotations:[{text:'Aucune dépense pour la période',showarrow:false,x:.5,y:.5,xref:'paper',yref:'paper'}]};
 // Écarter les virements internes SEULEMENT des graphiques de répartition.
 // Les soldes, le tableau, l'impact filtré et les flux mensuels gardent toutes les écritures.
 const exclude=model.excludeTransfersFromCharts!==false;
 const breakdownRows=exclude?QBudgetTags.withoutTag(model,rows,'transfert_intercomptes'):rows;
 for(const id of ['excludeTransfersDonut','excludeTransfersSunburst'])$(id).checked=exclude;
 const ignored=rows.length-breakdownRows.length;
 $('transferBreakdownInfo').textContent=exclude
  ?`${ignored} opération(s) avec le tag transfert_intercomptes écartée(s) des deux répartitions uniquement.`
  :'Transferts inclus dans les répartitions. Les soldes ne changent pas.';
 renderDonutRadios();
 const pie=QBudgetEngine.expenseCategoryTotals(model,breakdownRows,selectedDonutCategory());
 Plotly.react('donutChart',pie.length?[{type:'pie',hole:.57,labels:pie.map(x=>x[0]),values:pie.map(x=>x[1]),textinfo:'percent',hovertemplate:'%{label}<br>%{value:,.2f} €<extra></extra>'}]:[],plotLayout({height:340,margin:{l:12,r:12,t:12,b:12},showlegend:true,legend:{orientation:'h',y:-.1},...(pie.length?{}:noData)}),{responsive:true,displaylogo:false,locale:'fr'}).then(()=>bindBreakdownClick('donutChart','pie'));
 const categories=QBudgetEngine.tagCategories(model);
 const depth=Math.max(2,Math.min(8,Number($('sunburstDepth').value)||2));
 $('sunburstDepthText').textContent=depth;
 const names=categories.slice(0,depth).map(c=>c.name);
 $('sunburstDimensions').textContent=names.length?names.join(' → ')+(categories.length<depth?' · profondeur limitée aux catégories disponibles':''):'Sans catégorie : tag → libellé';
 const tree=QBudgetEngine.expenseBreakdown(model,breakdownRows,names);
 const hasExpenses=tree.values[0]>0;
 // Sunburst et Treemap utilisent EXACTEMENT la même arborescence et les mêmes montants.
 breakdownSnapshot={rows:breakdownRows,category:selectedDonutCategory(),dimensions:names};
 const chartType=model.hierarchyView==='treemap'?'treemap':'sunburst';
 for(const radio of document.querySelectorAll('input[name="hierarchyView"]'))radio.checked=radio.value===chartType;
 Plotly.react('sunburstChart',hasExpenses?[{type:chartType,ids:tree.ids,labels:tree.labels,parents:tree.parents,values:tree.values,branchvalues:'total',maxdepth:depth+1,hovertemplate:'%{label}<br>%{value:,.2f} €<extra></extra>'}]:[],plotLayout({height:470,margin:{l:12,r:12,t:15,b:12},...(hasExpenses?{}:noData)}),{responsive:true,displaylogo:false,locale:'fr'}).then(()=>bindBreakdownClick('sunburstChart','hierarchy'));
}
// Le vocabulaire est configurable sans transformer les tags enregistrés.
// Ordre des dimensions : onglets natifs glissables, sans nouvelle bibliothèque.
// Les catégories restent des métadonnées ; réordonner ne modifie aucune opération.
function reorderTagCategories(from,to){
 const ordered=QBudgetTags.moveCategory(QBudgetEngine.tagCategories(model),from,to);
 if(ordered===null)return;
 model.tagCategories=ordered;
 save();renderTagCategories();renderRows();renderSummary();
}
function renderCategoryTabs(categories){
 const host=$('tagCategoryOrder');host.replaceChildren();
 let draggedIndex=null;
 const clearIndicators=()=>{for(const node of host.querySelectorAll('.category-tab'))node.classList.remove('dragging','drop-before','drop-after')};
 for(let i=0;i<categories.length;i++){
  const tab=document.createElement('button');tab.type='button';tab.className='category-tab';tab.draggable=true;
  tab.textContent='⠿ '+categories[i].name;
  tab.title='Glisser pour déplacer cette catégorie ; Alt + flèche gauche/droite au clavier';
  tab.setAttribute('aria-label',categories[i].name+' : réorganiser (glisser ou Alt + flèches)');
  tab.addEventListener('dragstart',event=>{
   draggedIndex=i;clearIndicators();tab.classList.add('dragging');
   event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','category:'+i);
  });
  tab.addEventListener('dragover',event=>{
   if(draggedIndex===null||draggedIndex===i)return;
   event.preventDefault();event.dataTransfer.dropEffect='move';
   const rect=tab.getBoundingClientRect(),after=event.clientX>rect.left+rect.width/2;
   clearIndicators();host.children[draggedIndex]?.classList.add('dragging');
   tab.classList.add(after?'drop-after':'drop-before');
  });
  tab.addEventListener('dragleave',()=>tab.classList.remove('drop-before','drop-after'));
  tab.addEventListener('drop',event=>{
   if(draggedIndex===null)return;
   event.preventDefault();const rect=tab.getBoundingClientRect();
   const after=event.clientX>rect.left+rect.width/2;
   const insertion=i+(after?1:0),target=insertion-(draggedIndex<insertion?1:0);
   const source=draggedIndex;draggedIndex=null;clearIndicators();
   reorderTagCategories(source,target);
  });
  tab.addEventListener('dragend',()=>{draggedIndex=null;clearIndicators()});
  tab.addEventListener('keydown',event=>{
   if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
   event.preventDefault();const destination=i+(event.key==='ArrowRight'?1:-1);
   if(destination<0||destination>=categories.length)return;
   reorderTagCategories(i,destination);
   host.children[destination]?.focus();
  });
  host.append(tab);
 }
}
// Le vocabulaire est configurable sans transformer les tags enregistrés.
function renderTagCategories(){
 const host=$('tagCategoryList');host.replaceChildren();
 const categories=QBudgetEngine.tagCategories(model);
 renderCategoryTabs(categories);
 for(let i=0;i<categories.length;i++){
  const item=categories[i],row=document.createElement('div');row.className='tag-category-editor';row.id='tag-category-row-'+i;
  const field=(name,cls,val)=>{const label=document.createElement('label');label.className='field';label.textContent=name;const input=document.createElement('input');input.className=cls;input.value=val;label.append(input);row.append(label);return input};
  const name=field('Catégorie', 'tag-name',item.name),tags=field('Tags (virgules)', 'tag-values',item.tags.join(', '));
  const sourceLabel=document.createElement('label');sourceLabel.className='field';sourceLabel.textContent='Source';
  const source=document.createElement('select');source.className='tag-source';source.add(new Option('Tags libres','tags'));source.add(new Option('Type existant','type'));source.value=item.source||'tags';sourceLabel.append(source);row.append(sourceLabel);
  const change=()=>{
   const next=categories.map(c=>({...c,tags:[...c.tags]}));
   next[i]={name:name.value.trim(),tags:tags.value.split(',').map(t=>t.trim()).filter(Boolean),source:source.value};
   try{model.tagCategories=QBudgetEngine.validateTagCategories(next);model.donutCategory=selectedDonutCategory();save();renderTagCategories();renderRows();renderSummary()}catch(error){$('tagCategoryStatus').textContent=error.message}
  };
  for(const el of [name,tags,source])el.addEventListener('change',change);
  const button=(label,tip,fn)=>{const b=document.createElement('button');b.className='secondary';b.textContent=label;b.title=tip;b.type='button';b.onclick=fn;row.append(b)};
  button('×','Retirer la catégorie (tags conservés)',()=>{model.tagCategories=categories.filter((_,index)=>index!==i);save();renderTagCategories();renderRows();renderSummary()});
  host.append(row);
 }
 $('tagCategoryStatus').textContent=categories.length+' catégorie(s) · ordre modifiable par glisser-déposer des onglets · tags non classés toujours visibles dans la ligne de détail.';
}

$('addTagCategory').onclick=()=>{
 const used=new Set(QBudgetEngine.tagCategories(model).map(c=>c.name.toLocaleLowerCase('fr')));let name='Nouvelle catégorie',i=2;while(used.has(name.toLocaleLowerCase('fr')))name='Nouvelle catégorie '+i++;
 model.tagCategories.push({name,tags:[],source:'tags'});save();renderTagCategories();renderRows();renderSummary();
};
$('exportTagCategories').onclick=()=>download(QBudgetTags.exportJson(model.tagCategories),'qbudget-categories.json','application/json');
$('importTagCategories').onclick=()=>$('tagCategoriesFile').click();
$('tagCategoriesFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const next=QBudgetTags.parseJson(await file.text());model.tagCategories=next;if(!next.some(c=>c.name===model.donutCategory))model.donutCategory=next[0]?.name||'';save();render();$('tagCategoryStatus').textContent=next.length+' catégories importées. Les opérations et leurs tags n’ont pas été modifiés.'}catch(error){$('tagCategoryStatus').textContent='Import non effectué : '+error.message}finally{e.target.value=''}};
$('resetTagCategories').onclick=()=>{if(!confirm('Remplacer uniquement le dictionnaire de catégories par celui de départ ? Les tags des opérations seront conservés.'))return;model.tagCategories=QBudgetTags.defaults();model.donutCategory='Nature';save();render()};
for(const radio of document.querySelectorAll('input[name="hierarchyView"]'))radio.onchange=()=>{
 if(!radio.checked)return;
 model.hierarchyView=radio.value;clearChartSelection();save();renderRows();renderVisuals();
};
$('sunburstDepth').oninput=()=>{model.sunburstDepth=Number($('sunburstDepth').value);save();renderVisuals()};
for(const id of ['excludeTransfersDonut','excludeTransfersSunburst'])$(id).onchange=e=>{
 model.excludeTransfersFromCharts=e.target.checked;save();renderVisuals();
};

function renderSummary(){const date=$('asof').value||today,rows=aggregateRows().filter(r=>!QBudgetEngine.isFloating(r)),balance=historicBalance(rows,date),end=$('horizon').value||addMonths(date,1);const events=end>=date?recurrenceEvents(rows,date,end):[];const prediction=balance===null?null:balance+events.reduce((s,e)=>s+e.amount,0);$('balance').textContent=balance===null?'Indisponible':amount(balance);$('balanceInfo').textContent=selected?selected:'Comptes actifs · EUR uniquement ('+QBudgetEngine.includedAccountNames(model).length+'/'+QBudgetEngine.cashAccountNames(model).length+')';$('projection').textContent=prediction===null?'Indisponible':amount(prediction);$('forecastInfo').textContent=end<date?'Date de fin antérieure à la consultation':`${events.length} échéance(s) estimée(s) jusqu'au ${end}`;$('count').textContent=rows.length;$('countInfo').textContent=`${Object.values(model.rules).filter(q=>selected?q.account===selected:QBudgetEngine.includedAccountNames(model).includes(q.account)).length} règle(s) de récurrence`;
// Courbe historique : calcul dans les deux sens autour du solde daté.
// Chaque point représente un solde de FIN de journée (toutes les opérations du jour incluses).
// On inclut un point juste avant la première opération pour voir son impact.
const history=rows.filter(r=>r.nature!=='planned'&&r.date<=date).sort((a,b)=>a.date.localeCompare(b.date));
const pointDates=new Set(history.map(r=>r.date));
const refDates=selected?[model.references[selected]?.date]:QBudgetEngine.includedAccountNames(model).map(a=>model.references[a]?.date);
for(const d of refDates)if(d&&d<=date)pointDates.add(d);
if(history.length){const previous=asDate(history[0].date);previous.setDate(previous.getDate()-1);pointDates.add(dateStr(previous))}
pointDates.add(date);
const points=[];
for(const d of [...pointDates].filter(d=>d<=date).sort()){
  const b=historicBalance(rows,d);if(b!==null)points.push({date:d,v:b});
}
let next=balance;const projected=balance===null?[]:[{date,v:balance}];for(const e of events){next+=e.amount;projected.push({date:e.date,v:next})}if(prediction!==null)projected.push({date:end,v:prediction});drawChart(points,projected,end);renderVisuals();
const warning=$('warning');if(!selected&&QBudgetEngine.includedAccountNames(model).some(a=>!model.references[a])){$('refInfo').textContent='Sélectionne un compte pour enregistrer un solde de référence. Le total global requiert un solde connu pour chaque compte.'}else $('refInfo').textContent='Le solde saisi est un solde de fin de journée : qbudget soustrait les opérations pour reconstituer le passé et les ajoute pour calculer la suite.';const currencies=new Set(rows.map(r=>r.currency).filter(Boolean));warning.style.display=currencies.size>1?'block':'none';if(currencies.size>1)warning.textContent='Plusieurs devises : le cumul sans conversion n’est pas fiable. Filtre par compte.'}
function clearBulkSelection(){selectedRowIds.clear();updateBulkStatus()}
function updateBulkStatus(message=''){
 const count=selectedRowIds.size;
 $('bulkStatus').textContent=message||count+' opération(s) sélectionnée(s). Les prévisions calculées sont exclues.';
 $('applyBulkTag').disabled=!count;
 $('clearSelectedRows').disabled=!count;
 $('selectVisibleRows').disabled=!displayedEditableIds.length;
}
$('selectVisibleRows').onclick=()=>{for(const id of displayedEditableIds)selectedRowIds.add(id);updateBulkStatus();renderRows()};
$('clearSelectedRows').onclick=()=>{clearBulkSelection();renderRows()};
$('applyBulkTag').onclick=()=>{
 if(!selectedRowIds.size)return;
 try{
  const result=QBudgetTags.addTag(model,[...selectedRowIds],$('bulkTag').value);
  save();selectedRowIds.clear();render();
  updateBulkStatus(`Tag ajouté à ${result.changed} opération(s) sur ${result.selected} sélectionnée(s) · ${result.alreadyPresent} déjà taguée(s).`);
 }catch(error){updateBulkStatus(error.message)}
};
function renderRows(){
 const at=$('asof').value||today,until=$('horizon').value||addMonths(at,1);
 const saved=inAccount().filter(r=>!QBudgetEngine.isFloating(r));
 const forecastRows=$('showForecastRows').checked?QBudgetEngine.recurrencePreview(model,at,until,selected):[];
 let rows=filteredAnalysisRows([...saved,...forecastRows]);
 if(chartSelection)rows=rows.filter(r=>!r.forecast&&chartSelection.ids.has(r.id));
 const mode=$('sort').value;
 rows.sort((a,b)=>mode==='amount'?a.amount-b.amount:mode==='asc'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
 const body=$('rows');body.replaceChildren();
 displayedEditableIds=rows.slice(0,1000).filter(r=>!r.forecast).map(r=>r.id);
 for(const id of [...selectedRowIds])if(!displayedEditableIds.includes(id))selectedRowIds.delete(id);
 updateBulkStatus();
 $('tableInfo').textContent=chartSelection
  ?`${chartSelection.source} · ${rows.length} écriture(s) à l'origine de ${amount(chartSelection.total)} de dépenses · sélection sans effet sur les soldes`
  :`${saved.length} écriture(s) datée(s) enregistrée(s) · ${forecastRows.length} échéance(s) FORECAST non enregistrée(s) · ${at} → ${until} · tags et contrôles sous chaque opération`;
 for(const r of rows.slice(0,1000)){
  const n=r.forecast?{}:notes(r),tr=document.createElement('tr');
  tr.className='operation-main'+(r.forecast?' forecast-row':!selected&&(model.excludedAccounts||[]).includes(r.bank)?' excluded-row':'');
  function cell(v,cls=''){const td=document.createElement('td');td.textContent=v;td.className=cls;tr.append(td);return td}
  if(r.forecast)cell('—');else{
   const check=document.createElement('input');check.type='checkbox';check.className='bulk-checkbox';check.checked=selectedRowIds.has(r.id);
   check.title='Sélectionner pour ajouter un tag';check.setAttribute('aria-label','Sélectionner '+r.desc);
   check.onchange=()=>{if(check.checked)selectedRowIds.add(r.id);else selectedRowIds.delete(r.id);updateBulkStatus()};cell('').append(check);
  }
  if(r.manual){
   const dt=document.createElement('input');dt.type='date';dt.value=r.date;dt.title='Effacer la date pour remettre en attente';
   dt.addEventListener('change',()=>{r.date=dt.value||null;if(!dt.value)r.nature='planned';save();render()});cell('').append(dt);
  }else cell(r.date);
  cell(key(r));cell(r.desc);cell(amount(r.amount),'right '+(r.amount<0?'minus':'plus'));
  const origin=cell('');const badge=document.createElement('span');
  badge.className='status'+(r.forecast?' forecast-status':r.nature==='planned'?' planned-status':'');
  badge.textContent=(r.forecast?'FORECAST · calculé':r.nature==='planned'?'PRÉVU · saisi':r.manual?'RÉALISÉ · manuel':'RÉEL · importé')+(!selected&&(model.excludedAccounts||[]).includes(r.bank)?' · HORS CUMUL':'');origin.append(badge);

  // Une opération = deux lignes visuelles, mais une seule écriture dans le moteur.
  const detail=document.createElement('tr');detail.className='operation-detail'+(r.forecast?' forecast-row':!selected&&(model.excludedAccounts||[]).includes(r.bank)?' excluded-row':'');
  const detailCell=document.createElement('td');detailCell.colSpan=6;detail.append(detailCell);
  const content=document.createElement('div');content.className='operation-detail-content';detailCell.append(content);
  const labels=document.createElement('div');labels.className='operation-tag-groups';content.append(labels);
  const organized=QBudgetEngine.organizedTags(model,r);
  let visible=0;
  function group(name,values,extraClass=''){
   if(!values.length)return;
   visible++;
   const el=document.createElement('span');el.className='operation-tag-group '+extraClass;
   const label=document.createElement('strong');label.textContent=name+' :';
   const value=document.createElement('span');value.textContent=values.join(' · ');
   el.append(label,value);labels.append(el);
  }
  for(const dimension of organized.values)group(dimension.name,dimension.values);
  group('Libres',organized.other,'operation-tag-other');
  if(!visible){const none=document.createElement('span');none.className='operation-no-tags';none.textContent='Aucun tag';labels.append(none)}

  const controls=document.createElement('div');controls.className='operation-detail-controls';content.append(controls);
  if(r.forecast){
   const rule=document.createElement('span');rule.className='operation-detail-note';rule.textContent='Récurrence : '+(model.rules[r.ruleId]?.desc||r.ruleId||'règle calculée');controls.append(rule);
  }else{
   function field(labelText,control){const label=document.createElement('label');label.className='operation-detail-field';const name=document.createElement('span');name.textContent=labelText;label.append(name,control);controls.append(label);return control}
   const tag=document.createElement('input');tag.className='tag';tag.value=QBudgetEngine.tagsFor(model,r).join(', ');tag.placeholder=r.category||'Ajouter un tag';
   tag.addEventListener('change',()=>{setTags(r,tag.value);render()});field('Modifier les tags',tag);
   const typ=document.createElement('select');for(const [value,label] of [['','Non défini'],['ponctuel','Ponctuel'],['recurrent','Récurrent']])typ.add(new Option(label,value));
   typ.value=n.type||'';typ.addEventListener('change',()=>{if(typ.value==='recurrent')connectRule(r);else{update(r,{type:typ.value,ruleId:null});render()}});field('Type',typ);
   const rule=document.createElement('button');rule.className='secondary';rule.type='button';const linked=model.rules[n.ruleId];rule.textContent=linked?linked.desc:'Lier / créer';rule.onclick=()=>connectRule(r);controls.append(rule);
   if(r.duplicate?.toLowerCase()==='oui'){
    const duplicate=document.createElement('span');duplicate.className='operation-duplicate';duplicate.textContent='Doublon potentiel';controls.append(duplicate);
   }
  }
  body.append(tr,detail);
 }
 $('empty').style.display=rows.length?'none':'block';$('empty').textContent=rows.length>0?'':'Aucune opération à afficher.';
}

function update(r,patch){model.notes[r.id]={...notes(r),...patch};save();renderSummary()}
function setTags(r,text){const tags=[...new Set(text.split(',').map(s=>s.trim()).filter(Boolean))];model.notes[r.id]={...notes(r),tags,tag:tags[0]||''};save()}
function renderPending(){
 const tags=$('pendingTags').value.split(',').map(s=>s.trim()).filter(Boolean);
 const all=QBudgetEngine.pendingOperations(model,{account:selected});
 const rows=QBudgetEngine.pendingOperations(model,{account:selected,tags,mode:$('pendingTagMode').value,search:$('pendingSearch').value});
 $('pendingCount').textContent=all.length;
 const body=$('pendingRows');body.replaceChildren();$('pendingEmpty').style.display=rows.length?'none':'block';
 $('pendingEmpty').textContent=all.length?'Aucun résultat pour ces filtres.':'Aucune opération en attente.';
 for(const r of rows){
   const tr=document.createElement('tr');const cell=()=>{const td=document.createElement('td');tr.append(td);return td};
   const acct=document.createElement('select');acct.add(new Option('À attribuer',''));for(const name of accounts())acct.add(new Option(name,name));acct.value=r.bank||'';acct.onchange=()=>{r.bank=acct.value;r.account=acct.value;save();render()};cell().append(acct);
   const desc=document.createElement('input');desc.value=r.desc||'';desc.onchange=()=>{if(!desc.value.trim()){alert('Libellé requis');desc.value=r.desc;return}r.desc=desc.value.trim();save();renderPending()};cell().append(desc);
   const val=document.createElement('input');val.type='number';val.step='0.01';val.value=r.amount;val.onchange=()=>{const n=numeric(val.value);if(n===null){alert('Montant invalide');val.value=r.amount;return}r.amount=n;save();renderPending()};cell().append(val);
   const tag=document.createElement('input');tag.className='tag';tag.value=QBudgetEngine.tagsFor(model,r).join(', ');tag.onchange=()=>{setTags(r,tag.value);renderPending()};cell().append(tag);
   const date=document.createElement('input');date.type='date';cell().append(date);
   const nature=document.createElement('select');nature.add(new Option('Prévu','planned'));nature.add(new Option('Réalisé','actual'));nature.value=r.nature==='actual'?'actual':'planned';cell().append(nature);
   const actions=document.createElement('div');actions.className='queue-actions';const schedule=document.createElement('button');schedule.textContent='Dater';schedule.onclick=()=>{if(!date.value){alert('Choisis une date dans le calendrier.');return}if(!r.bank){alert('Attribue un compte pour dater cette opération.');return}if(nature.value==='planned'&&date.value<=($('asof').value||today)){alert('Pour une opération prévue, choisis une date après la consultation ; sinon sélectionne « Réalisé ».');return}r.date=date.value;r.nature=nature.value;save();render()};const del=document.createElement('button');del.className='warn';del.textContent='Supprimer';del.onclick=()=>{if(!confirm('Supprimer définitivement cette opération manuelle en attente ?'))return;model.rows=model.rows.filter(row=>row!==r);delete model.notes[r.id];save();render()};actions.append(schedule,del);cell().append(actions);body.append(tr);
 }
}
function render(){renderAccounts();renderTagCategories();renderSummary();renderRows();renderPending();renderRules();$('importStatus').textContent=`${model.rows.length} opérations chargées · ${accounts().length} compte(s) · stockage local au navigateur`}
// Prévisualisation isolée : aucun changement du modèle tant que l'import n'est pas confirmé.
let normalization=null,bankConfig=QBudgetBankConfig;
function clearNormalization(message){normalization=null;$('importRaw').disabled=true;$('downloadNormalized').disabled=true;$('normalizationPreview').classList.add('hidden');$('normalizationRows').replaceChildren();$('normalizationStatus').textContent=message}
$('rawCsv').onchange=()=>clearNormalization('Prêt à normaliser : '+$('rawCsv').files.length+' fichier(s) sélectionné(s).');
$('bankConfigFile').onchange=async()=>{const file=$('bankConfigFile').files[0];if(!file)return;try{const cfg=JSON.parse(await file.text());if(!Array.isArray(cfg.banques)||!cfg.banques.length)throw Error('banques[] manquant');QBudgetNormalize.outputSpec(cfg);bankConfig=cfg;clearNormalization('Configuration personnalisée chargée. Relance la normalisation.')}catch(e){alert('Configuration invalide : '+e.message)}};
$('resetBankConfig').onclick=()=>{bankConfig=QBudgetBankConfig;$('bankConfigFile').value='';clearNormalization('Profils bancaires fournis restaurés. Relance la normalisation.')};
$('normalizeRaw').onclick=async()=>{
 clearNormalization('Normalisation locale en cours…');$('normalizeRaw').disabled=true;
 try{
  const files=Array.from($('rawCsv').files);
  if(!files.length)throw Error('Sélectionne au moins un CSV bancaire brut');
  const raw=await Promise.all(files.map(async file=>({name:file.name,content:await file.arrayBuffer()})));
  const result=await QBudgetNormalize.normalizeFiles(raw,bankConfig);
  // Vérification de bout en bout avant import : l'importeur de qbudget doit accepter la sortie.
  const items=readCsv(result.csv);
  if(items.length!==result.rows.length)throw Error('Nombre de lignes incohérent entre normalisation et lecture qbudget');
  normalization={...result,items};
  const detail=result.sources.map(x=>`${x.banque} : ${x.count} (${x.name})`).join(' · ');
  $('normalizationStatus').textContent=`${result.rows.length} opération(s) prêtes · ${result.duplicates} doublon(s) potentiel(s) conservé(s). ${detail}. Aperçu des 20 premières lignes.`;
  const tbody=$('normalizationRows');tbody.replaceChildren();
  for(const r of result.rows.slice(0,20)){
   const tr=document.createElement('tr');
   for(const col of [r.date,r.banque,r.description,r.montant,r.doublon_potentiel||'—',r.source]){const td=document.createElement('td');td.textContent=col;tr.append(td)}
   tbody.append(tr);
  }
  $('normalizationPreview').classList.remove('hidden');$('importRaw').disabled=false;$('downloadNormalized').disabled=false;
 }catch(e){const details=e.details?.slice(0,20).join(' | ');clearNormalization(e.message+(details?' — '+details:''))}finally{$('normalizeRaw').disabled=false}
};
function applyBankRows(items){
 if(model.rows.length&&!confirm('Remplacer les lignes bancaires du CSV ? Les comptes, opérations manuelles et annotations seront conservés. Exporte tes annotations avant si nécessaire.'))return false;
 model.rows=[...items,...model.rows.filter(r=>r.manual&&!items.some(x=>x.id===r.id))];selected='';clearChartSelection();clearBulkSelection();save();render();return true;
}
$('importRaw').onclick=()=>{if(!normalization)return;try{if(applyBankRows(normalization.items))$('normalizationStatus').textContent+=` · ${normalization.items.length} lignes importées dans qbudget.`}catch(e){alert('Import interrompu : '+e.message)}};
$('downloadNormalized').onclick=()=>{if(normalization)download(normalization.csv,'operations_normalisees.csv','text/csv;charset=utf-8')};
$('csv').addEventListener('change',async ev=>{const f=ev.target.files[0];if(!f)return;try{const items=readCsv(await f.text());applyBankRows(items)}catch(e){alert('Import interrompu : '+e.message)}});
$('sample').onclick=()=>{
 if(model.rows.length&&!confirm('Charger la démo fictive remplacera les opérations et annotations actuellement en mémoire dans ce navigateur. Exporte d’abord tes annotations si nécessaire. Continuer ?'))return;
 try{
  if(!globalThis.QBudgetDemo)throw Error('src/demo.js introuvable');
  const demo=QBudgetDemo;
  const rows=readCsv(demo.csv);
  model=QBudgetEngine.mergeAnnotations(rows,structuredClone(demo.annotations));
  model.tagCategories=QBudgetTags.defaults();
  model.donutCategory='Nature';model.excludeTransfersFromCharts=true;model.tagDefaultsVersion=2;model.sunburstDepth=3;$('sunburstDepth').value=3;
  selected='';clearChartSelection();clearBulkSelection();$('asof').value=demo.asof;$('horizon').value=demo.until;
  $('auditAt').value=demo.asof;$('auditUntil').value=demo.until;
  save();render();
  $('importStatus').textContent=`Démonstration fictive : ${rows.length} bancaires + ${model.rows.length-rows.length} manuelles (${model.rows.filter(QBudgetEngine.isFloating).length} flottantes), ${Object.keys(model.rules).length} récurrences · du 01/09 au 25/10/2026`;
 }catch(e){alert('Démo impossible : '+e.message)}
};
$('account').onchange=()=>{selected=$('account').value;clearChartSelection();clearBulkSelection();render()};$('asof').onchange=()=>{clearChartSelection();renderSummary();renderRows()};$('horizon').onchange=()=>{clearChartSelection();renderSummary();renderRows()};for(const id of ['search','typeFilter','operationTags','operationTagMode','showForecastRows'])$(id).addEventListener('input',()=>{clearChartSelection();clearBulkSelection();renderRows();renderSummary()});$('sort').addEventListener('input',()=>{clearBulkSelection();renderRows()});$('saveRef').onclick=()=>{if(!selected)return;const b=numeric($('refBalance').value),date=$('refDate').value;if(b===null||!date){alert('Renseigne une date et un solde valides.');return}model.references[selected]={date,balance:b};save();renderSummary()};$('clearData').onclick=()=>{if(!confirm('Effacer opérations, tags et références stockés dans ce navigateur ?'))return;model={rows:[],notes:{},references:{},rules:{},accounts:[],excludedAccounts:[],tagCategories:QBudgetTags.defaults(),donutCategory:'',sunburstDepth:2,hierarchyView:'sunburst',excludeTransfersFromCharts:true,tagDefaultsVersion:2};selected='';clearChartSelection();clearBulkSelection();localStorage.removeItem(KEY);$('sunburstDepth').value=2;render()};
$('exportCli').onclick=()=>download(JSON.stringify(model,null,2),'qbudget-data.json','application/json');$('auditAt').value=$('asof').value;
$('horizon').value=addMonths($('asof').value,1);$('auditUntil').value=$('horizon').value;
$('asof').addEventListener('change',()=>{$('auditAt').value=$('asof').value});
$('horizon').addEventListener('change',()=>{$('auditUntil').value=$('horizon').value});
function exportAuditCsv(){
  try {
    const scope=$('auditScope').value,at=$('auditAt').value,until=$('auditUntil').value;
    const records=QBudgetEngine.auditOperations(model,{scope,at,until,account:''});
    const csv=QBudgetEngine.auditCsv(records);
    download(csv,'qbudget-audit-'+scope+'-'+until+'.csv','text/csv;charset=utf-8');
    $('importStatus').textContent=`Audit : ${records.length} opérations exportées · ${scope} · jusqu’au ${until}`;
  }catch(e){alert('Export impossible : '+e.message)}
}
$('downloadAudit').onclick=exportAuditCsv;
$('exportAudit').onclick=exportAuditCsv;$('exportSettings').onclick=()=>{const obj={version:3,notes:model.notes,references:model.references,rules:model.rules,accounts:model.accounts,excludedAccounts:model.excludedAccounts,tagCategories:model.tagCategories,donutCategory:model.donutCategory,sunburstDepth:model.sunburstDepth,hierarchyView:model.hierarchyView,excludeTransfersFromCharts:model.excludeTransfersFromCharts!==false,tagDefaultsVersion:model.tagDefaultsVersion||2,manualRows:model.rows.filter(r=>r.manual)};download(JSON.stringify(obj,null,2),'qbudget-annotations.json','application/json')};function download(data,name,type){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}$('importSettings').onclick=()=>$('annotationsFile').click();$('annotationsFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const o=JSON.parse(await f.text());if(!o.notes||!o.references)throw Error('Format incompatible');model.notes=o.notes;model.references=o.references;model.rules=o.rules||{};model.accounts=o.accounts||[];model.excludedAccounts=o.excludedAccounts||[];model.tagCategories=QBudgetTags.validate(o.tagCategories===undefined?QBudgetTags.defaults():o.tagCategories);if(!o.tagDefaultsVersion)model.tagCategories=QBudgetTags.upgradeDefaultTreatment(model.tagCategories);model.tagDefaultsVersion=2;model.donutCategory=o.donutCategory||'';model.excludeTransfersFromCharts=o.excludeTransfersFromCharts!==false;model.sunburstDepth=Math.max(2,Math.min(8,Number(o.sunburstDepth)||2));model.hierarchyView=o.hierarchyView==='treemap'?'treemap':'sunburst';$('sunburstDepth').value=model.sunburstDepth;model.rows=[...model.rows.filter(r=>!r.manual),...(o.manualRows||[])];save();render()}catch(err){alert(err.message)}};$('addAccount').onclick=()=>{
 const name=$('newAccountName').value.trim(),balance=numeric($('newAccountBalance').value),at=$('asof').value;
 if(!name||balance===null||!at){alert('Renseigne le compte, son solde et une date de consultation.');return}
 if(accounts().includes(name)){selected=name;render();alert('Ce compte existe déjà.');return}
 model.accounts.push(name);model.references[name]={date:at,balance};selected=name;save();render();
};
$('manualDate').value='';$('addManual').onclick=()=>{const account=$('manualAccount').value,dt=$('manualDate').value||null,desc=$('manualDesc').value.trim(),n=numeric($('manualAmount').value),nature=$('manualNature').value;
 if(!desc||n===null||(!account&&dt)||(!dt&&nature==='actual')){alert('Indique un libellé et un montant. Une opération réalisée doit avoir une date et un compte.');return}
 const r={id:uid(),bank:account,account,date:dt,desc,amount:n,balance:null,currency:'EUR',category:'',duplicate:'',nature,manual:true};
 if(dt&&nature==='planned'&&dt<=($('asof').value||today)){alert('Pour une opération prévue, choisis une date après la consultation.');return}
 model.rows.push(r);setTags(r,$('manualTags').value);save();render();$('manualDesc').value='';$('manualAmount').value='';$('manualTags').value='';$('manualDate').value='';
 if(dt&&Object.values(model.rules).some(q=>q.account===key(r)&&normalizedLabel(q.desc)===normalizedLabel(r.desc)))connectRule(r)
} ;for(const id of ['pendingSearch','pendingTags','pendingTagMode'])$(id).addEventListener('input',renderPending);// Petite API d'inspection en lecture seule pour DevTools (aucune mutation du modèle).
const qbudget=Object.freeze({
 help(){const commands=['qbudget.test() — invariants sur les données courantes','qbudget.demo() — exemples fictifs Qonto / IK / notes de frais','qbudget.pending(["SASU","IK"]) — opérations en attente filtrées (ET)','qbudget.forecast("Qonto") — évolution du compte pro','qbudget.recurrences() — échéances calculées du tableau','qbudget.snapshot() — copie indépendante du modèle','qbudget.comptes() — comptes actifs / hors cumul','qbudget.impact() — impact financier des filtres actifs'];console.table(commands.map(cmd=>({commande:cmd})));return commands;},
 impact(){const at=$('asof').value||today,until=$('horizon').value||addMonths(at,1);const startDate=$('chart').data?.[0]?.x?.[0]||at;const r=QBudgetEngine.filteredImpact(model,{at,until,account:selected,startDate,filter:operationFilter(),includeRecurrences:$('showForecastRows').checked});console.table({...r,history:undefined,projection:undefined});return r;},
 comptes(){const result=QBudgetEngine.accountNames(model).map(name=>({compte:name,cumul:!model.excludedAccounts.includes(name)?'inclus':'hors cumul'}));console.table(result);return result;},
 snapshot(){return structuredClone(model)},
 pending(tags=[]){const r=QBudgetEngine.pendingOperations(model,{tags});const result=r.map(x=>({id:x.id,compte:x.bank,date:x.date,libelle:x.desc,montant:x.amount,tags:QBudgetEngine.tagsFor(model,x)}));console.table(result);return result;},
 forecast(account=''){const r=QBudgetEngine.forecast(model,$('asof').value,$('horizon').value,account);console.log('Prévision',r);return r;},
 recurrences(){const r=QBudgetEngine.recurrencePreview(model,$('asof').value,$('horizon').value,selected);console.table(r.map(x=>({date:x.date,compte:x.bank,libelle:x.desc,montant:x.amount,origine:'FORECAST'})));return r;},
 test(){
  const at=$('asof').value,until=$('horizon').value,before=JSON.stringify(model);
  const withoutPending={...model,rows:model.rows.filter(r=>!QBudgetEngine.isFloating(r))};
  const frozen=QBudgetEngine.forecast(model,at,until),base=QBudgetEngine.forecast(withoutPending,at,until);
  const pending=QBudgetEngine.pendingOperations(model),audit=QBudgetEngine.auditOperations(model,{scope:'all',at,until});
  const preview=QBudgetEngine.recurrencePreview(model,at,until);
  const checks={
   'Moteur valide':QBudgetEngine.check(model).ok,
   'Flottantes hors des soldes et prévisions':JSON.stringify(frozen)===JSON.stringify(base),
   'Flottantes absentes de l’audit':pending.every(x=>!audit.some(a=>a.identifiant===x.id)),
   'Prévisions récurrentes alignées sur l’audit':preview.length===audit.filter(x=>x.origine==='recurrence').length,
   'Consultation sans modification des données':before===JSON.stringify(model),
   'Cumul = somme des seuls comptes actifs':(()=>{const names=QBudgetEngine.includedAccountNames(model);const values=names.map(name=>QBudgetEngine.totalBalance(model,at,name));return values.every(v=>v!==null)&&Math.abs((QBudgetEngine.totalBalance(model,at)||0)-values.reduce((a,b)=>a+b,0))<0.011})()
  };
  console.table(Object.entries(checks).map(([test,ok])=>({test,ok:ok?'OK':'ÉCHEC'})));
  if(!Object.values(checks).every(Boolean))throw Error('Échec de vérification qbudget — consulter le tableau');
  return checks;
 },
 demo(){
  const r=this.test();
  const find=id=>model.rows.find(x=>x.id===id);
  const ids=['DEMO-PERSO-ESSENCE','DEMO-PERSO-PEAGE','DEMO-PERSO-RESTO','DEMO-IK-PRO','DEMO-IK-PERSO','DEMO-NDF-PRO','DEMO-NDF-PERSO'];
  if(ids.some(id=>!find(id)))throw Error('Charge d’abord la démo fictive pour qbudget.demo()');
  const checks={
   'Qonto présent, solde initial nul':QBudgetEngine.accountNames(model).includes('Qonto')&&QBudgetEngine.totalBalance(model,'2026-10-25','Qonto')===0,
   'Essence, péage, resto réellement datés':ids.slice(0,3).every(id=>!!find(id).date&&find(id).nature==='actual'&&find(id).amount<0),
   'IK symétriques flottantes':find('DEMO-IK-PRO').amount===-find('DEMO-IK-PERSO').amount&&ids.slice(3,5).every(id=>QBudgetEngine.isFloating(find(id))),
   'Note de frais symétrique flottante':find('DEMO-NDF-PRO').amount===-find('DEMO-NDF-PERSO').amount&&ids.slice(5).every(id=>QBudgetEngine.isFloating(find(id)))
  };
  console.table(Object.entries(checks).map(([test,ok])=>({test,ok:ok?'OK':'ÉCHEC'})));
  if(!Object.values(checks).every(Boolean))throw Error('Échec des exemples de démo');
  return {...r,...checks};
 }
});
globalThis.qbudget=qbudget;

// Disposition visuelle indépendante du modèle financier et de ses exports.
// Déplace toutes les cartes dans une grille commune, en conservant les largeurs d'origine.
function initializeLayout(){
 const dashboard=$('dashboard');
 const stats=document.querySelector('main .grid');
 if(stats){for(const card of [...stats.children]){card.classList.add('layout-third');dashboard.insertBefore(card,stats)}stats.remove()}
 const visuals=document.querySelector('main .vizgrid');
 if(visuals){for(const card of [...visuals.children]){card.classList.add(card.querySelector('#sunburstChart')?'layout-wide':'layout-half');card.style.gridColumn='';dashboard.insertBefore(card,visuals)}visuals.remove()}
 const cards=[...dashboard.children].filter(el=>el.classList.contains('card'));
 for(let i=0;i<cards.length;i++){
  const card=cards[i];card.dataset.panel=card.id||'panel-'+i;
  const toolbar=document.createElement('div');toolbar.className='layout-tools';
  const grip=document.createElement('button');grip.type='button';grip.className='layout-grip';grip.draggable=true;grip.textContent='⠿ Déplacer';grip.title='Glisser pour réorganiser';grip.setAttribute('aria-label','Déplacer la section');
  grip.addEventListener('dragstart',ev=>{draggedCard=card;card.classList.add('is-dragged');ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',card.dataset.panel)});
  grip.addEventListener('dragend',()=>{draggedCard=null;cards.forEach(el=>el.classList.remove('drop-before','drop-after','is-dragged'))});
  const move=(direction)=>{const arr=[...dashboard.querySelectorAll(':scope > .card')],idx=arr.indexOf(card),newIndex=idx+direction;if(newIndex<0||newIndex>=arr.length)return;
    const neighbor=arr[newIndex];dashboard.insertBefore(card,direction<0?neighbor:neighbor.nextSibling);storeLayout();resizePlots()};
  const up=document.createElement('button');up.type='button';up.textContent='↑';up.title='Monter cette section';up.setAttribute('aria-label','Monter la section');up.onclick=()=>move(-1);
  const down=document.createElement('button');down.type='button';down.textContent='↓';down.title='Descendre cette section';down.setAttribute('aria-label','Descendre la section');down.onclick=()=>move(1);
  toolbar.append(grip,up,down);card.prepend(toolbar);
  card.addEventListener('dragover',ev=>{if(!draggedCard||draggedCard===card)return;ev.preventDefault();ev.dataTransfer.dropEffect='move';card.classList.remove('drop-before','drop-after');card.classList.add(dropAfter(ev,card)?'drop-after':'drop-before')});
  card.addEventListener('dragleave',ev=>{if(!card.contains(ev.relatedTarget))card.classList.remove('drop-before','drop-after')});
  card.addEventListener('drop',ev=>{if(!draggedCard||draggedCard===card)return;ev.preventDefault();const after=dropAfter(ev,card);dashboard.insertBefore(draggedCard,after?card.nextSibling:card);storeLayout();draggedCard.classList.remove('is-dragged');draggedCard=null;cards.forEach(c=>c.classList.remove('drop-after','drop-before'));resizePlots()});
 }
 let saved=[];try{const value=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'[]');if(Array.isArray(value))saved=value}catch{}
 const byId=new Map(cards.map(card=>[card.dataset.panel,card]));
 // Append known cards in saved order, then new cards for forward compatibility.
 for(const id of saved){if(byId.has(id)){dashboard.append(byId.get(id));byId.delete(id)}}
 for(const card of byId.values())dashboard.append(card);
 $('resetLayout').onclick=()=>{for(const card of cards)dashboard.append(card);try{localStorage.removeItem(LAYOUT_KEY)}catch{}resizePlots()};
}
let draggedCard=null;
function dropAfter(event,card){const r=card.getBoundingClientRect();return event.clientY>r.top+r.height/2}
function storeLayout(){try{localStorage.setItem(LAYOUT_KEY,JSON.stringify([...$('dashboard').querySelectorAll(':scope > .card')].map(c=>c.dataset.panel)))}catch{}}
function resizePlots(){if(typeof Plotly==='undefined')return;for(const id of ['chart','flowsChart','donutChart','sunburstChart']){try{Plotly.Plots.resize($(id))}catch{}}}

initializeLayout();renderModuleVersions();load();$('sunburstDepth').value=Math.max(2,Math.min(8,Number(model.sunburstDepth)||2));render();window.addEventListener('resize',renderSummary);
