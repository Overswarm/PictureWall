// Shared scene plumbing: registry, drawing helpers, and the timer that
// decides when a photo should switch (on a beat once the minimum time has
// passed, or unconditionally once the maximum time is up).
(() => {
  'use strict';

  const PW = (window.PW = window.PW || {});
  const bgCache = new WeakMap();

  PW.scenes = {
    defs: {},
    register(id, cls) {
      this.defs[id] = cls;
    },
  };

  PW.util = {
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    lerp(a, b, t) { return a + (b - a) * t; },
    rand(a, b) { return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    easeOut(t) { return 1 - Math.pow(1 - t, 3); },
    easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },

    // Draw an image so it completely covers the given rect (center-cropped).
    cover(ctx, img, x, y, w, h) {
      const iw = img.width;
      const ih = img.height;
      if (!iw || !ih) return;
      const s = Math.max(w / iw, h / ih);
      const dw = iw * s;
      const dh = ih * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
    },

    // Draw an image fully inside the rect (letterboxed, never cropped).
    contain(ctx, img, x, y, w, h) {
      const iw = img.width;
      const ih = img.height;
      if (!iw || !ih) return;
      const s = Math.min(w / iw, h / ih);
      const dw = iw * s;
      const dh = ih * s;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    },

    // Whole-photo mode: blurred, darkened version of the image fills the
    // rect, with the complete photo letterboxed on top. The blur comes free
    // from stretching a tiny downscaled copy (cached per image).
    blurBg(ctx, img, x, y, w, h, dark = 0.5) {
      let bg = bgCache.get(img);
      if (!bg) {
        bg = document.createElement('canvas');
        // Two-step downscale for a smooth, blocky-free blur when upscaled.
        const mid = document.createElement('canvas');
        mid.width = 64;
        mid.height = Math.max(1, Math.round((64 * img.height) / img.width));
        mid.getContext('2d').drawImage(img, 0, 0, mid.width, mid.height);
        bg.width = 16;
        bg.height = Math.max(1, Math.round((16 * img.height) / img.width));
        bg.getContext('2d').drawImage(mid, 0, 0, bg.width, bg.height);
        bgCache.set(img, bg);
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const s = Math.max(w / bg.width, h / bg.height) * 1.1;
      ctx.drawImage(bg, x + (w - bg.width * s) / 2, y + (h - bg.height * s) / 2, bg.width * s, bg.height * s);
      ctx.fillStyle = `rgba(0,0,0,${dark})`;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    },

    fitDraw(ctx, img, x, y, w, h, dark = 0.5) {
      this.blurBg(ctx, img, x, y, w, h, dark);
      this.contain(ctx, img, x, y, w, h);
    },

    // Pick a card aspect ratio for an image: tight clamp when cropping is
    // fine, generous clamp in whole-photo mode so nothing gets cut off.
    cardAspect(img, fit, lo, hi) {
      const ar = img.width / img.height || 1;
      return fit ? this.clamp(ar, 0.4, 2.6) : this.clamp(ar, lo, hi);
    },

    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    },
  };

  class SwitchTimer {
    constructor(globals) {
      this.globals = globals;
      this.last = performance.now();
    }

    reset(now) {
      this.last = now;
    }

    tick(now, audio) {
      const { minMs, maxMs } = this.globals();
      const elapsed = now - this.last;
      if (elapsed >= maxMs) {
        this.last = now;
        return true;
      }
      if (elapsed >= minMs && audio.beat) {
        this.last = now;
        return true;
      }
      return false;
    }
  }

  class Scene {
    constructor(env) {
      this.env = env;
      this.W = 0;
      this.H = 0;
    }

    s(key) { return this.env.getSetting(key); }
    start() {}
    stop() {}
    resize(w, h) { this.W = w; this.H = h; }
    onBeat(_strength, _audio) {}
    update(_dt, _audio, _now) {}
    draw(_ctx, _W, _H) {}
  }

  PW.Scene = Scene;
  PW.SwitchTimer = SwitchTimer;
})();
