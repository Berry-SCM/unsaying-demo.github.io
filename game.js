'use strict';
// ================================================================
//  UNSAYING  v6
//  Fullscreen letterbox · 8-dir animated player · sprite integration
//  Controls: WASD/Arrows move · hold E erase · TAB guide · R reset
// ================================================================

// ── VIRTUAL CANVAS & FULLSCREEN ───────────────────────────────────
const VW = 960, VH = 600;
let cScale = 1, cOX = 0, cOY = 0;

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const sw = window.innerWidth  / VW;
  const sh = window.innerHeight / VH;
  cScale = Math.min(sw, sh);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  cOX = (window.innerWidth  - VW * cScale) / 2;
  cOY = (window.innerHeight - VH * cScale) / 2;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Begin a virtual-coord render pass
function beginVirtual() {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(cOX, cOY);
  ctx.scale(cScale, cScale);
  // Clip to virtual canvas
  ctx.beginPath();
  ctx.rect(0, 0, VW, VH);
  ctx.clip();
}
function endVirtual() { ctx.restore(); }

// roundRect polyfill
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    r = Math.min(r, w/2, h/2);
    this.beginPath();
    this.moveTo(x+r,y); this.lineTo(x+w-r,y); this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r); this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h); this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r); this.quadraticCurveTo(x,y,x+r,y);
    this.closePath();
  };
}

// ── SPRITE LOADING ────────────────────────────────────────────────
const SPR = {};

function loadImg(key, src) {
  const img = new Image();
  img.src = src;
  SPR[key] = img;
  return img;
}

// Floor & water textures
loadImg('floor_warm',  'Assets/floor_warm.png');
loadImg('floor_grass', 'Assets/floor_grass.png');

// Water GIF — must be in the live DOM for browser to keep animating it.
// A hidden <img> in the DOM ensures the GIF keeps ticking each frame.
const _waterDomImg = document.createElement('img');
_waterDomImg.src = 'Assets/water.gif';
_waterDomImg.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
document.body.appendChild(_waterDomImg);
SPR['water'] = _waterDomImg;

// Game object sprites
loadImg('lpc_door',        'Assets/lpc-doors-animated-1.png'); // 384×544, 6 cols × 8 rows of 64×64
loadImg('menu_bg',         'Assets/menu_bg.png');      // 1586×992 title background
loadImg('intro_splash',    'intro/Intro_Screen.png'); // studio splash before menu
loadImg('studio_logo',     'intro/logo.png');         // BuzzHornet Studios logo for credits
loadImg('bird_sheet',      'Assets/bird_sheet.png');   // 1000×250, 4 frames × 250px wide
loadImg('birdhouse',       'Assets/birdhouse.png');    // 372×671
loadImg('creature',        'Assets/creature.png');       // 500×500 neutral fallback
loadImg('creature_happy',  'Assets/creature_happy.png'); // erased / at peace
loadImg('creature_angry',  'Assets/creature_angry.png'); // labeled / hostile
// Environment props — collision is only the pixel-art content region, not transparent padding
loadImg('crate_prop',      'Assets/crate_png.png');      // 500×500, content 62%×64% centred
loadImg('stone_pillar',    'Assets/stone_pillar.png');   // 316×790, content 62%w × 85%h centred
loadImg('wooden_fence',    'Assets/wooden_fence.png');   // 707×353, content 71%w × 69%h centred
loadImg('bridge_spr',      'Assets/bridge.png');           // pixel-art wooden bridge, top-down
loadImg('wheel',           'Assets/wheel.png');           // square pixel-art wagon wheel, rotates with nudge
loadImg('heart_full',      'Assets/heart_full.png');     // health HUD – full
loadImg('heart_empty',     'Assets/heart_empty.png');    // health HUD – lost
loadImg('mirror',          'Assets/mirror.png');       // 376×664
loadImg('panel_on',          'Assets/panel_on.png');          // 600×416
loadImg('panel_off',         'Assets/panel_off.png');
loadImg('labelling_machine', 'Assets/labelling_machine.png'); // 500×500 RGBA

// New puzzle sprites
loadImg('wilted_plant',   'Assets/wilted_plant.png');    // 433×577, content ~252×419 at (90,80)
loadImg('unwilted_plant', 'Assets/unwilted_plant.png');  // 433×577, content ~267×445 at (80,62)
loadImg('closed_chest',   'Assets/closed_chest.png');   // 558×447, content ~329×298 at (111,70)
loadImg('opened_chest',   'Assets/opened_chest.png');   // 558×447, content ~340×349 at (100,36)
loadImg('lit_lantern',    'Assets/lit_lantern.png');    // 353×707, content ~238×630 at (56,22)
loadImg('unlit_lantern',  'Assets/unlit_lantern.png');  // 353×707, content ~238×630 at (56,22)
loadImg('grain_sack',     'Assets/grain_sack.png');     // 499×499, content ~225×232 at (131,135)
loadImg('tree_sheet',     'Assets/Tree_SpriteSheet_Outlined.png'); // 448×224, 5×2 cells of 89×112

// Boat — capture first frame from GIF into an offscreen canvas so it stays static
const _boatCanvas = document.createElement('canvas');
_boatCanvas.width = 512; _boatCanvas.height = 512;
const _boatOffCtx = _boatCanvas.getContext('2d');
const _boatSrcImg = new Image();
_boatSrcImg.onload = () => _boatOffCtx.drawImage(_boatSrcImg, 0, 0);
_boatSrcImg.src = 'Assets/boat.gif';
SPR['boat'] = _boatCanvas;

// Tree cell crop coordinates in the sprite sheet (row 0 only)
// Each cell is 89×112. Content within each cell:
const TREE_CELLS = [
  {sx:  1, sy:40, sw:69, sh:72},   // col0: small round tree
  {sx: 94, sy:21, sw:83, sh:91},   // col1: medium round tree
  {sx:178, sy:24, sw:88, sh:88},   // col2: large round tree
  {sx:267, sy: 0, sw:85, sh:112},  // col3: tall pine tree
  {sx:375, sy:29, sw:65, sh:83},   // col4: bare dead tree (no leaves)
];

// ── CHARACTER SPRITES ─────────────────────────────────────────────
// 8 directions: south, north, east, west + diagonals
// Each direction: 1 idle frame + 6 walk frames
const DIRS = ['south','north','east','west','south-east','south-west','north-east','north-west'];
const charIdle = {};   // dir → Image
const charWalk = {};   // dir → Image[6]

DIRS.forEach(d => {
  charIdle[d] = loadImg(`idle_${d}`, `Assets/Character/rotations/${d}.png`);
  charWalk[d] = [];
  for (let i = 0; i < 6; i++) {
    charWalk[d].push(loadImg(`walk_${d}_${i}`, `Assets/Character/animations/Walk/${d}/frame_00${i}.png`));
  }
});

// ── PLAY ZONE ─────────────────────────────────────────────────────
const PZ = { t: 34, b: 566 };

// ── PALETTE (fallback colours when sprites absent) ────────────────
const PAL = {
  wall: '#2a1e16', water_a: '#3470a8', water_b: '#1c5080',
  door_wood: '#8a4a20', door_frame: '#5a2e10',
  bridge_plank: '#c08830', bridge_rail: '#7a5020',
  creature_h: '#d04828', creature_n: '#50a050',
  wheel_rim: '#7a4820', wheel_spoke: '#9a6030',
  bird_body: '#d09020', nest_wood: '#8a5020',
  mirror_frame: '#a09080', mirror_glass: '#c8c4b8',
  engine_body: '#302020', panel_a: '#4a2020', panel_n: '#203020',
  dial_face: '#3a2c24', player_body: '#e08030', player_edge: '#b05a10',
  exit_open: '#40c040',
  hud: 'rgba(10,8,6,0.92)', hint: 'rgba(10,8,6,0.80)',
  c_main: '#ece0c8', c_dim: '#907860', c_gold: '#c09820', c_deny: '#e05040',
  sticker_bg: '#ffffff', sticker_bdr: '#222222', sticker_txt: '#111111',
  plaque_bg: '#4a4438', plaque_txt: '#c8bc98',
};

// ── AUDIO ─────────────────────────────────────────────────────────
// All volumes are normalised so SFX sit clearly above BGM.
// BGM: ~0.28–0.30  |  SFX: 0.55–0.75
// "Erase" loops continuously while E is held; stops on release.
// "Deny" hard-stops after 1 second regardless of file length.

let _audioUnlocked = false;

function _mkAudio(src, vol, loop=false) {
  const a = new Audio(src);
  a.volume = clamp(vol, 0, 1);
  a.loop   = loop;
  return a;
}

// Background music
const _bgmAmbient = _mkAudio('Assets/Audio/music_ambient.mp3', 0.38, true);
const _bgmMachine = _mkAudio('Assets/Audio/music_machine.mp3', 0.26, true);
// Intro splash sound — plays once before the menu
const _introSfx = _mkAudio('intro/intro_sound.wav', 0.85, false);
let   _activeBGM  = null;

function setBGM(key) {
  if (!_audioUnlocked) return;
  if (key === 'machine') {
    if (!_bgmAmbient.paused) _bgmAmbient.pause();
    // Only reset currentTime when switching TO machine (avoid restart on same-level reload)
    if (_activeBGM !== 'machine') _bgmMachine.currentTime = 0;
    _bgmMachine.play().catch(()=>{});
  } else {
    if (!_bgmMachine.paused) _bgmMachine.pause();
    // Always call play() — if already playing this is a no-op; if it failed before, retries it
    _bgmAmbient.play().catch(()=>{});
  }
  _activeBGM = key;
}

// SFX
const _sfxErase    = _mkAudio('Assets/Audio/sfx_erase.wav',    0.68, true); // looped while holding E
const _sfxDeny     = _mkAudio('Assets/Audio/sfx_deny.wav',     0.55);
const _sfxSolve    = _mkAudio('Assets/Audio/sfx_solve.wav',    0.72);
const _sfxComplete = _mkAudio('Assets/Audio/sfx_complete.wav', 0.68);
const _sfxClick    = _mkAudio('Assets/Audio/sfx_click.wav',    0.58);
const _sfxStamp    = _mkAudio('Assets/Audio/dispenser_stamp.wav', 0.65); // label re-stamped
const _sfxTick     = _mkAudio('Assets/Audio/timer_tick.wav',    0.48); // countdown tick
const _sfxHurt     = _mkAudio('Assets/Audio/sfx_hurt.wav',      0.75); // player takes damage
let   _eraseOn     = false;
let   _denyTimer   = null;

function startEraseSound() {
  if (_eraseOn || !_audioUnlocked) return;
  _eraseOn = true;
  _sfxErase.currentTime = 0;
  _sfxErase.play().catch(()=>{});
}
function stopEraseSound() {
  if (!_eraseOn) return;
  _eraseOn = false;
  _sfxErase.pause();
  _sfxErase.currentTime = 0;
}

function sndCant() {
  if (!_audioUnlocked) return;
  if (_denyTimer) { clearTimeout(_denyTimer); _denyTimer = null; }
  _sfxDeny.currentTime = 0;
  _sfxDeny.play().catch(()=>{});
  _denyTimer = setTimeout(() => {
    _sfxDeny.pause(); _sfxDeny.currentTime = 0; _denyTimer = null;
  }, 1000);
}
function sndActivate() {
  if (!_audioUnlocked) return;
  _sfxSolve.currentTime = 0; _sfxSolve.play().catch(()=>{});
}
function sndSolve() {
  if (!_audioUnlocked) return;
  _sfxComplete.currentTime = 0; _sfxComplete.play().catch(()=>{});
}
function sndNudge() {
  if (!_audioUnlocked) return;
  _sfxClick.currentTime = 0; _sfxClick.play().catch(()=>{});
}
function sndStamp() {
  if (!_audioUnlocked) return;
  _sfxStamp.currentTime = 0; _sfxStamp.play().catch(()=>{});
}
function sndTick() {
  if (!_audioUnlocked) return;
  _sfxTick.currentTime = 0; _sfxTick.play().catch(()=>{});
}
function sndHurt() {
  if (!_audioUnlocked) return;
  _sfxHurt.currentTime = 0; _sfxHurt.play().catch(()=>{});
}
function sndErase() { /* handled by startEraseSound / stopEraseSound */ }

function initAudio() {}  // kept for compatibility — no-op now
function resumeAC()  {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  setBGM(G.scene === 'play' && G.lvIdx === 6 ? 'machine' : 'ambient');
}

// ── PARTICLES ─────────────────────────────────────────────────────
const parts = [];
function spawnParts(cx,cy,col='#fff8e0',n=14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random()*Math.PI*2, s = 60+Math.random()*120;
    parts.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:1,sz:2+Math.random()*4,col});
  }
}
function tickParts(dt) {
  for (let i = parts.length-1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 160*dt; p.life -= dt*2;
    if (p.life <= 0) parts.splice(i,1);
  }
}
function drawParts() {
  for (const p of parts) {
    ctx.save(); ctx.globalAlpha = p.life*p.life;
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── INPUT ─────────────────────────────────────────────────────────
const K = {}, KJ = {};
window.addEventListener('keydown', e => {
  if (!K[e.code]) KJ[e.code] = true;
  K[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { K[e.code] = false; });
function consumeKey(c) { const v = KJ[c]; KJ[c] = false; return v; }

// ── MATH ──────────────────────────────────────────────────────────
function dist(ax,ay,bx,by) { return Math.hypot(bx-ax, by-ay); }
function clamp(v,lo,hi)    { return v<lo?lo:v>hi?hi:v; }
function distToRect(px,py,rx,ry,rw,rh) {
  return dist(px,py, clamp(px,rx,rx+rw), clamp(py,ry,ry+rh));
}
function circleRect(cx,cy,r,rx,ry,rw,rh) { return distToRect(cx,cy,rx,ry,rw,rh) < r; }
function rr(x,y,w,h,rad) { ctx.beginPath(); ctx.roundRect(x,y,w,h,rad); }

// ── DIRECTION LOGIC ───────────────────────────────────────────────
function getDirFromVelocity(dx, dy) {
  if (dx === 0 && dy === 0) return null;
  const deg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
  // E=0, SE=45, S=90, SW=135, W=180, NW=225, N=270, NE=315
  if (deg >= 337.5 || deg < 22.5)   return 'east';
  if (deg >= 22.5  && deg < 67.5)   return 'south-east';
  if (deg >= 67.5  && deg < 112.5)  return 'south';
  if (deg >= 112.5 && deg < 157.5)  return 'south-west';
  if (deg >= 157.5 && deg < 202.5)  return 'west';
  if (deg >= 202.5 && deg < 247.5)  return 'north-west';
  if (deg >= 247.5 && deg < 292.5)  return 'north';
  return 'north-east';
}

// ── LABEL DRAWING ─────────────────────────────────────────────────
// Wrong label  (acc=false) → WHITE PAPER STICKER  — pasted on, removable
// Correct label (acc=true) → DARK METAL PLAQUE    — belongs here
//
// Labels are ALWAYS drawn above or below the sprite, never overlapping it.
// getLabelCY() returns the center-Y of the label box given the sprite's top edge.

function getLabelBoxH(numLines, accurate) {
  const lh = accurate ? 14 : 18;
  return numLines * lh + (accurate ? 8 : 14);
}

// Returns Y center of label positioned above spriteTop
function labelAboveCY(spriteTop, numLines, accurate) {
  const ph = getLabelBoxH(numLines, accurate);
  const GAP = 8;
  const cy = spriteTop - GAP - ph/2;
  // Clamp so label stays in play zone
  return Math.max(PZ.t + ph/2 + 4, cy);
}

// Returns Y center of label positioned below spriteBottom
function labelBelowCY(spriteBottom, numLines, accurate) {
  const ph = getLabelBoxH(numLines, accurate);
  const GAP = 8;
  return Math.min(PZ.b - ph/2 - 4, spriteBottom + GAP + ph/2);
}

function drawLabelAt(lines, cx, cy, accurate, alpha, shakeX, tilt) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  const font = accurate ? '11px "Courier New",monospace' : 'bold 13px "Courier New",monospace';
  ctx.font = font;
  const lh = accurate ? 14 : 18;
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
  const pw = accurate ? maxW + 14 : maxW + 20;
  const ph = getLabelBoxH(lines.length, accurate);

  // Keep label within play zone horizontally
  const safeCX = clamp((cx + (shakeX||0)), 54 + pw/2, VW - 54 - pw/2);
  const safeCY = clamp(cy, PZ.t + ph/2 + 4, PZ.b - ph/2 - 4);

  ctx.translate(safeCX, safeCY);
  ctx.rotate(tilt || 0);

  if (accurate) {
    // Metal plaque — dark, engraved text
    ctx.fillStyle = PAL.plaque_bg;
    rr(-pw/2,-ph/2,pw,ph,3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    rr(-pw/2,-ph/2,pw,ph,3); ctx.stroke();
    ctx.fillStyle = PAL.plaque_txt;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l,i) => ctx.fillText(l, 0, -ph/2 + 6 + (i+0.5)*lh));
  } else {
    // White sticker — shadow, bold, tape corners
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    ctx.fillStyle = PAL.sticker_bg;
    rr(-pw/2,-ph/2,pw,ph,4); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = PAL.sticker_bdr; ctx.lineWidth = 2.5;
    rr(-pw/2,-ph/2,pw,ph,4); ctx.stroke();
    // Tape corners
    ctx.fillStyle = 'rgba(200,200,180,0.6)';
    ctx.fillRect(-pw/2-3, -ph/2-5, 14, 8);
    ctx.fillRect( pw/2-11,-ph/2-5, 14, 8);
    ctx.fillStyle = PAL.sticker_txt;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l,i) => ctx.fillText(l, 0, -ph/2 + 7 + (i+0.5)*lh));
  }

  ctx.restore();
}

