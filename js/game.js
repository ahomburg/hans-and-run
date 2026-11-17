/* =====================================================================
   HANS & RUN — modernes Jump'n'Run
   Engine: Canvas 2D, Tile-Collision, Particles, Parallax, WebAudio, Touch
   ===================================================================== */
"use strict";

/* ---------- Konstanten ---------- */
const TILE = 48;
const ROWS = 18;
const VIEW_H = 740;                       // sichtbare Hoehe in Weltpunkten
const GROUND_TOP = 14;
const GRAV = 2600;
const JUMP_VEL = 980;
const STOMP_VEL = 580, STOMP_VEL_HELD = 820;

/* ---------- Utilities ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const TAU = Math.PI * 2;

/* =====================================================================
   AUDIO — Synth-Sounds + Chiptune-Loop
   ===================================================================== */
const AudioSys = {
  ctx: null, master: null, musicGain: null, muted: false,
  seqTimer: null, step: 0, nextTime: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.master);
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  tone(freq, dur, type = "square", vol = 0.25, when = 0, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(16, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(this.master);
    src.start(t);
  },
  sJump() { this.tone(280, .18, "square", .15, 0, 420); },
  sCoin() { this.tone(988, .07, "square", .13); this.tone(1319, .16, "square", .12, .07); },
  sStomp() { this.tone(220, .14, "triangle", .28, 0, -160); this.noise(.08, .16); },
  sPower() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .12, "square", .12, i * .06)); },
  sHurt() { this.tone(300, .35, "sawtooth", .18, 0, -220); this.noise(.15, .1); },
  sCheck() { [523, 659, 784].forEach((f, i) => this.tone(f, .22, "triangle", .15, i * .09)); },
  sWin() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, .3, "square", .13, i * .13)); },
  sDie() { [400, 320, 240, 160].forEach((f, i) => this.tone(f, .2, "square", .14, i * .12, -40)); },

  startMusic() {
    if (!this.ctx || this.seqTimer) return;
    this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.seqTimer = setInterval(() => this.pump(), 90);
  },
  stopMusic() { if (this.seqTimer) { clearInterval(this.seqTimer); this.seqTimer = null; } },
  pump() {
    if (!this.ctx || this.muted) return;
    const spb = 60 / 132 / 2;   // Achtel bei 132 BPM
    const bass = [110, 110, 165, 131, 110, 110, 196, 175];
    const arp  = [440, 523, 659, 523, 494, 587, 740, 587, 466, 587, 698, 587, 523, 659, 784, 659];
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const t = this.nextTime;
      const mk = (freq, type, vol) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + spb * 1.7);
        o.connect(g); g.connect(this.musicGain);
        o.start(t); o.stop(t + spb * 2);
      };
      if (this.step % 2 === 0) mk(bass[(this.step / 2) % 8], "triangle", .5);
      mk(arp[this.step % 16], this.step % 4 === 2 ? "square" : "sine", .2);
      this.nextTime += spb;
      this.step++;
    }
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }
};

/* =====================================================================
   INPUT — Tastatur + Touch
   ===================================================================== */
const Input = {
  left: false, right: false, jump: false, jumpPressed: false, sprint: false, down: false,
  init() {
    const kmap = {
      "ArrowLeft": "left", "KeyA": "left",
      "ArrowRight": "right", "KeyD": "right",
      "ArrowUp": "jump", "KeyW": "jump", "Space": "jump",
      "ShiftLeft": "sprint", "ShiftRight": "sprint",
      "ArrowDown": "down", "KeyS": "down",
    };
    addEventListener("keydown", e => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      const k = kmap[e.code];
      if (k) {
        if (k === "jump" && !this.jump) this.jumpPressed = true;
        this[k] = true;
      }
      if (e.code === "KeyP" || e.code === "Escape") Game.togglePause();
      if (e.code === "KeyM") UI.toggleMute();
      if (e.code === "KeyR" && (Game.state === "play" || Game.state === "pause")) Game.restartLevel();
    });
    addEventListener("keyup", e => { const k = kmap[e.code]; if (k) this[k] = false; });

    const bind = (id, key) => {
      const el = document.getElementById(id);
      const on = ev => { ev.preventDefault(); el.classList.add("pressed"); if (key === "jump" && !this.jump) this.jumpPressed = true; this[key] = true; };
      const off = ev => { ev.preventDefault(); el.classList.remove("pressed"); this[key] = false; };
      el.addEventListener("pointerdown", on);
      el.addEventListener("pointerup", off);
      el.addEventListener("pointercancel", off);
      el.addEventListener("pointerleave", off);
    };
    bind("btn-left", "left");
    bind("btn-right", "right");
    bind("btn-jump", "jump");
    // Touch-Buttons nur auf echten Touchscreens (Android/iOS: Haupt-Pointer grob),
    // nicht auf Touch-Laptops mit Maus als Primaergeraet
    const isTouch = window.matchMedia
      ? matchMedia("(pointer: coarse), (any-pointer: coarse)").matches
      : "ontouchstart" in window;
    if (isTouch) document.getElementById("touch").classList.remove("hidden");
  },
  consumeJump() { const j = this.jumpPressed; this.jumpPressed = false; return j; }
};

/* =====================================================================
   SPRITES — Hans_walking1/2 (Schrittfolge) / Hans_not_walking (Stand) /
   Hans_mashmellow (Camping), beschnitten + gespiegelt.
   Alle Bilder schauen nach RECHTS, links = per Flip erzeugt.
   ===================================================================== */
const Sprites = {
  walk1: null, walk2: null, idle: null, camp: null,
  walk1L: null, walk2L: null, idleL: null, campL: null, loaded: false,
  load(done) {
    let pending = 8;
    const finish = () => { if (--pending === 0) { this.loaded = true; done(); } };
    const crop = (img, flip) => {
      // Alpha-Boundingbox bestimmen und auf quadratische Flaeche zuschneiden
      const tmp = document.createElement("canvas");
      tmp.width = img.width; tmp.height = img.height;
      const t = tmp.getContext("2d");
      t.drawImage(img, 0, 0);
      const data = t.getImageData(0, 0, img.width, img.height).data;
      let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      for (let y = 0; y < img.height; y += 4) {
        for (let x = 0; x < img.width; x += 4) {
          if (data[(y * img.width + x) * 4 + 3] > 20) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      minX -= 2; minY -= 2; maxX += 2; maxY += 2;
      const w = maxX - minX, h = maxY - minY;
      const c = document.createElement("canvas");
      c.width = h; c.height = h;                    // quadratisch
      const g = c.getContext("2d");
      if (flip) { g.translate(h, 0); g.scale(-1, 1); }
      g.drawImage(img, minX, minY, w, h, (h - w) / 2, 0, w, h);
      return c;
    };
    const make = (src, flip, assign) => {
      const img = new Image();
      img.onload = () => {
        let c = img;
        try { c = crop(img, flip); }             // file://: getImageData kann SecurityError werfen
        catch (e) { console.warn("Sprite-Crop fehlgeschlagen, nutze Unbeschnittenen", e); }
        assign(c);
        finish();
      };
      img.onerror = () => { console.error("Sprite-Fehler:", src); finish(); };
      img.src = src;
    };
    make("Hans_walking1.png", false, c => this.walk1 = c);
    make("Hans_walking1.png", true,  c => this.walk1L = c);
    make("Hans_walking2.png", false, c => this.walk2 = c);
    make("Hans_walking2.png", true,  c => this.walk2L = c);
    make("Hans_not_walking.png", false, c => this.idle = c);
    make("Hans_not_walking.png", true,  c => this.idleL = c);
    make("Hans_mashmellow.png", false, c => this.camp = c);
    make("Hans_mashmellow.png", true,  c => this.campL = c);
  }
};

/* =====================================================================
   ITEMS
   ===================================================================== */
const ITEM_INFO = {
  shield: { dur: 9, icon: "⭐", label: "Schild", col: "#fbbf24" },
  wings: { dur: 12, icon: "🕊️", label: "Doppelsprung", col: "#a5f3fc" },
  speed: { dur: 8, icon: "⚡", label: "Turbo", col: "#fde047" },
  magnet: { dur: 9, icon: "🧲", label: "Magnet", col: "#f472b6" },
  heart: { dur: 0, icon: "❤️", label: "Extraleben", col: "#ef4444" },
};

/* =====================================================================
   LEVEL — Builder-DSL
   # = Erde/Gras   B = Kiste   P = Plattform (durchspr.(bar))   ^ = Stacheln
   ===================================================================== */
function buildLevel(def) {
  const W = def.width;
  const grid = Array.from({ length: ROWS }, () => new Array(W).fill("."));
  const ents = {
    coins: [], items: [], enemies: [], checkpoints: [],
    goal: null, start: { x: 2.5 * TILE, y: (GROUND_TOP - 3) * TILE },
  };
  const api = {
    ground(x0, x1) {
      for (let x = x0; x <= x1; x++)
        for (let y = GROUND_TOP; y < ROWS; y++) grid[y][x] = "#";
    },
    plat(x, y, len) { for (let i = 0; i < len; i++) grid[y][x + i] = "P"; },
    crate(x, y, w = 1, h = 1) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) grid[y - j][x + i] = "B"; },
    spike(x, len) { for (let i = 0; i < len; i++) grid[GROUND_TOP - 1][x + i] = "^"; },
    coinRow(x, y, n) { for (let i = 0; i < n; i++) ents.coins.push({ x: (x + i) * TILE + TILE / 2, y: y * TILE + TILE / 2 }); },
    coinArc(x, y, n) {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        ents.coins.push({ x: (x + i) * TILE + TILE / 2, y: (y - Math.sin(t * Math.PI) * 1.6) * TILE + TILE / 2 });
      }
    },
    item(x, y, kind) { ents.items.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, kind }); },
    enemy(x, kind) { ents.enemies.push({ x: x * TILE, kind }); },
    flyer(x, y) { ents.enemies.push({ x: x * TILE, y: y * TILE - 40, kind: "flyer" }); },
    checkpoint(x) { ents.checkpoints.push({ x: x * TILE + TILE / 2, y: GROUND_TOP * TILE }); },
    goal(x) { ents.goal = { x: x * TILE + TILE / 2, y: GROUND_TOP * TILE }; },
  };
  def.build(api);
  return { grid, W, name: def.name, palette: def.palette, ...ents };
}

