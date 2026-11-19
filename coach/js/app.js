import * as C from './cube.js';
import * as S from './solver.js';
import { CubeView } from './view3d.js';
import { SmartCube, bluetoothAvailable } from './ble.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.has('embed')) document.body.classList.add('embed');

const FACE_FR = { U: 'Dessus', D: 'Dessous', F: 'Devant', B: 'Derrière', R: 'Droite', L: 'Gauche' };

// ---------- État ----------
let state = C.solvedState();
const view = new CubeView($('view'));
const guide = { on: false, plan: [], step: 0, pending: [], fix: 0, stepTotal: 0 };
let currentView = 0;

function toast(msg, ms = 2800) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.add('hidden'), ms);
}

function setState(next, { animate = false } = {}) {
  state = next.slice();
  if (!animate) view.setState(state);
  renderNet();
  if (guide.on) startGuide(true);
  else renderGuide();
}

// ---------- Mouvements ----------
function onMove(m) {
  state = C.applyMove(state, m);
  view.enqueue(m);
  renderNet();
  if (!guide.on) { renderGuide(); return; }
  if (guide.pending[0] === m) {
    guide.pending.shift();
    if (guide.fix > 0) guide.fix--;
  } else {
    // Mouvement inattendu : on demande de l'annuler (en fusionnant avec la suite si possible).
    const before = guide.pending.length;
    guide.pending = C.simplify([C.inverse(m), ...guide.pending]);
    guide.fix = Math.max(0, guide.fix + (guide.pending.length - before));
  }
  if (C.isSolved(state)) {
    guide.on = false; renderGuide(true);
    toast('Bravo, le cube est résolu !', 4000);
    return;
  }
  if (!guide.pending.length) nextStep();
  renderGuide();
}

function nextStep() {
  guide.step++;
  guide.fix = 0;
  while (guide.step < guide.plan.length && !guide.plan[guide.step].moves.length) guide.step++;
  if (guide.step >= guide.plan.length) { guide.on = false; return; }
  guide.pending = guide.plan[guide.step].moves.slice();
  guide.stepTotal = guide.pending.length;
  setView(guide.plan[guide.step].view);
}

function setView(k) {
  currentView = k;
  view.setView(k);
  const front = S.RING[k];
  const masc = { W: 'blanc', Y: 'jaune', G: 'vert', B: 'bleu', R: 'rouge', O: 'orange' };
  $('hold').innerHTML = `Tiens le cube : <b>jaune en haut</b>, <b>${masc[C.CENTER_COLOR[front]]} devant</b>`;
}

function startGuide(silent = false) {
  const err = C.validate(state);
  if (err) { guide.on = false; renderGuide(); if (!silent) toast(err, 4500); return; }
  if (C.isSolved(state)) { guide.on = false; renderGuide(true); if (!silent) toast('Le cube est déjà résolu. Mélange-le d’abord !'); return; }
  try {
    guide.plan = S.buildPlan(state);
  } catch (e) {
    guide.on = false; renderGuide(); toast('Impossible de calculer une solution : vérifie les couleurs.'); return;
  }
  guide.on = true; guide.step = -1;
  nextStep();
  renderGuide();
}

// ---------- Affichage du guide ----------
function moveLabel(m) {
  const d = S.toDisplay(m, currentView);
  const color = C.CENTER_COLOR[m[0]];
  return {
    text: d,
    color,
    title: `${FACE_FR[d[0]]} (${C.COLOR_NAME[color]})`,
    sub: m.endsWith("'") ? 'sens inverse des aiguilles d’une montre ↺' : 'sens des aiguilles d’une montre ↻',
  };
}

function renderStages(active, solved) {
  const ol = $('stages');
  ol.innerHTML = '';
  S.STAGES.forEach((st, i) => {
    const li = document.createElement('li');
    li.title = st.name;
    if (solved || i < active) li.classList.add('done');
    else if (i === active) li.classList.add('active');
    li.innerHTML = `<span>${i + 1}. ${st.name}</span>`;
    ol.appendChild(li);
  });
}

