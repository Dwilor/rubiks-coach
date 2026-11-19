// Méthode débutant (couche par couche) en 7 étapes, calculée depuis n'importe quel état.
// Tous les mouvements renvoyés sont des quarts de tour dans le repère logique
// (jaune en haut, vert devant).
import * as C from './cube.js';

export const RING = ['F', 'R', 'B', 'L'];

export const STAGES = [
  { id: 'cross', name: 'Croix blanche', goal: 'Forme une croix blanche sur la face du dessous. Chaque arête blanche doit aussi correspondre au centre de sa face latérale.' },
  { id: 'corners', name: 'Coins blancs', goal: 'Place les 4 coins blancs : la face blanche et la première couronne sont terminées.' },
  { id: 'middle', name: 'Deuxième couronne', goal: 'Insère les 4 arêtes sans jaune dans la couronne du milieu.' },
  { id: 'ycross', name: 'Croix jaune', goal: 'Oriente les arêtes du dessus pour former une croix jaune.' },
  { id: 'yedges', name: 'Arêtes jaunes', goal: 'Permute les arêtes du dessus pour qu’elles correspondent aux centres.' },
  { id: 'ycornpos', name: 'Placer les coins jaunes', goal: 'Mets chaque coin jaune à sa place, même s’il est mal tourné.' },
  { id: 'ycornor', name: 'Orienter les coins jaunes', goal: 'Tourne les coins jaunes un par un pour finir le cube.' },
];

// Vue k : le cube a été tourné k fois (rotation y) ; la face affichée devant est RING[k].
export function toLogical(alg, k) {
  return C.expand(alg).map((m) => {
    const i = RING.indexOf(m[0]);
    return (i < 0 ? m[0] : RING[(i + k) % 4]) + m.slice(1);
  });
}
export function toDisplay(m, k) {
  const i = RING.indexOf(m[0]);
  return (i < 0 ? m[0] : RING[(i - k + 4) % 4]) + m.slice(1);
}
function viewForFR(x, z) {
  for (let k = 0; k < 4; k++) {
    const f = C.NORMALS[RING[k]], r = C.NORMALS[RING[(k + 1) % 4]];
    if (f[0] + r[0] === x && f[2] + r[2] === z) return k;
  }
  throw new Error('vue introuvable');
}
const U_TURNS = ['', 'U', 'U2', "U'"];
const UP = [0, 1, 0];
const samePos = (a, b) => a && b && a.every((v, i) => v === b[i]);
const COLORS_FR = { W: 'blanc', Y: 'jaune', G: 'vert', B: 'bleu', R: 'rouge', O: 'orange' };
const pieceName = (cols) => cols.map((c) => COLORS_FR[c]).join('-');

class Planner {
  constructor(state) { this.state = state.slice(); this.steps = []; }
  push(stage, title, detail, k, alg) {
    const moves = toLogical(alg, k);
    if (!moves.length) return;
    this.state = C.applyAlg(this.state, moves);
    this.steps.push({ stage, title, detail, view: k, alg, moves });
  }
}