// ── GAME OBJECT ───────────────────────────────────────────────────
class GObj {
  constructor(d) {
    this.id = d.id; this.type = d.type;
    if (d.r != null) { this.cx=d.x; this.cy=d.y; this.r=d.r; this.isCirc=true; }
    else             { this.x=d.x;  this.y=d.y;  this.w=d.w; this.h=d.h; this.isCirc=false; }
    this._ix = this.isCirc?d.x:d.x;
    this._iy = this.isCirc?d.y:d.y;
    this._initLbls = (d.labels||[]).map(l=>({...l}));
    this.labels    = this._initLbls.map(l=>({...l}));
    this._initNdg  = d.nudge ? {...d.nudge} : null;
    this.nudge     = d.nudge ? {...d.nudge} : null;
    this._initSolid = d.solid ?? (this.labels.length > 0);
    this.solid = this._initSolid;
    this.active = false; this.animT = 0; this.visible = d.visible ?? true;
    this.shakeT = 0;
    this.tilt = d.tilt ?? (Math.random()-0.5)*0.06;
    this.walkTx=null; this.walkTy=null; this.walked=false;
    this.flyTx=null;  this.flyTy=null;  this.arrived=false;
    this.special = d.special ?? null;
    // Bird animation state
    this.birdAnimT = 0; this.birdFrame = 0;
    // Regen / dispenser state
    this._regenT = null; this._regenTicks = 0;
    // Patrol state
    this.patrol = d.patrol ?? null;
    this._patDir = 1;
    // Contact-damage state (used by patrol creatures)
    this._contactT = 0;
    // Key / inventory mechanic
    this.requiresItem = d.requiresItem ?? null;
    this.grantItem    = d.grantItem    ?? null;
  }
  get pcx() { return this.isCirc ? this.cx : this.x + this.w/2; }
  get pcy() { return this.isCirc ? this.cy : this.y + this.h/2; }
  // Sprite bounding box top (for label positioning)
  get spriteTop()    { return this.isCirc ? this.cy - this.r : this.y; }
  get spriteBottom() { return this.isCirc ? this.cy + this.r : this.y + this.h; }
  distToPoint(px,py) {
    if (this.isCirc) return Math.max(0, dist(px,py,this.cx,this.cy) - this.r);
    return distToRect(px,py,this.x,this.y,this.w,this.h);
  }
  get isNeutral() { return this.labels.length === 0; }
  get hasLabel()  { return this.labels.length > 0; }
  get canErase()  { return this.labels.length > 0 && !this.labels[0].acc; }
  get canNudge()  { return this.isNeutral && this.nudge !== null && !this.active; }
  nudgeSolved()   { return this.nudge && Math.abs(this.nudge.value - this.nudge.target) <= this.nudge.tol; }
  erase() {
    this.labels.shift();
    spawnParts(this.pcx, this.pcy, '#fff0c0', 16);
    sndErase();
    if (this.labels.length === 0 && !this.nudge) this._solve();
  }
  _solve() {
    this.active = true; sndActivate();
    spawnParts(this.pcx, this.pcy, '#d4c030', 22);
    if (['door','gate','bridge','panel','plant','chest','lantern'].includes(this.type)) this.solid = false;
    if (this.special === 'vanish') { this.solid = false; setTimeout(() => { this.visible = false; }, 600); }
  }
  reset() {
    this.labels  = this._initLbls.map(l=>({...l}));
    this.nudge   = this._initNdg ? {...this._initNdg} : null;
    this.solid   = this._initSolid;
    this.active  = false; this.animT = 0; this.visible = true; this.shakeT = 0;
    if (this.isCirc) { this.cx = this._ix; this.cy = this._iy; }
    else             { this.x  = this._ix; this.y  = this._iy; }
    this.walkTx=null; this.walkTy=null; this.walked=false;
    this.flyTx=null;  this.flyTy=null;  this.arrived=false;
    this.birdAnimT=0; this.birdFrame=0;
    this._regenT=null; this._regenTicks=0;
    this._patDir=1; this._contactT=0;
  }
}

// ── EXIT & WALLS ──────────────────────────────────────────────────
const EXIT_X=910, EXIT_Y=193, EXIT_W=50, EXIT_H=214;

function makeBorderWalls() {
  return [
    {x:0,   y:0,    w:VW, h:PZ.t},
    {x:0,   y:PZ.b, w:VW, h:VH-PZ.b},
    {x:0,   y:PZ.t, w:50, h:PZ.b-PZ.t},
    {x:910, y:PZ.t, w:50, h:EXIT_Y-PZ.t},
    {x:910, y:EXIT_Y+EXIT_H, w:50, h:PZ.b-(EXIT_Y+EXIT_H)},
  ];
}

// Adds invisible trunk-collision walls for each tree in a decor array.
// Call this AFTER defining decor, BEFORE returning the level object.
// Only the lower-center trunk area gets a wall — canopy is transparent.
function addTreeWalls(walls, decor) {
  if (!decor) return;
  for (const d of decor) {
    if (d.type !== 'tree') continue;
    const dw = d.w ?? 80, dh = d.h ?? 110;
    // Canopy — wide upper collision covering the leafy mass
    walls.push({
      x: Math.round(d.x + dw * 0.08),
      y: Math.round(d.y + dh * 0.04),
      w: Math.round(dw * 0.84),
      h: Math.round(dh * 0.58),
      _trunk: true,
    });
    // Trunk — narrow collision at base
    walls.push({
      x: Math.round(d.x + dw * 0.37),
      y: Math.round(d.y + dh * 0.72),
      w: Math.round(dw * 0.26),
      h: Math.round(dh * 0.28),
      _trunk: true,
    });
  }
}