const LEVEL_DEFS = [
  {
    name: "Wiese", width: 200, palette: {
      skyA: "#5fb2ff", skyB: "#cfeaff",
      hillNear: "#3f9e4d", hillFar: "#7cc47f", mount: "#4f7fae",
      grass: "#3fa93f", dirt: "#8a5a34", dirtDark: "#6e452a",
      cloud: "rgba(255,255,255,.9)", night: false,
    },
    build(a) {
      a.ground(0, 28);
      a.coinRow(6, 11, 5);
      a.enemy(16, "walker"); a.enemy(23, "walker");
      a.coinArc(29, 10, 4);                                  // Luecke 29-31
      a.ground(32, 60);
      a.plat(38, 11, 3); a.coinRow(38, 9, 3);
      a.item(44, 11, "speed");
      a.enemy(50, "walker"); a.enemy(55, "walker");
      a.coinArc(61, 9, 4);                                   // Luecke 61-63
      a.ground(64, 95);
      a.checkpoint(66);
      a.plat(70, 11, 3); a.coinRow(70, 9, 3);
      a.item(76, 8, "wings");
      a.flyer(80, 9);
      a.spike(86, 3); a.plat(86, 11, 3); a.coinRow(86, 9, 3);
      a.enemy(92, "walker");
      a.coinArc(96, 10, 4);                                  // Luecke 96-98
      a.ground(99, 130);
      a.crate(104, 13, 2, 2); a.coinRow(104, 10, 2);
      a.item(108, 11, "shield");
      a.enemy(112, "walker"); a.enemy(117, "walker"); a.enemy(121, "walker");
      a.item(114, 11, "magnet");
      a.checkpoint(126);
      a.coinArc(131, 10, 5);                                 // Luecke 131-135
      a.ground(136, 160);
      a.enemy(140, "spiker");
      a.spike(145, 3); a.plat(145, 11, 3); a.coinRow(145, 9, 3);
      a.item(152, 11, "heart");
      a.enemy(150, "walker"); a.enemy(155, "walker");
      a.coinArc(161, 9, 6);                                  // Luecke 161-165
      a.plat(162, 12, 2);
      a.ground(166, 199);
      a.enemy(172, "walker"); a.enemy(178, "walker");
      a.coinRow(174, 12, 6);
      a.goal(192);
    }
  },
  {
    name: "Nachtlauf", width: 220, palette: {
      skyA: "#0b1035", skyB: "#2a1f57",
      hillNear: "#1d3f31", hillFar: "#2b5241", mount: "#241f52",
      grass: "#2e8f57", dirt: "#4c3a55", dirtDark: "#3a2c41",
      cloud: "rgba(140,160,255,.22)", night: true,
    },
    build(a) {
      a.ground(0, 20);
      a.enemy(12, "walker");
      a.coinArc(21, 10, 5); a.plat(22, 11, 2);               // Luecke 21-24
      a.ground(25, 48);
      a.checkpoint(27);
      a.spike(30, 2);
      a.enemy(36, "spiker");
      a.enemy(42, "walker");
      a.checkpoint(46);
      a.coinRow(49, 9, 8);
      a.plat(50, 12, 2); a.plat(54, 10, 2); a.plat(58, 8, 2);// Bruecke 49-62
      a.item(54, 8, "speed");
      a.ground(63, 90); a.checkpoint(65);
      a.crate(70, 13, 1, 2);
      a.item(75, 12, "shield");
      a.flyer(79, 9); a.spike(80, 2);
      a.flyer(85, 8);
      a.enemy(88, "walker");
      a.coinArc(91, 10, 6);                                  // Luecke 91-95 (Sprint!)
      a.ground(96, 120);
      a.enemy(100, "walker"); a.enemy(106, "walker");
      a.item(110, 11, "magnet");
      a.spike(112, 2);
      a.plat(115, 10, 3); a.item(116, 8, "heart"); a.coinRow(115, 8, 3);
      a.enemy(118, "walker");
      a.coinArc(121, 10, 5); a.flyer(123, 10);               // Luecke 121-124
      a.ground(125, 150); a.checkpoint(127);
      a.item(130, 12, "wings");
      a.plat(133, 11, 2); a.plat(136, 8, 2); a.coinRow(136, 6, 2);
      a.flyer(139, 6);
      a.crate(142, 13, 2, 2);
      a.enemy(146, "spiker"); a.enemy(149, "walker");
      a.coinArc(151, 10, 11);
      a.plat(153, 12, 2); a.plat(157, 10, 2);                // grosse Luecke 151-160
      a.ground(161, 190); a.checkpoint(163);
      a.enemy(168, "spiker");
      a.spike(170, 3); a.plat(170, 11, 3); a.coinRow(170, 9, 3);
      a.flyer(176, 9); a.enemy(180, "walker"); a.flyer(184, 8); a.enemy(186, "walker");
      a.coinRow(177, 12, 8);
      a.coinArc(191, 10, 5);                                 // Luecke 191-194
      a.ground(195, 219);
      a.item(198, 12, "speed");
      a.enemy(202, "walker"); a.enemy(208, "walker"); a.flyer(212, 9);
      a.goal(214);
    }
  },
  {
    name: "Himmelspfad", width: 240, palette: {
      skyA: "#ff9a5a", skyB: "#ffd9a0",
      hillNear: "#b0557a", hillFar: "#7e4a86", mount: "#5f3a75",
      grass: "#4fbf8f", dirt: "#9c6a4e", dirtDark: "#7d5038",
      cloud: "rgba(255,235,215,.85)", night: false,
    },
    build(a) {
      a.ground(0, 16);
      a.enemy(10, "walker");
      a.plat(20, 12, 3); a.coinRow(20, 10, 3);
      a.plat(23, 11, 2);
      a.plat(26, 10, 3); a.coinRow(26, 8, 3);
      a.plat(32, 12, 3); a.flyer(30, 10);
      a.item(34, 10, "wings");
      a.ground(38, 52); a.checkpoint(40); a.enemy(46, "walker");
      a.plat(56, 11, 2); a.plat(61, 9, 2); a.plat(66, 11, 2); a.plat(71, 9, 2);
      a.coinRow(56, 9, 2); a.coinRow(61, 7, 2); a.coinRow(66, 9, 2); a.coinRow(71, 7, 2);
      a.flyer(58, 9); a.flyer(68, 9);
      a.ground(75, 88);
      a.checkpoint(77);
      a.item(78, 12, "magnet");
      a.enemy(82, "spiker");
      a.plat(90, 13, 2);                                      // Trittstein
      a.plat(92, 10, 3); a.item(93, 8, "shield"); a.coinRow(92, 8, 3);
      a.plat(98, 8, 3); a.coinRow(98, 6, 3);
      a.plat(104, 9, 3); a.coinRow(104, 7, 3);
      a.flyer(106, 11);
      a.ground(112, 128); a.checkpoint(114);
      a.enemy(120, "walker"); a.enemy(124, "walker"); a.spike(126, 2);
      a.plat(132, 12, 2); a.plat(137, 9, 2); a.plat(142, 12, 2); a.plat(147, 9, 2);
      a.coinArc(131, 10, 20);
      a.flyer(135, 10); a.flyer(145, 10);
      a.ground(150, 166); a.checkpoint(152);
      a.item(154, 12, "heart");
      a.enemy(158, "spiker");
      a.item(160, 12, "speed");
      a.plat(170, 11, 3); a.plat(176, 8, 3); a.plat(182, 11, 2);
      a.coinRow(176, 6, 3); a.coinRow(182, 9, 2);
      a.flyer(172, 9); a.flyer(178, 6);
      a.plat(186, 9, 2); a.plat(191, 12, 2);
      a.flyer(189, 10);
      a.ground(196, 239); a.checkpoint(198);
      a.enemy(204, "walker"); a.enemy(210, "walker"); a.enemy(216, "walker");
      a.flyer(208, 10); a.flyer(214, 10); a.flyer(220, 10);
      a.coinRow(203, 12, 4); a.coinRow(211, 11, 4); a.coinRow(219, 12, 4);
      a.goal(232);
    }
  }
];

