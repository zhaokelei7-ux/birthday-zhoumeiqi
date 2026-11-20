import {
  buildLayout, starPath, constellationPath, SKY,
} from './geometry.js';
import {
  createState, beginPlayback, completePlayback, cancelPlayback,
  isLit, countLit, isComplete, TOTAL,
} from './state.js';
import { loadLit, saveLit, clearLit } from './storage.js';
import { createPlayer } from './audio.js';
import { startMeteorShower } from './finale.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GROUP_LABEL = { classmate: '同学', volunteer: '志工', teacher: '班主任' };
const TEAM_ORDER = ['冲刺队', '战神队', '超越队', '力量队', '志工团'];

const els = {
  sky: document.querySelector('#sky'),
  progress: document.querySelector('#progress-count'),
  hint: document.querySelector('#hint'),
  reset: document.querySelector('#reset-btn'),
  card: document.querySelector('#card'),
  cardKicker: document.querySelector('#card-kicker'),
  cardTitle: document.querySelector('#card-title'),
  cardBlessing: document.querySelector('#card-blessing'),
  cardStatus: document.querySelector('#card-status'),
  cardBar: document.querySelector('#card-bar'),
  cardReplay: document.querySelector('#card-replay'),
  cardClose: document.querySelector('#card-close'),
  finale: document.querySelector('#finale'),
  finaleCanvas: document.querySelector('#finale-canvas'),
  finaleClose: document.querySelector('#finale-close'),
  finaleAgain: document.querySelector('#finale-again'),
  finaleReplay: document.querySelector('#finale-replay'),
};

let layout = [];
let manifest = {};
let state = createState();
let player = null;
let activeName = null;
let activeView = 'blessing';
let litThisPlayback = false;
let finalePending = false;
let finaleCelebrated = false;
let lastFocus = null;
let stopMeteors = null;
let finaleReturnFocus = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const starNodes = new Map();
const lineNodes = new Map();

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function init() {
  try {
    const [peopleResponse, manifestResponse] = await Promise.all([
      fetch('./data/people.json'),
      fetch('./data/audio-manifest.json').catch(() => null),
    ]);

    if (!peopleResponse.ok) throw new Error(`people.json ${peopleResponse.status}`);
    const people = await peopleResponse.json();

    if (manifestResponse && manifestResponse.ok) {
      try {
        manifest = await manifestResponse.json();
      } catch {
        manifest = {};
      }
    }

    layout = buildLayout(people);
    const knownNames = new Set(people.map((person) => person.name));
    state = createState({
      lit: loadLit(getStorage()).filter((name) => knownNames.has(name)),
    });

    player = createPlayer({
      onEnded: handleAudioEnded,
      onError: handleAudioError,
      onProgress: handleProgress,
      onDuration: handleDuration,
    });

    renderSky();
    bindEvents();
    render();
  } catch (error) {
    console.error('[birthday] 初始化失败', error);
    els.hint.textContent = '星空加载失败，请刷新重试；如果仍然失败，请联系制作人。';
    els.sky.replaceChildren();
  }
}

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function ariaLabel(entry, lit, canReplay) {
  const group = entry.group === 'classmate' ? entry.team : GROUP_LABEL[entry.group];
  if (!canReplay) {
    return lit
      ? `${entry.name}，${group}，已点亮，点击查看祝福`
      : `${entry.name}，${group}，未点亮，点击查看祝福`;
  }
  return lit
    ? `${entry.name}，${group}，已点亮，点击查看祝福并重播语音`
    : `${entry.name}，${group}，未点亮，点击播放语音`;
}

// 背景小星星的位置固定下来，刷新后星空不会跳来跳去。
function backgroundStars(count = 120) {
  let seed = 20261119;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const nodes = [];
  for (let index = 0; index < count; index += 1) {
    const node = el('circle', {
      cx: (random() * SKY.width).toFixed(1),
      cy: (random() * SKY.height * 0.96).toFixed(1),
      r: (0.6 + random() * 1.6).toFixed(2),
      class: 'bg-star',
      fill: '#dfe9ff',
      'fill-opacity': (0.2 + random() * 0.6).toFixed(2),
    });
    node.style.animationDuration = `${(3 + random() * 5).toFixed(2)}s`;
    node.style.animationDelay = `${(-random() * 8).toFixed(2)}s`;
    nodes.push(node);
  }
  return nodes;
}

