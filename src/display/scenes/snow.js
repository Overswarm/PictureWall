// Snowfall: photos drift gently down through falling snow on a quiet
// winter night — the calm counterpart to Floating Lights.
(() => {
  'use strict';
  const { util } = window.PW;

  class SnowScene extends window.PW.Scene {
    start() {
      this.items = [];
      this.flakes = [];
      this.pulse = 0;
      this.spawnCooldown = 0;
    }

    resize(w, h) {
      super.resize(w, h);
      this.flakes = Array.from({ length: 140 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: util.rand(0.8, 3.4),
        sp: util.rand(12, 55),
        sway: util.rand(0.4, 1.4),
        ph: Math.random() * Math.PI * 2,
        a: util.rand(0.25, 0.85),
      }));
    }

    _make(img, fromTop) {
      const { W, H } = this;
      return {
        img,
        baseX: util.rand(W * 0.08, W * 0.92),
        x: 0,
        y: fromTop ? -H * util.rand(0.15, 0.45) : util.rand(H * 0.05, H * 0.85),
        hgt: util.rand(0.16, 0.3) * Math.min(W, H) * 1.2,
        speedMul: util.rand(0.75, 1.3),
        phase: Math.random() * Math.PI * 2,
        swaySp: util.rand(0.25, 0.7),
        rot: 0,
        dying: false,
        alpha: 1,
      };
    }

    onBeat(strength) {
      this.pulse = Math.min(1, this.pulse + strength * 0.8);
    }

    update(dt, audio) {
      const want = this.s('count');
      this.spawnCooldown -= dt;
      const alive = this.items.filter((i) => !i.dying);
      if (alive.length < want && this.spawnCooldown <= 0) {
        const img = this.env.provider.next();
        if (img) {
          // Seed the first few across the screen, later ones fall from above.
          this.items.push(this._make(img, this.items.length >= 3));
          this.spawnCooldown = 0.5;
        }
      } else if (alive.length > want) {
        alive[0].dying = true;
      }

      const sp = this.s('speed') / 100;
      for (const it of this.items) {
        it.y += this.H * (0.012 + sp * 0.055) * dt * it.speedMul * (1 + audio.level * 0.5);
        it.phase += dt * it.swaySp;
        it.x = it.baseX + Math.sin(it.phase) * this.W * 0.025;
        it.rot = Math.sin(it.phase * 0.8) * 0.09;
        if (it.dying) it.alpha -= dt;
        if (it.y > this.H * 1.25) {
          const img = this.env.provider.next();
          if (img) Object.assign(it, this._make(img, true));
          else it.y = -this.H * 0.3;
        }
      }
      this.items = this.items.filter((i) => i.alpha > 0);

      for (const fl of this.flakes) {
        fl.y += fl.sp * dt * (1 + audio.level * 0.4);
        fl.ph += dt * fl.sway;
        fl.x += Math.sin(fl.ph) * 12 * dt;
        if (fl.y > this.H + 4) {
          fl.y = -4;
          fl.x = Math.random() * this.W;
        }
      }
      this.pulse *= Math.exp(-dt * 4);
    }

    _drawFlakes(ctx, parity, amount) {
      ctx.fillStyle = '#eaf2ff';
      for (let i = parity; i < this.flakes.length; i += 2) {
        const fl = this.flakes[i];
        const a = fl.a * amount;
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    draw(ctx) {
      const { W, H } = this;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1226');
      g.addColorStop(0.65, '#13203c');
      g.addColorStop(1, '#1d2c4d');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Soft moonlight.
      const mg = ctx.createRadialGradient(W * 0.78, H * 0.16, 0, W * 0.78, H * 0.16, Math.min(W, H) * 0.4);
      mg.addColorStop(0, 'rgba(220,235,255,0.18)');
      mg.addColorStop(1, 'rgba(220,235,255,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);

      const amount = this.s('snow') / 100;
      this._drawFlakes(ctx, 0, amount); // half the snow behind the photos

      const sorted = [...this.items].sort((a, b) => a.hgt - b.hgt);
      for (const it of sorted) {
        const img = it.img;
        const h = it.hgt * (1 + this.pulse * 0.04);
        const ar = util.cardAspect(img, this.env.fit(), 0.6, 1.8);
        const w = h * ar;
        ctx.save();
        ctx.globalAlpha = it.alpha;
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        ctx.shadowColor = `rgba(200,225,255,${(0.45 + this.pulse * 0.4).toFixed(3)})`;
        ctx.shadowBlur = 16 + this.pulse * 22;
        ctx.fillStyle = 'rgba(250,252,255,0.97)';
        util.roundRect(ctx, -w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 9);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.save();
        util.roundRect(ctx, -w / 2, -h / 2, w, h, 6);
        ctx.clip();
        util.cover(ctx, img, -w / 2, -h / 2, w, h);
        ctx.restore();
        ctx.restore();
      }

      this._drawFlakes(ctx, 1, amount); // and half in front
    }
  }

  window.PW.scenes.register('snow', SnowScene);
})();
