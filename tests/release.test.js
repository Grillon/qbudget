'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pkg=require('../package.json');
const version=require('../src/version.js');
const demoSandbox={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/demo.js'),'utf8'),demoSandbox);
const fixtures=path.join(__dirname,'fixtures');
const engine=require('../src/engine.js');
test('version CLI, importateur, HTML et package identiques',()=>{
 const cli=execFileSync(process.execPath,['src/cli.js','--version'],{cwd:root,encoding:'utf8'}).trim();
 const cliFromCommand=execFileSync(process.execPath,['src/cli.js','forecast','--version'],{cwd:root,encoding:'utf8'}).trim();
 const py=execFileSync('python3',['import_releves.py','--version'],{cwd:root,encoding:'utf8'}).trim();
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.equal(cli,pkg.version);assert.equal(cliFromCommand,pkg.version);
 assert.ok(py.endsWith(pkg.version));assert.equal(version.version,pkg.version);
 assert.match(html,/id="appVersion"/);assert.match(html,/QBudgetVersion\.version/);
 assert.match(html,/src\/version\.js/);
});
test('démonstration HTML : exactement les 92 opérations et les 12 règles des fixtures',()=>{
 const demo=demoSandbox.QBudgetDemo;
 assert.equal(demo.csv,fs.readFileSync(path.join(fixtures,'life_2026_operations.csv'),'utf8'));
 assert.deepEqual(JSON.parse(JSON.stringify(demo.annotations)),JSON.parse(fs.readFileSync(path.join(fixtures,'life_2026_annotations.json'),'utf8')));
 const rows=engine.readCsv(demo.csv);
 const model=engine.mergeAnnotations(rows,demo.annotations);
 assert.equal(rows.length,92);assert.equal(Object.keys(model.rules).length,12);
 assert.equal(Object.keys(model.references).length,3);
 assert.equal(rows.filter(r=>r.date==='2026-10-25').length,4);
 assert.equal(rows.filter(r=>r.desc==='Ticket métro'&&r.amount===-2.5&&r.date==='2026-10-01').length,2);
 assert.equal(demo.asof,'2026-10-25');assert.equal(demo.until,'2026-11-30');
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/QBudgetDemo/);
});
test('générateurs de version et de démo restent synchronisés',()=>{
 execFileSync('python3',['scripts/sync-version.py','--check'],{cwd:root});
 execFileSync('python3',['scripts/build-demo.py','--check'],{cwd:root});
});
test('scénario démo et CLI produisent le même audit',()=>{
 const demo=demoSandbox.QBudgetDemo;
 const model=engine.mergeAnnotations(engine.readCsv(demo.csv),demo.annotations);
 const expected=engine.auditCsv(engine.auditOperations(model,{scope:'all',at:demo.asof,until:'2027-12-31'}));
 const actual=execFileSync(process.execPath,['src/cli.js','export','--scope','all','--at',demo.asof,'--until','2027-12-31','--csv',path.join(fixtures,'life_2026_operations.csv'),'--annotations',path.join(fixtures,'life_2026_annotations.json')],{cwd:root,encoding:'utf8'});
 assert.equal(actual,expected);
});