function buildDefs() {
  const defs = el('defs', {});

  const sky = el('linearGradient', { id: 'sky-gradient', x1: '0', y1: '0', x2: '0', y2: '1' });
  sky.append(el('stop', { offset: '0', 'stop-color': '#050819' }));
  sky.append(el('stop', { offset: '0.55', 'stop-color': '#0b1430' }));
  sky.append(el('stop', { offset: '1', 'stop-color': '#141d3f' }));
  defs.append(sky);

  const purple = el('radialGradient', { id: 'nebula-purple', cx: '0.28', cy: '0.22', r: '0.6' });
  purple.append(el('stop', { offset: '0', 'stop-color': '#6f57ff', 'stop-opacity': '0.26' }));
  purple.append(el('stop', { offset: '1', 'stop-color': '#6f57ff', 'stop-opacity': '0' }));
  defs.append(purple);

  const teal = el('radialGradient', { id: 'nebula-teal', cx: '0.78', cy: '0.68', r: '0.55' });
  teal.append(el('stop', { offset: '0', 'stop-color': '#2fa6b8', 'stop-opacity': '0.18' }));
  teal.append(el('stop', { offset: '1', 'stop-color': '#2fa6b8', 'stop-opacity': '0' }));
  defs.append(teal);

  const milky = el('radialGradient', { id: 'milky-way', cx: '0.5', cy: '0.5', r: '0.5' });
  milky.append(el('stop', { offset: '0', 'stop-color': '#cbd9ff', 'stop-opacity': '0.09' }));
  milky.append(el('stop', { offset: '1', 'stop-color': '#cbd9ff', 'stop-opacity': '0' }));
  defs.append(milky);

  const moonGlow = el('radialGradient', { id: 'moon-glow', cx: '0.5', cy: '0.5', r: '0.5' });
  moonGlow.append(el('stop', { offset: '0', 'stop-color': '#ffeab5', 'stop-opacity': '0.45' }));
  moonGlow.append(el('stop', { offset: '1', 'stop-color': '#ffeab5', 'stop-opacity': '0' }));
  defs.append(moonGlow);

  const moonFill = el('linearGradient', { id: 'moon-fill', x1: '0', y1: '0', x2: '0.4', y2: '1' });
  moonFill.append(el('stop', { offset: '0', 'stop-color': '#fffdf4' }));
  moonFill.append(el('stop', { offset: '1', 'stop-color': '#ffe1a0' }));
  defs.append(moonFill);

  const mask = el('mask', { id: 'moon-mask', maskUnits: 'userSpaceOnUse', x: '400', y: '620', width: '220', height: '220' });
  mask.append(el('circle', { cx: '500', cy: '720', r: '78', fill: '#ffffff' }));
  mask.append(el('circle', { cx: '534', cy: '694', r: '66', fill: '#000000' }));
  defs.append(mask);

  return defs;
}

function renderSky() {
  els.sky.replaceChildren();
  els.sky.append(buildDefs());

  els.sky.append(el('rect', {
    x: 0, y: 0, width: SKY.width, height: SKY.height, fill: 'url(#sky-gradient)',
  }));
  els.sky.append(el('ellipse', {
    cx: 240, cy: 210, rx: 560, ry: 430, fill: 'url(#nebula-purple)',
  }));
  els.sky.append(el('ellipse', {
    cx: 790, cy: 690, rx: 480, ry: 380, fill: 'url(#nebula-teal)',
  }));
  els.sky.append(el('ellipse', {
    cx: 500, cy: 520, rx: 640, ry: 190,
    transform: 'rotate(-24 500 520)',
    fill: 'url(#milky-way)',
  }));

  els.sky.append(el('circle', { cx: 500, cy: 720, r: 160, fill: 'url(#moon-glow)' }));
  els.sky.append(el('circle', {
    cx: 500, cy: 720, r: 78, fill: 'url(#moon-fill)', mask: 'url(#moon-mask)',
  }));

  for (const node of backgroundStars()) els.sky.append(node);

  els.sky.append(el('line', {
    x1: 820, y1: 140, x2: 750, y2: 186, class: 'shooting-star shoot-one',
  }));
  els.sky.append(el('line', {
    x1: 320, y1: 100, x2: 268, y2: 138, class: 'shooting-star shoot-two',
  }));

  for (const team of TEAM_ORDER) {
    const members = layout.filter((entry) => entry.team === team);
    const lineNode = el('path', {
      d: constellationPath(members),
      class: 'constellation-line',
      'data-team': team,
      'aria-hidden': 'true',
    });
    els.sky.append(lineNode);
    lineNodes.set(team, lineNode);
  }

  for (const entry of layout) {
    const group = el('g', {
      class: 'star',
      role: 'button',
      tabindex: '0',
      'data-name': entry.name,
      'data-team': entry.team,
      'aria-label': ariaLabel(entry, false, Boolean(manifest[entry.name])),
    });

    group.append(el('circle', {
      cx: entry.x, cy: entry.y, r: entry.radius * 2.9, class: 'star-halo',
    }));

    const rayLength = entry.radius * 2.6;
    group.append(el('line', {
      x1: entry.x - rayLength, y1: entry.y, x2: entry.x + rayLength, y2: entry.y, class: 'star-rays',
    }));
    group.append(el('line', {
      x1: entry.x, y1: entry.y - rayLength, x2: entry.x, y2: entry.y + rayLength, class: 'star-rays',
    }));

    group.append(el('path', {
      d: starPath(entry.x, entry.y, entry.radius), class: 'star-shape',
    }));

    const sparkLength = entry.radius * 2.2;
    group.append(el('line', {
      x1: entry.x - sparkLength, y1: entry.y, x2: entry.x + sparkLength, y2: entry.y, class: 'star-spark',
    }));
    group.append(el('line', {
      x1: entry.x, y1: entry.y - sparkLength, x2: entry.x, y2: entry.y + sparkLength, class: 'star-spark',
    }));

    group.append(el('circle', {
      cx: entry.x, cy: entry.y, r: 42, class: 'star-hit',
    }));

    const label = el('text', {
      x: entry.labelX,
      y: entry.labelY,
      class: entry.group === 'teacher' ? 'star-label teacher-label' : 'star-label',
      'text-anchor': entry.anchor,
      'dominant-baseline': 'central',
    });
    label.textContent = entry.name;
    group.append(label);

    group.addEventListener('click', () => handleStar(entry.name));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleStar(entry.name);
      }
    });

    els.sky.append(group);
    starNodes.set(entry.name, { group, label });
  }
}

