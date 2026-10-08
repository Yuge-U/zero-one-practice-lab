import {CanvasPlayback} from './canvas-playback.mjs';

let dialog,player,observer,raf=0,last=0,background=null,backgroundKey='',draws=0,opener;
const get=id=>dialog.querySelector('#'+id);
const cancel=()=>{if(raf)cancelAnimationFrame(raf);raf=0;last=0;};
const pause=()=>{player?.pause();cancel();update();};

function build(){
  dialog=document.createElement('dialog');dialog.id='canvasViewer';dialog.className='canvas-viewer';
  dialog.innerHTML=`<div class="cv-heading"><h2 id="cvTitle">作戦を見る</h2><button type="button" id="cvClose" aria-label="作戦ビューアーを閉じる">×</button></div>
    <div class="cv-court"><canvas id="cvCanvas" role="img" aria-label="作戦の選手・ボールの動き"></canvas></div>
    <div class="cv-status"><span id="cvStatus" aria-live="polite"></span><select id="cvStep" aria-label="STEPを選ぶ"></select></div>
    <div class="cv-controls" role="group" aria-label="作戦の再生">
      <button type="button" id="cvReset" aria-label="最初に戻る" title="最初に戻る">↺</button>
      <button type="button" id="cvPrevious" aria-label="前の動作・STEPへ" title="前の動作・STEPへ">⏮</button>
      <button type="button" id="cvPlay" class="primary" aria-label="連続再生" title="連続再生">▶</button>
      <button type="button" id="cvNext" aria-label="次の動作・STEPへ" title="次の動作・STEPへ">⏭</button>
      <select id="cvSpeed" aria-label="再生速度"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
      <button type="button" id="cvLoop" aria-label="繰り返し再生" title="繰り返し再生" aria-pressed="false">⟳</button>
    </div>
    <details class="cv-notes"><summary>STEPメモ・表示設定</summary><p id="cvNote"></p><label><input id="cvLines" type="checkbox" checked>移動線を表示</label><p id="cvMedia" class="subtle"></p><small>← →でコマ送り、スペースで再生・一時停止</small></details>`;
  document.body.append(dialog);
  get('cvClose').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{pause();observer?.disconnect();background=null;backgroundKey='';player=null;get('cvCanvas').width=1;get('cvCanvas').height=1;get('cvNote').textContent='';opener?.focus({preventScroll:true});});
  get('cvPlay').onclick=()=>{player.play();update();start();};
  get('cvNext').onclick=()=>{cancel();player.next();update();draw();start();};
  get('cvPrevious').onclick=()=>{cancel();player.previous();update();draw();};
  get('cvReset').onclick=()=>{cancel();player.reset();update();draw();};
  get('cvStep').onchange=()=>{cancel();player.select(get('cvStep').value);update();draw();};
  get('cvSpeed').onchange=()=>{player.rate=Number(get('cvSpeed').value);};
  get('cvLoop').onclick=()=>{player.loop=!player.loop;get('cvLoop').setAttribute('aria-pressed',String(player.loop));};
  get('cvLines').onchange=()=>{backgroundKey='';draw();};
  dialog.addEventListener('keydown',event=>{
    if(event.target.matches('select,input,summary')||!player)return;
    const id=event.key==='ArrowRight'?'cvNext':event.key==='ArrowLeft'?'cvPrevious':event.code==='Space'?'cvPlay':null;
    if(id){event.preventDefault();get(id).click();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)pause();});
  window.addEventListener('pagehide',()=>{if(dialog.open)pause();});
}

let statusKey='';
function update(){
  if(!player)return;
  const key=[player.stepIndex,player.completed,player.running,player.mode].join(':');if(statusKey===key)return;statusKey=key;
  const count=player.groupCount;
  get('cvStatus').textContent=`STEP ${player.stepIndex+1}/${player.steps.length} · 動作 ${player.completed}/${count}`;
  get('cvStep').value=String(player.stepIndex);
  get('cvPlay').textContent=player.running?'Ⅱ':'▶';get('cvPlay').setAttribute('aria-label',player.running?'一時停止':'連続再生');get('cvPlay').title=player.running?'一時停止':'連続再生';
  get('cvPrevious').disabled=player.stepIndex===0&&player.completed===0&&!player.plan;
  get('cvNext').disabled=player.ended;
  get('cvNote').textContent=String(player.step.note||'メモはありません。');
}

function draw(){
  if(!dialog?.open||!player)return;
  const canvas=get('cvCanvas'),box=canvas.parentElement.getBoundingClientRect();if(box.width<1||box.height<1)return;
  const dpi=Math.min(window.devicePixelRatio||1,1.5,1600/box.width,1200/box.height);
  const width=Math.max(1,Math.round(box.width*dpi)),height=Math.max(1,Math.round(box.height*dpi));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;backgroundKey='';}
  const dimensions=player.compat.dimensions(),scale=Math.min(box.width/dimensions.width,box.height/dimensions.height);
  const x=(box.width-dimensions.width*scale)/2+60*scale,y=(box.height-dimensions.height*scale)/2+60*scale;
  player.compat.setScale(scale);
  const key=[player.stepIndex,width,height,get('cvLines').checked].join(':');
  if(key!==backgroundKey){
    background=document.createElement('canvas');background.width=width;background.height=height;
    const ctx=background.getContext('2d');ctx.fillStyle='#172b2e';ctx.fillRect(0,0,width,height);ctx.setTransform(dpi*scale,0,0,dpi*scale,dpi*x,dpi*y);
    player.compat.background(ctx,player.step,get('cvLines').checked);backgroundKey=key;
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(background,0,0);
  ctx.setTransform(dpi*scale,0,0,dpi*scale,dpi*x,dpi*y);player.compat.markers(ctx,player.step,player.positions);player.compat.foreground(ctx,player.step);
  ctx.setTransform(1,0,0,1,0,0);draws++;
}

function start(){
  if(!player?.running){cancel();return;}if(raf||document.hidden)return;
  const frame=time=>{raf=0;if(!dialog.open||!player?.running||document.hidden){pause();return;}
    if(last)player.advance(Math.min(100,time-last));last=time;draw();update();if(player.running)raf=requestAnimationFrame(frame);else last=0;
  };raf=requestAnimationFrame(frame);
}

export function showCanvas(raw){
  const next=new CanvasPlayback(raw); // A failed import leaves any current viewer and saved plan intact.
  if(!dialog)build();if(dialog.open){pause();observer?.disconnect();}else opener=document.activeElement;
  player=next;statusKey='';backgroundKey='';
  const size=player.compat.dimensions();dialog.style.setProperty('--cv-court-ratio',String(size.height/size.width));
  get('cvTitle').textContent=String(player.compat.snapshot.playName||'作戦を見る');
  get('cvStep').replaceChildren(...player.steps.map((step,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=step.label||'STEP '+(index+1);return option;}));
  get('cvSpeed').value='1';get('cvLoop').setAttribute('aria-pressed','false');get('cvLines').checked=player.compat.snapshot.showMovementLines;
  get('cvMedia').textContent=player.mediaCount?'CANVAS内の画像・動画素材は元のCANVASで確認できます。選手・ボール・動作線を表示しています。':'';
  dialog.showModal();update();observer=new ResizeObserver(()=>draw());observer.observe(get('cvCanvas').parentElement);draw();get('cvPlay').focus();
}

export function viewerState(){return {open:Boolean(dialog?.open),running:Boolean(player?.running),scheduled:Boolean(raf),draws,step:player?.stepIndex,completed:player?.completed,elapsed:player?.elapsed,positions:player?.positions};}
