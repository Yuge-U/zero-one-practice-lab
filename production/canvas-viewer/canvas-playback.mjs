import {createCanvasCompat} from './canvas-compat.mjs';

const ownId=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!['__proto__','constructor','prototype'].includes(value);
const point=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Math.abs(value.x)<=20000&&Math.abs(value.y)<=20000;
const fail=()=>{throw new Error('このCANVASの表示データを読み取れません。CANVASで確認してください。');};

// Validate a separate display copy; the saved raw JSON and future fields are never rewritten.
export function viewerSnapshot(raw){
  if(typeof raw!=='string'||raw.length>2*1024*1024)fail();
  let data;try{data=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{fail();}
  const snapshot=data?.snapshot??data;
  if(snapshot?.zeroOneNoDiagram||data?.zeroOneNoDiagram)throw new Error('このメニューにはCANVASデータがありません。');
  if(!snapshot||!Array.isArray(snapshot.steps)||!snapshot.steps.length||snapshot.steps.length>500)fail();
  if(Number(snapshot.schemaVersion)>18)throw new Error('新しい形式のCANVASデータです。CANVASで確認してください。');
  let count=0,points=0,media=0;const stepIds=new Set();
  for(const [index,step] of snapshot.steps.entries()){
    if(!step||typeof step!=='object')fail();
    step.id=step.id||'viewer-step-'+index;
    if(!ownId(step.id)||stepIds.has(step.id))fail();stepIds.add(step.id);
    for(const key of ['players','lines','cones','texts','media']){if(step[key]===undefined||(key!=='players'&&step[key]===null))step[key]=[];if(!Array.isArray(step[key]))fail();count+=step[key].length;}
    if(step.lines.length>1000||count>15000)fail();
    const ids=new Set();for(const player of step.players){if(!point(player)||!ownId(player.id)||ids.has(player.id))fail();ids.add(player.id);player.side=player.side==='defense'?'defense':'offense';player.label=String(player.label??'').slice(0,20);}
    const balls=Array.isArray(step.balls)&&step.balls.length?step.balls:step.ball?[step.ball]:[];
    const ballIds=new Set();for(const ball of balls){if(!point(ball))fail();if(ball.id!==undefined&&(!ownId(ball.id)||ballIds.has(ball.id)))fail();if(ball.id)ballIds.add(ball.id);}
    for(const line of step.lines){
      if(!line||typeof line.type!=='string'||!point(line.start)||!point(line.end))fail();
      if(line.playerId!=null&&line.playerId!==''&&!ownId(line.playerId))fail();
      if(line.points!=null){if(!Array.isArray(line.points)||line.points.some(p=>!point(p)))fail();points+=line.points.length;}
      if(points>60000)fail();
    }
    for(const item of [...step.cones,...step.texts])if(!point(item))fail();
    for(const text of step.texts){text.text=String(text.text??'').slice(0,4000);text.fontSize=Math.max(8,Math.min(200,Number(text.fontSize)||34));}
    media+=step.media.length;step.media=[]; // CANVAS media is separate from its movement data; never request remote assets here.
  }
  return {snapshot,media};
}

export function hasCanvas(raw){try{const data=JSON.parse(raw.replace(/^\uFEFF/,''));return !(data.zeroOneNoDiagram||(data.snapshot??data).zeroOneNoDiagram);}catch{return Boolean(raw);}}

const clone=value=>structuredClone(value);
function pathSampler(points){
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const total=lengths.at(-1);
  return progress=>{if(total===0)return {...points.at(-1)};const target=total*progress;let lo=1,hi=points.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(lengths[mid]<target)lo=mid+1;else hi=mid;}const a=points[lo-1],b=points[lo],span=lengths[lo]-lengths[lo-1],ratio=span?(target-lengths[lo-1])/span:0;return {x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio};};
}

