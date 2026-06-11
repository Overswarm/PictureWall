// Polaroid Pile: snapshots tumble down onto the table at the configured drop
// rate (plus extra drops on the beat) and stack up, covering older ones.
(() => {
  'use strict';
  const { util } = window.PW;

  class PolaroidScene extends window.PW.Scene {
    start() {
      this.items = [];
      this.nextDrop = performance.now() + 700;
      this.dust = [];
      this.pulse = 0;
    }

    resize(w, h) {
      super.resize(w, h);
      this.dust = Array.from({ length: 36 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.5,
        sp: Math.random() * 7 + 3,
        a: Math.random() * 0.3 + 0.08,
      }));
    }

    _spawn(now) {
      const img = this.env.provider.next();
      if (!img) return;
      const { W, H } = this;
      const w = (this.s('size') / 100) * Math.min(W, H) * 1.5;
      const tx = util.rand(W * 0.1, W * 0.9);
      const ty = util.rand(H * 0.2, H * 0.85);
      this.items.push({
        img,
        x: tx + util.rand(-W * 0.06, W * 0.06),
        y: -w,
        tx,
        ty,
        rot: util.rand(-0.5, 0.5),
        rotV: util.rand(-0.8, 0.8),
        w,
        vy: 0,
        landed: false,
        alpha: 1,
        dying: false,
        born: now,
      });
      const cap = this.s('pileSize');
      const alive = this.items.filter((i) => !i.dying);
      if (alive.length > cap) alive[0].dying = true;
    }

    onBeat(strength) {
      this.pulse = Math.min(1, this.pulse + strength * 0.8);
      if (Math.random() * 100 < this.s('beatDrop')) this._spawn(performance.now());
    }

    update(dt, audio, now) {
      const interval = 60000 / Math.max(1, this.s('dropRate'));
      if (now >= this.nextDrop) {
        this._spawn(now);
        this.nextDrop = now + interval * util.rand(0.7, 1.3);
      }
      this.pulse *= Math.exp(-dt * 5);
      for (const it of this.items) {
        if (!it.landed) {
          it.vy += this.H * 2.4 * dt;
          it.y += it.vy * dt;
          it.x += (it.tx - it.x) * Math.min(1, dt * 3);
          it.rot += it.rotV * dt;
          if (it.y >= it.ty) {
            it.y = it.ty;
            it.landed = true;
            it.vy = 0;
          }
        }
        if (it.dying) it.alpha -= dt * 1.4;
      }
      this.items = this.items.filter((i) => i.alpha > 0);
      for (const d of this.dust) {
        d.y -= d.sp * dt;
        if (d.y < -4) {
          d.y = this.H + 4;
          d.x = Math.random() * this.W;
        }
      }
    }

    _drawPolaroid(ctx, it) {
      const m = it.w * 0.06; // frame margin
      const pw = it.w - m * 2;
      // Polaroids are square by default; in whole-photo mode the window
      // follows the photo's shape (within reason, to stay polaroid-like).
      const ar = this.env.fit() ? util.clamp(it.img.width / it.img.height, 0.55, 1.8) : 1;
      const ph = pw / ar;
      const fh = m + ph + it.w * 0.2; // taller bottom strip
      ctx.save();
      ctx.globalAlpha = it.alpha;
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 7;
      ctx.fillStyle = '#faf7f0';
      ctx.fillRect(-it.w / 2, -fh / 2, it.w, fh);
      ctx.shadowColor = 'transparent';
      util.cover(ctx, it.img, -it.w / 2 + m, -fh / 2 + m, pw, ph);
      ctx.restore();
    }

    draw(ctx) {
      const { W, H } = this;
      const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.55, Math.max(W, H) * 0.8);
      g.addColorStop(0, '#2b2320');
      g.addColorStop(1, '#120e0c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#fff';
      for (const d of this.dust) {
        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // The whole pile breathes a little on the beat.
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(1 + this.pulse * 0.014, 1 + this.pulse * 0.014);
      ctx.translate(-W / 2, -H / 2);
      for (const it of this.items) this._drawPolaroid(ctx, it);
      ctx.restore();
    }
  }

  window.PW.scenes.register('polaroids', PolaroidScene);
})();