function renderGuide(solved = false) {
  const stageNow = guide.on ? guide.plan[guide.step].stage : S.currentStage(state);
  renderStages(stageNow, solved || C.isSolved(state));
  const warn = $('step-warn');
  const movesEl = $('step-moves');
  movesEl.innerHTML = '';
  $('btn-next').disabled = !guide.on;
  if (!guide.on) {
    view.setHint(null);
    $('hud-empty').classList.remove('hidden'); $('hud-move').classList.add('hidden');
    $('btn-guide').textContent = 'Lancer le guide';
    warn.classList.add('hidden');
    $('step-count').textContent = '';
    if (C.isSolved(state)) {
      $('step-stage').textContent = 'Terminé';
      $('step-title').textContent = solved ? 'Cube résolu, bien joué !' : 'Le cube est résolu';
      $('step-detail').textContent = 'Mélange ton cube puis relance le guide pour t’entraîner encore.';
    } else {
      const err = C.validate(state);
      $('step-stage').textContent = 'Prêt';
      $('step-title').textContent = err ? 'Les couleurs ne forment pas un cube valide' : 'Ton cube est prêt';
      $('step-detail').textContent = err
        ? err + ' Corrige-les dans l’onglet « Mon cube ».'
        : 'Vérifie que le cube 3D est identique au tien (jaune en haut, vert devant), puis lance le guide.';
    }
    return;
  }
  const step = guide.plan[guide.step];
  const stage = S.STAGES[step.stage];
  $('btn-guide').textContent = 'Recalculer';
  $('step-stage').textContent = `Étape ${step.stage + 1}/7 · ${stage.name}`;
  const sameStage = guide.plan.filter((s) => s.stage === step.stage);
  $('step-count').textContent = `${sameStage.indexOf(step) + 1}/${sameStage.length}`;
  $('step-title').textContent = step.title;
  $('step-detail').textContent = step.detail;
  if (guide.fix > 0) {
    warn.textContent = 'Mouvement inattendu : fais le mouvement indiqué pour revenir en arrière, puis continue.';
    warn.classList.remove('hidden');
  } else warn.classList.add('hidden');
  // puces : mouvements déjà faits + à faire
  const doneCount = Math.max(0, guide.stepTotal - guide.pending.length);
  const all = guide.fix > 0 ? guide.pending : [...step.moves.slice(0, doneCount), ...guide.pending];
  all.forEach((m, i) => {
    const l = moveLabel(m);
    const chip = document.createElement('span');
    chip.className = 'chip';
    const idxNow = guide.fix > 0 ? 0 : doneCount;
    if (i < idxNow) chip.classList.add('done');
    if (i === idxNow) chip.classList.add(guide.fix > 0 ? 'fix' : 'now');
    chip.innerHTML = `${l.text}<i style="background:${C.COLOR_HEX[l.color]}"></i>`;
    chip.title = `${l.title}, ${l.sub}`;
    movesEl.appendChild(chip);
  });
  const next = guide.pending[0];
  const l = moveLabel(next);
  $('hud-empty').classList.add('hidden'); $('hud-move').classList.remove('hidden');
  $('hud').classList.toggle('wrong', guide.fix > 0);
  $('big-move').textContent = l.text;
  $('big-move').style.background = C.COLOR_HEX[l.color];
  $('big-move').style.color = ['W', 'Y'].includes(l.color) ? '#111' : '#fff';
  $('hud-title').textContent = l.title;
  $('hud-sub').textContent = l.sub;
  view.setHint(next);
}

// ---------- Éditeur de couleurs ----------
let paint = 'W';
const NET_LAYOUT = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
const FACE_AXES = {
  F: { right: [1, 0, 0], up: [0, 1, 0] },
  R: { right: [0, 0, -1], up: [0, 1, 0] },
  B: { right: [-1, 0, 0], up: [0, 1, 0] },
  L: { right: [0, 0, 1], up: [0, 1, 0] },
  U: { right: [1, 0, 0], up: [0, 0, -1] },
  D: { right: [1, 0, 0], up: [0, 0, 1] },
};
function netIndex(f, r, c) {
  const n = C.NORMALS[f], { right, up } = FACE_AXES[f];
  const p = [0, 1, 2].map((k) => n[k] + right[k] * (c - 1) + up[k] * (1 - r));
  return C.stickerIndex(p, n);
}
function buildEditor() {
  const pal = $('palette');
  for (const c of ['W', 'Y', 'G', 'B', 'R', 'O']) {
    const b = document.createElement('button');
    b.className = 'swatch' + (c === paint ? ' sel' : '');
    b.style.background = C.COLOR_HEX[c];
    b.title = C.COLOR_NAME[c];
    b.onclick = () => { paint = c; [...pal.children].forEach((x) => x.classList.toggle('sel', x === b)); };
    pal.appendChild(b);
  }
  const net = $('net');
  for (const f of ['U', 'L', 'F', 'R', 'B', 'D']) {
    const el = document.createElement('div');
    el.className = 'face';
    el.style.gridColumn = NET_LAYOUT[f][0] + 1;
    el.style.gridRow = NET_LAYOUT[f][1] + 1;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const idx = netIndex(f, r, c);
      const s = document.createElement('button');
      s.className = 's' + (r === 1 && c === 1 ? ' center' : '');
      s.dataset.idx = idx;
      if (!(r === 1 && c === 1)) s.onclick = () => {
        const next = state.slice(); next[idx] = paint;
        guide.on = false;
        setState(next);
      };
      el.appendChild(s);
    }
    net.appendChild(el);
  }
}
function renderNet() {
  document.querySelectorAll('#net .s').forEach((s) => { s.style.background = C.COLOR_HEX[state[+s.dataset.idx]]; });
  const err = C.validate(state);
  const v = $('validity');
  v.textContent = err ? err : 'Couleurs valides : tu peux lancer le guide.';
  v.className = 'validity ' + (err ? 'bad' : 'ok');
}

