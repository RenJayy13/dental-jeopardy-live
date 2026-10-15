'use strict';
const $=id=>document.getElementById(id);
const categories=['Dental Anatomy','Instruments & Materials','Infection Control','Dental Radiography','Clinical Procedures'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ws,host=false,state=null,questions=null,audio=null,soundOn=false,previous=null,lastTimerSecond=null;
fetch('/questions.json').then(r=>r.json()).then(q=>{questions=q;render()}).catch(()=>alert('Questions failed to load'));
function send(type,extra={}){if(ws?.readyState===1)ws.send(JSON.stringify({type,...extra}));else alert('Connection lost; please reload')}
function connect(callback){$('connectionStatus').textContent='Connecting to game server…';ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);ws.onopen=()=>{$('connectionStatus').textContent='Connected. Creating or joining room…';callback()};ws.onerror=()=>{$('connectionStatus').textContent='Connection error. Check that Render is Live and try refreshing.'};ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='error')return alert(m.message);if(m.type==='created')history.replaceState(null,'','?room='+m.code);if(m.type==='state'){soundState(m);state=m;render()}};ws.onclose=()=>{$('connectionStatus').textContent='Disconnected. Reload the page to try again.'}}
function note(freq,offset,duration){if(!audio||!soundOn)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+offset;o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.11,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration+.03)}
function sound(name){const seq={open:[520,740],buzz:[310,245],reveal:[392,494,587,784],correct:[523,659,784],wrong:[370,294,220],daily:[392,523,659,784],final:[294,392,494,587]}[name]||[];seq.forEach((f,i)=>note(f,i*.18,.25))}
function enableSound(){try{const C=window.AudioContext||window.webkitAudioContext;audio=audio||new C();audio.resume();soundOn=true;$('soundToggle').textContent='🔊 Sound On';$('soundToggle').setAttribute('aria-pressed','true');return true}catch{alert('This browser cannot play sound');return false}}
function updateTimer(){const deadline=state?.buzzDeadline,active=host&&!!state?.question&&!!state?.winner&&Number.isFinite(deadline);$('answerTimer').hidden=!active;if(!active){lastTimerSecond=null;return}const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('timerNumber').textContent=seconds||'TIME!';$('timerStatus').textContent=seconds?'seconds remaining':'Time is up!';$('answerTimer').classList.toggle('expired',seconds===0);if(lastTimerSecond!==seconds){if(lastTimerSecond!==null&&seconds>0&&seconds<5)note(660,0,.12);if(seconds===0&&lastTimerSecond!==null)sound('wrong');lastTimerSecond=seconds}}
setInterval(updateTimer,100);
function soundState(m){if(host&&previous){if(m.lastScore&&JSON.stringify(m.lastScore)!==JSON.stringify(previous.lastScore))sound(m.lastScore.points>=0?'correct':'wrong');else if(m.winner&&!previous.winner)sound('buzz');else if(m.question?.daily&&m.question.key!==previous.question?.key)sound('daily');else if(m.round==='final'&&previous.round!=='final')sound('final');else if(m.buzzOpen&&!previous.buzzOpen)sound('open')}previous=m}
$('soundToggle').onclick=()=>{if(soundOn){soundOn=false;$('soundToggle').textContent='🔇 Enable Sound';$('soundToggle').setAttribute('aria-pressed','false')}else if(enableSound())sound('correct')};
$('testSound').onclick=()=>{if(soundOn||enableSound())sound('reveal')};
$('create').onclick=()=>{host=true;connect(()=>send('create'))};
$('join').onclick=()=>{const code=$('code').value.trim(),name=$('name').value.trim();if(!/^\d{6}$/.test(code)||!name)return alert('Enter your name and a six-digit room code');host=false;connect(()=>send('join',{code,name}))};
$('code').value=new URLSearchParams(location.search).get('room')||'';
$('level').onchange=()=>{if(confirm('Change difficulty and reset scores?'))send('level',{level:$('level').value});else $('level').value=state.level};
$('round').onchange=()=>{if(confirm('Start this round? Scores will be preserved.'))send('round',{round:$('round').value});else $('round').value=state.round};
$('copy').onclick=()=>{const url=location.origin+'/?room='+state.code;navigator.clipboard.writeText(url).then(()=>alert('Student link copied')).catch(()=>prompt('Copy link',url))};
$('open').onclick=()=>send('openBuzzers');$('lock').onclick=()=>send('closeBuzzers');
$('buzz').onclick=()=>{send('buzz');$('buzz').disabled=true};
function reveal(text){sound('reveal');$('answerBig').textContent=text;$('answerOverlay').hidden=false;$('answerClose').focus()}
$('reveal').onclick=()=>{if(state?.question){$('answer').hidden=false;reveal(state.answer||'Answer unavailable')}};
$('finalReveal').onclick=()=>{if(state&&questions){$('finalAnswer').hidden=false;reveal(questions.final[state.level][1])}};
$('answerClose').onclick=()=>{$('answerOverlay').hidden=true};
$('next').onclick=()=>{if(!state?.question)return;$('answerOverlay').hidden=true;$('answer').hidden=true;$('clue').hidden=true;send('next')};
function dailyAward(correct){const team=Number($('dailyTeam').value),wager=Number($('dailyWager').value),max=Math.max(state.teams[team].score,state.round==='double'?1000:500);if(!Number.isInteger(wager)||wager<5||wager>max)return alert('Wager must be between $5 and $'+max);$('clue').hidden=true;send('dailyTeam',{team});send('dailyAward',{wager,correct})}
$('dailyCorrect').onclick=()=>dailyAward(true);$('dailyWrong').onclick=()=>dailyAward(false);
function render(){if(!state||!questions)return;updateTimer();
$('setup').hidden=true;$('game').hidden=false;$('room').textContent='Room code: '+state.code;
$('scores').innerHTML=state.teams.map(t=>'<div>'+esc(t.name)+'<br><strong>$'+t.score+'</strong></div>').join('');
$('host').hidden=!host;$('studentHome').hidden=host||!!state.question;
if(state.lastScore){const x=state.lastScore;$('scoreNotice').textContent='✓ '+state.teams[x.team].name+(x.points>=0?' awarded +$'+x.points:' deducted -$'+Math.abs(x.points))+' • New total: $'+x.total;$('scoreNotice').hidden=false}else $('scoreNotice').hidden=true;
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}else $('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch instructor screen':'Waiting for instructor to select a question';
$('clue').hidden=!state.question;if(!state.question){$('answerOverlay').hidden=true;return}
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;$('clueText').textContent=state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+esc(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>{b.disabled=!!state.lastScore;b.onclick=()=>{const team=Number(b.dataset.team),points=Number(b.dataset.points);if(!confirm('Apply '+(points>=0?'+':'')+'$'+points+' to '+state.teams[team].name+'?'))return;$('award').querySelectorAll('button').forEach(x=>x.disabled=true);send('score',{team,points})}});
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'">'+esc(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor selects team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+esc(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+esc(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+esc(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}