// Warp Speed: photos race toward the viewer out of a streaking starfield,
// growing as they approach and sweeping past the edges of the screen.
(() => {
  'use strict';
  const { util } = window.PW;

  class WarpScene extends window.PW.Scene {
    start() {
      this.items = [];
      this.stars = [];
      this.pulse = 0;
      this.spawnCooldown = 0;
    }

    resize(w, h) {
      super.resize(w, h);
      this.stars = Array.from({ length: 170 }, () => ({
        angle: Math.random() * Math.PI * 2,
        dist: Math.random(),
        sp: util.rand(0.25, 0.7),
        hue: util.pick([210, 230, 260, 200]),
      }));
    }

    _make(img) {
      return {
        img,
        angle: util.rand(0, Math.PI * 2),
        p: 0,
        speedMul: util.rand(0.8, 1.3),
        rot: util.rand(-0.14, 0.14),
      };
    }

    onBeat(strength) {
      this.pulse = Math.min(1, this.pulse + strength * 0.9);
    }

    update(dt, audio) {
      const want = this.s('count');
      this.spawnCooldown -= dt;
      if (this.items.length < want && this.spawnCooldown <= 0) {
        const img = this.env.provider.next();
        if (img) {
          this.items.push(this._make(img));
          this.spawnCooldown = 0.35;
        }
      }
      while (this.items.length > want) this.items.pop();

      const sp = this.s('speed') / 100;
      const v = (0.1 + sp * 0.2) * (1 + audio.level * 0.7 + this.pulse * 0.5);
      for (const it of this.items) {
        it.p += dt * v * it.speedMul;
        if (it.p >= 1) {
          const img = this.env.provider.next();
          if (img) Object.assign(it, this._make(img));
          else it.p = 0;
        }
      }
      for (const st of this.stars) {
        st.dist += dt * st.sp * (0.4 + sp) * (1 + audio.level + this.pulse * 1.5);
        if (st.dist > 1) {
          st.dist = util.rand(0.02, 0.1);
          st.angle = Math.random() * Math.PI * 2;
        }
      }
      this.pulse *= Math.exp(-dt * 4);
    }

    draw(ctx) {
      const { W, H } = this;
      ctx.fillStyle = '#02030a';
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
      neb.addColorStop(0, `rgba(70,60,160,${(0.16 + this.pulse * 0.1).toFixed(3)})`);
      neb.addColorStop(1, 'rgba(70,60,160,0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      // Star streaks shooting outward from the centre.
      const maxR = Math.hypot(W, H) / 2;
      const streakAmt = this.s('streaks') / 100;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const st of this.stars) {
        const d2 = st.dist * st.dist;
        const len = (0.015 + 0.08 * st.dist) * (1 + this.pulse * 1.6);
        const x1 = cx + Math.cos(st.angle) * d2 * maxR;
        const y1 = cy + Math.sin(st.angle) * d2 * maxR;
        const x2 = cx + Math.cos(st.angle) * (d2 + len * st.dist) * maxR;
        const y2 = cy + Math.sin(st.angle) * (d2 + len * st.dist) * maxR;
        const a = streakAmt * util.clamp(st.dist * 1.4, 0.05, 0.8);
        if (a <= 0.01) continue;
        ctx.strokeStyle = `hsla(${st.hue}, 80%, 75%, ${a.toFixed(3)})`;
        ctx.lineWidth = 0.8 + st.dist * 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // Photos, farthest (smallest) first.
      const sorted = [...this.items].sort((a, b) => a.p - b.p);
      for (const it of sorted) {
        const r = it.p * it.p; // ease in: slow far away, fast up close
        const x = cx + Math.cos(it.angle) * r * maxR * 0.92;
        const y = cy + Math.sin(it.angle) * r * maxR * 0.92;
        const h = (0.04 + r * 1.15) * H * 0.55;
        const ar = util.cardAspect(it.img, this.env.fit(), 0.6, 1.8);
        const w = h * ar;
        let alpha = 1;
        if (it.p < 0.12) alpha = it.p / 0.12;
        else if (it.p > 0.88) alpha = (1 - it.p) / 0.12;
        ctx.save();
        ctx.globalAlpha = util.clamp(alpha, 0, 1);
        ctx.translate(x, y);
        ctx.rotate(it.rot * r);
        ctx.shadowColor = `rgba(140,170,255,${(0.5 + this.pulse * 0.4).toFixed(3)})`;
        ctx.shadowBlur = 14 + r * 26 + this.pulse * 20;
        ctx.fillStyle = 'rgba(245,248,255,0.96)';
        util.roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 8);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.save();
        util.roundRect(ctx, -w / 2, -h / 2, w, h, 6);
        ctx.clip();
        util.cover(ctx, it.img, -w / 2, -h / 2, w, h);
        ctx.restore();
        ctx.restore();
      }
    }
  }

  window.PW.scenes.register('warp', WarpScene);
})();
