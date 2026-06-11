// PictureWall display window: plays the music, analyses it in real time,
// and drives the active scene on the canvas.
/* global SCENE_DEFS, PW */
(() => {
  'use strict';

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const audioEl = document.getElementById('player');
  const emptyEl = document.getElementById('empty');
  const hintEl = document.getElementById('hint');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let state = null;
  let scene = null;
  let sceneId = null;
  let playing = false;
  let currentTrack = 0;
  let trackUrl = null;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;

  // ------------------------------------------------------ photo provider ----

  // Keeps a shuffled queue of every photo in the folder, preloads a few
  // decoded images ahead of time, and bumps newly-added photos to the front
  // so people see their picture soon after dropping it in the folder.
  class PhotoProvider {
    constructor() {
      this.paths = new Map(); // path -> { path, mtime }
      this.queue = [];
      this.ready = []; // [{ path, img }] decoded and ready to hand out
      this.cache = new Map(); // path -> ImageBitmap (LRU)
      this.cacheCap = 30;
      this.prioritizeNew = true;
      this._filling = false;
    }

    setPhotos(list, added) {
      const next = new Map(list.map((p) => [p.path, p]));
      for (const p of [...this.paths.keys()]) {
        if (!next.has(p)) {
          this.paths.delete(p);
          this.cache.delete(p);
        }
      }
      this.queue = this.queue.filter((p) => next.has(p));
      this.ready = this.ready.filter((r) => next.has(r.path));
      const fresh = (added || []).filter((p) => next.has(p) && !this.paths.has(p));
      for (const [p, v] of next) this.paths.set(p, v);
      if (fresh.length) {
        if (this.prioritizeNew) {
          this.queue.unshift(...fresh);
          // Drop already-decoded "next up" photos so the new ones jump the line.
          this.ready = this.ready.slice(0, 1);
        } else {
          this.queue.push(...fresh);
        }
      }
      this.fill();
    }

    count() {
      return this.paths.size;
    }

    _refill() {
      const all = [...this.paths.keys()];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      this.queue = all;
    }

    async _load(p) {
      if (this.cache.has(p)) {
        const img = this.cache.get(p);
        this.cache.delete(p);
        this.cache.set(p, img);
        return img;
      }
      try {
        const buf = await window.pw.invoke('media:read', p);
        const blob = new Blob([buf]);
        let bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        const maxDim = Math.max(2048, Math.ceil(Math.max(cssW, cssH) * dpr));
        if (Math.max(bmp.width, bmp.height) > maxDim) {
          const sc = maxDim / Math.max(bmp.width, bmp.height);
          const small = await createImageBitmap(bmp, {
            resizeWidth: Math.round(bmp.width * sc),
            resizeHeight: Math.round(bmp.height * sc),
            resizeQuality: 'high',
          });
          bmp.close();
          bmp = small;
        }
        this.cache.set(p, bmp);
        if (this.cache.size > this.cacheCap) {
          const oldest = this.cache.keys().next().value;
          this.cache.delete(oldest);
        }
        return bmp;
      } catch {
        // Unreadable / partially-copied file: drop it from rotation for now.
        return null;
      }
    }

    async fill() {
      if (this._filling) return;
      this._filling = true;
      try {
        let guard = 0;
        while (this.ready.length < 4 && this.paths.size > 0 && guard++ < 24) {
          if (!this.queue.length) this._refill();
          const p = this.queue.shift();
          if (!p) break;
          const img = await this._load(p);
          if (img && img.width > 0) this.ready.push({ path: p, img });
        }
      } finally {
        this._filling = false;
      }
    }

    // Returns a decoded image immediately, or null if none is ready yet.
    next() {
      const it = this.ready.shift();
      this.fill();
      return it ? it.img : null;
    }
  }

  const provider = new PhotoProvider();

  // -------------------------------------------------------- audio engine ----

  // Energy-based beat detection: a beat fires when low-frequency energy
  // spikes above its recent average. Sensitivity scales the threshold.
  class AudioEngine {
    constructor(el) {
      this.el = el;
      this.actx = null;
      this.analyser = null;
      this.data = null;
      this.hist = [];
      this.lastBeat = 0;
      this.intervals = [];
      this.bpm = 0;
      this.smLevel = 0;
      this.sens = 0.5; // 0..1
    }

    ensure() {
      if (this.actx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.actx = new AC();
      const src = this.actx.createMediaElementSource(this.el);
      this.analyser = this.actx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.55;
      src.connect(this.analyser);
      this.analyser.connect(this.actx.destination);
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
    }

    resume() {
      if (this.actx && this.actx.state === 'suspended') this.actx.resume();
    }

    setSensitivity(v) {
      this.sens = clamp(v, 0, 1);
    }

    frame(now) {
      const out = {
        level: 0, bass: 0, mid: 0, treble: 0,
        beat: false, beatStrength: 0, bpm: this.bpm,
      };
      if (!this.analyser || this.el.paused) {
        this.hist.length = 0;
        this.smLevel *= 0.95;
        out.level = this.smLevel;
        return out;
      }
      this.analyser.getByteFrequencyData(this.data);
      const n = this.data.length;
      const binHz = (this.actx.sampleRate / 2) / n;
      const band = (lo, hi) => {
        let s = 0;
        let c = 0;
        const i0 = Math.max(1, Math.floor(lo / binHz));
        const i1 = Math.min(n - 1, Math.ceil(hi / binHz));
        for (let i = i0; i <= i1; i++) { s += this.data[i]; c++; }
        return c ? s / c / 255 : 0;
      };
      const bass = band(20, 150);
      const mid = band(150, 2000);
      const treble = band(2000, 9000);
      const level = bass * 0.5 + mid * 0.35 + treble * 0.15;
      this.smLevel += (level - this.smLevel) * 0.12;

      this.hist.push(bass);
      if (this.hist.length > 48) this.hist.shift();
      const avg = this.hist.reduce((a, b) => a + b, 0) / this.hist.length;
      const mult = 1.7 - 0.6 * this.sens; // sensitive=1.1x avg, strict=1.7x avg
      let beat = false;
      let strength = 0;
      if (this.hist.length > 20 && bass > 0.06 && bass > avg * mult && now - this.lastBeat > 270) {
        beat = true;
        strength = clamp((bass / Math.max(avg, 0.001) - 1) / 1.2, 0.15, 1);
        const iv = now - this.lastBeat;
        this.lastBeat = now;
        if (iv < 2000) {
          this.intervals.push(iv);
          if (this.intervals.length > 10) this.intervals.shift();
          const sorted = [...this.intervals].sort((a, b) => a - b);
          const med = sorted[Math.floor(sorted.length / 2)];
          let bpm = 60000 / med;
          while (bpm > 180) bpm /= 2;
          while (bpm > 0 && bpm < 60) bpm *= 2;
          this.bpm = Math.round(bpm);
        }
      }
      out.level = this.smLevel;
      out.bass = bass;
      out.mid = mid;
      out.treble = treble;
      out.beat = beat;
      out.beatStrength = strength;
      out.bpm = this.bpm;
      return out;
    }
  }

  const engine = new AudioEngine(audioEl);

  // ------------------------------------------------------------ playback ----

  async function loadBlobUrl(p) {
    const buf = await window.pw.invoke('media:read', p);
    return URL.createObjectURL(new Blob([buf]));
  }

  async function playTrack(i) {
    const pl = state.playlist;
    if (!pl.length) return;
    currentTrack = ((i % pl.length) + pl.length) % pl.length;
    try {
      const url = await loadBlobUrl(pl[currentTrack].path);
      if (trackUrl) URL.revokeObjectURL(trackUrl);
      trackUrl = url;
      audioEl.src = url;
      engine.ensure();
      engine.resume();
      await audioEl.play();
      playing = true;
    } catch {
      playing = false;
    }
    sendStatus();
  }

  function nextTrack(auto) {
    const pl = state.playlist;
    if (!pl.length) return;
    if (state.settings.shufflePlaylist && pl.length > 1) {
      let r = currentTrack;
      while (r === currentTrack) r = Math.floor(Math.random() * pl.length);
      playTrack(r);
      return;
    }
    const nx = currentTrack + 1;
    if (nx >= pl.length) {
      if (state.settings.loopPlaylist || !auto) {
        playTrack(0);
      } else {
        audioEl.pause();
        playing = false;
        sendStatus();
      }
    } else {
      playTrack(nx);
    }
  }

  audioEl.addEventListener('ended', () => nextTrack(true));

  window.pw.on('transport', async (cmd) => {
    if (!state || !cmd) return;
    switch (cmd.action) {
      case 'play':
        if (Number.isInteger(cmd.index)) {
          await playTrack(cmd.index);
        } else if (audioEl.src && audioEl.paused) {
          engine.ensure();
          engine.resume();
          audioEl.play();
          playing = true;
          sendStatus();
        } else if (!audioEl.src) {
          await playTrack(currentTrack);
        }
        break;
      case 'toggle':
        if (audioEl.src && !audioEl.paused) {
          audioEl.pause();
          playing = false;
          sendStatus();
        } else if (audioEl.src) {
          engine.ensure();
          engine.resume();
          audioEl.play();
          playing = true;
          sendStatus();
        } else {
          await playTrack(currentTrack);
        }
        break;
      case 'pause':
        audioEl.pause();
        playing = false;
        sendStatus();
        break;
      case 'next':
        nextTrack(false);
        break;
      case 'prev':
        if (audioEl.currentTime > 3) audioEl.currentTime = 0;
        else playTrack(currentTrack - 1);
        break;
      case 'seek':
        if (audioEl.duration && typeof cmd.value === 'number') {
          audioEl.currentTime = clamp(cmd.value, 0, 1) * audioEl.duration;
        }
        break;
    }
  });

  function sendStatus() {
    if (!state) return;
    window.pw.send('display:status', {
      playing: playing && !audioEl.paused,
      trackIndex: currentTrack,
      trackName: state.playlist[currentTrack] ? state.playlist[currentTrack].name : null,
      position: audioEl.currentTime || 0,
      duration: Number.isFinite(audioEl.duration) ? audioEl.duration : 0,
    });
  }
  setInterval(sendStatus, 500);

  let beatAccum = false;
  let beatStrengthAccum = 0;
  setInterval(() => {
    window.pw.send('display:meter', {
      level: lastAudioFrame.level,
      bass: lastAudioFrame.bass,
      beat: beatAccum,
      beatStrength: beatStrengthAccum,
      bpm: lastAudioFrame.bpm,
      playing: playing && !audioEl.paused,
    });
    beatAccum = false;
    beatStrengthAccum = 0;
  }, 120);

  // --------------------------------------------------------------- scene ----

  function getSceneSetting(id, key) {
    const def = SCENE_DEFS.find((d) => d.id === id);
    const ds = def && def.settings.find((x) => x.key === key);
    const v = state && state.sceneSettings && state.sceneSettings[id]
      ? state.sceneSettings[id][key]
      : undefined;
    if (v !== undefined && v !== null) return v;
    return ds ? ds.default : 0;
  }

  function getGlobals() {
    const s = state.settings;
    const minMs = Math.max(500, s.minSwitchSec * 1000);
    const maxMs = Math.max(minMs, s.maxSwitchSec * 1000);
    return { minMs, maxMs };
  }

  function setScene(id) {
    if (id === sceneId && scene) return;
    if (scene) {
      try { scene.stop(); } catch { /* scene cleanup is best-effort */ }
    }
    sceneId = id;
    const Cls = PW.scenes.defs[id] || PW.scenes.defs.classic;
    scene = new Cls({
      provider,
      getSetting: (k) => getSceneSetting(sceneId, k),
      globals: getGlobals,
    });
    scene.start();
    scene.resize(cssW, cssH);
  }

  // ----------------------------------------------------------- main loop ----

  function resize() {
    dpr = window.devicePixelRatio || 1;
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    if (scene) scene.resize(cssW, cssH);
  }
  window.addEventListener('resize', resize);

  let lastAudioFrame = { level: 0, bass: 0, mid: 0, treble: 0, beat: false, beatStrength: 0, bpm: 0 };
  let lastT = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const a = engine.frame(now);
    lastAudioFrame = a;
    if (a.beat) {
      beatAccum = true;
      beatStrengthAccum = Math.max(beatStrengthAccum, a.beatStrength);
    }
    if (!state || !scene) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (a.beat && scene.onBeat) scene.onBeat(a.beatStrength, a);
    scene.update(dt, a, now);
    scene.draw(ctx, cssW, cssH);
  }

  function updateEmptyState() {
    const hasPhotos = provider.count() > 0;
    emptyEl.classList.toggle('hidden', hasPhotos);
  }

  // --------------------------------------------------------- state wires ----

  function applyState(s) {
    const prevScene = sceneId;
    state = s;
    engine.setSensitivity((s.settings.beatSensitivity || 50) / 100);
    audioEl.volume = clamp((s.settings.volume == null ? 80 : s.settings.volume) / 100, 0, 1);
    provider.prioritizeNew = !!s.settings.prioritizeNew;
    if (s.sceneId !== prevScene || !scene) setScene(s.sceneId);
  }

  window.pw.on('state:update', (s) => {
    applyState(s);
    updateEmptyState();
  });

  window.pw.on('photos:update', ({ photos, added }) => {
    provider.setPhotos(photos, added);
    updateEmptyState();
  });

  // ------------------------------------------------------------ controls ----

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
      e.preventDefault();
      window.pw.send('display:toggle-fullscreen');
    } else if (e.key === 'Escape') {
      window.pw.send('display:exit-fullscreen');
    } else if (e.key === ' ') {
      e.preventDefault();
      window.pw.send('control:transport', { action: 'toggle' });
    }
  });
  window.addEventListener('dblclick', () => window.pw.send('display:toggle-fullscreen'));

  // Hide the cursor and the hint after a few idle seconds.
  let cursorTimer = null;
  function pokeCursor() {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 2500);
  }
  window.addEventListener('mousemove', pokeCursor);
  pokeCursor();
  setTimeout(() => hintEl.classList.add('faded'), 6000);

  // ---------------------------------------------------------------- boot ----

  (async function init() {
    resize();
    const { state: s, photos } = await window.pw.invoke('app:get-state');
    applyState(s);
    provider.setPhotos(photos, []);
    updateEmptyState();
    window.pw.send('display:ready');
    requestAnimationFrame(frame);
  })();
})();