// ---------- Étape 1 : croix blanche (recherche IDA*) ----------
const MOVES18 = [];
for (const f of C.FACES) for (const t of ['', '2', "'"]) MOVES18.push(f + t);
const PERM18 = MOVES18.map((m) => {
  const q = C.expand(m);
  return C.STICKERS.map((_, i) => q.reduce((idx, mm) => C.PERM[mm][idx], i));
});
const CROSS_EDGES = ['G', 'O', 'B', 'R'].map((c) => ['W', c]);
const homeWhite = (cols) => C.stickerIndex(C.homeOf(cols), C.NORMALS.D);
const DIST = new Map();
function distTable(h) {
  if (DIST.has(h)) return DIST.get(h);
  const d = new Array(54).fill(Infinity); d[h] = 0; let frontier = [h];
  while (frontier.length) {
    const next = [];
    for (const i of frontier) for (const P of PERM18) { const j = P[i]; if (d[j] === Infinity) { d[j] = d[i] + 1; next.push(j); } }
    frontier = next;
  }
  DIST.set(h, d); return d;
}
function whiteIndex(state, cols) {
  const pos = C.findPiece(state, cols);
  return C.posStickers(pos).find((i) => state[i] === 'W');
}
function crossSearch(state, targets) {
  const homes = targets.map(homeWhite);
  const tables = homes.map(distTable);
  const start = targets.map((t) => whiteIndex(state, t));
  const h = (cur) => Math.max(...cur.map((v, i) => tables[i][v]));
  const path = [];
  const dfs = (cur, g, bound, lastFace) => {
    const f = g + h(cur);
    if (f > bound) return f;
    if (cur.every((v, i) => v === homes[i])) return true;
    let min = Infinity;
    for (let m = 0; m < 18; m++) {
      const face = MOVES18[m][0];
      if (face === lastFace) continue;
      const nxt = cur.map((v) => PERM18[m][v]);
      path.push(MOVES18[m]);
      const r = dfs(nxt, g + 1, bound, face);
      if (r === true) return true;
      path.pop();
      if (r < min) min = r;
    }
    return min;
  };
  let bound = h(start);
  for (let it = 0; it < 12; it++) {
    const r = dfs(start, 0, bound, null);
    if (r === true) return path.slice();
    bound = r;
  }
  return null;
}
function solveCross(P) {
  for (let n = 0; n < 4; n++) {
    const solved = CROSS_EDGES.filter((e) => C.pieceSolved(P.state, e));
    const todo = CROSS_EDGES.filter((e) => !C.pieceSolved(P.state, e));
    if (!todo.length) return;
    let best = null;
    for (const e of todo) {
      const sol = crossSearch(P.state, [...solved, e]);
      if (sol && (!best || sol.length < best.sol.length)) best = { e, sol };
    }
    if (!best) throw new Error('croix impossible');
    P.push(0, `Arête ${pieceName(best.e)}`, `Amène l’arête ${pieceName(best.e)} en bas, sous le centre ${COLORS_FR[best.e[1]]}, blanc vers le bas.`, 0, best.sol.join(' '));
  }
}

// ---------- Étape 2 : coins blancs ----------
const WHITE_CORNERS = [['W', 'G', 'O'], ['W', 'O', 'B'], ['W', 'B', 'R'], ['W', 'R', 'G']];
const SEXY = "R U R' U'";
function solveCorners(P) {
  // On traite d'abord les coins déjà dans la couronne du haut.
  for (let n = 0; n < 4; n++) {
    const todo = WHITE_CORNERS.filter((c) => !C.pieceSolved(P.state, c));
    if (!todo.length) return;
    todo.sort((a, b) => C.findPiece(P.state, b)[1] - C.findPiece(P.state, a)[1]);
    const c = todo[0];
    const name = pieceName(c);
    let pos = C.findPiece(P.state, c);
    if (pos[1] === -1) {
      P.push(1, `Sortir le coin ${name}`, `Ce coin est en bas mais mal placé. Tiens-le devant à droite et fais ${SEXY} une fois pour le remonter.`, viewForFR(pos[0], pos[2]), SEXY);
      pos = C.findPiece(P.state, c);
    }
    const home = C.homeOf(c);
    const kt = viewForFR(home[0], home[2]);
    for (const u of U_TURNS) {
      const s = C.applyAlg(P.state, u);
      if (samePos(C.findPiece(s, c), [home[0], 1, home[2]])) {
        P.push(1, `Placer le coin ${name}`, 'Tourne la face du dessus pour mettre le coin juste au-dessus de sa place (devant à droite).', kt, u);
        break;
      }
    }
    let reps = 0, s = P.state;
    const sexyK = toLogical(SEXY, kt);
    while (!C.pieceSolved(s, c) && reps < 6) { s = C.applyAlg(s, sexyK); reps++; }
    if (!C.pieceSolved(s, c)) throw new Error('coin impossible');
    P.push(1, `Insérer le coin ${name}`, `Répète ${SEXY} ${reps} fois jusqu’à ce que le coin soit bien placé, blanc vers le bas.`, kt, Array(reps).fill(SEXY).join(' '));
  }
}

