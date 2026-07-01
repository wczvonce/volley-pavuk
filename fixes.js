(()=>{
"use strict";
function esc(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
matchState=function(id,seen=new Set()){
 if(!M[id]||seen.has(id))return{a:null,b:null,w:null,l:null,auto:false};
 const next=new Set(seen);next.add(id);
 const a=resolveSlot(M[id].A,next),b=resolveSlot(M[id].B,next);
 let w=null,auto=false;
 if(a&&b){
  if(a===BYE&&b===BYE){w=BYE;auto=true}
  else if(a===BYE){w=b;auto=true}
  else if(b===BYE){w=a;auto=true}
  else if(WIN[id]===a||WIN[id]===b)w=WIN[id];
 }
 return{a,b,w,l:w?(a===w?b:a):null,auto};
};
slotButton=function(id,which,st){
 const slot=M[id][which],seed=which==="A"?st.a:st.b,b=document.createElement("button");
 b.className="slot";
 if(!seed){b.classList.add("tbd");b.disabled=true;b.innerHTML=`<span class="seed">—</span><span class="name">${esc(sourceHint(slot))}</span>`;return b}
 b.innerHTML=`<span class="seed">${seed===BYE?"—":esc(seed)}</span><span class="name">${esc(label(seed))}</span><svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>`;
 if(seed===MY_SEED)b.classList.add("target");
 const doubleBye=seed===BYE&&st.a===BYE&&st.b===BYE;
 if(st.w===seed&&!doubleBye)b.classList.add("win");else if(st.w&&!doubleBye)b.classList.add("lose");
 if(seed===BYE||st.auto)b.disabled=true;else b.onclick=()=>setWinner(id,seed);
 return b;
};
function suspicious(v){
 if(!v)return true;
 const parts=v.split("/").map(x=>x.trim());
 return parts.length!==2||parts.some(x=>x.length<2)||/\d/.test(v);
}
function decorateRows(){
 const rows=[...document.querySelectorAll("#seedRows .seed-row")];
 if(!rows.length)return;
 const sum=document.getElementById("seedSummary");
 if(sum)sum.textContent="Skontroluj všetkých 16 riadkov. Každý prázdny riadok musíš potvrdiť tlačidlom BYE.";
 for(const row of rows){
  if(row.dataset.checkedGuard)continue;
  row.dataset.checkedGuard="1";
  row.dataset.ocrWarn=row.classList.contains("warn")?"1":"0";
  const input=row.querySelector(".seed-input"),btn=row.querySelector(".bye-btn");
  if(!input||!btn)continue;
  input.dataset.byeConfirmed="0";
  const check=()=>{
   const value=input.value.trim(),confirmed=input.dataset.byeConfirmed==="1";
   const warn=(!value&&!confirmed)||(value&&(row.dataset.ocrWarn==="1"||suspicious(value)));
   row.classList.toggle("warn",!!warn);
   row.classList.toggle("bye",!value);
   btn.textContent=!value&&confirmed?"BYE potvrdené":"Potvrdiť BYE";
  };
  btn.addEventListener("click",()=>{input.dataset.byeConfirmed="1";check()});
  input.addEventListener("input",()=>{input.dataset.byeConfirmed="0";check()});
  check();
 }
}
const rowsEl=document.getElementById("seedRows");
if(rowsEl)new MutationObserver(decorateRows).observe(rowsEl,{childList:true});
const createBtn=document.getElementById("seedCreate");
if(createBtn)createBtn.addEventListener("click",e=>{
 const rows=[...document.querySelectorAll("#seedRows .seed-row")];
 const unconfirmed=[],bad=[],seen=new Map(),dupes=[];
 rows.forEach((row,i)=>{
  const input=row.querySelector(".seed-input"),v=input?.value.trim()||"";
  if(!v&&input?.dataset.byeConfirmed!=="1")unconfirmed.push("S"+(i+1));
  if(v&&suspicious(v))bad.push("S"+(i+1));
  if(v){const key=v.toLocaleLowerCase("sk").replace(/\s+/g," ");if(seen.has(key))dupes.push("S"+(i+1));else seen.set(key,i)}
 });
 let text="";
 if(unconfirmed.length)text=`Potvrď BYE pri: ${unconfirmed.join(", ")}, alebo doplň chýbajúce mená.`;
 else if(bad.length)text=`Skontroluj formát dvojice pri: ${bad.join(", ")}. Použi tvar Hráč 1 / Hráč 2.`;
 else if(dupes.length)text=`Rovnaká dvojica je uvedená viackrát pri: ${dupes.join(", ")}.`;
 if(text){e.preventDefault();e.stopImmediatePropagation();showMsg(text,"err");const first=document.querySelector("#seedRows .seed-row.warn");first?.scrollIntoView({behavior:"smooth",block:"center"})}
},true);
render();
})();
