/* Smoke-Test: game.js ohne Browser ausfuehren (Physik/Logik) */
"use strict";
const fs = require("fs");
const vm = require("vm");

/* ---------- DOM/Browser-Mocks ---------- */
const noop = () => {};
const makeCtx = () => new Proxy({}, {
  get(t, k) {
    if (k === "canvas") return makeCtx();
    return (...a) => ({ addColorStop: noop, width: 100 });
  },
  set() { return true; },
});
const makeEl = id => ({
  id, textContent: "", innerHTML: "",
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, appendChild: noop, remove: noop,
  style: {},
});
const els = {};
const documentMock = {
  getElementById: id => els[id] || (els[id] = makeEl(id)),
  createElement: tag => tag === "canvas"
    ? { width: 0, height: 0, getContext: () => makeCtx() }
    : makeEl(tag),
};
const canvasMock = { clientWidth: 1280, clientHeight: 720, width: 1280, height: 720, getContext: () => makeCtx() };
els["game"] = canvasMock;

global.window = { addEventListener: noop, AudioContext: undefined, devicePixelRatio: 1 };
global.document = documentMock;
global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
global.addEventListener = noop;
global.requestAnimationFrame = noop;
global.Image = class { set src(v) { setTimeout(() => this.onerror && this.onerror(), 0); } get src() { return ""; } };
Object.defineProperty(global, "navigator", { value: { maxTouchPoints: 0 }, configurable: true });
global.performance = { now: () => Date.now() };

/* ---------- game.js laden ---------- */
const code = fs.readFileSync("js/game.js", "utf8");
vm.runInThisContext(code);
globalThis.__canvas = canvasMock;
vm.runInThisContext("Sprites.loaded = true; Game.canvas = globalThis.__canvas; Game.ctx = null;");

