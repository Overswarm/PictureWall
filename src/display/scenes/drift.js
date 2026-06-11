// Floating Lights: photos drift upward like lanterns over a bokeh night sky,
// swaying gently and glowing brighter with the bass.
(() => {
  'use strict';
  const { util } = window.PW;

  class DriftScene extends window.PW.Scene {
    start() {
      this.items = [];
      this.bokeh = [];
      this.pulse = 0;
      this.spawnCooldown = 0;
    }

    resize(w, h) {
      super.resize(w, h);
      this.bokeh = Array.from({ length: 60 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: util.rand(2, 14),
        sp: util.rand(4, 16),
        hue: util.pick([200, 260, 320, 40]),
        a: util.rand(0.04, 0.16),
        tw: Math.random() * Math.PI * 2,
      }));
    }

    _make(img, fromBottom) {
      const { W, H } = this;
      const hgt = util.rand(0.18, 0.32) * Math.min(W, H) * 1.2;
      return {
        img,
        baseX: util.rand(W * 0.1, W * 0.9),
        x: 0,
        y: fromBottom ? H * (1.15 + Math.random() * 0.3) : util.rand(H * 0.1, H * 0.9),
        hgt,
        speedMul: util.rand(0.8, 1.35),
        phase: Math.random() * Math.PI * 2,
        swaySp: util.rand(0.3, 0.8),
        rot: 0,
        hue: util.pick([35, 200, 320, 260, 150]),
        dying: false,
        alpha: 1,
      };
    }

    onBeat(strength) {
      this.pulse = Math.min(1, this.pulse + strength * 0.8);
    }

    update(dt, audio, now) {
      const want = this.s('count');
      this.spawnCooldown -= dt;
      const alive = this.items.filter((i) => !i.dying);
      if (alive.length < want && this.spawnCooldown <= 0) {
        const img = this.env.provider.next();
        if (img) {
          // Seed the first few across the screen, later ones rise from below.
          this.items.push(this._make(img, this.items.length >= 3));
          this.spawnCooldown = 0.5;
        }
      } else if (alive.length > want) {
        alive[0].dying = true;
      }

      const sp = this.s('speed') / 100;
      for (const it of this.items) {
        it.y -= this.H * (0.015 + sp * 0.06) * dt * it.speedMul * (1 + audio.level * 0.6);
        it.phase += dt * it.swaySp;
        it.x = it.baseX + Math.sin(it.phase) * this.W * 0.02;
        it.rot = Math.sin(it.phase * 0.7) * 0.07;
        if (it.dying) it.alpha -= dt;
        if (it.y < -this.H * 0.25) {
          const img = this.env.provider.next();
          if (img) {
            Object.assign(it, this._make(img, true));
          } else {
            it.y = this.H * 1.3;
          }
        }
      }
      this.items = this.items.filter((i) => i.alpha > 0);

      for (const b of this.bokeh) {
        b.y -= b.sp * dt;
        if (b.y < -20) {
          b.y = this.H + 20;
          b.x = Math.random() * this.W;
        }
      }
      this.pulse *= Math.exp(-dt * 4);
    }

    draw(ctx, _W, _H) {
      const { W, H } = this;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#06081a');
      g.addColorStop(0.6, '#0d0f2b');
      g.addColorStop(1, '#1a1038');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Bokeh.
      const sparkle = this.s('sparkle') / 100;
      const t = performance.now() / 1000;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.bokeh) {
        const a = b.a * sparkle * (0.6 + 0.4 * Math.sin(t + b.tw)) * (1 + this.pulse * 0.8);
        if (a <= 0.005) continue;
        ctx.fillStyle = `hsla(${b.hue}, 80%, 65%, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (1 + this.pulse * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Photos, smallest (farthest) first.
      const sorted = [...this.items].sort((a, b) => a.hgt - b.hgt);
      for (const it of sorted) {
        const img = it.img;
        const scl = 1 + this.pulse * 0.05;
        const h = it.hgt * scl;
        const ar = util.clamp(img.width / img.height, 0.6, 1.8);
        const w = h * ar;
        ctx.save();
        ctx.globalAlpha = it.alpha;
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        ctx.shadowColor = `hsla(${it.hue}, 85%, 65%, ${(0.5 + this.pulse * 0.4).toFixed(3)})`;
        ctx.shadowBlur = 18 + this.pulse * 26;
        ctx.fillStyle = 'rgba(250,248,242,0.95)';
        util.roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 10);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.save();
        util.roundRect(ctx, -w / 2, -h / 2, w, h, 7);
        ctx.clip();
        util.cover(ctx, img, -w / 2, -h / 2, w, h);
        ctx.restore();
        ctx.restore();
      }
    }
  }

  window.PW.scenes.register('drift', DriftScene);
})();
