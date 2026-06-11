// Shared scene plumbing: registry, drawing helpers, and the timer that
// decides when a photo should switch (on a beat once the minimum time has
// passed, or unconditionally once the maximum time is up).
(() => {
  'use strict';

  const PW = (window.PW = window.PW || {});

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
