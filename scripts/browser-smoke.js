#!/usr/bin/env node
'use strict';
// Parcours réels sans bibliothèque d'automatisation : Firefox WebDriver BiDi + Node 22.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {startServer}=require('./serve.js');
const root=path.resolve(__dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
async function connect(url,child){
 for(let i=0;i<150;i++){
  if(child.exitCode!==null)throw Error('Firefox arrêté avant connexion');
  try{return await new Promise((resolve,reject)=>{const ws=new WebSocket(url),timer=setTimeout(()=>{ws.close();reject(Error('connexion'))},500);ws.onopen=()=>{clearTimeout(timer);resolve(ws)};ws.onerror=()=>{clearTimeout(timer);reject(Error('connexion'))}})}catch{await delay(100)}
 }
 throw Error('Firefox inaccessible : vérifie FIREFOX_BIN ou la présence de firefox');
}
async function main(){
 const profile=fs.mkdtempSync(path.join(root,'.qbudget-browser-'));
 let server,child,ws,send,active=false,logs='',checks=0;
 const pending=new Map(),errors=[];
 const check=(ok,label)=>{assert.ok(ok,label);checks++;console.log('OK : '+label)};
 try{
  server=await startServer({port:0});const port=await freePort();
  child=spawn(process.env.FIREFOX_BIN||'firefox',['--headless','--no-remote','--profile',profile,'--remote-debugging-port',String(port),'about:blank'],{cwd:root,env:{...process.env,MOZ_CRASHREPORTER_DISABLE:'1'},stdio:['ignore','pipe','pipe']});
  child.on('error',error=>{logs+=error.message});for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs=(logs+String(chunk)).slice(-12000)});
  ws=await connect(`ws://127.0.0.1:${port}/session`,child);let seq=0;
  send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Délai dépassé : '+method))},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timer);message.type==='error'?p.reject(Error(JSON.stringify(message))):p.resolve(message.result)}else if(message.method==='log.entryAdded'&&message.params.level==='error')errors.push(message.params)};
  await send('session.new',{capabilities:{}});active=true;await send('session.subscribe',{events:['log.entryAdded']});
  const {context}=await send('browsingContext.create',{type:'tab'});
  const evaluate=async body=>{const result=await send('script.evaluate',{expression:`(async()=>{const value=await(async()=>{${body}})();return JSON.stringify(value??null)})()`,target:{context},awaitPromise:true});assert.equal(result.type,'success',JSON.stringify(result.exceptionDetails));return JSON.parse(result.result.value)};
  const click=id=>evaluate(`$('${id}').click();`),input=(id,value)=>evaluate(`$('${id}').value=${JSON.stringify(value)};$('${id}').dispatchEvent(new Event('input',{bubbles:true}));`),choose=(id,value)=>evaluate(`$('${id}').value=${JSON.stringify(value)};$('${id}').dispatchEvent(new Event('change',{bubbles:true}));`);
  const protect=()=>evaluate(`window._alerts=[];window.confirm=()=>true;window.alert=text=>window._alerts.push(text);`);
  const upload=async(csv,count)=>evaluate(`const data=new DataTransfer();data.items.add(new File([${JSON.stringify(csv)}],'test.csv',{type:'text/csv'}));$('csv').files=data.files;$('csv').dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<200&&model.rows.filter(r=>!r.manual).length!==${count}&&!window._alerts.length;i++)await new Promise(r=>setTimeout(r,25));if(window._alerts.length)throw Error(window._alerts.join('; '));`);
  await send('browsingContext.navigate',{context,url:`http://127.0.0.1:${server.address().port}/?smoke=1`,wait:'complete'});await protect();
  check(await evaluate(`return $('appVersion').textContent==='V'+${JSON.stringify(require('../package.json').version)}&&QBudgetNormalize.version===QBudgetVersion.version;`),'application et modules chargés');
  await click('sample');check(await evaluate(`return model.rows.length===99&&model.rows.filter(r=>r.manual).length===7;`),'démo complète avec opérations manuelles et flottantes');
  const exported=await evaluate(`download=(data,name)=>{window._export={data,name}};$('exportCli').click();return JSON.parse(window._export.data);`);
  const engine=require('../src/engine.js'),restored=engine.mergeAnnotations(engine.readCsv(fs.readFileSync(path.join(root,'tests/fixtures/life_2026_operations.csv'),'utf8')),exported);
  check(restored.rows.length===99&&restored.rows.filter(r=>r.manual&&engine.isFloating(r)).length===4,'bouton Export CLI puis relecture : toutes les manuelles conservées');
  await evaluate(`$('newAccountName').value='Budget · commun';$('newAccountBalance').value='100';$('addAccount').click();`);
  await send('browsingContext.reload',{context,wait:'complete'});await protect();
  check(await evaluate(`return QBudgetEngine.totalBalance(model,$('asof').value,'Budget · commun')===100&&!Object.hasOwn(model.references,'Budget');`),'rechargement conserve un nom de compte contenant ·');
  await click('viewEditor');await choose('editorScope','manual');await input('editorBulkTag','test-stockage');
  await evaluate(`window._storageSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota fictif','QuotaExceededError')};const box=$('editorItems').querySelector('.editor-checkbox');box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));$('editorApplySelectedTag').click();`);
  await input('editorSearch','');
  check(await evaluate(`return !$('storageWarning').hidden&&$('storageWarning').textContent.length>0&&!/^Modifications enregistrées/.test($('editorStatus').textContent);`),'quota indisponible : avertissement persistant et aucun faux succès');
  check(await evaluate(`return model.rows.some(r=>QBudgetEngine.manualTagsFor(model,r).includes('test-stockage'));`),'modifications en mémoire toujours exportables en cas d’échec du stockage');
  await evaluate(`Storage.prototype.setItem=window._storageSetItem;save();`);
  check(await evaluate(`return $('storageWarning').hidden;`),'une sauvegarde réussie restaure un état de persistance correct');
  await click('clearData');await upload(fs.readFileSync(path.join(root,'examples/recurrences-potentielles.csv'),'utf8'),10);
  await click('editorOpenRecurrences');await click('editorDetectRecurrences');
  await evaluate(`const card=$('recurrenceBacklogList').firstElementChild;card.open=true;card.querySelector('[data-field="amount"]').value='-99';`);
  await input('editorSearch','SALAIRE');
  check(await evaluate(`const card=$('recurrenceBacklogList').firstElementChild;return card.open&&card.querySelector('[data-field="amount"]').value==='-99';`),'brouillon de récurrence préservé lors d’un changement de filtre');
  await click('viewDashboard');await click('viewEditor');
  check(await evaluate(`const card=$('recurrenceBacklogList').firstElementChild;return card.open&&card.querySelector('[data-field="amount"]').value==='-99';`),'brouillon de récurrence conservé après changement de vue');
  await click('clearData');await upload(fs.readFileSync(path.join(root,'examples/transferts-potentiels.csv'),'utf8'),10);await click('editorOpenTransfers');await click('editorDetectTransfers');
  await evaluate(`window._questions=0;window.confirm=()=>{window._questions++;return false};$('transferBacklogList').firstElementChild.querySelector('button').click();$('acceptAllTransfers').click();`);
  check(await evaluate(`return window._questions===0&&$('transferBacklogCount').textContent==='0'&&model.rows.filter(r=>Math.abs(r.amount)===2000||Math.abs(r.amount)===500).every(r=>QBudgetEngine.tagsFor(model,r).includes('transfert_intercomptes'));`),'transferts : tags sur les deux lignes en un clic, sans confirmation supplémentaire');
  check(await evaluate(`return model.rows.filter(r=>Math.abs(r.amount)===700||Math.abs(r.amount)===800).every(r=>!QBudgetEngine.tagsFor(model,r).includes('transfert_intercomptes'));`),'transferts ambigus et doubles débits inchangés');
  await protect();await click('clearData');
  const csv='Date;Banque;Compte;Libellé;Montant;Devise\n'+Array.from({length:205},(_,i)=>`2026-11-01;BPS;Courant;CARREFOUR;${-(1000+i)/100};EUR`).join('\n');
  await upload(csv,205);await choose('editorScope','bank');await input('editorSearch','');await input('editorBulkTag','courses');
  await evaluate(`const box=$('editorItems').querySelector('.editor-checkbox');box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));$('editorApplySelectedTag').click();`);await input('editorBulkTag','');
  for(const id of ['editorPartialTags','editorWithoutTags'])await evaluate(`$('${id}').checked=true;$('${id}').dispatchEvent(new Event('change',{bubbles:true}));`);
  check(await evaluate(`return $('editorCount').textContent.includes('204 opération(s) taguables')&&$('editorBulkTag').value==='courses';`),'Carrefour : correspondances sans tags et suggestion préremplie');
  await choose('editorPageSize','250');check(await evaluate(`return $('editorItems').querySelectorAll('tr[data-key]').length===204;`),'pagination réglable au-delà de 120 lignes');
  await choose('editorPageSize','120');await evaluate(`document.querySelector('[data-editor-sort="amount"]').click();`);
  const selected=await evaluate(`const rows=[...$('editorItems').querySelectorAll('tr[data-key]')].slice(0,2);for(const row of rows){const box=row.querySelector('.editor-checkbox');box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));}return rows.map(r=>r.dataset.key.slice(4));`);
  await evaluate(`document.querySelector('[data-editor-sort="amount"]').click();`);await input('editorBulkTag','courses, selection-test');await click('editorApplySelectedTag');
  const tagged=await evaluate(`return model.rows.filter(r=>QBudgetEngine.manualTagsFor(model,r).includes('selection-test')).map(r=>r.id);`);
  check([...tagged].sort().join('|')===[...selected].sort().join('|'),'tri puis taggage : sélection conservée sur les bonnes opérations');
  await input('editorBulkTag','courses');await click('editorApplyTag');
  check(await evaluate(`return $('editorCount').textContent.includes('0 opération(s) taguables')&&model.rows.every(r=>QBudgetEngine.manualTagsFor(model,r).includes('courses'));`),'taggage de toutes les correspondances sans mot-clé et au-delà de la pagination');
  assert.deepEqual(errors.filter(e=>e.source?.context===context&&e.type==='javascript'),[]);check(true,'aucune erreur JavaScript applicative');
  console.log(`${checks} contrôles navigateur réussis.`);
 }catch(error){if(logs)console.error(logs);throw error}
 finally{
  if(active&&send&&ws?.readyState===WebSocket.OPEN)await send('browser.close').catch(()=>{});
  if(ws)ws.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Navigateur fermé'))}pending.clear();
  if(child&&child.exitCode===null){await Promise.race([once(child,'exit'),delay(3000)]);if(child.exitCode===null)child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(2000)])}
  if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
