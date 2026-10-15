'use strict';
const $=id=>document.getElementById(id);
const categories=['Dental Anatomy','Instruments & Materials','Infection Control','Dental Radiography','Clinical Procedures'];
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ws,host=false,state=null,questions=null,playerId=null;
fetch('/questions.json').then(r=>{if(!r.ok)throw Error('Questions unavailable');return r.json()}).then(q=>{questions=q;if(state)render()}).catch(e=>alert(e.message));
function send(type,more={}){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,...more}))}
function connect(onopen){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);ws.onopen=onopen;ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='error')return alert(m.message);if(m.type==='created')history.replaceState(null,'','?room='+m.code);if(m.type==='joined')playerId=m.id;if(m.type==='state'){state=m;render()}};ws.onclose=()=>alert('Connection lost. Reload to start or join a new room.')}
$('create').onclick=()=>{host=true;connect(()=>send('create'))};
$('join').onclick=()=>{const code=$('code').value.trim(),name=$('name').value.trim();if(!/^\d{6}$/.test(code)||!name)return alert('Enter a 6-digit room code and your name');host=false;connect(()=>send('join',{code,name}))};
$('code').value=new URLSearchParams(location.search).get('room')||'';
$('level').onchange=()=>{if(confirm('Switch difficulty and reset scores?'))send('level',{level:$('level').value});else $('level').value=state.level};
$('round').onchange=()=>{if(confirm('Start this round? Scores will be preserved.'))send('round',{round:$('round').value});else $('round').value=state.round};
$('copy').onclick=()=>{const url=location.origin+'/?room='+state.code;navigator.clipboard.writeText(url).then(()=>alert('Student link copied')).catch(()=>prompt('Copy student link',url))};
$('open').onclick=()=>send('openBuzzers');$('lock').onclick=()=>send('closeBuzzers');
$('buzz').onclick=()=>{send('buzz');$('buzz').disabled=true};
$('reveal').onclick=()=>{$('answer').hidden=false};
$('next').onclick=()=>{$('answer').hidden=true;send('next')};
$('finalReveal').onclick=()=>{$('finalAnswer').hidden=false};
function dailyAward(correct){const team=Number($('dailyTeam').value),wager=Number($('dailyWager').value),max=Math.max(state.teams[team].score,state.round==='double'?1000:500);if(!Number.isInteger(wager)||wager<5||wager>max)return alert('Enter a wager between $5 and $'+max);send('dailyTeam',{team});send('dailyAward',{wager,correct})}
$('dailyCorrect').onclick=()=>dailyAward(true);$('dailyWrong').onclick=()=>dailyAward(false);
function render(){if(!state||!questions)return;
$('setup').hidden=true;$('game').hidden=false;$('room').textContent='Room code: '+state.code;
$('scores').innerHTML=state.teams.map(t=>'<div>'+escapeHtml(t.name)+'<br><strong>$'+t.score+'</strong></div>').join('');
$('host').hidden=!host;$('studentHome').hidden=host||!!state.question;
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
