(() => {
  const duration=window.BattleMatch.match.overview.duration, observations=window.BATTLE_R3_HUD.observations.filter(item=>item.battle_remaining_seconds<=duration).sort((a,b)=>b.battle_remaining_seconds-a.battle_remaining_seconds), observationByTime=new Map(observations.map(item=>[item.battle_remaining_seconds,item])), states=window.BATTLE_R3_TOWER_STATES.state_changes, events=window.BATTLE_P4_EVENTS.candidates;
  const video=window.minimapPlayer,videoTime=document.querySelector('#video-time'),timeInput=document.querySelector('#time'),playButton=document.querySelector('#play');
  const format=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`,display=value=>value==null?'—':value,elapsedFromRemaining=remaining=>duration-remaining,remainingFromElapsed=elapsed=>Math.max(0,duration-elapsed),closestObservation=remaining=>observations.reduce((best,item)=>Math.abs(item.battle_remaining_seconds-remaining)<Math.abs(best.battle_remaining_seconds-remaining)?item:best,observations[0]);
  const sourceLabel=evidence=>{if(!evidence?.provenance?.length)return'無可靠讀值';const sources=[...new Set(evidence.provenance.map(item=>item.source_id))].join('＋'),method=['manual_gap_review','manual_anchor'].includes(evidence.status)?'人工核讀':evidence.status.includes('cross_source')?'多視角一致':'單一可靠候選';return`${sources}・${method}`};
  const ns='http://www.w3.org/2000/svg',chart=document.querySelector('#chart'),make=(tag,attrs={},text='')=>{const element=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([name,value])=>element.setAttribute(name,value));if(text)element.textContent=text;chart.append(element);return element},xForRemaining=remaining=>38+elapsedFromRemaining(remaining)/duration*952,yForPercent=value=>6+(100-value)*1.25;
  for(const value of[100,80,60,40]){const y=yForPercent(value);make('line',{x1:38,y1:y,x2:990,y2:y,class:'chart-grid'});make('text',{x:2,y:y+3,class:'chart-text'},`${value}%`)}
  events.forEach(event=>{const x=xForRemaining(event.window.start_seconds),width=xForRemaining(event.window.end_seconds)-x;make('rect',{x,y:3,width,height:81,class:`event-band ${event.status==='selected_for_reconstruction'?'selected':''}`});make('text',{x:x+3,y:13,class:'event-label'},event.event_id.replace('P4-',''))});
  function drawSeries(field,className){let segment=[];const flush=()=>{if(segment.length>1)make('path',{d:segment.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),class:className});segment=[]};observations.forEach(observation=>{const value=observation.payload[field];if(value==null)return flush();segment.push({x:xForRemaining(observation.battle_remaining_seconds),y:yForPercent(value)})});flush()}
  drawSeries('ally_tower_progress_percent','chart-ally');drawSeries('enemy_tower_progress_percent','chart-enemy');const cursor=make('line',{x1:38,y1:3,x2:38,y2:84,class:'chart-cursor'});
  const chips=events.map(event=>{const button=document.createElement('button');button.type='button';button.className=`event-chip ${event.status==='selected_for_reconstruction'?'selected':''}`;button.textContent=`${event.window.start}–${event.window.end} ${event.title}`;button.title=`${event.question} ${event.trigger.caveat}`;button.addEventListener('click',()=>seekToRemaining((event.window.start_seconds+event.window.end_seconds)/2));document.querySelector('#event-chips').append(button);return{event,button}});
  states.forEach((state,index)=>{if(index){const arrow=document.createElement('span');arrow.className='state-arrow';arrow.textContent='→';document.querySelector('#tower-states').append(arrow)}const button=document.createElement('button');button.type='button';button.className='state-chip';button.innerHTML=`<b>${state.ally_remaining_towers}／${state.enemy_remaining_towers}</b><small>${state.battle_countdown}</small>`;button.title=`跳到塔數變化後 ${state.battle_countdown}`;button.addEventListener('click',()=>seekToRemaining(state.battle_remaining_seconds));document.querySelector('#tower-states').append(button)});
  const hudCanvas=document.querySelector('#evidence-hud'),hudContext=hudCanvas.getContext('2d');let imageToken=0;
  function updateEvidence(observation){const evidenceImage=new Image();const token=++imageToken,path=window.BattleMatch.asset(window.BattleMatch.match.overview.evidencePattern.replace('{slug}',observation.battle_countdown.replace(':','m')+'s'));document.querySelector('#evidence-link').href=path;evidenceImage.onload=()=>{if(token!==imageToken)return;hudContext.clearRect(0,0,800,120);hudContext.drawImage(evidenceImage,...window.BattleMatch.match.overview.hudCrop,0,0,800,120);hudCanvas.dataset.loaded=observation.battle_countdown};evidenceImage.src=path}
  function currentTowerState(remaining){return states.reduce((current,state)=>state.battle_remaining_seconds>=remaining?state:current,states[0])}
  function renderAtElapsed(elapsed,updateVideo=false){const safeElapsed=Math.max(0,Math.min(duration,Number(elapsed)||0)),remaining=remainingFromElapsed(safeElapsed),observation=closestObservation(remaining),payload=observation.payload;if(updateVideo&&Math.abs(video.currentTime-safeElapsed)>.35)video.currentTime=safeElapsed;videoTime.value=String(safeElapsed);timeInput.value=String(Math.round(safeElapsed));document.querySelector('#clock').textContent=format(remaining);document.querySelector('#range-current').textContent=format(remaining);document.querySelector('#elapsed').textContent=`+${format(safeElapsed)}`;document.querySelector('#sample-label').textContent=`HUD 取樣 ${observation.battle_countdown}`;document.querySelector('#observation-time').textContent=observation.battle_countdown;
    for(const[id,field]of[['ally-progress','ally_tower_progress_percent'],['enemy-progress','enemy_tower_progress_percent']]){const value=payload[field];document.querySelector(`#${id}`).textContent=`${display(value)}${value==null?'':'%'}`};document.querySelector('#ally-towers').textContent=`${display(payload.ally_remaining_towers)} 塔`;document.querySelector('#enemy-towers').textContent=`${display(payload.enemy_remaining_towers)} 塔`;document.querySelector('#ally-upper').textContent=`上排原值 ${display(payload.ally_upper_percent_raw)}${payload.ally_upper_percent_raw==null?'':'%'}`;document.querySelector('#enemy-upper').textContent=`上排原值 ${display(payload.enemy_upper_percent_raw)}${payload.enemy_upper_percent_raw==null?'':'%'}`;
    const coreFields=['ally_remaining_towers','ally_tower_progress_percent','enemy_remaining_towers','enemy_tower_progress_percent'],present=coreFields.filter(field=>payload[field]!=null).length;document.querySelector('#field-coverage').textContent=`核心欄位 ${present}／4`;const sourceList=document.querySelector('#source-list');sourceList.replaceChildren();for(const[label,field]of[['我方塔數','ally_remaining_towers'],['我方全場塔況','ally_tower_progress_percent'],['敵方塔數','enemy_remaining_towers'],['敵方全場塔況','enemy_tower_progress_percent']]){const li=document.createElement('li');li.innerHTML=`<b>${label}</b><span>${sourceLabel(observation.field_evidence[field])}</span>`;sourceList.append(li)}
    const state=currentTowerState(remaining),stateText=`${state.ally_remaining_towers}／${state.enemy_remaining_towers}`;document.querySelector('#state-now').textContent=stateText;document.querySelector('#tower-state-current').textContent=`目前 ${stateText}`;document.querySelectorAll('.state-chip').forEach((button,index)=>button.classList.toggle('active',states[index]===state));const activeEvent=events.find(event=>remaining<=event.window.start_seconds&&remaining>=event.window.end_seconds);chips.forEach(item=>item.button.classList.toggle('active',item.event===activeEvent));document.querySelector('#evidence-note').textContent=activeEvent?`${observation.battle_countdown} 落在 ${activeEvent.event_id} 事件窗；塔數變化只用來定位結果，交戰地點與調度仍需進入局部多視角覆盤。`:`${observation.battle_countdown} 的四個核心 HUD 欄位皆有來源；連續兵力移動直接看左側原始小地圖。`;const cursorX=xForRemaining(remaining);cursor.setAttribute('x1',cursorX);cursor.setAttribute('x2',cursorX);if(hudCanvas.dataset.loaded!==observation.battle_countdown)updateEvidence(observation);window.syncOverviewAnnotationReference?.()}
  function seekToRemaining(remaining){video.pause();renderAtElapsed(elapsedFromRemaining(remaining),true)}
	  playButton.addEventListener('click',async()=>{if(video.paused){try{await video.play()}catch(error){document.querySelector('#video-status').textContent=`無法播放：${error.message}`}}else video.pause()});video.addEventListener('play',()=>{playButton.textContent='❚❚ 暫停'});video.addEventListener('pause',()=>{playButton.textContent='▶ 播放'});video.addEventListener('timeupdate',()=>renderAtElapsed(video.currentTime));video.addEventListener('ended',()=>renderAtElapsed(duration));videoTime.addEventListener('input',()=>{video.pause();renderAtElapsed(videoTime.value,true)});timeInput.addEventListener('input',()=>{video.pause();renderAtElapsed(timeInput.value,true)});document.querySelectorAll('[data-speed]').forEach(button=>button.addEventListener('click',()=>{video.playbackRate=Number(button.dataset.speed);document.querySelectorAll('[data-speed]').forEach(item=>item.classList.toggle('active',item===button))}));document.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key)||event.target.matches('input'))return;event.preventDefault();renderAtElapsed(video.currentTime+(event.key==='ArrowRight'?1:-1),true)});renderAtElapsed(0);
  window.overviewTimeline={duration,format,seekToRemaining,currentRemaining:()=>remainingFromElapsed(Number(videoTime.value)||0)}
})();

