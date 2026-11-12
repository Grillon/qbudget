// Tags : vocabulaire, import/export et ajout en masse. Aucune règle métier.
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetTags=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const version='0.20.3',defaultsVersion=3;
 // Dictionnaire d’exploration ; le schéma reste en version 1.
 const defaultData=[
  {name:'Entité',tags:['Micro','SASU','Perso','exploration','personnel'],source:'tags'},
  {name:'Projet',tags:['qbudget','microbudget','levelup'],source:'tags'},
  {name:'Poste',tags:['alimentation','courses','repas','restaurant','cantine','essence','peage','transport','transports','telecom','streaming','logement','copro','energie','eau','assurance','sante','loisirs','sport','vetements','cadeaux','impots','urssaf','pret','frais_bancaires','IK','noteDeFrais'],source:'tags'},
  {name:'Contexte',tags:['mission','deplacement','contexte_loisirs','essentiel_quotidien','projets','Pro','quotidien','travail'],source:'tags'},
  {name:'Finalité',tags:['finalite_quotidien','finalite_loisirs','épargne','investissement','activité professionnelle'],source:'tags'},
  {name:'Périodicité',tags:['Récurrent','Ponctuel'],source:'type'},
  {name:'Traitement / État',tags:['remboursement','payéPerso','enCoursDeCreation','transfert_intercomptes'],source:'tags'},
  {name:'Variabilité',tags:['fixe','variable'],source:'tags'}
 ];
 // Remplacement unique des anciennes catégories, sans toucher aux annotations.
 // Les éditions réalisées après cette mise à jour restent ensuite libres.
 function upgradeCategories(model){
  if(Number(model.tagDefaultsVersion)>=defaultsVersion)return model;
  const categories=defaults(),names=new Set(categories.map(c=>c.name));
  const aliases=new Map([['Nature','Poste'],['Traitement','Traitement / État'],['Périmètre','Entité']]);
  const rename=name=>aliases.get(name)||name;
  const donut=rename(model.donutCategory);
  return {...model,tagCategories:categories,tagDefaultsVersion:defaultsVersion,
   donutCategory:names.has(donut)?donut:'Poste',
   ...(Array.isArray(model.hierarchyDimensions)?{hierarchyDimensions:[...new Set(model.hierarchyDimensions.map(rename).filter(name=>names.has(name)))]}:{})};
 }
 // Filtrage générique, seulement pour une visualisation (jamais une mutation).
 // Accepte les tags des écritures enregistrées comme ceux des prévisions.
 function withoutTag(model,rows,tag){
  const wanted=String(tag).trim().toLocaleLowerCase('fr');
  if(!wanted)return [...rows];
  return rows.filter(row=>{
   const tags=row.forecast?(row.tags||[]):(typeof root.QBudgetEngine?.tagsFor==='function'
    ?root.QBudgetEngine.tagsFor(model,row)
    :[...(model.notes?.[row.id]?.tags||[])]);
   return !tags.some(t=>String(t).trim().toLocaleLowerCase('fr')===wanted);
  });
 }
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
 function parseTagList(text){
  const values=String(text??'').split(',').map(t=>t.trim()).filter(Boolean),seen=new Set();
  const tags=values.filter(t=>{const key=t.toLocaleLowerCase('fr');if(seen.has(key))return false;seen.add(key);return true});
  if(!tags.length)throw Error('Saisis au moins un tag, séparé des suivants par une virgule.');
  return tags;
 }
 // Remplace uniquement les catégories explicitement choisies pour une opération.
 // Les tags libres, catégories non touchées et autres annotations sont conservés.
 function retagOperation(model,id,choices){
  const engine=root.QBudgetEngine||(typeof require==='function'?require('./engine.js'):null);
  const row=(model.rows||[]).find(r=>r.id===id&&!r.forecast);
  if(!row)throw Error('Opération à retaguer introuvable');
  if(!choices||typeof choices!=='object'||Array.isArray(choices))throw Error('Choix de catégories invalides');
  const fold=value=>String(value).trim().toLocaleLowerCase('fr');
  const categories=validate(model.tagCategories||[]),automatic=engine.automaticTagsFor(model,row);
  const before=engine.manualTagsFor(model,row);let tags=[...before];
  for(const [name,value] of Object.entries(choices)){
   const category=categories.find(c=>c.name===name);
   if(!category||category.source!=='tags')throw Error('Catégorie non modifiable : '+name);
   if(typeof value!=='string')throw Error('Tag invalide : '+name);
   const selected=value===''?'':category.tags.find(tag=>fold(tag)===fold(value));
   if(selected===undefined)throw Error('Tag absent de la catégorie : '+name);
   const allowed=new Set(category.tags.map(fold)),derived=automatic.filter(tag=>allowed.has(fold(tag)));
   if(derived.length&&(derived.length!==1||fold(selected)!==fold(derived[0])))throw Error('Le tag de « '+name+' » provient d’une association de libellés. Modifie cette association pour le remplacer.');
   const current=tags.filter(tag=>allowed.has(fold(tag)));
   if(!derived.length&&current.length===(selected?1:0)&&(!selected||fold(current[0])===fold(selected)))continue;
   tags=tags.filter(tag=>!allowed.has(fold(tag)));
   if(selected&&!derived.length)tags.push(selected);
  }
  const changed=JSON.stringify(tags)!==JSON.stringify(before);
  if(changed)model.notes={...model.notes,[id]:{...(model.notes?.[id]||{}),tags,tag:tags[0]||''}};
  return {changed};
 }
 // API historique : conserve la validation d'un seul tag.
 function addTag(model,ids,tag){
  const value=String(tag??'').trim();
  if(!value||value.includes(','))throw Error('Saisis un seul tag, sans virgule.');
  return addTags(model,ids,value);
 }
 // Mutation limitée aux annotations de tags ; identifiants inexistants ignorés, aucun ajout en double.
 // Retourne le nombre réellement modifié, distinct du nombre sélectionné.
 function addTags(model,ids,text){
  const values=parseTagList(text);
  if(!Array.isArray(ids))throw Error('Sélection invalide');
  const index=new Map((model.rows||[]).filter(r=>!r.forecast).map(r=>[r.id,r]));
  const valid=[...new Set(ids)].filter(id=>index.has(id));
  const updatedNotes={...model.notes};let changed=0;
  for(const id of valid){
   const old=updatedNotes[id]||{};
   const existing=[...(Array.isArray(old.tags)?old.tags:[]),...(typeof old.tag==='string'?old.tag.split(','):[])].map(t=>String(t).trim()).filter(Boolean);
   const seen=new Set(existing.map(t=>t.toLocaleLowerCase('fr')));
   const missing=values.filter(value=>!seen.has(value.toLocaleLowerCase('fr')));
   if(!missing.length)continue;
   const tags=[...new Map([...existing,...missing].map(t=>[t.toLocaleLowerCase('fr'),t])).values()];
   updatedNotes[id]={...old,tags,tag:tags[0]||''};changed++;
  }
  if(changed)model.notes=updatedNotes;
  return {selected:valid.length,changed,alreadyPresent:valid.length-changed};
 }
 // Plan pur : retrait exact des tags manuels, sans toucher aux autres annotations.
 function removalPlan(model,ids,tag){
  const value=String(tag??'').trim(),fold=t=>String(t).trim().toLocaleLowerCase('fr');
  if(!value||value.includes(','))throw Error('Saisis un seul tag, sans virgule.');
  if(!Array.isArray(ids))throw Error('Sélection invalide');
  const wanted=fold(value),index=new Map((model.rows||[]).filter(r=>!r.forecast).map(r=>[r.id,r]));
  const valid=[...new Set(ids)].filter(id=>index.has(id)),changes=[];
  const checkAutomatic=typeof root.QBudgetEngine?.automaticTagsFor==='function'&&(model.labelAssociations||[]).some(a=>fold(a.tag)===wanted);
  let automatic=0;
  for(const id of valid){
   const old=model.notes?.[id]||{};
   const existing=[...(Array.isArray(old.tags)?old.tags:[]),...(typeof old.tag==='string'?old.tag.split(','):[])].map(t=>String(t).trim()).filter(Boolean);
   const remaining=existing.filter(t=>fold(t)!==wanted);
   if(remaining.length!==existing.length){
    const tags=[...new Set(remaining)],hasOtherFields=Object.keys(old).some(key=>key!=='tags'&&key!=='tag');
    changes.push({id,note:tags.length||hasOtherFields?{...old,tags,tag:tags[0]||''}:null});
   }
   if(checkAutomatic&&root.QBudgetEngine.automaticTagsFor(model,index.get(id)).some(t=>fold(t)===wanted))automatic++;
  }
  return {changes,result:{selected:valid.length,changed:changes.length,notPresent:valid.length-changes.length,automatic}};
 }
 function removeTagPreview(model,ids,tag){return removalPlan(model,ids,tag).result}
 function removeTag(model,ids,tag){
  const {changes,result}=removalPlan(model,ids,tag);
  if(changes.length){const notes={...model.notes};for(const {id,note} of changes){if(note===null)delete notes[id];else notes[id]=note}model.notes=notes}
  return result;
 }
 return Object.freeze({version,defaultsVersion,defaults,upgradeCategories,validate,exportJson,parseJson,retagOperation,moveCategory,parseTagList,addTag,addTags,removeTag,removeTagPreview,withoutTag});
});
