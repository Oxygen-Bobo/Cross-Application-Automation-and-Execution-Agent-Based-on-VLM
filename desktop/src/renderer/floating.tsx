/* Floating Orb — polished light theme, distinct phase icons,
   progress ring only, popover fully in window bounds. */

type S = {
  st: string; p: number; step?: number; tot?: number;
  task: string; act: string; msg: string;
};

const META: Record<string, [string, string]> = {
  idle:["⚡","空闲"],capturing:["📸","截图中"],
  thinking:["🧠","思考中"],planning:["📋","规划中"],observing:["👁","观察中"],
  running:["▶","运行中"],acting:["🖱","执行中"],
  waiting:["⏳","等待确认"],
  success:["✓","已完成"],completed:["✓","已完成"],
  error:["✕","异常"],failed:["✕","失败"],stopped:["■","已停止"],
};

// Colors from tokens.css: brand/#2563eb, success/#16a34a, warning/#f59e0b, danger/#ef4444
const ACCENT: Record<string, string> = {
  idle:"#8f99a8",stopped:"#8f99a8",
  capturing:"#0891b2",                    // cyan-600
  thinking:"#7c3aed",planning:"#7c3aed",observing:"#7c3aed", // violet-600
  running:"#2563eb",acting:"#2563eb",     // brand blue
  waiting:"#f59e0b",                      // warning amber
  success:"#16a34a",completed:"#16a34a",  // success green
  error:"#ef4444",failed:"#ef4444",       // danger red
};

