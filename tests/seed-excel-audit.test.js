const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const sandbox={console,document:{getElementById:()=>null}};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','seed-excel.js'),'utf8'),sandbox);
const api=sandbox.SeedExcelImport;

function grid(directCount,qCount,{split=false,instruction='',blankQ=false}={}){
 const g=[['MUŽI /MEN'],[],split?['#','Hráč č. 1','', 'Body','Hráč č. 2','', 'Body','Spolu']:['#','Hráč č. 1','Body','Hráč č. 2','Body','Spolu']];
 for(let i=1;i<=directCount;i++)g.push(split?[i,'Meno'+i,'Priezvisko'+i,100-i,'Druhe'+i,'PriezviskoB'+i,50-i,150-2*i]:[i,'A'+i,100-i,'B'+i,50-i,150-2*i]);
 for(let i=1;i<=qCount;i++)g.push(split?['Q'+i,blankQ?'':'QM'+i,blankQ?'':'QP'+i,20-i,blankQ?'':'QD'+i,blankQ?'':'QPB'+i,10-i,30-2*i]:['Q'+i,blankQ?'':'QA'+i,20-i,blankQ?'':'QB'+i,10-i,30-2*i]);
 if(instruction)g.push([instruction]);
 return g;
}
function result(g){const p=api.parseMenSeedingGrid('fixture',g);assert(p);const plan=api.inferQualificationPlanFromGrids([{sheetName:'fixture',grid:g}],p);return{p,plan,d:api.buildMainDraw(p,plan)}}

// Ružomberok 2026: 10 direct + 20 in qualification -> 6 qualifiers, no BYE.
let r=result(grid(10,20));
assert.equal(r.d.qualifierSlots,6);assert.equal(r.d.byeCount,0);

// Prešov 2026: 12 direct + 9 in qualification -> 4 qualifiers.
r=result(grid(12,9));
assert.equal(r.d.qualifierSlots,4);assert.equal(r.d.byeCount,0);

// Valčianska dolina 2025: split first/surname columns, 14 direct, 2 winners.
r=result(grid(14,4,{split:true,instruction:'Do hlavnej súťaže postupujú víťazi zápasov 1.-2. u mužov.'}));
assert.equal(r.p.directTeams[0],'Meno1 Priezvisko1 / Druhe1 PriezviskoB1');
assert.equal(r.d.qualifierSlots,2);assert.equal(r.d.byeCount,0);

// Strážske 2024: 8 direct, but only four qualifiers advance -> four BYE in 16-seed window.
r=result(grid(8,9,{instruction:'Do hlavnej súťaže postupujú víťazi skupín A,B,C a jeden najlepší team z 2. miesta'}));
assert.equal(r.d.qualifierSlots,4);assert.equal(r.d.byeCount,4);

// Fourteen registered teams -> two actual BYE.
r=result(grid(14,0));assert.equal(r.d.qualifierSlots,0);assert.equal(r.d.byeCount,2);

// Blank Q1-Q4 rows in a prepared main draw are qualifier slots, not BYE.
r=result(grid(12,4,{blankQ:true}));assert.equal(r.p.declaredQualificationSlots,4);assert.equal(r.d.qualifierSlots,4);assert.equal(r.d.byeCount,0);

// Q4* is accepted.
const starred=grid(1,3);starred.push(['Q4*','I',1,'J',1,2]);
r=result(starred);assert.equal(r.p.qualificationTeams.length,4);

// A withdrawn duplicate is ignored.
const withdrawn=[['MUŽI /MEN'],[],['#','Hráč č. 1','Body','Hráč č. 2','Body','Spolu','Pozn.'],[1,'Top',1,'Seed',1,2,''],[2,'Old',1,'Team',1,2,'odhlásenie'],[2,'New',1,'Team',1,2,'']];
r=result(withdrawn);assert.deepEqual(Array.from(r.p.directTeams),['Top / Seed','New / Team']);assert(r.p.warnings.length);

// Official/historical 16-seed placement.
assert.deepEqual(JSON.parse(JSON.stringify(api.BASE_MODEL[1])),{A:'S1',B:'S16'});
assert.deepEqual(JSON.parse(JSON.stringify(api.BASE_MODEL[2])),{A:'S9',B:'S8'});
assert.deepEqual(JSON.parse(JSON.stringify(api.BASE_MODEL[8])),{A:'S15',B:'S2'});

console.log('seed-excel audit: all tests passed');
