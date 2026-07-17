(()=>{
"use strict";
function cleanCellText(value){return String(value??"").replace(/\s+/g," ").trim()}
function playerNameCandidate(value){
 const s=cleanCellText(value);
 return !!s&&!/^#/.test(s)&&!/^S\d+$/i.test(s)&&!/^[-+]?\d+(?:[.,]\d+)?$/.test(s)&&!(/^(?:body|spolu|hráč(?:ka)?\s*č\.?\s*\d+|dvojica|team|vs\.?)$/i.test(s))&&/[A-Za-zÀ-ž]/.test(s)
}
parseSeeding=function(ws){
 const grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""}),teams=[],refSlots={};
 for(let ri=0;ri<grid.length;ri++){
  const row=grid[ri];
  for(let si=row.length-1;si>=0;si--){
   const sm=cleanCellText(row[si]).match(/^S(1[0-6]|[1-9])$/i);if(!sm)continue;
   const seed="S"+sm[1],seedNo=+sm[1];
   let start=Math.max(0,si-8);
   for(let i=si-1;i>=0;i--){if(+row[i]===seedNo&&/^\d+$/.test(cleanCellText(row[i]))){start=i+1;break}}
   let found=null;
   for(let i=si-1;i>=start;i--){const t=teamFromText(row[i]);if(t&&t.seed===seed){found=t;break}}
   if(!found){
    const names=[];
    for(let i=si-1;i>=start;i--){if(playerNameCandidate(row[i]))names.push(cleanCellText(row[i]));if(names.length===2)break}
    names.reverse();if(names.length)found={seed,name:names.join(" / ")}
   }
   const slot=found?seed:BYE;if(found)teams.push(found);
   if(si>0)refSlots[XLSX.utils.encode_cell({r:ri,c:si-1})]=slot;
   for(let i=start;i<si;i++){
    const addr=XLSX.utils.encode_cell({r:ri,c:i}),cell=ws[addr];
    if((cell&&cell.f)||teamFromText(row[i]))refSlots[addr]=slot
   }
   break
  }
 }
 return{teams,refSlots}
};
function slotFromExcelCell(ws,row,col,value,refSlots){
 const direct=parseSlotText(value);if(direct)return direct;
 const addr=XLSX.utils.encode_cell({r:row,c:col}),cell=ws[addr],formula=cell&&cell.f;if(!formula)return null;
 const refs=[...String(formula).matchAll(/!\$?([A-Z]{1,3})\$?(\d+)/gi)];if(!refs.length)return null;
 const m=refs[refs.length-1];return refSlots[(m[1]+m[2]).toUpperCase()]||null
}
parseExcelDraw=function(ws,refSlots={}){
 const grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""}),rows=[],model={},teams=[];
 let hdr=-1,numCol=0,aCol=5,bCol=7,resCol=8;
 for(let i=0;i<grid.length;i++){
  const r=grid[i].map(x=>String(x).trim());
  if(r.some(x=>/^Tím\s*1$/i.test(x))&&r.some(x=>/^Tím\s*2$/i.test(x))){
   hdr=i;numCol=r.findIndex(x=>/^Č\.?$/i.test(x));aCol=r.findIndex(x=>/^Tím\s*1$/i.test(x));bCol=r.findIndex(x=>/^Tím\s*2$/i.test(x));resCol=r.findIndex(x=>/^Výsledok$/i.test(x));
   if(numCol<0)throw Error("V hárku chýba stĺpec Č. (číslo zápasu)");break
  }
 }
 if(hdr<0)hdr=4;
 for(let i=hdr+1;i<grid.length;i++){
  const r=grid[i],num=+r[numCol];if(!Number.isInteger(num)||num<1||num>30)continue;
  const A=slotFromExcelCell(ws,i,aCol,r[aCol],refSlots),B=slotFromExcelCell(ws,i,bCol,r[bCol],refSlots);
  if(A&&B)model[num]={A,B};
  const ta=teamFromText(r[aCol]),tb=teamFromText(r[bCol]);if(ta)teams.push(ta);if(tb)teams.push(tb);
  rows.push({num,winnerSide:resCol<0?null:scoreSide(r[resCol])})
 }
 return{rows,model:Object.keys(model).length===30?model:null,teams}
};
handleExcel=async function(file){
 if(!window.XLSX)throw Error("Knižnica XLSX sa nenačítala");
 const wb=XLSX.read(await file.arrayBuffer(),{type:"array"}),drawName=wb.SheetNames.find(n=>/main\s*draw|draw|zápas|rozpis/i.test(n)),seedName=wb.SheetNames.find(n=>/nasaden|seeding/i.test(n));
 if(!drawName)throw Error("Nenašiel som hárok Main Draw");
 const seedInfo=seedName?parseSeeding(wb.Sheets[seedName]):{teams:[],refSlots:{}},res=parseExcelDraw(wb.Sheets[drawName],seedInfo.refSlots);
 res.teams.push(...seedInfo.teams);if(!res.model)throw Error("Nenačítalo sa všetkých 30 zápasov");
 applyParsed(res);showMsg(`Excel načítaný: 30 zápasov, ${new Set(res.teams.map(x=>x.seed)).size} dvojíc. BYE a všetky W/L prepojenia sú aktívne.`,"ok")
};
})();
