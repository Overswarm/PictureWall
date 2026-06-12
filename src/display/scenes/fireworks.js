// Fireworks: rockets climb from below, explode into showers of colored
// sparks, and each burst blooms into a photo that hangs in the night sky
// before fading. Launches ride the beat; built to catch eyes from afar.
(() => {
  'use strict';
  const { util } = window.PW;

  function elasticOut(t) {
    const c4 = (2 * Math.PI) / 3;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  const MAX_BLOOMS = 3;
  const HUES = [0, 35, 55, 140, 190, 265, 320];

  class FireworksScene extends window.PW.Scene {
    start() {
      this.rockets = [];
      this.sparks = [];
      this.blooms = [];
      this.stars = [];
      this.hills = [];
      this.nextLaunch = performance.now() + 600;
      this.pulse = 0;
    }

    resize(w, h) {
      super.resize(w, h);
      this.stars = Array.from({ length: 110 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        r: Math.random() * 1.3 + 0.4,
        tw: Math.random() * Math.PI * 2,
      }));
      // Two layers of rolling hill silhouettes along the bottom.
      this.hills = [0.86, 0.92].map((base, i) => {
        const pts = [];
        const n = 24;
        for (let k = 0; k <= n; k++) {
          pts.push(base + Math.sin(k * 1.7 + i * 5) * 0.02 + Math.sin(k * 0.6 + i * 2) * 0.028);
        }
        return { pts, shade: i === 0 ? '#101430' : '#090c1c' };
      });
    }

    _launch() {
      const img = this.env.provider.next();
      if (!img) return;
      const { W, H } = this;
      // Keep the whole card on screen once it blooms.
      const ar = util.cardAspect(img, this.env.fit(), 0.65, 1.7);
      const hgt = (this.s('size') / 100) * Math.min(W, H);
      const mx = Math.min(W * 0.45, (hgt * ar) / 2 + W * 0.015);
      const myTop = Math.max(H * 0.14, hgt / 2 + H * 0.015);
      const myBot = Math.min(H * 0.6, H - hgt / 2 - H * 0.02);
      // Pick the burst point farthest from current blooms so photos spread
      // across the sky instead of piling up.
      let tx = 0;
      let ty = 0;
      let bestScore = -1;
      for (let i = 0; i < 4; i++) {
        const cx = util.rand(mx, W - mx);
        const cy = util.rand(myTop, Math.max(myTop, myBot));
        let nearest = Infinity;
        for (const b of this.blooms) {
          nearest = Math.min(nearest, Math.hypot(b.x - cx, b.y - cy));
        }
        for (const r of this.rockets) {
          nearest = Math.min(nearest, Math.hypot(r.tx - cx, r.ty - cy));
        }
        if (nearest > bestScore) {
          bestScore = nearest;
          tx = cx;
          ty = cy;
        }
      }
      const sx = util.clamp(tx + util.rand(-W * 0.08, W * 0.08), W * 0.1, W * 0.9);
      this.rockets.push({
        img,
        sx,
        sy: H * 1.03,
        tx,
        ty,
        t: 0,
        dur: util.rand(0.85, 1.25),
        hue: util.pick(HUES),
        x: sx,
        y: H * 1.03,
        trailAcc: 0,
      });
    }

    onBeat(strength) {
      this.pulse = Math.min(1, this.pulse + strength * 0.8);
    }

    _explode(r) {
      const amt = this.s('sparks') / 100;
      const n = Math.round(40 + amt * 110);
      const speed = Math.min(this.W, this.H) * 0.42;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.25;
        const v = speed * (0.3 + Math.random() * 0.8);
        this.sparks.push({
          x: r.tx,
          y: r.ty,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: util.rand(0.7, 1.6),
          age: 0,
          hue: r.hue + util.rand(-18, 18),
          r: util.rand(1.2, 2.6),
        });
      }
      if (this.sparks.length > 900) this.sparks.splice(0, this.sparks.length - 900);
      const { minMs, maxMs } = this.env.globals();
      this.blooms.push({
        img: r.img,
        x: r.tx,
        y: r.ty,
        hue: r.hue,
        age: 0,
        life: util.clamp((minMs + maxMs) / 2, 3000, 12000) / 1000,
        fading: false,
        fade: 1,
        rot: util.rand(-0.08, 0.08),
      });
    }

    update(dt, audio, now) {
      // Launch at the configured rate, but hold each launch for the next
      // beat (up to 1.5s) so rockets go up with the music.
      if (now >= this.nextLaunch && (audio.beat || now > this.nextLaunch + 1500)) {
        this._launch();
        const rate = Math.max(1, this.s('launchRate'));
        this.nextLaunch = now + (60000 / rate) * util.rand(0.65, 1.4);
      }
      this.pulse *= Math.exp(-dt * 4.5);

      for (const r of this.rockets) {
        r.t += dt / r.dur;
        const e = 1 - Math.pow(1 - Math.min(1, r.t), 2.4);
        r.x = util.lerp(r.sx, r.tx, e);
        r.y = util.lerp(r.sy, r.ty, e);
        r.trailAcc += dt;
        while (r.trailAcc > 0.02) {
          r.trailAcc -= 0.02;
          this.sparks.push({
            x: r.x + util.rand(-2, 2),
            y: r.y + util.rand(-2, 2),
            vx: util.rand(-12, 12),
            vy: util.rand(20, 60),
            life: util.rand(0.25, 0.55),
            age: 0,
            hue: 40,
            r: util.rand(0.7, 1.5),
          });
        }
        if (r.t >= 1) {
          this._explode(r);
          r.done = true;
        }
      }
      this.rockets = this.rockets.filter((r) => !r.done);

      const grav = this.H * 0.25;
      for (const s of this.sparks) {
        s.age += dt;
        s.vy += grav * dt;
        s.vx *= Math.exp(-dt * 1.4);
        s.vy *= Math.exp(-dt * 0.4);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      this.sparks = this.sparks.filter((s) => s.age < s.life);

      const active = this.blooms.filter((b) => !b.fading);
      for (let i = 0; i < active.length - MAX_BLOOMS; i++) active[i].fading = true;
      for (const b of this.blooms) {
        b.age += dt;
        if (b.age > b.life) b.fading = true;
        if (b.fading) b.fade -= dt / 0.8;
      }
      this.blooms = this.blooms.filter((b) => b.fade > 0);
    }

    draw(ctx) {
      const { W, H } = this;

      // Night sky.
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#040312');
      sky.addColorStop(0.6, '#0c0a26');
      sky.addColorStop(1, '#191238');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars.
      ctx.fillStyle = '#cfd6ff';
      const tNow = performance.now() / 1000;
      for (const s of this.stars) {
        ctx.globalAlpha = 0.2 + 0.45 * Math.abs(Math.sin(tNow * 1.4 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Hills.
      for (const hill of this.hills) {
        ctx.fillStyle = hill.shade;
        ctx.beginPath();
        ctx.moveTo(0, H);
        hill.pts.forEach((p, k) => ctx.lineTo((k / (hill.pts.length - 1)) * W, p * H));
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      }

      // Rockets and sparks, additive for glow.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const r of this.rockets) {
        ctx.fillStyle = 'rgba(255,240,200,0.95)';
        ctx.shadowColor = 'rgba(255,220,150,0.9)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';
      }
      for (const s of this.sparks) {
        const k = 1 - s.age / s.life;
        ctx.fillStyle = `hsla(${s.hue}, 95%, ${55 + k * 25}%, ${(k * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.5 + k * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Photo blooms, oldest first.
      for (const b of this.blooms) {
        const popT = Math.min(1, b.age / 0.65);
        const scale = elasticOut(popT);
        const hgt = (this.s('size') / 100) * Math.min(W, H) * (1 + this.pulse * 0.03) * scale;
        if (hgt < 2) continue;
        const ar = util.cardAspect(b.img, this.env.fit(), 0.65, 1.7);
        const w = hgt * ar;

        ctx.save();
        ctx.globalAlpha = util.clamp(b.fade, 0, 1);

        // Expanding shockwave ring right after the burst.
        if (popT < 1) {
          ctx.strokeStyle = `hsla(${b.hue}, 90%, 70%, ${((1 - popT) * 0.55).toFixed(3)})`;
          ctx.lineWidth = 2 + (1 - popT) * 3;
          ctx.beginPath();
          ctx.arc(b.x, b.y, Math.max(w, hgt) * (0.3 + popT * 0.55), 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.shadowColor = `hsla(${b.hue}, 90%, 65%, ${(0.55 + this.pulse * 0.35).toFixed(3)})`;
        ctx.shadowBlur = 22 + this.pulse * 26;
        ctx.fillStyle = 'rgba(250,250,252,0.97)';
        util.roundRect(ctx, -w / 2 - 5, -hgt / 2 - 5, w + 10, hgt + 10, 10);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.save();
        util.roundRect(ctx, -w / 2, -hgt / 2, w, hgt, 7);
        ctx.clip();
        util.cover(ctx, b.img, -w / 2, -hgt / 2, w, hgt);
        ctx.restore();
        ctx.restore();
      }
    }
  }

  window.PW.scenes.register('fireworks', FireworksScene);
})();
