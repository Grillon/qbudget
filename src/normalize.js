// Normalisation bancaire locale : même configuration banques.json que l'importateur historique.
// JavaScript natif uniquement, utilisable dans le navigateur et dans Node pour les tests.
(function(root){'use strict';
const FIELDS=['id','banque','compte','date','date_valeur','description','montant','devise','solde','categorie','sous_categorie','statut','source','doublon_potentiel'];
const SIGNATURE_FIELDS=['banque','compte','date','date_valeur','description','montant','devise','solde','statut'];
const clean=value=>String(value??'').trim().replace(/^\ufeff/,'');
function decode(raw){
 if(typeof raw==='string')return raw.replace(/^\ufeff/,'');
 if(raw instanceof ArrayBuffer)raw=new Uint8Array(raw);
 if(!ArrayBuffer.isView(raw))throw Error('Fichier attendu : texte ou octets CSV');
 try{return new TextDecoder('utf-8',{fatal:true}).decode(raw).replace(/^\ufeff/,'')}
 catch(e){return new TextDecoder('windows-1252').decode(raw).replace(/^\ufeff/,'')}
}
function csvRows(src,separator){
 // Retourne les champs et leur vraie ligne de début (y compris si un champ contient un retour ligne).
 const rows=[];let row=[],value='',quoted=false,atStart=true,line=1,rowStart=1;
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(quoted){
   if(c==='"'&&src[i+1]==='"'){value+='"';i++}
   else if(c==='"')quoted=false;
   else {value+=c;if(c==='\n')line++}
  }else if(c==='"'&&atStart){quoted=true;atStart=false}
  else if(c===separator){row.push(value);value='';atStart=true}
  else if(c==='\r'||c==='\n'){
   row.push(value);rows.push({cells:row,line:rowStart});row=[];value='';atStart=true;
   if(c==='\r'&&src[i+1]==='\n')i++;
   line++;rowStart=line;
  }else{value+=c;atStart=false}
 }
 if(quoted)throw Error('CSV invalide : guillemet non fermé');
 if(row.length||value!=='')rows.push({cells:[...row,value],line:rowStart});
 return rows;
}
function parseNumber(source,separator){
 let value=clean(source).replace(/[\u00a0\u202f '\u0027]/g,'');
 if(!value)return '';
 if(separator===',')value=value.replace(/\./g,'').replace(/,/g,'.');
 else if(separator==='.')value=value.replace(/,/g,'');
 else throw Error('séparateur décimal incorrect : '+JSON.stringify(separator));
 if(!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))throw Error('montant invalide : '+JSON.stringify(source));
 // Forme décimale exacte, sans passer par Number ni perdre les centimes.
 const negative=value.startsWith('-');value=value.replace(/^[+-]/,'');
 const [whole,fraction]=value.split('.');
 const integer=(whole||'0').replace(/^0+(?=\d)/,'');
 return (negative?'-':'')+integer+(fraction!==undefined?'.'+fraction:'');
}
function decimalSubtractAbs(credit,debit){
 const c=credit||'0',d=debit||'0',cd=(c.split('.')[1]||'').length,dd=(d.split('.')[1]||'').length,scale=Math.max(cd,dd);
 const scaled=v=>{const sign=v.startsWith('-')?-1n:1n;const abs=v.replace(/^[+-]/,'');const [whole,fraction='']=abs.split('.');return sign*BigInt((whole||'0')+fraction.padEnd(scale,'0'))};
 const result=scaled(c)-(scaled(d)<0n?-scaled(d):scaled(d));
 const sign=result<0n?'-':'';const digits=(result<0n?-result:result).toString().padStart(scale+1,'0');
 return sign+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}
function parseDate(source,format){
 let value=clean(source);if(!value)return '';
 if(format==='%Y-%m-%d'&&value.length>10)value=value.slice(0,10);
 const m=format==='%Y-%m-%d'? /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(value) : format==='%d/%m/%Y'? /^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/.exec(value) : null;
 if(!m)throw Error('date invalide '+JSON.stringify(value)+', attendu '+format);
 const [year,month,day]=format==='%Y-%m-%d'?[+m[1],+m[2],+m[3]]:[+m[3],+m[2],+m[1]];
 const max=[31,(year%4===0&&(year%100!==0||year%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
 if(year<1||month<1||month>12||day<1||day>max)throw Error('date invalide '+JSON.stringify(value)+', attendu '+format);
 return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function select(cells,headers,selector){
 if(selector==null)return '';
 if(Array.isArray(selector)){for(const one of selector){const val=select(cells,headers,one);if(val)return val}return ''}
 if(typeof selector==='string')selector={colonne:selector};
 const positions=[];for(let i=0;i<headers.length;i++)if(headers[i]===selector.colonne)positions.push(i);
 const occ=selector.occurrence||1;
 if(positions.length<occ)throw Error('colonne absente : '+JSON.stringify(selector.colonne)+' (occurrence '+occ+')');
 return clean(cells[positions[occ-1]]);
}
function extract(cells,headers,config){
 const result=Object.fromEntries(FIELDS.map(field=>[field,'']));result.banque=config.nom;
 const mapping=config.champs;
 for(const field of ['compte','description','categorie','sous_categorie','statut','devise'])if(field in mapping)result[field]=select(cells,headers,mapping[field]);
 for(const field of ['date','date_valeur'])if(field in mapping)result[field]=parseDate(select(cells,headers,mapping[field]),config.format_date);
 for(const field of ['montant','solde'])if(field in mapping){const spec=mapping[field],decimal=typeof spec==='object'&&!Array.isArray(spec)?spec.decimal||config.decimal||'.':config.decimal||'.';result[field]=parseNumber(select(cells,headers,spec),decimal)}
 if('debit' in mapping&&'credit' in mapping){const decimal=config.decimal||'.';result.montant=decimalSubtractAbs(parseNumber(select(cells,headers,mapping.credit),decimal),parseNumber(select(cells,headers,mapping.debit),decimal))}
 result.devise=config.devise_fixe||result.devise;
 if(!result.date)throw Error('date manquante');if(!result.montant)throw Error('montant manquant');
 return result;
}
function detect(headers,configs,delimiter){
 const counts=new Map();for(const h of headers)counts.set(h,(counts.get(h)||0)+1);
 const matches=configs.filter(cfg=>cfg.separateur===delimiter&&cfg.colonnes_requises.every(h=>(counts.get(h)||0)>=1)&&Object.entries(cfg.occurrences_requises||{}).every(([h,n])=>(counts.get(h)||0)>=n));
 if(matches.length!==1)throw Error('format non reconnu ou ambigu ('+matches.length+' configurations compatibles)');
 return matches[0];
}
function outputSpec(settings){
 const spec=settings.sortie||{},separator=spec.separateur||';',decimal=spec.decimal||'.';
 if(typeof separator!=='string'||separator.length!==1||['\r','\n','"'].includes(separator))throw Error('sortie.separateur doit être un caractère valide');
 if(!['.',','].includes(decimal))throw Error('sortie.decimal doit être "." ou ","');
 const cols=spec.colonnes||FIELDS;
 if(!Array.isArray(cols)||!cols.length)throw Error('sortie.colonnes doit être une liste non vide');
 const fields=[],names=[];
 for(const col of cols){const field=typeof col==='string'?col:col.champ,name=typeof col==='string'?col:col.nom;
  if(!FIELDS.includes(field)||typeof name!=='string'||!name.trim())throw Error('colonne de sortie inconnue ou nom invalide : '+JSON.stringify(col));
  fields.push(field);names.push(name);
 }
 if(new Set(names).size!==names.length)throw Error('les noms de colonnes de sortie doivent être uniques');
 return {separator,decimal,fields,names};
}
function quoteCsv(value,delimiter){value=String(value??'');return /["\n\r]/.test(value)||value.includes(delimiter)?'"'+value.replace(/"/g,'""')+'"':value}
function renderCsv(rows,spec){
 const line=values=>values.map(x=>quoteCsv(x,spec.separator)).join(spec.separator)+'\r\n';
 return line(spec.names)+rows.map(row=>line(spec.fields.map(f=>['montant','solde'].includes(f)&&row[f]&&spec.decimal===','?row[f].replace('.',','):row[f]))).join('');
}
// Repli sans WebCrypto : fonctionne aussi avec les documents file:// et les contextes non sécurisés.
// SHA-256 standard, implémenté ici pour éviter toute dépendance supplémentaire.
const SHA_K=[
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotate=(x,n)=>(x>>>n)|(x<<(32-n));
function sha256Fallback(text){
 const src=new TextEncoder().encode(text),len=src.length,total=Math.ceil((len+9)/64)*64;
 const buf=new Uint8Array(total);buf.set(src);buf[len]=0x80;
 const dv=new DataView(buf.buffer);dv.setUint32(total-8,Math.floor((len*8)/0x100000000));dv.setUint32(total-4,(len*8)>>>0);
 const state=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const w=new Uint32Array(64);
 for(let start=0;start<total;start+=64){
  for(let i=0;i<16;i++)w[i]=dv.getUint32(start+4*i);
  for(let i=16;i<64;i++){
   const x=w[i-15],y=w[i-2];
   w[i]=(w[i-16]+(rotate(x,7)^rotate(x,18)^(x>>>3))+w[i-7]+(rotate(y,17)^rotate(y,19)^(y>>>10)))>>>0;
  }
  let [a,b,c,d,e,f,g,h]=state;
  for(let i=0;i<64;i++){
   const t1=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+SHA_K[i]+w[i])>>>0;
   const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
   h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  for(const [i,v] of [a,b,c,d,e,f,g,h].entries())state[i]=(state[i]+v)>>>0;
 }
 return state.map(v=>v.toString(16).padStart(8,'0')).join('');
}
async function sha256(text){
 const subtle=root.crypto?.subtle||(typeof require==='function'?require('node:crypto').webcrypto.subtle:null);
 if(!subtle)return sha256Fallback(text);
 const hash=await subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
}
// All-or-nothing : si une seule ligne est erronée, rien n'est importable.
async function normalizeFiles(files,settings){
 if(!Array.isArray(files)||!files.length)throw Error('Sélectionne au moins un relevé CSV brut');
 if(!settings||!Array.isArray(settings.banques))throw Error('Configuration des banques absente');
 const spec=outputSpec(settings),rows=[],errors=[],sources=[],groups=new Map();
 for(const file of files){const name=String(file.name||'releve.csv');try{
  const content=decode(file.content??file.bytes);
  const headerLine=content.split(/\r?\n/).find(x=>x.trim())||'';
  const delimiter=(headerLine.match(/;/g)||[]).length>(headerLine.match(/,/g)||[]).length?';':',';
  const parsed=csvRows(content,delimiter);
  if(!parsed.length)throw Error('fichier vide');
  const headers=parsed.shift().cells.map(clean),cfg=detect(headers,settings.banques,delimiter);
  let count=0;
  for(const record of parsed){if(!record.cells.some(clean))continue;
   try{
    if(record.cells.length!==headers.length)throw Error(record.cells.length+' colonnes au lieu de '+headers.length);
    const item=extract(record.cells,headers,cfg);item.source=name;
    const signature=await sha256(SIGNATURE_FIELDS.map(f=>item[f]).join('\x1f'));
    item.id=(await sha256(signature+'\x1f'+name+'\x1f'+record.line)).slice(0,20);
    rows.push(item);groups.set(signature,[...(groups.get(signature)||[]),item]);count++;
   }catch(e){errors.push(name+': ligne '+record.line+': '+e.message)}
  }
  sources.push({name,banque:cfg.nom,count});
 }catch(e){errors.push(name+': '+e.message)}}
 if(errors.length){const err=Error('Normalisation interrompue : '+errors.length+' erreur(s)');err.details=errors;throw err}
 for(const group of groups.values())if(group.length>1)for(const item of group)item.doublon_potentiel='oui';
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.banque.localeCompare(b.banque,'en')||a.id.localeCompare(b.id));
 return {rows, csv:renderCsv(rows,spec),sources,duplicates:rows.filter(x=>x.doublon_potentiel==='oui').length,columns:spec.names};
}
const api={version:'0.15.0',normalizeFiles,decode,csvRows,parseNumber,parseDate,outputSpec,sha256Fallback};
if(typeof module==='object'&&module.exports)module.exports=api;
root.QBudgetNormalize=api;
})(typeof globalThis!=='undefined'?globalThis:this);