/* =====================================================================
   SPIEL-ZUSTAND
   ===================================================================== */
const Game = {
  state: "start",            // start | play | pause | complete | gameover | win
  levelIndex: 0, level: null,
  score: 0, coins: 0, lives: 3, levelTime: 0, totalTime: 0, clock: 0,
  player: null, enemies: [], coinsE: [], itemsE: [], checkpoints: [], goalE: null,
  particles: [], floaters: [], cam: { x: 0, y: 0 }, shake: 0,
  combo: 0, respawnFlash: 0,
  canvas: null, ctx: null, dpr: 1,

  canvasScale() { return Game.canvas.clientHeight / VIEW_H; },
  viewW() { return Game.canvas.clientWidth / Game.canvasScale(); },

  startNewGame() {
    this.score = 0; this.coins = 0; this.lives = 3; this.totalTime = 0; this.levelIndex = 0;
    this.loadLevel(0);
  },
  loadLevel(idx) {
    this.levelIndex = idx;
    const lv = buildLevel(LEVEL_DEFS[idx]);
    this.level = lv;
    this.enemies = lv.enemies.map(makeEnemy);
    this.coinsE = lv.coins.map(c => ({ x: c.x, y: c.y, w: 30, h: 30, taken: false, t: Math.random() * 6 }));
    this.itemsE = lv.items.map(i => ({ x: i.x, y: i.y, w: 38, h: 38, kind: i.kind, taken: false, t: Math.random() * 6 }));
    this.checkpoints = lv.checkpoints.map(c => ({ x: c.x, y: c.y, active: false }));
    this.goalE = { x: lv.goal.x, y: lv.goal.y, reached: false };
    this.particles = []; this.floaters = [];
    this.levelTime = 0; this.combo = 0;
    this.spawnPlayer(lv.start.x, lv.start.y);
    const vw = this.viewW();
    this.cam.x = clamp(this.player.x - vw * .4, 0, lv.W * TILE - vw);
    this.cam.y = clamp(this.player.y - VIEW_H * .5, 0, ROWS * TILE - VIEW_H);
    UI.setLevel(idx, lv.name);
    UI.lastLives = UI.lastScore = UI.lastCoins = -1;
    UI.updateHUD(this);
  },
  spawnPlayer(x, y) {
    this.player = {
      x, y, w: 40, h: 64, vx: 0, vy: 0, onGround: false, facing: 1,
      coyote: 0, jumpBuf: 0, jumps: 0, animT: 0, dropT: 0,
      stillT: 0, camping: false, campTick: 0, campedToast: false,
      invuln: 0, respawnGrace: 0, sprintTrail: 0,
      powers: { shield: 0, wings: 0, speed: 0, magnet: 0 },
      spawnX: x, spawnY: y,
    };
  },
  restartLevel() {
    if (this.state !== "play" && this.state !== "pause") return;
    this.loadLevel(this.levelIndex);
    this.setState("play");
  },
  setState(s) {
    if (s !== "play") this.shake = 0;   // Shake nur im Spiel halten – sonst zittert das Bild endlos
    this.state = s;
    UI.showState(s, this);
    if (s === "play") { AudioSys.resume(); AudioSys.startMusic(); }
    else AudioSys.stopMusic();
  },
  togglePause() {
    if (this.state === "play") this.setState("pause");
    else if (this.state === "pause") this.setState("play");
  },
  hurtPlayer() {
    const p = this.player;
    if (p.invuln > 0 || this.state !== "play") return;
    this.lives--;
    p.powers = { shield: 0, wings: 0, speed: 0, magnet: 0 };
    AudioSys.sHurt();
    this.shake = 14;
    this.combo = 0;
    UI.lastLives = -1;
    UI.updateHUD(this);
    if (this.lives <= 0) { AudioSys.sDie(); this.setState("gameover"); return; }
    p.respawnGrace = 1.2;
    p.x = p.spawnX; p.y = p.spawnY; p.vx = 0; p.vy = 0;
    p.invuln = 2.4;
    this.respawnFlash = 0.35;
    burst(p.x + p.w / 2, p.y + p.h / 2, 26, ["#ef4444", "#f97316", "#fbbf24"]);
  },
  completeLevel() {
    this.goalE.reached = true;
    this.score += 1000;
    addScore(1000, this.goalE.x, this.goalE.y - 130);
    AudioSys.sWin();
    this.setState("complete");
  },
  totalWin() { AudioSys.sWin(); this.setState("win"); },
};

/* ---------- Gegner ---------- */
function makeEnemy(e) {
  if (e.kind === "walker") return { x: e.x, y: GROUND_TOP * TILE - 38, w: 42, h: 38, kind: "walker", dir: -1, base: 70, vx: 0, vy: 0, dead: 0 };
  if (e.kind === "spiker") return { x: e.x, y: GROUND_TOP * TILE - 40, w: 44, h: 40, kind: "spiker", dir: -1, base: 60, vx: 0, vy: 0, dead: 0 };
  return { x: e.x, y: e.y, ax: e.x, ay: e.y, w: 40, h: 30, kind: "flyer", t: Math.random() * 6, vx: 0, vy: 0, dead: 0 };
}

/* ---------- Tile-Zugriff ---------- */
function tileAt(tx, ty) {
  if (tx < 0 || tx >= Game.level.W) return "#";          // Waende an Levelraendern
  if (ty < 0 || ty >= ROWS) return ".";
  return Game.level.grid[ty][tx];
}
const isSolid = c => c === "#" || c === "B";
const isStand = c => isSolid(c) || c === "P";

/* =====================================================================
   UPDATE
   ===================================================================== */
