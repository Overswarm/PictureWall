// Carousel: photos orbit the screen in a pseudo-3D ring. Cards swap to a new
// photo while they're hidden at the back, and the front card bounces on beats.
(() => {
  'use strict';
  const { util } = window.PW;

  const TWO_PI = Math.PI * 2;

  class CarouselScene extends window.PW.Scene {
    start() {
      this.slots = [];
      this.angle = 0;
      this.bounce = 0;
      this.glow = 0;
      this._initSlots();
    }

    _initSlots() {
      const n = this.s('count');
      this.slots = Array.from({ length: n }, (_, i) => ({
        img: null,
        a0: (i * TWO_PI) / n,
        swapReady: true,
      }));
    }

    onBeat(strength) {
      const amt = this.s('bounce') / 100;
      this.bounce = Math.min(1, this.bounce + strength * amt);
      this.glow = Math.min(1, this.glow + strength * 0.7);
    }

    update(dt, audio) {
      if (this.slots.length !== this.s('count')) this._initSlots();
      const speed = this.s('speed') / 100;
      this.angle += dt * (0.12 + speed * 0.55) * (1 + audio.level * 0.9);
      this.bounce *= Math.exp(-dt * 4);
      this.glow *= Math.exp(-dt * 3);

      for (const slot of this.slots) {
        if (!slot.img) slot.img = this.env.provider.next();
        const a = (((slot.a0 + this.angle) % TWO_PI) + TWO_PI) % TWO_PI;
        const distFromBack = Math.abs(a - Math.PI);
        if (distFromBack < 0.18) {
          if (slot.swapReady) {
            const img = this.env.provider.next();
            if (img) slot.img = img;
            slot.swapReady = false;
          }
        } else {
          slot.swapReady = true;
        }
      }
    }

    draw(ctx, _W, _H, audio) {
      const { W, H } = this;
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.5, Math.max(W, H) * 0.75);
      g.addColorStop(0, '#1b1430');
      g.addColorStop(1, '#07060e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Soft glowing rings behind the carousel that swell on the beat.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const r = Math.min(W, H) * (0.22 + i * 0.12) * (1 + this.glow * 0.06);
        ctx.strokeStyle = `hsla(${260 + i * 25}, 70%, 60%, ${(0.05 + this.glow * 0.08).toFixed(3)})`;
        ctx.lineWidth = 2 + this.glow * 3;
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.5, r * 1.5, r * 0.5, 0, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.restore();

      const cx = W / 2;
      const cy = H * 0.46;
      const rx = W * 0.37;

      const placed = this.slots
        .filter((s) => s.img)
        .map((s) => {
          const a = s.a0 + this.angle;
          return { s, x: cx + Math.sin(a) * rx, depth: Math.cos(a) };
        })
        .sort((p, q) => p.depth - q.depth); // back first

      for (const p of placed) {
        const t = (p.depth + 1) / 2; // 0 back .. 1 front
        const isFront = p.depth > 0.9;
        const scale = util.lerp(0.3, 1, t * t * 0.7 + t * 0.3);
        const bounceScale = isFront ? 1 + this.bounce * 0.09 : 1;
        const img = p.s.img;
        const baseH = H * 0.44 * scale * bounceScale;
        const ar = util.cardAspect(img, this.env.fit(), 0.6, 1.7);
        const baseW = baseH * ar;
        const y = cy + (1 - t) * H * 0.05;
        const border = Math.max(3, baseH * 0.035);
        const alpha = util.lerp(0.3, 1, t);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, y);
        // Ground shadow.
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, baseH * 0.58, baseW * 0.45, baseH * 0.05, 0, 0, TWO_PI);
        ctx.fill();
        // Card.
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 18 * scale;
        ctx.fillStyle = '#f4f2ee';
        util.roundRect(ctx, -baseW / 2 - border, -baseH / 2 - border, baseW + border * 2, baseH + border * 2, border * 1.6);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        util.cover(ctx, img, -baseW / 2, -baseH / 2, baseW, baseH);
        ctx.restore();
      }
    }
  }

  window.PW.scenes.register('carousel', CarouselScene);
})();
