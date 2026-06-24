import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export type RunStatus = "idle"|"running"|"capturing"|"thinking"|"acting"|"waiting"|"completed"|"failed"|"stopped";

export type HistoryIndexItem = {
  id:string; instruction:string; title:string; status:RunStatus;
  createdAt:number; updatedAt:number; startedAt?:number; endedAt?:number;
  elapsedMs:number; currentStep:number; maxSteps:number;
  summary?:string; error?:string; pinned?:boolean;
};

export type AgentRunDetail = {
  id:string; instruction:string; title?:string; status:RunStatus;
  createdAt:number; updatedAt:number; startedAt?:number; endedAt?:number; elapsedMs:number;
  currentStep:number; maxSteps:number; currentActionText?:string;
  compactPlan:any[]; steps:any[]; rawLogs:string[];
  summary?:string; error?:string;
};

const VALID_STATUS:RunStatus[]=["idle","running","capturing","thinking","acting","waiting","completed","failed","stopped"];
const n=()=>Date.now();
function safeTitle(i:string){const t=String(i||"").trim();if(!t)return"未命名任务";return t.length>36?t.slice(0,36)+"…":t}
function ensureDir(d:string){fs.mkdirSync(d,{recursive:true})}
function readSafe<T>(f:string,fb:T):T{try{if(!fs.existsSync(f))return fb;const r=fs.readFileSync(f,"utf-8");if(!r.trim())return fb;return JSON.parse(r)as T}catch(e){console.error("[history] read:",e);return fb}}
function writeAtomic(f:string,d:unknown){const dir=path.dirname(f);ensureDir(dir);const t=f+".tmp";fs.writeFileSync(t,JSON.stringify(d,null,2),"utf-8");fs.renameSync(t,f)}

export class HistoryStore{
  private root:string;private runsDir:string;private indexFile:string;
  constructor(){
    this.root=path.join(app.getPath("userData"),"history");
    this.runsDir=path.join(this.root,"runs");
    this.indexFile=path.join(this.root,"index.json");
    ensureDir(this.root);ensureDir(this.runsDir);
    if(!fs.existsSync(this.indexFile))writeAtomic(this.indexFile,[]);
  }
  list():HistoryIndexItem[]{return this.normalizeIndex(readSafe<HistoryIndexItem[]>(this.indexFile,[]))}
  get(id:string):AgentRunDetail|null{
    if(!id)return null;
    const f=this.detailPath(id);
    const raw=readSafe<AgentRunDetail|null>(f,null);
    return raw?this.sanitize(raw):null;
  }
  create(detail:AgentRunDetail):HistoryIndexItem{
    const clean=this.sanitize({...detail,id:detail.id||crypto.randomUUID(),createdAt:detail.createdAt||n(),updatedAt:n()});
    writeAtomic(this.detailPath(clean.id),clean);
    const idx=this.indexFromDetail(clean);
    const list=this.list().filter(i=>i.id!==clean.id);list.unshift(idx);
    this.saveIndex(list);return idx;
  }
  update(id:string,patch:Partial<AgentRunDetail>):HistoryIndexItem|null{
    const old=this.get(id);if(!old)return null;
    const next=this.sanitize({...old,...patch,id,updatedAt:n()});
    writeAtomic(this.detailPath(id),next);
    const idx=this.indexFromDetail(next);
    const list=this.list();const i=list.findIndex(x=>x.id===id);
    if(i>=0)list[i]=idx;else list.unshift(idx);
    this.saveIndex(list);return idx;
  }
  delete(id:string):boolean{
    if(!id)return false;
    this.saveIndex(this.list().filter(i=>i.id!==id));
    try{const f=this.detailPath(id);if(fs.existsSync(f))fs.unlinkSync(f)}catch{}
    return true;
  }
  clear(){this.saveIndex([]);try{if(fs.existsSync(this.runsDir))for(const x of fs.readdirSync(this.runsDir))if(x.endsWith(".json"))fs.unlinkSync(path.join(this.runsDir,x))}catch{}}
  repair():HistoryIndexItem[]{const r:HistoryIndexItem[]=[];for(const i of this.list()){const d=this.get(i.id);if(d)r.push(this.indexFromDetail(d))}this.saveIndex(r);return r}
  private detailPath(id:string){return path.join(this.runsDir,`${id.replace(/[^a-zA-Z0-9_-]/g,"_")}.json`)}
  private saveIndex(l:HistoryIndexItem[]){writeAtomic(this.indexFile,this.normalizeIndex(l))}
  private normalizeIndex(l:HistoryIndexItem[]):HistoryIndexItem[]{
    const s=new Set<string>();
    return(Array.isArray(l)?l:[]).filter(i=>i&&typeof i.id==="string"&&i.id.trim()).map(i=>({id:i.id,instruction:String(i.instruction||""),title:String(i.title||safeTitle(i.instruction)),status:VALID_STATUS.includes(i.status)?i.status:"idle",createdAt:Number(i.createdAt||n()),updatedAt:Number(i.updatedAt||i.createdAt||n()),startedAt:i.startedAt,endedAt:i.endedAt,elapsedMs:Number(i.elapsedMs||0),currentStep:Number(i.currentStep||0),maxSteps:Number(i.maxSteps||50),summary:i.summary,error:i.error,pinned:Boolean(i.pinned)})).filter(i=>{if(s.has(i.id))return false;s.add(i.id);return true}).sort((a,b)=>{if(a.pinned&&!b.pinned)return-1;if(!a.pinned&&b.pinned)return 1;return b.updatedAt-a.updatedAt});
  }
  private sanitize(i:AgentRunDetail):AgentRunDetail{
    const id=String(i.id||crypto.randomUUID());const ins=String(i.instruction||"");
    return{id,instruction:ins,title:String(i.title||safeTitle(ins)),status:VALID_STATUS.includes(i.status)?i.status:"idle",createdAt:Number(i.createdAt||n()),updatedAt:Number(i.updatedAt||n()),startedAt:i.startedAt,endedAt:i.endedAt,elapsedMs:Number(i.elapsedMs||0),currentStep:Number(i.currentStep||0),maxSteps:Number(i.maxSteps||50),currentActionText:i.currentActionText,compactPlan:Array.isArray(i.compactPlan)?i.compactPlan:[],steps:Array.isArray(i.steps)?i.steps:[],rawLogs:Array.isArray(i.rawLogs)?i.rawLogs.map(String):[],summary:i.summary,error:i.error};
  }
  private indexFromDetail(d:AgentRunDetail):HistoryIndexItem{
    return{id:d.id,instruction:d.instruction,title:d.title||safeTitle(d.instruction),status:d.status,createdAt:d.createdAt,updatedAt:d.updatedAt||n(),startedAt:d.startedAt,endedAt:d.endedAt,elapsedMs:d.elapsedMs||0,currentStep:d.currentStep||0,maxSteps:d.maxSteps||50,summary:d.summary,error:d.error};
  }
}
