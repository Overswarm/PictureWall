// Classic Slideshow: fullscreen photos, crossfades, slow Ken Burns drift,
// gentle zoom pulse on the beat and an optional soft flash on big hits.
(() => {
  'use strict';
  const { util } = window.PW;

  class ClassicScene extends window.PW.Scene {
    start() {
      this.cur = null;
      this.nxt = null;
      this.t = 1;
      this.timer = new window.PW.SwitchTimer(this.env.globals);
      this.pulse = 0;
      this.flashA = 0;
      this.kb = this._newKb();
      this.kbNext = null;
    }

    _newKb() {
      const a = Math.random() * Math.PI * 2;
      return {
        dx: Math.cos(a),
        dy: Math.sin(a),
        zoomIn: Math.random() < 0.5,
        t: 0,
      };
    }

    onBeat(strength) {
      this.pulse = Math.min(1, this.pulse + strength * 0.9);
      if (strength > 0.55 && this.s('flash')) {
        this.flashA = Math.max(this.flashA, 0.12 + 0.22 * strength);
      }
    }

    update(dt, audio, now) {
      if (!this.cur) {
        const img = this.env.provider.next();
        if (img) {
          this.cur = img;
          this.timer.reset(now);
        }
      } else if (!this.nxt && this.timer.tick(now, audio)) {
        const img = this.env.provider.next();
        if (img) {
          this.nxt = img;
          this.t = 0;
          this.kbNext = this._newKb();
        }
      }
      if (this.nxt) {
        this.t += dt / 0.9;
        if (this.t >= 1) {
          this.cur = this.nxt;
          this.nxt = null;
          this.kb = this.kbNext;
        }
      }
      this.kb.t += dt;
      if (this.kbNext) this.kbNext.t += dt;
      this.pulse *= Math.exp(-dt * 6);
      this.flashA *= Math.exp(-dt * 5);
    }

    _drawPhoto(ctx, img, kb, alpha) {
      const { W, H } = this;
      const drift = this.s('drift') / 100;
      const p = Math.min(1, kb.t / 30);
      const zoomMax = 1.04 + drift * 0.10;
      const zoom = kb.zoomIn
        ? 1 + (zoomMax - 1) * p
        : zoomMax - (zoomMax - 1) * p;
      const pulseAmt = this.s('pulse') / 100;
      const z = zoom * (1 + this.pulse * 0.045 * pulseAmt);
      const ox = kb.dx * drift * W * 0.03 * p;
      const oy = kb.dy * drift * H * 0.03 * p;
      const s = Math.max(W / img.width, H / img.height) * z;
      const dw = img.width * s;
      const dh = img.height * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh);
      ctx.globalAlpha = 1;
    }

    draw(ctx) {
      const { W, H } = this;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      if (this.cur) this._drawPhoto(ctx, this.cur, this.kb, 1);
      if (this.nxt) {
        this._drawPhoto(ctx, this.nxt, this.kbNext, util.easeInOut(Math.min(1, this.t)));
      }
      if (this.flashA > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${this.flashA.toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  window.PW.scenes.register('classic', ClassicScene);
})();
