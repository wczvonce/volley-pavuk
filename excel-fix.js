(()=>{
"use strict";

// Standard seed placement in a 16-team double-elimination draw.
const FIRST_ROUND_SEEDS=[1,16,9,8,5,12,13,4,3,14,11,6,7,10,15,2];
const DIRECT_MAIN_DRAW_SLOTS=10; // 8 direct + positions 9-10 (wild cards / next by ranking)

function cleanCellText(value){return String(value??"").replace(/\s+/g," ").trim()}
function seedCode(n){return "S"+n}
function qualifierName(seedNo){return `Kvalifikant ${seedNo-DIRECT_MAIN_DRAW_SLOTS}`}
function meaningfulTeamText(value){
 const s=cleanCellText(value);
 return !!s&&!/^#/.test(s)&&!/^W\s*\d+$/i.test(s)&&!/^L\s*\d+$/i.test(s)&&!/^BYE$/i.test(s)&&!/^voľn[ýy]\s+žreb$/i.test(s)&&!/^S\d+$/i.test(s)
}
function playerNameCandidate(value){
 const s=cleanCellText(value);
 return !!s&&!/^#/.test(s)&&!/^S\d+$/i.test(s)&&!/^Q\d+$/i.test(s)&&!/^[-+]?\d+(?:[.,]\d+)?$/.test(s)&&!(/^(?:body|spolu|hráč(?:ka)?\s*č\.?\s*\d+|dvojica|team|vs\.?)$/i.test(s))&&/[A-Za-zÀ-ž]/.test(s)
}
function formulaRef(cell){
 const refs=[...String(cell?.f||"").matchAll(/!\$?([A-Z]{1,3})\$?(\d+)/gi)];
 if(!refs.length)return null;
 const m=refs[refs.length-1];return (m[1]+m[2]).toUpperCase()
}
function teamNameFromSource(seedWs,addr){
 if(!seedWs||!addr)return null;
 const pos=XLSX.utils.decode_cell(addr),grid=XLSX.utils.sheet_to_json(seedWs,{header:1,raw:false,defval:""}),row=grid[pos.r]||[];
 const names=[];
 for(let i=pos.c-1;i>=Math.max(0,pos.c-8);i--){
  if(playerNameCandidate(row[i]))names.push(cleanCellText(row[i]));
  if(names.length===2)break
 }
 names.reverse();return names.length===2?names.join(" / "):null
}
function initialSlot(ws,row,col,value,seedNo,seedWs){
 const seed=seedCode(seedNo),direct=parseSlotText(value),explicit=teamFromText(value);
 if(direct){
  return{slot:direct,team:explicit}
 }
 // If the main-draw cell itself contains a real team name, trust it. This covers
 // files updated after qualification, where the qualifier's name is typed in directly.
 if(meaningfulTeamText(value))return{slot:seed,team:{seed,name:cleanCellText(value)}};
 // Formula cells in the supplied SVF template point to the complete seeding list.
 // Only positions 1-10 are direct main-draw participants. Rows after that are
 // qualification entrants, not BYEs and not automatic main-draw teams.
 if(seedNo>DIRECT_MAIN_DRAW_SLOTS)return{slot:seed,team:{seed,name:qualifierName(seedNo)}};
 const addr=formulaRef(ws[XLSX.utils.encode_cell({r:row,c:col})]),name=teamNameFromSource(seedWs,addr);
 return{slot:seed,team:{seed,name:name||`Nasadená dvojica ${seedNo}`}}
}

parseExcelDraw=function(ws,seedWs=null){
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
  let A=null,B=null;
  if(num<=8){
   const ai=(num-1)*2,pa=initialSlot(ws,i,aCol,r[aCol],FIRST_ROUND_SEEDS[ai],seedWs),pb=initialSlot(ws,i,bCol,r[bCol],FIRST_ROUND_SEEDS[ai+1],seedWs);
   A=pa.slot;B=pb.slot;if(pa.team)teams.push(pa.team);if(pb.team)teams.push(pb.team)
  }else{
   A=parseSlotText(r[aCol]);B=parseSlotText(r[bCol]);
   const ta=teamFromText(r[aCol]),tb=teamFromText(r[bCol]);if(ta)teams.push(ta);if(tb)teams.push(tb)
  }
  if(A&&B)model[num]={A,B};
  rows.push({num,winnerSide:resCol<0?null:scoreSide(r[resCol])})
 }
 return{rows,model:Object.keys(model).length===30?model:null,teams}
};

handleExcel=async function(file){
 if(!window.XLSX)throw Error("Knižnica XLSX sa nenačítala");
 const wb=XLSX.read(await file.arrayBuffer(),{type:"array"}),drawName=wb.SheetNames.find(n=>/main\s*draw|draw|zápas|rozpis/i.test(n)),seedName=wb.SheetNames.find(n=>/nasaden|seeding/i.test(n));
 if(!drawName)throw Error("Nenašiel som hárok Main Draw");
 const res=parseExcelDraw(wb.Sheets[drawName],seedName?wb.Sheets[seedName]:null);
 if(!res.model)throw Error("Nenačítalo sa všetkých 30 zápasov");
 applyParsed(res);
 const qualifierCount=res.teams.filter(t=>/^Kvalifikant\s+\d+$/i.test(t.name)).length;
 showMsg(`Excel načítaný: 30 zápasov, 10 priamych miest a ${qualifierCount} miest pre kvalifikantov.`,"ok")
};
})();
