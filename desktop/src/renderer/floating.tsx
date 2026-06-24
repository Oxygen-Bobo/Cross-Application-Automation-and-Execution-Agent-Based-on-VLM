/* Floating Orb — light theme, DOM-based.
   Window is 96x96. Popover overflows via overflow:visible.
   Only shows when agent is running (no self-show). */

type S = {
  st: string; p: number; step?: number; tot?: number;
  task: string; act: string; msg: string;
};

const META: Record<string, [string, string]> = {
  idle:["\u26A1","空闲"],capturing:["\u{1F4F8}","截图中"],thinking:["\u2726","思考中"],
  planning:["\u2726","规划中"],observing:["\u2726","观察中"],running:["\u25B6","运行中"],
  acting:["\u{1F5B1}","执行中"],waiting:["\uFF1F","等待确认"],success:["\u2713","已完成"],
  completed:["\u2713","已完成"],error:["\u0021","异常"],failed:["\u0021","失败"],stopped:["\u25A0","已停止"],
};

const ACCENT: Record<string, string> = {
  idle:"#8b98aa",stopped:"#8b98aa",capturing:"#06b6d4",thinking:"#8b5cf6",
  planning:"#8b5cf6",observing:"#8b5cf6",running:"#2563eb",acting:"#2563eb",
  waiting:"#f59e0b",success:"#16a34a",completed:"#16a34a",error:"#dc2626",failed:"#dc2626",
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

  // Inject CSS — light theme, overflow:visible for popover to extend beyond 96px window
  const style = document.createElement("style");
  style.textContent = `
    html,body,#root{margin:0;padding:0;width:100%;height:100%;overflow:visible;background:transparent!important}
    .fr{position:relative;width:100%;height:100%;background:transparent;-webkit-app-region:drag}
    .fb{position:absolute;top:12px;left:12px;width:72px;height:72px;border-radius:50%;cursor:pointer;-webkit-app-region:no-drag;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.9),rgba(245,246,248,.92));box-shadow:0 8px 24px rgba(16,24,40,.12),0 0 0 1px rgba(16,24,40,.06),inset 0 0 0 1px rgba(255,255,255,.5);z-index:10;transition:transform .18s,box-shadow .18s}
    .fb:hover{transform:scale(1.05);box-shadow:0 12px 32px rgba(16,24,40,.18),0 0 0 1px rgba(16,24,40,.08),inset 0 0 0 1px rgba(255,255,255,.5)}
    .ri{position:absolute;inset:-4px;border-radius:50%;pointer-events:none;z-index:1}
    .co{position:absolute;inset:10px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:4}
    .ic{font-size:24px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.08))}
    .pc{position:absolute;bottom:14px;font-size:9px;font-weight:700;color:rgba(16,24,40,.5);line-height:1}
    /* Popover — positioned BELOW the orb, OVERFLOWS the 96px window */
    .pp{position:absolute;top:96px;left:8px;width:204px;padding:14px 16px;border-radius:16px;color:#1a1d23;background:rgba(255,255,255,.96);box-shadow:0 12px 40px rgba(16,24,40,.15);border:1px solid rgba(16,24,40,.08);opacity:0;visibility:hidden;transform:translateY(4px);transition:opacity .15s,visibility .15s,transform .15s;pointer-events:none;z-index:20;-webkit-app-region:no-drag;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
    .fb:hover+.pp{opacity:1;visibility:visible;transform:translateY(0)}
    .pt{font-size:13px;font-weight:600;color:#111827;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pr{display:flex;align-items:flex-start;font-size:12px;line-height:1.6;padding:1px 0}
    .pr .lb{color:#667085;flex-shrink:0;margin-right:6px;min-width:36px}
    .pr .vl{color:#1a1d23;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pb{position:relative;margin-top:10px;height:4px;border-radius:99px;background:rgba(16,24,40,.06);overflow:hidden}
    .pf{position:absolute;left:0;top:0;height:100%;border-radius:inherit;transition:width .5s}
  `;
  document.head.appendChild(style);

  // Build DOM
  root.innerHTML = `
    <div class="fr" id="fr">
      <div class="fb" id="ob">
        <div class="ri" id="ri"></div>
        <div class="co"><span class="ic" id="ic">\u26A1</span><span class="pc" id="pc" style="display:none"></span></div>
      </div>
      <div class="pp" id="pp">
        <div class="pt" id="pt">\u7A7A\u95F2</div>
        <div class="pr"><span class="lb">\u4EFB\u52A1\uFF1A</span><span class="vl" id="vt">\u6682\u65E0\u4EFB\u52A1</span></div>
        <div class="pr"><span class="lb">\u5F53\u524D\uFF1A</span><span class="vl" id="va">\u7B49\u5F85\u4E0B\u4E00\u6B65</span></div>
        <div class="pr"><span class="lb">\u8FDB\u5EA6\uFF1A</span><span class="vl" id="vs">\u6682\u65E0\u6B65\u9AA4</span></div>
        <div class="pb"><div class="pf" id="pf" style="width:0%"></div></div>
      </div>
    </div>`;

  const ob=document.getElementById("ob")!,ri=document.getElementById("ri")!;
  const ic=document.getElementById("ic")!,pc=document.getElementById("pc")!;
  const pt=document.getElementById("pt")!,vt=document.getElementById("vt")!;
  const va=document.getElementById("va")!,vs=document.getElementById("vs")!;
  const pf=document.getElementById("pf")!;

  let cur:S={st:"idle",p:0,task:"",act:"",msg:"等待任务"};

  function apply(a:S){
    const m=META[a.st]||META.idle, c=ACCENT[a.st]||"#2563eb", p=cl(a.p);
    ob.className="fb is-"+a.st;
    // Progress ring
    if(p>=100)ri.style.background=`conic-gradient(${c} 0deg 360deg)`;
    else if(p<=0)ri.style.background="none";
    else ri.style.background=`conic-gradient(${c} ${(p/100)*360}deg, rgba(16,24,40,0.06) 0deg)`;
    ri.style.mask="radial-gradient(circle, transparent 57%, #000 63%)";
    ri.style.webkitMask="radial-gradient(circle, transparent 57%, #000 63%)";
    // Icon + percentage
    ic.textContent=m[0];
    if(p>0&&p<100){pc.style.display="";pc.textContent=p+"%"}else pc.style.display="none";
    // Popover
    pt.textContent=m[1];
    vt.textContent=a.task||"暂无任务";
    va.textContent=a.act||a.msg||"等待下一步";
    vs.textContent=fs(a.step,a.tot);
    pf.style.width=p+"%";
    pf.style.background=`linear-gradient(90deg, ${c}, ${c}88)`;
  }

  function upd(n:any){
    const raw=cs(n.state||n.status||cur.st);
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
