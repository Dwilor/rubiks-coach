// Modèle de cube 3x3 basé sur 54 stickers.
// Repère "logique" de l'appli : jaune en haut (U), blanc en bas (D), vert devant (F),
// orange à droite (R), rouge à gauche (L), bleu derrière (B).
// Axes : x vers R, y vers U, z vers F.

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const NORMALS = {
  U: [0, 1, 0], D: [0, -1, 0],
  R: [1, 0, 0], L: [-1, 0, 0],
  F: [0, 0, 1], B: [0, 0, -1],
};
// Couleur du centre de chaque face logique.
export const CENTER_COLOR = { U: 'Y', D: 'W', F: 'G', B: 'B', R: 'O', L: 'R' };
export const COLOR_FACE = Object.fromEntries(Object.entries(CENTER_COLOR).map(([f, c]) => [c, f]));
export const COLOR_HEX = {
  W: '#f4f4f4', Y: '#ffd500', G: '#009b48', B: '#0046ad', R: '#c41e3a', O: '#ff6a13',
};
export const COLOR_NAME = {
  W: 'blanche', Y: 'jaune', G: 'verte', B: 'bleue', R: 'rouge', O: 'orange',
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const key = (p, n) => p.join(',') + '|' + n.join(',');

// Rotation de 90° dans le sens horaire vu depuis l'extérieur de la face de normale a.
function rotCW(v, a) {
  const d = dot(a, v);
  const c = cross(a, v);
  return [d * a[0] - c[0], d * a[1] - c[1], d * a[2] - c[2]].map((x) => x + 0); // +0 évite -0
}

// Construction des 54 stickers.
export const STICKERS = [];
const INDEX = new Map();
for (const f of FACES) {
  const n = NORMALS[f];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const p = [x, y, z];
    if (dot(p, n) !== 1) continue;
    INDEX.set(key(p, n), STICKERS.length);
    STICKERS.push({ pos: p, normal: n, face: f });
  }
}
export const stickerIndex = (p, n) => INDEX.get(key(p, n));

// Permutations des 12 quarts de tour : PERM[move][i] = nouvel index du sticker i.
export const QUARTER_MOVES = [];
export const PERM = {};
for (const f of FACES) {
  for (const prime of [false, true]) {
    const m = f + (prime ? "'" : '');
    QUARTER_MOVES.push(m);
    const n = NORMALS[f];
    PERM[m] = STICKERS.map((s, i) => {
      if (dot(s.pos, n) !== 1) return i;
      let p = s.pos, nn = s.normal;
      const times = prime ? 3 : 1;
      for (let t = 0; t < times; t++) { p = rotCW(p, n); nn = rotCW(nn, n); }
      return INDEX.get(key(p, nn));
    });
  }
}

export function solvedState() {
  return STICKERS.map((s) => CENTER_COLOR[s.face]);
}

export function applyMove(state, m) {
  const perm = PERM[m];
  const out = new Array(54);
  for (let i = 0; i < 54; i++) out[perm[i]] = state[i];
  return out;
}

// Accepte "R", "R'", "R2" ou une suite "R U R' U'".
export function expand(alg) {
  const res = [];
  for (const tok of (Array.isArray(alg) ? alg : alg.trim().split(/\s+/))) {
    if (!tok) continue;
    const f = tok[0];
    if (!NORMALS[f]) throw new Error('Mouvement inconnu : ' + tok);
    if (tok.endsWith('2')) res.push(f, f);
    else if (tok.endsWith("'")) res.push(f + "'");
    else res.push(f);
  }
  return res;
}

export function applyAlg(state, alg) {
  for (const m of expand(alg)) state = applyMove(state, m);
  return state;
}

export const inverse = (m) => (m.endsWith("'") ? m[0] : m + "'");

// Regroupe les quarts de tour consécutifs d'une même face (R R → R2, R R' → rien).
export function simplify(moves) {
  const out = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.face === m[0]) last.q = (last.q + (m.endsWith("'") ? 3 : 1)) % 4;
    else out.push({ face: m[0], q: m.endsWith("'") ? 3 : 1 });
    if (out[out.length - 1].q === 0) out.pop();
  }
  const res = [];
  for (const { face, q } of out) {
    if (q === 1) res.push(face);
    else if (q === 3) res.push(face + "'");
    else res.push(face, face);
  }
  return res;
}

