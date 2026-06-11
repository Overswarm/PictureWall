// Photo Wall: a grid of tiles. On each beat a few tiles flip over to reveal
// new photos; a colored glow washes over the wall with the music.
(() => {
  'use strict';
  const { util } = window.PW;

  const FLIP_SECS = 0.55;

  class MosaicScene extends window.PW.Scene {
    start() {
      this.cells = [];
      this.cols = 0;
      this.rows = 0;
      this.glowP = 0;
      this.hue = 210;
      this.lastFlip = performance.now();
      this.fillTimer = 0;
    }

    _layout() {
      this.cols = this.s('columns');
      const cw = this.W / this.cols;
      this.rows = Math.max(1, Math.round(this.H / cw));
      const total = this.cols * this.rows;
      const old = this.cells;
      this.cells = Array.from({ length: total }, (_, i) => {
        const prev = old[i];
        return {
          img: prev ? prev.img : null,
          next: null,
          flip: 0,
        };
      });
    }

    resize(w, h) {
      super.resize(w, h);
      this._layout();
    }

    _startFlip(cell, img) {
      cell.next = img;
      cell.flip = 0.0001;
    }

    _flipRandom(count) {
      const idle = this.cells.filter((c) => !c.flip && c.img);
      for (let i = 0; i < count && idle.length; i++) {
        const idx = Math.floor(Math.random() * idle.length);
        const cell = idle.splice(idx, 1)[0];
        const img = this.env.provider.next();
        if (!img) break;
        this._startFlip(cell, img);
        this.lastFlip = performance.now();
      }
    }

    onBeat(strength) {
      this.glowP = Math.min(1, this.glowP + strength);
      this.hue = (this.hue + 47) % 360;
      this._flipRandom(this.s('flips'));
    }

    update(dt, audio, now) {
      if (this.cols !== this.s('columns')) this._layout();

      // Populate empty tiles gradually so the wall builds itself on startup.
      this.fillTimer += dt;
      if (this.fillTimer > 0.12) {
        this.fillTimer = 0;
        const empty = this.cells.find((c) => !c.img && !c.flip);
        if (empty) {
          const img = this.env.provider.next();
          if (img) this._startFlip(empty, img);
        }
      }

      // No beats (quiet music or none at all): keep the wall alive anyway.
      const { maxMs } = this.env.globals();
      if (now - this.lastFlip > maxMs) this._flipRandom(1);

      for (const c of this.cells) {
        if (c.flip > 0) {
          c.flip += dt / FLIP_SECS;
          if (c.flip >= 0.5 && c.next) {
            c.img = c.next;
            c.next = null;
          }
          if (c.flip >= 1) c.flip = 0;
        }
      }
      this.glowP *= Math.exp(-dt * 3.2);
    }

    draw(ctx) {
      const { W, H } = this;
      ctx.fillStyle = '#0b0b10';
      ctx.fillRect(0, 0, W, H);
      const cw = W / this.cols;
      const ch = H / this.rows;
      const gap = Math.max(2, Math.min(cw, ch) * 0.02);

      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        if (!c.img) continue;
        const col = i % this.cols;
        const row = Math.floor(i / this.cols);
        const x = col * cw + gap / 2;
        const y = row * ch + gap / 2;
        const w = cw - gap;
        const h = ch - gap;
        const sx = c.flip > 0 ? Math.abs(Math.cos(Math.PI * Math.min(1, c.flip))) : 1;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(Math.max(0.001, sx), 1);
        util.cover(ctx, c.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      const glowAmt = (this.s('glow') / 100) * this.glowP;
      if (glowAmt > 0.01) {
        const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
        g.addColorStop(0, `hsla(${this.hue}, 85%, 60%, ${(glowAmt * 0.22).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  window.PW.scenes.register('mosaic', MosaicScene);
})();
