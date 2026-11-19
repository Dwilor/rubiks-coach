import * as THREE from '../vendor/three.module.min.js';
import * as C from './cube.js';

const STICKER_OFFSET = 0.492;

function roundedSquare(size, r) {
  const s = size / 2, sh = new THREE.Shape();
  sh.moveTo(-s + r, -s); sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r);
  sh.lineTo(s, s - r); sh.quadraticCurveTo(s, s, s - r, s); sh.lineTo(-s + r, s);
  sh.quadraticCurveTo(-s, s, -s, s - r); sh.lineTo(-s, -s + r); sh.quadraticCurveTo(-s, -s, -s + r, -s);
  return new THREE.ShapeGeometry(sh, 6);
}

export class CubeView {
  constructor(container) {
    this.container = container;
    this.colors = C.solvedState();
    this.queue = [];
    this.anim = null;
    this.viewRot = 0; this.viewTarget = 0;
    this.dragX = 0.5; this.dragY = -0.62;
    this.highlightFace = null; this.arrowMove = null;

    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0, 11);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(3, 6, 8); this.scene.add(dl);

    this.tilt = new THREE.Group(); this.spin = new THREE.Group(); this.cube = new THREE.Group();
    this.scene.add(this.tilt); this.tilt.add(this.spin); this.spin.add(this.cube);
    this.pivot = new THREE.Group(); this.cube.add(this.pivot);