export const isSolved = (state) => state.every((c, i) => c === CENTER_COLOR[STICKERS[i].face]);

// ----- Pièces -----
export const CUBIE_POSITIONS = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  const nz = (x !== 0) + (y !== 0) + (z !== 0);
  if (nz >= 2) CUBIE_POSITIONS.push([x, y, z]);
}
// Indices des stickers d'une position de pièce.
export function stickersAt(pos) {
  const res = [];
  STICKERS.forEach((s, i) => { if (s.pos.every((v, k) => v === pos[k])) res.push(i); });
  return res;
}
const POS_STICKERS = new Map(CUBIE_POSITIONS.map((p) => [p.join(','), stickersAt(p)]));
export const posStickers = (pos) => POS_STICKERS.get(pos.join(','));

// Trouve la position actuelle de la pièce dont les couleurs sont "colors".
export function findPiece(state, colors) {
  const want = [...colors].sort().join('');
  for (const p of CUBIE_POSITIONS) {
    const idx = posStickers(p);
    if (idx.length !== colors.length) continue;
    if (idx.map((i) => state[i]).sort().join('') === want) return p;
  }
  return null;
}
// Position d'origine d'une pièce (somme des normales des faces de ses couleurs).
export function homeOf(colors) {
  const p = [0, 0, 0];
  for (const c of colors) { const n = NORMALS[COLOR_FACE[c]]; p[0] += n[0]; p[1] += n[1]; p[2] += n[2]; }
  return p;
}
export function pieceSolved(state, colors) {
  return posStickers(homeOf(colors)).every((i) => state[i] === CENTER_COLOR[STICKERS[i].face]);
}
// Couleur du sticker d'une pièce orienté selon la normale n.
export function colorAt(state, pos, n) {
  return state[stickerIndex(pos, n)];
}

// ----- Conversion depuis la notation du cube Bluetooth -----
// Le cube (et la notation officielle des mélanges) utilise : blanc en haut, vert devant,
// rouge à droite. On passe au repère logique par une rotation z2.
const NATIVE_TO_LOGICAL_FACE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'F', B: 'B' };
const NATIVE_COLOR = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' };
export const nativeMoveToLogical = (m) => NATIVE_TO_LOGICAL_FACE[m[0]] + m.slice(1);
export function nativeAlgToLogical(alg) {
  return alg.trim().split(/\s+/).filter(Boolean).map(nativeMoveToLogical).join(' ');
}

// Position 3D (repère natif) du sticker k d'une face dans une chaîne de 54 facettes
// au format URFDLB (format Kociemba).
function nativeFaceletPos(face, k) {
  const r = Math.floor(k / 3), c = k % 3;
  switch (face) {
    case 'U': return { p: [c - 1, 1, r - 1], n: [0, 1, 0] };
    case 'R': return { p: [1, 1 - r, 1 - c], n: [1, 0, 0] };
    case 'F': return { p: [c - 1, 1 - r, 1], n: [0, 0, 1] };
    case 'D': return { p: [c - 1, -1, 1 - r], n: [0, -1, 0] };
    case 'L': return { p: [-1, 1 - r, c - 1], n: [-1, 0, 0] };
    case 'B': return { p: [1 - c, 1 - r, -1], n: [0, 0, -1] };
  }
}
const NATIVE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
const z2 = (v) => [-v[0] + 0, -v[1] + 0, v[2]];

// facelets : chaîne de 54 lettres URFDLB (couleurs exprimées par la face native).
export function stateFromNativeFacelets(facelets) {
  const st = new Array(54);
  for (let f = 0; f < 6; f++) for (let k = 0; k < 9; k++) {
    const { p, n } = nativeFaceletPos(NATIVE_ORDER[f], k);
    st[stickerIndex(z2(p), z2(n))] = NATIVE_COLOR[facelets[f * 9 + k]];
  }
  return st;
}
export function nativeFaceletsFromState(state) {
  const inv = Object.fromEntries(Object.entries(NATIVE_COLOR).map(([f, c]) => [c, f]));
  let s = '';
  for (let f = 0; f < 6; f++) for (let k = 0; k < 9; k++) {
    const { p, n } = nativeFaceletPos(NATIVE_ORDER[f], k);
    s += inv[state[stickerIndex(z2(p), z2(n))]];
  }
  return s;
}

