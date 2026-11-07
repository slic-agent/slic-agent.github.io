'use strict';
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const flow = [
 ['THE INPUT','The input is a structured circuit graph represented as text, together with design targets, device parameters, and measured simulation results.'],
 ['THE ACTION','The policy reasons about the design and chooses a set of relative parameter updates. It decides how many updates to include; all are applied together before one simulator call. Matched devices share parameters.'],
 ['THE ENVIRONMENT','The simulator applies the edits and evaluates circuit behavior. Measurements and device operating points reveal both performance trade-offs and invalid operating conditions.'],
 ['THE FEEDBACK','The next prompt contains measured simulation results and retained history. SLIC can revise unsuccessful parameter updates and continue toward a design that satisfies every target.']
];
$$('[data-flow]').forEach(b=>b.addEventListener('click',()=>{
 $$('[data-flow]').forEach(x=>{const active=x===b;x.classList.toggle('selected',active);x.setAttribute('aria-pressed',String(active));});
 const [label,detail]=flow[Number(b.dataset.flow)];$('#flow-label').textContent=label;$('#flow-detail').textContent=detail;
}));
const results = {
 id:{'4':[[1.7,.2],[13.5,.6],[74.9,0],[72.5,.7]],'8':[[2.3,.5],[26.5,.7],[87.1,.7],[84.3,1.0]]},
 ood:{'4':[[3.6,.5],[11,.2],[56.8,1.3],[56.9,3.1]],'8':[[4.4,.9],[19.9,1.3],[70.6,1.2],[72.6,2.0]]}
};
const names=['Qwen3.5-4B base','SFT','SLIC–Random','SLIC–Softmax'];
function renderResults(){
 for(const split of ['id','ood']){
  const values=results[split][$('#budget').value];
  $('#result-bars-'+split).replaceChildren(...values.map(([value,sd],i)=>{
   const row=document.createElement('div');row.className='result-row';
   row.innerHTML=`<span class="bar-label">${names[i]}</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="--value:${value}%;--bar-color:${['#b9bec7','#7b879b','#a31f34','#405c83'][i]}"></div></div><span class="bar-value">${value.toFixed(1)} <small>± ${sd.toFixed(1)}</small></span>`;
   return row;
  }));
 }
}
$('#budget').addEventListener('change',renderResults);renderResults();

