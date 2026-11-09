// Calcul d'une courbe historique par parcours inverse, indépendant du moteur financier.
// Un solde de fin de journée + les flux datés suffisent : O(n log n) au lieu de
// recalculer le solde pour chaque date (O(n * nombre de dates)).
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.QBudgetHistoryPlot=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const version='0.19.1';
 function points(actualRows,pointDates,closingBalance){
  if(closingBalance===null||!Number.isFinite(Number(closingBalance)))return [];
  const operations=[...actualRows].sort((a,b)=>a.date.localeCompare(b.date));
  const dates=[...new Set(pointDates)].sort();
  const result=new Array(dates.length);
  let value=Number(closingBalance),index=operations.length-1;
  for(let i=dates.length-1;i>=0;i--){
   const date=dates[i];
   while(index>=0&&operations[index].date>date){value-=Number(operations[index].amount);index--}
   result[i]={date,v:Math.round(value*100)/100};
  }
  return result;
 }
 return Object.freeze({version,points});
});
