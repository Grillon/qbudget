#!/usr/bin/env node
'use strict';
// Vérifier tous les modules, outils et tests au lieu de maintenir une liste partielle.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=['import_releves.js',...['src','scripts','tests'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(name=>name.endsWith('.js')).map(name=>dir+'/'+name))];
for(const file of files)execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});
console.log(`${files.length} fichiers JavaScript vérifiés.`);