function render() {
  els.progress.textContent = String(countLit(state));
  els.sky.classList.toggle('is-playing', state.status === 'playing');

  for (const entry of layout) {
    const node = starNodes.get(entry.name);
    const lit = isLit(state, entry.name);
    node.group.classList.toggle('lit', lit);
    node.group.classList.toggle('playing', state.playingName === entry.name);
    node.group.setAttribute('aria-label', ariaLabel(entry, lit, Boolean(manifest[entry.name])));
  }

  for (const [team, node] of lineNodes) {
    const members = layout.filter((entry) => entry.team === team);
    const litCount = members.filter((entry) => isLit(state, entry.name)).length;
    node.style.opacity = String((0.24 + 0.48 * (litCount / members.length)).toFixed(3));
  }

  const count = countLit(state);
  if (count >= TOTAL) {
    els.hint.textContent = `${TOTAL} 颗星星，全部点亮。`;
  } else if (count === 0) {
    els.hint.textContent = '点击任意一颗星星，听 TA 对你说生日快乐~';
  } else {
    els.hint.textContent = `已有 ${count} 颗星星被点亮，继续点击灰暗的星星吧`;
  }

  els.finaleReplay.hidden = !isComplete(state);
}

function handleStar(name) {
  const entry = layout.find((person) => person.name === name);
  if (!entry || state.status === 'playing') return;

  lastFocus = document.activeElement;

  if (isLit(state, name)) {
    openCard(entry, 'blessing');
    return;
  }

  const newlyLit = !isLit(state, name);
  const started = beginPlayback(state, name);
  if (!started) return;

  state = started;
  litThisPlayback = newlyLit;
  saveLit(getStorage(), state.lit);
  render();

  // 最后一颗点亮后先把流星雨挂起：语音播完或卡片被关掉时再放，
  // 避免提前盖住最后一段祝福，也避免半路关掉卡片后永远看不到。
  if (newlyLit && isComplete(state) && !finaleCelebrated) finalePending = true;

  const audio = manifest[name];
  if (!audio) {
    state = completePlayback(state, name, { missingAudio: true });
    afterLit(entry, newlyLit);
    return;
  }

  openCard(entry, 'playing');
  player.play(audio.file, { durationHint: audio.duration });
}

function handleAudioEnded() {
  const name = state.playingName;
  if (!name) return;
  const entry = layout.find((person) => person.name === name);
  if (!entry) return;

  const newlyLit = litThisPlayback;
  litThisPlayback = false;
  state = completePlayback(state, name);
  afterLit(entry, newlyLit);
}

function handleAudioError() {
  const name = state.playingName;
  if (!name) return;
  const entry = layout.find((person) => person.name === name);
  if (!entry) return;

  const newlyLit = litThisPlayback;
  litThisPlayback = false;
  state = completePlayback(state, name, { missingAudio: true });
  afterLit(entry, newlyLit);
}

