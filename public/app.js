'use strict';
const $=id=>document.getElementById(id);
const categories=['Dental Anatomy','Instruments & Materials','Infection Control','Dental Radiography','Clinical Procedures'];
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ws,host=false,state=null,questions=null,playerId=null,lastNoticeKey='';
let audioContext=null,soundEnabled=false,previousSoundState=null;
function initAudio(){try{const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw Error('Audio not supported');audioContext=audioContext||new AudioContextClass();audioContext.resume();return true}catch(e){alert('Audio is unavailable in this browser.');return false}}
function tone(frequency,start,duration,volume=0.12,wave='sine'){if(!soundEnabled||!audioContext)return;const t=audioContext.currentTime+start,osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=wave;osc.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+0.012);gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+duration+0.025)}
function playSound(name){if(!soundEnabled||!audioContext)return;const patterns={
open:[[520,0,.12],[740,.15,.18]],
buzz:[[310,0,.18],[245,.17,.24]],
reveal:[[392,0,.18],[494,.18,.18],[587,.36,.2],[784,.58,.45]],
correct:[[523,0,.13],[659,.13,.13],[784,.26,.34]],
wrong:[[370,0,.23],[294,.24,.25],[220,.49,.34]],
daily:[[392,0,.16],[523,.17,.16],[659,.34,.16],[784,.51,.5]],
final:[[294,0,.24],[392,.27,.24],[494,.54,.24],[587,.81,.45]]
};for(const [freq,start,dur] of patterns[name]||[])tone(freq,start,dur,.11,name==='buzz'||name==='wrong'?'triangle':'sine')}
$('soundToggle').onclick=()=>{if(!soundEnabled){if(!initAudio())return;soundEnabled=true;$('soundToggle').textContent='🔊 Sound On';$('soundToggle').setAttribute('aria-pressed','true');playSound('correct')}else{soundEnabled=false;$('soundToggle').textContent='🔇 Enable Sound';$('soundToggle').setAttribute('aria-pressed','false')}};
$('testSound').onclick=()=>{if(!soundEnabled){if(!initAudio())return;soundEnabled=true;$('soundToggle').textContent='🔊 Sound On';$('soundToggle').setAttribute('aria-pressed','true')}playSound('reveal')};
function soundForState(next){if(!host){previousSoundState=next;return}if(previousSoundState){const old=previousSoundState;if(next.lastScore&&(!old.lastScore||JSON.stringify(old.lastScore)!==JSON.stringify(next.lastScore)))playSound(next.lastScore.points>=0?'correct':'wrong');else if(next.winner&&(!old.winner||old.winner.name!==next.winner.name))playSound('buzz');else if(next.question&&(!old.question||old.question.key!==next.question.key)&&next.question.daily)playSound('daily');else if(next.round==='final'&&old.round!=='final')playSound('final');else if(next.buzzOpen&&!old.buzzOpen)playSound('open')}previousSoundState=next}

