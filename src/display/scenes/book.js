// Photo Book: a big album lies open on the table; on the beat a page
// turns — the flipping page carries the old right photo on its front and
// the next photo on its back, revealing another underneath, just like a
// real book.
(() => {
  'use strict';
  const { util } = window.PW;

  class BookScene extends window.PW.Scene {
    start() {
      this.left = null;
      this.right = null;
      this.turn = null; // { t, dur, front, back, under }
      this.timer = new window.PW.SwitchTimer(this.env.globals);
      this.pulse = 0;
      this.dust = [];
    }

    resize(w, h) {
      super.resize(w, h);
      this.dust = Array.from({ length: 26 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: util.rand(0.6, 2),
        sp: util.rand(3, 9),
        a: util.rand(0.05, 0.18),
        ph: Math.random() * Math.PI * 2,
      }));
    }

    onBeat(strength) {
      this.pulse = Math.min(1, this.pulse + strength * 0.7);
    }

    _startTurn() {
      const back = this.env.provider.next();
      if (!back) return;
      const under = this.env.provider.next() || back;
      const speed = this.s('turnSpeed') / 100;
      this.turn = {
        t: 0,
        dur: util.lerp(1.2, 0.35, speed),
        front: this.right,
        back,
        under,
      };
    }

    update(dt, audio, now) {
      if (!this.left) this.left = this.env.provider.next();
      if (!this.right) {
        this.right = this.env.provider.next();
        if (this.right) this.timer.reset(now);
      }
      if (!this.turn && this.right && this.timer.tick(now, audio)) this._startTurn();
      if (this.turn) {
        this.turn.t += dt / this.turn.dur;
        if (this.turn.t >= 1) {
          this.left = this.turn.back;
          this.right = this.turn.under;
          this.turn = null;
        }
      }
      for (const d of this.dust) {
        d.y -= d.sp * dt;
        d.ph += dt * 0.6;
        d.x += Math.sin(d.ph) * 5 * dt;
        if (d.y < -4) {
          d.y = this.H + 4;
          d.x = Math.random() * this.W;
        }
      }
      this.pulse *= Math.exp(-dt * 4.5);
    }

    // One paper page with its photo, drawn in page-local coordinates
    // (origin at the spine-top corner, page extends +x).
    _drawPage(ctx, img, pw, ph, shade) {
      const paper = ctx.createLinearGradient(0, 0, pw, 0);
      paper.addColorStop(0, '#e7dfcd');
      paper.addColorStop(0.12, '#f6f0e1');
      paper.addColorStop(1, '#f1e9d8');
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, pw, ph);
      if (img) {
        const m = pw * 0.09;
        const aw = pw - m * 2;
        const ah = ph - m * 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(m, m, aw, ah);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillRect(m, m, aw, ah);
        if (this.env.fit()) util.contain(ctx, img, m + 3, m + 3, aw - 6, ah - 6);
        else util.cover(ctx, img, m + 3, m + 3, aw - 6, ah - 6);
        ctx.restore();
        ctx.strokeStyle = 'rgba(90,70,40,0.25)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(m, m, aw, ah);
      }
      if (shade > 0.01) {
        ctx.fillStyle = `rgba(40,25,10,${Math.min(0.6, shade).toFixed(3)})`;
        ctx.fillRect(0, 0, pw, ph);
      }
    }

    draw(ctx) {
      const { W, H } = this;

      // Warm tabletop.
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#171009');
      bg.addColorStop(0.5, '#2b1d12');
      bg.addColorStop(1, '#1b1209');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const lamp = ctx.createRadialGradient(W / 2, H * 0.28, 0, W / 2, H * 0.42, Math.max(W, H) * 0.65);
      lamp.addColorStop(0, `rgba(255,214,150,${(0.14 + this.pulse * 0.08).toFixed(3)})`);
      lamp.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#ffe9c4';
      for (const d of this.dust) {
        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Book geometry.
      let ph = H * (this.s('size') / 100) * 0.92;
      let pw = ph * 0.74;
      if (pw * 2 > W * 0.88) {
        pw = (W * 0.88) / 2;
        ph = pw / 0.74;
      }
      const scale = 1 + this.pulse * 0.012;
      const cx = W / 2;
      const cy = H * 0.52;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Shadow on the table.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, ph * 0.55, pw * 1.18, ph * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cover and page-stack edges.
      const pad = ph * 0.04;
      ctx.fillStyle = '#332016';
      util.roundRect(ctx, -pw - pad, -ph / 2 - pad, (pw + pad) * 2, ph + pad * 2, pad * 1.4);
      ctx.fill();
      ctx.fillStyle = '#d9d0bc';
      for (let i = 3; i >= 1; i--) {
        const o = pad * 0.22 * i;
        ctx.fillRect(-pw - o, -ph / 2 - o + ph * 0.01, pw * 2 + o * 2, ph);
      }

      // Static pages: left photo, and (during a turn) the photo revealed
      // underneath on the right; otherwise the current right photo.
      ctx.save();
      ctx.translate(-pw, -ph / 2);
      ctx.save();
      ctx.translate(pw, 0);
      ctx.scale(-1, 1); // left page mirrors the paper gradient toward the spine
      this._drawPage(ctx, null, pw, ph, 0);
      ctx.restore();
      if (this.left) {
        const m = pw * 0.09;
        ctx.save();
        ctx.beginPath();
        ctx.rect(m, m, pw - m * 2, ph - m * 2);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillRect(m, m, pw - m * 2, ph - m * 2);
        if (this.env.fit()) util.contain(ctx, this.left, m + 3, m + 3, pw - m * 2 - 6, ph - m * 2 - 6);
        else util.cover(ctx, this.left, m + 3, m + 3, pw - m * 2 - 6, ph - m * 2 - 6);
        ctx.restore();
        ctx.strokeStyle = 'rgba(90,70,40,0.25)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(m, m, pw - m * 2, ph - m * 2);
      }
      ctx.restore();

      ctx.save();
      ctx.translate(0, -ph / 2);
      this._drawPage(ctx, this.turn ? this.turn.under : this.right, pw, ph, 0);
      ctx.restore();

      // The flipping page.
      if (this.turn) {
        const t = util.easeInOut(Math.min(1, this.turn.t));
        const cosA = Math.cos(Math.PI * t);
        // Shadow the turning page casts on whichever side it hovers over.
        const shW = pw * Math.abs(cosA);
        ctx.fillStyle = `rgba(20,12,5,${(0.28 * Math.sin(Math.PI * t)).toFixed(3)})`;
        if (cosA > 0) ctx.fillRect(0, -ph / 2, shW * 1.15, ph);
        else ctx.fillRect(-shW * 1.15, -ph / 2, shW * 1.15, ph);
        const fold = 1 - Math.abs(cosA); // darkest mid-turn
        if (cosA > 0.002) {
          ctx.save();
          ctx.scale(cosA, 1);
          ctx.translate(0, -ph / 2);
          this._drawPage(ctx, this.turn.front, pw, ph, fold * 0.45);
          ctx.restore();
        } else if (cosA < -0.002) {
          // Back face, sweeping onto the left side (viewed from behind, so
          // it is not mirrored).
          ctx.save();
          ctx.scale(-cosA, 1);
          ctx.translate(-pw, -ph / 2);
          this._drawPage(ctx, this.turn.back, pw, ph, fold * 0.45);
          ctx.restore();
        }
      }

      // Spine shadow.
      const spine = ctx.createLinearGradient(-pw * 0.12, 0, pw * 0.12, 0);
      spine.addColorStop(0, 'rgba(40,25,10,0)');
      spine.addColorStop(0.5, 'rgba(40,25,10,0.4)');
      spine.addColorStop(1, 'rgba(40,25,10,0)');
      ctx.fillStyle = spine;
      ctx.fillRect(-pw * 0.12, -ph / 2, pw * 0.24, ph);

      ctx.restore();
    }
  }

  window.PW.scenes.register('book', BookScene);
})();
