// Tags : vocabulaire, import/export et ajout en masse. Aucune règle métier.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetTags=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.18.0';
 // Catégories de départ éditables et supprimables, jamais imposées aux opérations.
 const defaultData=[
  {name:'Nature',tags:['alimentation','courses','repas','restaurant','essence','peage','transport','telecom','logement','streaming','energie','eau','assurance','sante','loisirs','sport','IK','noteDeFrais','copro','impots','vetements','cadeaux','revenu'],source:'tags'},
  {name:'Périodicité',tags:['Récurrent','Ponctuel'],source:'type'},
  {name:'Contexte',tags:['mission','quotidien','deplacement','travail'],source:'tags'},
  {name:'Entité',tags:['SASU','personnel'],source:'tags'},
  {name:'Traitement',tags:['remboursement','payéPerso','enCoursDeCreation'],source:'tags'},
  {name:'Variabilité',tags:['fixe','variable'],source:'tags'}
 ];
 function clone(data){return JSON.parse(JSON.stringify(data))}
 function defaults(){return clone(defaultData)}
 function validate(data){
  if(typeof root.QBudgetEngine==='object'&&typeof root.QBudgetEngine.validateTagCategories==='function')return root.QBudgetEngine.validateTagCategories(data);
  // Le module peut également être utilisé seul dans Node pour valider la structure JSON.
  if(!Array.isArray(data))throw Error('Liste de catégories invalide');
  const names=new Set(),allTags=new Set();
  return data.map(c=>{
   const name=String(c?.name||'').trim();
   if(!name||!Array.isArray(c.tags))throw Error('Catégorie invalide');
   const n=name.toLocaleLowerCase('fr');if(names.has(n))throw Error('Catégorie en double : '+name);names.add(n);
   const tags=[];
   for(const item of c.tags){const t=String(item).trim(),key=t.toLocaleLowerCase('fr');if(!t)continue;if(allTags.has(key))throw Error('Tag en double : '+t);allTags.add(key);tags.push(t)}
   return {name,tags,source:c.source==='type'?'type':'tags'};
  });
 }
 function exportJson(categories){return JSON.stringify({format:'qbudget-tag-categories',schemaVersion:1,categories:validate(categories)},null,2)}
 function parseJson(text){
  const obj=typeof text==='string'?JSON.parse(text):text;
  if(!obj||Array.isArray(obj)||obj.format!=='qbudget-tag-categories'||obj.schemaVersion!==1)throw Error('Fichier JSON de catégories incompatible (format ou version)');
  return validate(obj.categories);
 }
 // Ordre d'affichage des dimensions : fonction pure, index final (après retrait).
 // Aucun changement aux tags ni aux opérations, et aucun effet si le déplacement est nul.
 function moveCategory(categories,from,to){
  const list=validate(categories);
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=list.length||to>=list.length||from===to)return null;
  const [moved]=list.splice(from,1);list.splice(to,0,moved);
  return list;
 }
 // Mutation limitée aux annotations de tags ; identifiants inexistants ignorés, aucun ajout en double.
 // Retourne le nombre réellement modifié, distinct du nombre sélectionné.
 function addTag(model,ids,tag){
  const value=String(tag??'').trim();
  if(!value||value.includes(','))throw Error('Saisis un seul tag, sans virgule.');
  if(!Array.isArray(ids))throw Error('Sélection invalide');
  const index=new Map((model.rows||[]).filter(r=>!r.forecast).map(r=>[r.id,r]));
  const valid=[...new Set(ids)].filter(id=>index.has(id));
  const updatedNotes={...model.notes};let changed=0;
  for(const id of valid){
   const old=updatedNotes[id]||{};
   const existing=[...(Array.isArray(old.tags)?old.tags:[]),...(typeof old.tag==='string'?old.tag.split(','):[])].map(t=>String(t).trim()).filter(Boolean);
   const seen=new Set(existing.map(t=>t.toLocaleLowerCase('fr')));
   if(seen.has(value.toLocaleLowerCase('fr')))continue;
   const tags=[...new Map([...existing,value].map(t=>[t.toLocaleLowerCase('fr'),t])).values()];
   updatedNotes[id]={...old,tags,tag:tags[0]||''};changed++;
  }
  model.notes=updatedNotes;
  return {selected:valid.length,changed,alreadyPresent:valid.length-changed};
 }
 return Object.freeze({version,defaults,validate,exportJson,parseJson,moveCategory,addTag});
});
