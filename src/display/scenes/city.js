// City Drive: an endless night drive down a neon street. Photos hang on
// billboards along both sides of the road; speed and glow ride the music.
(() => {
  'use strict';
  const { util } = window.PW;

  // World units: road half-width 6, eye height above ground 14, far plane 80.
  const ROAD_HALF = 6;
  const GROUND_Y = 14;
  const NEAR = 1.8;
  const FAR = 80;

  class CityScene extends window.PW.Scene {
    start() {
      this.z = 0;
      this.boards = [];
      this.stars = [];
      this.skyline = [];
      this.beatGlow = 0;
      this.density = -1;
      this._buildSky();
      this._buildBoards();
    }

    resize(w, h) {
      super.resize(w, h);
      this._buildSky();
    }

    _buildSky() {
      const { W, H } = this;
      if (!W) return;
      this.stars = Array.from({ length: 90 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.38,
        r: Math.random() * 1.4 + 0.4,
        tw: Math.random() * Math.PI * 2,
      }));
      // Two parallax skyline layers as runs of building widths/heights.
      this.skyline = [0.16, 0.3].map((hScale, li) => {
        const blocks = [];
        let x = 0;
        while (x < 3000) {
          const bw = util.rand(40, 130);
          blocks.push({ x, w: bw, h: util.rand(0.3, 1) * hScale });
          x += bw + util.rand(4, 18);
        }
        return { blocks, span: x, parallax: li === 0 ? 0.35 : 0.9, shade: li === 0 ? '#11142a' : '#181b34' };
      });
    }

    _spacing() {
      return util.lerp(26, 9, this.s('density') / 100);
    }

    _buildBoards() {
      this.density = this.s('density');
      this.boards = [];
      const spacing = this._spacing();
      let side = 1;
      for (let z = 8; z < FAR + spacing; z += spacing) {
        this.boards.push(this._makeBoard(z + util.rand(-1.5, 1.5), side));
        side = -side;
      }
      this.span = this.boards.length * spacing;
    }

    _makeBoard(z, side) {
      return {
        z,
        side,
        img: null,
        w: util.rand(8.5, 11),
        h: util.rand(6, 7.5),
        pole: util.rand(2, 5),
        hue: util.pick([320, 190, 265, 35, 150, 0]),
      };
    }

    onBeat(strength) {
      this.beatGlow = Math.min(1, this.beatGlow + strength);
    }

    update(dt, audio) {
      if (this.density !== this.s('density')) this._buildBoards();
      const sp = this.s('speed') / 100;
      this.z += (3.5 + sp * 17) * (1 + audio.level * 0.9) * dt;
      this.beatGlow *= Math.exp(-dt * 4);
      const spacing = this._spacing();
      const span = this.boards.length * spacing;
      for (const b of this.boards) {
        if (b.z - this.z < NEAR - 0.5) {
          const fresh = this._makeBoard(b.z + span, b.side);
          fresh.img = this.env.provider.next();
          Object.assign(b, fresh);
        }
        if (!b.img) b.img = this.env.provider.next();
      }
    }

    draw(ctx, _W, _H) {
      const { W, H } = this;
      const horizon = H * 0.42;
      const f = H * 0.85;
      const cx = W / 2;
      const neon = this.s('neon') / 100;

      // Sky.
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#05030f');
      sky.addColorStop(1, '#1d1038');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, horizon + 1);

      // Stars.
      ctx.fillStyle = '#cfd6ff';
      const t = performance.now() / 1000;
      for (const s of this.stars) {
        ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 1.5 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Skyline silhouettes with parallax scrolling.
      for (const layer of this.skyline) {
        ctx.fillStyle = layer.shade;
        const off = (this.z * 14 * layer.parallax) % layer.span;
        for (let rep = -1; rep <= 1; rep++) {
          for (const b of layer.blocks) {
            const x = b.x - off + rep * layer.span;
            if (x > W || x + b.w < 0) continue;
            ctx.fillRect(x, horizon - b.h * H, b.w, b.h * H + 1);
          }
        }
      }

      // Horizon glow that flares on the beat.
      const glowA = 0.12 + this.beatGlow * 0.3 * neon;
      const hg = ctx.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.05);
      hg.addColorStop(0, 'rgba(255,60,180,0)');
      hg.addColorStop(1, `rgba(255,60,180,${glowA.toFixed(3)})`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, horizon - H * 0.12, W, H * 0.17);

      // Ground.
      const gnd = ctx.createLinearGradient(0, horizon, 0, H);
      gnd.addColorStop(0, '#0d0a1c');
      gnd.addColorStop(1, '#04030a');
      ctx.fillStyle = gnd;
      ctx.fillRect(0, horizon, W, H - horizon);

      const yAt = (d) => horizon + (GROUND_Y * f) / d;
      const xAt = (wx, d) => cx + (wx * f) / d;

      // Road surface.
      ctx.fillStyle = '#16131f';
      ctx.beginPath();
      ctx.moveTo(xAt(-ROAD_HALF, FAR), yAt(FAR));
      ctx.lineTo(xAt(ROAD_HALF, FAR), yAt(FAR));
      ctx.lineTo(xAt(ROAD_HALF, NEAR), Math.min(H + 60, yAt(NEAR)));
      ctx.lineTo(xAt(-ROAD_HALF, NEAR), Math.min(H + 60, yAt(NEAR)));
      ctx.closePath();
      ctx.fill();

      // Road edge lines.
      for (const sideX of [-ROAD_HALF, ROAD_HALF]) {
        ctx.strokeStyle = `rgba(120,220,255,${(0.25 + this.beatGlow * 0.3 * neon).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xAt(sideX, FAR), yAt(FAR));
        ctx.lineTo(xAt(sideX, NEAR), Math.min(H + 60, yAt(NEAR)));
        ctx.stroke();
      }

      // Center lane dashes scrolling toward the camera.
      const dashLen = 2.4;
      const dashGap = 6;
      ctx.fillStyle = 'rgba(255,210,110,0.8)';
      const firstK = Math.floor((this.z + NEAR) / dashGap);
      for (let k = firstK; k * dashGap < this.z + FAR; k++) {
        const d0 = k * dashGap - this.z;
        const d1 = d0 + dashLen;
        if (d1 < NEAR || d0 > FAR) continue;
        const da = Math.max(NEAR, d0);
        const db = Math.min(FAR, d1);
        const y0 = yAt(db);
        const y1 = Math.min(H + 60, yAt(da));
        const w0 = (0.28 * f) / db;
        const w1 = (0.28 * f) / da;
        ctx.globalAlpha = util.clamp((FAR - d0) / 30, 0, 0.85);
        ctx.beginPath();
        ctx.moveTo(cx - w0, y0);
        ctx.lineTo(cx + w0, y0);
        ctx.lineTo(cx + w1, y1);
        ctx.lineTo(cx - w1, y1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Billboards, far to near.
      const sorted = [...this.boards].sort((a, b) => (b.z - this.z) - (a.z - this.z));
      for (const b of sorted) {
        const d = b.z - this.z;
        if (d < NEAR || d > FAR - 5) continue;
        const s = f / d;
        const worldX = b.side * (ROAD_HALF + 2 + b.w / 2);
        const bx = cx + worldX * s;
        const groundYpx = yAt(d);
        const bw = b.w * s;
        const bh = b.h * s;
        const poleH = b.pole * s;
        const topY = groundYpx - poleH - bh;
        const fade = util.clamp((FAR - 5 - d) / 18, 0, 1) * util.clamp((d - NEAR) / 1.5, 0, 1);
        if (fade <= 0.02 || bw < 4) continue;

        ctx.save();
        ctx.globalAlpha = fade;
        // Pole.
        ctx.fillStyle = '#23202e';
        ctx.fillRect(bx - Math.max(1.5, 0.3 * s) / 2, groundYpx - poleH, Math.max(1.5, 0.3 * s), poleH);
        // Board backing.
        ctx.fillStyle = '#0c0c12';
        ctx.fillRect(bx - bw / 2 - bw * 0.03, topY - bh * 0.03, bw * 1.06, bh * 1.06);
        // Photo.
        if (b.img) {
          util.cover(ctx, b.img, bx - bw / 2, topY, bw, bh);
        } else {
          ctx.fillStyle = '#1c1c28';
          ctx.fillRect(bx - bw / 2, topY, bw, bh);
        }
        // Neon frame.
        const glow = neon * (0.5 + this.beatGlow * 0.8);
        ctx.strokeStyle = `hsla(${b.hue}, 95%, 62%, ${util.clamp(0.5 + glow * 0.5, 0, 1).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, s * 0.22);
        ctx.shadowColor = `hsla(${b.hue}, 95%, 60%, 0.9)`;
        ctx.shadowBlur = util.clamp(glow * s * 1.6, 0, 42);
        ctx.strokeRect(bx - bw / 2, topY, bw, bh);
        ctx.restore();
      }

      // Subtle vignette.
      const vg = ctx.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.45, cx, H * 0.5, Math.max(W, H) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  window.PW.scenes.register('city', CityScene);
})();
