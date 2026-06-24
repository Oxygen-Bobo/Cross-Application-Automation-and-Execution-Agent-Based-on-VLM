import type { AgentRun, AgentStep, AgentUiEvent, PhaseStatus, StepPhase } from "../types/agent";
const n=()=>Date.now();

export function translateActionToChinese(action:string):string{
  const t=action.trim();
  const r:[RegExp,string][]=[
    [/click the wechat icon.*taskbar.*open/i,"点击任务栏微信图标打开软件"],[/(?:click|open).*wechat/i,"打开微信"],
    [/click.*search box/i,"点击搜索框"],[/search.*contact/i,"搜索联系人"],
    [/type.*contact/i,"输入联系人名称"],[/type.*message/i,"输入消息内容"],
    [/click.*send/i,"点击发送按钮"],[/wait.*window.*load/i,"等待窗口加载"],
    [/locate.*target/i,"定位目标元素"],[/analy[sz]e.*screenshot/i,"分析当前截图"],
    [/captur.*screen/i,"获取当前屏幕截图"],[/click/i,"点击目标元素"],
    [/type/i,"输入文本"],[/scroll/i,"滚动"],[/wait/i,"等待响应"],
  ];
  for(const[re,cn]of r)if(re.test(t))return cn;
  return t.replace(/^Action:\s*/i,"").replace(/\.$/,"").trim();
}

