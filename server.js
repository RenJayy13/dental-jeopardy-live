const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const rooms=new Map();
const id=()=>crypto.randomBytes(12).toString('hex');
const send=(ws,data)=>{if(ws.readyState===1)ws.send(JSON.stringify(data))};
function publish(r){for(const ws of r.clients){send(ws,{type:'state',code:r.code,teams:r.teams,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,team:p.team})),buzzOpen:r.open,winner:r.winner?{name:r.players.get(r.winner)?.name,team:r.players.get(r.winner)?.team}:null,question:r.question,used:[...r.used],level:r.level,answer:ws===r.host?r.answer:null})}}
const base=path.resolve(__dirname,'public');
const server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end()};const file=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end()};fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')};res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(data)})});
const wss=new WebSocketServer({server});
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==='create'){let code;do{code=String(Math.floor(100000+Math.random()*900000))}while(rooms.has(code));let r={code,host:ws,clients:new Set([ws]),players:new Map(),teams:[{name:'Team 1',score:0},{name:'Team 2',score:0},{name:'Team 3',score:0}],open:false,winner:null,question:null,answer:null,used:new Set(),level:'beginner'};rooms.set(code,r);ws.room=r;send(ws,{type:'created',code});publish(r);return}
if(m.type==='join'){const r=rooms.get(String(m.code));if(!r)return send(ws,{type:'error',message:'Room not found'});if(r.players.size>=11)return send(ws,{type:'error',message:'Room is full (11 students)'});const name=String(m.name||'').trim().slice(0,32);if(!name)return send(ws,{type:'error',message:'Enter your name'});const pid=id();r.players.set(pid,{id:pid,name,team:r.players.size%3});r.clients.add(ws);ws.room=r;ws.playerId=pid;send(ws,{type:'joined',id:pid});publish(r);return}
const r=ws.room;if(!r)return;
if(m.type==='buzz'){if(!ws.playerId||!r.open||r.winner)return;r.winner=ws.playerId;r.open=false;publish(r);return}
if(ws!==r.host)return;
if(m.type==='openBuzzers'){r.open=true;r.winner=null}
if(m.type==='closeBuzzers')r.open=false;
if(m.type==='score'){let t=Number(m.team),v=Number(m.points);if(Number.isInteger(t)&&t>=0&&t<3&&Number.isFinite(v)&&Math.abs(v)<=10000)r.teams[t].score+=Math.trunc(v)}
if(m.type==='assign'){let p=r.players.get(m.id),t=Number(m.team);if(p&&Number.isInteger(t)&&t>=0&&t<3)p.team=t}
if(m.type==='question'){r.question={category:String(m.category||'').slice(0,80),value:Number(m.value)||100,text:String(m.text||'').slice(0,1000),key:String(m.key||'')};r.answer=String(m.answer||'').slice(0,1000);r.open=false;r.winner=null}
if(m.type==='next'){if(r.question?.key)r.used.add(r.question.key);r.question=null;r.answer=null;r.open=false;r.winner=null}
if(m.type==='level'){if(['beginner','intermediate','advanced'].includes(m.level)){r.level=m.level;r.question=null;r.answer=null;r.used.clear();r.teams.forEach(t=>t.score=0);r.open=false;r.winner=null}}
publish(r);
});ws.on('close',()=>{let r=ws.room;if(!r)return;r.clients.delete(ws);if(ws.playerId)r.players.delete(ws.playerId);publish(r)})});
server.listen(process.env.PORT||3000,'0.0.0.0');