function afterLit(entry, newlyLit = false) {
  saveLit(getStorage(), state.lit);
  render();

  if (isComplete(state) && !finaleCelebrated) finalePending = true;

  if (finalePending) {
    closeCard({ stopAudio: false });
    return;
  }

  openCard(entry, 'blessing');
}

function openCard(entry, view) {
  activeName = entry.name;
  activeView = view;

  const groupName = entry.group === 'classmate' ? entry.team : GROUP_LABEL[entry.group];

  els.card.hidden = false;

  els.cardKicker.textContent = view === 'playing' ? '正在收听' : '来自';
  els.cardTitle.textContent = view === 'playing'
    ? entry.name
    : `${entry.name} · ${groupName}`;
  els.cardBlessing.textContent = view === 'playing'
    ? '请听 TA 对你说的话…'
    : entry.blessing;
  els.cardStatus.textContent = view === 'playing'
    ? '正在播放 0″'
    : '这颗星星已点亮';
  els.cardBar.style.width = view === 'playing' ? '0%' : '100%';
  els.cardReplay.hidden = view !== 'blessing' || !manifest[entry.name];

  els.cardClose.focus({ preventScroll: true });
}

function closeCard({ stopAudio = true } = {}) {
  if (stopAudio && state.status === 'playing') {
    player.stop();
    state = cancelPlayback(state);
    render();
  }

  els.card.hidden = true;
  activeName = null;

  if (lastFocus && document.contains(lastFocus)) {
    lastFocus.focus({ preventScroll: true });
  }
  lastFocus = null;

  // 半路关掉最后一段语音时，补上流星雨。
  if (finalePending) {
    finalePending = false;
    finaleCelebrated = true;
    showFinale();
  }
}

function showFinale() {
  if (els.finale.hidden) finaleReturnFocus = document.activeElement;
  els.finale.hidden = false;
  els.finaleClose.focus({ preventScroll: true });

  if (reducedMotion) {
    els.finale.classList.add('reduced');
    return;
  }

  if (stopMeteors) stopMeteors();
  stopMeteors = startMeteorShower(els.finaleCanvas, { duration: 9000 });
}

function hideFinale() {
  if (stopMeteors) {
    stopMeteors();
    stopMeteors = null;
  }
  els.finale.hidden = true;

  if (finaleReturnFocus && document.contains(finaleReturnFocus)) {
    finaleReturnFocus.focus({ preventScroll: true });
  }
  finaleReturnFocus = null;
}

function replay() {
  if (!activeName || state.status === 'playing') return;

  const entry = layout.find((person) => person.name === activeName);
  const audio = manifest[activeName];
  if (!entry || !audio) return;

  const started = beginPlayback(state, activeName);
  if (!started) return;

  state = started;
  litThisPlayback = false;
  openCard(entry, 'playing');
  player.play(audio.file, { durationHint: audio.duration });
  render();
}

function handleProgress(current, duration) {
  if (activeView !== 'playing' || !duration || els.card.hidden) return;
  const ratio = Math.max(0, Math.min(1, current / duration));
  els.cardBar.style.width = `${(ratio * 100).toFixed(1)}%`;
  els.cardStatus.textContent = `正在播放 ${formatTime(current)} / ${formatTime(duration)}`;
}

function handleDuration(duration) {
  if (activeView !== 'playing' || els.card.hidden) return;
  els.cardStatus.textContent = `正在播放 0″ / ${formatTime(duration)}`;
}

function formatTime(seconds) {
  return `${Math.max(0, Math.round(seconds))}″`;
}

function bindEvents() {
  els.cardClose.addEventListener('click', () => closeCard());
  els.cardReplay.addEventListener('click', replay);
  els.card.addEventListener('click', (event) => {
    if (event.target === els.card) closeCard();
  });
  els.reset.addEventListener('click', resetProgress);
  els.finaleClose.addEventListener('click', hideFinale);
  els.finaleAgain.addEventListener('click', showFinale);
  els.finaleReplay.addEventListener('click', showFinale);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!els.finale.hidden) {
      hideFinale();
    } else if (!els.card.hidden) {
      closeCard();
    }
  });
}

function resetProgress() {
  if (!window.confirm(`确定要清空 ${TOTAL} 颗星星的点亮进度吗？`)) return;

  player.stop();
  clearLit(getStorage());
  state = createState();
  litThisPlayback = false;
  finalePending = false;
  finaleCelebrated = false;
  closeCard({ stopAudio: false });
  hideFinale();
  els.finaleReplay.hidden = true;
  render();
}

init();