// ---------- Étape 3 : deuxième couronne ----------
const MIDDLE_EDGES = [['G', 'O'], ['O', 'B'], ['B', 'R'], ['R', 'G']];
const RIGHT_ALG = "U R U' R' U' F' U F";
const LEFT_ALG = "U' L' U L U F U' F'";
function solveMiddle(P) {
  for (let n = 0; n < 8; n++) {
    const todo = MIDDLE_EDGES.filter((e) => !C.pieceSolved(P.state, e));
    if (!todo.length) return;
    // Priorité aux arêtes déjà en haut.
    const top = todo.filter((e) => C.findPiece(P.state, e)[1] === 1);
    const e = top[0] || todo[0];
    const name = pieceName(e);
    let pos = C.findPiece(P.state, e);
    if (pos[1] === 0) {
      P.push(2, `Sortir l’arête ${name}`, 'Cette arête est dans la couronne du milieu mais mal placée. Tiens-la devant à droite et applique la formule de droite pour la remonter.', viewForFR(pos[0], pos[2]), RIGHT_ALG);
      continue;
    }
    for (const u of U_TURNS) {
      const s = C.applyAlg(P.state, u);
      const p = C.findPiece(s, e);
      const side = C.colorAt(s, p, [p[0], 0, p[2]]);
      const face = C.COLOR_FACE[side];
      const n2 = C.NORMALS[face];
      if (n2[0] === p[0] && n2[2] === p[2]) {
        const k = RING.indexOf(face);
        P.push(2, `Aligner l’arête ${name}`, `Tourne le dessus pour que l’arête forme un « T » avec le centre ${COLORS_FR[side]}.`, k, u);
        const top2 = C.colorAt(P.state, C.findPiece(P.state, e), UP);
        const right = top2 === C.CENTER_COLOR[RING[(k + 1) % 4]];
        P.push(2, `Insérer l’arête ${name} à ${right ? 'droite' : 'gauche'}`, `Face ${COLORS_FR[side]} devant, applique la formule ${right ? 'de droite' : 'de gauche'}.`, k, right ? RIGHT_ALG : LEFT_ALG);
        break;
      }
    }
  }
  if (MIDDLE_EDGES.some((e) => !C.pieceSolved(P.state, e))) throw new Error('couronne impossible');
}

// ---------- Étape 4 : croix jaune ----------
const OLL_EDGE = "F R U R' U' F'";
const topEdgePos = (f) => { const n = C.NORMALS[f]; return [n[0], 1, n[2]]; };
const yellowUp = (s, f) => C.colorAt(s, topEdgePos(f), UP) === 'Y';
function solveYCross(P) {
  for (let it = 0; it < 4; it++) {
    const up = RING.filter((f) => yellowUp(P.state, f));
    if (up.length === 4) return;
    if (up.length === 0) { P.push(3, 'Croix jaune : le point', `Aucune arête jaune n’est orientée. Applique ${OLL_EDGE}.`, 0, OLL_EDGE); continue; }
    let done = false;
    for (let k = 0; k < 4 && !done; k++) {
      const R = RING[(k + 1) % 4], L = RING[(k + 3) % 4], B = RING[(k + 2) % 4];
      if (yellowUp(P.state, R) && yellowUp(P.state, L)) { P.push(3, 'Croix jaune : la ligne', `Tiens la ligne jaune à l’horizontale et applique ${OLL_EDGE}.`, k, OLL_EDGE); done = true; }
    }
    for (let k = 0; k < 4 && !done; k++) {
      const L = RING[(k + 3) % 4], B = RING[(k + 2) % 4];
      if (yellowUp(P.state, B) && yellowUp(P.state, L)) { P.push(3, 'Croix jaune : le « L »', `Tiens le « L » jaune en haut à gauche (derrière et à gauche) et applique ${OLL_EDGE}.`, k, OLL_EDGE); done = true; }
    }
    if (!done) throw new Error('croix jaune impossible');
  }
  if (RING.some((f) => !yellowUp(P.state, f))) throw new Error('croix jaune impossible');
}

// ---------- Recherche par blocs de formules (étapes 5 et 6) ----------
function macroSearch(state, macros, goal, maxDepth) {
  const path = [];
  const dfs = (s, d) => {
    if (goal(s)) return true;
    if (d === 0) return false;
    for (let i = 0; i < macros.length; i++) {
      if (path.length && macros[path[path.length - 1]].group === 'U' && macros[i].group === 'U') continue;
      path.push(i);
      if (dfs(C.applyAlg(s, macros[i].moves), d - 1)) return true;
      path.pop();
    }
    return false;
  };
  for (let d = 0; d <= maxDepth; d++) if (dfs(state, d)) return path.map((i) => macros[i]);
  return null;
}
const lowerSolved = (s) => C.STICKERS.every((st, i) => st.pos[1] === 1 || s[i] === C.CENTER_COLOR[st.face]);
const TOP_EDGES = RING.map((f) => ['Y', C.CENTER_COLOR[f]]);
const TOP_CORNERS = RING.map((f, i) => ['Y', C.CENTER_COLOR[f], C.CENTER_COLOR[RING[(i + 1) % 4]]]);

