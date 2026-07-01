(()=>{
"use strict";
function esc(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function wrapTesseract(){
 const t=window.Tesseract;if(!t||t.__pavukWrapped||typeof t.createWorker!=="function")return;
 const original=t.createWorker.bind(t);t.__pavukWrapped=true;
 t.createWorker=async(...args)=>{const w=await original(...args),set=w.setParameters.bind(w);w.setParameters=params=>set({...params,tessedit_pageseg_mode:"6"});return w};
}
const originalHeadAppend=document.head.append.bind(document.head);
document.head.append=function(...nodes){for(const n of nodes)if(n?.tagName==="SCRIPT"&&/tesseract/i.test(n.src||""))n.addEventListener("load",wrapTesseract);return originalHeadAppend(...nodes)};
wrapTesseract();
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
 return parts.length!==2||parts.some(x=>x.length<2);
}
function inlineError(text=""){
 const actions=document.querySelector("#seedReview .seed-actions");
 if(!actions)return;
 let box=document.getElementById("seedInlineError");
 if(!box){box=document.createElement("div");box.id="seedInlineError";box.style.cssText="display:none;margin:10px 0 0;padding:9px 10px;border:1px solid #ff8a65;border-radius:8px;color:#ffb199;background:rgba(255,138,101,.08);font-size:.76rem;line-height:1.35";actions.before(box)}
 box.textContent=text;box.style.display=text?"block":"none";
}
function rows(){return[...document.querySelectorAll("#seedRows .seed-row")]}
function refreshRows(){
 const all=rows();if(!all.length)return;
 const values=all.map(r=>r.querySelector(".seed-input")?.value.trim()||"");
 let lastFilled=-1;values.forEach((v,i)=>{if(v)lastFilled=i});
 all.forEach((row,i)=>{
  const input=row.querySelector(".seed-input"),btn=row.querySelector(".bye-btn");if(!input||!btn)return;
  const value=input.value.trim(),trailing=!value&&i>lastFilled,manual=input.dataset.manualBye==="1";
  if(trailing){input.dataset.byeConfirmed="1";input.dataset.autoBye="1"}
  else{input.dataset.autoBye="0";input.dataset.byeConfirmed=manual?"1":"0"}
  const confirmed=input.dataset.byeConfirmed==="1";
  const warn=(!value&&!confirmed)||(value&&suspicious(value));
  row.classList.toggle("warn",warn);
  row.classList.toggle("bye",!value);
  btn.textContent=value?"Nastaviť BYE":(trailing?"BYE automaticky":confirmed?"BYE potvrdené":"Potvrdiť BYE");
 });
 const summary=document.getElementById("seedSummary");
 if(summary)summary.textContent="Skontroluj rozpoznané dvojice. Prázdne riadky na konci sa automaticky použijú ako BYE.";
}
function decorateRows(){
 for(const row of rows()){
  if(row.dataset.checkedGuard)continue;
  row.dataset.checkedGuard="1";
  const input=row.querySelector(".seed-input"),btn=row.querySelector(".bye-btn");if(!input||!btn)continue;
  input.dataset.manualBye="0";input.dataset.byeConfirmed="0";input.dataset.autoBye="0";
  btn.addEventListener("click",()=>{input.dataset.manualBye="1";input.dataset.byeConfirmed="1";setTimeout(refreshRows,0)});
  input.addEventListener("input",()=>{input.dataset.manualBye="0";input.dataset.byeConfirmed="0";refreshRows()});
 }
 refreshRows();
}
const rowsEl=document.getElementById("seedRows");
if(rowsEl)new MutationObserver(decorateRows).observe(rowsEl,{childList:true});
const createBtn=document.getElementById("seedCreate");
if(createBtn)createBtn.addEventListener("click",e=>{
 refreshRows();
 const all=rows(),unconfirmed=[],bad=[],seen=new Map(),dupes=[];
 all.forEach((row,i)=>{
  const input=row.querySelector(".seed-input"),v=input?.value.trim()||"";
  if(!v&&input?.dataset.byeConfirmed!=="1")unconfirmed.push("S"+(i+1));
  if(v&&suspicious(v))bad.push("S"+(i+1));
  if(v){const key=v.toLocaleLowerCase("sk").replace(/\s+/g," ");if(seen.has(key))dupes.push("S"+(i+1));else seen.set(key,i)}
 });
 let text="";
 if(unconfirmed.length)text=`Doplň chýbajúcu dvojicu alebo potvrď BYE pri: ${unconfirmed.join(", ")}.`;
 else if(bad.length)text=`Skontroluj formát dvojice pri: ${bad.join(", ")}. Použi tvar Hráč 1 / Hráč 2.`;
 else if(dupes.length)text=`Rovnaká dvojica je uvedená viackrát pri: ${dupes.join(", ")}.`;
 inlineError(text);
 if(text){e.preventDefault();e.stopImmediatePropagation();const first=document.querySelector("#seedRows .seed-row.warn");first?.scrollIntoView({behavior:"smooth",block:"center"})}
},true);
render();
})();
