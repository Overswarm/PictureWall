// City Drive v2: an endless night drive down a curving neon street.
// The road bends through turns, buildings slide past close to the camera,
// and photos appear as flat billboards, angled billboards, and murals
// perspective-mapped onto building walls. Speed and glow ride the music.
(() => {
  'use strict';
  const { util } = window.PW;

  // World units: road half-width 6, eye height above ground 14.
  const ROAD_HALF = 6;
  const GROUND_Y = 14;
  const NEAR = 1.9;
  const FAR = 90;
  const STEP = 3; // z sampling for the curve table
  const SHOULDER = ROAD_HALF + 3.5;

  class CityScene extends window.PW.Scene {
    start() {
      this.z = 0;
      this.beatGlow = 0;
      this.stars = [];
      this.skyline = [];
      this.track = []; // [{ z0, len, c }] piecewise-constant road curvature
      this.trackEnd = 0;
      this.lots = []; // roadside objects: buildings, billboards, lamps
      this.genZ = { '-1': 10, '1': 18 };
      this.offsets = new Float32Array(Math.ceil(FAR / STEP) + 2);
      this._buildSky();
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

    // ------------------------------------------------------------ track ----

    _extendTrack() {
      while (this.trackEnd < this.z + FAR + 60) {
        const straight = Math.random() < 0.4;
        const len = util.rand(45, 120);
        const c = straight ? 0 : util.rand(0.002, 0.0075) * (Math.random() < 0.5 ? -1 : 1);
        this.track.push({ z0: this.trackEnd, len, c });
        this.trackEnd += len;
      }
      while (this.track.length > 1 && this.track[0].z0 + this.track[0].len < this.z - 5) {
        this.track.shift();
      }
    }

    _curvatureAt(z) {
      for (const s of this.track) {
        if (z >= s.z0 && z < s.z0 + s.len) return s.c;
      }
      return 0;
    }

    // Lateral offset of the road relative to the camera's view direction,
    // for each sampled distance ahead (double integral of curvature).
    _computeOffsets() {
      let x = 0;
      let heading = 0;
      for (let i = 0; i < this.offsets.length; i++) {
        this.offsets[i] = x;
        x += heading * STEP;
        heading += this._curvatureAt(this.z + i * STEP) * STEP;
      }
    }

    _off(d) {
      const fi = util.clamp(d / STEP, 0, this.offsets.length - 1.001);
      const i = Math.floor(fi);
      const t = fi - i;
      return this.offsets[i] * (1 - t) + this.offsets[i + 1] * t;
    }

    // ------------------------------------------------------------- lots ----

    _genLots() {
      const density = this.s('density') / 100;
      for (const side of [-1, 1]) {
        const key = String(side);
        while (this.genZ[key] < this.z + FAR + 10) {
          const z0 = this.genZ[key];
          const r = Math.random();
          let lot;
          if (r < 0.48) lot = this._makeBuilding(z0, side);
          else if (r < 0.74) lot = this._makeBillboard(z0, side);
          else if (r < 0.9) lot = { type: 'lamp', z0, len: 1.5, side };
          else lot = { type: 'gap', z0, len: util.rand(4, 10), side };
          this.lots.push(lot);
          const gapExtra = util.lerp(15, 0, density) * Math.random();
          this.genZ[key] = z0 + lot.len + util.rand(2, 6) + gapExtra;
        }
      }
      this.lots = this.lots.filter((l) => l.z0 + l.len > this.z - 4);
    }

    _makeBuilding(z0, side) {
      const len = util.rand(11, 22);
      const h = util.rand(9, 26);
      const winCols = Math.max(2, Math.round(len / 3.2));
      const winRows = Math.max(2, Math.round(h / 3.4));
      const lit = [];
      for (let i = 0; i < winCols * winRows; i++) lit.push(Math.random() < 0.35);
      return {
        type: 'building', z0, len, side,
        width: util.rand(6, 12), h,
        hue: util.pick([225, 250, 210, 275]),
        wantPhoto: Math.random() < 0.5,
        img: null, winCols, winRows, lit,
        muralHue: util.pick([320, 190, 35, 150]),
      };
    }

    _makeBillboard(z0, side) {
      const angled = Math.random() < 0.45;
      return {
        type: 'billboard', z0, side, angled,
        len: angled ? util.rand(5, 7) : 1.2,
        h: util.rand(5.5, 7.5),
        pole: util.rand(2.5, 5),
        hue: util.pick([320, 190, 265, 35, 150, 0]),
        img: null,
      };
    }

    onBeat(strength) {
      this.beatGlow = Math.min(1, this.beatGlow + strength);
    }

    update(dt, audio) {
      const sp = this.s('speed') / 100;
      this.z += (3.5 + sp * 17) * (1 + audio.level * 0.9) * dt;
      this.beatGlow *= Math.exp(-dt * 4);
      this._extendTrack();
      this._genLots();
      this._computeOffsets();
      for (const lot of this.lots) {
        const needsImg = lot.type === 'billboard' || (lot.type === 'building' && lot.wantPhoto);
        if (needsImg && !lot.img) lot.img = this.env.provider.next();
      }
    }

    // -------------------------------------------------------- rendering ----

    // Perspective-correct image on a vertical wall running along z.
    // Drawn as transformed strips; `flip` mirrors the source so photos read
    // correctly from the road on either side.
    _wallImage(ctx, img, wx, za, zb, yTop, yBot, SX, SY, flip) {
      const N = 12;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const d = za + (zb - za) * t - this.z;
        if (d < NEAR * 0.7 || d > FAR) { prev = null; continue; }
        const cur = { x: SX(wx, d), yT: SY(yTop, d), yB: SY(yBot, d), t };
        if (prev) {
          const t0 = flip ? 1 - prev.t : prev.t;
          const t1 = flip ? 1 - cur.t : cur.t;
          const sx0 = img.width * Math.min(t0, t1);
          const sw = Math.max(1, img.width * Math.abs(t1 - t0));
          ctx.save();
          ctx.transform(cur.x - prev.x, cur.yT - prev.yT, 0, prev.yB - prev.yT, prev.x, prev.yT);
          if (flip) {
            ctx.translate(1, 0);
            ctx.scale(-1, 1);
          }
          // Destination slightly over 1 unit wide to hide seams between strips.
          ctx.drawImage(img, sx0, 0, sw, img.height, 0, 0, 1.03, 1);
          ctx.restore();
        }
        prev = cur;
      }
    }

    // Filled quad following the (possibly curving) wall line.
    _wallPoly(ctx, wx, za, zb, yTop, yBot, SX, SY) {
      const N = 6;
      const top = [];
      const bot = [];
      for (let i = 0; i <= N; i++) {
        const d = util.clamp(za + (zb - za) * (i / N) - this.z, NEAR * 0.7, FAR);
        top.push([SX(wx, d), SY(yTop, d)]);
        bot.push([SX(wx, d), SY(yBot, d)]);
      }
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) ctx.lineTo(x, y);
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath();
    }

    _drawBuilding(ctx, b, SX, SY, f, neon) {
      const d1 = Math.max(NEAR * 0.75, b.z0 - this.z);
      const d2 = Math.min(FAR, b.z0 + b.len - this.z);
      if (d2 - d1 < 0.4) return;
      const xIn = b.side * SHOULDER;
      const top = GROUND_Y - b.h;
      const fade = util.clamp((FAR - 8 - d1) / 24, 0, 1);
      if (fade <= 0.02) return;

      ctx.save();
      ctx.globalAlpha = fade;

      // Front face (the end of the building facing the driver).
      if (b.z0 - this.z > NEAR) {
        const xOut = b.side * (SHOULDER + b.width);
        const xA = SX(xIn, d1);
        const xB = SX(xOut, d1);
        const yT = SY(top, d1);
        const yB = SY(GROUND_Y, d1);
        ctx.fillStyle = `hsl(${b.hue}, 24%, 9%)`;
        ctx.fillRect(Math.min(xA, xB), yT, Math.abs(xB - xA), yB - yT);
      }

      // Side wall facing the road.
      this._wallPoly(ctx, xIn, b.z0, b.z0 + b.len, top, GROUND_Y, SX, SY);
      ctx.fillStyle = `hsl(${b.hue}, 22%, 14%)`;
      ctx.fill();

      // Windows (skip when far away — too small to matter).
      if (d1 < 50) {
        const litCol = 'rgba(255, 214, 140, 0.85)';
        const darkCol = 'rgba(140, 160, 220, 0.12)';
        for (let r = 0; r < b.winRows; r++) {
          for (let c = 0; c < b.winCols; c++) {
            const zc = b.z0 + b.len * ((c + 0.5) / b.winCols);
            const dC = zc - this.z;
            if (dC < NEAR || dC > FAR - 10) continue;
            const yC = top + b.h * 0.08 + (b.h * 0.84) * ((r + 0.5) / b.winRows);
            const hw = Math.min(0.55, b.len / b.winCols * 0.28);
            const hh = Math.min(0.7, b.h / b.winRows * 0.3);
            const x0 = SX(xIn, dC - hw);
            const x1 = SX(xIn, dC + hw);
            const y0 = SY(yC - hh, dC);
            const y1 = SY(yC + hh, dC);
            ctx.fillStyle = b.lit[r * b.winCols + c] ? litCol : darkCol;
            ctx.fillRect(Math.min(x0, x1), y0, Math.max(1, Math.abs(x1 - x0)), Math.max(1, y1 - y0));
          }
        }
      }

      // Photo mural on the wall, sized to the photo's shape.
      if (b.img) {
        const ar = b.img.width / b.img.height || 1.5;
        const zSpan = b.len * 0.76;
        let mH = Math.min(b.h * 0.74, zSpan / ar);
        let mLen = mH * ar;
        const za = b.z0 + (b.len - mLen) / 2;
        const zb = za + mLen;
        const yTopM = top + (b.h - mH) * 0.42;
        const yBotM = yTopM + mH;
        // Wall-wash light behind the mural.
        ctx.save();
        this._wallPoly(ctx, xIn, za - mLen * 0.06, zb + mLen * 0.06, yTopM - mH * 0.08, yBotM + mH * 0.08, SX, SY);
        ctx.fillStyle = `hsla(${b.muralHue}, 70%, 60%, ${(0.12 + this.beatGlow * 0.25 * neon).toFixed(3)})`;
        ctx.fill();
        ctx.restore();
        this._wallImage(ctx, b.img, xIn, za, zb, yTopM, yBotM, SX, SY, b.side === -1);
        // Thin neon trim.
        this._wallPoly(ctx, xIn, za, zb, yTopM, yBotM, SX, SY);
        ctx.strokeStyle = `hsla(${b.muralHue}, 90%, 62%, ${(0.4 + this.beatGlow * 0.5 * neon).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, (f / d1) * 0.1);
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawBillboard(ctx, b, SX, SY, f, neon) {
      const dN = b.z0 - this.z;
      if (dN < NEAR || dN > FAR - 6) return;
      const fade = util.clamp((FAR - 6 - dN) / 18, 0, 1) * util.clamp((dN - NEAR) / 1.5, 0, 1);
      if (fade <= 0.02) return;
      const fit = this.env.fit();
      const glow = neon * (0.5 + this.beatGlow * 0.8);

      ctx.save();
      ctx.globalAlpha = fade;

      if (b.angled) {
        // Panel turned toward the driver: near edge close to the road,
        // far edge swung outward.
        const xNear = b.side * (SHOULDER + 0.6);
        const xFar = b.side * (SHOULDER + 4.2);
        const za = b.z0;
        const zb = b.z0 + b.len;
        const yTop = GROUND_Y - b.pole - b.h;
        const yBot = GROUND_Y - b.pole;
        // Support poles at both ends.
        for (const [wx, zw] of [[xNear, za], [xFar, zb]]) {
          const d = zw - this.z;
          if (d < NEAR) continue;
          const px = SX(wx, d);
          const pw = Math.max(1.5, (0.25 * f) / d);
          ctx.fillStyle = '#23202e';
          ctx.fillRect(px - pw / 2, SY(yBot, d), pw, SY(GROUND_Y, d) - SY(yBot, d));
        }
        // Backing, photo, neon frame — all following the angled plane.
        const wallX = (t) => xNear + (xFar - xNear) * t; // varies along z
        // Approximate the angled plane with the wall helpers by interpolating
        // x per slice: wrap SX so the x coordinate slides with z.
        const SXa = (wx, d) => {
          const t = util.clamp(((d + this.z) - za) / (zb - za), 0, 1);
          return SX(wallX(t), d);
        };
        ctx.fillStyle = '#0c0c12';
        this._wallPoly(ctx, 0, za, zb, yTop - b.h * 0.04, yBot + b.h * 0.04, SXa, SY);
        ctx.fill();
        if (b.img) {
          this._wallImage(ctx, b.img, 0, za, zb, yTop, yBot, SXa, SY, b.side === -1);
        }
        this._wallPoly(ctx, 0, za, zb, yTop, yBot, SXa, SY);
        ctx.strokeStyle = `hsla(${b.hue}, 95%, 62%, ${util.clamp(0.5 + glow * 0.5, 0, 1).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, (f / dN) * 0.18);
        ctx.shadowColor = `hsla(${b.hue}, 95%, 60%, 0.9)`;
        ctx.shadowBlur = util.clamp(glow * (f / dN) * 1.4, 0, 42);
        ctx.stroke();
      } else {
        // Flat billboard facing the camera.
        const s = f / dN;
        const ar = b.img ? util.cardAspect(b.img, fit, 1.0, 1.9) : 1.5;
        const wWorld = b.h * ar;
        const bx = SX(b.side * (SHOULDER + 1 + wWorld / 2), dN);
        const groundYpx = SY(GROUND_Y, dN);
        const bw = wWorld * s;
        const bh = b.h * s;
        const poleH = b.pole * s;
        const topY = groundYpx - poleH - bh;
        ctx.fillStyle = '#23202e';
        ctx.fillRect(bx - Math.max(1.5, 0.3 * s) / 2, groundYpx - poleH, Math.max(1.5, 0.3 * s), poleH);
        ctx.fillStyle = '#0c0c12';
        ctx.fillRect(bx - bw / 2 - bw * 0.03, topY - bh * 0.03, bw * 1.06, bh * 1.06);
        if (b.img) {
          if (fit) util.fitDraw(ctx, b.img, bx - bw / 2, topY, bw, bh, 0.4);
          else util.cover(ctx, b.img, bx - bw / 2, topY, bw, bh);
        } else {
          ctx.fillStyle = '#1c1c28';
          ctx.fillRect(bx - bw / 2, topY, bw, bh);
        }
        ctx.strokeStyle = `hsla(${b.hue}, 95%, 62%, ${util.clamp(0.5 + glow * 0.5, 0, 1).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, s * 0.22);
        ctx.shadowColor = `hsla(${b.hue}, 95%, 60%, 0.9)`;
        ctx.shadowBlur = util.clamp(glow * s * 1.6, 0, 42);
        ctx.strokeRect(bx - bw / 2, topY, bw, bh);
      }
      ctx.restore();
    }

    _drawLamp(ctx, lot, SX, SY, f, neon) {
      const d = lot.z0 - this.z;
      if (d < NEAR || d > FAR - 20) return;
      const fade = util.clamp((FAR - 20 - d) / 20, 0, 1);
      const x = lot.side * (ROAD_HALF + 1.2);
      const px = SX(x, d);
      const gy = SY(GROUND_Y, d);
      const ty = SY(GROUND_Y - 10, d);
      const armX = SX(x - lot.side * 1.8, d);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#2c2a3a';
      ctx.lineWidth = Math.max(1, (0.22 * f) / d);
      ctx.beginPath();
      ctx.moveTo(px, gy);
      ctx.lineTo(px, ty);
      ctx.lineTo(armX, ty);
      ctx.stroke();
      const r = Math.max(1.2, (0.35 * f) / d);
      ctx.fillStyle = `rgba(255, 230, 170, ${(0.75 + this.beatGlow * 0.25).toFixed(3)})`;
      ctx.shadowColor = 'rgba(255, 220, 140, 0.9)';
      ctx.shadowBlur = r * (3 + this.beatGlow * 4 * neon);
      ctx.beginPath();
      ctx.arc(armX, ty, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    draw(ctx) {
      const { W, H } = this;
      const horizon = H * 0.42;
      const f = H * 0.85;
      const cx = W / 2;
      const neon = this.s('neon') / 100;
      const off = (d) => this._off(d);
      const SX = (wx, d) => cx + ((wx + off(d)) * f) / d;
      const SY = (wy, d) => horizon + (wy * f) / d;

      // Sky.
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#05030f');
      sky.addColorStop(1, '#1d1038');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, horizon + 1);

      // Stars.
      ctx.fillStyle = '#cfd6ff';
      const tNow = performance.now() / 1000;
      for (const s of this.stars) {
        ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(tNow * 1.5 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Skyline silhouettes: scroll with travel, lean into the curve ahead.
      const skyShift = -(off(FAR - STEP) * f) / FAR * 0.45;
      for (const layer of this.skyline) {
        ctx.fillStyle = layer.shade;
        const scroll = (this.z * 14 * layer.parallax) % layer.span;
        for (let rep = -1; rep <= 1; rep++) {
          for (const blk of layer.blocks) {
            const x = blk.x - scroll + rep * layer.span + skyShift * layer.parallax;
            if (x > W || x + blk.w < 0) continue;
            ctx.fillRect(x, horizon - blk.h * H, blk.w, blk.h * H + 1);
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

      // Road, drawn as strips so it follows the curve. Far to near.
      const edgeA = (0.28 + this.beatGlow * 0.35 * neon).toFixed(3);
      for (let d = FAR - STEP; d >= NEAR; d -= STEP) {
        const dA = d;
        const dB = d + STEP;
        const yA = Math.min(H + 80, SY(GROUND_Y, dA));
        const yB = SY(GROUND_Y, dB);
        const quad = (xwL, xwR) => {
          ctx.beginPath();
          ctx.moveTo(SX(xwL, dA), yA);
          ctx.lineTo(SX(xwR, dA), yA);
          ctx.lineTo(SX(xwR, dB), yB);
          ctx.lineTo(SX(xwL, dB), yB);
          ctx.closePath();
          ctx.fill();
        };
        ctx.fillStyle = Math.floor((this.z + dA) / 7) % 2 ? '#171420' : '#141121';
        quad(-ROAD_HALF, ROAD_HALF);
        // Edge lines.
        ctx.fillStyle = `rgba(120,220,255,${edgeA})`;
        quad(-ROAD_HALF, -ROAD_HALF + 0.32);
        quad(ROAD_HALF - 0.32, ROAD_HALF);
        // Centre dashes.
        if (((this.z + dA) % 6) < 2.6) {
          ctx.fillStyle = `rgba(255,210,110,${util.clamp((FAR - dA) / 30, 0, 0.8).toFixed(3)})`;
          quad(-0.14, 0.14);
        }
      }

      // Roadside objects, far to near.
      const visible = this.lots
        .map((lot) => ({ lot, dN: lot.z0 - this.z }))
        .filter(({ lot, dN }) => dN + lot.len > NEAR + 0.1 && dN < FAR - 2)
        .sort((a, b) => b.dN - a.dN);
      for (const { lot } of visible) {
        if (lot.type === 'building') this._drawBuilding(ctx, lot, SX, SY, f, neon);
        else if (lot.type === 'billboard') this._drawBillboard(ctx, lot, SX, SY, f, neon);
        else if (lot.type === 'lamp') this._drawLamp(ctx, lot, SX, SY, f, neon);
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