function buildPad() {
  const pad = $('pad');
  for (const f of ['U', 'L', 'F', 'R', 'B', 'D']) for (const p of ['', "'"]) {
    const b = document.createElement('button');
    b.innerHTML = `${f}${p}<i style="background:${C.COLOR_HEX[C.CENTER_COLOR[f]]}"></i>`;
    b.title = `${FACE_FR[f]} (${C.COLOR_NAME[C.CENTER_COLOR[f]]})`;
    b.onclick = () => onMove(f + p);
    pad.appendChild(b);
  }
}

// ---------- Bluetooth ----------
const connectLabel = () => (window.innerWidth < 520 ? 'Connecter' : 'Connecter mon cube');
const cube = new SmartCube();
function setStatus(text, on) { const s = $('status'); s.textContent = text; s.classList.toggle('on', !!on); }
cube.addEventListener('connected', (e) => { setStatus('Connecté', true); $('btn-connect').textContent = 'Déconnecter'; toast(`${e.detail.name} connecté`); });
cube.addEventListener('disconnected', () => { setStatus('Non connecté'); $('btn-connect').textContent = connectLabel(); toast('Cube déconnecté'); });
cube.addEventListener('battery', (e) => setStatus(`Connecté · ${e.detail.level} %`, true));
cube.addEventListener('move', (e) => onMove(C.nativeMoveToLogical(e.detail.move)));
cube.addEventListener('state', (e) => {
  const next = C.stateFromNativeFacelets(e.detail.facelets);
  if (next.join('') !== state.join('')) {
    setState(next);
    toast('État du cube synchronisé');
  }
});

$('btn-connect').onclick = async () => {
  if (cube.connected) { cube.disconnect(); return; }
  if (!bluetoothAvailable()) {
    toast('Bluetooth indisponible dans ce navigateur. Utilise Chrome ou Edge (ordinateur, Android) ou l’appli Bluefy sur iPhone.', 6000);
    return;
  }
  try { setStatus('Connexion…'); await cube.connect(); }
  catch (e) { setStatus('Non connecté'); if (e.name !== 'NotFoundError') toast('Connexion impossible : ' + e.message, 5000); }
};
$('btn-read').onclick = () => {
  if (!cube.connected) { toast('Connecte d’abord ton cube.'); return; }
  cube.requestState();
};

// ---------- Boutons ----------
$('btn-guide').onclick = () => startGuide();
$('btn-next').onclick = () => { if (guide.on && guide.pending.length) onMove(guide.pending[0]); };
$('btn-solved').onclick = () => { guide.on = false; setState(C.solvedState()); };
$('btn-random').onclick = () => {
  const faces = 'URFDLB'; let alg = []; let last = '';
  while (alg.length < 20) {
    const f = faces[Math.floor(Math.random() * 6)];
    if (f === last) continue; last = f;
    alg.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
  }
  $('scramble').value = alg.join(' ');
  guide.on = false;
  setState(C.applyAlg(C.solvedState(), C.nativeAlgToLogical(alg.join(' '))));
  toast('Mélange appliqué au cube virtuel (notation officielle : blanc en haut, vert devant).', 4000);
};
$('btn-scramble').onclick = () => {
  try {
    const alg = $('scramble').value.replace(/[’`]/g, "'");
    guide.on = false;
    setState(C.applyAlg(C.solvedState(), C.nativeAlgToLogical(alg)));
  } catch (e) { toast(e.message); }
};
document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + t.dataset.tab));
});
const embedUrl = location.origin + location.pathname + '?embed=1';
$('embed-code').value = `<iframe src="${embedUrl}" width="100%" height="900" style="border:0;border-radius:12px" allow="bluetooth" title="Cube Coach"></iframe>`;
$('btn-copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('embed-code').value); toast('Code copié'); }
  catch { $('embed-code').select(); }
};

// Raccourcis clavier (u, U pour U') pour tester sans cube.
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const f = e.key.toUpperCase();
  if (!'URFDLB'.includes(f) || f.length !== 1) return;
  const disp = f + (e.shiftKey ? "'" : '');
  const i = S.RING.indexOf(f);
  onMove((i < 0 ? f : S.RING[(i + currentView) % 4]) + disp.slice(1));
});

buildEditor();
buildPad();
$('btn-connect').textContent = connectLabel();
setView(0);
renderNet();
renderGuide();
window.__cubeCoach = { get state() { return state; }, onMove, startGuide, guide };