// Adds collision walls for crate / pillar / fence decor items.
// Collision is computed from the ACTUAL PIXEL CONTENT region of each sprite,
// ignoring transparent padding.  Fractions measured empirically:
//   crate:  left=19.6% top=16.8% right=18.6% bottom=19.4%  → content 61.8%×63.8%
//   pillar: left=19.0% top= 6.1% right=19.0% bottom= 8.5%  → content 62.0%×85.4%
//   fence:  left=14.6% top=15.6% right=14.6% bottom=15.9%  → content 70.9%×68.6%
function addPropWalls(walls, decor) {
  if (!decor) return;
  for (const d of decor) {
    const dw = d.w ?? 64, dh = d.h ?? 64;
    if (d.type === 'crate') {
      walls.push({
        x: Math.round(d.x + dw * 0.196), y: Math.round(d.y + dh * 0.168),
        w: Math.round(dw * 0.618),        h: Math.round(dh * 0.638),
        _prop: true,
      });
    } else if (d.type === 'pillar') {
      walls.push({
        x: Math.round(d.x + dw * 0.190), y: Math.round(d.y + dh * 0.061),
        w: Math.round(dw * 0.620),        h: Math.round(dh * 0.854),
        _prop: true,
      });
    } else if (d.type === 'fence') {
      walls.push({
        x: Math.round(d.x + dw * 0.146), y: Math.round(d.y + dh * 0.156),
        w: Math.round(dw * 0.709),        h: Math.round(dh * 0.686),
        _prop: true,
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
//  LEVELS
// ══════════════════════════════════════════════════════════════════

// L0 — The Locked Door
function buildLevel0() {
  const walls = makeBorderWalls();
  walls.push({x:420,y:PZ.t,w:90,h:210-PZ.t});
  walls.push({x:420,y:300,w:90,h:PZ.b-300});
  return {
    id:0, name:'The Locked Door', bg:'warm',
    intro:['A door.','The label says: LOCKED.','But something nearby has been labeled SEALED.','Labels are just words. Start with what you can reach.'],
    pStart:{x:130,y:300}, walls, water:null,
    decor:[],
    objs:[
      new GObj({id:'chest0',type:'chest',x:148,y:418,w:62,h:50,
        labels:[{text:'SEALED',acc:false}],solid:false,tilt:-0.03,
        grantItem:'key0'}),
      new GObj({id:'door0',type:'door',x:420,y:210,w:90,h:90,
        labels:[{text:'LOCKED',acc:false}],solid:true,tilt:0.04,
        requiresItem:'key0'}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='door0')?.isNeutral,
    grantLabel:'OPENER',
    hint:'Erase the chest\'s label first. Then use what you find on the door.',
    solveMsg:'The door was never locked.',
  };
}

// L1 — The Unsafe Bridge
function buildLevel1() {
  const walls = makeBorderWalls();
  walls.push({x:370,y:PZ.t,w:170,h:262-PZ.t,isWater:true});
  walls.push({x:370,y:342,w:170,h:PZ.b-342,isWater:true});
  return {
    id:1, name:'The Unsafe Bridge', bg:'grass',
    intro:['A river crossing.','The bridge: UNSAFE. DO NOT CROSS.','Neither label is true.','Something was left behind on the other side.'],
    pStart:{x:150,y:300}, walls,
    water:[{x:370,y:PZ.t,w:170,h:PZ.b-PZ.t}],
    decor:(()=>{const d=[
      {type:'tree', col:1, x:52,  y:390, w:80, h:112},
      {type:'tree', col:0, x:200, y:110, w:68, h:90},
      {type:'tree', col:2, x:640, y:405, w:85, h:110},
      {type:'boat', x:408, y:80,  w:92,  h:82},
    ]; addTreeWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'bridge',type:'bridge',x:370,y:258,w:170,h:88,
        labels:[{text:'UNSAFE',acc:false},{text:'DO NOT CROSS',acc:false}],solid:true,tilt:-0.03}),
      new GObj({id:'chest1',type:'chest',x:790,y:400,w:72,h:58,
        labels:[{text:'FORGOTTEN',acc:false}],solid:false,tilt:0.03}),
      new GObj({id:'gate1',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='bridge')?.isNeutral &&
                 G.lv.objs.find(o=>o.id==='chest1')?.isNeutral,
    grantLabel:'CROSSER',
    hint:'Clear the bridge, cross over, then find what was left behind.',
    solveMsg:'Nothing is forgotten anymore.',
  };
}

// L2 — The Dangerous Creature
function buildLevel2() {
  const walls = makeBorderWalls();
  walls.push({x:450,y:PZ.t,w:64,h:224-PZ.t});
  walls.push({x:450,y:388,w:64,h:PZ.b-388});
  return {
    id:2, name:'The Dangerous Creature', bg:'warm',
    intro:['A creature blocks the path.','It has kind eyes.','But the label makes it frightening.','Not every label here is wrong. Read carefully.'],
    pStart:{x:140,y:305}, walls, water:null,
    decor:[],
    objs:[
      new GObj({id:'plant2',type:'plant',x:280,y:390,w:55,h:74,
        labels:[{text:'DISEASED',acc:false}],solid:false,tilt:-0.03}),
      new GObj({id:'creature',type:'creature',x:492,y:306,r:72,
        labels:[{text:'DANGEROUS',acc:false}],solid:true,tilt:0.05}),
      new GObj({id:'gentle2',type:'creature',x:750,y:430,r:42,
        labels:[{text:'GENTLE',acc:true}],solid:false,tilt:0.04}),
      new GObj({id:'gate2',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='creature')?.isNeutral === true &&
                 G.lv.objs.find(o=>o.id==='plant2')?.isNeutral === true,
    grantLabel:'PEACEMAKER',
    hint:'Erase DANGEROUS and DISEASED. Leave GENTLE alone — it\'s true.',
    solveMsg:'It was never dangerous.',
  };
}

// L3 — The Untouchable Wheel
function buildLevel3() {
  const walls = makeBorderWalls();
  walls.push({x:50,y:PZ.t,w:96,h:PZ.b-PZ.t,isWater:true});
  return {
    id:3, name:'The Untouchable Wheel', bg:'warm',
    intro:['An old water wheel.','Two labels keep it frozen.','Labels are not facts.'],
    pStart:{x:580,y:305}, walls,
    water:[{x:50,y:PZ.t,w:96,h:PZ.b-PZ.t}],
    decor:[
      {type:'boat', x:54, y:85, w:82, h:74},
    ],
    objs:[
      new GObj({id:'wheel',type:'wheel',x:232,y:305,r:68,
        labels:[{text:'DO NOT TOUCH',acc:false},{text:'OUT OF USE',acc:false}],solid:false,tilt:0.03,
        nudge:{value:0.42,target:0.0,tol:0.07,range:0.5,dir:0}}),
      new GObj({id:'gate3',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:(s)=>s.wheelAligned,
    grantLabel:'ADJUSTER',
    hint:'Erase both labels. Then press E near the wheel to adjust it.',
    solveMsg:'The mill runs again.',
  };
}

// L4 — The Pest
function buildLevel4() {
  const walls = makeBorderWalls();
  return {
    id:4, name:'The Pest', bg:'garden',
    intro:['A bird searching for home.','The house says: NOT IN USE.','The bird says: PEST.','Neither is true.'],
    pStart:{x:140,y:420}, walls, water:null,
    decor:(()=>{const d=[
      {type:'tree', col:2, x:52,  y:118, w:88, h:115},
      {type:'tree', col:0, x:52,  y:430, w:68, h:92},
      {type:'tree', col:1, x:288, y:108, w:80, h:110},
      {type:'tree', col:3, x:540, y:430, w:75, h:122},
      // Fence sections along garden edges — purely aesthetic corners
      {type:'fence', x:640, y:460, w:116, h:50},
      {type:'fence', x:390, y: 68, w:116, h:50},
    ]; addTreeWalls(walls,d); addPropWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'bird',type:'bird',x:380,y:320,r:24,
        labels:[{text:'PEST',acc:false}],solid:false,tilt:0.06}),
      new GObj({id:'birdhouse',type:'birdhouse',x:730,y:200,w:55,h:99,
        labels:[{text:'NOT IN USE',acc:false}],solid:true,tilt:-0.04}),
      new GObj({id:'gate4',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:(s)=>s.birdHome,
    grantLabel:'GENTLE',
    hint:'The bird needs a home. Erase both labels.',
    solveMsg:'Home.',
  };
}

// L5 — The Mirror
function buildLevel5() {
  const walls = makeBorderWalls();
  return {
    id:5, name:'The Mirror', bg:'warm',
    intro:['You\'ve been collecting labels along the way.','Words others placed on you.','The mirror shows them.','Look — and let them go.'],
    pStart:{x:160,y:305}, walls, water:null,
    decor:(()=>{const d=[
      // Stone pillars at four room corners — ornate chamber feel, don't block the mirror
      {type:'pillar', x: 54, y: 46, w:32, h:88},
      {type:'pillar', x:874, y: 46, w:32, h:88},
      {type:'pillar', x: 54, y:460, w:32, h:88},
      {type:'pillar', x:874, y:460, w:32, h:88},
    ]; addPropWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'mirror',type:'mirror',x:400,y:130,w:175,h:310,labels:[],solid:true}),
      new GObj({id:'gate5',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:(s)=>s.selfClear,
    grantLabel:null,
    hint:'Hold E near the mirror to let go of the labels you\'ve been given.',
    solveMsg:'You were never just those words.',
  };
}

// L6 — The Labeling Machine
function buildLevel6() {
  const walls = makeBorderWalls();
  // No separate engine wall — the dial object itself covers the full machine area
  return {
    id:6, name:'The Labeling Machine', bg:'dark',
    intro:['This is the source.','A machine that labeled the world.','Every wrong name came from here.','Turn it off.'],
    pStart:{x:120,y:490}, walls, water:null,
    decor:(()=>{const d=[
      // Storage crates flanking the machine at top — industrial clutter along the back wall
      {type:'crate', x: 54, y: 44, w:58, h:58},
      {type:'crate', x:118, y: 44, w:58, h:58},
      {type:'crate', x:762, y: 44, w:58, h:58},
      {type:'crate', x:826, y: 44, w:58, h:58},
    ]; addPropWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'panelA',type:'panel',x:228,y:381,w:100,h:68,
        labels:[{text:'RUNNING',acc:false}],solid:true,tilt:0.02}),
      new GObj({id:'panelB',type:'panel',x:346,y:381,w:100,h:68,
        labels:[{text:'ACTIVE',acc:false}],solid:true,tilt:-0.02}),
      new GObj({id:'panelC',type:'panel',x:464,y:381,w:100,h:68,
        labels:[{text:'ONLINE',acc:false}],solid:true,tilt:0.03}),
      new GObj({id:'panelD',type:'panel',x:582,y:381,w:100,h:68,
        labels:[{text:'ENABLED',acc:false}],solid:true,tilt:-0.01}),
      new GObj({id:'manual',type:'notice',x:60,y:445,w:88,h:34,
        labels:[{text:'DO NOT STOP',acc:true}],solid:false,tilt:0.0}),
      new GObj({id:'dial',type:'dial',x:210,y:80,w:550,h:295,
        labels:[{text:'DO NOT STOP',acc:false}],solid:true,tilt:0,
        nudge:{value:0.72,target:0.0,tol:0.08,range:0.75,dir:0}}),
      new GObj({id:'gate6',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='dial')?.active === true,
    regenRate:6, // panels re-stamp after 6s — the machine resists being stopped
    grantLabel:null,
    hint:'Clear all four panels fast. The machine fights back.',
    solveMsg:'The machine is quiet.',
  };
}

// ══════════════════════════════════════════════════════════════════
//  LEVELS 7–19
// ══════════════════════════════════════════════════════════════════

// L7 — The Dead Garden
// Three plants labeled DEAD scattered in an open garden.
// One plant labeled PERENNIAL (accurate) is a trap — don't erase it.
function buildLevel7() {
  const walls = makeBorderWalls();
  // Dividing inner wall — upper half only, creates top-left dead-end route
  walls.push({x:380,y:PZ.t,w:22,h:195-PZ.t});
  return {
    id:7, name:'The Dead Garden', bg:'garden',
    intro:['The first machine is silent.','But a backup unit keeps running.','Three plants, labeled DEAD.','None of them are dying.'],
    pStart:{x:220,y:430}, walls, water:null,
    decor:(()=>{const d=[
      {type:'tree', col:2, x:52,  y:420, w:88, h:115},
      {type:'tree', col:3, x:648, y:108, w:75, h:128},
      {type:'tree', col:0, x:828, y:415, w:68, h:92},
      // Fence in lower-right corner — the garden had boundaries once
      {type:'fence', x:430, y:460, w:116, h:50},
    ]; addTreeWalls(walls,d); addPropWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'p1',type:'plant',x:210,y:80,w:60,h:80,
        labels:[{text:'DEAD',acc:false}],solid:true,tilt:0.04}),
      new GObj({id:'p2',type:'plant',x:580,y:180,w:60,h:80,
        labels:[{text:'DEAD',acc:false}],solid:true,tilt:-0.03}),
      new GObj({id:'p3',type:'plant',x:740,y:370,w:60,h:80,
        labels:[{text:'DEAD',acc:false}],solid:true,tilt:0.05}),
      new GObj({id:'p4',type:'plant',x:130,y:260,w:55,h:72,
        labels:[{text:'PERENNIAL',acc:true}],solid:true,tilt:-0.02}),
      new GObj({id:'gate7',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>['p1','p2','p3'].every(id=>G.lv.objs.find(o=>o.id===id)?.isNeutral),
    regenRate:8, // backup unit keeps re-labeling the plants
    grantLabel:null,
    hint:'Three wrong labels. One true one. The backup unit keeps re-stamping.',
    solveMsg:'The garden blooms.',
  };
}

// L8 — The Crossing
// River splits the room. Bridge labeled ROTTEN blocks it.
// After crossing, a creature labeled LOST blocks access to the gate.
function buildLevel8() {
  const walls = makeBorderWalls();
  // River walls with gap at y:244–344 where bridge sits
  walls.push({x:310,y:PZ.t,  w:130,h:248-PZ.t,  isWater:true});
  walls.push({x:310,y:340,   w:130,h:PZ.b-340,   isWater:true});
  // Creature corridor walls (gap at y:224–388)
  walls.push({x:570,y:PZ.t,  w:50, h:224-PZ.t});
  walls.push({x:570,y:388,   w:50, h:PZ.b-388});
  return {
    id:8, name:'The Crossing', bg:'grass',
    intro:['A river separates you from a creature.','The bridge calls itself ROTTEN.','The creature calls itself LOST.','Something ABANDONED waits beyond.'],
    pStart:{x:120,y:300}, walls,
    water:[{x:310,y:PZ.t,w:130,h:PZ.b-PZ.t}],
    decor:(()=>{const d=[
      {type:'tree', col:1, x:52,  y:405, w:80, h:110},
      {type:'boat', x:334, y:85,  w:68,  h:60},
      {type:'tree', col:0, x:698, y:420, w:68, h:92},
    ]; addTreeWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'bridge8',type:'bridge',x:310,y:244,w:130,h:100,
        labels:[{text:'ROTTEN',acc:false}],solid:true,tilt:-0.02}),
      new GObj({id:'cr8',type:'creature',x:636,y:306,r:66,
        labels:[{text:'LOST',acc:false}],solid:true,tilt:0.04}),
      new GObj({id:'chest8',type:'chest',x:820,y:420,w:70,h:56,
        labels:[{text:'ABANDONED',acc:false}],solid:false,tilt:-0.02}),
      new GObj({id:'gate8',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='bridge8')?.isNeutral &&
                 G.lv.objs.find(o=>o.id==='cr8')?.isNeutral &&
                 G.lv.objs.find(o=>o.id==='chest8')?.isNeutral,
    grantLabel:null,
    hint:'Bridge, then creature, then what was left behind.',
    solveMsg:'The crossing is clear.',
  };
}

// L9 — The Dark Hall
// A fallen lantern blocks the only corridor. A creature lurks beyond.
function buildLevel9() {
  const walls = makeBorderWalls();
  // Corridor walls with gap at y:218–340 where lantern stands (h:122 ≈ sprite 238:630 ratio)
  walls.push({x:350,y:PZ.t,  w:50, h:218-PZ.t});
  walls.push({x:350,y:340,   w:50, h:PZ.b-340});
  // Creature corridor: gap exactly matches cr9 diameter (r:66→y:234–366)
  walls.push({x:580,y:PZ.t,  w:50, h:234-PZ.t});
  walls.push({x:580,y:366,   w:50, h:PZ.b-366});
  return {
    id:9, name:'The Dark Hall', bg:'dark',
    intro:['The hall has no light.','A lantern stands in the way, labeled DEAD.','Beyond it, something lurks.','And something else, forgotten in the dark.'],
    pStart:{x:120,y:300}, walls, water:null,
    decor:[],
    darkZone:{x:400, litBy:'ln9'},
    objs:[
      new GObj({id:'ln9',type:'lantern',x:354,y:218,w:46,h:122,
        labels:[{text:'DEAD',acc:false}],solid:true,tilt:0.02}),
      new GObj({id:'cr9',type:'creature',x:646,y:300,r:66,
        labels:[{text:'LURKING',acc:false}],solid:true,tilt:-0.04}),
      new GObj({id:'plant9',type:'plant',x:820,y:390,w:52,h:70,
        labels:[{text:'WITHERED',acc:false}],solid:false,tilt:0.04}),
      new GObj({id:'gate9',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='ln9')?.isNeutral &&
                 G.lv.objs.find(o=>o.id==='cr9')?.isNeutral &&
                 G.lv.objs.find(o=>o.id==='plant9')?.isNeutral,
    grantLabel:null,
    hint:'Light the lantern. Face what was hiding. Then find what was forgotten.',
    solveMsg:'The hall is clear.',
  };
}

// L10 — The Forgotten Nest
// Two creatures block the path. First FERAL, then RESTLESS near the nest.
// Must clear both, then fix the birdhouse and the bird.
function buildLevel10() {
  const walls = makeBorderWalls();
  // First creature corridor gap at y:220–390
  walls.push({x:430,y:PZ.t, w:55, h:220-PZ.t});
  walls.push({x:430,y:390,  w:55, h:PZ.b-390});
  // Second creature corridor gap at y:238–372 (r:52 at cy:305)
  walls.push({x:650,y:PZ.t, w:50, h:238-PZ.t});
  walls.push({x:650,y:372,  w:50, h:PZ.b-372});
  return {
    id:10, name:'The Forgotten Nest', bg:'garden',
    intro:['A bird has nowhere to go.','Two creatures block the way.','Neither label is earned.','The house is waiting.'],
    pStart:{x:130,y:305}, walls, water:null,
    decor:(()=>{const d=[
      {type:'tree', col:2, x:52,  y:408, w:88, h:115},
      {type:'tree', col:0, x:224, y:108, w:68, h:92},
      {type:'tree', col:1, x:628, y:420, w:80, h:110},
    ]; addTreeWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'bird10',type:'bird',x:280,y:200,r:24,
        labels:[{text:'STRAY',acc:false}],solid:false,tilt:0.05}),
      new GObj({id:'cr10',type:'creature',x:496,y:305,r:66,
        labels:[{text:'FERAL',acc:false}],solid:true,tilt:0.03}),
      new GObj({id:'cr10b',type:'creature',x:714,y:305,r:52,
        labels:[{text:'RESTLESS',acc:false}],solid:true,tilt:-0.04}),
      new GObj({id:'nest10',type:'birdhouse',x:820,y:160,w:55,h:99,
        labels:[{text:'ABANDONED',acc:false}],solid:true,tilt:-0.03}),
      new GObj({id:'gate10',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:(s)=>s.birdHome,
    grantLabel:null,
    hint:'Two creatures, one bird, one house. Clear the path step by step.',
    solveMsg:'Home found.',
  };
}

// L11 — The Old Mill
// Cross a river (bridge), then align a jammed water wheel to open the gate.
function buildLevel11() {
  const walls = makeBorderWalls();
  // River gap at y:250–350 for bridge
  walls.push({x:290,y:PZ.t, w:110,h:254-PZ.t, isWater:true});
  walls.push({x:290,y:346,  w:110,h:PZ.b-346,  isWater:true});
  // Wheel platform wall — narrow top gap only
  walls.push({x:550,y:PZ.t, w:30, h:180-PZ.t});
  return {
    id:11, name:'The Old Mill', bg:'grass',
    intro:['An old mill, silent.','The bridge: FLOODED.','The wheel: SEIZED.','A chest left RUSTED by the wheel.','None of these names are true.'],
    pStart:{x:120,y:300}, walls,
    water:[{x:290,y:PZ.t,w:110,h:PZ.b-PZ.t}],
    decor:(()=>{const d=[
      {type:'boat', x:308, y:88, w:68, h:60},
      {type:'tree', col:1, x:52,  y:408, w:80,  h:110},
      {type:'tree', col:3, x:698, y:415, w:75,  h:125},
    ]; addTreeWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'br11',type:'bridge',x:290,y:250,w:110,h:100,
        labels:[{text:'FLOODED',acc:false}],solid:true,tilt:0.02}),
      new GObj({id:'chest11',type:'chest',x:440,y:390,w:68,h:54,
        labels:[{text:'RUSTED',acc:false}],solid:false,tilt:0.02}),
      new GObj({id:'wh11',type:'wheel',x:480,y:210,r:68,
        labels:[{text:'SEIZED',acc:false},{text:'OUT OF ORDER',acc:false}],solid:false,tilt:0.0,
        nudge:{value:0.6,target:0.0,tol:0.08,range:0.65,dir:0}}),
      new GObj({id:'gate11',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:(s)=>s.wheelAligned &&
                  G.lv.objs.find(o=>o.id==='br11')?.isNeutral &&
                  G.lv.objs.find(o=>o.id==='chest11')?.isNeutral,
    grantLabel:null,
    hint:'Bridge, then the chest by the wheel, then align the wheel itself.',
    solveMsg:'The mill turns again.',
  };
}

// L12 — The Overgrown Path
// Four plants labeled SPRAWLING block a maze of garden corridors.
// Erase each to pass — but one plant has an accurate label (HARDY).
function buildLevel12() {
  const walls = makeBorderWalls();
  // Corridor maze — horizontal walls with gaps
  walls.push({x:200,y:PZ.t,  w:22, h:320-PZ.t});   // left-center divider (upper)
  walls.push({x:200,y:400,   w:22, h:PZ.b-400});     // left-center divider (lower)
  walls.push({x:430,y:220,   w:22, h:PZ.b-220});     // mid divider (lower)
  walls.push({x:650,y:PZ.t,  w:22, h:380-PZ.t});     // right divider (upper)
  return {
    id:12, name:'The Overgrown Path', bg:'garden',
    intro:['The garden has taken over.','Four plants block every path, labeled SPRAWLING.','But one plant has always been here — HARDY.','Not every label is wrong.'],
    pStart:{x:160,y:490}, walls, water:null,
    decor:(()=>{const d=[
      {type:'tree', col:3, x:52,  y:428, w:75, h:125},
      {type:'tree', col:1, x:708, y:420, w:80, h:110},
    ]; addTreeWalls(walls,d); return d; })(),
    objs:[
      // Plants blocking corridor segments
      new GObj({id:'sp1',type:'plant',x:100,y:240,w:60,h:80,
        labels:[{text:'SPRAWLING',acc:false}],solid:true,tilt:0.03}),
      new GObj({id:'sp2',type:'plant',x:300,y:420,w:60,h:80,
        labels:[{text:'SPRAWLING',acc:false}],solid:true,tilt:-0.04}),
      new GObj({id:'sp3',type:'plant',x:530,y:130,w:60,h:80,
        labels:[{text:'SPRAWLING',acc:false}],solid:true,tilt:0.05}),
      new GObj({id:'sp4',type:'plant',x:750,y:310,w:60,h:80,
        labels:[{text:'SPRAWLING',acc:false}],solid:true,tilt:-0.02}),
      // Accurate trap — don't erase
      new GObj({id:'sp5',type:'plant',x:490,y:390,w:55,h:72,
        labels:[{text:'HARDY',acc:true}],solid:true,tilt:0.01}),
      new GObj({id:'gate12',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>['sp1','sp2','sp3','sp4'].every(id=>G.lv.objs.find(o=>o.id===id)?.isNeutral),
    regenRate:7, // the garden keeps sprawling — clear all four before they regrow
    grantLabel:null,
    hint:'SPRAWLING is wrong. HARDY is right. And the garden won\'t stay clear for long.',
    solveMsg:'The path is clear.',
  };
}

// L13 — The Two Beasts
// Two creatures: one labeled FERAL (wrong), one labeled TAME (accurate).
// Only the FERAL one blocks the exit corridor. Erasing TAME plays deny.
function buildLevel13() {
  const walls = makeBorderWalls();
  // Exit corridor: gap exactly matches cr13b diameter (r:66→y:234–366)
  walls.push({x:560,y:PZ.t, w:50, h:234-PZ.t});
  walls.push({x:560,y:366,  w:50, h:PZ.b-366});
  return {
    id:13, name:'The Two Beasts', bg:'warm',
    intro:['Two creatures.','One is labeled TAME — and truly is.','One is labeled FERAL — and truly isn\'t.','Erase what\'s false. Leave what\'s true.'],
    pStart:{x:160,y:340}, walls, water:null,
    decor:[],
    objs:[
      // Friendly one in open lower area — well clear of player spawn
      new GObj({id:'cr13a',type:'creature',x:260,y:430,r:54,
        labels:[{text:'TAME',acc:true}],solid:false,tilt:-0.03}),
      // Feral one blocks the exit corridor
      new GObj({id:'cr13b',type:'creature',x:626,y:300,r:66,
        labels:[{text:'FERAL',acc:false}],solid:true,tilt:0.04,
        patrol:{x1:626,x2:820,spd:65}}),
      new GObj({id:'gate13',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='cr13b')?.isNeutral,
    grantLabel:null,
    hint:'Don\'t erase what\'s true. Wait for the FERAL one to move, then erase it.',
    solveMsg:'One beast at peace.',
  };
}

// L14 — The Frenzied Three
// Three creatures labeled FRENZIED block different corridors.
// All three must be calmed to open the gate.
function buildLevel14() {
  const walls = makeBorderWalls();
  // Three corridors — gaps match creature diameters exactly (r:62→124px span)
  // cr14a cy:294 r:62 → gap y:232–356
  walls.push({x:280,y:PZ.t,  w:50, h:232-PZ.t});
  walls.push({x:280,y:356,   w:50, h:PZ.b-356});
  // cr14b cy:325 r:62 → gap y:263–387
  walls.push({x:500,y:PZ.t,  w:50, h:263-PZ.t});
  walls.push({x:500,y:387,   w:50, h:PZ.b-387});
  // cr14c cy:305 r:62 → gap y:243–367
  walls.push({x:700,y:PZ.t,  w:50, h:243-PZ.t});
  walls.push({x:700,y:367,   w:50, h:PZ.b-367});
  return {
    id:14, name:'The Frenzied Three', bg:'warm',
    intro:['Three creatures, all labeled FRENZIED.','A wrong name given to a frightened thing.','Remove the name.','They were never feral.'],
    pStart:{x:120,y:305}, walls, water:null,
    decor:[],
    objs:[
      new GObj({id:'cr14a',type:'creature',x:398,y:294,r:62,
        labels:[{text:'FRENZIED',acc:false}],solid:true,tilt:0.03,
        patrol:{y1:275,y2:313,spd:28}}),
      new GObj({id:'cr14b',type:'creature',x:618,y:325,r:62,
        labels:[{text:'FRENZIED',acc:false}],solid:true,tilt:-0.04,
        patrol:{y1:306,y2:344,spd:32}}),
      new GObj({id:'cr14c',type:'creature',x:818,y:305,r:62,
        labels:[{text:'FRENZIED',acc:false}],solid:true,tilt:0.05,
        patrol:{y1:286,y2:324,spd:25}}),
      new GObj({id:'gate14',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>['cr14a','cr14b','cr14c'].every(id=>G.lv.objs.find(o=>o.id===id)?.isNeutral),
    grantLabel:null,
    hint:'They\'re frenzied — they shift. Time your approach and erase each one.',
    solveMsg:'All at ease.',
  };
}

// L15 — The Sealed Wing
// A door labeled SEALED blocks east wing. Inside: a CONFINED creature that blocks the sub-corridor.
// A DOCILE creature wanders freely (accurate label — don't erase).
// Player earns label TRAVELER on completion.
function buildLevel15() {
  const walls = makeBorderWalls();
  // Dividing wall — door gap at y:220–310
  walls.push({x:370,y:PZ.t,  w:60, h:220-PZ.t});
  walls.push({x:370,y:310,   w:60, h:PZ.b-310});
  // Inner sub-corridor gap at y:240–360 (cr15a blocks it)
  walls.push({x:640,y:PZ.t,  w:50, h:240-PZ.t});
  walls.push({x:640,y:360,   w:50, h:PZ.b-360});
  return {
    id:15, name:'The Sealed Wing', bg:'warm',
    intro:['Something here was lost before you arrived.','A door says LOCKED. A chest says LOST.','One creature truly is DOCILE — don\'t touch it.','Find what\'s lost, open what\'s locked.'],
    pStart:{x:140,y:305}, walls, water:null,
    decor:[],
    objs:[
      new GObj({id:'chest15',type:'chest',x:230,y:415,w:62,h:50,
        labels:[{text:'LOST',acc:false}],solid:false,tilt:-0.02,
        grantItem:'key15'}),
      new GObj({id:'door15',type:'door',x:370,y:220,w:60,h:90,
        labels:[{text:'LOCKED',acc:false}],solid:true,tilt:0.0,
        requiresItem:'key15'}),
      new GObj({id:'cr15b',type:'creature',x:500,y:420,r:44,
        labels:[{text:'DOCILE',acc:true}],solid:false,tilt:-0.02}),
      new GObj({id:'cr15a',type:'creature',x:665,y:300,r:60,
        labels:[{text:'CONFINED',acc:false}],solid:true,tilt:0.04}),
      new GObj({id:'gate15',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='cr15a')?.isNeutral,
    grantLabel:'TRAVELER',
    hint:'Find the LOST key first, then unlock the door. Leave DOCILE — it\'s true.',
    solveMsg:'The wing is open.',
  };
}

// L16 — The Phantom
// A creature labeled PHANTOM blocks the mirror.
// The player carries TRAVELER from L15 — erase it in the mirror.
// Gate opens when creature is gone AND self-labels are clear.
function buildLevel16() {
  const walls = makeBorderWalls();
  // Creature corridor gap at y:212–398
  walls.push({x:360,y:PZ.t, w:55, h:212-PZ.t});
  walls.push({x:360,y:398,  w:55, h:PZ.b-398});
  return {
    id:16, name:'The Phantom', bg:'warm',
    intro:['A creature guards the mirror.','You still carry a label from before.','Erase the creature.','Then face the mirror.','Let everything go.'],
    pStart:{x:130,y:305}, walls, water:null,
    decor:[],
    objs:[
      new GObj({id:'cr16',type:'creature',x:426,y:305,r:66,
        labels:[{text:'PHANTOM',acc:false}],solid:true,tilt:-0.04,special:'vanish',
        patrol:{y1:282,y2:328,spd:42}}),
      new GObj({id:'mir16',type:'mirror',x:600,y:130,w:175,h:310,labels:[],solid:true}),
      new GObj({id:'gate16',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='cr16')?.isNeutral &&
                 G.player.selfLbls.length === 0,
    grantLabel:null,
    hint:'The phantom shifts. Find its pattern, then erase it. Then face the mirror.',
    solveMsg:'Nothing left to carry.',
  };
}

// L17 — The Second Machine
// A larger engine room with six panels and a dial.
// The panels are arranged in two rows — harder to navigate.
function buildLevel17() {
  const walls = makeBorderWalls();
  // No separate engine wall — the dial object itself covers the full machine area
  return {
    id:17, name:'The Second Machine', bg:'dark',
    intro:['There was another one.','A second machine, deeper in.','Six switches. One dial.','You\'ve done this before.'],
    pStart:{x:100,y:490}, walls, water:null,
    decor:(()=>{const d=[
      // Crates stacked in top-left corner — left of the machine dial (dial starts at x:140)
      {type:'crate', x: 52, y: 56, w:56, h:56},
      {type:'crate', x: 52, y:120, w:56, h:56},
    ]; addPropWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'pA',type:'panel',x:158,y:372,w:90,h:62,
        labels:[{text:'ACTIVE',acc:false}],  solid:true,tilt:0.02}),
      new GObj({id:'pB',type:'panel',x:262,y:372,w:90,h:62,
        labels:[{text:'RUNNING',acc:false}], solid:true,tilt:-0.02}),
      new GObj({id:'pC',type:'panel',x:366,y:372,w:90,h:62,
        labels:[{text:'ONLINE',acc:false}],  solid:true,tilt:0.01}),
      new GObj({id:'pD',type:'panel',x:480,y:372,w:90,h:62,
        labels:[{text:'ENABLED',acc:false}], solid:true,tilt:-0.03}),
      new GObj({id:'pE',type:'panel',x:584,y:372,w:90,h:62,
        labels:[{text:'LIVE',acc:false}],    solid:true,tilt:0.03}),
      new GObj({id:'pF',type:'panel',x:688,y:372,w:90,h:62,
        labels:[{text:'RUNNING',acc:false}], solid:true,tilt:-0.01}),
      new GObj({id:'dial17',type:'dial',x:140,y:55,w:660,h:310,
        labels:[{text:'DO NOT STOP',acc:false}],solid:true,tilt:0,
        nudge:{value:0.68,target:0.0,tol:0.08,range:0.75,dir:0}}),
      new GObj({id:'gate17',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:()=>G.lv.objs.find(o=>o.id==='dial17')?.active === true,
    regenRate:9, // cleared panels regen their label after 9 seconds — clear fast!
    grantLabel:null,
    hint:'Six switches, then the dial. But the machine fights back.',
    solveMsg:'The second machine is quiet.',
  };
}

// L18 — The Long Bridge
// A wide water level: two bridges over two rivers, plus a wheel beyond.
// Each segment gates the next.
function buildLevel18() {
  const walls = makeBorderWalls();
  // River 1 gap at y:248–360
  walls.push({x:250,y:PZ.t, w:100,h:252-PZ.t, isWater:true});
  walls.push({x:250,y:356,  w:100,h:PZ.b-356,  isWater:true});
  // River 2 gap at y:248–360 (same height for simplicity)
  walls.push({x:540,y:PZ.t, w:100,h:252-PZ.t, isWater:true});
  walls.push({x:540,y:356,  w:100,h:PZ.b-356,  isWater:true});
  // Creature corridor between river 2 and wheel: gap y:246–364 (cr18 r:59 at cy:305)
  walls.push({x:680,y:PZ.t, w:50, h:246-PZ.t});
  walls.push({x:680,y:364,  w:50, h:PZ.b-364});
  return {
    id:18, name:'The Long Bridge', bg:'grass',
    intro:['Two rivers block the path.','Two bridges, wrongly named.','Something STRANDED beyond the second.','A wheel frozen at the end.'],
    pStart:{x:110,y:305}, walls,
    water:[{x:250,y:PZ.t,w:100,h:PZ.b-PZ.t},{x:540,y:PZ.t,w:100,h:PZ.b-PZ.t}],
    decor:(()=>{const d=[
      {type:'tree', col:1, x:52,  y:408, w:80, h:110},
      {type:'boat', x:272, y:88,  w:65,  h:58},
      {type:'tree', col:0, x:415, y:425, w:68, h:92},
      {type:'boat', x:562, y:88,  w:65,  h:58},
    ]; addTreeWalls(walls,d); return d; })(),
    objs:[
      new GObj({id:'br18a',type:'bridge',x:250,y:248,w:100,h:112,
        labels:[{text:'UNSAFE',acc:false}],solid:true,tilt:-0.02}),
      new GObj({id:'br18b',type:'bridge',x:540,y:248,w:100,h:112,
        labels:[{text:'ROTTEN',acc:false}],solid:true,tilt:0.03}),
      new GObj({id:'cr18',type:'creature',x:739,y:305,r:59,
        labels:[{text:'STRANDED',acc:false}],solid:true,tilt:-0.03}),
      new GObj({id:'wh18',type:'wheel',x:830,y:270,r:62,
        labels:[{text:'FROZEN',acc:false},{text:'BROKEN',acc:false}],solid:false,tilt:0.0,
        nudge:{value:0.55,target:0.0,tol:0.08,range:0.6,dir:0}}),
      new GObj({id:'gate18',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:(s)=>s.wheelAligned &&
                  G.lv.objs.find(o=>o.id==='br18a')?.isNeutral &&
                  G.lv.objs.find(o=>o.id==='br18b')?.isNeutral &&
                  G.lv.objs.find(o=>o.id==='cr18')?.isNeutral,
    grantLabel:null,
    hint:'Two bridges, one creature, then the wheel.',
    solveMsg:'The long crossing complete.',
  };
}

// L19 — All Things Named
// The grand finale — every mechanic in one room.
// Order matters: door → bridge → creature → birdhouse.
// The wheel is a bonus that opens a shortcut (not required).
function buildLevel19() {
  const walls = makeBorderWalls();
  // Dividing wall: upper passage with door gap at y:220–310
  walls.push({x:300,y:PZ.t, w:65, h:220-PZ.t});
  walls.push({x:300,y:310,  w:65, h:PZ.b-310});
  // River after the door — gap at y:240–360 for bridge
  walls.push({x:500,y:PZ.t, w:110,h:244-PZ.t, isWater:true});
  walls.push({x:500,y:356,  w:110,h:PZ.b-356,  isWater:true});
  // Creature corridor: gap matches cr19 diameter (r:66→y:236–368)
  walls.push({x:710,y:PZ.t, w:50, h:236-PZ.t});
  walls.push({x:710,y:368,  w:50, h:PZ.b-368});
  return {
    id:19, name:'All Things Named', bg:'garden',
    intro:['One last room.','Everything that was ever mislabeled.','A door, a river, a creature, a home.','Unsay it all.'],
    pStart:{x:120,y:305}, walls,
    water:[{x:500,y:PZ.t,w:110,h:PZ.b-PZ.t}],
    decor:(()=>{const d=[
      {type:'tree', col:2, x:52,  y:415, w:88, h:115},
      {type:'tree', col:1, x:148, y:108, w:80, h:110},
      {type:'boat', x:522, y:88,  w:68,  h:60},
    ]; addTreeWalls(walls,d); return d; })(),
    objs:[
      // 1 — Door blocks first passage
      new GObj({id:'door19',type:'door',x:300,y:220,w:65,h:90,
        labels:[{text:'SEALED',acc:false}],solid:true,tilt:0.0}),
      // 2 — Bridge spans river
      new GObj({id:'br19',type:'bridge',x:500,y:240,w:110,h:120,
        labels:[{text:'UNSAFE',acc:false}],solid:true,tilt:-0.02}),
      // 3 — Creature blocks access to birdhouse / bird
      new GObj({id:'cr19',type:'creature',x:776,y:302,r:66,
        labels:[{text:'HOSTILE',acc:false}],solid:true,tilt:0.04}),
      // 4 — Bird and birdhouse at end
      new GObj({id:'bird19',type:'bird',x:840,y:430,r:24,
        labels:[{text:'STRAY',acc:false}],solid:false,tilt:0.06}),
      new GObj({id:'nest19',type:'birdhouse',x:840,y:370,w:55,h:99,
        labels:[{text:'EMPTY',acc:false}],solid:true,tilt:-0.04}),
      // Bonus wheel — optional, aligns to reveal chest (non-gating)
      new GObj({id:'wh19',type:'wheel',x:430,y:450,r:60,
        labels:[{text:'STUCK',acc:false}],solid:false,tilt:0.0,
        nudge:{value:0.4,target:0.0,tol:0.1,range:0.5,dir:0}}),
      // Chest bonus near wheel
      new GObj({id:'ch19',type:'chest',x:200,y:390,w:75,h:60,
        labels:[{text:'LOCKED',acc:false}],solid:false,tilt:0.02}),
      new GObj({id:'gate19',type:'gate',x:EXIT_X,y:EXIT_Y,w:EXIT_W,h:EXIT_H,labels:[],solid:true}),
    ],
    exitCond:(s)=>s.birdHome,
    grantLabel:null,
    hint:'One thing at a time. Door, then bridge, then beast, then home.',
    solveMsg:'Everything unsaid.',
  };
}

const LEVELS = [
  buildLevel0, buildLevel1, buildLevel2, buildLevel3, buildLevel4,
  buildLevel5, buildLevel6, buildLevel7, buildLevel8, buildLevel9,
  buildLevel10, buildLevel11, buildLevel12, buildLevel13, buildLevel14,
  buildLevel15, buildLevel16, buildLevel17, buildLevel18, buildLevel19,
];

// ── GAME STATE ────────────────────────────────────────────────────
const G = {
  scene: 'splash',
  splashT: 0, splashSndPlayed: false,
  creditsT: 0,
  lvIdx: 0, lv: null, ls: {},
  player: {
    x:130, y:305, r:22, spd:220,
    hp: 3, maxHp: 3, hurtT: 0,
    selfLbls: [], labelAnim: 0,
    inventory: [],
    // Animation state
    dir: 'south',      // last facing direction
    moving: false,
    walkFrame: 0,      // 0–5
    walkT: 0,          // accumulator
    WALK_FPS: 9,       // frames per second
    prevX: 130, prevY: 305,
  },
  sv: false, svAlpha: 0,
  nudgeMode: false, nudgeTarget: null,
  eraseHold: 0, eraseTarget: null,
  denyNotif: 0, denyMsg: '',
  notif: {text:'',sub:'',t:0},
  flash: 0,
  dmgFlash: 0,
  completeClock: 0,
  endingT: 0,
  introCard: {active:false, age:0, closing:false, closeAge:0, lines:[]},
};

function showNotif(txt, sub='', dur=3.0) { G.notif = {text:txt, sub, t:dur}; }

// ── LEVEL LOAD / RESET ────────────────────────────────────────────
function loadLevel(idx) {
  G.lvIdx = idx;
  const lv = LEVELS[idx]();
  setBGM(lv.objs.some(o => o.type === 'dial') ? 'machine' : 'ambient');
  G.lv = lv;
  G.ls = {wheelAligned:false, birdHome:false, selfClear:false};
  G.player.x = lv.pStart.x; G.player.y = lv.pStart.y;
  G.player.prevX = lv.pStart.x; G.player.prevY = lv.pStart.y;
  G.player.dir = 'south'; G.player.moving = false;
  G.player.walkFrame = 0; G.player.walkT = 0;
  G.sv=false; G.svAlpha=0;
  G.nudgeMode=false; G.nudgeTarget=null;
  G.eraseHold=0; G.eraseTarget=null;
  G.denyNotif=0; G.denyMsg=''; G.flash=0; G.dmgFlash=0;
  G.player.hp = G.player.maxHp; G.player.hurtT = 0;
  G.player.inventory = [];
  G.scene = 'play'; parts.length = 0;
  if (lv.intro && lv.intro.length) {
    G.introCard = {active:true, age:0, closing:false, closeAge:0, lines:lv.intro};
  } else {
    G.introCard = {active:false, age:0, closing:false, closeAge:0, lines:[]};
  }
  if (G.player.selfLbls.length === 0) G.ls.selfClear = true;
}

function resetLevel() {
  const lv = G.lv;
  lv.objs.forEach(o => o.reset());
  G.ls = {wheelAligned:false, birdHome:false, selfClear:(G.player.selfLbls.length===0)};
  G.player.x = lv.pStart.x; G.player.y = lv.pStart.y;
  G.player.prevX = lv.pStart.x; G.player.prevY = lv.pStart.y;
  G.player.dir = 'south'; G.player.moving = false;
  G.player.walkFrame = 0; G.player.walkT = 0;
  G.sv=false; G.svAlpha=0;
  G.nudgeMode=false; G.nudgeTarget=null;
  G.eraseHold=0; G.eraseTarget=null;
  G.denyNotif=0; G.denyMsg=''; G.flash=0; G.dmgFlash=0;
  G.player.hp = G.player.maxHp; G.player.hurtT = 0;
  G.player.inventory = [];
  parts.length = 0;
  G.introCard = {active:false, age:0, closing:false, closeAge:0, lines:[]};
}

// ── TICK ──────────────────────────────────────────────────────────
function tick(dt) {
  if (G.scene === 'splash')   { tickSplash(dt); return; }
  if (G.scene === 'title')    { tickTitle(dt); return; }
  if (G.scene === 'complete') { tickComplete(dt); return; }
  if (G.scene === 'ending')   { tickEnding(dt); return; }
  if (G.scene === 'credits')  { tickCredits(dt); return; }
  if (G.scene !== 'play')     return;
  dt = Math.min(dt, 0.05);

  if (G.introCard.active) {
    const ic = G.introCard;
    ic.age += dt;
    if (ic.closing) {
      ic.closeAge += dt;
      if (ic.closeAge >= 0.3) ic.active = false;
    } else if (ic.age >= 0.8 && consumeKey('KeyE')) {
      ic.closing = true;
    }
    // Player frozen — no tickMove
    return;
  }

  if (consumeKey('KeyR')) { resetLevel(); return; }
  if (consumeKey('Tab'))  { G.sv = !G.sv; }
  G.svAlpha = clamp(G.svAlpha + (G.sv?1:-1)*dt*6, 0, 1);

  if (G.nudgeMode) { tickNudge(dt); }
  else { tickMove(dt); tickErase(dt); tickEnterNudge(); }

  tickCreatures(dt); tickBird(dt); tickGates(dt); tickDoors(dt);
  tickDispenser(dt);
  tickCreatureDamage(dt);
  checkLevelEvents();
  G.flash    = Math.max(0, G.flash    - dt*2.5);
  G.dmgFlash = Math.max(0, G.dmgFlash - dt*3.0);
  if (G.notif.t > 0) G.notif.t -= dt;
  if (G.denyNotif > 0) G.denyNotif -= dt;
  for (const o of G.lv.objs) if (o.shakeT > 0) o.shakeT = Math.max(0, o.shakeT - dt);
  tickParts(dt);
  G.player.labelAnim += dt * 0.55;
  checkExit();
}

function tickSplash(dt) {
  G.splashT += dt;
  // Sound is played in the first-interaction handler below (browser autoplay policy)
  // Any key / click skips, or auto-advance after 2 seconds
  if (consumeKey('Space')||consumeKey('Enter')||consumeKey('KeyE')||consumeKey('Escape')) {
    G.scene = 'title'; return;
  }
  if (G.splashT >= 2.0) G.scene = 'title';
}
function tickTitle(dt)    { resumeAC(); if (consumeKey('Space')||consumeKey('Enter')||consumeKey('KeyE')) startGame(); }
function startGame()      { resumeAC(); G.player.selfLbls = []; loadLevel(0); }
function tickComplete(dt) {
  G.completeClock += dt;
  if (G.completeClock > 0.8 && (consumeKey('Space')||consumeKey('Enter')||consumeKey('KeyE'))) {
    const next = G.lvIdx + 1;
    if (next >= LEVELS.length) { G.scene = 'ending'; G.endingT = 0; _bgmMachine.pause(); _bgmAmbient.pause(); }
    else loadLevel(next);
  }
}
function tickEnding(dt) {
  G.endingT += dt;
  // After the text has fully appeared, E advances to credits
  if (G.endingT > 6 && (consumeKey('Space')||consumeKey('Enter')||consumeKey('KeyE'))) {
    G.scene = 'credits'; G.creditsT = 0;
  }
}
function tickCredits(dt) {
  G.creditsT += dt;
  if (G.creditsT > 1.5 && (consumeKey('Space')||consumeKey('Enter')||consumeKey('KeyE')||consumeKey('Escape'))) {
    G.scene = 'title';
  }
}

// ── MOVEMENT + PLAYER ANIMATION ───────────────────────────────────
function tickMove(dt) {
  const p = G.player;
  p.prevX = p.x; p.prevY = p.y;

  let dx = 0, dy = 0;
  if (K['KeyA']||K['ArrowLeft'])  dx -= 1;
  if (K['KeyD']||K['ArrowRight']) dx += 1;
  if (K['KeyW']||K['ArrowUp'])    dy -= 1;
  if (K['KeyS']||K['ArrowDown'])  dy += 1;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }

  const solids = getSolids();
  let nx = p.x + dx*p.spd*dt;
  for (const s of solids) {
    if (circleRect(nx,p.y,p.r,s.x,s.y,s.w,s.h)) {
      // Use pre-move X to pick the correct side — avoids teleportation when squeezed
      nx = p.x <= s.x + s.w/2 ? s.x - p.r - 0.5 : s.x + s.w + p.r + 0.5;
    }
  }
  let ny = p.y + dy*p.spd*dt;
  for (const s of solids) {
    if (circleRect(p.x,ny,p.r,s.x,s.y,s.w,s.h)) {
      ny = p.y <= s.y + s.h/2 ? s.y - p.r - 0.5 : s.y + s.h + p.r + 0.5;
    }
  }
  p.x = clamp(nx, p.r, VW-p.r);
  p.y = clamp(ny, p.r, VH-p.r);
  checkCircleSolids(p);

  // Determine if actually moved
  const movedDX = p.x - p.prevX;
  const movedDY = p.y - p.prevY;
  const didMove = Math.abs(movedDX) > 0.5 || Math.abs(movedDY) > 0.5;

  // Update facing direction from INPUT (not movement result, so diagonal inputs still update direction)
  if (dx !== 0 || dy !== 0) {
    const d = getDirFromVelocity(dx, dy);
    if (d) p.dir = d;
  }

  // Walk animation — only advance when actually moving
  p.moving = didMove;
  if (didMove) {
    p.walkT += dt;
    if (p.walkT >= 1 / p.WALK_FPS) {
      p.walkT -= 1 / p.WALK_FPS;
      p.walkFrame = (p.walkFrame + 1) % 6;
    }
  } else {
    // Idle — hold frame 0
    p.walkFrame = 0;
    p.walkT = 0;
  }
}

function getSolids() {
  const all = [...G.lv.walls];
  for (const o of G.lv.objs) if (o.solid && !o.isCirc) all.push({x:o.x,y:o.y,w:o.w,h:o.h});
  return all;
}
function checkCircleSolids(p) {
  for (const o of G.lv.objs) {
    if (o.solid && o.isCirc) {
      const d = dist(p.x,p.y,o.cx,o.cy), minD = p.r+o.r;
      if (d < minD && d > 0.01) {
        const a = Math.atan2(p.y-o.cy, p.x-o.cx);
        p.x = o.cx+Math.cos(a)*minD; p.y = o.cy+Math.sin(a)*minD;
      }
    }
  }
}

// ── ERASE ─────────────────────────────────────────────────────────
const ERASE_TIME = 0.44, ERASE_RANGE = 72;

function tickErase(dt) {
  const p = G.player, lv = G.lv;
  let nearest = null, nearestD = Infinity;

  for (const o of lv.objs) {
    if (o.type === 'dial' && !allPanelsClear()) continue;
    if (o.type === 'mirror') continue;
    if (!o.hasLabel) continue;
    const d = o.distToPoint(p.x, p.y);
    if (d < ERASE_RANGE && d < nearestD) { nearestD = d; nearest = o; }
  }
  // Mirror erase — works in any level with a mirror when player carries self-labels
  if (G.player.selfLbls.length > 0) {
    const mirror = lv.objs.find(o => o.type === 'mirror');
    if (mirror) {
      const md = mirror.distToPoint(p.x, p.y);
      if (md < ERASE_RANGE && md < nearestD) { nearestD = md; nearest = mirror; }
    }
  }
  G.eraseTarget = nearest;

  if (K['KeyE'] && G.eraseTarget) {
    startEraseSound();
    G.eraseHold += dt;
    if (G.eraseHold >= ERASE_TIME) {
      G.eraseHold = 0;
      if (G.eraseTarget.type === 'mirror') {
        G.player.selfLbls.pop();
        spawnParts(G.player.x, G.player.y, '#9070d8', 10);
        sndErase();
        if (G.player.selfLbls.length === 0) {
          G.ls.selfClear = true;
          showNotif('You were never just those words.', '');
          sndSolve();
        }
      } else if (G.eraseTarget.canErase) {
        const o = G.eraseTarget;
        if (o.requiresItem && !G.player.inventory.includes(o.requiresItem)) {
          // Needs a key — show specific message, not "that label is correct"
          o.shakeT = 0.5; sndCant(); G.denyNotif = 2.0;
          G.denyMsg = 'You need a key for this.';
          showNotif('Find something to open it with first.', '', 2.0);
        } else {
          o.erase();
          // Grant item when object becomes neutral and has grantItem
          if (o.isNeutral && o.grantItem && !G.player.inventory.includes(o.grantItem)) {
            G.player.inventory.push(o.grantItem);
            showNotif('Key found.', '', 2.5);
            spawnParts(o.pcx, o.pcy, '#d4a830', 14);
          }
        }
      } else {
        G.eraseTarget.shakeT = 0.5; sndCant(); G.denyNotif = 2.0;
        G.denyMsg = '';
      }
    }
  } else {
    stopEraseSound();
    G.eraseHold = Math.max(0, G.eraseHold - dt*3);
  }
}

function allPanelsClear() {
  if (!G.lv) return false;
  const p = G.lv.objs.filter(o => o.type === 'panel');
  return p.length > 0 && p.every(o => o.isNeutral);
}

// ── NUDGE ─────────────────────────────────────────────────────────
const NUDGE_RANGE = 72, NUDGE_STEP = 0.03;
let nudgeKeyHeld = 0, nudgeKeyDir = 0;

function tickEnterNudge() {
  if (!consumeKey('KeyE')) return;
  const p = G.player; let nearest=null, nearestD=Infinity;
  for (const o of G.lv.objs) {
    if (!o.canNudge) continue;
    if (o.type === 'dial' && !allPanelsClear()) continue; // must clear all panels first
    const d = o.distToPoint(p.x, p.y);
    if (d < NUDGE_RANGE && d < nearestD) { nearestD = d; nearest = o; }
  }
  if (nearest) {
    G.nudgeMode = true; G.nudgeTarget = nearest; G.sv = true;
    nudgeKeyHeld = 0; nudgeKeyDir = 0;
    showNotif('Adjust mode', 'Arrow keys ← → to align · E to finish');
  }
}
function tickNudge(dt) {
  const o = G.nudgeTarget;
  if (!o) { G.nudgeMode = false; return; }
  if (consumeKey('KeyE') || consumeKey('Escape')) { G.nudgeMode = false; G.nudgeTarget = null; G.sv = false; return; }
  const L = K['ArrowLeft']||K['KeyA'], R = K['ArrowRight']||K['KeyD'];
  const dir = L?-1:R?1:0;
  if (dir) {
    nudgeKeyHeld += dt;
    if (nudgeKeyHeld > 0.12 || nudgeKeyDir !== dir) {
      const step = NUDGE_STEP * (1 + nudgeKeyHeld*2);
      o.nudge.value = clamp(o.nudge.value+dir*step, o.nudge.target-o.nudge.range, o.nudge.target+o.nudge.range);
      sndNudge(o.nudge.value - o.nudge.target); nudgeKeyDir = dir;
    }
  } else nudgeKeyHeld = 0;

  if (o.nudgeSolved() && !o.active) {
    o.active = true; o.solid = false;
    G.nudgeMode = false; G.nudgeTarget = null; G.sv = false;
    sndSolve(); spawnParts(o.pcx, o.pcy, PAL.c_gold, 24);
    if (o.type === 'wheel') G.ls.wheelAligned = true;
    showNotif(G.lv.solveMsg || 'Aligned.', '');
  }
}

// ── CREATURES / BIRD / GATES ──────────────────────────────────────
function tickCreatures(dt) {
  for (const o of G.lv.objs) {
    if (o.type !== 'creature') continue;
    // Patrol movement — only while creature has labels and hasn't started walking away
    if (o.patrol && !o.isNeutral && !o.walked && o.walkTx === null) {
      const { x1, x2, y1, y2, spd: pspd } = o.patrol;
      if (x1 !== undefined) {
        o.cx += o._patDir * pspd * dt;
        if (o.cx >= x2) { o.cx = x2; o._patDir = -1; }
        if (o.cx <= x1) { o.cx = x1; o._patDir =  1; }
      } else if (y1 !== undefined) {
        o.cy += o._patDir * pspd * dt;
        if (o.cy >= y2) { o.cy = y2; o._patDir = -1; }
        if (o.cy <= y1) { o.cy = y1; o._patDir =  1; }
      }
    }
    if (o.isNeutral && !o.walked && o.walkTx === null) {
      // Walk right through the exit rather than falling through walls
      o.walkTx = EXIT_X + 80; o.walkTy = o.cy;
      o.solid = false; // stop blocking player immediately on clear
    }
    if (o.walkTx !== null && !o.walked) {
      const dx=o.walkTx-o.cx, dy=o.walkTy-o.cy, d=Math.hypot(dx,dy);
      if (d < 4) { o.cx=o.walkTx; o.cy=o.walkTy; o.walked=true; o.visible=false; }
      else { const s=200*dt; o.cx+=dx/d*s; o.cy+=dy/d*s; }
    }
  }
}
function tickBird(dt) {
  const bird = G.lv.objs?.find(o=>o.type==='bird');
  const nest = G.lv.objs?.find(o=>o.type==='birdhouse');
  if (!bird || !nest || bird.arrived) return;

  // Bird bobbing/flying animation
  bird.birdAnimT += dt;
  if (bird.isNeutral && nest.isNeutral) {
    // Flying animation: frames 2-3 at 8fps
    if (bird.birdAnimT >= 1/8) { bird.birdAnimT = 0; bird.birdFrame = bird.birdFrame===2?3:2; }
    if (bird.flyTx === null) { bird.flyTx = nest.pcx; bird.flyTy = nest.pcy; }
    const dx=bird.flyTx-bird.cx, dy=bird.flyTy-bird.cy, d=Math.hypot(dx,dy);
    if (d < 8) {
      bird.arrived=true; bird.visible=false; G.ls.birdHome=true;
      sndSolve(); spawnParts(nest.pcx,nest.pcy,'#e0c030',20); showNotif('Home.','');
    } else { const s=220*dt; bird.cx+=dx/d*s; bird.cy+=dy/d*s; }
  } else {
    // Perched bob: frames 0-1 at 2fps
    if (bird.birdAnimT >= 0.5) { bird.birdAnimT = 0; bird.birdFrame = bird.birdFrame===0?1:0; }
  }
}
function tickGates(dt) {
  const lv = G.lv; if (!lv.exitCond) return;
  const gate = lv.objs.find(o=>o.type==='gate'); if (!gate) return;
  const open = lv.exitCond(G.ls);
  if (open && gate.solid) {
    gate.solid = false; gate.animT = 0;
    sndActivate(); spawnParts(gate.pcx,gate.pcy,PAL.exit_open,16);
    showNotif(lv.solveMsg || 'The way is open.', '');
  }
  if (open) gate.animT = Math.min(1, gate.animT + dt*3);
}
function tickDoors(dt) {
  for (const o of G.lv.objs) {
    if (o.type === 'door' && o.active) {
      o.animT = Math.min(0.52, o.animT + dt);
    }
  }
}
// ── DISPENSER / REGEN MECHANIC ────────────────────────────────────
// Levels with `regenRate` (seconds) cause cleared objects to get their
// first label stamped back after that delay. Forces urgency.
// Only panels, plants, and chests can regen. Gates/dial never regen.
// Stops once the level's exitCond is satisfied.
function tickDispenser(dt) {
  const lv = G.lv;
  if (!lv.regenRate) return;
  // Don't regen if level is already solved
  if (lv.exitCond && lv.exitCond(G.ls)) {
    for (const o of lv.objs) o._regenT = null;
    return;
  }
  const rate = lv.regenRate;
  const REGEN_TYPES = new Set(['panel','plant','chest','lantern']);

  for (const o of lv.objs) {
    if (!REGEN_TYPES.has(o.type)) continue;
    if (!o._initLbls || o._initLbls.length === 0) continue;

    // Start countdown when object becomes newly neutral
    if (o.isNeutral && o.active && o._regenT === null) {
      o._regenT = rate;
      o._regenTicks = 0;
    }

    if (o._regenT === null) continue;

    o._regenT -= dt;
    const t = o._regenT;

    // Tick sounds at 3s, 2s, 1s remaining
    if (t <= 3 && o._regenTicks < 1) { sndTick(); o._regenTicks = 1; }
    if (t <= 2 && o._regenTicks < 2) { sndTick(); o._regenTicks = 2; }
    if (t <= 1 && o._regenTicks < 3) { sndTick(); o._regenTicks = 3; }

    if (o._regenT <= 0) {
      // Re-stamp: restore the first wrong label, re-solidify
      o.labels = [{ ...o._initLbls[0] }];
      o.solid = true;
      o.active = false;
      o._regenT = null;
      o._regenTicks = 0;
      sndStamp();
      spawnParts(o.pcx, o.pcy, '#e03020', 12);
      showNotif('The machine stamps back...', '');
    }
  }
}

// ── CREATURE PATROL DAMAGE ────────────────────────────────────────
// Only patrolling creatures deal contact damage.
// Stationary blockers (L2 DANGEROUS, L8 LOST, etc.) push player
// as before — they don't chip health. This keeps early levels playable.
// A 0.35s contact timer prevents instant-damage if player clips a corner.
function tickCreatureDamage(dt) {
  const p = G.player;
  // Tick down immunity
  if (p.hurtT > 0) {
    p.hurtT = Math.max(0, p.hurtT - dt);
    // Clear all contact timers while immune so we don't double-fire on recovery
    for (const o of G.lv.objs) o._contactT = 0;
    return;
  }

  for (const o of G.lv.objs) {
    if (o.type !== 'creature') continue;
    if (!o.patrol) continue;          // only patrol creatures are hazardous
    if (!o.hasLabel || !o.visible) { o._contactT = 0; continue; }

    const d = Math.hypot(p.x - o.cx, p.y - o.cy);
    const minD = p.r + o.r;
    const touching = d < minD + 6;   // 6px buffer on top of hard collision

    if (touching) {
      o._contactT += dt;
      if (o._contactT >= 0.35) {
        p.hp        = Math.max(0, p.hp - 1);
        p.hurtT     = 1.8;
        o._contactT = 0;
        G.dmgFlash  = 1.0;
        sndHurt();
        // Knockback away from creature
        const ang = Math.atan2(p.y - o.cy, p.x - o.cx);
        p.x = clamp(p.x + Math.cos(ang) * 65, p.r, VW - p.r);
        p.y = clamp(p.y + Math.sin(ang) * 65, PZ.t + p.r, PZ.b - p.r);
        spawnParts(p.x, p.y, '#ff2020', 10);

        if (p.hp <= 0) {
          showNotif('Overwhelmed.', '', 2.0);
          p.hurtT = 99; // freeze damage until reset
          setTimeout(() => { p.hp = p.maxHp; p.hurtT = 0; resetLevel(); }, 900);
        } else {
          const msgs = ['Watch out!', 'Too close!', 'Get back!'];
          showNotif(msgs[Math.min(2, 3 - p.hp)], '', 1.5);
        }
        break;
      }
    } else {
      o._contactT = Math.max(0, o._contactT - dt * 4);
    }
  }
}

function checkLevelEvents() {
  if (G.lvIdx===5 && !G.ls.selfClear && G.player.selfLbls.length===0) G.ls.selfClear = true;
}
function checkExit() {
  const p = G.player;
  const gate = G.lv.objs.find(o=>o.type==='gate');
  if (gate && gate.solid) return;
  if (circleRect(p.x,p.y,p.r,EXIT_X,EXIT_Y,EXIT_W,EXIT_H)) doLevelComplete();
}
function doLevelComplete() {
  const lv = G.lv;
  if (lv.grantLabel) G.player.selfLbls.push(lv.grantLabel);
  G.scene = 'complete'; G.completeClock = 0; sndSolve();
}

// ══════════════════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════════════════
function render() {
  beginVirtual();

  if (G.scene === 'splash')   { drawSplash(); endVirtual(); return; }
  if (G.scene === 'title')    { drawTitle(); endVirtual(); return; }
  if (G.scene === 'complete') { drawComplete(); endVirtual(); return; }
  if (G.scene === 'ending')   { drawEnding(); endVirtual(); return; }
  if (G.scene === 'credits')  { drawCredits(); endVirtual(); return; }
  if (G.scene !== 'play')     { endVirtual(); return; }

  const lv = G.lv;
  drawFloor(lv.bg);
  if (lv.water) drawWater(lv.water);
  drawWallVisuals();
  drawDecor(lv.decor);
  // Only these types can appear in FRONT of the player via Y-sort.
  // Everything else (bridge, panel, door, gate, wheel, dial, notice, …) always draws behind.
  const YSORT_FRONT = new Set(['birdhouse', 'mirror', 'creature', 'plant', 'chest', 'lantern']);
  const py = G.player.y;
  // --- Background pass: all objects that stay behind player ---
  for (const o of lv.objs) {
    const objBaseY = o.isCirc ? o.cy + o.r : o.y + o.h;
    const isFore = YSORT_FRONT.has(o.type) && objBaseY > py;
    if (!isFore) drawObj(o);
  }
  for (const o of lv.objs) {
    const objBaseY = o.isCirc ? o.cy + o.r : o.y + o.h;
    const isFore = YSORT_FRONT.has(o.type) && objBaseY > py;
    if (!isFore) drawObjLabels(o);
  }
  drawExitZone();
  drawPlayer();
  // --- Foreground pass: only Y-sortable types when player is "in front" of them ---
  for (const o of lv.objs) {
    const objBaseY = o.isCirc ? o.cy + o.r : o.y + o.h;
    if (YSORT_FRONT.has(o.type) && objBaseY > py) drawObj(o);
  }
  for (const o of lv.objs) {
    const objBaseY = o.isCirc ? o.cy + o.r : o.y + o.h;
    if (YSORT_FRONT.has(o.type) && objBaseY > py) drawObjLabels(o);
  }
  if (G.svAlpha > 0.01) drawSimpleView();
  drawParts();
  drawDispenserTimers();
  drawDarkZone();
  if (G.flash    > 0) { ctx.fillStyle=`rgba(230,210,150,${G.flash*0.2})`;    ctx.fillRect(0,0,VW,VH); }
  if (G.dmgFlash > 0) { ctx.fillStyle=`rgba(220,30,20,${G.dmgFlash*0.28})`; ctx.fillRect(0,0,VW,VH); }
  drawHUD();
  if (G.introCard.active) drawIntroCard();

  endVirtual();
}

// ── DECOR ─────────────────────────────────────────────────────────
// Level decorations: trees, boat, grain sack. Drawn BEFORE game objects
// so they sit in the background. No collision — purely visual.
// Each item: {type:'tree'|'boat'|'sack', x, y, w?, h?, col?}
// col (0–4) selects tree variant from TREE_CELLS.
function drawDecor(items) {
  if (!items || items.length === 0) return;
  const sTree = SPR['tree_sheet'];
  const sBoat = SPR['boat'];
  const sSack = SPR['grain_sack'];

  for (const d of items) {
    ctx.save();
    if (d.type === 'tree') {
      const col = d.col ?? 1;
      const c = TREE_CELLS[clamp(col, 0, 4)];
      const dw = d.w ?? 80, dh = d.h ?? 110;
      if (sTree && sTree.complete && sTree.naturalWidth > 0) {
        // Slight shadow under trunk
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(d.x + dw*0.5, d.y + dh - 5, dw*0.25, 6, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.drawImage(sTree, c.sx, c.sy, c.sw, c.sh, d.x, d.y, dw, dh);
      } else {
        // Fallback: simple tree shape
        ctx.fillStyle = '#2d6020';
        ctx.beginPath(); ctx.arc(d.x+dw/2, d.y+dh*0.38, dw*0.42, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6a3010';
        ctx.fillRect(d.x+dw*0.41, d.y+dh*0.62, dw*0.18, dh*0.38);
      }
    } else if (d.type === 'boat') {
      const dw = d.w ?? 65, dh = d.h ?? 55;
      if (sBoat && sBoat.width > 0) {
        ctx.globalAlpha = 0.88;
        ctx.drawImage(sBoat, 0, 0, 512, 512, d.x, d.y, dw, dh);
      } else {
        ctx.fillStyle = '#8b5a28';
        ctx.beginPath();
        ctx.moveTo(d.x, d.y + dh*0.35);
        ctx.lineTo(d.x + dw*0.1, d.y + dh);
        ctx.lineTo(d.x + dw*0.9, d.y + dh);
        ctx.lineTo(d.x + dw, d.y + dh*0.35);
        ctx.closePath(); ctx.fill();
      }
    } else if (d.type === 'sack') {
      const dw = d.w ?? 42, dh = d.h ?? 46;
      if (sSack && sSack.complete && sSack.naturalWidth > 0) {
        ctx.drawImage(sSack, 131, 135, 225, 232, d.x, d.y, dw, dh);
      } else {
        ctx.fillStyle = '#c08030';
        ctx.beginPath(); ctx.roundRect(d.x, d.y, dw, dh, 6); ctx.fill();
      }
    } else if (d.type === 'crate') {
      // Draw only the pixel-art content region (sx=98,sy=84,sw=309,sh=319 in 500×500)
      const dw = d.w ?? 60, dh = d.h ?? 60;
      const spr = SPR.crate_prop;
      if (spr && spr.complete && spr.naturalWidth > 0) {
        ctx.drawImage(spr, 98, 84, 309, 319, d.x, d.y, dw, dh);
      } else {
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(d.x, d.y, dw, dh);
      }
    } else if (d.type === 'pillar') {
      // Draw only the pixel-art content region (sx=60,sy=48,sw=196,sh=675 in 316×790)
      const dw = d.w ?? 36, dh = d.h ?? 100;
      const spr = SPR.stone_pillar;
      if (spr && spr.complete && spr.naturalWidth > 0) {
        ctx.drawImage(spr, 60, 48, 196, 675, d.x, d.y, dw, dh);
      } else {
        ctx.fillStyle = '#888078'; ctx.fillRect(d.x, d.y, dw, dh);
      }
    } else if (d.type === 'fence') {
      // Draw only the pixel-art content region (sx=103,sy=55,sw=501,sh=242 in 707×353)
      const dw = d.w ?? 120, dh = d.h ?? 52;
      const spr = SPR.wooden_fence;
      if (spr && spr.complete && spr.naturalWidth > 0) {
        ctx.drawImage(spr, 103, 55, 501, 242, d.x, d.y, dw, dh);
      } else {
        ctx.fillStyle = '#7a4e18'; ctx.fillRect(d.x, d.y, dw, dh);
      }
    }
    ctx.restore();
  }
}

// ── FLOOR ─────────────────────────────────────────────────────────
// MAX_TILE caps how large each repeated tile is drawn.
// This prevents a single large texture image from looking "zoomed in".
const MAX_TILE = 96;
function drawFloor(bg) {
  // 'dark' uses the warm tile + a heavy dark overlay (industrial L6 look)
  const bgMap = {warm:'floor_warm', grass:'floor_grass', garden:'floor_grass', dark:'floor_warm'};
  const key = bgMap[bg];
  if (key && SPR[key] && SPR[key].complete && SPR[key].naturalWidth > 0) {
    const img = SPR[key];
    // Scale tile so its longest edge is ≤ MAX_TILE
    const tileScale = Math.min(1, MAX_TILE / Math.max(img.naturalWidth, img.naturalHeight));
    const tw = Math.round(img.naturalWidth  * tileScale);
    const th = Math.round(img.naturalHeight * tileScale);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, PZ.t, VW, PZ.b - PZ.t); ctx.clip();
    for (let tx = 0; tx < VW; tx += tw) {
      for (let ty = PZ.t; ty < PZ.b; ty += th) {
        ctx.drawImage(img, tx, ty, tw, th);
      }
    }
    // Dark overlay for L6
    if (bg === 'dark') {
      ctx.fillStyle = 'rgba(8,4,2,0.84)'; ctx.fillRect(0, PZ.t, VW, PZ.b - PZ.t);
    }
    ctx.restore();
  } else {
    const cols = {warm:'#e0d4b8', grass:'#8ec44a', garden:'#78b838', dark:'#1e1818'};
    ctx.fillStyle = cols[bg] || '#e0d4b8'; ctx.fillRect(0, PZ.t, VW, PZ.b - PZ.t);
  }
}

// ── WATER ─────────────────────────────────────────────────────────
function drawWater(zones) {
  for (const z of zones) {
    ctx.save();
    ctx.beginPath(); ctx.rect(z.x, z.y, z.w, z.h); ctx.clip();

    if (SPR.water && SPR.water.complete && SPR.water.naturalWidth > 0) {
      // Tile the animated GIF — browser shows current frame automatically
      const rawW = SPR.water.naturalWidth  || 96;
      const rawH = SPR.water.naturalHeight || 96;
      const wScale = Math.min(1, MAX_TILE / Math.max(rawW, rawH));
      const tw = Math.round(rawW * wScale);
      const th = Math.round(rawH * wScale);
      for (let tx = z.x; tx < z.x + z.w; tx += tw) {
        for (let ty = z.y; ty < z.y + z.h; ty += th) {
          ctx.drawImage(SPR.water, tx, ty, tw, th);
        }
      }
    } else {
      // Fallback animated water
      const t = Date.now() * 0.001;
      const grd = ctx.createLinearGradient(z.x,z.y,z.x+z.w,z.y+z.h);
      grd.addColorStop(0,PAL.water_b); grd.addColorStop(0.5,PAL.water_a); grd.addColorStop(1,PAL.water_b);
      ctx.fillStyle = grd; ctx.fillRect(z.x,z.y,z.w,z.h);
      ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1.5;
      for (let y=z.y+30; y<z.y+z.h; y+=36) {
        ctx.beginPath();
        for (let x=z.x; x<z.x+z.w; x+=5) {
          const wy = y + Math.sin(x*0.08+t*1.4+y*0.05)*4;
          x===z.x ? ctx.moveTo(x,wy) : ctx.lineTo(x,wy);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ── WALLS ─────────────────────────────────────────────────────────
function drawWallVisuals() {
  for (const w of G.lv.walls) {
    // Skip: full-width bars, water zones, border walls (x=0 left edge or x+w reaches right edge),
    // and any trunk collision walls added by addTreeWalls (w.w < 40 and h < 50)
    if (w.y < PZ.t || w.y >= PZ.b || w.w === VW || w.isWater) continue;
    if (w.x === 0 || w.x + w.w >= VW) continue;  // hide screen-border walls
    if (w._trunk || w._prop) continue;               // hide invisible trunk/prop collision walls
    if (w.type === 'engine') continue;               // engine body drawn via sprite, not as a rect
    ctx.fillStyle = PAL.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(w.x,w.y,w.w,3);
    ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(w.x,w.y+w.h-3,w.w,3);
  }
}

// ── OBJECT DISPATCH ───────────────────────────────────────────────
function drawObj(o) {
  if (!o.visible) return;
  ctx.save();
  // Shake offset
  const sx = o.shakeT > 0 ? Math.sin(o.shakeT*26)*6 : 0;
  if (sx) ctx.translate(sx, 0);
  switch (o.type) {
    case 'door':     drawDoor(o);     break;
    case 'gate':     drawGate(o);     break;
    case 'bridge':   drawBridge(o);   break;
    case 'creature': drawCreature(o); break;
    case 'wheel':    drawWheel(o);    break;
    case 'bird':     drawBird(o);     break;
    case 'birdhouse':drawBirdhouse(o);break;
    case 'mirror':   drawMirror(o);   break;
    case 'panel':    drawPanel(o);    break;
    case 'dial':     drawDial(o);     break;
    case 'notice':   drawNotice(o);   break;
    case 'plant':    drawPlant(o);    break;
    case 'chest':    drawChest(o);    break;
    case 'lantern':  drawLantern(o);  break;
  }
  ctx.restore();
}

// ── DOOR ──────────────────────────────────────────────────────────
// lpc-doors-animated-1.png: 384×544, 6 cols × 8+ rows of 64×64
// Col 0 (x=0): closed state. Rows 2-5 (y=128-383, 256px) = door body.
// Open state: door is invisible (erased label = door opens / removed).
// lpc-doors-animated-1.png col-0 frame positions (from pixel analysis):
// Row 7 (closed idle): sy=480, sh=64  ← default/resting state
// Row 6 (opening 1):   sy=416, sh=61
// Row 5 (opening 2):   sy=352, sh=56
// Row 4 (open idle):   sy=288, sh=48  ← fully open
const DOOR_FRAMES = [
  {sy:480, sh:64},  // frame 0: closed (row 7)
  {sy:416, sh:61},  // frame 1: opening (row 6)
  {sy:352, sh:56},  // frame 2: opening (row 5)
  {sy:288, sh:48},  // frame 3: open idle (row 4)
];
function drawDoor(o) {
  const spr = SPR.lpc_door;
  if (spr && spr.complete && spr.naturalWidth > 0) {
    // Animate through frames 0→3 as door opens; stay on frame 3 when open
    const frameIdx = o.active
      ? Math.min(3, Math.floor(o.animT / 0.13))
      : 0;
    const {sy, sh} = DOOR_FRAMES[frameIdx];
    ctx.drawImage(spr, 0, sy, 64, sh, o.x, o.y, o.w, o.h);
    return;
  }
  // Fallback
  if (o.active) return;
  ctx.fillStyle=PAL.door_frame; ctx.fillRect(o.x,o.y,o.w,o.h);
  ctx.fillStyle=PAL.door_wood;  ctx.fillRect(o.x+5,o.y+5,o.w-10,o.h-10);
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.5;
  const p1h = (o.h-20)*0.42;
  ctx.strokeRect(o.x+10,o.y+10,o.w-20,p1h);
  ctx.strokeRect(o.x+10,o.y+14+p1h,o.w-20,o.h-24-p1h);
  ctx.fillStyle='#d4c070'; ctx.beginPath(); ctx.arc(o.x+o.w-12,o.y+o.h/2,5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h);
}

// ── GATE ──────────────────────────────────────────────────────────
function drawGate(o) {
  if (o.animT >= 1) return;
  const a = 1 - o.animT;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = '#484040'; ctx.fillRect(o.x,o.y,o.w,o.h);
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=3;
  for (let i=0; i<5; i++) {
    const bx = o.x+5+i*8.5;
    ctx.beginPath(); ctx.moveTo(bx,o.y+5); ctx.lineTo(bx,o.y+o.h-5); ctx.stroke();
  }
  ctx.restore();
}

// ── BRIDGE ────────────────────────────────────────────────────────
function drawBridge(o) {
  // Procedural bridge — extends 14px into land on each side so corners touch grass
  const OVHG = 14;
  const bx = o.x - OVHG, by = o.y, bw = o.w + OVHG*2, bh = o.h;
  const n = o.labels.length;
  const pc = n>1?'#9a5c14':n===1?'#a86820':PAL.bridge_plank;
  const rc = n>1?'#6a3808':n===1?'#7a4810':PAL.bridge_rail;

  // Horizontal planks running east-west (direction of travel)
  const nPlanks = Math.max(4, Math.round(bh / 18));
  const ph = bh / nPlanks;
  for (let i=0; i<nPlanks; i++) {
    ctx.fillStyle = i%2===0 ? pc : shadeColor(pc,-18);
    ctx.fillRect(bx, by + i*ph, bw, Math.ceil(ph));
  }
  // Plank gap lines
  ctx.strokeStyle='rgba(0,0,0,0.30)'; ctx.lineWidth=1;
  for (let i=1; i<nPlanks; i++) {
    ctx.beginPath(); ctx.moveTo(bx, by+i*ph); ctx.lineTo(bx+bw, by+i*ph); ctx.stroke();
  }
  // Rope rails top & bottom
  ctx.fillStyle=rc;
  ctx.fillRect(bx, by, bw, 7);
  ctx.fillRect(bx, by+bh-7, bw, 7);
  // Rail highlight line
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(bx,by+3); ctx.lineTo(bx+bw,by+3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx,by+bh-4); ctx.lineTo(bx+bw,by+bh-4); ctx.stroke();
  // Corner posts (rest on land)
  const pw=11;
  ctx.fillStyle=shadeColor(rc,-12);
  ctx.fillRect(bx,    by, pw, bh);
  ctx.fillRect(bx+bw-pw, by, pw, bh);
  ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=1;
  ctx.strokeRect(bx,    by, pw, bh);
  ctx.strokeRect(bx+bw-pw, by, pw, bh);
  // Outer border
  ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=1.5;
  ctx.strokeRect(bx, by, bw, bh);

  // Danger shimmer when labeled wrong
  if (n > 0) {
    const t=Date.now()*0.005, s=n>1?1:0.5;
    ctx.strokeStyle=`rgba(220,80,20,${0.3*s})`; ctx.lineWidth=1.5;
    ctx.beginPath();
    for (let x=bx; x<bx+bw; x+=10) {
      const wy=by+bh/2+Math.sin(t+x*0.1)*5*s;
      x===bx?ctx.moveTo(x,wy):ctx.lineTo(x,wy);
    }
    ctx.stroke();
  }
}
function shadeColor(hex,amt){
  let n=parseInt(hex.slice(1),16);
  const r=clamp(((n>>16)&0xff)+amt,0,255);
  const g=clamp(((n>>8)&0xff)+amt,0,255);
  const b=clamp((n&0xff)+amt,0,255);
  return`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── CREATURE ──────────────────────────────────────────────────────
function drawCreature(o) {
  if (!o.visible) return;
  const cx=o.cx, cy=o.cy, r=o.r;
  const happy = o.isNeutral;

  // Danger aura — only for patrol creatures (the ones that actually deal damage)
  if (o.hasLabel && o.canErase && o.patrol) {
    const pulse = 0.38 + Math.sin(Date.now() * 0.005) * 0.22;
    ctx.save();
    ctx.globalAlpha = pulse;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.55);
    grad.addColorStop(0, 'rgba(220,30,10,0.55)');
    grad.addColorStop(1, 'rgba(200,10,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Sprite logic:
  //   neutral or accurate label (TAME/DOCILE/GENTLE) → happy  (content, correctly named)
  //   wrong label + patrol                            → angry  (hostile, dangerous)
  //   wrong label + stationary                        → creature.png (sad, lost/stuck)
  let sprKey;
  if (o.isNeutral || !o.canErase) sprKey = 'creature_happy';
  else if (o.patrol)               sprKey = 'creature_angry';
  else                             sprKey = 'creature';
  const spr = SPR[sprKey] ?? SPR['creature'];
  if (spr && spr.complete && spr.naturalWidth > 0) {
    ctx.drawImage(spr, cx-r, cy-r, r*2, r*2);
    return;
  }
  // Fallback
  ctx.fillStyle = happy ? '#50b050' : '#d84830';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(cx-r*0.3,cy-r*0.25,r*0.22,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.3,cy-r*0.25,r*0.22,0,Math.PI*2); ctx.fill();
}

// ── WHEEL ─────────────────────────────────────────────────────────
function drawWheel(o) {
  const cx=o.cx, cy=o.cy, r=o.r;
  const angle = o.nudge ? o.nudge.value*Math.PI*2 : 0;
  const spr = SPR.wheel;
  if (spr && spr.complete && spr.naturalWidth > 0) {
    const d = r*2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(spr, -r, -r, d, d);
    ctx.restore();
    // Alignment indicator dot — green when aligned, white otherwise
    ctx.beginPath();
    ctx.arc(cx+Math.cos(angle)*r*0.72, cy+Math.sin(angle)*r*0.72, 5, 0, Math.PI*2);
    ctx.fillStyle = o.active ? '#80e050' : 'rgba(255,255,255,0.55)';
    ctx.fill();
  } else {
    // Procedural fallback
    ctx.strokeStyle=PAL.wheel_rim; ctx.lineWidth=10;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    for (let i=0; i<8; i++) {
      const a=angle+i*Math.PI/4;
      ctx.strokeStyle=PAL.wheel_spoke; ctx.lineWidth=7; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*16,cy+Math.sin(a)*16);
      ctx.lineTo(cx+Math.cos(a)*r*0.88,cy+Math.sin(a)*r*0.88); ctx.stroke();
    }
    ctx.fillStyle='#b09050'; ctx.beginPath(); ctx.arc(cx,cy,16,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=o.active?'#80e050':'rgba(255,255,255,0.6)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(angle)*r*0.75,cy+Math.sin(angle)*r*0.75); ctx.stroke();
  }
}

// ── BIRD ──────────────────────────────────────────────────────────
// bird_sheet.png: 1000×250, 4 frames each 250×250
// Frame 0: perched, Frame 1: perch-bob, Frame 2: fly wings up, Frame 3: fly wings down
function drawBird(o) {
  if (!o.visible) return;
  const cx=o.cx, cy=o.cy, r=o.r;
  const spr = SPR.bird_sheet;
  if (spr && spr.complete && spr.naturalWidth > 0) {
    const fw = Math.floor(spr.naturalWidth / 4); // 250
    const sx = (o.birdFrame || 0) * fw;
    ctx.drawImage(spr, sx, 0, fw, spr.naturalHeight, cx-r, cy-r, r*2, r*2);
    return;
  }
  // Fallback
  ctx.fillStyle = PAL.bird_body;
  ctx.beginPath(); ctx.ellipse(cx,cy,r,r*0.72,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(cx,cy,r,r*0.72,0,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#1a1614'; ctx.beginPath(); ctx.arc(cx+r*0.4,cy-r*0.2,r*0.14,0,Math.PI*2); ctx.fill();
}

// ── BIRDHOUSE ─────────────────────────────────────────────────────
// birdhouse.png: 372×671 (house body + post). Drawn at object dimensions.
function drawBirdhouse(o) {
  const spr = SPR.birdhouse;
  // Short decorative post from object bottom to ground (max 55px)
  const postBottom = Math.min(o.y + o.h + 55, PZ.b - 2);
  ctx.fillStyle = '#7a4e18';
  ctx.fillRect(o.x + o.w/2 - 4, o.y + o.h - 2, 8, postBottom - (o.y + o.h) + 2);
  if (spr && spr.complete && spr.naturalWidth > 0) {
    // Draw at object bounds — birdhouse.png is 372×671 ≈ 1:1.80
    ctx.drawImage(spr, o.x, o.y, o.w, o.h);
    return;
  }
  // Fallback
  const x=o.x, y=o.y, w=o.w, h=o.h;
  const postH = PZ.b - y - h - 8;
  if (postH > 0) { ctx.fillStyle='#7a4e18'; ctx.fillRect(x+w/2-5,y+h,10,postH); }
  ctx.fillStyle = o.active?'#e0c030':PAL.nest_wood;
  rr(x,y,w,h,3); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=2; rr(x,y,w,h,3); ctx.stroke();
  ctx.fillStyle='#5a3010';
  ctx.beginPath(); ctx.moveTo(x-4,y); ctx.lineTo(x+w/2,y-22); ctx.lineTo(x+w+4,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#1a1210'; ctx.beginPath(); ctx.arc(x+w/2,y+h*0.42,9,0,Math.PI*2); ctx.fill();
}

// ── MIRROR ────────────────────────────────────────────────────────
// mirror.png: 376×664
function drawMirror(o) {
  const spr = SPR.mirror;
  if (spr && spr.complete && spr.naturalWidth > 0) {
    ctx.drawImage(spr, o.x, o.y, o.w, o.h);
  } else {
    ctx.fillStyle='#8a8070'; rr(o.x,o.y,o.w,o.h,12); ctx.fill();
    ctx.fillStyle=PAL.mirror_glass; rr(o.x+10,o.y+10,o.w-20,o.h-20,6); ctx.fill();
  }
  // Player reflection — only visible when player is within the mirror's y-range
  // and within a reasonable horizontal distance in front of it.
  const p = G.player;
  const mirrorFront = o.x - 240; // how far left the mirror "casts" a reflection
  const inHorizRange = p.x >= mirrorFront && p.x <= o.x + o.w;
  // Glass clip: measured from mirror.png (376×664) — frame ~28px L/R, ~42px top, ~120px bottom (wooden stand)
  // Scaled to game object (175×310)
  const gx = o.x + Math.round(o.w * 0.13);   // 13px inset each side
  const gy = o.y + Math.round(o.h * 0.14);   // 20px inset top
  const gw = o.w - Math.round(o.w * 0.26);   // 149px wide
  const gh = o.h - Math.round(o.h * 0.32);   // 32% bottom inset covers wooden stand (was 20%)
  // Use glass bounds (not full mirror bounds) so reflection disappears before the wooden stand
  const inVertRange = p.y >= gy && p.y <= gy + gh;
  ctx.save(); ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
  if (inHorizRange && inVertRange) {
    const rx = gx + gw/2;
    const ry = p.y;
    drawPlayerAt(rx, ry, true);
  }
  // Self-labels always shown inside glass, starting well below the top frame
  if (G.player.selfLbls.length > 0) {
    const lrx = gx + gw/2;
    const labelTop = gy + 18; // first label well inside glass area
    ctx.font = 'bold 10px "Courier New",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    G.player.selfLbls.forEach((l,i) => {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#b090e8';
      ctx.fillText('"'+l+'"', lrx, labelTop + i*28);
    });
  }
  ctx.restore();
}

// ── PANEL ─────────────────────────────────────────────────────────
// panel_on/off.png: 600×416
function drawPanel(o) {
  const key = o.isNeutral ? 'panel_off' : 'panel_on';
  const spr = SPR[key];
  if (spr && spr.complete && spr.naturalWidth > 0) {
    ctx.drawImage(spr, o.x, o.y, o.w, o.h);
    return;
  }
  ctx.fillStyle = o.isNeutral ? PAL.panel_n : PAL.panel_a;
  rr(o.x,o.y,o.w,o.h,5); ctx.fill();
  const ledCol = o.isNeutral ? '#40e040' : '#e04040';
  ctx.fillStyle = ledCol; ctx.beginPath(); ctx.arc(o.x+o.w-12,o.y+o.h-12,5,0,Math.PI*2); ctx.fill();
}

// ── DIAL ──────────────────────────────────────────────────────────
function drawDial(o) {
  const blocked = !allPanelsClear();
  const spr = SPR.labelling_machine;
  ctx.save();
  if (blocked) ctx.globalAlpha = 0.28;
  if (spr && spr.complete && spr.naturalWidth > 0) {
    // Contain-scale: fit entire image with no clipping, preserve aspect ratio
    const iw = spr.naturalWidth, ih = spr.naturalHeight;
    const scale = Math.min(o.w / iw, o.h / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = o.x + (o.w - dw) / 2;
    const dy = o.y + (o.h - dh) / 2;
    ctx.drawImage(spr, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#1a1008'; ctx.fillRect(o.x, o.y, o.w, o.h);
  }
  // Nudge bar — centred at dial bottom, max 180px wide
  if (!blocked && o.nudge) {
    const prog = 1 - Math.abs(o.nudge.value - o.nudge.target) / o.nudge.range;
    const bw = Math.min(o.w - 16, 180), bh = 5;
    const bx = o.x + (o.w - bw) / 2, by = o.y + o.h - 10;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(60,40,20,0.8)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = prog > 0.85 ? '#40e060' : '#e08020';
    ctx.fillRect(bx, by, bw * Math.max(0, prog), bh);
  }
  ctx.restore();
}

// ── NOTICE ────────────────────────────────────────────────────────
// Rendered as a small metal wall-plaque (not a black box).
function drawNotice(o) {
  // Plaque body — dark steel
  const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y+o.h);
  grad.addColorStop(0, '#5a5048'); grad.addColorStop(1, '#3a3028');
  ctx.fillStyle = grad; rr(o.x,o.y,o.w,o.h,4); ctx.fill();
  // Bright border to break from bg
  ctx.strokeStyle='rgba(200,180,120,0.45)'; ctx.lineWidth=1.5;
  rr(o.x,o.y,o.w,o.h,4); ctx.stroke();
  // Subtle highlight strip at top
  ctx.fillStyle='rgba(255,240,180,0.08)'; ctx.fillRect(o.x+3,o.y+2,o.w-6,4);
  // Rivet dots
  const rv = [[o.x+5,o.y+o.h/2],[o.x+o.w-5,o.y+o.h/2]];
  rv.forEach(([rx,ry])=>{ctx.fillStyle='rgba(255,240,180,0.3)';ctx.beginPath();ctx.arc(rx,ry,2.5,0,Math.PI*2);ctx.fill();});
}

// ── PLANT ─────────────────────────────────────────────────────────
function drawPlant(o) {
  const alive = o.isNeutral;
  const key = alive ? 'unwilted_plant' : 'wilted_plant';
  const spr = SPR[key];
  if (spr && spr.complete && spr.naturalWidth > 0) {
    // Crop to visible content region, expand to full GObj rect
    const sx = alive ? 80 : 90, sy = alive ? 62 : 80;
    const sw = alive ? 267 : 252, sh = alive ? 445 : 419;
    ctx.drawImage(spr, sx, sy, sw, sh, o.x, o.y, o.w, o.h);
  } else {
    // Procedural fallback
    const cx = o.x + o.w/2, bot = o.y + o.h;
    ctx.fillStyle = alive ? '#8b5e3c' : '#6a4428';
    ctx.beginPath();
    ctx.moveTo(cx - o.w*0.28, bot - o.h*0.28); ctx.lineTo(cx - o.w*0.36, bot);
    ctx.lineTo(cx + o.w*0.36, bot); ctx.lineTo(cx + o.w*0.28, bot - o.h*0.28);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = alive ? '#3a9020' : '#5a4820';
    ctx.beginPath(); ctx.ellipse(cx, o.y + o.h*0.3, o.w*0.3, o.h*0.2, 0, 0, Math.PI*2); ctx.fill();
  }
}

// ── CHEST ─────────────────────────────────────────────────────────
function drawChest(o) {
  const open = o.isNeutral;
  const key = open ? 'opened_chest' : 'closed_chest';
  const spr = SPR[key];
  if (spr && spr.complete && spr.naturalWidth > 0) {
    // closed: content at (111,70) size 329×298; opened: content at (100,36) size 340×349
    if (open) {
      ctx.drawImage(spr, 100, 36, 340, 349, o.x, o.y, o.w, o.h);
    } else {
      ctx.drawImage(spr, 111, 70, 329, 298, o.x, o.y, o.w, o.h);
    }
  } else {
    // Procedural fallback
    const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y+o.h);
    grad.addColorStop(0, '#a06828'); grad.addColorStop(1, '#5a3810');
    ctx.fillStyle = grad; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#c0a030';
    ctx.fillRect(o.x + o.w*0.2, o.y, o.w*0.08, o.h);
    ctx.fillRect(o.x + o.w*0.72, o.y, o.w*0.08, o.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
}

// ── LANTERN ───────────────────────────────────────────────────────
function drawLantern(o) {
  const lit = o.isNeutral;
  const key = lit ? 'lit_lantern' : 'unlit_lantern';
  const spr = SPR[key];
  const cx = o.x + o.w/2;
  if (spr && spr.complete && spr.naturalWidth > 0) {
    // Content at (56,22) size 238×630 in 353×707 image
    ctx.drawImage(spr, 56, 22, 238, 630, o.x, o.y, o.w, o.h);
    // Animated ambient glow when lit
    if (lit) {
      const glowCy = o.y + o.h * 0.45;
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(Date.now()*0.004)*0.06;
      const glow = ctx.createRadialGradient(cx, glowCy, 0, cx, glowCy, o.w*3);
      glow.addColorStop(0, '#ffdd50'); glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, glowCy, o.w*3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  } else {
    // Procedural fallback
    const fy = o.y + o.h*0.15, fh = o.h*0.70, fw = o.w*0.8, fx = o.x + o.w*0.1;
    ctx.fillStyle = '#484848';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = lit ? 'rgba(255,220,80,0.85)' : 'rgba(40,40,60,0.6)';
    ctx.fillRect(fx+fw*0.1, fy+fh*0.1, fw*0.8, fh*0.8);
    if (lit) {
      ctx.save(); ctx.globalAlpha = 0.18+Math.sin(Date.now()*0.004)*0.05;
      const glow = ctx.createRadialGradient(cx, fy+fh/2, 0, cx, fy+fh/2, o.w*2);
      glow.addColorStop(0,'#ffdd50'); glow.addColorStop(1,'transparent');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,fy+fh/2,o.w*2,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
}

// ── DISPENSER COUNTDOWN UI ────────────────────────────────────────
// Draws a small pulsing arc above each object that is counting down to regen.
function drawDispenserTimers() {
  const lv = G.lv;
  if (!lv.regenRate) return;
  for (const o of lv.objs) {
    if (o._regenT === null || o._regenT === undefined) continue;
    const rate = lv.regenRate;
    const prog  = Math.max(0, o._regenT / rate); // 1→0 as time runs out
    const urgent = o._regenT <= 3;
    const cx = o.pcx;
    const cy = o.spriteTop - 14;
    const R  = 9;

    ctx.save();
    // Pulsing alpha when urgent
    if (urgent) ctx.globalAlpha = 0.65 + Math.sin(Date.now() * 0.012) * 0.35;
    // Background ring
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // Countdown arc (clockwise drain)
    ctx.strokeStyle = urgent ? '#ff3020' : '#ff8800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    // Small dot at center
    ctx.fillStyle = urgent ? '#ff3020' : '#ff8800';
    ctx.globalAlpha = (urgent ? 0.9 : 0.6);
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ── DARK ZONE ─────────────────────────────────────────────────────
// For levels like The Dark Hall: renders an ink-black overlay over the
// zone beyond the unlit lantern, lifted (warm glow) once it's lit.
function drawDarkZone() {
  const lv = G.lv;
  if (!lv.darkZone) return;
  const dz = lv.darkZone;
  const litObj = lv.objs.find(o => o.id === dz.litBy);
  const isLit = litObj?.isNeutral === true;
  const zx = dz.x;

  if (!isLit) {
    // Ink-black darkness over the right zone
    ctx.save();
    // Soft feathered edge at zone boundary
    const edgeW = 50;
    const edgeGrad = ctx.createLinearGradient(zx - edgeW, 0, zx + 8, 0);
    edgeGrad.addColorStop(0, 'rgba(3,2,1,0)');
    edgeGrad.addColorStop(1, 'rgba(3,2,1,0.94)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(zx - edgeW, PZ.t, edgeW + 8, PZ.b - PZ.t);
    // Solid darkness beyond
    ctx.fillStyle = 'rgba(3,2,1,0.94)';
    ctx.fillRect(zx + 8, PZ.t, VW - zx - 8, PZ.b - PZ.t);
    ctx.restore();
  } else if (litObj) {
    // Lantern lit — warm golden wash over the revealed zone
    const lx = litObj.x + litObj.w / 2;
    const ly = litObj.y + litObj.h * 0.4;
    const pulse = Math.sin(Date.now() * 0.003) * 0.04 + 0.10;
    ctx.save();
    ctx.globalAlpha = pulse;
    const lightGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 420);
    lightGrad.addColorStop(0,   'rgba(255,200,60,1)');
    lightGrad.addColorStop(0.35,'rgba(220,140,30,0.6)');
    lightGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.rect(zx, PZ.t, VW - zx, PZ.b - PZ.t);
    ctx.fill();
    ctx.restore();
  }
}

// ── OBJECT LABELS ─────────────────────────────────────────────────
//  Labels are drawn ABOVE or BELOW the sprite bounding box,
//  never overlapping the main sprite body.
function drawObjLabels(o) {
  if (!o.visible) return;
  if (o.labels.length === 0) return;
  const lbl = o.labels[0];
  const lines = lbl.text.split('\n');
  const numLines = lines.length;
  const acc = lbl.acc;

  let lcx, lcy;

  if (o.type === 'notice') {
    // Notice plaques: label centered ON the notice board (they're the same size)
    lcx = o.x + o.w/2;
    lcy = o.y + o.h/2;
  } else if (o.type === 'birdhouse') {
    // Birdhouse: label above the house roof
    lcx = o.x + o.w/2;
    lcy = labelAboveCY(o.y - 22, numLines, acc); // -22 for the roof triangle
  } else {
    // All other objects: label ABOVE the sprite with gap
    lcx = o.pcx;
    lcy = labelAboveCY(o.spriteTop, numLines, acc);
  }

  const shakeX = o.shakeT > 0 ? Math.sin(o.shakeT*26)*8 : 0;
  const erasing = G.eraseTarget === o;
  const alpha = erasing ? 0.55+Math.sin(Date.now()*0.014)*0.45 : 1.0;
  drawLabelAt(lines, lcx, lcy, acc, alpha, shakeX, o.tilt);
}

// ── EXIT ZONE ─────────────────────────────────────────────────────
function drawExitZone() {
  const gate = G.lv.objs.find(o => o.type==='gate');
  if (!gate || !gate.solid) {
    const t = Date.now()*0.003;
    const pulse = Math.sin(t)*0.07 + 0.45;
    // Dark bg so arrow is always readable regardless of floor colour
    ctx.fillStyle = `rgba(0,0,0,${pulse})`;
    ctx.fillRect(EXIT_X, EXIT_Y, EXIT_W, EXIT_H);
    // Bright border
    ctx.strokeStyle = '#60e860'; ctx.lineWidth = 3;
    ctx.strokeRect(EXIT_X+1, EXIT_Y+1, EXIT_W-2, EXIT_H-2);
    // Arrow with outline for contrast
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeText('▶', EXIT_X+EXIT_W/2, EXIT_Y+EXIT_H/2);
    ctx.fillStyle = '#80ff80';
    ctx.fillText('▶', EXIT_X+EXIT_W/2, EXIT_Y+EXIT_H/2);
  }
}

// ── PLAYER ────────────────────────────────────────────────────────
// Character sprites: 52×52px each, rendered at 2× = 104×104
const CHAR_DISPLAY = 104; // display size

function drawPlayerAt(x, y, mirrorReflection=false) {
  const p = G.player;
  const half = CHAR_DISPLAY / 2;
  const dir = p.dir;
  let img;

  if (p.moving && !mirrorReflection) {
    img = charWalk[dir] ? charWalk[dir][p.walkFrame] : null;
  } else {
    img = charIdle[dir] || null;
  }

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    if (mirrorReflection) {
      // Flip horizontally for mirror effect
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -half, -half, CHAR_DISPLAY, CHAR_DISPLAY);
    } else {
      ctx.drawImage(img, x-half, y-half, CHAR_DISPLAY, CHAR_DISPLAY);
    }
    ctx.restore();
  } else {
    // Fallback round character
    ctx.save();
    if (mirrorReflection) { ctx.translate(x,y); ctx.scale(-1,1); ctx.translate(-x,-y); }
    ctx.fillStyle = PAL.player_body;
    ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = PAL.player_edge; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer() {
  const p = G.player;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(p.x+3, p.y+p.r+4, p.r*0.85, 5, 0, 0, Math.PI*2); ctx.fill();

  // Blink during damage immunity (hurtT 0–1.8, but not when frozen at 99)
  const blinking = p.hurtT > 0 && p.hurtT < 90;
  if (blinking) {
    const bAlpha = 0.30 + Math.abs(Math.sin(Date.now() * 0.022)) * 0.55;
    ctx.save(); ctx.globalAlpha = bAlpha;
  }
  drawPlayerAt(p.x, p.y, false);
  if (blinking) ctx.restore();

  // Self-label orbs orbiting player
  const nl = p.selfLbls.length;
  if (nl > 0) {
    p.selfLbls.forEach((_,i) => {
      const a = p.labelAnim + i*(Math.PI*2/nl);
      const ox = p.x+Math.cos(a)*36, oy = p.y+Math.sin(a)*36;
      ctx.save(); ctx.globalAlpha=0.75;
      ctx.fillStyle='#8060d0';
      ctx.beginPath(); ctx.arc(ox,oy,5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  // Nudge mode ring
  if (G.nudgeMode) {
    ctx.strokeStyle='rgba(200,170,30,0.75)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+8,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }

  // Erase hold arc
  if (G.eraseHold > 0 && G.eraseTarget) {
    const prog = G.eraseHold / ERASE_TIME;
    ctx.strokeStyle=`rgba(255,240,160,${0.5+prog*0.5})`; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+12,-Math.PI/2,-Math.PI/2+prog*Math.PI*2); ctx.stroke();
  }
}

// ── SIMPLE VIEW ───────────────────────────────────────────────────
function drawSimpleView() {
  ctx.save(); ctx.globalAlpha = G.svAlpha;
  ctx.fillStyle='rgba(16,12,8,0.25)'; ctx.fillRect(50,PZ.t,VW-100,PZ.b-PZ.t);
  for (const o of G.lv.objs) {
    if (!o.canNudge && !G.nudgeMode) continue;
    if (G.nudgeMode && o !== G.nudgeTarget) continue;
    ctx.strokeStyle='#c0a020'; ctx.lineWidth=2; ctx.setLineDash([3,5]);
    if (o.type==='wheel') {
      const a = o.nudge.target*Math.PI*2;
      ctx.beginPath(); ctx.moveTo(o.cx,o.cy); ctx.lineTo(o.cx+Math.cos(a)*o.r*0.78,o.cy+Math.sin(a)*o.r*0.78); ctx.stroke();
      ctx.setLineDash([]); ctx.font='11px "Courier New",monospace'; ctx.textAlign='center';
      ctx.fillStyle='#c0a020'; ctx.fillText('ALIGN HERE',o.cx,o.cy+o.r+18);
    } else if (o.type==='dial') {
      // Machine guide: show "TURN OFF" arrow pointing down at the machine centre
      const mx = o.pcx, my = o.pcy;
      ctx.beginPath(); ctx.moveTo(mx, my-30); ctx.lineTo(mx, my+30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx-10, my+18); ctx.lineTo(mx, my+30); ctx.lineTo(mx+10, my+18); ctx.stroke();
      ctx.setLineDash([]); ctx.font='11px "Courier New",monospace'; ctx.textAlign='center';
      ctx.fillStyle='#c0a020'; ctx.fillText('TURN OFF', mx, my - 38);
    }
  }
  if (G.player.selfLbls.length>0) {
    const mirror = G.lv.objs.find(o=>o.type==='mirror');
    if (mirror) {
      ctx.font='bold 11px "Courier New",monospace'; ctx.fillStyle='#9070d0'; ctx.textAlign='center';
      G.player.selfLbls.forEach((l,i) => { ctx.globalAlpha=0.8; ctx.fillText('"'+l+'"',mirror.pcx,mirror.y+44+i*24); });
    }
  }
  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────
function drawHUD() {
  const lv = G.lv;
  // Top bar
  ctx.fillStyle = PAL.hud; ctx.fillRect(0,0,VW,PZ.t);
  ctx.fillStyle = PAL.c_main; ctx.font='bold 13px "Courier New",monospace';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`${lv.id+1} / ${LEVELS.length}  —  ${lv.name}`, 14, 17);
  ctx.fillStyle = PAL.c_dim; ctx.font='11px "Courier New",monospace'; ctx.textAlign='right';
  ctx.fillText(G.nudgeMode?'← → adjust · E finish':'WASD move · hold E erase · TAB guide · R reset', VW-14, 17);

  // Bottom hint bar
  ctx.fillStyle = PAL.hint; ctx.fillRect(0, PZ.b, VW, VH-PZ.b);
  let hintTxt = '', hintCol = PAL.c_main;
  if (G.denyNotif > 0) { hintTxt = G.denyMsg || 'That label is correct.'; hintCol = PAL.c_deny; }
  else if (G.eraseTarget) {
    const acc = G.eraseTarget.labels.length>0 && G.eraseTarget.labels[0].acc;
    if (G.eraseTarget.type==='mirror') hintTxt = G.eraseHold>0?'Erasing…':'Hold E — erase a label from yourself';
    else if (acc) hintTxt = G.eraseHold>0?'Erasing…':'Hold E to try it';
    else hintTxt = G.eraseHold>0?'Erasing…':'Hold E to erase this label';
  } else if (G.nudgeMode) hintTxt='← → to adjust · TAB for guide · E to stop';
  else {
    const nn = G.lv.objs.find(o=>o.canNudge&&o.distToPoint(G.player.x,G.player.y)<NUDGE_RANGE);
    hintTxt = nn ? 'Press E to enter adjust mode' : (lv.hint||'');
  }
  // Hint text with outline for legibility
  ctx.font = '12px "Courier New",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hintY = PZ.b + (VH-PZ.b)/2;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.strokeText(hintTxt, VW/2, hintY);
  ctx.fillStyle = hintCol;
  ctx.fillText(hintTxt, VW/2, hintY);

  // Notification — bottom bar pill, so it doesn't block the play area
  if (G.notif.t > 0) {
    const a = Math.min(1, G.notif.t);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = 'bold 14px "Courier New",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mainW = ctx.measureText(G.notif.text).width;
    const boxH  = 28;
    const boxW  = mainW + 32;
    const boxX  = VW/2 - boxW/2;
    const boxY  = PZ.b - boxH - 6;  // just above the hint bar
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(8,6,4,0.88)';
    rr(boxX, boxY, boxW, boxH, 6); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(192,152,30,0.45)'; ctx.lineWidth = 1;
    rr(boxX, boxY, boxW, boxH, 6); ctx.stroke();
    ctx.fillStyle = PAL.c_gold;
    ctx.fillText(G.notif.text, VW/2, boxY + boxH/2);
    ctx.restore();
  }

  // Self-label count
  const nl = G.player.selfLbls.length;
  if (nl > 0) {
    ctx.fillStyle='#8060d0'; ctx.font='11px "Courier New",monospace';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(`carrying ${nl} label${nl>1?'s':''}`, 14, PZ.b+(VH-PZ.b)/2);
  }

  // Key inventory indicator — shown when player is holding a key item
  if (G.player.inventory.length > 0) {
    const kx = nl > 0 ? 148 : 14;
    const ky = PZ.b + (VH - PZ.b) / 2;
    ctx.save();
    ctx.strokeStyle = '#d4a830'; ctx.fillStyle = '#d4a830'; ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    // Key ring
    ctx.beginPath(); ctx.arc(kx + 4, ky - 3, 4, 0, Math.PI * 2); ctx.stroke();
    // Key shaft
    ctx.beginPath(); ctx.moveTo(kx + 4, ky + 1); ctx.lineTo(kx + 4, ky + 9); ctx.stroke();
    // Key teeth
    ctx.beginPath(); ctx.moveTo(kx + 4, ky + 4); ctx.lineTo(kx + 8, ky + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(kx + 4, ky + 7); ctx.lineTo(kx + 7, ky + 7); ctx.stroke();
    // Label
    ctx.fillStyle = '#b09028'; ctx.font = '10px "Courier New",monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('key', kx + 13, ky + 3);
    ctx.restore();
  }

  // Health display — shown whenever the level has at least one solid labeled creature
  const hasSolidCreature = G.lv?.objs?.some(o => o.type === 'creature' && o.solid);
  if (hasSolidCreature || G.player.hp < G.player.maxHp) {
    const p = G.player;
    const hurtFlicker = p.hurtT > 0 && p.hurtT < 90 && Math.sin(Date.now()*0.025) > 0;
    const HS = 18; // heart sprite render size
    const hY  = PZ.b + (VH - PZ.b) / 2 - HS / 2;
    const hFull  = SPR.heart_full;
    const hEmpty = SPR.heart_empty;
    const useSprites = hFull?.complete && hFull.naturalWidth > 0 &&
                       hEmpty?.complete && hEmpty.naturalWidth > 0;
    ctx.save();
    if (hurtFlicker) ctx.globalAlpha = 0.45 + Math.abs(Math.sin(Date.now()*0.025)) * 0.55;
    for (let i = 0; i < p.maxHp; i++) {
      const hx = VW - 14 - (p.maxHp - 1 - i) * (HS + 3);
      if (useSprites) {
        const spr = i < p.hp ? hFull : hEmpty;
        ctx.drawImage(spr, hx, hY, HS, HS);
      } else {
        // Text fallback
        ctx.font = '15px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle = i < p.hp ? '#e04040' : '#442020';
        ctx.fillText(i < p.hp ? '♥' : '♡', hx + HS/2, hY + HS/2);
      }
    }
    ctx.restore();
  }

  // Nudge alignment bar
  if (G.nudgeMode && G.nudgeTarget?.nudge) {
    const nd = G.nudgeTarget.nudge;
    const prog = 1 - Math.abs(nd.value-nd.target)/nd.range;
    const bw=160,bh=6,bx=(VW-bw)/2,by=PZ.b+10;
    ctx.fillStyle='rgba(255,255,255,0.12)'; rr(bx,by,bw,bh,3); ctx.fill();
    ctx.fillStyle=PAL.c_gold; rr(bx,by,bw*Math.max(0,prog),bh,3); ctx.fill();
    ctx.fillStyle=PAL.c_dim; ctx.font='10px "Courier New",monospace';
    ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText('alignment', VW/2, by+bh+3);
  }
}

// ── INTRO CARD ────────────────────────────────────────────────────
function drawIntroCard() {
  const ic = G.introCard;
  const fadeIn  = Math.min(1, ic.age * 3.5);
  const fadeOut = ic.closing ? Math.max(0, 1 - ic.closeAge / 0.3) : 1;
  const fade    = fadeIn * fadeOut;
  const showPrompt = !ic.closing && ic.age >= 0.8;
  // Pre-measure wrapped line count so the card height is always correct
  ctx.font = '14px "Courier New",monospace';
  const MAX_W = 390;
  let totalSublines = 0;
  for (const raw of ic.lines) {
    const words = raw.split(' ');
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > MAX_W && cur) { totalSublines++; cur = w; }
      else { cur = test; }
    }
    if (cur) totalSublines++;
  }
  const contentH = totalSublines * 22;
  // Card: 68px header (name + divider) + content + 50px footer (Press E + padding)
  const cardH = Math.max(190, 68 + contentH + 52);
  const cardTop = VH / 2 - cardH / 2;

  ctx.save(); ctx.globalAlpha = fade * 0.92;
  ctx.fillStyle = 'rgba(10,8,6,0.9)';
  rr(VW/2-220, cardTop, 440, cardH, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(200,160,40,0.4)'; ctx.lineWidth = 1.5;
  rr(VW/2-220, cardTop, 440, cardH, 12); ctx.stroke();
  ctx.globalAlpha = fade;
  // Level name
  ctx.fillStyle = '#c09820'; ctx.font = 'bold 18px "Courier New",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(G.lv.name, VW/2, cardTop + 26);
  // Divider
  ctx.strokeStyle = 'rgba(200,160,40,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(VW/2-160, cardTop + 44); ctx.lineTo(VW/2+160, cardTop + 44); ctx.stroke();
  // Intro lines — word-wrap so nothing escapes the 400px content width
  ctx.fillStyle = '#d4cbb4'; ctx.font = '14px "Courier New",monospace';
  let lineY = cardTop + 58;
  for (const raw of ic.lines) {
    const words = raw.split(' ');
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > MAX_W && cur) {
        ctx.fillText(cur, VW/2, lineY); lineY += 22; cur = w;
      } else { cur = test; }
    }
    if (cur) { ctx.fillText(cur, VW/2, lineY); lineY += 22; }
  }
  // Press E prompt — always anchored to card bottom, appears after 0.8s, pulses
  if (showPrompt) {
    const pulse = Math.sin(ic.age * 4) * 0.3 + 0.7;
    ctx.globalAlpha = fade * pulse;
    ctx.fillStyle = '#a08828'; ctx.font = '12px "Courier New",monospace';
    ctx.fillText('Press E to continue', VW/2, cardTop + cardH - 18);
  }
  ctx.restore();
}

// ── TITLE SCREEN ──────────────────────────────────────────────────
function _strokeFill(text, x, y) {
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}
function drawTitle() {
  // Background image
  const bg = SPR.menu_bg;
  if (bg && bg.complete && bg.naturalWidth > 0) {
    // Scale-to-cover, centred
    const bw = bg.naturalWidth, bh = bg.naturalHeight;
    const scale = Math.max(VW/bw, VH/bh);
    const dw = bw*scale, dh = bh*scale;
    ctx.drawImage(bg, (VW-dw)/2, (VH-dh)/2, dw, dh);
  } else {
    ctx.fillStyle='#100c08'; ctx.fillRect(0,0,VW,VH);
  }
  // Dark overlay so text is always readable
  ctx.fillStyle='rgba(6,4,2,0.68)'; ctx.fillRect(0,0,VW,VH);

  const t = Date.now()*0.001;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.lineJoin='round';

  // Title
  ctx.font='bold 78px "Courier New",monospace';
  ctx.lineWidth=6; ctx.strokeStyle='rgba(0,0,0,0.9)';
  ctx.fillStyle='#ece0c8';
  _strokeFill('UNSAYING', VW/2, 175);

  // Subtitle
  ctx.font='14px "Courier New",monospace';
  ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,0.85)';
  ctx.fillStyle='#b0a080';
  _strokeFill('a puzzle about wrong labels', VW/2, 232);

  // Divider
  ctx.strokeStyle='rgba(192,152,30,0.35)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(VW/2-160,260); ctx.lineTo(VW/2+160,260); ctx.stroke();

  // Story lines
  ctx.font='13px "Courier New",monospace';
  ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.8)';
  ctx.fillStyle='#c8b898';
  const story = ['You hold an eraser.', 'Walk to a label. Hold E. Fix the world.'];
  story.forEach((l,i) => { if (l) _strokeFill(l, VW/2, 310+i*34); });

  // Press to begin (pulsing)
  const pulse = Math.sin(t*2.5)*0.3+0.7;
  ctx.font='bold 16px "Courier New",monospace';
  ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,0.9)';
  ctx.fillStyle=`rgba(220,175,40,${pulse})`;
  _strokeFill('PRESS SPACE TO BEGIN', VW/2, 450);

  // Controls hint
  ctx.font='11px "Courier New",monospace';
  ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.8)';
  ctx.fillStyle='rgba(140,120,90,0.85)';
  _strokeFill('WASD — move   hold E — erase   TAB — guide   R — reset', VW/2, 490);
}

// ── SPLASH SCREEN ─────────────────────────────────────────────────
function drawSplash() {
  ctx.fillStyle='#000'; ctx.fillRect(0,0,VW,VH);
  const t = G.splashT;
  const fadeIn  = Math.min(1, t/0.4);
  const fadeOut = t > 1.6 ? Math.max(0, 1-(t-1.6)/0.4) : 1;
  const alpha   = fadeIn * fadeOut;
  const spl = SPR.intro_splash;
  if (spl && spl.complete && spl.naturalWidth > 0) {
    const bw=spl.naturalWidth, bh=spl.naturalHeight;
    const scale=Math.min(VW/bw, VH/bh);
    ctx.globalAlpha=alpha;
    ctx.drawImage(spl,(VW-bw*scale)/2,(VH-bh*scale)/2,bw*scale,bh*scale);
    ctx.globalAlpha=1;
  } else {
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold 22px "Courier New",monospace';
    ctx.fillStyle=`rgba(200,185,155,${alpha})`;
    ctx.fillText('BUZZHORNET STUDIOS', VW/2, VH/2);
  }
}

// ── LEVEL COMPLETE ───────────────────────────────────────────────
function drawComplete() {
  const lv = G.lv;
  drawFloor(lv.bg);
  if (lv.water) drawWater(lv.water);
  drawWallVisuals();
  drawDecor(lv.decor);
  for (const o of lv.objs) drawObj(o);
  drawPlayer();
  drawHUD();
  const t = G.completeClock;
  const ov = Math.min(0.6, t*1.2);
  ctx.fillStyle=`rgba(0,0,0,${ov})`; ctx.fillRect(0,0,VW,VH);
  const ca = Math.min(1, t*2.2);
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round';
  ctx.font='bold 30px "Courier New",monospace';
  ctx.lineWidth=6; ctx.strokeStyle=`rgba(0,0,0,${ca*0.9})`;
  ctx.fillStyle=`rgba(236,224,200,${ca})`;
  _strokeFill(lv.solveMsg||'Done.', VW/2, 218);
  ctx.font='14px "Courier New",monospace';
  ctx.lineWidth=4; ctx.strokeStyle=`rgba(0,0,0,${ca*0.85})`;
  ctx.fillStyle=`rgba(160,140,100,${ca})`;
  _strokeFill(lv.name||'', VW/2, 264);
  if (G.player.selfLbls.length>0) {
    ctx.font='13px "Courier New",monospace';
    ctx.lineWidth=3; ctx.strokeStyle=`rgba(0,0,0,${ca*0.8})`;
    ctx.fillStyle=`rgba(212,168,48,${ca})`;
    _strokeFill('You are: '+G.player.selfLbls.join(', '), VW/2, 310);
  }
  if (t>0.8) {
    const pulse=Math.sin(t*3)*0.25+0.75;
    ctx.font='bold 14px "Courier New",monospace';
    ctx.lineWidth=4; ctx.strokeStyle=`rgba(0,0,0,${pulse*0.9})`;
    ctx.fillStyle=`rgba(220,175,40,${pulse*ca})`;
    _strokeFill('PRESS E TO CONTINUE', VW/2, 390);
  }
}

// ── ENDING ─────────────────────────────────────────────────────────────
function drawEnding() {
  ctx.fillStyle='#080604'; ctx.fillRect(0,0,VW,VH);
  const t=G.endingT;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round';
  const lines=[
    'You have erased every wrong label.',
    'The world remembers what it was.',
    '',
    'You are: '+(G.player.selfLbls.join(', ')||'yourself.'),
    '',
    'That was always enough.',
  ];
  ctx.font='15px "Courier New",monospace';
  ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.85)';
  lines.forEach((line,i)=>{
    const a=Math.min(1,Math.max(0,(t-i*1.0)*1.8));
    if (a<=0||line==='') return;
    ctx.fillStyle=`rgba(200,185,155,${a})`;
    _strokeFill(line, VW/2, 185+i*40);
  });
  if (t>6) {
    const pulse=Math.sin(t*2)*0.2+0.8;
    ctx.font='13px "Courier New",monospace';
    ctx.lineWidth=3; ctx.strokeStyle=`rgba(0,0,0,${pulse*0.8})`;
    ctx.fillStyle=`rgba(140,120,80,${pulse})`;
    _strokeFill('PRESS E TO CONTINUE', VW/2, 490);
  }
}

// ── CREDITS ─────────────────────────────────────────────────────────────
function drawCredits() {
  ctx.fillStyle='#060402'; ctx.fillRect(0,0,VW,VH);
  const t=G.creditsT;
  const a=Math.min(1,t*1.5);
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round';

  // Studio logo
  const logo=SPR.studio_logo;
  if (logo&&logo.complete&&logo.naturalWidth>0) {
    const lw=Math.min(160,logo.naturalWidth), lh=lw*(logo.naturalHeight/logo.naturalWidth);
    ctx.globalAlpha=a;
    ctx.drawImage(logo,(VW-lw)/2, 80, lw, lh);
    ctx.globalAlpha=1;
  }

  // Game title
  ctx.font='bold 36px "Courier New",monospace';
  ctx.lineWidth=6; ctx.strokeStyle=`rgba(0,0,0,${a*0.9})`;
  ctx.fillStyle=`rgba(220,200,160,${a})`;
  _strokeFill('UNSAYING', VW/2, 230);

  ctx.font='12px "Courier New",monospace';
  ctx.lineWidth=3; ctx.strokeStyle=`rgba(0,0,0,${a*0.8})`;
  ctx.fillStyle=`rgba(140,120,90,${a})`;
  _strokeFill('a puzzle about wrong labels', VW/2, 264);

  // Clean credits — no real names, no asset credits
  ctx.font='14px "Courier New",monospace';
  ctx.lineWidth=3; ctx.strokeStyle=`rgba(0,0,0,${a*0.8})`;
  ctx.fillStyle=`rgba(170,152,120,${a})`;
  _strokeFill('Made by', VW/2, 330);

  ctx.font='bold 20px "Courier New",monospace';
  ctx.lineWidth=4; ctx.strokeStyle=`rgba(0,0,0,${a*0.9})`;
  ctx.fillStyle=`rgba(212,168,48,${a})`;
  _strokeFill('Berry', VW/2, 362);

  ctx.font='15px "Courier New",monospace';
  ctx.lineWidth=3; ctx.strokeStyle=`rgba(0,0,0,${a*0.8})`;
  ctx.fillStyle=`rgba(212,168,48,${a})`;
  _strokeFill('BuzzHornet Studio', VW/2, 392);

  // Thank you
  ctx.font='14px "Courier New",monospace';
  ctx.fillStyle=`rgba(200,185,155,${a})`;
  ctx.lineWidth=3; ctx.strokeStyle=`rgba(0,0,0,${a*0.8})`;
  _strokeFill('Thank you for playing.', VW/2, 448);

  // Press to return
  if (t>1.5) {
    const pulse=Math.sin(t*2)*0.2+0.8;
    ctx.font='11px "Courier New",monospace';
    ctx.lineWidth=3; ctx.strokeStyle=`rgba(0,0,0,${pulse*0.8})`;
    ctx.fillStyle=`rgba(100,90,70,${pulse})`;
    _strokeFill('PRESS SPACE TO RETURN TO TITLE', VW/2, 510);
  }
}

// ════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ════════════════════════════════════════════════════════════════
let _lastTs=0;
let _errMsg='';
function loop(ts) {
  // Schedule next frame FIRST so errors never kill the loop
  requestAnimationFrame(loop);
  const dt=Math.min((ts-_lastTs)*0.001, 0.05);
  _lastTs=ts;
  try {
    tick(dt);
    render();
  } catch(e) {
    // Draw the error on-canvas so it's visible in the browser
    _errMsg = e.message + ' — ' + (e.stack||'').split('\n')[1];
    try {
      ctx.save();
      ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#f55'; ctx.font='13px monospace';
      ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText('JS ERROR: ' + e.message, 10, 10);
            (e.stack||'').split('\n').slice(0,6).forEach((l,i)=>ctx.fillText(l,10,30+i*16));
      ctx.restore();
    } catch(_){}
  }
}

// First interaction: unlock audio context + play intro sound once
window.addEventListener('pointerdown', function _firstTouch() {
  resumeAC();
  if (!G.splashSndPlayed) {
    G.splashSndPlayed=true;
    _introSfx.play().catch(()=>{});
  }
}, {once:true});

// Kick off
requestAnimationFrame(loop);
