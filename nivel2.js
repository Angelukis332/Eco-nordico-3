(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const TILE = 40, COLS = 24, ROWS = 16, STEP_MS = 130, ENEMY_MS = 275;
  const layout = [
    '########################',
    '#P.....................#',
    '#.####.####.####.#####.#',
    '#......................#',
    '#.####.####.####.#####.#',
    '#......................#',
    '#.####.####.####.#####.#',
    '#..........E...........#',
    '#.####.####.####.#####.#',
    '#......................#',
    '#.####.####.####.#####.#',
    '#......................#',
    '#.####.####.####.#####.#',
    '#......................#',
    '#.####.####.####.#####.#',
    '########################'
  ];
  const $ = id => document.getElementById(id);
  const dirs = { ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0] };
  let player, enemy, items, points, running = false, paused = false, ended = false, startedAt, lastMove = 0, lastEnemy = 0, animation, guideBotWarned=false,totalItems=0;
  let preferred = null, collected = 0, retroAudio = null;
  // Secuencia chiptune generativa: se inicia solo tras pulsar Comenzar.
  function startRetroAudio() {
    if(retroAudio) return;
    const ctxAudio = new AudioContext(), master = ctxAudio.createGain(); master.gain.value = .055; master.connect(ctxAudio.destination);
    const melody=[523,659,784,659,587,698,880,698,523,587,698,784], bass=[131,147,175,147]; let step=0;
    const note=(freq,when,duration,type,gain)=>{const o=ctxAudio.createOscillator(),g=ctxAudio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(gain,when+.015);g.gain.exponentialRampToValueAtTime(.0001,when+duration);o.connect(g).connect(master);o.start(when);o.stop(when+duration+.02)};
    const play=()=>{const t=ctxAudio.currentTime;note(melody[step%melody.length],t,.18,'square',.07);note(bass[Math.floor(step/2)%bass.length],t,.35,'triangle',.06);if(step%2===0)note(100,t,.045,'square',.025);step++;retroAudio.timer=setTimeout(play,230)};retroAudio={ctx:ctxAudio};play();
  }

  function reset() {
    items = new Map(); points = 0; collected = 0; ended = false; preferred = null;
    layout.forEach((row,y) => [...row].forEach((cell,x) => {
      if(cell === 'P') player = {x,y,dir:[1,0]};
      if(cell === 'E') enemy = {x,y,dir:[-1,0]};
      if(cell !== '#' && cell !== 'P' && cell !== 'E') {
        const key = `${x},${y}`;
        items.set(key, (x * 7 + y * 11) % 9 === 0 ? 'leak' : 'bottle');
      }
    }));
    totalItems=items.size;guideBotWarned=false;updateHud(); draw();
  }
  function passable(x,y) { return y >= 0 && y < ROWS && x >= 0 && x < COLS && layout[y][x] !== '#'; }
  function updateHud() {
    $('points').textContent = points;
    $('impactFill').style.width = `${(collected / (collected + items.size || 1)) * 100}%`;
  }
  function movePlayer() {
    if(!preferred) return;
    const [dx,dy] = preferred, nx = player.x + dx, ny = player.y + dy;
    if(!passable(nx,ny)) return;
    player.x = nx; player.y = ny; player.dir = preferred;
    const key = `${nx},${ny}`;
    if(items.has(key)) {
      const type = items.get(key); items.delete(key); collected++;
      points += type === 'leak' ? 25 : 10;
      updateHud();
      if(collected===1)window.EcoGuides?.say('maria','¡Primera gota a salvo! Sigue el recorrido, recoge botellas y cierra las fugas. Cada recurso cuenta.');
      if(collected===Math.ceil(totalItems*.5))window.EcoGuides?.say('william','¡Vas por la mitad! Mantén el ritmo: cada fuga que cierras y cada botella que recuperas reduce la presión sobre el agua.');
      if(items.size === 0) win();
    }
    if(player.x === enemy.x && player.y === enemy.y) lose();
  }
  function moveEnemy() {
    const options = [[0,-1],[1,0],[0,1],[-1,0]].filter(([dx,dy]) => passable(enemy.x+dx,enemy.y+dy));
    options.sort((a,b) => {
      const da = Math.abs(player.x-(enemy.x+a[0])) + Math.abs(player.y-(enemy.y+a[1]));
      const db = Math.abs(player.x-(enemy.x+b[0])) + Math.abs(player.y-(enemy.y+b[1]));
      return da - db;
    });
    const pick = Math.random() < .78 ? options[0] : options[Math.min(1,options.length-1)];
    if(pick) { enemy.x += pick[0]; enemy.y += pick[1]; enemy.dir = pick; }
    if(!guideBotWarned&&Math.abs(player.x-enemy.x)+Math.abs(player.y-enemy.y)<=5){guideBotWarned=true;window.EcoGuides?.say('diego','¡Cuidado, el Haalandbot está cerca! Cambia de dirección y aprovecha los pasillos para dejarlo atrás.');}
    if(player.x === enemy.x && player.y === enemy.y) lose();
  }
  function end(type) {
    if(ended) return; ended = true; running = false; cancelAnimationFrame(animation);
    $('finalPoints').textContent = points; $('finalItems').textContent = collected;
    const win = type === 'win';
    $('resultIcon').textContent = win ? '✦' : '⚠';
    $('resultLabel').textContent = win ? 'MISIÓN CUMPLIDA' : 'DERROTA · IMPACTO HÍDRICO';
    $('resultTitle').textContent = win ? '¡Estadio más sostenible!' : 'El Haalandbot te alcanzó';
    $('resultMessage').textContent = win
      ? '¡Cuando vayas a un partido sé buen hincha y cuida el agua y los recursos, así también apoyas a tu equipo y al planeta!'
      : '¡Así como Haaland te atrapó de rápido, nuestro recurso hídrico a diario se va quedando hasta que sea game over para ti también!';
    $('resultAction').textContent = win ? 'Avanzar' : 'Reintentar';
    $('resultAction').onclick = () => { if(win) location.href = 'nivel3.html'; else start(); };
    $('result').classList.remove('hidden');
    if(win)window.EcoGuides?.say('angel','¡Lo hiciste increíble! Tu recorrido ayudó a cuidar el agua. Pulsa “Avanzar” para convertir esa energía en una nueva misión, o vuelve a jugar para superar tu resultado.');
    else window.EcoGuides?.say('diego','¡No te rindas! Ya conoces mejor el laberinto. Reintenta, cambia tu ruta y demuestra que puedes cuidar cada gota.');
  }
  function lose(){ end('lose'); } function win(){ end('win'); }
  function start() {
    startRetroAudio(); $('result').classList.add('hidden'); $('intro').classList.add('hidden'); $('pause').classList.add('hidden');reset(); running = true; paused = false; startedAt = performance.now(); lastMove = startedAt; lastEnemy = startedAt; window.EcoGuides?.say('sol','Objetivo: recorre el laberinto con WASD o las flechas, recoge todas las gotas y recursos antes de que acabe el tiempo y evita al Haalandbot.'); animation = requestAnimationFrame(loop);
  }
  function loop(now) {
    if(!running) return;
    if(paused){ draw(now); animation=requestAnimationFrame(loop); return; }
    if(now-lastMove >= STEP_MS) { movePlayer(); lastMove = now; }
    if(now-lastEnemy >= ENEMY_MS) { moveEnemy(); lastEnemy = now; }
    const remaining = Math.max(0, 80 - Math.floor((now-startedAt)/1000));
    $('time').textContent = remaining;
    if(remaining <= 0) lose();
    draw(now); animation = requestAnimationFrame(loop);
  }
  function draw(now=0) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#041820'; ctx.fillRect(0,0,canvas.width,canvas.height);
    layout.forEach((row,y) => [...row].forEach((cell,x) => {
      const px=x*TILE, py=y*TILE;
      if(cell === '#') drawWall(px,py); else { ctx.fillStyle=(x+y)%2?'#0b2a31':'#0a252c'; ctx.fillRect(px,py,TILE,TILE); }
    }));
    items.forEach((type,key) => { const [x,y] = key.split(',').map(Number); drawItem(x,y,type,now); });
    drawPlayer(player.x,player.y,player.dir,now); drawBot(enemy.x,enemy.y,enemy.dir,now);
  }
  function drawWall(x,y) {
    ctx.fillStyle='#244951'; ctx.fillRect(x+2,y+2,TILE-4,TILE-4);
    ctx.fillStyle='#3e7a7c'; ctx.fillRect(x+5,y+5,TILE-10,6);
    ctx.strokeStyle='#72d7d1'; ctx.globalAlpha=.35; ctx.strokeRect(x+4,y+4,TILE-8,TILE-8); ctx.globalAlpha=1;
  }
  function drawItem(x,y,type,t) {
    const cx=x*TILE+20, cy=y*TILE+20+Math.sin(t/330+x)*2;
    ctx.save(); ctx.translate(cx,cy);
    if(type==='leak') { ctx.fillStyle='#5ce4ed'; ctx.beginPath(); ctx.arc(0,2,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dfffff';ctx.beginPath();ctx.arc(-3,-1,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffcf63';ctx.fillRect(-12,-12,24,5);ctx.fillStyle='#59736f';ctx.fillRect(-4,-17,8,10); }
    else { ctx.fillStyle='#63d2e2'; ctx.fillRect(-6,-9,12,19);ctx.fillStyle='#dcfaf9';ctx.fillRect(-4,-13,8,5);ctx.fillStyle='#2d93ac';ctx.fillRect(-6,-3,12,6); }
    ctx.restore();
  }
  function drawPlayer(x,y,dir,t) {
    const cx=x*TILE+20,cy=y*TILE+20;ctx.save();ctx.translate(cx,cy);ctx.fillStyle='#f4c85c';ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1d4f62';ctx.fillRect(-12,-4,24,8);ctx.fillStyle='#13293c';ctx.beginPath();ctx.arc(dir[0]*5-4,dir[1]*5-3,3,0,Math.PI*2);ctx.arc(dir[0]*5+4,dir[1]*5-3,3,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawBot(x,y,dir,t) {
    const cx=x*TILE+20,cy=y*TILE+20+Math.sin(t/180)*1;ctx.save();ctx.translate(cx,cy);ctx.fillStyle='#ed5960';ctx.fillRect(-14,-11,28,23);ctx.fillStyle='#a91e3a';ctx.fillRect(-16,8,32,6);ctx.fillStyle='#b7f0e8';ctx.fillRect(-10,-6,20,9);ctx.fillStyle='#071c25';ctx.fillRect(-7,-3,4,3);ctx.fillRect(3,-3,4,3);ctx.strokeStyle='#f1eff0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,-15);ctx.lineTo(-3,-20);ctx.lineTo(3,-15);ctx.lineTo(9,-20);ctx.stroke();ctx.restore();
  }
  addEventListener('keydown', e => { const key=e.key.length===1?e.key.toLowerCase():e.key; if(key==='Escape'&&running){paused=!paused;$('pause').classList.toggle('hidden',!paused);return} if(dirs[key]&&!paused) { preferred=dirs[key]; e.preventDefault(); }});
  $('resumeBtn').onclick=()=>{paused=false;$('pause').classList.add('hidden')};
  $('restartBtn').onclick=()=>location.reload();
  $('menuBtn').onclick=()=>location.href='index.html';
  $('startBtn').onclick=start; reset();
})();
