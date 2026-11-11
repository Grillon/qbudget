'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const editor=require('../src/editor.js');
const order=['row:a','row:b','row:c','row:d','row:e'];
test('clic simple, Ctrl/Cmd et Shift sont additifs à la recherche, sans mutation des opérations',()=>{
 const original=[...order];
 let s=editor.selectKeys(new Set(),order,'','row:b');
 assert.deepEqual([...s.keys],['row:b']);
 s=editor.selectKeys(s.keys,order,s.anchor,'row:d',{ctrl:true});
 assert.deepEqual([...s.keys],['row:b','row:d']);
 s=editor.selectKeys(s.keys,order,s.anchor,'row:e',{shift:true});
 assert.deepEqual([...s.keys],['row:d','row:e']);
 s=editor.selectKeys(s.keys,order,s.anchor,'row:b',{ctrl:true,shift:true});
 assert.deepEqual([...s.keys],['row:d','row:e','row:b','row:c']);
 s=editor.selectKeys(s.keys,order,s.anchor,'row:b',{ctrl:true});
 assert.deepEqual([...s.keys],['row:d','row:e','row:c']);
 assert.deepEqual(order,original);
});
test('élément absent et plage sans ancre ne sélectionnent jamais de lignes cachées',()=>{
 const s=editor.selectKeys(new Set(['row:a']),['row:b','row:c'],'row:a','row:c',{shift:true});
 assert.deepEqual([...s.keys],['row:c']);
 const unknown=editor.selectKeys(s.keys,order,s.anchor,'row:introuvable');
 assert.deepEqual([...unknown.keys],['row:c']);
});
test('interface : tableau plein largeur, détail séparé, actions par sélection ET par Regex',()=>{
 const html=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('src/editor.js','utf8');
 for(const id of ['editorItems','editorSearch','editorSearchMode','editorSelectMatching','editorApplySelectedTag','editorApplyTag','editorDetailBackdrop','editorClose'])
  assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/\.editor-table\{width:100%;table-layout:fixed/);
 assert.match(html,/\.editor-detail-backdrop\[hidden\]\{display:none\}/);
 assert.match(src,/selectKeys\(selectedKeys,matchingEditableKeys/);
 assert.match(src,/root\.QBudgetEngine\.compileSearch\(term,mode\)/);
 assert.match(src,/byId\('editorApplySelectedTag'\)\.onclick/);
 assert.match(src,/byId\('editorApplyTag'\)\.onclick/);
 assert.match(src,/root\.QBudgetTags\.addTags\(getModel\(\),ids,tag\)/);
});