// ----- Vérification d'un état saisi à la main -----
export function validate(state) {
  const counts = {};
  for (const c of state) counts[c] = (counts[c] || 0) + 1;
  for (const c of Object.keys(COLOR_HEX)) {
    if (counts[c] !== 9) return `Il faut 9 cases ${COLOR_NAME[c]}s (actuellement ${counts[c] || 0}).`;
  }
  for (const f of FACES) {
    const ci = stickerIndex(NORMALS[f], NORMALS[f]);
    if (state[ci] !== CENTER_COLOR[f]) return 'Les centres ne peuvent pas être modifiés.';
  }
  const corners = CUBIE_POSITIONS.filter((p) => p.every((v) => v !== 0));
  const edges = CUBIE_POSITIONS.filter((p) => p.filter((v) => v !== 0).length === 2);
  const opposite = { W: 'Y', Y: 'W', G: 'B', B: 'G', R: 'O', O: 'R' };
  // Pièces valides et uniques
  const seen = new Set();
  const cornerIds = [], edgeIds = [];
  for (const [list, ids, label] of [[corners, cornerIds, 'coin'], [edges, edgeIds, 'arête']]) {
    for (const p of list) {
      const cols = posStickers(p).map((i) => state[i]);
      const set = cols.slice().sort().join('');
      for (let a = 0; a < cols.length; a++) for (let b = a + 1; b < cols.length; b++) {
        if (cols[a] === cols[b] || opposite[cols[a]] === cols[b]) return `Un ${label} a des couleurs impossibles (${cols.map((c) => COLOR_NAME[c]).join(', ')}).`;
      }
      if (seen.has(set)) return `Le même ${label} apparaît deux fois.`;
      seen.add(set);
      ids.push(set);
    }
  }
  // Orientation des arêtes : sticker de référence (U/D sinon F/B)
  let flips = 0;
  for (const p of edges) {
    const idx = posStickers(p);
    const ref = idx.find((i) => STICKERS[i].normal[1] !== 0) ?? idx.find((i) => STICKERS[i].normal[2] !== 0);
    const cols = idx.map((i) => state[i]);
    const hasUD = cols.some((c) => c === 'Y' || c === 'W');
    const good = hasUD ? (state[ref] === 'Y' || state[ref] === 'W') : (state[ref] === 'G' || state[ref] === 'B');
    if (!good) flips++;
  }
  if (flips % 2) return 'Une arête est retournée : cet état est impossible sur un vrai cube.';
  // Orientation des coins : position du sticker jaune/blanc (sens défini par la chiralité)
  let twist = 0;
  for (const p of corners) {
    const idx = posStickers(p);
    const ud = idx.find((i) => state[i] === 'Y' || state[i] === 'W');
    const refIdx = idx.find((i) => STICKERS[i].normal[1] !== 0);
    if (ud === refIdx) continue;
    const s = dot(cross(STICKERS[refIdx].normal, STICKERS[ud].normal), p);
    twist += s < 0 ? 1 : 2;
  }
  if (twist % 3) return 'Un coin est tourné : cet état est impossible sur un vrai cube.';
  // Parité des permutations (coins vs arêtes)
  const perm = (list) => list.map((p) => {
    const set = posStickers(p).map((i) => state[i]);
    return list.findIndex((q) => homeKey(q) === set.slice().sort().join(''));
  });
  const homeKey = (q) => posStickers(q).map((i) => CENTER_COLOR[STICKERS[i].face]).sort().join('');
  const parity = (arr) => {
    let par = 0; const vis = new Array(arr.length).fill(false);
    for (let i = 0; i < arr.length; i++) {
      if (vis[i]) continue; let len = 0, j = i;
      while (!vis[j]) { vis[j] = true; j = arr[j]; len++; }
      par += len - 1;
    }
    return par % 2;
  };
  if (parity(perm(corners)) !== parity(perm(edges))) return 'Deux pièces sont échangées : cet état est impossible sur un vrai cube.';
  return null;
}
