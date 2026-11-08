'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('src/ui.js','utf8');
test('UI exposes CSV audit controls and calls shared engine',()=>{
  for(const id of ['exportAudit','auditScope','auditAt','auditUntil','downloadAudit'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(ui,/QBudgetEngine\.auditOperations\(model/);
  assert.match(ui,/QBudgetEngine\.auditCsv\(records\)/);
  assert.match(ui,/download\(csv,'qbudget-audit-/);
});
test('module UI JavaScript has valid syntax',()=>{
 assert.match(html,/src\/ui\.js/);
 new vm.Script(ui);
});