function cs(r:string){
  const m:Record<string,string>={capturing:"capturing",thinking:"thinking",planning:"planning",observing:"observing",acting:"acting",waiting:"waiting",running:"running",completed:"success",failed:"error",stopped:"stopped",success:"success",error:"error"};
  return m[r]||r||"idle";
}
function cl(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function fs(st?:number,tot?:number){if(st==null)return"暂无步骤";if(tot)return`步骤 ${st} / ${tot}`;return`第 ${st} 步`}

export default function init() {
  const root = document.getElementById("root")!;
  root.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = `
    html,body,#root{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent!important}
    .fr{position:relative;width:100%;height:100%;background:transparent;-webkit-app-region:drag;user-select:none;-webkit-user-select:none}
    /* ---- Orb ---- */
    .fb{position:absolute;top:12px;left:12px;width:72px;height:72px;border-radius:50%;cursor:pointer;-webkit-app-region:no-drag;background:radial-gradient(circle at 35% 25%,#fff,rgba(245,246,248,.94));box-shadow:0 12px 32px rgba(16,24,40,.10),0 0 0 1px rgba(16,24,40,.06),inset 0 0 0 1px rgba(255,255,255,.6);z-index:10;transition:transform .18s,box-shadow .18s}
    .fb:hover{transform:scale(1.05);box-shadow:0 16px 40px rgba(16,24,40,.14),0 0 0 1px rgba(16,24,40,.08),inset 0 0 0 1px rgba(255,255,255,.6)}
    /* ---- Progress ring ---- */
    .ri{position:absolute;inset:-5px;border-radius:50%;pointer-events:none;z-index:1;filter:drop-shadow(0 0 6px rgba(37,99,235,.15))}
    /* ---- Icon core ---- */
    .co{position:absolute;inset:10px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:4}
    .ic{font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.06))}
    /* ---- Popover (inside window, below orb) ---- */
    .pp{position:absolute;top:96px;left:12px;width:200px;padding:16px 18px;border-radius:16px;color:#1a1d23;background:#fff;box-shadow:0 12px 40px rgba(16,24,40,.10);border:1px solid rgba(16,24,40,.08);opacity:0;visibility:hidden;transform:translateY(4px);transition:opacity .16s,visibility .16s,transform .16s;pointer-events:none;z-index:20;-webkit-app-region:no-drag}
    .fb:hover+.pp{opacity:1;visibility:visible;transform:translateY(0)}
    .pt{font-size:14px;font-weight:600;color:#111827;margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pr{display:flex;align-items:flex-start;font-size:12px;line-height:1.65;padding:1px 0}
    .pr .lb{color:#667085;flex-shrink:0;margin-right:8px;min-width:40px}
    .pr .vl{color:#1a1d23;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pb{margin-top:12px;height:4px;border-radius:99px;background:rgba(16,24,40,.06);overflow:hidden}
    .pf{height:100%;border-radius:inherit;transition:width .5s ease}
  `;
  document.head.appendChild(style);

  root.innerHTML = `
    <div class="fr" id="fr">
      <div class="fb" id="ob">
        <div class="ri" id="ri"></div>
        <div class="co"><span class="ic" id="ic">⚡</span></div>
      </div>
      <div class="pp" id="pp">
        <div class="pt" id="pt">空闲</div>
        <div class="pr"><span class="lb">任务：</span><span class="vl" id="vt">暂无任务</span></div>
        <div class="pr"><span class="lb">当前：</span><span class="vl" id="va">等待下一步</span></div>
        <div class="pr"><span class="lb">进度：</span><span class="vl" id="vs">暂无步骤</span></div>
        <div class="pb"><div class="pf" id="pf" style="width:0%"></div></div>
      </div>
    </div>`;

  const ob=document.getElementById("ob")!,ri=document.getElementById("ri")!;
  const ic=document.getElementById("ic")!;
  const pt=document.getElementById("pt")!,vt=document.getElementById("vt")!;
  const va=document.getElementById("va")!,vs=document.getElementById("vs")!;
  const pf=document.getElementById("pf")!;

  let cur:S={st:"idle",p:0,task:"",act:"",msg:"等待任务"};

  function apply(a:S){
    const m=META[a.st]||META.idle, c=ACCENT[a.st]||"#2563eb", p=cl(a.p);
    ob.className="fb is-"+a.st;
    // Progress ring with gradient ends
    if(p>=100)ri.style.background=`conic-gradient(${c} 0deg 360deg)`;
    else if(p<=0)ri.style.background="none";
    else ri.style.background=`conic-gradient(from -90deg, ${c} ${(p/100)*360}deg, rgba(16,24,40,0.05) ${(p/100)*360}deg)`;
    ri.style.mask="radial-gradient(circle, transparent 56%, #000 62%)";
    ri.style.webkitMask="radial-gradient(circle, transparent 56%, #000 62%)";
    // Icon only (no percentage)
    ic.textContent=m[0];
    // Popover
    pt.textContent=m[1];
    vt.textContent=a.task||"暂无任务";
    va.textContent=a.act||a.msg||"等待下一步";
    vs.textContent=fs(a.step,a.tot);
    pf.style.width=p+"%";
    pf.style.background=`linear-gradient(90deg, ${c}, ${c}88)`;
  }

  function upd(n:any){
    const raw=cs(n.currentPhase||n.state||n.status||cur.st);
    cur={st:raw,
      p:n.progress??n.progressPercent??(n.currentStep!=null&&n.maxSteps!=null?cl(((n.currentStep??1)/(n.maxSteps??50))*100):cur.p),
      step:n.step??n.currentStep??cur.step,
      tot:n.totalSteps??n.maxSteps??cur.tot,
      task:n.currentTask??n.instruction??cur.task,
      act:n.currentAction??n.currentActionText??n.currentPhase??cur.act,
      msg:n.message??cur.msg};
    apply(cur);
  }

  apply(cur);
  (window as any).agentStatus={update:upd};

  document.getElementById("fr")!.addEventListener("click",async()=>{
    try{await(window as any).electronAPI?.floating?.showMainWindow?.()}catch{}
  });

  let cbs:(()=>void)[]=[];
  const api=(window as any).electronAPI;
  if(api?.floating?.onStatusChanged)cbs.push(api.floating.onStatusChanged((d:any)=>upd(d)));
  if(api?.floating?.onStopTask)cbs.push(api.floating.onStopTask(async()=>{try{await api.agent?.stop()}catch{}}));

  window.addEventListener("beforeunload",()=>{
    cbs.forEach(f=>f());
    delete(window as any).agentStatus;
  });
}
