const METEOR_COLORS = ['#fff4d6', '#ffe6a3', '#bcd4ff', '#ffc9d6', '#9fe8c8'];

export function startMeteorShower(canvas, { duration = 9000 } = {}) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};

  let width = 0;
  let height = 0;
  let meteors = [];
  let stars = [];
  let frameId = 0;
  let stopped = false;
  let lastSpawn = 0;
  let lastBurst = 0;
  const startedAt = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars = Array.from({ length: 140 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.9,
      size: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.6,
    }));
  }

  function spawnMeteor() {
    const fromLeft = Math.random() < 0.5;
    const speed = 520 + Math.random() * 520;
    const angle = (fromLeft ? 0.62 : Math.PI - 0.62);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    meteors.push({
      x: fromLeft ? -80 - Math.random() * width * 0.3 : width + 80 + Math.random() * width * 0.2,
      y: -40 - Math.random() * height * 0.35,
      vx,
      vy,
      length: 110 + Math.random() * 160,
      life: 1,
      decay: 0.25 + Math.random() * 0.3,
      color: METEOR_COLORS[Math.floor(Math.random() * METEOR_COLORS.length)],
      size: 1.6 + Math.random() * 1.6,
    });
  }

  function drawStars(now) {
    for (const star of stars) {
      const alpha = 0.18 + 0.55 * (0.5 + 0.5 * Math.sin(now / 520 * star.speed + star.phase));
      context.globalAlpha = alpha;
      context.fillStyle = '#dfe9ff';
      context.beginPath();
      context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function frame(now) {
    if (stopped) return;

    const elapsed = now - startedAt;
    context.clearRect(0, 0, width, height);
    drawStars(now);

    // 常态是密集的小流星，每隔一阵再来一波成群的，像真正的流星雨。
    if (now - lastSpawn > 70 && elapsed < duration - 1500) {
      lastSpawn = now;
      spawnMeteor();
      if (Math.random() < 0.55) spawnMeteor();
      if (Math.random() < 0.25) spawnMeteor();
    }

    if (now - lastBurst > 1100 && elapsed < duration - 2200) {
      lastBurst = now;
      const burst = 5 + Math.floor(Math.random() * 4);
      for (let index = 0; index < burst; index += 1) spawnMeteor();
      if (Math.random() < 0.5) spawnMeteor();
    }

    if (meteors.length > 90) meteors.splice(0, meteors.length - 90);

    meteors = meteors.filter((meteor) => meteor.life > 0);
    for (const meteor of meteors) {
      const seconds = 1 / 60;
      meteor.x += meteor.vx * seconds;
      meteor.y += meteor.vy * seconds;
      meteor.life -= meteor.decay * seconds;

      const speed = Math.hypot(meteor.vx, meteor.vy) || 1;
      const tailX = meteor.x - (meteor.vx / speed) * meteor.length;
      const tailY = meteor.y - (meteor.vy / speed) * meteor.length;
      const gradient = context.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      gradient.addColorStop(0, meteor.color);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      context.globalAlpha = Math.max(0, Math.min(1, meteor.life));
      context.strokeStyle = gradient;
      context.lineWidth = meteor.size;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(meteor.x, meteor.y);
      context.lineTo(tailX, tailY);
      context.stroke();

      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(meteor.x, meteor.y, meteor.size * 1.1, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    if (meteorOffscreen()) {
      meteors = meteors.filter((meteor) => meteor.y < height + 120);
    }

    if (elapsed < duration || meteors.length > 0) {
      frameId = requestAnimationFrame(frame);
    } else {
      context.clearRect(0, 0, width, height);
    }
  }

  function meteorOffscreen() {
    return meteors.some((meteor) => meteor.y > height + 120);
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    context.clearRect(0, 0, width, height);
  }

  resize();
  window.addEventListener('resize', resize);

  // 开场先撒一批，第一秒就有满天流星的感觉。
  for (let index = 0; index < 14; index += 1) {
    spawnMeteor();
    meteors[meteors.length - 1].y = -80 + Math.random() * height * 0.95;
  }

  frameId = requestAnimationFrame(frame);
  return stop;
}