export function extractStepTitleFromLog(line:string):string|undefined{
  const t=line.trim();
  const am=t.match(/^Action:\s*(.+)$/i);if(am?.[1])return translateActionToChinese(am[1]);
  const cm=t.match(/I'll\s+click\s+on:\s*(.+)$/i);if(cm?.[1])return`点击${cm[1].trim()}`;
  if(/Capturing screen/i.test(t))return"获取当前屏幕截图";
  if(/Analysing|Analyzing|desktop elements/i.test(t))return"分析当前屏幕";
  return undefined;
}

export function parseAgentStdoutLine(line:string,curStep?:number):AgentUiEvent{
  const raw=line??"";const t=raw.trim();
  const sm=t.match(/^Step:\s*(\d+)/i)||t.match(/^Step\s+(\d+)/i)||t.match(/STEP\s+(\d+)/i)||t.match(/第\s*(\d+)\s*步/);
  if(sm)return{type:"step_started",step:Number(sm[1]),message:`进入 Step ${sm[1]}`,raw};
  const title=extractStepTitleFromLog(t);
  if(/^Action:/i.test(t))return{type:"action_detected",step:curStep,title,actionText:t.replace(/^Action:\s*/i,""),message:title||"识别到下一步动作",raw};
  if(/Capturing screen/i.test(t)||/截图获取|screenshot/i.test(t))return{type:"capture_started",step:curStep,message:"截图获取：正在获取屏幕截图...",raw};
  if(/screenshot saved|capture finished|截图完成/i.test(t))return{type:"capture_finished",step:curStep,message:"截图获取：屏幕截图已完成",raw};
  if(/Analysing|Analyzing|desktop elements|AI分析|model call|VLM|observe_node|build_messages|plan_node/i.test(t))return{type:"ai_started",step:curStep,title,message:"AI分析：正在识别界面元素...",raw};
  if(/Found\s+\d+\s+clickable|analysis complete|AI分析完成|model returned/i.test(t))return{type:"ai_finished",step:curStep,message:"AI分析：界面分析已完成",raw};
  if(/Locating target|execute_action|pyautogui|执行动作|act_node/i.test(t))return{type:"action_started",step:curStep,title,message:title?`决策执行：${title}`:"决策执行：正在执行桌面动作",raw};
  if(/Action completed successfully|动作执行完成|completed successfully/i.test(t))return{type:"action_finished",step:curStep,message:"决策执行：动作执行完成",raw};
  if(/invalid_api_key|AuthenticationError/i.test(t))return{type:"error",step:curStep,message:"API 配置可能无效，请检查 API Key",error:t,raw};
  if(/Connection error/i.test(t))return{type:"error",step:curStep,message:"连接模型服务失败，请检查网络",error:t,raw};
  if(/Traceback|Error|Failed/i.test(t))return{type:"error",step:curStep,message:"当前步骤执行失败",error:t,raw};
  if(/finished|任务完成|run_finished/i.test(t))return{type:"finished",step:curStep,message:"任务已完成",raw};
  return{type:"raw",step:curStep,message:t,raw};
}

function makePhase(key:"capture"|"ai"|"action",title:string,icon:string):StepPhase{return{key,title,icon,status:"pending",message:"等待执行"}}
function createStep(sn:number):AgentStep{return{id:`s-${sn}`,step:sn,title:`Step ${sn}`,status:"running",startedAt:n(),phases:{capture:makePhase("capture","截图获取","📸"),ai:makePhase("ai","AI分析","🧠"),action:makePhase("action","决策执行","🖱️")},rawLogs:[],attempts:[{index:1,startedAt:n(),rawLogs:[]}],collapsed:false}}
function upsertStep(run:AgentRun,sn?:number):AgentStep{const num=sn||run.currentStep||1;let step=run.steps.find(s=>s.step===num);if(!step){step=createStep(num);run.steps.push(step);run.steps.sort((a,b)=>a.step-b.step)}run.currentStep=num;return step}
function pushLog(step:AgentStep,raw:string){step.rawLogs.push(raw);const la=step.attempts[step.attempts.length-1];if(la)la.rawLogs.push(raw)}
function setP(step:AgentStep,ph:"capture"|"ai"|"action",st:PhaseStatus,msg:string){
  const t=n();const p=step.phases[ph];p.status=st;p.message=msg;
  if(ph==="capture"){if(st==="running"&&!step.captureStartedAt)step.captureStartedAt=t;if(st==="success"||st==="error")step.captureEndedAt=t}
  if(ph==="ai"){if(st==="running"&&!step.aiStartedAt)step.aiStartedAt=t;if(st==="success"||st==="error"){step.aiEndedAt=t;if(step.aiStartedAt)step.thinkingDurationMs=step.aiEndedAt-step.aiStartedAt}}
  if(ph==="action"){if(st==="running"&&!step.actionStartedAt)step.actionStartedAt=t;if(st==="success"||st==="error")step.actionEndedAt=t}
}
function finishStep(step:AgentStep){const t=n();step.status="completed";step.endedAt=t;step.durationMs=t-step.startedAt;step.collapsed=step.manualExpanded?false:true;const la=step.attempts[step.attempts.length-1];if(la&&!la.endedAt)la.endedAt=t}
function failStep(step:AgentStep,err?:string){const t=n();step.status="failed";step.endedAt=t;step.durationMs=t-step.startedAt;step.error=err;step.collapsed=false;const la=step.attempts[step.attempts.length-1];if(la){la.endedAt=t;la.error=err}}

export function applyAgentEventToRun(prev:AgentRun,evt:AgentUiEvent):AgentRun{
  const run:AgentRun={...prev,rawLogs:[...prev.rawLogs,evt.raw],
    steps:prev.steps.map(s=>({...s,phases:{capture:{...s.phases.capture},ai:{...s.phases.ai},action:{...s.phases.action}},rawLogs:[...s.rawLogs],attempts:s.attempts.map(a=>({...a,rawLogs:[...a.rawLogs]}))})),
    compactPlan:prev.compactPlan.map(p=>({...p}))};
  const step=upsertStep(run,evt.step);pushLog(step,evt.raw);
  if(evt.title&&evt.title!=="获取当前屏幕截图"&&evt.title!=="分析当前屏幕")step.title=evt.title;
  switch(evt.type){
    case"step_started":step.status="running";run.status="running";run.currentActionText=evt.message;break;
    case"capture_started":run.status="capturing";step.status="capturing";run.currentActionText=evt.message;setP(step,"capture","running",evt.message);break;
    case"capture_finished":run.currentActionText=evt.message;setP(step,"capture","success",evt.message);if(evt.screenshotPath){step.screenshotPath=evt.screenshotPath;step.phases.capture.screenshotPath=evt.screenshotPath}break;
    case"ai_started":run.status="thinking";step.status="thinking";run.currentActionText=evt.message;if(step.phases.capture.status==="pending")setP(step,"capture","success","截图获取：已完成");setP(step,"ai","running",evt.message);break;
    case"ai_finished":run.currentActionText=evt.message;setP(step,"ai","success",evt.message);break;
    case"action_detected":run.currentActionText=evt.message;step.actionSummary=evt.message;if(evt.title)step.title=evt.title;if(step.phases.ai.status==="pending")setP(step,"ai","success","AI分析：已生成动作决策");step.phases.action.message=`决策执行：${evt.message}`;break;
    case"action_started":run.status="acting";step.status="acting";run.currentActionText=evt.message;if(evt.title)step.title=evt.title;if(step.phases.ai.status==="pending")setP(step,"ai","success","AI分析：已完成");setP(step,"action","running",evt.message);step.actionSummary=evt.message;break;
    case"action_finished":run.currentActionText=evt.message;setP(step,"action","success",evt.message);finishStep(step);break;
    case"finished":run.status="completed";run.endedAt=n();run.currentActionText=evt.message;if(step.phases.action.status==="running")setP(step,"action","success","决策执行：动作执行完成");if(step.status!=="completed")finishStep(step);break;
    case"error":run.status="failed";run.currentActionText=evt.message;if(step.phases.capture.status==="running")setP(step,"capture","error",evt.message);else if(step.phases.ai.status==="running")setP(step,"ai","error",evt.message);else setP(step,"action","error",evt.message);failStep(step,evt.error||evt.message);break;
    case"raw":if(evt.message){run.currentActionText=evt.message;step.userMessage=evt.message}break;
  }
  run.elapsedMs=run.startedAt?n()-run.startedAt:0;return run;
}
