#!/usr/bin/env node
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8','.md':'text/plain; charset=utf-8'};
function startServer({directory=root,port=8000}={}){
 const base=fs.realpathSync(directory);
 const server=http.createServer((request,response)=>{
  try{
   let pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
   if(pathname==='/'||pathname==='/dev/')pathname+='index.html';
   if(!/^\/(?:dev\/)?(?:index\.html|plotly\.min\.js|src\/[\w.-]+\.js|examples\/[\w.-]+\.(?:csv|json)|docs\/[\w.-]+\.md)$/.test(pathname))throw Error('Not found');
   const file=fs.realpathSync(path.join(base,pathname.slice(1)));
   if(!file.startsWith(base+path.sep)||!fs.statSync(file).isFile())throw Error('Not found');
   response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
   fs.createReadStream(file).on('error',()=>response.destroy()).pipe(response);
  }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Introuvable');}
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server))});
}
if(require.main===module){
 const args=process.argv.slice(2);let directory=root,port=8000;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--directory')directory=path.resolve(args[++i]||'.');
  else if(args[i]==='--port')port=Number(args[++i]);
  else{process.stderr.write('Usage : node scripts/serve.js [--directory DOSSIER] [--port PORT]\n');process.exit(1)}
 }
 if(!Number.isInteger(port)||port<1||port>65535){process.stderr.write('Port invalide\n');process.exit(1)}
 startServer({directory,port}).then(()=>console.log(`qbudget : http://127.0.0.1:${port}/`)).catch(error=>{console.error(error.message);process.exitCode=1});
}
module.exports={startServer};
