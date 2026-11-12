// Selection analytique : relie les zones Plotly aux écritures sources, sans modifier le moteur.
(function(root,factory){
 const api=factory(root.QBudgetEngine || (typeof require==='function'?require('./engine.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetVisualSelect=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(engine){
 'use strict';
 const fold=s=>String(s??'').trim().toLocaleLowerCase('fr');
 const round=n=>Math.round(n*100)/100;
 // Préférences de lecture uniquement : le dictionnaire et les opérations restent intacts.
 function hierarchyDimensions(model){
  const names=engine.tagCategories(model).map(c=>c.name),known=new Set(names);
  return Array.isArray(model.hierarchyDimensions)
   ?[...new Set(model.hierarchyDimensions.filter(name=>known.has(name)))]:names;
 }
 function perspectives(model){
  const names=engine.tagCategories(model).map(c=>c.name);
  const find=name=>names.find(n=>fold(n)===fold(name));
  const poste=find('Poste')||find('Nature');
  return [
   {id:'activities',question:'Comment se répartissent mes dépenses entre perso et pro ?',dimensions:[find('Entité'),poste]},
   {id:'contexts',question:'Dans quels contextes est-ce que je dépense ?',dimensions:[find('Contexte'),poste]},
   {id:'projects',question:'Combien coûtent mes projets ?',dimensions:[find('Entité'),find('Projet'),poste]},
   {id:'purpose',question:'Où va mon argent ?',dimensions:[find('Finalité'),poste]}
  ].filter(p=>p.dimensions.every(Boolean));
 }
 function applyPerspective(model,id){
  const perspective=perspectives(model).find(p=>p.id===id);
  return perspective?{...model,hierarchyDimensions:[...perspective.dimensions],sunburstDepth:perspective.dimensions.length}:model;
 }
 const categoryFor=(model,name)=>engine.tagCategories(model).find(c=>c.name===name);
 const fallbackLabel=(model,row)=>(row.forecast?(row.tags||[]):engine.tagsFor(model,row))[0]||row.category||'Sans tag';
 function categoryLabel(model,row,name){
  const category=categoryFor(model,name);
  return category?(engine.tagsByCategory(model,row,category)[0]||'Non renseigné'):fallbackLabel(model,row);
 }
 function dimensionsFor(model,row,names){
  const categories=names.map(name=>categoryFor(model,name)).filter(Boolean);
  return categories.length
   ?categories.map(c=>engine.tagsByCategory(model,row,c)[0]||'Non renseigné')
   :[fallbackLabel(model,row),(row.desc||'Sans libellé').trim()||'Sans libellé'];
 }
 // Une seule sélection de dépenses pour Camembert / Sunburst / Treemap.
 // Les opérations prévues saisies par l'utilisateur sont conservées ; les flottantes
 // restent hors horizon. Les récurrences sont générées à la volée (aucune sauvegarde).
 function analysisRows(model,{at,until,account='',filter={}}={}){
  const end=until>=at?until:at;
  const accounts=new Set(account?[account]:engine.includedAccountNames(model));
  const valid=row=>accounts.has(row.bank)&&(!row.currency||row.currency==='EUR')&&engine.operationMatchesFilter(model,row,filter);
  const stored=(model.rows||[]).filter(row=>!engine.isFloating(row)&&row.date<=end&&valid(row));
  const recurrent=until>=at?engine.recurrencePreview(model,at,until,account).filter(valid):[];
  return {
   rows:[...stored,...recurrent],end,
   actualCount:stored.filter(row=>row.nature!=='planned'&&row.date<=at).length,
   plannedCount:stored.filter(row=>row.nature==='planned'||row.date>at).length,
   forecastCount:recurrent.length
  };
 }
 // rows doit être EXACTEMENT la sélection déjà affichée dans les graphiques (filtres, date, transferts).
 // Un montant apparaît une seule fois : les niveaux hiérarchiques ne sont jamais additionnés.
 function select(model,rows,{kind='pie',category='',dimensions=[],label='',nodeId=''}={}){
  let path;
  if(kind!=='pie'){
   if(nodeId==='total')path=[];
   else {
    try{path=JSON.parse(nodeId)}catch{return null}
    if(!Array.isArray(path)||path.some(x=>typeof x!=='string'))return null;
   }
  }
  const selected=rows.filter(r=>{
   if(!(Number(r.amount)<0))return false;
   if(kind==='pie')return fold(categoryLabel(model,r,category))===fold(label);
   const labels=dimensionsFor(model,r,dimensions);
   return path.length<=labels.length&&path.every((part,i)=>part===labels[i]);
  });
  return {ids:selected.map(r=>r.id),count:selected.length,total:round(selected.reduce((sum,r)=>sum-Number(r.amount),0))};
 }
 return Object.freeze({version:'0.20.1',select,analysisRows,hierarchyDimensions,perspectives,applyPerspective});
});
