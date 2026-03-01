const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const distanceEl = document.getElementById('distance');
const coinsEl = document.getElementById('coins');
const speedEl = document.getElementById('speed');
const restartBtn = document.getElementById('restart');

const laneX = [-1, 0, 1];
const roadHalfWidth = 1.7;
const obstacleConfig = {
  lookAhead: 90,
  minSpacing: 12,
  randomSpacing: 10,
  safeGapEvery: 5,
};

const world = {
  speed: 8,
  baseSpeed: 8,
  accel: 0.13,
  distance: 0,
  coins: 0,
  running: true,
  time: 0,
  playerLane: 1,
  playerY: 0,
  vy: 0,
  gravity: 28,
  jumpForce: 11,
  obstacles: [],
  collectibles: [],
  segments: [],
  spawnZ: 42,
  nextObstacle: 16,
  nextCoin: 0,
  obstacleCount: 0,
  lastObstacleLane: 1,
  safeLane: 1,
};

const keys = new Set();

document.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  keys.add(e.code);

  if ((e.code === 'ArrowUp' || e.code === 'Space') && world.running) {
    jump();
  }
});

document.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

restartBtn.addEventListener('click', resetGame);

function jump() {
  if (world.playerY < 0.02) {
    world.vy = world.jumpForce;
  }
}

function resetGame() {
  Object.assign(world, {
    speed: world.baseSpeed,
    distance: 0,
    coins: 0,
    running: true,
    time: 0,
    playerLane: 1,
    playerY: 0,
    vy: 0,
    obstacles: [],
    collectibles: [],
    nextObstacle: 16,
    nextCoin: 0,
    obstacleCount: 0,
    lastObstacleLane: 1,
    safeLane: 1,
  });
  restartBtn.hidden = true;
}

function pickObstacleLane() {
  const lanes = [0, 1, 2].filter((lane) => lane !== world.safeLane && lane !== world.lastObstacleLane);
  const fallbackLanes = [0, 1, 2].filter((lane) => lane !== world.safeLane);
  const source = lanes.length ? lanes : fallbackLanes;
  return source[Math.floor(Math.random() * source.length)];
}

function project(x, y, z) {
  const depth = Math.max(0.1, z + 5);
  const scale = 320 / depth;
  const screenX = canvas.width * 0.5 + x * scale * 100;
  const screenY = canvas.height * 0.72 - y * scale * 100;
  return { x: screenX, y: screenY, s: scale };
}

function spawnObjects() {
  while (world.nextObstacle < world.distance + obstacleConfig.lookAhead) {
    const z = world.nextObstacle + obstacleConfig.minSpacing + Math.random() * obstacleConfig.randomSpacing;
    world.nextObstacle = z;
    world.obstacleCount += 1;

    if (world.obstacleCount % obstacleConfig.safeGapEvery === 0) {
      world.safeLane = Math.floor(Math.random() * 3);
      continue;
    }

    const typeRoll = Math.random();
    const lane = pickObstacleLane();
    world.lastObstacleLane = lane;
    if (typeRoll < 0.34) {
      world.obstacles.push({ type: 'wall', lane, z, h: 1.4 });
    } else if (typeRoll < 0.67) {
      world.obstacles.push({ type: 'spike', lane, z, h: 0.55 });
    } else {
      world.obstacles.push({ type: 'hole', lane, z, h: 0.1 });
    }
  }

  while (world.nextCoin < world.distance + 80) {
    const z = world.nextCoin + 16 + Math.random() * 14;
    world.nextCoin = z;
    world.collectibles.push({ lane: Math.floor(Math.random() * 3), z, y: 0.6 + Math.random() * 0.6 });
  }
}

