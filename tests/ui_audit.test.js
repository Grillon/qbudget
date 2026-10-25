'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('UI exposes CSV audit controls and calls shared engine',()=>{
  for(const id of ['exportAudit','auditScope','auditAt','auditUntil','downloadAudit'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/QBudgetEngine\.auditOperations\(model/);
  assert.match(html,/QBudgetEngine\.auditCsv\(records\)/);
  assert.match(html,/download\(csv,'qbudget-audit-/);
});
test('inline UI JavaScript has valid syntax',()=>{
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(inline,'inline script should exist');
 new vm.Script(inline[1]);
});