function update(dt) {
  Game.levelTime += dt;
  updatePlayer(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateCamera(dt);
  updateAmbient(dt);
  updateParticles(dt);
  Game.shake = Math.max(0, Game.shake - dt * 40);
  Game.respawnFlash = Math.max(0, Game.respawnFlash - dt);
  UI.updateHUD(Game);
  UI.updatePowerbar(Game.player);
}

function updatePlayer(dt) {
  const p = Game.player;
  const speedPower = p.powers.speed > 0;
  const maxV = (Input.sprint || speedPower) ? 470 : 335;
  const acc = 2300, fric = 2100;
  const wasOnGround = p.onGround;

  if (Input.left && !Input.right) { p.vx -= acc * dt; p.facing = -1; }
  else if (Input.right && !Input.left) { p.vx += acc * dt; p.facing = 1; }
  else {
    const f = fric * dt;
    if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= Math.sign(p.vx) * f;
  }
  p.vx = clamp(p.vx, -maxV, maxV);

  if (p.dropT > 0) p.dropT -= dt;

  // Durch Plattform durchfallen: Unten + Sprung gedrueckt
  if (Input.down && Input.jumpPressed && p.onGround) {
    const ty = Math.floor((p.y + p.h + 2) / TILE);
    const t1 = tileAt(Math.floor((p.x + 2) / TILE), ty);
    const t2 = tileAt(Math.floor((p.x + p.w - 2) / TILE), ty);
    if ((t1 === "P" && !isSolid(t2)) || (t2 === "P" && !isSolid(t1))) {
      p.dropT = 0.22;
      Input.consumeJump();
    }
  }

  p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
  p.jumpBuf = Input.consumeJump() ? 0.12 : Math.max(0, p.jumpBuf - dt);
  const maxJumps = p.powers.wings > 0 ? 2 : 1;
  if (p.onGround) p.jumps = 0;

  if (p.jumpBuf > 0) {
    if (p.coyote > 0 && p.dropT <= 0) {
      p.vy = -JUMP_VEL; p.coyote = 0; p.jumpBuf = 0; p.jumps = 1; p.onGround = false;
      AudioSys.sJump();
      dust(p.x + p.w / 2, p.y + p.h, 8);
    } else if (p.jumps >= 1 && p.jumps < maxJumps) {
      p.vy = -JUMP_VEL * 0.92; p.jumpBuf = 0; p.jumps++;
      AudioSys.sJump();
      burst(p.x + p.w / 2, p.y + p.h, 10, ["#a5f3fc", "#67e8f9", "#ffffff"]);
    }
  }
  if (!Input.jump && p.vy < -350) p.vy = -350;      // variable Sprunghoehe

  p.vy += GRAV * dt;
  if (p.vy > 1200) p.vy = 1200;

  moveEntity(p, dt, true);

  if (!wasOnGround && p.onGround) { dust(p.x + p.w / 2, p.y + p.h, 10); Game.combo = 0; }

  // Stacheln
  const sx0 = Math.floor(p.x / TILE), sx1 = Math.floor((p.x + p.w - 1) / TILE);
  const sy0 = Math.floor(p.y / TILE), sy1 = Math.floor((p.y + p.h - 1) / TILE);
  for (let ty = sy0; ty <= sy1; ty++) for (let tx = sx0; tx <= sx1; tx++) {
    if (tileAt(tx, ty) !== "^") continue;
    if (p.y + p.h > ty * TILE + 16 && p.x + p.w > tx * TILE + 5 && p.x < tx * TILE + TILE - 5) { Game.hurtPlayer(); }
  }
  // Absturz
  if (p.y > ROWS * TILE + 160) Game.hurtPlayer();

  // Powerup-Timer + Effekte
  for (const k of ["shield", "wings", "speed", "magnet"]) {
    if (p.powers[k] > 0) p.powers[k] = Math.max(0, p.powers[k] - dt);
  }
  if (p.powers.shield > 0 && Math.random() < dt * 26) {
    Game.particles.push({
      x: p.x + rnd(0, p.w), y: p.y + rnd(0, p.h), vx: rnd(-20, 20), vy: rnd(-60, -20),
      life: .6, t: .6, col: `hsl(${(Game.clock * 300) % 360},95%,62%)`, r: rnd(2, 5), grav: -80
    });
  }
  if (speedPower && Math.abs(p.vx) > 330) {
    p.sprintTrail += dt;
    if (p.sprintTrail > 0.03) {
      p.sprintTrail = 0;
      Game.particles.push({ x: p.x + p.w / 2, y: p.y + p.h - 6, vx: -p.vx * .12, vy: rnd(-30, 10), life: .35, t: .35, col: "#fbbf24", r: rnd(2, 4), grav: 0 });
    }
  }
  if (p.invuln > 0) p.invuln -= dt;
  if (p.respawnGrace > 0) p.respawnGrace -= dt;
  p.animT += dt * (p.onGround ? (Math.abs(p.vx) / 60 + 0.5) : 0.4);

  // Camping: Hans ist Camper — Stillstand zaehlt sich aus
  if (p.onGround && Math.abs(p.vx) < 8 && !Input.left && !Input.right && !Input.jump && !Input.jumpPressed) {
    p.stillT += dt;
    if (p.stillT > 3.2) {
      if (!p.camping) {
        p.camping = true;
        AudioSys.noise(.3, .06);
        if (!p.campedToast) { p.campedToast = true; UI.toast("Hans macht Urlaub — Camping-Bonus!"); }
      }
      p.campTick += dt;
      if (p.campTick >= 1) {
        p.campTick -= 1;
        addScore(25, p.x + p.w / 2, p.y - 12);
        AudioSys.noise(.2, .035);           // Knistern
      }
    }
  } else {
    p.stillT = 0; p.camping = false; p.campTick = 0;
  }

  // Checkpoints
  for (const c of Game.checkpoints) {
    if (!c.active && Math.abs(p.x + p.w / 2 - c.x) < 70) {
      c.active = true;
      p.spawnX = c.x - p.w / 2; p.spawnY = c.y - p.h - TILE;
      AudioSys.sCheck();
      UI.toast("Zelt aufgeschlagen — Checkpoint!");
      burst(c.x, c.y - 60, 18, ["#22d3ee", "#3b82f6", "#ffffff"]);
    }
  }
  // Ziel (Zelt)
  const g = Game.goalE;
  if (!g.reached && overlap({ x: p.x, y: p.y, w: p.w, h: p.h }, { x: g.x - 45, y: g.y - 110, w: 90, h: 110 })) {
    Game.completeLevel();
  }
}

/* Bewegung mit Tile-Kollision; isPlayer: Plattform-Logik + Durchfall-Timer */
function moveEntity(e, dt, isPlayer) {
  e.x += e.vx * dt;
  {
    const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 1) / TILE);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w) / TILE);
      for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(tx, ty))) { e.x = tx * TILE - e.w; e.vx = 0; break; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / TILE);
      for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(tx, ty))) { e.x = (tx + 1) * TILE; e.vx = 0; break; }
    }
  }
  const prevBottom = e.y + e.h;
  e.y += e.vy * dt;
  e.onGround = false;
  {
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 1) / TILE);
    if (e.vy >= 0) {
      const ty = Math.floor((e.y + e.h) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(tx, ty);
        const platform = isPlayer
          ? (c === "P" && e.dropT <= 0 && prevBottom <= ty * TILE + 2)
          : (c === "P" && prevBottom <= ty * TILE + 8);
        if (isSolid(c) || platform) {
          e.y = ty * TILE - e.h; e.vy = 0; e.onGround = true; break;
        }
      }
    } else {
      const ty = Math.floor(e.y / TILE);
      for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(tx, ty))) { e.y = (ty + 1) * TILE; e.vy = 0; break; }
    }
  }
}

function updateEnemies(dt) {
  const p = Game.player;
  for (const e of Game.enemies) {
    if (e.dead > 0) { e.dead += dt; continue; }

    if (e.kind === "flyer") {
      e.t += dt;
      e.x = e.ax + Math.sin(e.t * 1.1) * 70;
      e.y = e.ay + Math.sin(e.t * 2.3) * 30;
    } else {
      // Patrouille: vor Wand oder Plattformkante umdrehen
      const probeX = e.dir > 0 ? e.x + e.w + 3 : e.x - 3;
      const ptx = Math.floor(probeX / TILE);
      const wallTile = tileAt(ptx, Math.floor((e.y + e.h * 0.5) / TILE));
      const floorTile = tileAt(ptx, Math.floor((e.y + e.h + 6) / TILE));
      if (isSolid(wallTile) || !isStand(floorTile)) e.dir *= -1;
      e.vx = e.dir * e.base;
      e.vy = Math.min(e.vy + GRAV * dt, 1000);
      moveEntity(e, dt, false);
    }

    if (e.dead > 0 || !overlap(p, e)) continue;

    // Kontakt Spieler/Gegner
    const stomp = p.vy > 140 && (p.y + p.h - p.vy * 0.016) <= e.y + e.h * 0.5;
    if (p.powers.shield > 0) {
      killEnemy(e, 250);
      continue;
    }
    if (stomp && e.kind !== "spiker") {
      Game.combo++;
      killEnemy(e, 250 * Game.combo);
      p.vy = Input.jump ? -STOMP_VEL_HELD : -STOMP_VEL;
      if (Game.combo > 1) UI.toast("Combo x" + Game.combo + "!");
    } else {
      Game.hurtPlayer();
    }
  }
  Game.enemies = Game.enemies.filter(e => e.dead < 1.6);
}