function update(dt) {
  if (!world.running) return;

  if (keys.has('ArrowLeft')) world.playerLane = Math.max(0, world.playerLane - 1);
  if (keys.has('ArrowRight')) world.playerLane = Math.min(2, world.playerLane + 1);
  keys.delete('ArrowLeft');
  keys.delete('ArrowRight');

  world.time += dt;
  world.speed += world.accel * dt;
  world.distance += world.speed * dt;

  world.vy -= world.gravity * dt;
  world.playerY += world.vy * dt;
  if (world.playerY <= 0) {
    world.playerY = 0;
    world.vy = 0;
  }

  spawnObjects();

  const playerZ = 4;
  const playerX = laneX[world.playerLane];

  world.obstacles = world.obstacles.filter((o) => o.z > world.distance - 5);
  world.collectibles = world.collectibles.filter((c) => c.z > world.distance - 5);

  for (const obs of world.obstacles) {
    const relZ = obs.z - world.distance;
    if (Math.abs(relZ - playerZ) < 1.1 && obs.lane === world.playerLane) {
      if (obs.type === 'hole') {
        if (world.playerY < 0.25) {
          gameOver();
        }
      } else if (world.playerY < obs.h - 0.05) {
        gameOver();
      }
    }
  }

  world.collectibles = world.collectibles.filter((c) => {
    const relZ = c.z - world.distance;
    if (Math.abs(relZ - playerZ) < 0.9 && c.lane === world.playerLane && Math.abs(world.playerY - c.y) < 0.75) {
      world.coins += 1;
      return false;
    }
    return true;
  });

  distanceEl.textContent = Math.floor(world.distance);
  coinsEl.textContent = world.coins;
  speedEl.textContent = `${(world.speed / world.baseSpeed).toFixed(1)}x`;
}

function gameOver() {
  world.running = false;
  restartBtn.hidden = false;
}

function drawCube(x, y, z, size, color) {
  const p = project(x, y, z);
  const w = size * p.s * 100;
  const h = w;
  ctx.fillStyle = color;
  ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(p.x - w / 2, p.y - h, w, h * 0.24);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const horizon = canvas.height * 0.3;
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#293e96');
  sky.addColorStop(1, '#080a16');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 80; i += 1) {
    const z = i * 2;
    const worldZ = z + (world.distance % 2);
    const p1 = project(-roadHalfWidth, 0, worldZ);
    const p2 = project(roadHalfWidth, 0, worldZ);
    const p3 = project(roadHalfWidth, 0, worldZ + 2);
    const p4 = project(-roadHalfWidth, 0, worldZ + 2);

    ctx.fillStyle = i % 2 === 0 ? '#14204d' : '#101a3b';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    if (i % 4 === 0) {
      const leftNeon = project(-roadHalfWidth, 0.03, worldZ);
      const rightNeon = project(roadHalfWidth, 0.03, worldZ);
      ctx.strokeStyle = '#27d6ff55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftNeon.x, leftNeon.y);
      ctx.lineTo(rightNeon.x, rightNeon.y);
      ctx.stroke();
    }
  }

  const visibleObstacles = world.obstacles
    .map((o) => ({ ...o, relZ: o.z - world.distance }))
    .filter((o) => o.relZ > 0 && o.relZ < 90)
    .sort((a, b) => b.relZ - a.relZ);

  for (const obs of visibleObstacles) {
    const x = laneX[obs.lane];
    if (obs.type === 'wall') drawCube(x, 0, obs.relZ, 0.7, '#ff4f74');
    if (obs.type === 'spike') drawCube(x, 0, obs.relZ, 0.5, '#ff7a36');
    if (obs.type === 'hole') {
      const p = project(x, 0.01, obs.relZ);
      const size = 70 * p.s;
      ctx.fillStyle = '#020205';
      ctx.fillRect(p.x - size / 2, p.y - size * 0.15, size, size * 0.3);
    }
  }

  const visibleCoins = world.collectibles
    .map((c) => ({ ...c, relZ: c.z - world.distance }))
    .filter((c) => c.relZ > 0 && c.relZ < 90)
    .sort((a, b) => b.relZ - a.relZ);

  for (const coin of visibleCoins) {
    const p = project(laneX[coin.lane], coin.y, coin.relZ);
    const r = Math.max(2, 14 * p.s);
    ctx.fillStyle = '#ffd35a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - r, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCube(laneX[world.playerLane], world.playerY, 4, 0.55, '#4df2a2');

  if (!world.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fbff';
    ctx.font = 'bold 52px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '24px Inter, sans-serif';
    ctx.fillText(`Distance: ${Math.floor(world.distance)}m`, canvas.width / 2, canvas.height / 2 + 24);
    ctx.fillText(`Pièces: ${world.coins}`, canvas.width / 2, canvas.height / 2 + 58);
  }

  if (world.distance < 8) {
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Évite les obstacles et récupère les pièces !', canvas.width / 2, horizon - 24);
  }
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