fetch('/questions.json').then(r=>{if(!r.ok)throw Error('Questions unavailable');return r.json()}).then(q=>{questions=q;if(state)render()}).catch(e=>alert(e.message));
function send(type,more={}){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,...more}))}
function connect(onopen){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);ws.onopen=onopen;ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='error')return alert(m.message);if(m.type==='created')history.replaceState(null,'','?room='+m.code);if(m.type==='joined')playerId=m.id;if(m.type==='state'){soundForState(m);state=m;render()}};ws.onclose=()=>alert('Connection lost. Reload to start or join a new room.')}
$('create').onclick=()=>{host=true;connect(()=>send('create'))};
$('join').onclick=()=>{const code=$('code').value.trim(),name=$('name').value.trim();if(!/^\d{6}$/.test(code)||!name)return alert('Enter a 6-digit room code and your name');host=false;connect(()=>send('join',{code,name}))};
$('code').value=new URLSearchParams(location.search).get('room')||'';
$('level').onchange=()=>{if(confirm('Switch difficulty and reset scores?'))send('level',{level:$('level').value});else $('level').value=state.level};
$('round').onchange=()=>{if(confirm('Start this round? Scores will be preserved.'))send('round',{round:$('round').value});else $('round').value=state.round};
$('copy').onclick=()=>{const url=location.origin+'/?room='+state.code;navigator.clipboard.writeText(url).then(()=>alert('Student link copied')).catch(()=>prompt('Copy student link',url))};
$('open').onclick=()=>send('openBuzzers');$('lock').onclick=()=>send('closeBuzzers');
$('buzz').onclick=()=>{send('buzz');$('buzz').disabled=true};
function showAnswer(text){playSound('reveal');$('answerBig').textContent=text;$('answerOverlay').hidden=false;$('answerClose').focus()}
$('answerClose').onclick=()=>{$('answerOverlay').hidden=true};
$('reveal').onclick=()=>{if(!state?.question||!host)return;$('answer').hidden=false;showAnswer(state.answer||'Answer unavailable')};
$('next').onclick=()=>{$('answer').hidden=true;send('next')};
$('finalReveal').onclick=()=>{if(!host||!questions||!state)return;$('finalAnswer').hidden=false;showAnswer(questions.final[state.level][1])};
function dailyAward(correct){const team=Number($('dailyTeam').value),wager=Number($('dailyWager').value),max=Math.max(state.teams[team].score,state.round==='double'?1000:500);if(!Number.isInteger(wager)||wager<5||wager>max)return alert('Enter a wager between $5 and $'+max);send('dailyTeam',{team});send('dailyAward',{wager,correct})}
$('dailyCorrect').onclick=()=>dailyAward(true);$('dailyWrong').onclick=()=>dailyAward(false);
function render(){if(!state||!questions)return;if(!state.question&&state.round!=='final')$('answerOverlay').hidden=true;
$('setup').hidden=true;$('game').hidden=false;$('room').textContent='Room code: '+state.code;
$('scores').innerHTML=state.teams.map(t=>'<div>'+escapeHtml(t.name)+'<br><strong>$'+t.score+'</strong></div>').join('');
$('host').hidden=!host;$('studentHome').hidden=host||!!state.question;if(state.lastScore){const x=state.lastScore;const label=state.teams[x.team].name+' '+(x.points>=0?'awarded +
if(!host){$('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch the instructor screen':'Waiting for instructor to select a question';}
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}
$('clue').hidden=!state.question;if(!state.question)return;
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;
$('clueText').textContent=state.question.daily?'⭐ DAILY DOUBLE! '+state.question.text:state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;
$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+escapeHtml(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>{b.disabled=!!state.lastScore;b.onclick=()=>{if(!confirm('Apply '+(Number(b.dataset.points)>0?'+':'')+'
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
+x.points:'deducted -
if(!host){$('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch the instructor screen':'Waiting for instructor to select a question';}
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}
$('clue').hidden=!state.question;if(!state.question)return;
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;
$('clueText').textContent=state.question.daily?'⭐ DAILY DOUBLE! '+state.question.text:state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;
$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+escapeHtml(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>b.onclick=()=>send('score',{team:Number(b.dataset.team),points:Number(b.dataset.points)}));
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
+Math.abs(x.points))+' • New total: 
if(!host){$('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch the instructor screen':'Waiting for instructor to select a question';}
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}
$('clue').hidden=!state.question;if(!state.question)return;
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;
$('clueText').textContent=state.question.daily?'⭐ DAILY DOUBLE! '+state.question.text:state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;
$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+escapeHtml(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>b.onclick=()=>send('score',{team:Number(b.dataset.team),points:Number(b.dataset.points)}));
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
+x.total;$('scoreNotice').textContent='✓ '+label;$('scoreNotice').hidden=false;}else{$('scoreNotice').hidden=true}
if(!host){$('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch the instructor screen':'Waiting for instructor to select a question';}
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}
$('clue').hidden=!state.question;if(!state.question)return;
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;
$('clueText').textContent=state.question.daily?'⭐ DAILY DOUBLE! '+state.question.text:state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;
$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+escapeHtml(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>b.onclick=()=>send('score',{team:Number(b.dataset.team),points:Number(b.dataset.points)}));
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
+b.dataset.points+' to '+state.teams[Number(b.dataset.team)].name+'?'))return;$('award').querySelectorAll('button').forEach(x=>x.disabled=true);send('score',{team:Number(b.dataset.team),points:Number(b.dataset.points)})}});
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
+x.points:'deducted -
if(!host){$('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch the instructor screen':'Waiting for instructor to select a question';}
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}
$('clue').hidden=!state.question;if(!state.question)return;
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;
$('clueText').textContent=state.question.daily?'⭐ DAILY DOUBLE! '+state.question.text:state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;
$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+escapeHtml(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>b.onclick=()=>send('score',{team:Number(b.dataset.team),points:Number(b.dataset.points)}));
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
+Math.abs(x.points))+' • New total: 
if(!host){$('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch the instructor screen':'Waiting for instructor to select a question';}
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}
$('clue').hidden=!state.question;if(!state.question)return;
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;
$('clueText').textContent=state.question.daily?'⭐ DAILY DOUBLE! '+state.question.text:state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;
$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+escapeHtml(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>b.onclick=()=>send('score',{team:Number(b.dataset.team),points:Number(b.dataset.points)}));
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
+x.total;$('scoreNotice').textContent='✓ '+label;$('scoreNotice').hidden=false;}else{$('scoreNotice').hidden=true}
if(!host){$('studentMessage').textContent=state.round==='final'?'Final Jeopardy — watch the instructor screen':'Waiting for instructor to select a question';}
if(host){$('level').value=state.level;$('round').value=state.round;renderHost()}
$('clue').hidden=!state.question;if(!state.question)return;
$('clueCategory').textContent=state.question.category+' • $'+state.question.value;
$('clueText').textContent=state.question.daily?'⭐ DAILY DOUBLE! '+state.question.text:state.question.text;
$('hostClue').hidden=!host;$('studentClue').hidden=host;
if(host){const daily=!!state.question.daily;
$('open').hidden=daily;$('lock').hidden=daily;$('award').hidden=daily;$('dailyPanel').hidden=!daily;$('next').hidden=daily;
$('winner').textContent=state.winner?'🔔 '+state.winner.name+' buzzed first — '+state.teams[state.winner.team].name:state.buzzOpen?'Buzzers OPEN':'Buzzers locked';
$('answer').textContent=state.answer||'';
$('award').innerHTML=state.teams.map((t,i)=>'<div>'+escapeHtml(t.name)+' <button data-team="'+i+'" data-points="'+state.question.value+'">Correct +$'+state.question.value+'</button> <button data-team="'+i+'" data-points="'+(-state.question.value)+'">Incorrect -$'+state.question.value+'</button></div>').join('');
$('award').querySelectorAll('button').forEach(b=>b.onclick=()=>send('score',{team:Number(b.dataset.team),points:Number(b.dataset.points)}));
$('dailyTeam').innerHTML=state.teams.map((t,i)=>'<option value="'+i+'" '+(state.dailyTeam===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('');
}else{$('buzzStatus').textContent=state.question.daily?'Daily Double — instructor chooses the team':state.winner?state.winner.name+' buzzed first!':state.buzzOpen?'BUZZ NOW!':'Waiting for instructor to open buzzers';$('buzz').disabled=!state.buzzOpen||!!state.winner}
}
function renderHost(){
$('students').innerHTML='<b>Students ('+state.players.length+'/11):</b> '+state.players.map(p=>'<label>'+escapeHtml(p.name)+' <select data-id="'+p.id+'">'+state.teams.map((t,i)=>'<option value="'+i+'" '+(p.team===i?'selected':'')+'>'+escapeHtml(t.name)+'</option>').join('')+'</select></label>').join('');
$('students').querySelectorAll('select').forEach(s=>s.onchange=()=>send('assign',{id:s.dataset.id,team:Number(s.value)}));
$('board').hidden=state.round==='final';$('finalPanel').hidden=state.round!=='final';
if(state.round==='final'){renderFinal();return}
$('board').innerHTML=categories.map(c=>'<b>'+escapeHtml(c)+'</b>').join('')+Array.from({length:25},(_,n)=>{const row=Math.floor(n/5),col=n%5,key=state.round+':'+col+':'+row,used=state.used.includes(key);return '<button data-col="'+col+'" data-row="'+row+'" '+(used||state.question?'disabled':'')+'>'+(used?'✓':'$'+((row+1)*(state.round==='double'?200:100)))+'</button>'}).join('');
$('board').querySelectorAll('button').forEach(b=>b.onclick=()=>{const col=Number(b.dataset.col),row=Number(b.dataset.row),q=(state.round==='double'?questions.double[state.level]:questions[state.level])[col][row];$('answer').hidden=true;send('question',{category:categories[col],value:(row+1)*(state.round==='double'?200:100),text:q[0],answer:q[1],key:state.round+':'+col+':'+row})});
}
function renderFinal(){const q=questions.final[state.level];$('finalQuestion').textContent=q[0];$('finalAnswer').textContent=q[1];
$('finalTeams').innerHTML=state.teams.map((t,i)=>'<div><b>'+escapeHtml(t.name)+'</b> • $'+t.score+' <input id="fw'+i+'" type="number" min="0" max="'+Math.max(0,t.score)+'" placeholder="Wager" value="'+(state.finalWagers[i]??'')+'"><button data-save="'+i+'">Save wager</button><button data-grade="'+i+'" data-correct="1">Correct</button><button data-grade="'+i+'" data-correct="0">Incorrect</button></div>').join('');
$('finalTeams').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.save),wager=Number($('fw'+team).value);if(!Number.isInteger(wager)||wager<0||wager>Math.max(0,state.teams[team].score))return alert('Invalid Final Jeopardy wager');send('finalWager',{team,wager})});
$('finalTeams').querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const team=Number(b.dataset.grade);if(state.finalWagers[team]===null)return alert('Save this team’s wager first');send('finalAward',{team,correct:b.dataset.correct==='1'})});
}