const SUNE = "R U R' U R U2 R' U";
function solveYEdges(P) {
  const goal = (s) => lowerSolved(s) && TOP_EDGES.every((e) => C.pieceSolved(s, e));
  if (goal(P.state)) return;
  const macros = [
    ...['U', 'U2', "U'"].map((u) => ({ group: 'U', k: 0, alg: u, moves: C.expand(u) })),
    ...[0, 1, 2, 3].map((k) => ({ group: 'A', k, alg: SUNE, moves: toLogical(SUNE, k) })),
  ];
  const sol = macroSearch(P.state, macros, goal, 5);
  if (!sol) throw new Error('arêtes jaunes impossibles');
  for (const m of sol) {
    if (m.group === 'U') P.push(4, 'Tourner le dessus', 'Tourne la face jaune pour aligner un maximum d’arêtes avec leurs centres.', 0, m.alg);
    else P.push(4, 'Permuter les arêtes jaunes', `Tiens le cube comme indiqué et applique ${SUNE}.`, m.k, m.alg);
  }
}

const NIKLAS = "U R U' L' U R' U' L";
function solveYCornersPos(P) {
  const goal = (s) => lowerSolved(s) && TOP_EDGES.every((e) => C.pieceSolved(s, e))
    && TOP_CORNERS.every((c) => samePos(C.findPiece(s, c), C.homeOf(c)));
  if (goal(P.state)) return;
  const macros = [0, 1, 2, 3].map((k) => ({ group: 'A', k, alg: NIKLAS, moves: toLogical(NIKLAS, k) }));
  const sol = macroSearch(P.state, macros, goal, 3);
  if (!sol) throw new Error('coins jaunes impossibles');
  for (const m of sol) P.push(5, 'Placer les coins jaunes', `Garde le coin bien placé devant à droite et applique ${NIKLAS}.`, m.k, m.alg);
}

const TWIST = "R' D' R D";
function solveYCornersOr(P) {
  const ufr = [1, 1, 1];
  const ok = (s, p) => C.colorAt(s, p, UP) === 'Y';
  const corners = () => [[1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1]];
  if (!corners().every((p) => ok(P.state, p))) {
    let started = false;
    for (let n = 0; n < 4; n++) {
      if (corners().every((p) => ok(P.state, p))) break;
      // Amener un coin mal orienté devant à droite (seulement avec U).
      for (const u of U_TURNS) {
        const s = C.applyAlg(P.state, u);
        if (!ok(s, ufr)) {
          if (u) P.push(6, 'Coin suivant', started ? 'Tourne uniquement la face du dessus pour amener le prochain coin mal orienté devant à droite. Ne tourne pas le cube.' : 'Amène un coin mal orienté devant à droite.', 0, u);
          break;
        }
      }
      let reps = 0; let s = P.state;
      while (!ok(s, ufr) && reps < 3) { s = C.applyAlg(s, TWIST + ' ' + TWIST); reps++; }
      P.push(6, 'Orienter le coin', `Répète ${TWIST} jusqu’à ce que le jaune du coin devant à droite soit en haut (ici ${reps * 2} fois). Le bas du cube semble se mélanger : c’est normal.`, 0, Array(reps * 2).fill(TWIST).join(' '));
      started = true;
    }
  }
  for (const u of U_TURNS) {
    if (C.isSolved(C.applyAlg(P.state, u))) {
      if (u) P.push(6, 'Dernier alignement', 'Tourne le dessus pour terminer le cube.', 0, u);
      return;
    }
  }
  throw new Error('fin impossible');
}

const SOLVERS = [solveCross, solveCorners, solveMiddle, solveYCross, solveYEdges, solveYCornersPos, solveYCornersOr];

export function buildPlan(state) {
  const P = new Planner(state);
  for (const f of SOLVERS) f(P);
  if (!C.isSolved(P.state)) throw new Error('plan incomplet');
  return P.steps;
}

// Étape courante d'un état (pour l'affichage de la progression).
export function currentStage(state) {
  if (C.isSolved(state)) return STAGES.length;
  if (!CROSS_EDGES.every((e) => C.pieceSolved(state, e))) return 0;
  if (!WHITE_CORNERS.every((c) => C.pieceSolved(state, c))) return 1;
  if (!MIDDLE_EDGES.every((e) => C.pieceSolved(state, e))) return 2;
  if (!RING.every((f) => yellowUp(state, f))) return 3;
  if (!TOP_EDGES.every((e) => C.pieceSolved(state, e))) return 4;
  if (!TOP_CORNERS.every((c) => samePos(C.findPiece(state, c), C.homeOf(c)))) return 5;
  return 6;
}
