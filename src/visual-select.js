// Selection analytique : relie les zones Plotly aux écritures sources, sans modifier le moteur.
(function(root,factory){
 const api=factory(root.QBudgetEngine || (typeof require==='function'?require('./engine.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetVisualSelect=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(engine){
 'use strict';
 const fold=s=>String(s??'').trim().toLocaleLowerCase('fr');
 const round=n=>Math.round(n*100)/100;
 const categoryFor=(model,name)=>engine.tagCategories(model).find(c=>c.name===name);
 const fallbackLabel=(model,row)=>engine.tagsFor(model,row)[0]||row.category||'Sans tag';
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
 return Object.freeze({version:'0.18.4',select});
});
