// Connexion Bluetooth au Rubik's Connected / Connected X (protocole GoCube, Particula).
// Protocole repris de csTimer (src/js/hardware/gocube.js).
const SUFFIX = '-b5a3-f393-e0a9-e50e24dcca9e';
const SERVICE = '6e400001' + SUFFIX;
const CH_WRITE = '6e400002' + SUFFIX;
const CH_READ = '6e400003' + SUFFIX;
const CMD_BATTERY = 0x32;
const CMD_STATE = 0x33;

// Ordre des faces dans les messages du cube.
const AXIS_PERM = [5, 2, 0, 3, 1, 4]; // -> index dans "URFDLB"
const FACE_PERM = [0, 1, 2, 5, 8, 7, 6, 3];
const FACE_OFFSET = [0, 0, 6, 2, 0, 0];

export const bluetoothAvailable = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);

export class SmartCube extends EventTarget {
  constructor() { super(); this.device = null; this.write = null; this.read = null; }

  async connect() {
    if (!bluetoothAvailable()) throw new Error('Ce navigateur ne gère pas le Bluetooth web.');
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Rubiks' }, { namePrefix: 'GoCube' }],
      optionalServices: [SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', () => this.emit('disconnected'));
    const gatt = await this.device.gatt.connect();
    const service = await gatt.getPrimaryService(SERVICE);
    this.write = await service.getCharacteristic(CH_WRITE);
    this.read = await service.getCharacteristic(CH_READ);
    await this.read.startNotifications();
    this.read.addEventListener('characteristicvaluechanged', (e) => this.parse(e.target.value));
    this.emit('connected', { name: this.device.name });
    await this.requestState();
    setTimeout(() => this.requestBattery().catch(() => {}), 800);
  }

  async disconnect() {
    if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
  }

  get connected() { return !!(this.device && this.device.gatt.connected); }

  async send(cmd) { if (this.write) await this.write.writeValue(new Uint8Array([cmd]).buffer); }
  requestState() { return this.send(CMD_STATE); }
  requestBattery() { return this.send(CMD_BATTERY); }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  parse(v) {
    if (v.byteLength < 4) return;
    if (v.getUint8(0) !== 0x2a || v.getUint8(v.byteLength - 2) !== 0x0d || v.getUint8(v.byteLength - 1) !== 0x0a) return;
    const type = v.getUint8(2);
    const len = v.byteLength - 6;
    if (type === 1) {
      for (let i = 0; i < len; i += 2) {
        const b = v.getUint8(3 + i);
        const face = 'URFDLB'[AXIS_PERM[b >> 1]];
        // Mouvement en notation officielle (blanc en haut, vert devant).
        this.emit('move', { move: face + ((b & 1) ? "'" : '') });
      }
    } else if (type === 2) {
      const f = [];
      for (let a = 0; a < 6; a++) {
        const axis = AXIS_PERM[a] * 9;
        const off = FACE_OFFSET[a];
        f[axis + 4] = 'BFUDRL'[v.getUint8(3 + a * 9)];
        for (let i = 0; i < 8; i++) f[axis + FACE_PERM[(i + off) % 8]] = 'BFUDRL'[v.getUint8(3 + a * 9 + i + 1)];
      }
      this.emit('state', { facelets: f.join('') });
    } else if (type === 5) {
      this.emit('battery', { level: v.getUint8(3) });
    }
  }
}