// One active group is compiled once. Each display frame only samples its paths.
export function compileGroup(compat,step,completed){
  const initial=compat.after(step,completed),groups=compat.groups(step),group=groups[completed];
  if(!group)return null;
  const tracks=[],players=clone(initial.players),balls=clone(initial.balls),offsets=new Map();let duration=0;
  const add=(line,start,offset,ballId=null)=>{
    const path=compat.path(start,line),length=compat.duration(line,path),sample=pathSampler(path);
    const ballStart=ballId?{...balls[ballId]}:null;
    tracks.push({line,offset,duration:length,sample,ballId,ballStart});duration=Math.max(duration,offset+length);
    const end=path.at(-1);
    if(line.type==='pass')balls[ballId]={...end};else{players[line.playerId]={...end};if(ballId)balls[ballId]=compat.beside(end);}
    return length;
  };
  for(const {line} of group.items)if(compat.isMove(line.type)&&!compat.isDribble(line.type)&&players[line.playerId])add(line,players[line.playerId],0);
  for(const {line} of group.items){
    if(line.type!=='pass'&&!compat.isDribble(line.type))continue;
    const ballId=compat.ballId(step,line),offset=offsets.get(ballId)||0;
    const start=line.type==='pass'?balls[ballId]:players[line.playerId];if(!start)continue;
    offsets.set(ballId,offset+add(line,start,offset,ballId)+100/compat.snapshot.playbackSpeed);
  }
  return {duration:Math.max(1,duration),at(time){
    if(time>=duration)return compat.after(step,completed+1);
    const result={players:clone(initial.players),balls:clone(initial.balls)};
    for(const track of tracks){if(time<track.offset)continue;const ratio=compat.ease(Math.min(1,(time-track.offset)/track.duration)),p=track.sample(ratio),line=track.line;
      if(line.type==='pass')result.balls[track.ballId]=p;
      else{result.players[line.playerId]=p;if(track.ballId){const end=compat.beside(p),start=track.ballStart;result.balls[track.ballId]={x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio};}}
    }
    return result;
  }};
}

export class CanvasPlayback{
  constructor(raw){const parsed=viewerSnapshot(raw);this.compat=createCanvasCompat(parsed.snapshot);this.mediaCount=parsed.media;this.steps=this.compat.snapshot.steps;this.stepIndex=0;this.completed=0;this.elapsed=0;this.plan=null;this.running=false;this.mode='continuous';this.rate=1;this.loop=false;this.gap=0;}
  get step(){return this.steps[this.stepIndex];}
  get groupCount(){return this.compat.groups(this.step).length;}
  get ended(){return this.stepIndex===this.steps.length-1&&this.completed===this.groupCount&&!this.plan;}
  get positions(){return this.plan?this.plan.at(this.elapsed):this.compat.after(this.step,this.completed);}
  pause(){this.running=false;}
  reset(){this.pause();this.stepIndex=0;this.completed=0;this.elapsed=0;this.plan=null;this.gap=0;}
  select(index){this.pause();this.stepIndex=Math.max(0,Math.min(this.steps.length-1,Number(index)||0));this.completed=0;this.elapsed=0;this.plan=null;this.gap=0;}
  previous(){this.pause();this.gap=0;if(this.plan){this.plan=null;this.elapsed=0;return;}if(this.completed>0)this.completed--;else if(this.stepIndex>0){this.stepIndex--;this.completed=this.groupCount;}}
  prepare(){if(!this.plan&&this.completed<this.groupCount){this.plan=compileGroup(this.compat,this.step,this.completed);this.elapsed=0;}}
  next(){this.pause();this.gap=0;if(this.plan){this.completed++;this.plan=null;this.elapsed=0;return;}if(this.completed<this.groupCount){this.prepare();this.mode='single';this.running=true;}else if(this.stepIndex<this.steps.length-1)this.select(this.stepIndex+1);}
  play(){if(this.running){this.pause();return;}if(this.ended)this.reset();this.mode='continuous';this.running=true;this.prepare();}
  advance(delta){
    if(!this.running)return;
    let remaining=Math.max(0,delta)*this.rate;
    for(let iteration=0;iteration<2000&&this.running;iteration++){
      if(this.gap>0){const used=Math.min(this.gap,remaining);this.gap-=used;remaining-=used;if(this.gap>0||remaining===0)return;}
      this.prepare();
      if(this.plan){const used=Math.min(this.plan.duration-this.elapsed,remaining);this.elapsed+=used;remaining-=used;
        if(this.elapsed<this.plan.duration)return;
        this.completed++;this.plan=null;this.elapsed=0;if(this.mode==='single'){this.pause();return;}this.gap=120/this.compat.snapshot.playbackSpeed;
      }else if(this.stepIndex<this.steps.length-1){this.stepIndex++;this.completed=0;this.gap=320/this.compat.snapshot.playbackSpeed;}
      else if(this.loop){this.reset();this.running=true;this.mode='continuous';this.gap=500;}else{this.pause();return;}
      if(remaining===0)return;
    }
  }
}
