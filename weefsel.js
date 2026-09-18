/* Het weefsel voor de site (18 sep 2026), naar de waaier van de sterrenwacht (brein/index.html, 25 aug 2026):
   links één lichtpunt (haar vraag), dan 45 kolommen van 32 groepen (de inbedding en 44 lagen), rechts de uitvoer.
   Elke stille draad is een echt gewicht uit de bedrading; een draad licht op als er nú iets doorheen loopt:
   groep ervoor × gewicht × groep erna, per geschreven teken. De site heeft geen deur naar de machines, dus dit
   is haar laatste gedachte uit data.json (elke 10 min ververst), teken voor teken afgespeeld.               */
(function () {
  const TINT = { draad: "150,190,255", licht: "190,220,255", knoop: "120,180,255", plus: "127,224,195", min: "255,154,122" };
  const K_PER_GROEP = 6, BOCHT = 0.3, KS = 0.10, KA = 0.12;
  const RUSTIG = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function Weefsel(canvas) {
    this.c = canvas; this.ctx = canvas.getContext("2d");
    this.stil = document.createElement("canvas");
    this.w = null; this.loop = null; this.rij = 0; this.rijT = 0; this.aan = false;
    this.opbouwT0 = 0;
  }
  const P = Weefsel.prototype;

  P.laad = function (w) {
    this.w = w; this.rij = 0; this.rijT = 0;
    const kol = [w.lagen[0].in.length]; for (const l of w.lagen[0].b) kol.push(l.length);
    this.KOL = kol; this.nK = kol.length;
    // per kolom het maximum over alle rijen (zo zie je wat er per teken verandert)
    this.kolMax = kol.map((n, c) => { let m = 1e-4; for (const r of w.lagen) for (const v of this.kolom(r, c)) m = Math.max(m, v); return m; });
    this.wMax = []; for (let c = 0; c + 1 < this.nK; c++) { let m = 1e-6; const M = w.bedrading && w.bedrading[c]; if (M) for (const rij of M) for (const v of rij) m = Math.max(m, Math.abs(v)); this.wMax.push(m); }
    this.wMaxUit = 1e-6; if (w.bedrading_uit) for (const v of w.bedrading_uit) this.wMaxUit = Math.max(this.wMaxUit, Math.abs(v));
    this.bouwParen();
    this.stroom = this.paren.map(l => new Float32Array(l.length)); this.aanT = this.paren.map(l => new Float32Array(l.length));
    this.stroomIn = new Float32Array(kol[0]); this.aanIn = new Float32Array(kol[0]);
    this.stroomUit = new Float32Array(kol[this.nK - 1]); this.aanUit = new Float32Array(kol[this.nK - 1]);
    this.maat = "";
  };
  P.kolom = function (r, c) { return c === 0 ? r.in : r.b[c - 1]; };
  P.bouwParen = function () {
    const w = this.w; this.paren = [];
    for (let c = 0; c + 1 < this.nK; c++) {
      const M = w.bedrading && w.bedrading[c], na = this.KOL[c], nb = this.KOL[c + 1], m = this.wMax[c] || 1, lijst = [];
      for (let b = 0; b < nb; b++) {
        const rij = M && M[b]; if (!rij) { lijst.push([b % na, b, 0.3, 1]); continue; }
        const idx = []; for (let a = 0; a < na; a++) idx.push(a);
        idx.sort((x, y) => Math.abs(rij[y] || 0) - Math.abs(rij[x] || 0));
        for (let i = 0; i < Math.min(K_PER_GROEP, na); i++) lijst.push([idx[i], b, Math.abs(rij[idx[i]] || 0) / m, (rij[idx[i]] || 0) >= 0 ? 1 : -1]);
      }
      this.paren.push(lijst);
    }
  };

  /* maten: op een staand scherm loopt de stroom van boven naar onder */
  P.projecteer = function () {
    const c = this.c, r = c.getBoundingClientRect();
    const DPR = Math.min(devicePixelRatio || 1, 2);
    const B = Math.max(2, Math.round(r.width * DPR)), H = Math.max(2, Math.round(r.height * DPR));
    if (c.width !== B || c.height !== H) { c.width = B; c.height = H; this.stil.width = B; this.stil.height = H; }
    this.DPR = DPR; this.B = B; this.H = H;
    const staand = r.width < r.height * 1.1; this.staand = staand;
    const pt = (u, v) => staand ? [v, u] : [u, v];
    const span = staand ? H : B, dwars = staand ? B : H, mid = dwars / 2, nK = this.nK;
    this.punt = pt(span * 0.04, mid); this.uit = pt(span * 0.96, mid);
    this.knoop = [];
    for (let k = 0; k < nK; k++) {
      const n = this.KOL[k], u = span * (0.10 + 0.80 * k / Math.max(1, nK - 1)), h = dwars * (staand ? 0.86 : 0.70);
      const kol = []; for (let g = 0; g < n; g++) kol.push(pt(u, mid - h / 2 + (n > 1 ? h * g / (n - 1) : h / 2)));
      this.knoop.push(kol);
    }
    this.maat = B + "x" + H;
  };
  P.pad = function (q, a, b) {
    if (this.staand) { const d = (b[1] - a[1]) * BOCHT; q.moveTo(a[0], a[1]); q.bezierCurveTo(a[0], a[1] + d, b[0], b[1] - d, b[0], b[1]); }
    else { const d = (b[0] - a[0]) * BOCHT; q.moveTo(a[0], a[1]); q.bezierCurveTo(a[0] + d, a[1], b[0] - d, b[1], b[0], b[1]); }
  };

  /* de stille draden: één keer getekend, bleek */
  P.bouwVezels = function () {
    const q = this.stil.getContext("2d"), nK = this.nK, DPR = this.DPR;
    q.clearRect(0, 0, this.B, this.H); q.lineCap = "round";
    const padIn = new Path2D(), padPlus = new Path2D(), padMin = new Path2D();
    for (let g = 0; g < this.KOL[0]; g++) this.pad(padIn, this.punt, this.knoop[0][g]);
    for (let c = 0; c + 1 < nK; c++) for (const [a, b, w, t] of this.paren[c]) this.pad(t < 0 ? padMin : padPlus, this.knoop[c][a], this.knoop[c + 1][b]);
    const bu = this.w.bedrading_uit;
    for (let a = 0; a < this.KOL[nK - 1]; a++) this.pad((bu && bu[a] < 0) ? padMin : padPlus, this.knoop[nK - 1][a], this.uit);
    const dun = this.staand ? 0.045 : 0.06;
    q.lineWidth = DPR * 0.5;
    q.strokeStyle = `rgba(${TINT.draad},${dun})`; q.stroke(padIn);
    q.strokeStyle = `rgba(${TINT.plus},${dun})`; q.stroke(padPlus);
    q.strokeStyle = `rgba(${TINT.min},${dun})`; q.stroke(padMin);
    // de knopen: kleine stille punten
    q.fillStyle = `rgba(${TINT.knoop},0.35)`;
    for (let c = 0; c < nK; c++) for (const p of this.knoop[c]) { q.beginPath(); q.arc(p[0], p[1], DPR * 0.9, 0, 7); q.fill(); }
    q.fillStyle = `rgba(${TINT.licht},0.9)`; q.beginPath(); q.arc(this.punt[0], this.punt[1], DPR * 2.2, 0, 7); q.fill();
    q.beginPath(); q.arc(this.uit[0], this.uit[1], DPR * 2.2, 0, 7); q.fill();
    this.vezelMaat = this.maat;
  };

  /* het licht: de draden waar nú iets doorheen loopt, glijdend aan en uit */
  P.tekenLicht = function (glad) {
    const ctx = this.ctx, nK = this.nK, DR = this.staand ? 0.6 : 0.5, PLAFOND = this.staand ? 8 : 14, dik = this.staand ? 0.7 : 0.9, DPR = this.DPR;
    ctx.lineCap = "round";
    const streep = (a, b, s, aan, t) => {
      const f = Math.max(0, Math.min(1, (s - DR) / (1 - DR))), al = aan * (0.30 + 0.62 * f);
      if (al < 0.02) return;
      const kleur = t > 0 ? TINT.plus : t < 0 ? TINT.min : TINT.licht;
      ctx.strokeStyle = `rgba(${kleur},${al.toFixed(3)})`; ctx.lineWidth = DPR * dik * (0.5 + 0.8 * f);
      ctx.beginPath(); this.pad(ctx, a, b); ctx.stroke();
      if (f > 0.85) { ctx.strokeStyle = `rgba(255,255,255,${(0.3 * aan).toFixed(3)})`; ctx.lineWidth = DPR * 0.6; ctx.stroke(); }
    };
    for (let g = 0; g < this.KOL[0]; g++) {
      this.stroomIn[g] += ((glad[0][g] || 0) - this.stroomIn[g]) * KS;
      this.aanIn[g] += ((this.stroomIn[g] > DR ? 1 : 0) - this.aanIn[g]) * KA;
      if (this.aanIn[g] > 0.02) streep(this.punt, this.knoop[0][g], this.stroomIn[g], this.aanIn[g], 0);
    }
    for (let c = 0; c + 1 < nK; c++) {
      const S = this.stroom[c], A = this.aanT[c], ga = glad[c], gb = glad[c + 1], lijst = this.paren[c], n = lijst.length;
      let top = 1e-6; const tmp = this._tmp && this._tmp.length >= n ? this._tmp : (this._tmp = new Float32Array(n));
      for (let i = 0; i < n; i++) { const p = lijst[i], f = (ga[p[0]] || 0) * p[2] * (gb[p[1]] || 0); tmp[i] = f; if (f > top) top = f; }
      const kand = [];
      for (let i = 0; i < n; i++) { S[i] += (tmp[i] / top - S[i]) * KS; if (S[i] > DR) kand.push(i); }
      if (kand.length > PLAFOND) kand.sort((x, y) => S[y] - S[x]).length = PLAFOND;
      const doel = new Uint8Array(n); for (const i of kand) doel[i] = 1;
      for (let i = 0; i < n; i++) {
        A[i] += (doel[i] - A[i]) * KA;
        if (A[i] > 0.02) { const p = lijst[i]; streep(this.knoop[c][p[0]], this.knoop[c + 1][p[1]], S[i], A[i], p[3]); }
      }
    }
    { const na = this.KOL[nK - 1], ga = glad[nK - 1], bu = this.w.bedrading_uit, zeker = Math.max(0.2, glad.uit || 0); let top = 1e-6; const tmp = new Float32Array(na);
      for (let a = 0; a < na; a++) { const f = (ga[a] || 0) * (bu ? Math.abs(bu[a] || 0) / this.wMaxUit : 0.3) * zeker; tmp[a] = f; if (f > top) top = f; }
      for (let a = 0; a < na; a++) {
        this.stroomUit[a] += (tmp[a] / top - this.stroomUit[a]) * KS;
        this.aanUit[a] += ((this.stroomUit[a] > DR ? 1 : 0) - this.aanUit[a]) * KA;
        if (this.aanUit[a] > 0.02) streep(this.knoop[nK - 1][a], this.uit, this.stroomUit[a], this.aanUit[a], (bu && bu[a] < 0) ? -1 : 1);
      } }
    // de gloed van actieve knopen
    ctx.fillStyle = `rgba(${TINT.licht},0.9)`;
    for (let c = 0; c < nK; c++) { const g = glad[c]; for (let k = 0; k < g.length; k++) if (g[k] > 0.7) { const p = this.knoop[c][k]; ctx.beginPath(); ctx.arc(p[0], p[1], DPR * (1.2 + 1.6 * g[k]), 0, 7); ctx.fill(); } }
  };

  P.beeld = function (t) {
    if (!this.aan) return;
    if (!this.maat || this.maat !== this.c.width + "x" + this.c.height || !this.vezelMaat) { this.projecteer(); this.bouwVezels(); }
    else { const r = this.c.getBoundingClientRect(); const B = Math.round(r.width * this.DPR); if (Math.abs(B - this.B) > 2) { this.projecteer(); this.bouwVezels(); } }
    const w = this.w, ctx = this.ctx;
    // welk teken: elke 520 ms een rij verder, aan het eind even rust en opnieuw
    if (!this.rijT) this.rijT = t;
    if (!RUSTIG && t - this.rijT > (this.rij === w.lagen.length - 1 ? 2600 : 520)) { this.rij = (this.rij + 1) % w.lagen.length; this.rijT = t; }
    const r = w.lagen[this.rij];
    const glad = []; for (let c = 0; c < this.nK; c++) { const k = this.kolom(r, c), m = this.kolMax[c]; glad.push(k.map(v => Math.max(0, v / m))); } glad.uit = r.uit;
    ctx.clearRect(0, 0, this.B, this.H);
    // opbouw bij het openen: het net verschijnt van links naar rechts
    const op = RUSTIG ? 1 : Math.min(1, (t - this.opbouwT0) / 1400);
    if (op < 1) { ctx.save(); ctx.beginPath(); if (this.staand) ctx.rect(0, 0, this.B, this.H * op); else ctx.rect(0, 0, this.B * op, this.H); ctx.clip(); }
    ctx.drawImage(this.stil, 0, 0);
    this.tekenLicht(glad);
    if (op < 1) ctx.restore();
    if (this.opAntwoord) { const ant = w.antwoord || "", n = Math.max(1, Math.round(ant.length * (this.rij + 1) / w.lagen.length)); this.opAntwoord(ant.slice(0, n)); }
    this.loop = requestAnimationFrame(tt => this.beeld(tt));
  };
  P.start = function () { if (this.aan || !this.w) return; this.aan = true; this.opbouwT0 = performance.now(); this.vezelMaat = ""; this.loop = requestAnimationFrame(t => this.beeld(t)); };
  P.stop = function () { this.aan = false; if (this.loop) cancelAnimationFrame(this.loop); this.loop = null; };

  window.Weefsel = Weefsel;
})();
