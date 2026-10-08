// Synthetic CANVAS v18 export; no personal data, files or Microsoft credentials.
export function canvasFixture(rotation=0){
  const p=(x,y)=>({x,y});
  const line=(id,type,start,end,extra={})=>({id,type,start,end,color:'black',playerId:null,ballId:null,...extra});
  const steps=[{
    id:'step-one',label:'STEP 1',note:'侵入してパス。別ボールは同時に動く。',
    players:[{id:'o1',side:'offense',label:'1',...p(330,690)},{id:'o2',side:'offense',label:'2',...p(710,690)},{id:'d1',side:'defense',label:'1',...p(510,440)}],
    balls:[{id:'ball',label:'1',...p(350,660)},{id:'ball-two',label:'2',...p(730,660)}],
    cones:[{id:'cone',color:'blue',...p(200,500)}],texts:[{id:'text',text:'判断する',fontSize:34,...p(525,300)}],
    lines:[
      line('move','move',p(330,690),p(430,550),{points:[p(330,690),p(350,610),p(430,550)],playerId:'o1',playOrder:1}),
      line('pass-one','pass',p(350,660),p(710,600),{ballId:'ball',playOrder:1}),
      line('pass-two','pass',p(730,660),p(540,500),{ballId:'ball-two',playOrder:1}),
      line('dribble','dribbleStraight',p(710,690),p(710,580),{playerId:'o2',ballId:'ball',playOrder:2}),
      line('screen','screenFree',p(510,440),p(620,440),{playerId:'d1',playOrder:3}),
    ],
    unknownFutureField:{keep:'unchanged'}
  },{id:'step-two',label:'STEP 2',note:'同じボールのパスは順番を守る。',players:[{id:'o1',side:'offense',label:'1',...p(430,550)}],ball:{id:'ball',...p(450,520)},lines:[
    line('pass-three','pass',p(450,520),p(525,350),{playOrder:1}),
    line('pass-four','pass',p(525,350),p(640,400),{playOrder:1}),
  ],cones:[],texts:[]},{id:'step-static',label:'STEP 3',note:'最終配置',players:[{id:'o1',side:'offense',label:'1',...p(430,550)}],ball:{id:'ball',...p(640,400)},lines:[],cones:[],texts:[]}];
  if(rotation){for(const step of steps){const rotate=point=>{const {x,y}=point;if(rotation===90){point.x=980-y;point.y=x;}else if(rotation===180){point.x=1050-x;point.y=980-y;}else{point.x=y;point.y=1050-x;}};for(const item of [...step.players,...(step.balls||[step.ball]),...step.cones,...step.texts])rotate(item);for(const line of step.lines){rotate(line.start);rotate(line.end);for(const point of line.points||[])rotate(point);}}}
  return {snapshot:{schemaVersion:18,playName:'人工作戦・判断とパス',courtMode:'half',courtRotation:rotation,movementSpeed:1,playbackSpeed:1,showMovementLines:true,steps,unknownFutureField:{keep:true}}};
}

export const rawFixture=()=>JSON.stringify(canvasFixture());