function killEnemy(e, pts) {
  e.dead = 0.01;
  AudioSys.sStomp();
  Game.shake = Math.max(Game.shake, 5);
  addScore(pts, e.x + e.w / 2, e.y - 8);
  burst(e.x + e.w / 2, e.y + e.h / 2, 14, ["#a3e635", "#facc15", "#fb923c"]);
}

function updatePickups(dt) {
  const p = Game.player;
  const px = p.x + p.w / 2, py = p.y + p.h / 2;
  for (const c of Game.coinsE) {
    c.t += dt;
    if (c.taken) continue;
    if (p.powers.magnet > 0) {
      const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy);
      if (d < 300 && d > 1) { c.x += dx / d * 520 * dt; c.y += dy / d * 520 * dt; }
    }
    if (Math.abs(px - c.x) < (c.w + p.w) / 2 && Math.abs(py - c.y) < (c.h + p.h) / 2) {
      c.taken = true;
      Game.coins++;
      addScore(100, c.x, c.y);
      AudioSys.sCoin();
      burst(c.x, c.y, 6, ["#fde047", "#fbbf24", "#ffffff"]);
    }
  }
  for (const it of Game.itemsE) {
    it.t += dt;
    if (it.taken) continue;
    if (Math.abs(px - it.x) < (it.w + p.w) / 2 && Math.abs(py - it.y) < (it.h + p.h) / 2) {
      it.taken = true;
      applyItem(it.kind, it.x, it.y);
    }
  }
}

function applyItem(kind, x, y) {
  const p = Game.player;
  AudioSys.sPower();
  addScore(500, x, y);
  burst(x, y, 20, [ITEM_INFO[kind].col, "#ffffff"]);
  if (kind === "heart") {
    Game.lives = Math.min(5, Game.lives + 1);
    UI.lastLives = -1;
    UI.toast("Extraleben!");
    UI.updateHUD(Game);
  } else {
    p.powers[kind] = ITEM_INFO[kind].dur;
    UI.toast(ITEM_INFO[kind].label + "!");
  }
}

function addScore(n, x, y) {
  Game.score += n;
  if (x !== undefined) Game.floaters.push({ x, y, txt: "+" + n, t: 1 });
}

function updateCamera(dt) {
  const p = Game.player;
  const vw = Game.viewW();
  const targetX = clamp(p.x + p.w / 2 + p.vx * 0.28 - vw * 0.45, 0, Game.level.W * TILE - vw);
  const targetY = clamp(p.y + p.h / 2 - VIEW_H * 0.58, 0, ROWS * TILE - VIEW_H);
  const k = 1 - Math.pow(0.0012, dt);
  Game.cam.x = lerp(Game.cam.x, targetX, k);
  Game.cam.y = lerp(Game.cam.y, targetY, k);
}

function updateAmbient(dt) {
  // Rauch + Glut an allen brennenden Lagerfeuern
  for (const c of Game.checkpoints) {
    if (!c.active) continue;
    if (Math.random() < dt * 5) smoke(c.x + 44, c.y - 30);
    if (Math.random() < dt * 2) ember(c.x + 42 + rnd(-4, 4), c.y - 22);
  }
  if (Game.goalE) {
    if (Math.random() < dt * 5) smoke(Game.goalE.x + 68, Game.goalE.y - 34);
    if (Math.random() < dt * 2) ember(Game.goalE.x + 66 + rnd(-4, 4), Game.goalE.y - 26);
  }
  const p = Game.player;
  if (p.camping && Math.random() < dt * 7) smoke(p.x + p.w / 2 + p.facing * 42 - 4, p.y + p.h - 30);
}

function smoke(x, y) {
  Game.particles.push({
    x: x + rnd(-3, 3), y, vx: rnd(-8, 14), vy: rnd(-70, -45),
    life: rnd(1, 1.8), t: rnd(1, 1.8), col: "rgba(130,130,140,.5)", r: rnd(3, 6), grav: -60
  });
}
function ember(x, y) {
  Game.particles.push({
    x, y, vx: rnd(-25, 25), vy: rnd(-130, -70),
    life: rnd(.4, .8), t: rnd(.4, .8), col: "#fb923c", r: rnd(1.5, 3), grav: 120
  });
}

function updateParticles(dt) {  for (const pt of Game.particles) {
    pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vy += (pt.grav !== undefined ? pt.grav : 500) * dt;
  }
  Game.particles = Game.particles.filter(pt => pt.t > 0);
  for (const f of Game.floaters) { f.t -= dt; f.y -= 55 * dt; }
  Game.floaters = Game.floaters.filter(f => f.t > 0);
}

function burst(x, y, n, cols) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), sp = rnd(60, 320);
    Game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      life: rnd(.3, .7), t: rnd(.3, .7), col: cols[i % cols.length], r: rnd(2, 5), grav: 700
    });
  }
}
function dust(x, y, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({
      x: x + rnd(-14, 14), y: y - 2, vx: rnd(-70, 70), vy: rnd(-90, -20),
      life: rnd(.25, .55), t: rnd(.25, .55), col: "rgba(190,170,150,.75)", r: rnd(2, 5), grav: 220
    });
  }
}

/* =====================================================================
   RENDER — Hintergrund in CSS-Pixeln, Welt mit Skalierung
   ===================================================================== */
const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * .6, r: rnd(.5, 1.6), tw: Math.random() * 6 }));
const clouds = Array.from({ length: 16 }, (_, i) => ({ x: i * 320 + rnd(0, 260), y: rnd(30, 260), s: rnd(.6, 1.4), spd: rnd(6, 16) }));