(() => {
  const video = window.minimapPlayer;
  const status = document.querySelector('#video-status');
  const chart = document.querySelector('#chart');
  const timeline = document.querySelector('#time');


  chart.addEventListener('click', event => {
    const rect = chart.getBoundingClientRect();
    const viewX = (event.clientX - rect.left) / rect.width * 1000;
    const elapsed = Math.max(0, Math.min(video.duration, (viewX - 38) / 952 * video.duration));
    timeline.value = String(Math.round(elapsed));
    timeline.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.querySelectorAll('.event-chip').forEach(button => { button.textContent = `查看 ${button.textContent}`; });
})();

(() => {
  // 透明標註層只保存人工棋子／標記／路線；錄影播放不會改動其座標。
  const CHANNEL = 'justiceol-tactical';
  const frame = document.querySelector('#tactical-frame');
  const frameURL = new URL(frame.dataset.src, location.href); frameURL.searchParams.set('match', window.BattleMatch.match.id); frame.src = frameURL;
  const video = window.minimapPlayer;
  const canvas = document.querySelector('#video-canvas');
	  const hideToggle = document.querySelector('#hide-annotations');
  const timeline = () => window.overviewTimeline;
  const allowedOrigins = new Set([location.origin]);
  if (location.protocol === 'file:') allowedOrigins.add('null');
  const targetOrigin = location.protocol === 'file:' ? '*' : location.origin;
  const matchLabel = () => document.querySelector('.topbar .title').textContent.trim().slice(0, 48);
  function currentReference() {
    const api = timeline();
    if (!api) return null;
    const remaining = Math.round(api.currentRemaining());
    return { matchId: window.BattleMatch.match.id, matchLabel: matchLabel(), countdown: api.format(remaining), remainingSeconds: remaining };
  }
  function postToFrame(message) {
    const target = frame.contentWindow;
    if (!target) return false;
    target.postMessage({ channel: CHANNEL, from: 'overview', ...message }, targetOrigin);
    return true;
  }
  function pushReference() {
    const reference = currentReference();
    if (!reference) return false;
    return postToFrame({ type: 'reference', reference });
  }
  window.syncOverviewAnnotationReference = pushReference;
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    if (!allowedOrigins.has(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.channel !== CHANNEL || data.from !== 'editor') return;
	    if (data.type === 'ready') { pushReference(); postToFrame({ type: 'annotations-visibility', hidden: hideToggle.checked }); return; }
    if (data.type === 'editing-started') { video.pause(); return; }
    if (data.type !== 'reference-restored') return;
    const api = timeline();
    if (data.reference?.matchId && data.reference.matchId !== window.BattleMatch.match.id) return;
    const seconds = Number(data.reference?.remainingSeconds);
    if (!api || !Number.isFinite(seconds) || seconds < 0 || seconds > api.duration) return;
    api.seekToRemaining(Math.round(seconds));
    document.querySelector('#video-status').textContent = `已依開啟的標註檔回到 ${api.format(Math.round(seconds))}`;
  });
	  hideToggle.addEventListener('change', () => {
	    const hidden = hideToggle.checked;
	    canvas.classList.toggle('annotations-hidden', hidden);
	    postToFrame({ type: 'annotations-visibility', hidden });
	  });
})();