    const body = new THREE.BoxGeometry(0.97, 0.97, 0.97);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
    const stickerGeo = roundedSquare(0.84, 0.12);
    this.cubies = new Map();
    this.stickers = [];
    const all = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) all.push([x, y, z]);
    for (const p of all) {
      const g = new THREE.Group(); g.position.set(...p); g.userData.home = p.slice();
      g.add(new THREE.Mesh(body, bodyMat));
      this.cube.add(g); this.cubies.set(p.join(','), g);
    }
    C.STICKERS.forEach((s, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: 0x000000 });
      const m = new THREE.Mesh(stickerGeo, mat);
      const n = new THREE.Vector3(...s.normal);
      m.position.copy(n).multiplyScalar(STICKER_OFFSET);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      this.cubies.get(s.pos.join(',')).add(m);
      this.stickers[i] = m;
    });
    // centre noir pour combler l'intérieur
    this.cube.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 1.9), bodyMat));

    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    this.hintGroup = new THREE.Group();
    this.cube.add(this.hintGroup);
    this.hints = [];

    this.recolor();
    this.bindDrag();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.frame());
  }

  // Flèche courbe (sur la face qui tourne), dessinée dans le sens anti-horaire autour de +z.
  makeCurved() {
    const g = new THREE.Group();
    const arc = 1.5 * Math.PI, r = 0.95;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 10, 60, arc), this.arrowMat);
    torus.rotation.z = Math.PI / 4;
    g.add(torus);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.44, 20), this.arrowMat);
    const te = arc + Math.PI / 4;
    cone.position.set(r * Math.cos(te), r * Math.sin(te), 0);
    cone.rotation.z = te;
    g.add(cone);
    return g;
  }

  // Flèche droite plate pointant vers +x, dans le plan XY.
  makeStraight() {
    const L = 2.5, w = 0.09, hw = 0.26, hl = 0.5;
    const sh = new THREE.Shape();
    sh.moveTo(-L / 2, -w); sh.lineTo(L / 2 - hl, -w); sh.lineTo(L / 2 - hl, -hw); sh.lineTo(L / 2, 0);
    sh.lineTo(L / 2 - hl, hw); sh.lineTo(L / 2 - hl, w); sh.lineTo(-L / 2, w); sh.closePath();
    return new THREE.Mesh(new THREE.ShapeGeometry(sh), this.arrowMat);
  }

  bindDrag() {
    const el = this.renderer.domElement;
    let last = null;
    el.addEventListener('pointerdown', (e) => { last = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!last) return;
      this.dragY += (e.clientX - last[0]) * 0.01;
      this.dragX = Math.max(-1.4, Math.min(1.4, this.dragX + (e.clientY - last[1]) * 0.01));
      last = [e.clientX, e.clientY];
    });
    const up = () => { last = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', () => this.resetCamera());
  }
  resetCamera() { this.dragX = 0.5; this.dragY = -0.62; }

  resize() {
    const w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.position.z = w < h ? 11 * (h / w) * 0.85 : 11;
    this.camera.updateProjectionMatrix();
  }

  recolor() {
    this.stickers.forEach((m, i) => m.material.color.set(C.COLOR_HEX[this.colors[i]]));
  }

  setState(colors) {
    this.queue = [];
    if (this.anim) this.finishAnim();
    this.colors = colors.slice();
    this.recolor();
  }

  enqueue(move) { this.queue.push(move); }

  setView(k) {
    // chemin le plus court vers la nouvelle vue
    let target = -k * Math.PI / 2;
    const cur = this.viewTarget;
    while (target - cur > Math.PI) target -= 2 * Math.PI;
    while (target - cur < -Math.PI) target += 2 * Math.PI;
    this.viewTarget = target;
  }

  // Met en évidence la face à tourner : flèche courbe sur la face, flèches droites
  // sur les rangées des faces voisines (utile quand la face est cachée).
  setHint(move) {
    this.arrowMove = move;
    this.stickers.forEach((m) => m.material.emissive.set(0x000000));
    for (const h of this.hints) this.hintGroup.remove(h.obj);
    this.hints = [];
    if (!move) return;
    const n = new THREE.Vector3(...C.NORMALS[move[0]]);
    const omega = n.clone().multiplyScalar(move.endsWith("'") ? 1 : -1);
    const curved = this.makeCurved();
    curved.position.copy(n).multiplyScalar(1.56);
    curved.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    curved.scale.x = move.endsWith("'") ? 1 : -1;
    this.hintGroup.add(curved);
    this.hints.push({ obj: curved, face: n.clone() });
    for (const f of C.FACES) {
      const V = new THREE.Vector3(...C.NORMALS[f]);
      if (Math.abs(V.dot(n)) > 0.5) continue;
      const mid = n.clone().add(V);
      const d = new THREE.Vector3().crossVectors(omega, mid).normalize();
      const a = this.makeStraight();
      const z = V.clone(), x = d.clone(), y = new THREE.Vector3().crossVectors(z, x);
      a.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      a.position.copy(n).add(V.clone().multiplyScalar(1.53));
      this.hintGroup.add(a);
      this.hints.push({ obj: a, face: V });
    }
  }

  startAnim(move) {
    const n = C.NORMALS[move[0]];
    const axis = new THREE.Vector3(...n);
    const angle = (move.endsWith("'") ? 1 : -1) * Math.PI / 2;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.updateMatrixWorld();
    const layer = [...this.cubies.values()].filter((g) => {
      const p = g.userData.home; return p[0] * n[0] + p[1] * n[1] + p[2] * n[2] === 1;
    });
    for (const g of layer) this.pivot.attach(g);
    this.hintGroup.visible = false;
    const q = this.queue.length;
    this.anim = { move, axis, angle, layer, t: 0, dur: q > 8 ? 0.02 : q > 1 ? 0.08 : 0.18 };
  }

  finishAnim() {
    const { move, layer } = this.anim;
    for (const g of layer) {
      this.cube.add(g);
      g.position.set(...g.userData.home);
      g.rotation.set(0, 0, 0);
    }
    this.pivot.rotation.set(0, 0, 0);
    this.colors = C.applyMove(this.colors, move);
    this.recolor();
    this.anim = null;
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.anim && this.queue.length) this.startAnim(this.queue.shift());
    if (this.anim) {
      const a = this.anim;
      a.t += dt / a.dur;
      const t = Math.min(a.t, 1);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.pivot.quaternion.setFromAxisAngle(a.axis, a.angle * e);
      if (t >= 1) this.finishAnim();
    }
    this.viewRot += (this.viewTarget - this.viewRot) * Math.min(1, dt * 8);
    this.spin.rotation.y = this.viewRot + this.dragY;
    this.tilt.rotation.x = this.dragX;
    if (this.arrowMove && !this.anim && !this.queue.length) {
      this.hintGroup.visible = true;
      const cam = this.cube.worldToLocal(this.camera.position.clone()).normalize();
      for (const h of this.hints) h.obj.visible = h.face.dot(cam) > 0.22;
      this.arrowMat.opacity = 0.7 + 0.3 * Math.sin(performance.now() / 180);
      const n = C.NORMALS[this.arrowMove[0]];
      const glow = 0.16 + 0.1 * Math.sin(performance.now() / 180);
      this.stickers.forEach((m, i) => {
        const st = C.STICKERS[i];
        const onFace = st.pos[0] * n[0] + st.pos[1] * n[1] + st.pos[2] * n[2] === 1;
        m.material.emissive.setScalar(onFace ? glow : 0);
      });
    } else {
      this.hintGroup.visible = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