function render() {
  const cv = Game.canvas, ctx = Game.ctx;
  const W = cv.clientWidth, H = cv.clientHeight;
  const dpr = Game.dpr;
  const scaleCss = H / VIEW_H;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);

  // --- Hintergrund (CSS-Pixel-Raum) ---
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, W, H, scaleCss);

  // --- Welt ---
  let sx = 0, sy = 0;
  if (Game.shake > 0) { sx = rnd(-Game.shake, Game.shake); sy = rnd(-Game.shake, Game.shake); }
  const s = scaleCss * dpr;
  ctx.setTransform(s, 0, 0, s, (-Game.cam.x + sx) * s, (-Game.cam.y + sy) * s);

  if (Game.level) {
    const vw = W / scaleCss;
    drawTiles(ctx, vw);
    drawCheckpoints(ctx);
    drawGoal(ctx);
    drawCoins(ctx);
    drawItems(ctx);
    for (const e of Game.enemies) drawEnemy(ctx, e);
    drawParticles(ctx);
    if (Sprites.loaded) drawPlayer(ctx);
    drawFloaters(ctx);
  }

  if (Game.respawnFlash > 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = `rgba(255,70,70,${Math.min(.5, Game.respawnFlash * 1.5)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBackground(ctx, W, H, scaleCss) {
  const pal = Game.level ? Game.level.palette : LEVEL_DEFS[0].palette;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.skyA); g.addColorStop(1, pal.skyB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (pal.night) {
    ctx.fillStyle = "#ffffff";
    for (const st of stars) {
      const tw = 0.5 + 0.5 * Math.sin(Game.clock * 2 + st.tw);
      ctx.globalAlpha = 0.3 + 0.55 * tw;
      ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Mond
    ctx.fillStyle = "#e8e4ff";
    ctx.beginPath(); ctx.arc(W * .84, H * .15, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.skyA;
    ctx.beginPath(); ctx.arc(W * .84 + 10, H * .15 - 8, 22, 0, TAU); ctx.fill();
  } else {
    const sunX = W * .82, sunY = H * .16;
    const sg = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, H * .25);
    sg.addColorStop(0, "rgba(255,244,200,.95)");
    sg.addColorStop(.25, "rgba(255,236,150,.5)");
    sg.addColorStop(1, "rgba(255,236,150,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
  }

  // Wolken
  ctx.fillStyle = pal.cloud;
  const span = W + 520;
  for (const c of clouds) {
    const px = ((c.x + Game.clock * c.spd - Game.cam.x * 0.25 * scaleCss) % span + span) % span - 260;
    const py = c.y - Game.cam.y * 0.15 * scaleCss;
    if (px < -280 || px > W + 80) continue;
    const s = c.s * 34;
    ctx.beginPath();
    ctx.arc(px, py, s * .55, 0, TAU);
    ctx.arc(px + s * .5, py + 6, s * .42, 0, TAU);
    ctx.arc(px - s * .5, py + 8, s * .4, 0, TAU);
    ctx.rect(px - s * .8, py, s * 1.7, s * .55);
    ctx.fill();
  }

  // Berge + Huegel (Parallax), ferne Ebene mit Camping-Zelten
  drawRidge(ctx, W, H, Game.cam.x * 0.18 * scaleCss, Game.cam.y * 0.18 * scaleCss, pal.mount, 0.42, 120);
  drawRidge(ctx, W, H, Game.cam.x * 0.4 * scaleCss, Game.cam.y * 0.32 * scaleCss + 30, pal.hillFar, 0.6, 85, true);
  drawRidge(ctx, W, H, Game.cam.x * 0.62 * scaleCss, Game.cam.y * 0.5 * scaleCss + 60, pal.hillNear, 0.78, 55);

  // Vogelschwaerme ziehen durch
  ctx.strokeStyle = pal.night ? "rgba(180,190,255,.5)" : "rgba(30,40,60,.35)";
  ctx.lineWidth = 1.6;
  for (let b = 0; b < 3; b++) {
    const bx = ((Game.clock * (14 + b * 5) + b * 500) % (W + 260)) - 130;
    const by = 60 + 34 * Math.sin(Game.clock * 0.25 + b * 2.1) - Game.cam.y * 0.1 * scaleCss;
    const flap = Math.sin(Game.clock * 6 + b) * 5;
    ctx.beginPath();
    ctx.moveTo(bx - 7, by - flap * .4);
    ctx.quadraticCurveTo(bx - 3, by - 4 - flap, bx, by);
    ctx.quadraticCurveTo(bx + 3, by - 4 - flap, bx + 7, by - flap * .4);
    ctx.stroke();
  }
}

/* Weiche Berge: dichte Abtastung statt Stuetzpunkte in 70px-Abstaenden */
function drawRidge(ctx, W, H, off, yoff, col, baseFrac, amp, tents) {
  const K = H / 900;
  const f = wx => H * baseFrac - yoff -
    (Math.sin(wx * 0.0032) + Math.sin(wx * 0.0091 + 2) * 0.45 + Math.sin(wx * 0.021 + 5) * 0.12) * amp * K;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-12, H + 40);
  const step = 10;
  for (let x = -12; x <= W + 12; x += step) ctx.lineTo(x, f(x + off));
  ctx.lineTo(W + 12, H + 40);
  ctx.closePath();
  ctx.fill();

  // Winzige Campingzelte als Schattensilhouetten auf dem Ruecken (nur fern)
  if (tents) {
    const spacing = 380;
    const k0 = Math.floor((off - 100) / spacing);
    const n = Math.ceil((W + 320) / spacing) + 1;
    ctx.fillStyle = "rgba(0,0,0,.22)";
    for (let k = k0; k < k0 + n; k++) {
      const j = ((k * 2654435761 >>> 0) % 997) / 997;
      const sx = k * spacing + j * 220 - off;
      const yy = f(sx + off) + 3;
      const w = 14 + j * 10, h = 11 + j * 6;
      ctx.beginPath();
      ctx.moveTo(sx, yy);
      ctx.lineTo(sx + w / 2, yy - h);
      ctx.lineTo(sx + w, yy);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawTiles(ctx, vw) {
  const lv = Game.level, pal = lv.palette;
  const x0 = Math.max(0, Math.floor(Game.cam.x / TILE) - 1);
  const x1 = Math.min(lv.W - 1, Math.ceil((Game.cam.x + vw) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(Game.cam.y / TILE) - 1);
  const y1 = Math.min(ROWS - 1, Math.ceil((Game.cam.y + VIEW_H) / TILE) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const c = lv.grid[ty][tx];
      const X = tx * TILE, Y = ty * TILE;
      if (c === "#") {
        const top = !isSolid(tileAt(tx, ty - 1));
        ctx.fillStyle = pal.dirt;
        ctx.fillRect(X, Y + (top ? 14 : 0), TILE, TILE - (top ? 14 : 0));
        ctx.fillStyle = pal.dirtDark;
        if ((tx * 7 + ty * 13) % 5 < 2) ctx.fillRect(X + 8, Y + 26, 7, 7);
        if ((tx * 11 + ty * 5) % 6 < 2) ctx.fillRect(X + 28, Y + 36, 9, 6);
        if (top) {
          ctx.fillStyle = pal.grass;
          ctx.fillRect(X, Y, TILE, 16);
          ctx.fillStyle = "rgba(255,255,255,.22)";
          ctx.fillRect(X, Y, TILE, 5);
          ctx.fillStyle = pal.grass;
          ctx.beginPath();
          ctx.arc(X + 10, Y + 17, 5, 0, TAU); ctx.arc(X + 26, Y + 18, 6, 0, TAU); ctx.arc(X + 40, Y + 16, 4, 0, TAU);
          ctx.fill();
        }
      } else if (c === "B") {
        ctx.fillStyle = "#b0773f";
        ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
        ctx.strokeStyle = "#7a4e26";
        ctx.lineWidth = 3;
        ctx.strokeRect(X + 3.5, Y + 3.5, TILE - 7, TILE - 7);
        ctx.beginPath();
        ctx.moveTo(X + 4, Y + 4); ctx.lineTo(X + TILE - 4, Y + TILE - 4);
        ctx.moveTo(X + TILE - 4, Y + 4); ctx.lineTo(X + 4, Y + TILE - 4);
        ctx.lineWidth = 2; ctx.stroke();
      } else if (c === "P") {
        ctx.fillStyle = "#5a3d2b";
        ctx.fillRect(X + 2, Y + 8, TILE - 4, TILE - 14);
        ctx.fillStyle = "#8a674b";
        ctx.fillRect(X + 2, Y + 8, TILE - 4, 8);
        ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.fillRect(X + 2, Y + 8, TILE - 4, 2.5);
      } else if (c === "^") {
        ctx.fillStyle = "#97a3b6";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(X + 4 + i * 14, Y + TILE - 4);
          ctx.lineTo(X + 11 + i * 14, Y + 6);
          ctx.lineTo(X + 18 + i * 14, Y + TILE - 4);
          ctx.closePath(); ctx.fill();
        }
      }
    }
  }
}

/* ---------- Camping-Grafiken: Zelt + Lagerfeuer ---------- */
function drawTent(ctx, x, baseY, w, h, col, active) {
  // Koerper
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, baseY); ctx.lineTo(x + w / 2, baseY - h); ctx.lineTo(x + w, baseY);
  ctx.closePath(); ctx.fill();
  // rechte Haelfte leicht abgeschlossen
  ctx.fillStyle = "rgba(0,0,0,.2)";
  ctx.beginPath();
  ctx.moveTo(x + w / 2, baseY - h); ctx.lineTo(x + w, baseY); ctx.lineTo(x + w / 2, baseY);
  ctx.closePath(); ctx.fill();
  // Eingang
  ctx.fillStyle = "rgba(15,23,42,.55)";
  ctx.beginPath();
  ctx.moveTo(x + w / 2, baseY - h * 0.5);
  ctx.lineTo(x + w * 0.7, baseY);
  ctx.lineTo(x + w * 0.3, baseY);
  ctx.closePath(); ctx.fill();
  // Firstlinie
  ctx.strokeStyle = "rgba(255,255,255,.25)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + w * .18, baseY - h * .12); ctx.lineTo(x + w / 2, baseY - h); ctx.stroke();
  // Wimpel an der Spitze (nur aktiv)
  if (active) {
    const wave = Math.sin(Game.clock * 5) * 4;
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w / 2, baseY - h); ctx.lineTo(x + w / 2, baseY - h - 16); ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(x + w / 2, baseY - h - 16);
    ctx.lineTo(x + w / 2 + 17 + wave, baseY - h - 11);
    ctx.lineTo(x + w / 2, baseY - h - 5);
    ctx.closePath(); ctx.fill();
  }
}

function drawFlame(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2, y - h * 0.5, x, y - h);
  ctx.quadraticCurveTo(x + w / 2, y - h * 0.5, x + w / 2, y);
  ctx.closePath(); ctx.fill();
}

function drawCampfire(ctx, x, baseY, burning, phase) {
  if (burning) {
    const f1 = Math.sin(Game.clock * 9 + phase);
    const f2 = Math.sin(Game.clock * 13 + phase * 2.3);
    // Feuerschein
    ctx.globalAlpha = .2 + .06 * f1;
    ctx.fillStyle = "#fb923c";
    ctx.beginPath(); ctx.arc(x, baseY - 13, 27 + f1 * 3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // Flammen (3 Schichten)
    drawFlame(ctx, x + f2, baseY - 4, 15, 26 + f1 * 4, "#f97316");
    drawFlame(ctx, x - f2 * .6, baseY - 3, 10, 17 + f2 * 3, "#fbbf24");
    drawFlame(ctx, x, baseY - 2, 5.5, 11 + f1 * 2, "#fef3c7");
  }
  // Holzscheite
  ctx.fillStyle = "#7c4a21";
  ctx.save();
  ctx.translate(x, baseY - 2); ctx.rotate(.5);
  ctx.fillRect(-13, -2.5, 26, 5);
  ctx.restore();
  ctx.save();
  ctx.translate(x, baseY); ctx.rotate(-.55);
  ctx.fillRect(-13, -2.5, 26, 5);
  ctx.restore();
}

function drawCheckpoints(ctx) {
  for (const c of Game.checkpoints) {
    const x = c.x, y = c.y;
    drawTent(ctx, x - 52, y, 80, 60, c.active ? "#e0554d" : "#7b8aa0", c.active);
    drawCampfire(ctx, x + 42, y, c.active, x * 0.03);
  }
}

function drawGoal(ctx) {
  const g = Game.goalE;
  const x = g.x, y = g.y;
  const pulse = g.reached ? 1 + .1 * Math.sin(Game.clock * 8) : 1;
  // grosses Ferien-Zelt
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.translate(-x, -y);
  drawTent(ctx, x - 64, y, 128, 94, "#3b82f6", true);
  ctx.restore();
  // Wimpel volle Hoehe uem das Zelt
  const apexX = x, apexY = y - 94;
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(apexX, apexY - 30); ctx.stroke();
  const wave = Math.sin(Game.clock * 4) * 7;
  const grd = ctx.createLinearGradient(apexX, apexY - 30, apexX + 80, apexY);
  grd.addColorStop(0, "#60a5fa"); grd.addColorStop(1, "#22d3ee");
  ctx.fillStyle = g.reached ? "#22d3ee" : grd;
  ctx.beginPath();
  ctx.moveTo(apexX, apexY - 30);
  ctx.lineTo(apexX + 42 + wave, apexY - 21);
  ctx.lineTo(apexX, apexY - 10);
  ctx.closePath(); ctx.fill();
  // Lagerfeuer brennt immer am Ziel
  drawCampfire(ctx, x + 66, y, true, 7);
  ctx.globalAlpha = .14 + .06 * Math.sin(Game.clock * 3);
  ctx.fillStyle = "#22d3ee";
  ctx.beginPath(); ctx.arc(x, y - 40, 70, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCoins(ctx) {
  for (const c of Game.coinsE) {
    if (c.taken) continue;
    const sq = Math.abs(Math.cos(c.t * 4));
    const bobY = Math.sin(c.t * 2.4) * 5;
    ctx.save();
    ctx.translate(c.x, c.y + bobY);
    ctx.globalAlpha = .3;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.arc(0, 0, 17 + 3 * Math.sin(c.t * 5), 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.scale(Math.max(sq, .12), 1);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawItems(ctx) {
  for (const it of Game.itemsE) {
    if (it.taken) continue;
    const info = ITEM_INFO[it.kind];
    const bobY = Math.sin(it.t * 2.2) * 6;
    ctx.save();
    ctx.translate(it.x, it.y + bobY);
    ctx.globalAlpha = .28 + .12 * Math.sin(it.t * 4);
    ctx.fillStyle = info.col;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = info.col;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
    ctx.font = "22px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(info.icon, 0, 1);
    ctx.restore();
  }
}

function drawEnemy(ctx, e) {
  if (e.dead > 0) {
    const k = Math.min(1, e.dead * 3);
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = "#94a3b8";
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    ctx.scale(1 + k * .5, Math.max(0.05, 1 - k));
    ctx.beginPath(); ctx.arc(0, 0, e.w / 2, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }
  if (e.kind === "walker") {
    const bob = Math.abs(Math.sin(Game.clock * 7 + e.x)) * 3;
    ctx.fillStyle = "#e0669a";
    roundRect(ctx, e.x, e.y + 6 - bob, e.w, e.h - 6 + bob, 12); ctx.fill();
    ctx.fillStyle = "#9d3866";
    roundRect(ctx, e.x + 4, e.y + e.h - 10, e.w - 8, 8, 5); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(e.x + 13, e.y + 16, 6, 0, TAU); ctx.arc(e.x + 29, e.y + 16, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1e293b";
    const look = (e.dir || -1) * 2;
    ctx.beginPath(); ctx.arc(e.x + 13 + look, e.y + 16, 2.7, 0, TAU); ctx.arc(e.x + 29 + look, e.y + 16, 2.7, 0, TAU); ctx.fill();
  } else if (e.kind === "spiker") {
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2 + 3, e.w / 2 - 4, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(167,139,250,.9)";
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2 + 3;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i / 7) * TAU + Game.clock * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - .3) * 14, cy + Math.sin(a - .3) * 14);
      ctx.lineTo(cx + Math.cos(a) * 25, cy + Math.sin(a) * 25);
      ctx.lineTo(cx + Math.cos(a + .3) * 14, cy + Math.sin(a + .3) * 14);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(e.x + 17, e.y + 22, 5, 0, TAU); ctx.arc(e.x + 29, e.y + 22, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath(); ctx.arc(e.x + 17, e.y + 22, 2.3, 0, TAU); ctx.arc(e.x + 29, e.y + 22, 2.3, 0, TAU); ctx.fill();
  } else {
    // flyer
    const flap = Math.sin(Game.clock * 13 + e.x * .01) * 12;
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(e.x + 8, e.y + 14);
    ctx.quadraticCurveTo(e.x - 10, e.y + 4 - flap, e.x - 16, e.y + 10 + flap * .4);
    ctx.quadraticCurveTo(e.x - 2, e.y + 18, e.x + 8, e.y + 18);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(e.x + e.w - 8, e.y + 14);
    ctx.quadraticCurveTo(e.x + e.w + 10, e.y + 4 - flap, e.x + e.w + 16, e.y + 10 + flap * .4);
    ctx.quadraticCurveTo(e.x + e.w + 2, e.y + 18, e.x + e.w - 8, e.y + 18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + 15, 12, Math.PI, 0); ctx.fill();
    ctx.fillRect(e.x + e.w / 2 - 12, e.y + 15, 24, 6);
    ctx.fillStyle = "#fde047";
    ctx.beginPath(); ctx.arc(e.x + e.w / 2 - 4, e.y + 13, 2.6, 0, TAU); ctx.arc(e.x + e.w / 2 + 4, e.y + 13, 2.6, 0, TAU); ctx.fill();
  }
}

function drawPlayer(ctx) {
  const p = Game.player;
  const blink = p.invuln > 0 && p.respawnGrace <= 0 && Math.floor(p.invuln * 12) % 2 === 0;
  if (blink) return;

  const sprW = 86, sprH = 86;
  const cx = p.x + p.w / 2;
  const feetY = p.y + p.h;

  // Schatten nur am Boden — beim Sprung kein Schatten
  if (p.onGround) {
    ctx.globalAlpha = .18;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, feetY + 4, 26, 7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  const moving = Math.abs(p.vx) > 30;
  // 4-Phasen-Zyklus: Schritt 1 - Idle - Schritt 2 - Idle (Idle als Zwischenbild)
  const cycle = [Sprites.walk1, Sprites.idle, Sprites.walk2, Sprites.idle];
  const frame = Math.floor(p.animT) % 4;
  // Beim Camping die Marshmallow-Figur zeigen, sonst Schritt-/Idle-Logik
  let img = p.camping ? Sprites.camp
           : !p.onGround ? (frame % 2 === 0 ? Sprites.walk1 : Sprites.walk2)
           : moving ? cycle[frame] : Sprites.idle;
  if (p.facing < 0) img = img === Sprites.walk1 ? Sprites.walk1L
                      : img === Sprites.walk2 ? Sprites.walk2L
                      : img === Sprites.camp ? Sprites.campL
                      : Sprites.idleL;

  const tilt = clamp(p.vx / 2600, -.12, .12);
  ctx.save();
  ctx.translate(cx, feetY - sprH / 2);
  ctx.rotate(tilt);
  const stretch = clamp(1 - Math.abs(p.vy) / 4200, .96, 1.04);
  ctx.scale(1 / stretch, stretch);

  if (p.powers.wings > 0) {
    // kleine Fuegel-Aura
    ctx.globalAlpha = .5;
    ctx.fillStyle = "#a5f3fc";
    const flap = Math.sin(Game.clock * 10) * 6;
    ctx.beginPath();
    ctx.moveTo(-sprW / 2 - 4, -sprH * .42);
    ctx.quadraticCurveTo(-sprW / 2 - 26, -sprH * .52 + flap, -sprW / 2 - 24, -sprH * .28 + flap * .4);
    ctx.quadraticCurveTo(-sprW / 2 - 10, -sprH * .33, -sprW / 2 - 2, -sprH * .36);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(img, -sprW / 2, -sprH / 2, sprW, sprH);
  ctx.restore();

  // Hans campiert: Lagerfeuer mit Marshmallow neben ihm
  if (p.camping) {
    const fx = cx + p.facing * 44;
    drawCampfire(ctx, fx, feetY, true, 2.4);
    // Marshmallow-Stock in Hans' Hand, Spitze mit Marshmallow ueber dem Feuer
    const wob = Math.sin(Game.clock * 2) * 2;
    const hx = cx + p.facing * 16, hy = feetY - 42 + wob * .5;   // Hand
    const mx = fx - p.facing * 3, my = feetY - 28 + wob;         // Spitze ueberm Feuer
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx, my); ctx.stroke();
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath(); ctx.arc(mx, my, 4.2, 0, TAU); ctx.fill();
  }

  if (p.powers.shield > 0) {
    const hue = (Game.clock * 340) % 360;
    const r = sprH * .64 + 4 * Math.sin(Game.clock * 7);
    ctx.globalAlpha = .55;
    ctx.strokeStyle = `hsl(${hue},95%,65%)`;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(cx, feetY - sprH / 2, r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .1;
    ctx.fillStyle = `hsl(${hue},95%,65%)`;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawParticles(ctx) {
  for (const pt of Game.particles) {
    ctx.globalAlpha = Math.max(0, pt.t / pt.life);
    ctx.fillStyle = pt.col;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx) {
  ctx.font = "800 18px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const f of Game.floaters) {
    ctx.globalAlpha = Math.min(1, f.t * 2);
    ctx.fillStyle = "rgba(15,23,42,.7)";
    ctx.fillText(f.txt, f.x + 1.5, f.y + 1.5);
    ctx.fillStyle = "#fde047";
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* =====================================================================
   UI — HUD, Overlays, Toasts
   ===================================================================== */
const UI = {
  el: id => document.getElementById(id),
  lastLives: -1, lastScore: -1, lastCoins: -1,

  init() {
    this.el("btn-start").onclick = () => {
      AudioSys.init(); AudioSys.resume();
      Game.startNewGame();
      Game.setState("play");
      UI.toast("Los geht's, Hans!");
    };
    this.el("btn-resume").onclick = () => Game.togglePause();
    this.el("btn-restart-pause").onclick = () => Game.restartLevel();
    this.el("btn-quit").onclick = () => { Game.setState("start"); this.updateBest(); };
    this.el("btn-next").onclick = () => {
      if (Game.levelIndex + 1 < LEVEL_DEFS.length) {
        Game.loadLevel(Game.levelIndex + 1);
        Game.setState("play");
        UI.toast("Level " + (Game.levelIndex + 1) + ": " + Game.level.name);
      } else {
        Game.totalWin();
      }
    };
    this.el("btn-tryagain").onclick = () => { Game.startNewGame(); Game.setState("play"); };
    this.el("btn-quit2").onclick = () => { Game.setState("start"); this.updateBest(); };
    this.el("btn-win-restart").onclick = () => { Game.startNewGame(); Game.setState("play"); };
    this.updateBest();
  },
  updateBest() {
    const best = +localStorage.getItem("handrun-best") || 0;
    this.el("best-score").textContent = best > 0 ? `Rekord: ${best} Punkte` : "";
  },
  showState(s, g) {
    ["start", "pause", "complete", "gameover", "win"].forEach(p => this.el("panel-" + p).classList.add("hidden"));
    this.el("overlay").classList.toggle("hidden", s === "play");

    if (s === "start") this.el("panel-start").classList.remove("hidden");
    if (s === "pause") this.el("panel-pause").classList.remove("hidden");
    if (s === "complete") {
      this.el("complete-title").textContent = `Level ${g.levelIndex + 1} geschafft!`;
      this.el("complete-stats").innerHTML =
        `Punkte: <b>${g.score}</b><br>M&uuml;nzen: <b>${g.coins}</b><br>Zeit: <b>${fmtTime(g.levelTime)}</b>`;
      this.el("panel-complete").classList.remove("hidden");
      this.saveBest(g.score);
    }
    if (s === "gameover") {
      this.el("gameover-stats").innerHTML =
        `Punkte: <b>${g.score}</b><br>Erreicht: Level <b>${g.levelIndex + 1}</b>`;
      this.el("panel-gameover").classList.remove("hidden");
      this.saveBest(g.score);
    }
    if (s === "win") {
      this.el("win-stats").innerHTML =
        `Endpunktzahl: <b>${g.score}</b><br>M&uuml;nzen: <b>${g.coins}</b><br>Gesamtzeit: <b>${fmtTime(g.totalTime)}</b>`;
      this.el("panel-win").classList.remove("hidden");
      this.saveBest(g.score);
    }
  },
  saveBest(score) {
    const best = +localStorage.getItem("handrun-best") || 0;
    if (score > best) localStorage.setItem("handrun-best", String(score));
    this.updateBest();
  },
  setLevel(idx, name) { this.el("hud-level").textContent = `Level ${idx + 1} · ${name}`; },
  updateHUD(g) {
    if (g.score !== this.lastScore) { this.el("hud-score").innerHTML = `<span class="hud-label">Punkte</span> ${g.score}`; this.lastScore = g.score; }
    if (g.coins !== this.lastCoins) { this.el("hud-coins").textContent = `🪙 ${g.coins}`; this.lastCoins = g.coins; }
    if (g.lives !== this.lastLives) {
      this.el("hud-lives").textContent = g.lives > 0 ? "❤".repeat(g.lives) : "—";
      this.lastLives = g.lives;
    }
    this.el("hud-time").textContent = fmtTime(g.levelTime);
  },
  updatePowerbar(p) {
    const bar = this.el("powerbar");
    if (!p) { bar.innerHTML = ""; return; }
    let html = "";
    for (const kind of ["shield", "wings", "speed", "magnet"]) {
      if (p.powers[kind] > 0) {
        const info = ITEM_INFO[kind];
        const pct = (p.powers[kind] / info.dur) * 100;
        html += `<div class="pu-chip"><span>${info.icon}</span><span>${info.label}</span>` +
                `<span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span></div>`;
      }
    }
    bar.innerHTML = html;
  },
  toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.getElementById("toasts").appendChild(t);
    setTimeout(() => t.remove(), 2000);
  },
  toggleMute() {
    AudioSys.setMuted(!AudioSys.muted);
    this.el("mute-indicator").classList.toggle("hidden", !AudioSys.muted);
  }
};

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* =====================================================================
   BOOT + LOOP
   ===================================================================== */
function resize() {
  const cv = Game.canvas;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.floor(cv.clientWidth * dpr);
  cv.height = Math.floor(cv.clientHeight * dpr);
  Game.dpr = dpr;
}

let last = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;
  Game.clock += dt;
  if (Game.state === "play") {
    Game.totalTime += dt;
    update(dt);
  }
  render();
}

window.addEventListener("load", () => {
  const cv = document.getElementById("game");
  Game.canvas = cv;
  Game.ctx = cv.getContext("2d");
  resize();
  addEventListener("resize", resize);

  Sprites.load(() => Game.loadLevel(0));   // Level 1 als fond im Titelbild
  Input.init();
  UI.init();
  requestAnimationFrame(loop);
});