/* ---------- Tests ---------- */
let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS  " + name);
  else { failures++; console.log("FAIL  " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

const run = src => vm.runInThisContext(src);
const gameState = () => JSON.parse(vm.runInThisContext(
  `JSON.stringify({x:Game.player.x, y:Game.player.y, vx:Game.player.vx, vy:Game.player.vy, og:Game.player.onGround, lives:Game.lives, score:Game.score, coins:Game.coins, state:Game.state, enemies:Game.enemies.length})`));
const load = i => run(`Game.loadLevel(${i}); Game.lives = 3; Game.state = "play"; Input.left=Input.right=Input.jump=Input.sprint=Input.down=false;`);
const step = n => { for (let i = 0; i < n; i++) run(`update(1/60)`); };

/* 1. Alle 3 Level bauen + Spieler landet/steht am Start */
for (let i = 0; i < 3; i++) {
  load(i); step(40);
  const S = gameState();
  check(`Level ${i + 1} (${Game.level.name}): laedt + Spieler steht stabil`, S.og === true && S.y > 0 && S.y < 15 * 48, JSON.stringify(S));
}
load(0);

/* 2. Spieler versinkt nicht */
step(30);
const before = gameState();
step(120);
let after = gameState();
check("Spieler versinkt nicht / bleibt stabil", Math.abs(after.y - before.y) < 1 && after.og === true, JSON.stringify({ b: before, a: after }));

/* 3. Laufen nach rechts */
run("Input.right = true");
step(60);
after = gameState();
check("Spieler laeuft nach rechts (vx>200, x steigt)", after.vx > 200 && after.x > before.x + 50, JSON.stringify(after));
run("Input.right = false");

/* 4. Sprung */
load(0); step(30);
const y0 = gameState().y;
const airPeak = vm.runInThisContext(`(() => {
  Input.jump = true; Input.jumpPressed = true;
  let peak = 1e9;
  for (let i = 0; i < 400; i++) { update(1/60); peak = Math.min(peak, Game.player.y); }
  return peak;
})()`);
run("Input.jump = false");
check("Sprung hebt Spieler ab (Y sinkt >150)", (y0 - airPeak) > 150, `peak=${airPeak.toFixed(1)} start=${y0}`);

/* 5. 90s Dauerlauf: keine NaN, Fortschritt, Deaths/Respawn ok */
const marathon = vm.runInThisContext(`(() => {
  Game.loadLevel(0); Game.state = "play";
  let maxX = 0, deaths = 0, lastLives = 3;
  for (let i = 0; i < 60 * 90; i++) {
    Input.right = true; Input.sprint = true; Input.jump = true;
    if (i % 45 === 0) Input.jumpPressed = true;
    update(1/60);
    if (Game.lives < lastLives) { deaths++; lastLives = Game.lives; }
    if (!isFinite(Game.player.x) || !isFinite(Game.player.y)) return { nan: true };
    maxX = Math.max(maxX, Game.player.x);
    if (Game.state !== "play") break;
    if (Game.player.x > Game.level.W * 48 - 400) break;
  }
  Input.right = Input.sprint = Input.jump = false;
  return { nan: false, maxX: Math.round(maxX), deaths, x: Math.round(Game.player.x), lives: Game.lives, state: Game.state, score: Game.score };
})()`);
check("90s Dauerlauf: keine NaN-Koordinaten", !marathon.nan, JSON.stringify(marathon));
check("90s Dauerlauf: Spieler kommt voran (X > 4000)", marathon.maxX > 4000, JSON.stringify(marathon));

/* 6. Stomp toetet Walker */
load(0);
const stomp = vm.runInThisContext(`(() => {
  const e = Game.enemies.find(e => e.kind === "walker");
  const scoreBefore = Game.score;
  Object.assign(Game.player, { x: e.x - 1, y: e.y - 100, vy: 400, vx: 0, invuln: 0 });
  for (let i = 0; i < 30; i++) update(1/60);
  return { dead: e.dead, scoreGain: Game.score - scoreBefore, lives: Game.lives };
})()`);
check("Stomp toetet Walker (+Punkte, kein Schaden)", stomp.dead > 0 && stomp.scoreGain >= 250 && stomp.lives === 3, JSON.stringify(stomp));

/* 7. Spiker-Stomp schadet */
load(0);
const spiker = vm.runInThisContext(`(() => {
  const e = Game.enemies.find(e => e.kind === "spiker");
  const scoreBefore = Game.score;
  Object.assign(Game.player, { x: e.x - 1, y: e.y - 100, vy: 400, vx: 0, invuln: 0 });
  for (let i = 0; i < 30; i++) update(1/60);
  return { lives: Game.lives, scoreGain: Game.score - scoreBefore };
})()`);
check("Spiker-Stomp schadet (Leben weg, kein Kill)", spiker.lives === 2 && spiker.scoreGain === 0, JSON.stringify(spiker));

/* 8. Powerup-Effekte */
load(0);
const pu = vm.runInThisContext(`(() => {
  applyItem("wings", 0, 0);
  const w = Game.player.powers.wings > 0;
  applyItem("heart", 0, 0);
  const h = Game.lives === 4;
  applyItem("shield", 0, 0);
  const s = Game.player.powers.shield > 0;
  return { w, h, s };
})()`);
check("Powerups aktivieren sich (wings/heart/shield)", pu.w && pu.h && pu.s, JSON.stringify(pu));

/* 9. Stacheln verletzen */
load(0);
const spikes = vm.runInThisContext(`(() => {
  const lives = Game.lives;
  Object.assign(Game.player, { x: 86 * 48 + 10, y: 12 * 48, vx: 0, vy: 0, invuln: 0 });
  for (let i = 0; i < 20; i++) update(1/60);
  return { before: lives, after: Game.lives };
})()`);
check("Stacheln verletzen Spieler", spikes.after === spikes.before - 1, JSON.stringify(spikes));

/* 10. Ziel erreicht Complete-State */
load(0);
const goal = vm.runInThisContext(`(() => {
  Object.assign(Game.player, { x: Game.goalE.x - 10, y: 11 * 48, vx: 0, vy: 0 });
  update(1/60);
  return Game.state;
})()`);
check("Ziel aendert State zu complete", goal === "complete", goal);

/* 11. Fall in Abgrund kostet Leben + Respawn am Checkpoint */
load(0);
const fall = vm.runInThisContext(`(() => {
  const lives = Game.lives;
  Object.assign(Game.player, { x: 29 * 48, y: 16 * 48, vx: 0, vy: 200, invuln: 0 });   // in Luecke fallen
  for (let i = 0; i < 90; i++) update(1/60);
  return { before: lives, after: Game.lives, x: Math.round(Game.player.x), y: Math.round(Game.player.y) };
})()`);
check("Absturz kostet Leben + Respawns", fall.after === fall.before - 1 && fall.y < 15 * 48, JSON.stringify(fall));

/* 12. Bot-Durchlauf je Level: Fortschritt/Abgeschlossen-Status
       (Bot mit seed-deterministischem Zufalls-Timing; Level 1 muss
        absolvierbar sein, 2+3 sind Info-Werte -- absichtlich schwerer) */
const SEED = +(process.env.BOT_SEED || 3);
vm.runInThisContext(`let __s = ${SEED}; Math.random = () => { __s = (__s * 1664525 + 1013904223) >>> 0; return __s / 4294967296; };`);
for (let lv = 1; lv <= 3; lv++) {
  const bot = vm.runInThisContext(`(() => {
    Game.loadLevel(${lv - 1}); Game.lives = 99; Game.state = "play";
    let px = 0, deaths = 0, lastLives = 99, done = false;
    const FRAMES = 9000;                    // 150 Sekunden bei 60 FPS
    for (let i = 0; i < FRAMES; i++) {
      Input.right = true; Input.sprint = true; Input.jump = true;
      if (Game.player.onGround && Math.random() < 0.5) Input.jumpPressed = true;
      update(1/60);
      if (Game.lives < lastLives) { deaths++; lastLives = Game.lives; }
      px = Math.max(px, Game.player.x);
      if (Game.state === "complete") { done = true; break; }
      if (Game.state !== "play") break;
    }
    Input.right = Input.sprint = Input.jump = false;
    return { px: Math.round(px), pct: Math.round(100 * px / (Game.level.W * 48)), deaths, done };
  })()`);
  if (lv === 1) {
    check("Level 1: Bot schafft das Level komplett", bot.done, JSON.stringify(bot));
  } else {
    console.log(`INFO  Level ${lv}: Bot ${bot.pct}% (Tode ${bot.deaths}${bot.done ? ", absolviert" : ""}) — bewusst anspruchsvoller`);
  }
}

/* 13. DOM-Integritaet: alle in JS referenzierten IDs existieren in index.html */
const html = fs.readFileSync("index.html", "utf8");
const jsIds = [...new Set([...code.matchAll(/(?:getElementById|\.el)\("([^"]+)"\)/g)].map(m => m[1]))];
const missingIds = jsIds.filter(id => !html.includes(`id="${id}"`));
check("Alle referenzierten DOM-IDs existieren (" + jsIds.length + ")", missingIds.length === 0, missingIds.join(", "));

console.log("");
console.log(failures === 0 ? "ALLE TESTS BESTANDEN" : failures + " TEST(S) FEHLGESCHLAGEN");
process.exit(failures === 0 ? 0 : 1);
