/* Harvest Star engine
 * NASA POWER daily weather -> rain tuned to the national weather service -> FAO-56 evapotranspiration
 * -> Met Éireann hybrid soil moisture deficit model -> days fit to sow in each Teagasc window
 * -> replay rotations through every season on record.
 * Works in the browser and in Node (for testing).
 */
(function (root) {
  'use strict';

  // ---------- Crops (Teagasc Crop Costs and Returns 2025; Teagasc sowing windows; S.I. 113 of 2022) ----------
  // win: sowing window [month, day] start/end. autumn: window falls in the autumn before harvest.
  // margin: €/ha gross margin incl. straw at the yield used. n1/n2: N kg/ha at soil N index 1 / 2.
  const CROPS = {
    wosr: { name: 'Winter oilseed rape', short: 'Oilseed rape', autumn: true, win: [[8, 15], [9, 10]], yield: '4.5 t/ha', margin: 659, n1: 225, n2: 180,
      winter: true, brk: true, legume: false, cereal: false, family: 'brassica', breakYears: 3, months: [8, 7],
      why: 'Oilseed rape breaks the take-all cycle, so the wheat after it yields 0.5 to 1.5 t/ha more.', soilLine: 'Deep tap roots open up the subsoil, and it stays green over winter.' },
    ww: { name: 'Winter wheat', short: 'Winter wheat', autumn: true, win: [[9, 21], [11, 10]], yield: '10 t/ha', margin: 619, n1: 210, n2: 180,
      winter: true, cereal: true, family: 'wheat', months: [10, 8], price: 210,
      why: 'Winter wheat pays best of the cereals, and its long sowing window can wait out a wet spell.', soilLine: 'Green over winter, which holds nutrients in the soil.' },
    wb: { name: 'Winter barley', short: 'Winter barley', autumn: true, win: [[9, 21], [10, 10]], yield: '9 t/ha', margin: 452, n1: 180, n2: 155,
      winter: true, cereal: true, family: 'barley', months: [10, 7], price: 200,
      why: 'Winter barley is harvested early, leaving time to sow oilseed rape or a cover crop after it.', soilLine: 'Green over winter.' },
    wo: { name: 'Winter oats', short: 'Winter oats', autumn: true, win: [[10, 1], [11, 10]], yield: '8 t/ha', margin: 432, n1: 135, n2: 110,
      winter: true, cereal: true, family: 'oats', months: [10, 8], price: 195,
      why: 'Oats don\'t carry take-all, so they act as a part break between wheat crops.', soilLine: 'Green over winter, and a different cereal family.' },
    sb: { name: 'Spring barley', short: 'Spring barley', autumn: false, win: [[3, 1], [4, 15]], yield: '7.5 t/ha', margin: 413, n1: 135, n2: 100,
      cereal: true, family: 'barley', months: [3, 8], price: 200,
      why: 'Spring barley is the safe, low-cost crop: it misses its sowing window less than any other.', soilLine: 'Bare over winter unless a cover crop goes in after harvest.' },
    so: { name: 'Spring oats', short: 'Spring oats', autumn: false, win: [[2, 15], [4, 15]], yield: '7.5 t/ha', margin: 392, n1: 125, n2: 100,
      cereal: true, family: 'oats', months: [3, 8], price: 195,
      why: 'Spring oats need less fertiliser and spray than barley and don\'t carry take-all.', soilLine: 'A different cereal family, which breaks some disease cycles.' },
    sbe: { name: 'Spring beans', short: 'Beans', autumn: false, win: [[2, 1], [3, 15]], yield: '4.5 t/ha', margin: 513, n1: 0, n2: 0,
      brk: true, legume: true, family: 'legume', breakYears: 3, months: [2, 9],
      why: 'Beans fix their own nitrogen, need no nitrogen fertiliser, and earn the protein payment.', soilLine: 'Fix nitrogen from the air and leave some for the next crop.' },
    mz: { name: 'Maize (open sown)', short: 'Maize', autumn: false, win: [[4, 20], [5, 15]], yield: '40 t/ha fresh', margin: 1046, n1: 180, n2: 155,
      brk: true, family: 'maize', months: [5, 10], heatNeed: 2300,
      why: 'Maize earns well when there is a buyer for silage nearby, and breaks the cereal disease cycle.', soilLine: 'Late harvest leaves soil bare and open to damage in a wet autumn.' },
    bt: { name: 'Fodder beet', short: 'Beet', autumn: false, win: [[3, 15], [4, 30]], yield: '65 t/ha fresh', margin: 1263, n1: 160, n2: 135,
      brk: true, family: 'beet', breakYears: 3, months: [4, 11], frostTender: true,
      why: 'Beet gives the highest margin per hectare when there is a livestock buyer close by.', soilLine: 'A break crop, but harvest in November can damage wet soil.' }
  };
  // Fodder crops. dm: tonnes of dry matter utilised per hectare. dry: share of yield lost if every growing day were drought-limited (starting assumption).
  // Margins for the three below value fodder at €260 a tonne of dry matter (Teagasc's worked example for valuing silage) less Teagasc's cost to grow it.
  Object.assign(CROPS, {
    gs: { name: 'Grass silage (two cuts)', short: 'Grass silage', autumn: true, win: [[8, 1], [9, 10]], yield: '7.7 t DM/ha utilised', margin: 293, n1: 200, n2: 200,
      winter: true, brk: true, family: 'grass', months: [8, 8], dm: 7.7, dry: 1.0, fodder: true,
      why: 'A grass ley fills the pit for winter, rests the ground from cereals and builds soil for the crops after it.', soilLine: 'Green all year. Roots and residues build organic matter, and the next crop needs less nitrogen.' },
    rc: { name: 'Red clover silage (three cuts)', short: 'Red clover silage', autumn: true, win: [[8, 1], [9, 10]], yield: '10 t DM/ha utilised', margin: 400, n1: 0, n2: 0,
      winter: true, brk: true, legume: true, family: 'clover', months: [8, 8], dm: 10, dry: 0.6, fodder: true,
      why: 'Red clover silage needs no bought nitrogen, yields more than grass and its deep root copes better in a dry summer.', soilLine: 'Fixes its own nitrogen, green all year, and a deep tap root opens the soil.' },
    kale: { name: 'Kale (grazed over winter)', short: 'Kale', autumn: false, win: [[5, 15], [7, 10]], yield: '6 t DM/ha', margin: 672, n1: 120, n2: 100,
      winter: true, brk: true, family: 'brassica', breakYears: 4, months: [6, 2], dm: 6, dry: 0.7, fodder: true,
      why: 'Kale is cheap winter feed grazed in the field, so nothing has to be cut, drawn or stored.', soilLine: 'Green over winter, but grazing it in wet weather can poach the ground.' }
  });
  CROPS.mz.dm = 11.1; CROPS.mz.dry = 0.4; CROPS.bt.dm = 12; CROPS.bt.dry = 0.4;
  // Ontario (crop) heat units from NASA daily max/min, scaled so NASA matches Teagasc's published 2,383 at Oak Park (1 May–30 Sep, 2005–2021); NASA alone gives 2,038 there.
  const CHU_SCALE = 2383 / 2038, CHU_OPEN = 2300, CHU_MARGINAL = 2100;
  const inGround = (c, m) => { const cr = CROPS[c], a = cr.months[0], b = cr.months[1]; if (cr.autumn || b < a) return a === b ? true : (m >= a || m <= b); return m >= a && m <= b; };
  const FODDER_VALUE = 260, DRY_SMD = 50; // € per tonne DM; soil moisture deficit (mm) above which growth is held back
  const SB_LATE_MARGIN = 213; // spring barley at 6.5 t/ha (Teagasc 2025)
  const TAKEALL_PENALTY = 210; // 1 t/ha of wheat lost after a cereal

  // ---------- Small helpers ----------
  const DAY = 86400000;
  function ymd(s) { return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))); }
  function doy(d) { return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1; }
  const median = a => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

  // ---------- Rain tuning against the national rain map ----------
  function lookupGrid(grid, lat, lon) {
    if (!grid) return null;
    const i0 = Math.round((lat - grid.lat0) / grid.dlat), j0 = Math.round((lon - grid.lon0) / grid.dlon);
    for (let r = 0; r <= 3; r++) {
      let best = null, bd = 1e9;
      for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) {
        if (i < 0 || j < 0 || i >= grid.nlat || j >= grid.nlon) continue;
        const g = grid.g[i * grid.nlon + j];
        if (g) { const d = (i - i0) ** 2 + (j - j0) ** 2; if (d < bd) { bd = d; best = g; } }
      }
      if (best) return best;
    }
    return null;
  }

  // ---------- FAO-56 Penman-Monteith reference evapotranspiration ----------
  function et0(tmax, tmin, tdew, u2, rs, pkpa, lat, j, z) {
    const tmean = (tmax + tmin) / 2;
    const es = (t) => 0.6108 * Math.exp(17.27 * t / (t + 237.3));
    const esat = (es(tmax) + es(tmin)) / 2, ea = Math.min(es(tdew), esat);
    const delta = 4098 * es(tmean) / Math.pow(tmean + 237.3, 2);
    const gamma = 0.000665 * pkpa;
    const phi = lat * Math.PI / 180, dr = 1 + 0.033 * Math.cos(2 * Math.PI * j / 365), dec = 0.409 * Math.sin(2 * Math.PI * j / 365 - 1.39);
    const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))));
    const ra = 24 * 60 / Math.PI * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
    const rso = (0.75 + 2e-5 * z) * ra;
    const rns = 0.77 * rs;
    const ratio = rso > 0 ? Math.min(1, rs / rso) : 0.5;
    const rnl = 4.903e-9 * (Math.pow(tmax + 273.16, 4) + Math.pow(tmin + 273.16, 4)) / 2 * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * ratio - 0.35);
    const rn = rns - rnl;
    const v = (0.408 * delta * rn + gamma * 900 / (tmean + 273) * u2 * (esat - ea)) / (delta + gamma * (1 + 0.34 * u2));
    return Math.max(0, v);
  }

  // ---------- Prepare a weather record from a NASA POWER daily point response ----------
  function prepareWeather(power, opts) {
    opts = opts || {};
    const P = power.properties.parameter;
    const [lon, lat, elev] = power.geometry.coordinates;
    const keys = Object.keys(P.PRECTOTCORR).sort();
    const fill = (power.header && power.header.fill_value) || -999;
    const days = [];
    for (const k of keys) {
      const d = ymd(k);
      const rec = { k, d, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, dd: d.getUTCDate(), j: doy(d),
        rain: P.PRECTOTCORR[k], tmax: P.T2M_MAX[k], tmin: P.T2M_MIN[k], tdew: P.T2MDEW[k], u2: P.WS2M[k], rs: P.ALLSKY_SFC_SW_DWN[k], ps: P.PS[k] };
      if ([rec.rain, rec.tmax, rec.tmin].some(v => v === fill || v == null)) continue; // drop trailing days with no data
      days.push(rec);
    }
    // fill any missing solar / dew / wind / pressure with that day-of-year average
    const fields = ['tdew', 'u2', 'rs', 'ps'];
    const clim = {}; fields.forEach(f => clim[f] = new Array(367).fill(0).map(() => [0, 0]));
    days.forEach(r => fields.forEach(f => { if (r[f] !== fill && r[f] != null) { clim[f][r.j][0] += r[f]; clim[f][r.j][1]++; } }));
    days.forEach(r => fields.forEach(f => { if (r[f] === fill || r[f] == null) { const c = clim[f][r.j]; r[f] = c[1] ? c[0] / c[1] : (f === 'ps' ? 101 : f === 'u2' ? 3 : f === 'rs' ? 8 : r.tmin); r.filled = true; } }));

    // Rain tuning: scale each month's rain so 1991–2020 averages match the national 1 km map
    const normals = opts.rainNormals || null; // 12 monthly mm
    const powerMonthly = new Array(12).fill(0), counts = {};
    days.forEach(r => { if (r.y >= 1991 && r.y <= 2020) { powerMonthly[r.m - 1] += r.rain; counts[r.y + '-' + r.m] = 1; } });
    const nYears = new Set(days.filter(r => r.y >= 1991 && r.y <= 2020).map(r => r.y)).size || 1;
    const powerNorm = powerMonthly.map(v => v / nYears);
    const factor = normals ? normals.map((n, i) => powerNorm[i] > 0 ? n / powerNorm[i] : 1) : new Array(12).fill(1);
    days.forEach(r => { r.rainT = r.rain * factor[r.m - 1]; });
    days.forEach(r => { r.et0 = et0(r.tmax, r.tmin, r.tdew, r.u2, r.rs, r.ps, lat, r.j, elev || 50); });
    const powerAnnual = powerNorm.reduce((a, b) => a + b, 0), mapAnnual = normals ? normals.reduce((a, b) => a + b, 0) : null;
    return { lat, lon, elev, days, factor, powerNorm, normals, powerAnnual, mapAnnual,
      first: days[0].k, last: days[days.length - 1].k };
  }

  // ---------- Met Éireann hybrid soil moisture deficit model ----------
  // SMD > 0: drier than field capacity. SMD < 0: surplus water, down to -10 mm at saturation.
  function runSMD(wx, drainage, cutoff) {
    let smd = 0; const SMAX = 110;
    const out = new Float32Array(wx.days.length * 2); // start-of-day SMD, end-of-day SMD
    wx.days.forEach((r, i) => {
      const start = smd;
      const aet = smd <= 0 ? r.et0 : r.et0 * Math.max(0, (SMAX - smd) / SMAX);
      smd = smd - r.rainT + aet;
      if (smd > SMAX) smd = SMAX;
      if (drainage === 'well') { if (smd < 0) smd = 0; }
      else if (drainage === 'moderate') { if (smd < -10) smd = -10; if (smd < 0 && r.rainT < cutoff) smd = 0; }
      else { if (smd < -10) smd = -10; if (smd < 0) smd = Math.min(0, smd + 0.5); } // poorly drained: sheds ~0.5 mm a day
      out[i * 2] = start; out[i * 2 + 1] = smd;
    });
    return out;
  }

  // ---------- Season-by-season sowing record for every crop ----------
  function inWindow(r, win) {
    const v = r.m * 100 + r.dd, a = win[0][0] * 100 + win[0][1], b = win[1][0] * 100 + win[1][1];
    return v >= a && v <= b;
  }

  function analyse(wx, settings) {
    const s = Object.assign({ drainage: 'moderate', cutoff: 1.77, minDays: 5, smdLimit: 0 }, settings || {});
    const smd = runSMD(wx, s.drainage, s.cutoff);
    const lastDate = wx.days[wx.days.length - 1].d;
    // harvest year index: autumn windows belong to next year's harvest
    const seasons = {}; // crop -> {harvestYear: fitDays}
    Object.keys(CROPS).forEach(c => seasons[c] = {});
    const fitFlag = new Uint8Array(wx.days.length);
    wx.days.forEach((r, i) => {
      const fit = r.rainT < s.cutoff && smd[i * 2] >= s.smdLimit;
      fitFlag[i] = fit ? 1 : 0;
      for (const c in CROPS) {
        const cr = CROPS[c];
        if (!inWindow(r, cr.win)) continue;
        const hy = cr.autumn ? r.y + 1 : r.y;
        seasons[c][hy] = (seasons[c][hy] || 0) + (fit ? 1 : 0);
      }
    });
    // keep only complete windows
    for (const c in CROPS) {
      const cr = CROPS[c];
      for (const hy in seasons[c]) {
        const endY = cr.autumn ? +hy - 1 : +hy;
        const end = Date.UTC(endY, cr.win[1][0] - 1, cr.win[1][1]);
        const startY = endY; const st = Date.UTC(startY, cr.win[0][0] - 1, cr.win[0][1]);
        if (end > lastDate || st < wx.days[0].d) delete seasons[c][hy];
      }
    }
    // Weather for season lights: frost, warmth, summer dryness
    const years = {}, clim = {};
    wx.days.forEach((r, i) => {
      const Y = years[r.y] || (years[r.y] = { chu: 0, gdd: 0, lastSpringFrost: null, firstAutumnFrost: null, peakSMD: 0, julRain: 0, n: 0, dryDays: 0, growDays: 0 });
      if (r.m >= 4 && r.m <= 9) { Y.growDays++; if (smd[i * 2 + 1] > DRY_SMD) Y.dryDays++; }
      Y.n++;
      if (r.m >= 5 && r.m <= 9) { Y.gdd += Math.max(0, (r.tmax + r.tmin) / 2 - 6); Y.chu += ((r.tmax > 10 ? 3.33 * (r.tmax - 10) - 0.084 * (r.tmax - 10) ** 2 : 0) + (r.tmin > 4.4 ? 1.8 * (r.tmin - 4.4) : 0)) / 2 * CHU_SCALE; }
      const mc = clim[r.m] || (clim[r.m] = { et0: 0, rain: 0 }); mc.et0 += r.et0; mc.rain += r.rainT;
      if (r.tmin < 0 && r.m <= 6) Y.lastSpringFrost = r.j;
      if (r.tmin < 0 && r.m >= 8 && Y.firstAutumnFrost == null) Y.firstAutumnFrost = r.j;
      if (r.m >= 5 && r.m <= 9) Y.peakSMD = Math.max(Y.peakSMD, smd[i * 2 + 1]);
      if (r.m === 7) Y.julRain += r.rainT;
    });
    const fullYears = Object.keys(years).filter(y => years[y].n >= 360).map(Number);
    Object.keys(years).forEach(y => { years[y].dryFrac = years[y].growDays ? years[y].dryDays / years[y].growDays : 0; });
    // the current year counts for drought once the growing season is over
    const nY = wx.days.length / 365.25; for (const m in clim) { clim[m].et0 /= nY; clim[m].rain /= nY; }
    const droughtYears = Object.keys(years).map(Number).filter(y => years[y].growDays >= 180).sort((a, b) => a - b);
    return { settings: s, seasons, years, fullYears, droughtYears, clim, smd, fitFlag, wx };
  }

  // per-crop summary
  function cropStats(an, c, lastN) {
    const se = an.seasons[c]; const hys = Object.keys(se).map(Number).sort((a, b) => a - b);
    const use = lastN ? hys.slice(-lastN) : hys;
    const missed = use.filter(h => se[h] < an.settings.minDays);
    return { seasons: use.length, missed, missedN: missed.length, typical: median(use.map(h => se[h])), byYear: se, years: use };
  }

  // ---------- Rotation scoring ----------
  function nIndexAfter(prev) { return prev && ['wosr', 'sbe', 'gs', 'rc'].includes(prev) ? 2 : 1; }

  function diseaseCheck(rot, history) {
    // seq: history (oldest -> newest) then the plan repeated, so the plan meets the farm's real past and its own repeat
    const hist = (history || []).filter(Boolean);
    const seq = hist.concat(rot, rot);
    const issues = []; let level = 0;
    const add = (lv, msg) => { if (!issues.includes(msg)) issues.push(msg); level = Math.max(level, lv); };
    for (let i = hist.length; i < hist.length + rot.length * 2; i++) {
      const c = seq[i], p = seq[i - 1], cr = CROPS[c];
      if (!cr) continue;
      if (c === 'ww' && p === 'ww') add(2, 'Wheat after wheat: take-all builds up in second wheats.');
      else if (c === 'ww' && p && CROPS[p] && CROPS[p].cereal && p !== 'wo' && p !== 'so') add(1, 'Wheat after barley carries some take-all risk.');
      if (cr.cereal && p === c && c !== 'ww') add(1, cr.short + ' after ' + cr.short.toLowerCase() + ' builds up its own diseases.');
      if (cr.breakYears) {
        for (let k = 1; k <= cr.breakYears; k++) if (i - k >= 0 && seq[i - k] === c) {
          const why = c === 'wosr' ? ' (clubroot, sclerotinia).' : c === 'kale' ? ' (clubroot).' : c === 'bt' ? ' (beet cyst nematode).' : ' (foot and root rots).';
          if (k < cr.breakYears) add(2, cr.short + ' back every ' + k + ' years: it needs at least ' + cr.breakYears + ' years between crops' + why);
          else add(1, cr.short + ' every ' + k + ' years is the shortest safe gap; disease builds if it slips' + why);
          break;
        }
      }
    }
    const tags = [];
    rot.forEach((c, i) => { const p = rot[(i + rot.length - 1) % rot.length]; if (c === 'ww' && p && CROPS[p].brk) tags.push('breaks take-all'); if (c === 'sbe') tags.push('fixes nitrogen'); if (CROPS[c].family === 'oats' && rot.some(x => CROPS[x].family === 'wheat')) tags.push('oats break wheat diseases'); });
    return { level, issues, tags: [...new Set(tags)] };
  }

  function scoreRotation(an, rot, opts) {
    opts = opts || {};
    const history = opts.history || [];
    const constraints = opts.constraints || {};
    const cover = !!opts.coverCrops;
    const lastN = opts.lastN || 10;
    const L = rot.length;
    // weather: replay from every phase across every season on record
    let planned = 0, missed = 0, marginSum = 0, nSum = 0;
    const missYearsLastN = {};
    const perCrop = rot.map(c => cropStats(an, c));
    const perCropLast = rot.map(c => cropStats(an, c, lastN));
    // margin and nitrogen, with weather losses: a missed crop goes in as spring barley
    rot.forEach((c, i) => {
      const prev = rot[(i + L - 1) % L];
      const st = perCrop[i];
      const share = st.seasons ? st.missedN / st.seasons : 0;
      let m = CROPS[c].margin;
      if (c === 'ww' && CROPS[prev].cereal && prev !== 'wo' && prev !== 'so') m -= TAKEALL_PENALTY;
      const sbMiss = cropStats(an, 'sb'); const sbShare = sbMiss.seasons ? sbMiss.missedN / sbMiss.seasons : 0;
      const fallback = (1 - sbShare) * CROPS.sb.margin + sbShare * SB_LATE_MARGIN;
      const mm = c === 'sb' ? (1 - share) * m + share * SB_LATE_MARGIN : (1 - share) * m + share * fallback;
      marginSum += mm;
      const idx = nIndexAfter(prev);
      nSum += idx === 2 ? CROPS[c].n2 : CROPS[c].n1;
      planned += st.seasons; missed += st.missedN;
      perCropLast[i].missed.forEach(y => missYearsLastN[y] = (missYearsLastN[y] || []).concat(c));
    });
    // fodder grown, after drought: each fodder crop loses yield in proportion to the share of April–September days the soil was too dry to grow
    const dY = an.droughtYears, avgDry = dY.length ? dY.reduce((a, y) => a + an.years[y].dryFrac, 0) / dY.length : 0;
    const fCrops = rot.filter(c => CROPS[c].dm);
    const potential = fCrops.reduce((a, c) => a + CROPS[c].dm, 0) / L;
    const fodYear = {}; dY.forEach(y => { fodYear[y] = fCrops.reduce((a, c) => a + CROPS[c].dm * (1 - CROPS[c].dry * an.years[y].dryFrac), 0) / L; });
    const fodder = dY.length ? dY.reduce((a, y) => a + fodYear[y], 0) / dY.length : potential;
    const shortYears = potential > 0 ? dY.filter(y => fodYear[y] < 0.9 * potential) : [];
    const lastD = dY.slice(-lastN), shortLast = shortYears.filter(y => lastD.includes(y));
    rot.forEach(c => { if (CROPS[c].fodder) marginSum -= FODDER_VALUE * CROPS[c].dm * CROPS[c].dry * avgDry; });
    const margin = marginSum / L, nitrogen = nSum / L;
    const missShare = planned ? missed / planned : 0;
    const lastShare = perCropLast.reduce((a, s) => a + (s.seasons ? s.missedN / s.seasons : 0), 0) / L;
    const struggleIn = Math.round(lastShare * lastN);
    // soil points: up to 4 a year
    let pts = 0;
    rot.forEach((c, i) => {
      const prev = rot[(i + L - 1) % L], cr = CROPS[c];
      if (cr.winter || (cover && !cr.winter && c !== 'mz' && c !== 'bt')) pts++;
      if (cr.brk) pts++;
      if (cr.legume) pts++;
      if (cr.cereal && CROPS[prev] && CROPS[prev].family !== cr.family) pts++;
    });
    const soil = Math.round(pts / (4 * L) * 100);
    // the four lights: 0 green, 1 amber, 2 red
    const worstCropShare = Math.max(...perCrop.map(s => s.seasons ? s.missedN / s.seasons : 0));
    const dryYears = an.fullYears.filter(y => an.years[y].peakSMD >= 75);
    const springCrops = rot.filter(c => !CROPS[c].autumn).length;
    let water = worstCropShare >= 0.25 ? 2 : worstCropShare >= 0.08 ? 1 : 0;
    const waterNotes = [];
    rot.forEach((c, i) => { const st = perCrop[i]; if (st.missedN) waterNotes.push(CROPS[c].short + ' missed its sowing window in ' + st.missedN + ' of ' + st.seasons + ' seasons.'); });
    if (dryYears.length >= 3 && springCrops && water === 0) { water = 1; }
    if (potential > 0 && dY.length) {
      const sh = shortYears.length / dY.length;
      if (sh >= 0.25) water = 2; else if (sh >= 0.1) water = Math.max(water, 1);
      if (shortYears.length) { const w = shortYears.slice().sort((a, b) => fodYear[a] - fodYear[b])[0];
        waterNotes.unshift('Dry summers would have left you short of fodder in ' + shortYears.length + ' of ' + dY.length + ' years. Worst: ' + w + ', about ' + Math.round((1 - fodYear[w] / potential) * 100) + '% down.'); }
    }
    if (dryYears.length) waterNotes.push('Summer soil got very dry (deficit over 75 mm) in ' + dryYears.length + ' of ' + an.fullYears.length + ' years' + (springCrops ? ', which hits spring crops hardest.' : '.'));
    const dis = diseaseCheck(rot, history);
    let market = 0; const marketNotes = [];
    rot.forEach(c => {
      if ((c === 'mz' || c === 'bt') && constraints.noLivestockBuyer && !constraints.ownStock) { market = 2; marketNotes.push('No livestock buyer nearby for ' + CROPS[c].short.toLowerCase() + '.'); }
      if (c === 'bt' && constraints.noBeetKit) { market = 2; marketNotes.push('No beet harvester or contractor.'); }
      if (c === 'sbe' && constraints.noBeanBuyer) { market = 2; marketNotes.push('No buyer for beans nearby.'); }
      if (c === 'wosr' && constraints.noOsrBuyer) { market = 2; marketNotes.push('No oilseed rape buyer.'); }
      if (CROPS[c].fodder && !constraints.ownStock && market < 1) { market = 1; marketNotes.push(CROPS[c].short + ' only pays if you have stock to feed or a buyer lined up.'); }
      if ((c === 'mz' || c === 'bt') && !constraints.noLivestockBuyer && !constraints.ownStock && market < 1) { market = 1; marketNotes.push(CROPS[c].short + ' only pays with a buyer for it close by.'); }
    });
    if (!marketNotes.length) marketNotes.push('All crops sell into the usual Irish markets.');
    let season = 0; const seasonNotes = [];
    rot.forEach(c => {
      const cr = CROPS[c];
      if (cr.heatNeed) {
        const g = an.fullYears.map(y => an.years[y].chu), low = g.filter(v => v < CHU_MARGINAL).length, short = g.filter(v => v < CHU_OPEN).length;
        const avgC = g.reduce((a, v) => a + v, 0) / (g.length || 1);
        if (low / g.length > 0.5) season = Math.max(season, 2); else if (short / g.length > 0.3) season = Math.max(season, 1);
        seasonNotes.push('Maize sown in the open wants about 2,300 heat units. This field averages ' + Math.round(avgC / 10) * 10 + ' and fell short in ' + short + ' of ' + g.length + ' years' + (short / g.length > 0.3 ? ', so pick an early variety or sow under film.' : '.'));
      }
      if (cr.frostTender) {
        const late = an.fullYears.filter(y => an.years[y].lastSpringFrost && an.years[y].lastSpringFrost > 105).length;
        if (late / an.fullYears.length > 0.3) { season = Math.max(season, 1); }
        seasonNotes.push('Frost after mid-April in ' + late + ' of ' + an.fullYears.length + ' years can hit young beet.');
      }
    });
    if (!seasonNotes.length) seasonNotes.push('Every crop in this plan suits the length and warmth of this field\'s growing season.');
    // crop characteristics named in the challenge brief
    let need = 0, got = 0, om = 0;
    rot.forEach(c => { for (let m = 3; m <= 9; m++) if (inGround(c, m) && an.clim[m]) { need += an.clim[m].et0; got += Math.min(an.clim[m].rain, an.clim[m].et0); }
      const cr = CROPS[c]; om += (c === 'gs' || c === 'rc') ? 2 : (cr.winter || cr.legume) ? 1 : cr.cereal ? 0.5 : 0; if (cover && !cr.winter && c !== 'mz' && c !== 'bt') om += 0.5; });
    const traits = { waterNeed: Math.round(need / L), waterMet: need ? Math.round(got / need * 100) : 100, nfix: rot.filter(c => CROPS[c].legume).length, om: om / L };
    return {
      traits,
      rot, margin: Math.round(margin), nitrogen: Math.round(nitrogen), soil, missShare, struggleIn, lastN,
      fodder, potential, shortYears, shortLast, fodYear, hasFodder: potential > 0,
      missYearsLastN, perCrop, perCropLast,
      lights: { water, disease: dis.level, market, season },
      notes: { water: waterNotes.length ? waterNotes : ['Every crop got enough days fit to sow in every season on record.'], disease: dis.issues.length ? dis.issues : ['No crop follows itself or a close relative too soon.'], market: marketNotes, season: seasonNotes },
      tags: dis.tags
    };
  }

  function rankPlans(plans, priority) {
    const best = Math.max(...plans.map(p => p.margin)), leanest = Math.min(...plans.map(p => p.nitrogen));
    const w = { profit: 1, fertiliser: 1, soil: 1, risk: 1, fodder: 0 }; if (priority && w[priority] != null) w[priority] = 3;
    const maxFod = Math.max(0.001, ...plans.map(p => p.fodder || 0));
    plans.forEach(p => {
      const lightPenalty = Object.values(p.lights).reduce((a, v) => a + (v === 2 ? 15 : v === 1 ? 4 : 0), 0);
      p.scores = { profit: Math.round(p.margin / best * 100), fertiliser: Math.round(p.nitrogen ? Math.min(100, leanest / p.nitrogen * 100) : 100), soil: p.soil, risk: Math.round((1 - p.missShare) * 100), fodder: Math.round((p.fodder || 0) / maxFod * 100) };
      const tot = w.profit + w.fertiliser + w.soil + w.risk + w.fodder;
      p.overall = Math.max(0, Math.round((p.scores.profit * w.profit + p.scores.fertiliser * w.fertiliser + p.scores.soil * w.soil + p.scores.risk * w.risk + p.scores.fodder * w.fodder) / tot - lightPenalty));
    });
    return plans;
  }

  const LIBRARY = [
    ['sb', 'sb', 'sb'], ['wosr', 'ww', 'wb'], ['sb', 'sbe', 'ww'], ['sbe', 'ww', 'sb'], ['wosr', 'ww', 'so'],
    ['ww', 'so', 'sb'], ['sbe', 'ww', 'wb'], ['wosr', 'ww', 'sb'], ['sb', 'so', 'sbe'], ['bt', 'ww', 'sb'],
    ['mz', 'sb', 'sbe'], ['sbe', 'ww', 'wo'], ['wb', 'wosr', 'ww'],
    ['gs', 'gs', 'ww'], ['rc', 'rc', 'ww'], ['gs', 'gs', 'mz'], ['rc', 'rc', 'mz'], ['mz', 'ww', 'gs'], ['bt', 'sb', 'gs'], ['kale', 'sb', 'gs'], ['gs', 'gs', 'gs'], ['rc', 'rc', 'sb'], ['mz', 'mz', 'gs']
  ];

  function rotName(rot) {
    const key = rot.join('-');
    const named = { 'sb-sb-sb': 'Spring barley every year', 'wosr-ww-wb': 'Winter rotation', 'sb-sbe-ww': 'Spring rotation with beans' };
    if (named[key]) return named[key];
    if (rot.every(c => c === rot[0])) return CROPS[rot[0]].short + ' every year';
    return rot.map(c => CROPS[c].short).join(' → ');
  }

  function buildOptions(an, current, opts) {
    const cur = scoreRotation(an, current, opts); cur.current = true;
    const stock = !!(opts.constraints && opts.constraints.ownStock);
    const cands = LIBRARY.filter(r => r.join() !== current.join() && (stock || !r.some(c => CROPS[c].fodder))).map(r => scoreRotation(an, r, opts));
    const all = rankPlans([cur].concat(cands), opts.priority);
    const alts = all.filter(p => !p.current && p.lights.market < 2).sort((a, b) => b.overall - a.overall);
    // two alternatives that differ in character
    const picked = [];
    for (const p of alts) { if (picked.length === 2) break; if (picked.some(q => q.rot.slice().sort().join() === p.rot.slice().sort().join())) continue; picked.push(p); }
    const shown = rankPlans([cur].concat(picked), opts.priority);
    shown.forEach(p => p.name = rotName(p.rot));
    return shown;
  }

  const api = { CROPS, LIBRARY, lookupGrid, prepareWeather, analyse, cropStats, scoreRotation, rankPlans, buildOptions, rotName, et0, runSMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HSEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
