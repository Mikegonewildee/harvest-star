/* Harvest Star app: home, my field, my plan, what's changed, how it works */
(function () {
  'use strict';
  const E = window.HSEngine, C = E.CROPS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = (n) => '€' + Math.round(n).toLocaleString('en-IE');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CHEV = '<svg class="ico chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const FICO = '<svg class="ico" viewBox="0 0 38 24" aria-hidden="true"><path d="M2 20L12 6M10 20L20 6M18 20L28 6M26 20L36 6M12 6h24"/></svg>';

  const state = { field: null, example: null, saved: [], history: ['sb', 'sb', 'sb'], drainage: 'moderate', priority: 'balanced',
    scenario: 'recorded', wx: null, grid: null, an: null, base: null, plans: null, ranked: null, barCrop: null, after: null };

  const DRAIN = [
    { k: 'well', label: 'Dries fast', long: 'free-draining', note: 'Light or gravelly ground. Never stays waterlogged.' },
    { k: 'moderate', label: 'Normal', long: 'moderately drained', note: 'Most tillage ground. Wet after heavy rain, fine a day later.' },
    { k: 'poor', label: 'Heavy, stays wet', long: 'heavy', note: 'Heavy clay or a high water table. Stays wet for days after rain.' }
  ];
  const PRIO = [
    { k: 'balanced', label: 'A bit of everything' }, { k: 'profit', label: 'Profit' }, { k: 'fertiliser', label: 'Less fertiliser' },
    { k: 'soil', label: 'Better soil' }, { k: 'risk', label: 'Low risk' }, { k: 'fodder', label: 'Winter fodder' }
  ];
  const SCEN = [
    { k: 'recorded', label: 'As it was', note: 'The real weather over this field since 1984.' },
    { k: 'wetAutumn', label: 'Wetter autumns', note: 'Same years, with a fifth more rain every September to November.' },
    { k: 'wetSpring', label: 'Wetter springs', note: 'Same years, with a fifth more rain every February to April.' },
    { k: 'drier', label: 'Drier all round', note: 'Same years, with 15% less rain in every month.' }
  ];
  const HIST_YEARS = (() => { const d = new Date(), y = d.getFullYear(); const last = d.getMonth() >= 8 ? y : y - 1; return [last - 2, last - 1, last]; })();
  const CROP_ORDER = ['sb', 'ww', 'wb', 'wosr', 'sbe', 'so', 'wo', 'mz', 'bt', 'gs', 'rc', 'kale'];

  function chips(el, list, cur, onPick) {
    el.innerHTML = '';
    list.forEach(o => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = o.label;
      b.setAttribute('aria-pressed', o.k === cur ? 'true' : 'false'); b.onclick = () => onPick(o.k); el.appendChild(b);
    });
  }
  function renderInputs() {
    chips($('drainChips'), DRAIN, state.drainage, k => { state.drainage = k; renderInputs(); if (state.wx) recompute(); });
    $('drainNote').textContent = DRAIN.find(d => d.k === state.drainage).note;
    chips($('prioChips'), PRIO, state.priority, k => { state.priority = k; renderInputs(); if (state.wx) recompute(); });
    const hs = $('histSel'); hs.innerHTML = '';
    HIST_YEARS.forEach((y, i) => {
      const lab = document.createElement('label'); lab.className = 'field'; lab.textContent = String(y);
      const sel = document.createElement('select');
      CROP_ORDER.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = C[c].short; if (state.history[i] === c) o.selected = true; sel.appendChild(o); });
      sel.onchange = () => { state.history[i] = sel.value; if (state.wx) recompute(); };
      lab.appendChild(sel); hs.appendChild(lab);
    });
  }

  // ---------- saved fields ----------
  function loadSaved() { try { state.saved = JSON.parse(localStorage.getItem('hs_fields') || '[]'); } catch (e) { state.saved = []; } }
  function storeSaved() { try { localStorage.setItem('hs_fields', JSON.stringify(state.saved)); } catch (e) { } }
  function removeField(i) { state.saved.splice(i, 1); storeSaved(); renderHome(); }
  function clearFields() { state.saved = []; try { localStorage.removeItem('hs_fields'); } catch (e) { } renderHome(); }
  function saveField(f) {
    if (f.example) return;
    if (!state.saved.some(s => Math.abs(s.lat - f.lat) < 0.002 && Math.abs(s.lon - f.lon) < 0.002)) {
      const nums = state.saved.map(s => +(String(s.label).match(/(\d+)$/) || [0, 0])[1]);
      state.saved.unshift({ lat: f.lat, lon: f.lon, label: 'My field ' + (Math.max(0, ...nums) + 1), history: state.history.slice(), drainage: state.drainage });
      state.saved = state.saved.slice(0, 4);
      storeSaved();
    }
    renderHome();
  }
  function renderHome() {
    const list = $('fieldList'); list.innerHTML = '';
    const rows = [];
    if (state.example) rows.push({ label: 'Example field – ' + state.example.areaHa + ' ha', f: Object.assign({ example: true }, state.example) });
    state.saved.forEach((s, i) => rows.push({ label: s.label, f: s, i }));
    rows.forEach(r => {
      const wrap = document.createElement('div'); wrap.className = 'fwrap';
      const b = document.createElement('button'); b.className = 'frow'; b.type = 'button'; b.innerHTML = FICO + '<span>' + esc(r.label) + '</span>' + CHEV;
      b.onclick = () => openField(r.f); wrap.appendChild(b);
      if (r.i !== undefined) {
        // two taps to remove, so a stray tap on a phone doesn't lose a field
        const x = document.createElement('button'); x.className = 'fdel'; x.type = 'button'; x.textContent = '✕';
        x.setAttribute('aria-label', 'Remove ' + r.label); x.title = 'Remove this field';
        x.onclick = ev => { ev.stopPropagation();
          if (x.classList.contains('arm')) { removeField(r.i); return; }
          x.classList.add('arm'); x.textContent = 'Remove?';
          setTimeout(() => { if (x.isConnected) { x.classList.remove('arm'); x.textContent = '✕'; } }, 3000); };
        wrap.appendChild(x);
      }
      list.appendChild(wrap);
    });
    const ca = $('clearFields');
    if (ca) { ca.hidden = !state.saved.length; ca.textContent = 'Clear all'; ca.classList.remove('arm');
      ca.onclick = () => { if (ca.classList.contains('arm')) { clearFields(); return; }
        ca.classList.add('arm'); ca.textContent = 'Tap again to clear';
        setTimeout(() => { if (ca.isConnected && ca.classList.contains('arm')) { ca.classList.remove('arm'); ca.textContent = 'Clear all'; } }, 3000); }; }
    if (!rows.length) list.innerHTML = '<p class="small" style="padding:12px 0">No fields yet. Tap "Plan a field" to add one.</p>';
    $('fieldCount').textContent = 'Saved fields (' + rows.length + ')';
  }
  function openField(f, after) {
    show('field'); setField(f);
    if (f.history && !f.example) { state.history = f.history.slice(); }
    if (f.drainage) state.drainage = f.drainage;
    renderInputs();
    if (after) run(after);
    else { state.wx = null; $('goHint').hidden = false; $('goHint').textContent = 'Check the answers, then press the button.'; }
  }

  // ---------- map ----------
  let map, marker, poly, labels, nasaLayer;
  const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
  const LAYERS = [
    { k: 'photo', label: 'Satellite photo', note: '' },
    { k: 'ndvi', label: 'NASA greenness', url: GIBS + 'MODIS_Terra_L3_NDVI_16Day/default/2026-07-12/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png', nz: 9, zoom: 11, note: 'How green the land was in mid-July 2026, from MODIS on NASA\'s Terra satellite. Dark green is strong growth; pale is bare or burnt-off ground.' },
    { k: 'rain', label: 'NASA rain', url: GIBS + 'IMERG_Precipitation_Rate/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png', nz: 6, zoom: 6, note: 'Rain as NASA\'s GPM satellites last measured it (IMERG). No colour means it was dry.' },
    { k: 'soil', label: 'NASA soil moisture', url: GIBS + 'SMAP_L4_Analyzed_Surface_Soil_Moisture/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png', nz: 6, zoom: 6, note: 'How wet the top of the soil is, from NASA\'s SMAP satellite. Each square is about 9 km across.' }
  ];
  let layerK = 'photo';
  function setLayer(k) {
    layerK = k; const L0 = LAYERS.find(l => l.k === k);
    if (nasaLayer) { nasaLayer.remove(); nasaLayer = null; }
    if (L0.url) { nasaLayer = L.tileLayer(L0.url, { maxNativeZoom: L0.nz, maxZoom: 18, opacity: 0.75, attribution: 'NASA GIBS' }).addTo(map); if (map.getZoom() > L0.zoom) map.setZoom(L0.zoom); }
    else if (state.field) { if (poly) map.fitBounds(poly.getBounds(), { padding: [30, 30], maxZoom: 17 }); else map.setView([state.field.lat, state.field.lon], 15); }
    chips($('layerChips'), LAYERS, layerK, setLayer); $('layerNote').textContent = L0.note;
  }
  function initMap() {
    map = L.map('map', { zoomControl: true }).setView([53.42, -7.94], 8);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, keepBuffer: 1, updateWhenIdle: true, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }).addTo(map);
    labels = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, keepBuffer: 1, updateWhenIdle: true }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, keepBuffer: 1, updateWhenIdle: true })
    ]).addTo(map);
    map.on('click', e => setField({ lat: e.latlng.lat, lon: e.latlng.lng, label: 'Your field' }));
    chips($('layerChips'), LAYERS, layerK, setLayer);
    $('findForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const q = $('findQ').value.trim(); if (!q) return;
      const note = $('findNote'); note.hidden = false; note.textContent = 'Looking for ' + q + '…';
      try {
        const r = await getJSON('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ie,gb&q=' + encodeURIComponent(q), 20000);
        if (!r.length) { note.textContent = 'Couldn\'t find "' + q + '". Not every Eircode is on the free map, so try the nearest town.'; return; }
        if (labels && !map.hasLayer(labels)) labels.addTo(map);
        map.setView([+r[0].lat, +r[0].lon], 14); note.textContent = 'Showing ' + r[0].display_name.split(',').slice(0, 2).join(',') + '. Now tap your field.';
      } catch (err) { note.textContent = 'The place search isn\'t answering. Zoom in on the map instead.'; }
    });
    $('locate').onclick = () => {
      const note = $('findNote'); note.hidden = false;
      if (!navigator.geolocation) { note.textContent = 'This device won\'t share its location. Search for a town instead.'; return; }
      note.textContent = 'Finding where you are…';
      navigator.geolocation.getCurrentPosition(p => { if (labels && !map.hasLayer(labels)) labels.addTo(map); map.setView([p.coords.latitude, p.coords.longitude], 16); note.textContent = 'This is where you are. Now tap your field.'; },
        () => { note.textContent = 'Couldn\'t get your location. Search for a town instead.'; }, { enableHighAccuracy: true, timeout: 15000 });
    };
  }
  function setField(f) {
    state.field = f;
    // the example field is shown without place names
    if (labels) { if (f.example) labels.remove(); else if (!map.hasLayer(labels)) labels.addTo(map); }
    if (layerK !== 'photo') { layerK = 'photo'; if (nasaLayer) { nasaLayer.remove(); nasaLayer = null; } chips($('layerChips'), LAYERS, layerK, setLayer); $('layerNote').textContent = ''; }
    if (marker) { marker.remove(); marker = null; } if (poly) { poly.remove(); poly = null; }
    if (f.polygon) { poly = L.polygon(f.polygon, { color: '#F7C14D', weight: 3, fillOpacity: 0.12 }).addTo(map); setTimeout(() => { map.invalidateSize(); map.fitBounds(poly.getBounds(), { padding: [30, 30], maxZoom: 17 }); }, 60); }
    else { marker = L.circleMarker([f.lat, f.lon], { radius: 10, color: '#F7C14D', weight: 3, fillColor: '#F7C14D', fillOpacity: 0.35 }).addTo(map); setTimeout(() => { map.invalidateSize(); map.setView([f.lat, f.lon], Math.max(map.getZoom(), 14)); }, 60); }
    $('pinNote').textContent = f.example ? 'Example field: a real tillage field in the midlands.' : 'Field picked. Tap again to move it.';
    $('go').disabled = false; $('goHint').hidden = true;
    lookupSoil(f);
    if (f.example) {
      state.history = f.selects.slice();
      $('histNote').textContent = '2025 is from the Department of Agriculture\'s public records. The other two follow this field\'s usual pattern. Change them if you like.';
      renderInputs();
    } else $('histNote').textContent = '';
  }

  // ---------- soil map (Irish Soil Information System, Teagasc / EPA) ----------
  const SOIL_URL = 'https://gis.epa.ie/geoserver/EPA/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=EPA:SOIL_SISNationalSoils&outputFormat=application/json&maxFeatures=1&propertyName=Association_Name,PlainEnglish,Drainage,Texture&CQL_FILTER=';
  async function lookupSoil(f) {
    const note = $('soilNote'); note.hidden = false; note.textContent = 'Checking the national soil map…'; state.soil = null;
    try {
      const r = await getJSON(SOIL_URL + encodeURIComponent('INTERSECTS(Shape,SRID=4326;POINT(' + f.lon.toFixed(5) + ' ' + f.lat.toFixed(5) + '))'), 25000);
      if (state.field !== f) return;
      const p = r.features && r.features[0] && r.features[0].properties;
      if (!p) { note.textContent = 'This field isn\'t on the Irish soil map, so pick the drainage yourself.'; return; }
      const d = String(p.Drainage || '').toLowerCase(), k = /poor/.test(d) ? 'poor' : /well|excess/.test(d) ? 'well' : /moder|imperf/.test(d) ? 'moderate' : null;
      const name = (p.PlainEnglish || p.Association_Name || 'soil') + (p.Texture && p.Texture !== 'None' && !String(p.PlainEnglish || '').toLowerCase().includes(String(p.Texture).toLowerCase()) ? ', ' + String(p.Texture).toLowerCase() : '');
      state.soil = { name, drainage: p.Drainage || '', k };
      if (f.example) note.textContent = 'The national soil map puts this area on ' + name.toLowerCase() + ' (' + String(p.Drainage || 'unknown').toLowerCase() + ' drainage). That map is coarse and this field has grown cereals for years, so it is left on Normal. Change it if you like.';
      else if (k) { state.drainage = k; renderInputs(); note.textContent = 'Set from the national soil map: ' + name + ', ' + String(p.Drainage).toLowerCase() + ' drainage. The map is coarse, so change it if your field is different.'; if (state.wx) recompute(); }
      else note.textContent = 'The national soil map shows ' + name + ' here. Pick the drainage that matches your field.';
    } catch (err) { if (state.field === f) note.textContent = 'The soil map isn\'t answering, so pick the drainage yourself.'; }
  }

  // ---------- data ----------
  function powerUrl(lat, lon) {
    const end = new Date(Date.now() - 4 * 86400000);
    const e = end.getUTCFullYear() + String(end.getUTCMonth() + 1).padStart(2, '0') + String(end.getUTCDate()).padStart(2, '0');
    return 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN,T2MDEW,WS2M,ALLSKY_SFC_SW_DWN,PS&community=AG&longitude=' + lon.toFixed(4) + '&latitude=' + lat.toFixed(4) + '&start=19840101&end=' + e + '&format=JSON';
  }
  async function getJSON(url, ms) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 60000);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  async function run(after) {
    const f = state.field; if (!f) return;
    $('go').disabled = true; $('prog').hidden = false; $('err').textContent = '';
    $('progText').textContent = 'Getting 40 years of weather for this field from NASA…';
    let power = null, cached = false;
    try { power = await getJSON(powerUrl(f.lat, f.lon), 90000); }
    catch (e) {
      if (f.example) { try { power = await getJSON('example_power.json', 30000); cached = true; } catch (e2) { } }
      if (!power) { $('err').textContent = 'Couldn\'t reach NASA just now. Check your signal and try again.'; $('go').disabled = false; $('prog').hidden = true; return; }
    }
    $('progText').textContent = 'Testing rotations against every season…';
    await new Promise(r => setTimeout(r, 30));
    if (!state.grid) { try { state.grid = await getJSON('rain_grid.json', 30000); } catch (e) { state.grid = null; } }
    const normals = E.lookupGrid(state.grid, f.lat, f.lon);
    state.wx = E.prepareWeather(power, { rainNormals: normals });
    state.wx.cached = cached; state.wx.tuned = !!normals;
    state.scenario = 'recorded';
    recompute(); saveField(f);
    $('prog').hidden = true; $('go').disabled = false;
    show(typeof after === 'string' ? after : 'plan');
  }
  function scenarioWx(wx, sc) {
    if (sc === 'recorded') return wx;
    const f = (r) => sc === 'wetAutumn' ? (r.m >= 9 && r.m <= 11 ? 1.2 : 1) : sc === 'wetSpring' ? (r.m >= 2 && r.m <= 4 ? 1.2 : 1) : 0.85;
    return Object.assign({}, wx, { days: wx.days.map(r => Object.assign({}, r, { rainT: r.rainT * f(r) })) });
  }
  const settings = () => ({ drainage: state.drainage, minDays: +$('minDays').value, cutoff: 1.77 });
  const opts = () => ({ history: state.history.slice(), priority: state.priority === 'balanced' ? null : state.priority, coverCrops: $('c_cover').checked, lastN: 10,
    constraints: { ownStock: $('c_stock').checked || state.priority === 'fodder' || state.history.some(c => C[c].fodder), noBeanBuyer: $('c_bean').checked, noOsrBuyer: $('c_osr').checked, noLivestockBuyer: $('c_live').checked, noBeetKit: $('c_beet').checked } });
  function recompute() {
    if (!state.wx) return;
    state.an = E.analyse(scenarioWx(state.wx, state.scenario), settings());
    state.base = state.scenario === 'recorded' ? state.an : E.analyse(state.wx, settings());
    state.plans = E.buildOptions(state.an, state.history.slice(), opts());
    state.ranked = state.plans.slice().sort((a, b) => b.overall - a.overall);
    renderPlan(); renderChanged(); renderHow();
  }

  // ---------- My plan ----------
  const LIGHTS = [['water', 'Weather'], ['disease', 'Disease'], ['market', 'Buyer'], ['season', 'Season']];
  const WORD = ['Good', 'Watch', 'Risk'];
  const seasonLabel = (c, hy) => C[c].autumn ? 'autumn ' + (hy - 1) : 'spring ' + hy;
  const plainName = (p) => p.rot.every(c => c === p.rot[0]) ? C[p.rot[0]].short + ' every year' : p.rot.map((c, i) => i ? C[c].short.toLowerCase() : C[c].short).join(', then ');
  function badYears(p) { const share = p.rot.reduce((a, c, i) => a + (p.perCropLast[i].seasons ? p.perCropLast[i].missedN / p.perCropLast[i].seasons : 0), 0) / p.rot.length; return Math.round(share * 10); }
  function worst(p) { const ev = []; p.rot.forEach((c, i) => p.perCropLast[i].missed.forEach(hy => { if (!ev.some(u => u.c === c && u.hy === hy)) ev.push({ c, hy }); })); ev.sort((a, b) => b.hy - a.hy); return ev; }
  function lookback(p) {
    const n = badYears(p), ev = worst(p);
    if (!ev.length) return 'In the last 10 years, the weather never stopped these crops being sown on time.';
    const tail = ' Last time: ' + seasonLabel(ev[0].c, ev[0].hy) + ', too wet to sow ' + C[ev[0].c].short.toLowerCase() + '.';
    if (n < 1) return 'In the last 10 years, the weather very rarely stopped these crops being sown on time.' + tail;
    return 'In the last 10 years, wet ground would have stopped a crop being sown on time in about ' + n + ' of them.' + tail;
  }
  function say(p, cur) {
    if (p.current) return 'This is what you grow now. Everything else is compared with it.';
    const bits = [];
    const d = p.margin - cur.margin, n = p.nitrogen - cur.nitrogen;
    if (Math.abs(d) >= 10) bits.push((d > 0 ? 'Leaves about ' + euro(d) + ' more' : 'Leaves about ' + euro(-d) + ' less') + ' a hectare each year than what you grow now');
    else bits.push('Leaves about the same money as what you grow now');
    if (Math.abs(n) >= 8) bits.push((n < 0 ? 'needs ' + (-n) + ' kg less' : 'needs ' + n + ' kg more') + ' bought nitrogen');
    if (p.soil - cur.soil >= 15) bits.push('is better for your soil');
    if (p.hasFodder) bits.push('grows about ' + p.fodder.toFixed(1) + ' t of fodder a hectare');
    const last = bits.pop(); return (bits.length ? bits.join(', ') + ' and ' + last : last) + '.';
  }
  function traitRows(p, bare) {
    const t = p.traits, L = p.rot.length, mk = p.lights.market;
    return [
      ['Water use', t.waterNeed + ' mm a season · rain covers ' + t.waterMet + '%', t.waterMet >= 85 ? 0 : t.waterMet >= 70 ? 1 : 2],
      ['Forage value', p.hasFodder ? p.fodder.toFixed(1) + ' t of fodder a hectare' : 'None: grain and straw only', p.hasFodder ? 0 : 9],
      ['Nitrogen fixing', t.nfix ? t.nfix + ' year' + (t.nfix > 1 ? 's' : '') + ' in ' + L + ' fix' + (t.nfix > 1 ? '' : 'es') + ' nitrogen' : 'No legume', t.nfix ? 0 : 9],
      ['Erosion protection', bare + ' of 36 months bare', bare <= 6 ? 0 : bare <= 14 ? 1 : 2],
      ['Organic matter', t.om >= 1.3 ? 'Builds it' : t.om >= 0.7 ? 'Holds it' : 'Runs it down', t.om >= 1.3 ? 0 : t.om >= 0.7 ? 1 : 2],
      ['Market', mk === 0 ? 'Ready buyers' : mk === 1 ? 'Check for a buyer' : 'No buyer', mk]
    ];
  }
  function fodderLine(p) {
    if (!p.hasFodder) return '';
    const n = p.shortLast.length;
    return n ? 'In the last 10 summers, drought would have cut its fodder by a tenth or more in ' + n + ' (' + p.shortLast.join(', ') + ').' : 'In the last 10 summers, drought never cut its fodder by as much as a tenth.';
  }
  function strip(rot, cover) {
    const cells = new Array(36).fill('b');
    const mark = (a0, a1) => { for (let a = a0; a <= a1; a++) if (a >= 0 && a < 36) cells[a] = 'g'; };
    const idx = (i, m, prev) => i * 12 + (prev ? m - 9 : m + 3);
    rot.forEach((c, i) => { const cr = C[c], ms = cr.months[0], me = cr.months[1];
      mark(cr.autumn ? idx(i, ms, true) : idx(i, ms, false), me >= 9 ? idx(i + 1, me, true) : (!cr.autumn && me < ms) ? idx(i + 1, me, false) : idx(i, me, false));
      if (i === 0) { const prev = C[rot[rot.length - 1]]; if (prev.months[1] >= 9) mark(0, prev.months[1] - 9); } });
    if (cover) rot.forEach((c, i) => { if (!C[c].autumn && c !== 'mz' && c !== 'bt') for (let a = i * 12; a < i * 12 + 6; a++) if (cells[a] === 'b') cells[a] = 'c'; });
    return { html: '<div class="strip" aria-hidden="true">' + cells.map(x => '<span class="m-' + x + '"></span>').join('') + '</div>', bare: cells.filter(x => x === 'b').length };
  }
  function riskiest(p) { let best = null, v = -1; p.rot.forEach((c, i) => { const s = p.perCrop[i]; const sh = s.seasons ? s.missedN / s.seasons : 0; if (sh > v) { v = sh; best = c; } }); return best; }
  function adviserNotes(p) {
    const out = [], ph = parseFloat($('ph').value), P = +$('pidx').value, K = +$('kidx').value;
    const lime = p.rot.filter(c => ['sbe', 'wosr', 'bt', 'sb'].includes(c));
    if (ph && ph < 6.5 && lime.length) out.push('Your pH of ' + ph + ' is low for ' + [...new Set(lime.map(c => C[c].short.toLowerCase()))].join(' and ') + '. Ask about lime first.');
    if (!$('ph').value) out.push('Get a soil test. pH, P and K change which plan works.');
    if (P && P <= 2) out.push('Phosphorus is at index ' + P + '. Teagasc budgets about €104 a hectare extra to build it up.');
    if (K && K <= 2) out.push('Potash is at index ' + K + '. Teagasc budgets about €52 a hectare extra to build it up.');
    if (p.rot.includes('wosr')) out.push('Check the field has no history of clubroot before oilseed rape.');
    if (p.rot.includes('sbe')) out.push('Line up a buyer for the beans and check the protein payment terms.');
    if (p.hasFodder) out.push('Do a fodder budget: stock numbers, months housed, and how much reserve to carry for a dry year.');
    if (p.rot.includes('mz') || p.rot.includes('bt')) out.push('Agree a buyer and a harvest contractor before sowing ' + (p.rot.includes('mz') ? 'maize' : 'beet') + '.');
    out.push('Talk it through with your Teagasc adviser or agronomist.');
    return out;
  }
  function cantSee(p) {
    const out = ['Wet corners, compaction and weeds like blackgrass. We treat the whole field as one soil type.',
      'A heavy local shower. NASA\'s weather is averaged over an area about 50 km across.'];
    if (p.hasFodder) out.push('Silage quality, or a late spring that delays turnout. We only count growth lost to dry soil.');
    if (p.rot.some(c => !C[c].autumn && !C[c].dm)) out.push('Grain yield lost in a dry summer. For grain crops the weather check is about getting them sown.');
    out.push('Next year\'s prices. The money figures use Teagasc\'s 2025 budgets.');
    return out;
  }
  function nasaSignal(p) {
    const r = riskiest(p), rs = r ? E.cropStats(state.an, r) : null, n = state.an.settings.minDays;
    if (rs && rs.missedN) return 'NASA\'s daily rain, temperature, sunshine and wind over this field show the ' + C[r].short.toLowerCase() + ' sowing window had fewer than ' + n + ' dry days in ' + rs.missedN + ' of ' + rs.seasons + ' seasons, most recently ' + seasonLabel(r, rs.missed[rs.missed.length - 1]) + '.';
    return 'NASA\'s daily rain, temperature, sunshine and wind over this field show every crop here had enough dry days to sow in all ' + (rs ? rs.seasons : '') + ' seasons' + (r ? '. ' + C[r].short + ' typically gets ' + rs.typical + '.' : '.');
  }
  function renderPlan() {
    const ps = state.ranked, cur = ps.find(p => p.current), best = ps[0], f = state.field;
    const nSeasons = Object.keys(state.an.seasons.sb).length;
    $('planLead').textContent = (f.example ? 'The example field' : 'Your field') + ', ' + DRAIN.find(d => d.k === state.drainage).long + ' ground. We compared what you grow now with two other rotations, using the real weather from ' + nSeasons + ' seasons.';
    // verdict
    let v = '<span class="badge b-best" style="align-self:flex-start">Best fit for you</span><div class="big">' + esc(plainName(best)) + '</div>';
    if (best.current) v += '<p class="gain">What you grow now already suits this field best. The other two are below if you want to compare.</p>';
    else {
      const d = best.margin - cur.margin;
      v += '<p class="gain">' + (d >= 10 ? 'About ' + euro(d) + ' more a hectare each year than what you grow now' + (f.areaHa ? ', or roughly ' + euro(d * f.areaHa) + ' a year on this ' + f.areaHa + ' ha field.' : '.') : 'About the same money as now, but better on what matters most to you.') + '</p>';
    }
    v += '<p class="say">' + esc(lookback(best)) + (best.hasFodder ? ' ' + esc(fodderLine(best)) : '') + '</p>';
    $('verdict').innerHTML = v;
    const wx = state.wx, pct = wx.tuned ? Math.abs(Math.round((wx.powerAnnual / wx.mapAnnual - 1) * 100)) : 0;
    $('calib').innerHTML = '<span class="tagc">Calibrated</span><span>' + (wx.tuned
      ? '<b>NASA weather, calibrated with Met Éireann for this field.</b> NASA\'s rain read ' + pct + '% too ' + (wx.powerAnnual > wx.mapAnnual ? 'wet' : 'dry') + ' here, so we corrected it with Met Éireann\'s local rainfall records. See how.'
      : '<b>NASA weather, not calibrated here yet.</b> This field is outside Met Éireann\'s rainfall map, so NASA\'s rain is used as it comes. See how.') + '</span>';
    // cards
    const box = $('planCards'); box.innerHTML = '';
    ps.forEach((p, rank) => {
      const card = document.createElement('article'); card.className = 'tile' + (rank === 0 ? '' : ' quiet');
      const badge = rank === 0 ? '<span class="badge b-best">Best fit</span>' : rank === 1 ? '<span class="badge b-2">' + (ps[0].overall - p.overall <= 3 ? 'Close second' : 'Second') + '</span>' : '<span class="badge b-3">Third</span>';
      const seq = p.rot.map((c, i) => '<span class="yr"><small>Year ' + (i + 1) + '</small>' + esc(C[c].short) + '</span>').join('<span class="arrow" aria-hidden="true">›</span>');
      const by = badYears(p), st = strip(p.rot, $('c_cover').checked), showFod = ps.some(q => q.hasFodder) || state.priority === 'fodder';
      const lights = LIGHTS.map(([k, lab]) => { const lv = p.lights[k]; return '<div class="light"><span class="dot l' + lv + '" aria-hidden="true">' + (lv === 0 ? '✓' : lv === 1 ? '!' : '×') + '</span>' + lab + '<small>' + WORD[lv] + '</small></div>'; }).join('');
      const watches = LIGHTS.filter(([k]) => p.lights[k] > 0).map(([k, lab]) => '<p class="watch w' + p.lights[k] + '"><b>' + lab + ':</b><span>' + esc(p.notes[k][0]) + '</span></p>').join('');
      const key = p.rot.find(c => c !== 'sb') || 'sb';
      const soilLines = [...new Set(p.rot)].map(c => '<li>' + esc(C[c].short) + ': ' + esc(C[c].soilLine) + '</li>').join('');
      card.innerHTML =
        '<div class="row">' + badge + (p.current ? '<span class="badge b-now">What you grow now</span>' : '') + '</div>' +
        '<div class="seq">' + seq + '</div>' +
        '<p class="say">' + esc(say(p, cur)) + '</p>' +
        '<div class="stats' + (showFod ? ' four' : '') + '">' +
          '<div class="stat"><div class="k">Money left</div><div class="v">' + euro(p.margin) + '</div><div class="s">a hectare a year, after costs</div></div>' +
          '<div class="stat"><div class="k">Fertiliser</div><div class="v">' + p.nitrogen + ' kg</div><div class="s">nitrogen a hectare a year</div></div>' +
          '<div class="stat"><div class="k">Bad sowing years</div><div class="v">' + by + ' in 10</div><div class="s">too wet to sow on time</div></div>' +
          (showFod ? '<div class="stat"><div class="k">Winter fodder</div><div class="v">' + (p.hasFodder ? p.fodder.toFixed(1) + ' t' : 'None') + '</div><div class="s">' + (p.hasFodder ? 'dry matter a hectare a year · short in ' + p.shortLast.length + ' of last 10 summers' : 'no fodder crop in this plan') + '</div></div>' : '') +
        '</div>' +
        '<div class="lights">' + lights + '</div>' + watches +
        '<details class="more"><summary>Why, and what to check</summary>' +
          '<p class="say">' + esc(C[key].why) + '</p>' +
          '<p class="subhead">The last 10 years</p><p class="small" style="font-size:15px;color:var(--soft)">' + esc(lookback(p)) + '</p>' +
          '<p class="subhead">What this rotation offers</p><div class="traits">' + traitRows(p, st.bare).map(t => '<div><span>' + t[0] + '</span><b class="t' + t[2] + '">' + esc(t[1]) + '</b></div>').join('') + '</div>' +
          (p.hasFodder ? '<p class="subhead">Fodder in a dry summer</p><p class="small" style="font-size:15px;color:var(--soft)">' + esc(fodderLine(p)) + ' Over all ' + state.an.droughtYears.length + ' years it averages ' + p.fodder.toFixed(1) + ' t a hectare against ' + p.potential.toFixed(1) + ' t with no drought.</p>' : '') +
          '<p class="subhead">What NASA\'s data shows</p><p class="small" style="font-size:15px;color:var(--soft)">' + esc(nasaSignal(p)) + '</p>' +
          '<p class="subhead">What it does for your soil</p><ul>' + soilLines + '</ul>' +
          '<p class="subhead">Soil cover over the three years (' + st.bare + ' bare months)</p>' + st.html + '<div class="legend"><span><i class="m-g"></i>Crop</span><span><i class="m-c"></i>Cover crop</span><span><i class="m-b"></i>Bare soil</span></div>' +
          '<p class="subhead">What we can\'t see from space</p><ul>' + cantSee(p).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
          '<p class="subhead">Check with your adviser</p><ul>' + adviserNotes(p).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
          '<p class="small">Score ' + p.overall + ' out of 100 (money ' + p.scores.profit + ', fertiliser ' + p.scores.fertiliser + ', soil ' + p.scores.soil + ', weather ' + p.scores.risk + (state.priority === 'fodder' ? ', fodder ' + p.scores.fodder : '') + ').</p>' +
        '</details>';
      box.appendChild(card);
    });
    chips($('scenChips'), SCEN, state.scenario, k => { state.scenario = k; recompute(); });
    $('scenNote').textContent = SCEN.find(s => s.k === state.scenario).note;
  }

  // ---------- What's changed ----------
  const med = a => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const dstr = j => { const d = new Date(Date.UTC(2021, 0, Math.round(j))); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
  function renderChanged() {
    const an = state.base, fy = an.fullYears, half = Math.floor(fy.length / 2), A = fy.slice(0, half), B = fy.slice(half);
    const span = (ys) => ys[0] + ' to ' + ys[ys.length - 1];
    $('chgLead').textContent = 'NASA has the weather over this field for every day since 1984. Here is the first half of that record (' + span(A) + ') against the second half (' + span(B) + ').';
    const sowHalf = (c) => { const ys = Object.keys(an.seasons[c]).map(Number).sort((a, b) => a - b), h = Math.floor(ys.length / 2); return [med(ys.slice(0, h).map(y => an.seasons[c][y])), med(ys.slice(h).map(y => an.seasons[c][y]))]; };
    const tile = (k, a, b, unit, line) => '<div class="tile quiet"><div class="k">' + k + '</div><div class="v">' + a + ' <span>then</span> ' + b + (unit ? ' <span>' + unit + '</span>' : '') + '</div><p class="small" style="font-size:15px;color:var(--soft)">' + line + '</p></div>';
    const cmp = (a, b, up, down, same, tol) => Math.abs(b - a) <= tol ? same : b > a ? up : down;
    const au = sowHalf('ww'), sp = sowHalf('sb');
    const dy = an.droughtYears, dh = Math.floor(dy.length / 2), dA = Math.round(avg(dy.slice(0, dh).map(y => an.years[y].dryDays))), dB = Math.round(avg(dy.slice(dh).map(y => an.years[y].dryDays)));
    const gA = Math.round(avg(A.map(y => an.years[y].gdd))), gB = Math.round(avg(B.map(y => an.years[y].gdd))), dT = (gB - gA) / 153;
    const fr = ys => med(ys.map(y => an.years[y].lastSpringFrost).filter(Boolean));
    const worstD = dy.slice().sort((a, b) => an.years[b].dryDays - an.years[a].dryDays).slice(0, 3).filter(y => an.years[y].dryDays > 0);
    let h = '';
    h += tile('Dry days to sow in autumn', au[0], au[1], 'days', cmp(au[0], au[1], 'More room to get winter crops in.', 'Less room to get winter crops in. Winter crops are getting harder to sow here.', 'About the same. Autumn sowing is no harder than it was.', 2));
    h += tile('Dry days to sow in spring', sp[0], sp[1], 'days', cmp(sp[0], sp[1], 'More room to get spring crops in.', 'Less room to get spring crops in.', 'About the same. Spring sowing is no harder than it was.', 2));
    h += tile('Summer days too dry for grass to grow', dA, dB, 'a year', cmp(dA, dB, 'Drought is costing more growing days than it used to.', 'Drought is costing fewer growing days than it used to.', 'No real change on average.', 3) + (worstD.length ? ' The worst summers: ' + worstD.map(y => y + ' (' + an.years[y].dryDays + ' days)').join(', ') + '.' : ''));
    h += '<div class="tile quiet"><div class="k">Summer temperature</div><div class="v">' + (Math.abs(dT) < 0.1 ? 'No change' : (dT > 0 ? '+' : '−') + Math.abs(dT).toFixed(1) + '°C') + '</div><p class="small" style="font-size:15px;color:var(--soft)">' + (dT >= 0.1 ? 'Summers are slightly warmer than they were, which helps maize.' : dT <= -0.1 ? 'Summers are slightly cooler than they were.' : 'Summers are about as warm as they were.') + ' Last spring frost: ' + dstr(fr(A)) + ' then ' + dstr(fr(B)) + '.</p></div>';
    $('chgTiles').innerHTML = h;
    renderBars();
  }
  function fmtWin(w) { return w[0][1] + ' ' + MON[w[0][0] - 1] + ' to ' + w[1][1] + ' ' + MON[w[1][0] - 1]; }
  function renderBars() {
    const crops = [...new Set(state.ranked.flatMap(p => p.rot))];
    if (state.barCrop !== 'drought' && (!state.barCrop || !crops.includes(state.barCrop))) state.barCrop = state.ranked[0].hasFodder ? 'drought' : (riskiest(state.ranked[0]) || crops[0]);
    chips($('barCrop'), crops.map(c => ({ k: c, label: C[c].short })).concat([{ k: 'drought', label: 'Summer drought' }]), state.barCrop, k => { state.barCrop = k; renderBars(); });
    if (state.barCrop === 'drought') {
      const an = state.an, ys = an.droughtYears, vals = ys.map(y => an.years[y].dryDays);
      const W = 900, H = 260, pl = 34, pb = 30, pt = 14, maxV = Math.max(30, ...vals), bw = (W - pl - 4) / ys.length, y = v => pt + (H - pt - pb) * (1 - v / maxV);
      let s = '';
      [0, Math.round(maxV / 2), maxV].forEach(t => { s += '<line x1="' + pl + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="rgba(160,205,255,.25)"/><text x="' + (pl - 6) + '" y="' + (y(t) + 5) + '" fill="#BFD0EA" font-size="14" text-anchor="end">' + t + '</text>'; });
      ys.forEach((yr, i) => { const v = vals[i];
        s += '<rect x="' + (pl + 2 + i * bw) + '" y="' + y(v) + '" width="' + Math.max(1, bw - 3) + '" height="' + Math.max(v ? 2 : 0, y(0) - y(v)) + '" rx="3" fill="' + (v >= 18 ? '#FF7A66' : '#F7C14D') + '"><title>' + yr + ': ' + v + ' days</title></rect>';
        if (yr % 5 === 0) s += '<text x="' + (pl + 2 + i * bw + bw / 2) + '" y="' + (H - 8) + '" fill="#BFD0EA" font-size="14" text-anchor="middle">' + yr + '</text>'; });
      const svg = $('bars'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = s;
      svg.setAttribute('aria-label', 'Days each summer when the soil was too dry for grass to grow.');
      const w3 = ys.slice().sort((a, b) => an.years[b].dryDays - an.years[a].dryDays).slice(0, 4).filter(yy => an.years[yy].dryDays > 0);
      $('barsTitle').textContent = 'Summer drought: days too dry for grass to grow';
      $('barsNote').textContent = 'Counted from April to September, when the soil was more than 50 mm short of water. Red summers lost 18 days or more, enough to cut grass silage by about a tenth.' + (w3.length ? ' The worst: ' + w3.map(yy => yy + ' (' + an.years[yy].dryDays + ')').join(', ') + '.' : ' None on record here.');
      $('barsLegend').textContent = 'Each bar is one summer. The taller the bar, the longer grass stood still.';
      return;
    }
    $('barsLegend').textContent = 'Blue = enough dry days to get the crop sown. Red = not enough: a year you\'d have been caught.';
    const c = state.barCrop, st = E.cropStats(state.an, c), min = state.an.settings.minDays, ys = st.years, vals = ys.map(y => st.byYear[y]);
    const W = 900, H = 260, pl = 34, pb = 30, pt = 14, maxV = Math.max(10, ...vals), bw = (W - pl - 4) / ys.length, y = v => pt + (H - pt - pb) * (1 - v / maxV);
    let s = '';
    [0, Math.round(maxV / 2), maxV].forEach(t => { s += '<line x1="' + pl + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="rgba(160,205,255,.25)"/><text x="' + (pl - 6) + '" y="' + (y(t) + 5) + '" fill="#BFD0EA" font-size="14" text-anchor="end">' + t + '</text>'; });
    ys.forEach((yr, i) => { const v = vals[i], miss = v < min;
      s += '<rect x="' + (pl + 2 + i * bw) + '" y="' + y(v) + '" width="' + Math.max(1, bw - 3) + '" height="' + Math.max(0, y(0) - y(v)) + '" rx="3" fill="' + (miss ? '#FF7A66' : '#4DB5FF') + '"><title>' + seasonLabel(c, yr) + ': ' + v + ' days</title></rect>';
      if (yr % 5 === 0) s += '<text x="' + (pl + 2 + i * bw + bw / 2) + '" y="' + (H - 8) + '" fill="#BFD0EA" font-size="14" text-anchor="middle">' + (C[c].autumn ? yr - 1 : yr) + '</text>'; });
    s += '<line x1="' + pl + '" x2="' + W + '" y1="' + y(min) + '" y2="' + y(min) + '" stroke="#F7C14D" stroke-dasharray="5 4" stroke-width="2"/><text x="' + W + '" y="' + (y(min) - 6) + '" fill="#F7C14D" font-size="14" font-weight="700" text-anchor="end" stroke="#061230" stroke-width="4" paint-order="stroke">' + min + ' days needed</text>';
    const svg = $('bars'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = s;
    svg.setAttribute('aria-label', C[c].name + ': dry days to sow in each season. Short in ' + st.missedN + ' of ' + st.seasons + '.');
    const w2 = ys.slice().sort((a, b) => st.byYear[a] - st.byYear[b]).slice(0, 2);
    $('barsTitle').textContent = C[c].short + ': dry days to sow, every year';
    $('barsNote').textContent = 'You sow ' + C[c].short.toLowerCase() + ' between ' + fmtWin(C[c].win) + '. Most years give ' + st.typical + ' dry days in that window. The worst were ' + w2.map(w => seasonLabel(c, w) + ' (' + st.byYear[w] + ')').join(' and ') + '.';
  }

  // ---------- How it works (in depth) ----------
  function renderHow() {
    const wx = state.wx, card = (who, title, body, full) => '<article class="tile quiet src' + (full ? ' full' : '') + '"><span class="who">' + who + '</span><h2>' + title + '</h2>' + body + '</article>';
    const K = {}; K.short = card('In short', 'What Harvest Star does', '<ol><li>You tap a field. We ask NASA for every day of weather over it since 1984.</li><li>We work out which days the ground was dry enough to sow.</li><li>We replay your rotation and two others through all those years, and cost each one with Teagasc\'s figures.</li><li>You get three options with traffic lights. You and your adviser decide.</li></ol>', true);
    if (wx) {
      const an = state.base, fy = an.fullYears, half = Math.floor(fy.length / 2);
      const lsf = fy.map(y => an.years[y].lastSpringFrost).filter(Boolean), faf = fy.map(y => an.years[y].firstAutumnFrost).filter(Boolean), gdd = fy.map(y => an.years[y].gdd);
      const tune = wx.tuned
        ? '<p>NASA\'s grid square here averages <b>' + Math.round(wx.powerAnnual).toLocaleString() + ' mm</b> of rain a year (1991–2020). Met Éireann\'s 1 km rainfall map says <b>' + Math.round(wx.mapAnnual).toLocaleString() + ' mm</b> at this field, so every month is scaled to match (NASA ran ' + Math.abs(Math.round((wx.powerAnnual / wx.mapAnnual - 1) * 100)) + '% ' + (wx.powerAnnual > wx.mapAnnual ? 'wet' : 'dry') + ').</p>'
        : '<p>This field is outside Met Éireann\'s rainfall map, so NASA\'s rain is used as it comes. Plugging in the local weather service\'s rain map is how Harvest Star goes worldwide.</p>';
      K.rain = card('NASA POWER · Met Éireann', 'Rainfall', '<p>Daily rain from NASA POWER, which comes from NASA\'s MERRA-2 weather model corrected with rain gauges and satellite rain records. ' + wx.days.length.toLocaleString() + ' days, ' + wx.first.slice(0, 4) + ' to ' + (+wx.last.slice(6, 8)) + ' ' + MON[+wx.last.slice(4, 6) - 1] + ' ' + wx.last.slice(0, 4) + (wx.cached ? ' (saved copy: NASA wasn\'t reachable)' : ', pulled live just now') + '.</p>' + tune +
        '<p class="small">Satellite and ground readings differ because NASA\'s square is about 50 km across and smooths out local showers, while a gauge catches one spot. NASA gives every day since 1984 for any field on Earth; the gauge-based map fixes the amount. Using both gets the timing and the total right.</p>' +
        '<p class="small">See the rain from space: <a href="https://worldview.earthdata.nasa.gov/?v=-13,49.5,-2,57&l=IMERG_Precipitation_Rate,Coastlines_15m&t=2019-10-15-T12%3A00%3A00Z" target="_blank" rel="noopener">NASA Worldview, GPM IMERG rain over Ireland, wet autumn 2019</a>.</p>');
      K.soil = card('NASA POWER · Met Éireann model', 'Soil wetness', '<p>Worked out from NASA weather, not measured: FAO-56 evaporation from NASA\'s temperature, dew point, wind and sunshine, run through Met Éireann\'s own soil moisture deficit model for ' + DRAIN.find(d => d.k === state.drainage).long + ' soil.</p><p>A day counts as fit to sow when it brings under 1 mm of rain and the soil starts it no wetter than field capacity.</p><p class="small">Checked against Met Éireann\'s own daily soil records at Mullingar station, 1986–2026, on all three soil classes: the engine\'s sowing days track the station\'s year by year (correlation 0.78 to 0.95 for every crop) and its count of missed seasons is never more than 3 away. NASA\'s SMAP satellite measures the top 5 cm of soil directly; adding it is next.</p>');
      K.temp = card('NASA POWER', 'Temperature and frost', '<p>Last spring frost is typically around <b>' + (lsf.length ? dstr(med(lsf)) : 'n/a') + '</b>, first autumn frost around <b>' + (faf.length ? dstr(med(faf)) : 'n/a') + '</b>. Summer warmth (degree days above 6°C, May to September) averaged <b>' + Math.round(avg(gdd.slice(0, half))) + '</b> in ' + fy[0] + '–' + fy[half - 1] + ' and <b>' + Math.round(avg(gdd.slice(half))) + '</b> in ' + fy[half] + '–' + fy[fy.length - 1] + '.</p><p class="small">This drives the Season light: whether maize gets enough warmth and whether late frosts hit young beet.</p>');
    }
    if (wx && state.field && state.field.example) {
      const hist = state.field.history, hy = Object.keys(hist).sort();
      K.hist = card('Department of Agriculture', 'The example field\'s crop history', '<p>' + hy.map(y => y + ': ' + (hist[y] ? esc(C[hist[y]].short) : 'no record')).join(' · ') + '</p><p class="small">' + esc(state.field.gaps || '') + '</p><p class="small">A real ' + state.field.areaHa + ' hectare tillage field in the midlands, from the anonymised Land Parcel Identification System, published as open data (CC BY 4.0). The files carry no names or addresses; each year\'s crop was matched by the field\'s location.</p>');
    }
    K.lights = card('The four lights', 'Weather, disease, buyer, season', '<ul><li><b>Weather:</b> how often a crop in the plan missed its sowing window, how often summers dried out, and how often drought left fodder short.</li><li><b>Disease:</b> crops following themselves or a close relative too soon, such as take-all in second wheats or oilseed rape back inside three years.</li><li><b>Buyer:</b> whether there is a market or contractor for each crop, from your answers.</li><li><b>Season:</b> whether the field is warm enough for maize and how late frosts run for beet.</li></ul>');
    K.money = card('Teagasc · S.I. 113 of 2022', 'Money and fertiliser', '<p>Gross margins per hectare from Teagasc\'s Crop Costs and Returns 2025, including straw and the €500/ha protein aid for beans. Nitrogen is the legal maximum for each crop at the soil N index the crop before it leaves (Nitrates Regulations). Sowing windows are Teagasc\'s. A crop that misses its window is costed as spring barley instead.</p>');
    K.hood = card('Under the hood', 'The method, step by step', '<ol><li>Pull every day since 1984 from the NASA POWER API for the tapped point.</li><li>Scale each month\'s rain to the national weather service\'s 1 km rainfall map (Met Éireann 1991–2020) and treat NASA drizzle under 1.77 mm as dry (matched to Mullingar\'s 154 rain days a year).</li><li>FAO-56 Penman-Monteith evaporation, then Met Éireann\'s hybrid soil moisture deficit model for the soil class.</li><li>Count days fit to sow in each crop\'s Teagasc window; under ' + (+$('minDays').value) + ' days is a missed season.</li><li>Replay each rotation from every starting year. Score money, nitrogen, soil and weather, weighted by the farmer\'s priority.</li></ol><p class="small">No machine learning: every number traces to a published method or record. Everything runs in the browser; nothing leaves your device except the request to NASA.</p>');
    K.fodder = card('Teagasc · NASA POWER', 'Fodder and drought', '<p>Grass silage, red clover silage, kale, maize and fodder beet each carry a fodder yield in tonnes of dry matter a hectare (Teagasc). Teagasc\'s rule is that grass growth is restricted once the soil is more than 50 mm short of water, so we count those days each April to September from the calibrated NASA weather and cut each crop\'s yield in proportion.</p><p class="small">The cut is tuned so that summer 2018 costs grass silage about a fifth of its yield, in line with Teagasc\'s PastureBase figures for that drought. Red clover, maize and beet are set to lose less than grass because they root deeper; those ratios are a starting assumption. Silage, red clover and kale are valued at €260 a tonne of dry matter (Teagasc\'s worked example for valuing silage) less Teagasc\'s cost of growing them.</p>');
    K.traits = card('From the challenge brief', 'Six things each rotation is rated on', '<ul><li><b>Water use:</b> evaporation demand (FAO-56, from NASA weather) for the months each crop is growing, March to September, and how much of it rain covers.</li><li><b>Forage value:</b> tonnes of fodder dry matter a hectare, after drought.</li><li><b>Nitrogen fixing:</b> years in the rotation with beans or red clover.</li><li><b>Erosion protection:</b> months of bare soil across the three years.</li><li><b>Organic matter:</b> grass and clover leys build it, winter-green crops and legumes hold it, bare-winter crops run it down. A rule of thumb, not a measurement.</li><li><b>Market:</b> whether each crop has a buyer, from your answers.</li></ul><p class="small">Open "Why, and what to check" on any option to see them.</p>');
    K.maize = card('NASA POWER · Teagasc · AFBI', 'Is it warm enough for maize?', '<p>Maize needs heat, counted in Ontario heat units from each day\'s highest and lowest temperature, May to September. An average variety sown in the open wants about 2,300; under film about 2,100.</p><p class="small">NASA\'s grid square reads cool: at Oak Park it gives 2,038 against Teagasc\'s published 2,383 for 2005–2021, so NASA\'s figure is scaled up by 17% to match. That scaling comes from one site, so treat maize results as a guide.</p>');
    K.soilmap = card('Teagasc · EPA', 'Local soil', '<p>When you tap a field, the app asks the Irish Soil Information System (Teagasc and the EPA\'s national soil map) what soil is there and how it drains, and sets the drainage question for you.' + (state.soil ? ' For this field it returned <b>' + esc(state.soil.name) + '</b>, ' + esc(String(state.soil.drainage).toLowerCase()) + ' drainage.' : '') + '</p><p class="small">That map is drawn at 1:250,000, so it describes the area, not the exact field: the farmer can overrule it. pH, P and K come from the farmer\'s own soil test.</p>');
    K.layers = card('NASA GIBS · on the map', 'See your field from space', '<p>On the My field map you can switch from the satellite photo to three live NASA layers:</p><ul><li><b>Greenness:</b> MODIS on NASA\'s Terra satellite (NDVI, 16-day).</li><li><b>Rain:</b> GPM IMERG, rain measured from orbit.</li><li><b>Soil moisture:</b> SMAP, the top of the soil measured from orbit.</li></ul><p class="small">These are for looking, not yet for the numbers: the rotation scores run on NASA POWER. Feeding MODIS greenness and SMAP into the scores is the next step.</p>');
    K.limits = card('Honest limits', 'What this tool can\'t tell you', '<ul><li>It tests the weather your field has had. It is not a forecast.</li><li>It doesn\'t walk the field: drainage, weeds and compaction need your eyes.</li><li>Drought losses are counted for fodder crops only. Grain yields and disease outbreaks aren\'t in the money figures yet.</li><li>It suggests options to explore. You and your adviser make the call.</li></ul>');
    K.next = card('Next', 'Any field on Earth', '<p>NASA\'s data covers every field on the planet. Swap in each country\'s own weather service and farm advisers, the way Harvest Star uses Met Éireann and Teagasc, and the same tool works anywhere.</p>');
    const F = (x) => x ? x.replace('src">', 'src full">') : '';
    let cal = '<p>NASA sees every field on Earth, every day, but through a grid square about 50 km across. Met Éireann knows the local detail. Harvest Star merges the two, so you get NASA\'s 40-year daily record with Met Éireann\'s local accuracy.</p>';
    if (wx && wx.tuned) { const mx = Math.max(wx.powerAnnual, wx.mapAnnual), col = ['#7FB7FF', '#3FD087'];
      cal += '<div class="calbars">' + [['NASA, as it comes', wx.powerAnnual], ['Met Éireann, at this field', wx.mapAnnual]].map((r, i) => '<div class="r"><span>' + r[0] + '</span><div class="bar" style="width:' + (r[1] / mx * 100).toFixed(0) + '%;background:' + col[i] + '">' + Math.round(r[1]).toLocaleString() + ' mm a year</div></div>').join('') + '</div><p class="small">Average yearly rain, 1991–2020. Uncorrected, NASA would have this field ' + Math.abs(Math.round((wx.powerAnnual / wx.mapAnnual - 1) * 100)) + '% too ' + (wx.powerAnnual > wx.mapAnnual ? 'wet' : 'dry') + ', and the sowing days would be wrong.</p>'; }
    cal += '<div class="steps3"><div><b>1. How much rain</b>Each month of NASA rain is scaled to match Met Éireann\'s 1 km rainfall map (1991–2020) at the field.</div><div><b>2. How many wet days</b>NASA drizzles too often, so light days under 1.77 mm count as dry. That cut-off makes NASA match the 154 rain days a year at Met Éireann\'s Mullingar station.</div><div><b>3. How wet the soil</b>The calibrated weather runs through Met Éireann\'s own soil moisture model, then is checked against Met Éireann\'s daily soil records at Mullingar, 1986–2026.</div></div>';
    K.calib = '<article class="tile src full"><span class="who">Calibration · NASA + Met Éireann</span><h2>Calibrated: NASA data merged with Met Éireann</h2>' + cal + '</article>';
    let h = K.short + K.calib;
    if (K.rain) h += K.rain + K.soil + K.temp + K.lights + K.traits + K.soilmap + K.fodder + K.maize + K.layers + F(K.hist) + K.money + K.limits + F(K.hood) + F(K.next);
    else h += K.lights + K.traits + K.soilmap + K.fodder + K.maize + K.layers + K.money + F(K.limits) + F(K.hood) + F(K.next);
    $('srcCards').innerHTML = h;
  }

  // ---------- navigation ----------
  function show(id, fromHistory) {
    if ((id === 'plan' || id === 'changed') && !state.wx) id = 'field';
    if (!document.getElementById(id) || !document.getElementById(id).classList.contains('screen')) id = 'home';
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    const navId = id === 'changed' ? 'plan' : id;
    document.querySelectorAll('nav button').forEach(b => { if (b.dataset.go === navId) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    if (id === 'field' && map) setTimeout(() => map.invalidateSize(), 60);
    // each screen is a step in the browser's history, so Back returns to the previous screen
    try { if (location.hash.slice(1) !== id) { if (fromHistory) history.replaceState(null, '', '#' + id); else history.pushState(null, '', '#' + id); } } catch (e) { }
  }
  window.addEventListener('popstate', () => show(location.hash.slice(1) || 'home', true));
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
  function goChanged() { if (state.wx) show('changed'); else if (state.example) openField(Object.assign({ example: true }, state.example), 'changed'); else show('field'); }
  $('goChanged').onclick = goChanged; $('goChanged2').onclick = goChanged;

  // ---------- add as an app ----------
  let deferred = null;
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  if (standalone) $('install').hidden = true;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { $('install').hidden = true; });
  $('install').onclick = async () => {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) { } deferred = null; }
    else $('tip').hidden = false;
  };
  $('tipClose').onclick = () => { $('tip').hidden = true; };
  $('tip').onclick = (e) => { if (e.target === $('tip')) $('tip').hidden = true; };
  // no offline worker: it is removed so nothing can get between the phone and the live site
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => { });
  if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => { });

  // ---------- start ----------
  loadSaved(); renderInputs(); renderHome(); renderHow(); initMap();
  ['minDays', 'c_bean', 'c_osr', 'c_live', 'c_beet', 'c_cover', 'c_stock', 'ph', 'pidx', 'kidx'].forEach(id => $(id).addEventListener('change', () => { if (state.wx) recompute(); }));
  $('go').onclick = () => run('plan');
  fetch('example.json').then(r => r.ok ? r.json() : null).then(ex => {
    if (!ex) { $('useExample').hidden = true; return; }
    state.example = ex; renderHome();
    $('useExample').onclick = () => { setField(Object.assign({ example: true }, ex)); if (ex.drainage) { state.drainage = ex.drainage; renderInputs(); } };
  }).catch(() => { $('useExample').hidden = true; });
  try { history.replaceState(null, '', location.pathname.replace(/index\.html$/, '') + (location.hash === '#how' || location.hash === '#field' ? location.hash : '#home')); } catch (e) { }
  show(location.hash.slice(1) || 'home', true);
})();