const cases=[{
 name:'Fully differential folded-cascode amplifier',image:'assets/folded-cascode.svg',
 caption:'Bias-generation circuitry (left) and folded-cascode amplifier core (right). Device identifiers match the recorded actions. Source: manuscript Figure 11 (redrawn).',
 targets:[61.7,425.7,43.1,[30,90]],unit:'kHz',
 states:[
 {v:[25,14349,111,-36],valid:true,title:'Initial operating point',story:'Only bandwidth meets its target. Gain is 36.7 dB below the goal, power is about 34 times the budget, and phase margin is outside the required window.',action:'The model sees the topology, device operating points, and all four numerical targets.'},
 {v:[-21.9,23,null,null],valid:false,title:'Turn 1: invalid amplification',story:'Twenty-two simultaneous updates reduce power, but the measured gain becomes non-positive. The environment returns a design_error for the next turn.',action:'Reference current −95%; input-pair width −70%; input-pair length +200%, alongside load, cascode, and bias updates.'},
 {v:[75.6,98,15,42],valid:true,title:'Turn 2: recovery of valid operation',story:'The design is valid again. Gain, power, and phase margin meet their targets, while the 15 kHz bandwidth remains below 43.1 kHz.',action:'Input-pair width and length +100%; tail width +300%; PMOS-load length +400%, with further bias and cascode changes.'},
 {v:[75.9,169,37,52],valid:true,title:'Turn 3: bandwidth refinement',story:'Bandwidth rises from 15 to 37 kHz following the combined parameter updates. The other three targets remain met.',action:'Input-pair length −70%; PMOS-load length −60%; NMOS current-source length −80%, with width and bias changes.'},
 {v:[68.4,318,172,56.4],valid:true,title:'Turn 4: all specifications satisfied',story:'The final circuit exceeds the gain and bandwidth targets while meeting the power budget and phase-margin window. No evaluation tolerance is needed.',action:'Further reductions in device lengths, moderate width updates, and a 15% increase in reference current complete the rollout.'}
 ]
},{
 name:'Fully differential current-mirror amplifier',image:'assets/current-mirror.svg',
 caption:'Amplifier core X0 and shared bias generator X1. This circuit topology was held out from training. Source: manuscript Figure 12 (redrawn).',
 targets:[26.4,170.1,1.25,[30,90]],unit:'MHz',
 states:[
 {v:[-123.2,52,null,null],valid:false,title:'Initial state on a held-out topology',story:'Gain is −123.2 dB and in-band peaking is 61.2 dB. The input pair and PMOS output mirror operate in triode. Bandwidth is not measurable.',action:'The recorded low power is not evidence of success: the circuit fails the domain-validity gates.'},
 {v:[-118.4,25,null,null],valid:false,title:'Turn 1: validity remains unresolved',story:'Gain remains non-positive and in-band peaking is still 39.5 dB. The simulator returns another design_error.',action:'Input-pair width +500%; PMOS output-mirror width −95%; reference current −50%, plus load, tail, and bias edits.'},
 {v:[40.2,224,6.9,8.5],valid:true,title:'Turn 2: valid operation recovered',story:'The design reaches a valid operating point with sufficient gain and bandwidth. Power is above budget and phase margin is below 30°.',action:'Input-pair width +500% and length +200%; PMOS diode-load width −80% and length +400%, with coordinated output and bias updates.'},
 {v:[36.2,90,4.8,23.6],valid:true,title:'Turn 3: power and phase-margin refinement',story:'Power drops from 224 to 90 μW and phase margin rises to 23.6°. Only the phase-margin specification remains unmet.',action:'Reference current −65%; PMOS output-mirror width −60%; NMOS output-sink width −50%, alongside length and bias changes.'},
 {v:[28.4,78.8,10.2,46.8],valid:true,title:'Turn 4: all specifications satisfied',story:'Gain retains 2 dB of headroom; phase margin reaches 46.8° and power stays below budget. All four nominal targets are satisfied.',action:'Input-pair width −50% and length −40%; output-device widths and lengths reduced; reference current −30%.'}
 ]
}];
let caseIndex=0,turn=0,playTimer=null,recordedActions=null,recordedError=false;
const metricNames=['Gain','Power','Bandwidth','Phase margin'];
function meets(c,s,i){if(!s.valid||s.v[i]===null)return false;const v=s.v[i],t=c.targets[i];return i===1?v<=t:i===3?v>=t[0]&&v<=t[1]:v>=t;}
function number(v){return Number.isInteger(v)?v.toLocaleString('en-US'):String(v);}
function metricValue(c,v,i){if(v===null)return 'Unavailable';return `${number(v)} ${['dB','μW',c.unit,'°'][i]}`;}
function targetValue(c,i){const t=c.targets[i];return i===3?'30°–90°':`${i===1?'≤':'≥'} ${number(t)} ${['dB','μW',c.unit][i]}`;}
function renderEvidence(){
 if(!turn){$('#action-code').textContent='Choose Turn 1–4 to inspect the model’s parameter updates.';$('#reason-code').textContent='Choose Turn 1–4 to read the recorded excerpt.';return;}
 if(!recordedActions){const msg=recordedError?'The recorded excerpt could not be loaded. Reload the page to try again.':'Loading the recorded excerpt…';$('#action-code').textContent=msg;$('#reason-code').textContent=msg;return;}
 const record=recordedActions[caseIndex][turn-1];$('#action-code').textContent=record.actions.map(a=>`<action>${a}</action>`).join('\n');$('#reason-code').textContent=record.reasoning;
}
function renderCase(){
 const c=cases[caseIndex],s=c.states[turn],passed=s.v.filter((_,i)=>meets(c,s,i)).length;
 $('#case-title').textContent=c.name;$('#case-schematic').src=c.image;$('#case-schematic').alt=`${c.name} transistor-level schematic`;$('#schematic-caption').textContent=c.caption;
 $('#turn-kicker').textContent=turn?`AFTER TURN ${turn}`:'INITIAL STATE';
 $('#state-status').textContent=s.valid?`${passed} / 4 targets met`:'Invalid design';$('#state-status').className=`status ${!s.valid?'invalid':passed===4?'success':'warn'}`;
 $('#turn-title').textContent=s.title;$('#turn-story').textContent=s.story;$('#action-label').textContent=turn?'KEY RECORDED UPDATES':'STARTING POINT';$('#action-summary').textContent=s.action;
 $('#metric-rows').replaceChildren(...s.v.map((v,i)=>{const row=document.createElement('div');row.className=`metric-row ${!s.valid||v===null?'unavailable':meets(c,s,i)?'met':'unmet'}`;row.innerHTML=`<span class="metric-name"><i class="metric-dot" aria-hidden="true"></i>${metricNames[i]}</span><span class="metric-value">${metricValue(c,v,i)}</span><span class="metric-target">${targetValue(c,i)}</span>`;return row;}));
 $('#timeline').value=String(turn);$('#timeline').setAttribute('aria-valuetext',turn?`After turn ${turn}`:'Initial state');
 $$('[data-turn]').forEach(b=>{const active=Number(b.dataset.turn)===turn;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 $$('[data-case]').forEach(b=>{const active=Number(b.dataset.case)===caseIndex;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 $('#next').disabled=turn===4;renderEvidence();
}
function pause(){if(playTimer)clearInterval(playTimer);playTimer=null;$('#play').innerHTML='<span>▶</span> Play';$('#play').setAttribute('aria-label','Play recorded trajectory');}
function setTurn(t){pause();turn=t;renderCase();}
function selectCase(i){pause();caseIndex=i;turn=0;renderCase();}
$$('[data-case]').forEach(b=>b.addEventListener('click',()=>selectCase(Number(b.dataset.case))));
$$('[data-open-case]').forEach(b=>b.addEventListener('click',()=>selectCase(Number(b.dataset.openCase))));
$$('[data-turn]').forEach(b=>b.addEventListener('click',()=>setTurn(Number(b.dataset.turn))));
$('#timeline').addEventListener('input',e=>setTurn(Number(e.target.value)));
$('#next').addEventListener('click',()=>setTurn(Math.min(4,turn+1)));
$('#play').addEventListener('click',()=>{
 if(playTimer){pause();return;}
 if(turn===4){turn=0;renderCase();}
 $('#play').innerHTML='<span>Ⅱ</span> Pause';$('#play').setAttribute('aria-label','Pause recorded trajectory');
 playTimer=setInterval(()=>{turn++;renderCase();if(turn===4)pause();},4500);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();},{threshold:.05});observer.observe($('.explorer'));
$('#enlarge').addEventListener('click',()=>{pause();$('#dialog-image').src=cases[caseIndex].image;$('#dialog-image').alt=cases[caseIndex].name;$('#dialog-title').textContent=cases[caseIndex].name;$('#schematic-dialog').showModal();});
$('#close-dialog').addEventListener('click',()=>$('#schematic-dialog').close());
$('#schematic-dialog').addEventListener('click',e=>{if(e.target===$('#schematic-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
fetch('assets/recorded-actions.json').then(r=>{if(!r.ok)throw Error('Missing recorded actions');return r.json();}).then(data=>{recordedActions=data;renderEvidence();}).catch(()=>{recordedError=true;renderEvidence();});
renderCase();
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
$('#copy-citation').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText($('#citation').textContent);toast('BibTeX copied');$('#copy-citation').textContent='Copied ✓';setTimeout(()=>$('#copy-citation').textContent='Copy BibTeX ⧉',2200);}
 catch{const range=document.createRange();range.selectNodeContents($('#citation'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);toast('Citation selected. Use your browser’s copy command.');}
});
