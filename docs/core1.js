"use strict";
if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js";

const BYE="BYE";
const TEAMS={S1:"Povrazník / Petro",S2:"Petráš / Neštický",S3:"Michalovič / Patúc",S4:"Pavlinský / Jarošík (CZE)",S5:"Gréč / Žák",S6:"Janto / Žiaček",S7:"Naňo / Regina",S8:"Ondrušek / Matušovský",S9:"Purdeš / Zavacký",S10:"Brilla L. / Velička",S11:"Šebök / Blažo",S12:"Holienka / Kúdelčík",S13:"Nataniel - Hajzuš / Červenák L.",S14:"Sekera / Sekera ml.",S15:"Mazák / Križák",S16:"S16"};
let M={
1:{A:"S1",B:BYE},2:{A:"S9",B:"S8"},3:{A:"S5",B:"S12"},4:{A:"S13",B:"S4"},5:{A:"S3",B:"S14"},6:{A:"S11",B:"S6"},7:{A:"S7",B:"S10"},8:{A:"S15",B:"S2"},
9:{A:{W:1},B:{W:2}},10:{A:{W:3},B:{W:4}},11:{A:{W:5},B:{W:6}},12:{A:{W:7},B:{W:8}},
13:{A:BYE,B:{L:2}},14:{A:{L:3},B:{L:4}},15:{A:{L:5},B:{L:6}},16:{A:{L:7},B:{L:8}},
17:{A:{W:13},B:{L:12}},18:{A:{W:14},B:{L:11}},19:{A:{W:15},B:{L:10}},20:{A:{W:16},B:{L:9}},
21:{A:{W:9},B:{W:10}},22:{A:{W:11},B:{W:12}},23:{A:{W:17},B:{W:18}},24:{A:{W:19},B:{W:20}},
25:{A:{W:24},B:{L:22}},26:{A:{W:23},B:{L:21}},27:{A:{W:21},B:{W:25}},28:{A:{W:22},B:{W:26}},29:{A:{L:27},B:{L:28}},30:{A:{W:27},B:{W:28}}
};
const TRACKS=[
{title:"Hlavný pavúk",cols:[{name:"1. kolo",ids:[1,2,3,4,5,6,7,8]},{name:"2. kolo",ids:[9,10,11,12]},{name:"3. kolo",ids:[21,22]}]},
{title:"Baziny (losers)",cols:[{name:"Prehra 13–16",ids:[16,15,14,13]},{name:"Prehra 9–12",ids:[20,19,18,17]},{name:"Prehra 7–8",ids:[24,23]},{name:"Prehra 5–6",ids:[25,26]}]},
{title:"Záver",cols:[{name:"Semifinále",ids:[27,28]},{name:"O 3. miesto",ids:[29]},{name:"Finále",ids:[30]}]}
];
let WIN={};
// Kontext výsledku: kto proti komu hral, keď sa výsledok zapisoval. Bez neho
// prune() nezneplatní nadväzujúci výsledok pri VÝMENE porazeného účastníka
// (oprava skoršieho zápasu) a appka by tvrdila výsledok neodohraného zápasu.
let WINCTX={};
let MY_SEED=(()=>{try{return localStorage.getItem("pavuk_my_seed")||"S1"}catch{return "S1"}})();
const $=id=>document.getElementById(id), label=s=>s===BYE?"BYE":(TEAMS[s]||s||"—");
function escHtml(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
// Persistencia turnaja: refresh/zabitie tabu počas turnaja nesmie zmazať
// rozohrané výsledky, importovaný rozpis ani mená dvojíc.
function saveState(){try{localStorage.setItem("pavuk_state_v1",JSON.stringify({M,TEAMS,WIN,WINCTX}))}catch{}}
function loadState(){try{const s=JSON.parse(localStorage.getItem("pavuk_state_v1")||"null");if(!s||typeof s!=="object")return;if(s.M&&typeof s.M==="object"&&Object.keys(s.M).length)M=s.M;if(s.TEAMS&&typeof s.TEAMS==="object")Object.assign(TEAMS,s.TEAMS);if(s.WIN&&typeof s.WIN==="object")WIN=s.WIN;if(s.WINCTX&&typeof s.WINCTX==="object")WINCTX=s.WINCTX}catch{}}

function resolveSlot(slot,seen=new Set()){
 if(typeof slot==="string") return slot;
 const ref=slot&&(+slot.W||+slot.L); if(!ref) return null;
 const st=matchState(ref,seen); return slot.W?st.w:st.l;
}
function matchState(id,seen=new Set()){
 if(!M[id]||seen.has(id)) return {a:null,b:null,w:null,l:null,auto:false};
 const next=new Set(seen); next.add(id);
 const a=resolveSlot(M[id].A,next),b=resolveSlot(M[id].B,next);
 let w=null,auto=false;
 if(a&&b){
  if(a===BYE&&b===BYE){w=BYE;auto=true}
  else if(a===BYE){w=b;auto=true}
  else if(b===BYE){w=a;auto=true}
  else if(WIN[id]===a||WIN[id]===b) w=WIN[id];
 }
 return {a,b,w,l:w?(a===w?b:a):null,auto};
}
function prune(){let changed=true;while(changed){changed=false;for(const k of Object.keys(WIN)){const id=+k,st=matchState(id),ctx=WINCTX[id];
 // Zmaž výsledok, keď (1) zápas už nemá oboch účastníkov / je BYE, (2) zapísaný
 // víťaz už nie je účastníkom, alebo (3) sa zmenil KTORÝKOĽVEK účastník oproti
 // stavu pri zápise (výmena porazeného = zápas sa reálne nehral v tejto podobe).
 if(!st.a||!st.b||st.a===BYE||st.b===BYE||(WIN[id]!==st.a&&WIN[id]!==st.b)||(ctx&&(ctx.a!==st.a||ctx.b!==st.b))){delete WIN[id];delete WINCTX[id];changed=true}}}}
function setWinner(id,seed){const st=matchState(id);if(!seed||seed===BYE||st.auto||!(seed===st.a||seed===st.b))return;if(WIN[id]===seed){delete WIN[id];delete WINCTX[id]}else{WIN[id]=seed;WINCTX[id]={a:st.a,b:st.b}}prune();render()}
function targetPath(){const out=[];for(let id=1;id<=30;id++){const st=matchState(id);if(st.a===MY_SEED||st.b===MY_SEED)out.push(id)}return out}
function activeSeeds(){const s=new Set();for(const m of Object.values(M))for(const x of [m.A,m.B])if(typeof x==="string"&&/^S\d+$/.test(x))s.add(x);return [...s].sort((a,b)=>+a.slice(1)-+b.slice(1))}
function sourceHint(slot){if(typeof slot==="string")return slot===BYE?"voľný žreb":label(slot);if(slot.W)return `víťaz Z${slot.W}`;if(slot.L)return `porazený Z${slot.L}`;return "čaká sa"}
function slotButton(id,which,st){const slot=M[id][which],seed=which==="A"?st.a:st.b,b=document.createElement("button");b.className="slot";if(!seed){b.classList.add("tbd");b.disabled=true;b.innerHTML=`<span class="seed">—</span><span class="name">${escHtml(sourceHint(slot))}</span>`;return b}b.innerHTML=`<span class="seed">${seed===BYE?"—":escHtml(seed)}</span><span class="name">${escHtml(label(seed))}</span><svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>`;if(seed===MY_SEED)b.classList.add("target");const doubleBye=seed===BYE&&st.a===BYE&&st.b===BYE;if(st.w===seed&&!doubleBye)b.classList.add("win");else if(st.w&&!doubleBye)b.classList.add("lose");if(seed===BYE||st.auto)b.disabled=true;else b.onclick=()=>setWinner(id,seed);return b}
function matchEl(id,path){const st=matchState(id),d=document.createElement("div");d.className="match"+(path.has(id)?" path":"");d.innerHTML=`<span class="mid">Z${id}</span>${st.auto?'<span class="auto">AUTO</span>':''}`;d.append(slotButton(id,"A",st),slotButton(id,"B",st));return d}
function render(){const path=new Set(targetPath()),v=$("view");v.innerHTML="";for(const tr of TRACKS){const t=document.createElement("section");t.className="track";t.innerHTML=`<div class="track-title">${tr.title}</div>`;const sc=document.createElement("div");sc.className="track-scroll";tr.cols.forEach((col,i)=>{const c=document.createElement("div");c.className="col"+(i?" stagger":"");c.innerHTML=`<div class="col-head">${col.name}</div>`;const stack=document.createElement("div");stack.className="col-stack";col.ids.forEach(id=>stack.append(matchEl(id,path)));c.append(stack);sc.append(c)});t.append(sc);v.append(t)}buildSelect();saveState()}
function buildSelect(){const sel=$("teamSel"),seeds=activeSeeds();if(!seeds.includes(MY_SEED))MY_SEED=seeds[0]||"S1";const old=sel.value;sel.innerHTML="";for(const s of seeds){const o=document.createElement("option");o.value=s;o.textContent=`${s} — ${label(s)}`;o.selected=s===MY_SEED;sel.append(o)}sel.onchange=()=>{MY_SEED=sel.value;try{localStorage.setItem("pavuk_my_seed",MY_SEED)}catch{}updateTitle();render()};updateTitle()}
function updateTitle(){$("myName").textContent=label(MY_SEED);$("mySeed").textContent=`(${MY_SEED})`}
function branchText(){const ids=targetPath(),out=[`Vetva — ${label(MY_SEED)} (${MY_SEED})`,""];for(const id of ids){const st=matchState(id),opp=st.a===MY_SEED?st.b:st.a,tag=st.w?(st.w===MY_SEED?"[výhra]":"[prehra]"):"[hrá]";out.push(`${tag} Z${id}: proti ${opp?label(opp):"zatiaľ neurčenému súperovi"}`)}const losses=ids.filter(id=>{const w=matchState(id).w;return w&&w!==MY_SEED});if(matchState(30).w===MY_SEED)out.push("","→ VÍŤAZ TURNAJA 🏆");else if(losses.length>=2)out.push("","→ VYRADENÝ PO 2. PREHRE");return out.join("\n")}

// Obnov rozohraný turnaj z localStorage (musí bežať pred úvodným renderom v core2.js).
loadState();

