# Harvest Star

Crop rotations, tested on your field's real weather.

NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data · HackAthlone

**Try it live:** https://harvest-star.netlify.app

**Demo slides (PowerPoint):** [Harvest Star NASA Space Apps 2026 Demo](Harvest%20Star%20NASA%20Space%20Apps%202026%20Demo.powerpoint.pptx)

Harvest Star is a decision-support tool for tillage farmers. Tap a field, say what it grew and what matters most to you, and it compares your current rotation with two alternatives by replaying each one through every season NASA has measured over that field since 1984.

It suggests options to explore. It does not replace the farmer's judgment.

## The screens

1. **Home** – plan a field, open a saved field (or remove it), and jump to what's changed or how it works.
2. **My field** – tap the field on a satellite map; last three crops; drainage class and soil test (pH, P and K index); priority (balanced, profit, less fertiliser, soil health, low risk); optional constraints (no buyer for beans, no beet harvester…).
3. **My plan** – the current rotation plus two alternatives, ranked. Each has four risk lights (weather, disease, buyer, season), a look-back line on the last 10 seasons, and money, nitrogen and sowing figures. "Why, and what to check" on each option gives one plain sentence, the NASA signal behind it, what each crop does for the soil and what the tool can't see. Scenario buttons re-run the look-back with wetter autumns, wetter springs or drier weather.
4. **What's changed** – the first half of NASA's record for the field against the second half: dry days to sow in autumn and spring, summer drought days and temperature, with a chart of days fit to sow in every season on record.
5. **How it works** – each data source named, how NASA's model data is calibrated with Met Éireann's ground records and why both are used, and the tool's limits.

## How it works

1. **NASA POWER** daily point API (MERRA-2 / CERES based): rain, max/min temperature, dew point, wind, solar radiation and pressure for the tapped point, 1984 to last week. Pulled live in the browser.
2. **Rain tuning**: each month's rain is scaled so 1991–2020 averages match Met Éireann's 1 km rainfall map at the field (`rain_grid.json`, sampled every ~5 km). NASA days under 1.77 mm count as dry, a cut-off set so NASA's rain days match the 154 a year Met Éireann's Mullingar station records.
3. **Evaporation**: FAO-56 Penman-Monteith reference evapotranspiration.
4. **Soil water**: Met Éireann's hybrid soil moisture deficit model (field capacity 0 mm, saturation −10 mm, limit 110 mm) for well, moderately or poorly drained soil.
5. **Fit to sow**: a day with under 1 mm of rain on soil no wetter than field capacity. A crop's Teagasc sowing window is missed if it holds fewer than 5 such days (a farm setting).
6. **Scoring**: each rotation is replayed from every starting year. A missed crop is costed as spring barley. Margins are Teagasc Crop Costs and Returns 2025; nitrogen is the S.I. 113 of 2022 maximum at the soil N index the previous crop leaves; soil health counts green winters, break crops, legumes and changes of cereal.

No machine learning: every number can be traced to a published method or record.

## Files

- `index.html` – the screens (home, my field, my plan, what's changed, how it works)
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `favicon.*` – lets it be added to a phone or laptop as an app
- `globe.png` – logo emblem (artwork made with AI assistance)
- `engine.js` – the weather, soil and scoring engine (also runs in Node)
- `app.js` – the interface
- `rain_grid.json` – Met Éireann 1991–2020 monthly rainfall averages, resampled
- `example.json` – the example field (outline and crop history)
- `example_power.json` – a saved NASA POWER pull for the example field, used only if NASA can't be reached
- `validation/` – the check of the engine against Met Éireann's Mullingar station records, and its results

Run it by serving the folder with any static web server, for example `python3 -m http.server`.

## Data and credits

- NASA POWER, NASA Langley Research Center
- Met Éireann: 1991–2020 rainfall averages (Climatological Note 22), CC BY 4.0; soil moisture deficit model
- Teagasc: Crop Costs and Returns 2025; sowing windows; break-crop and cover-crop research
- Department of Agriculture, Food and the Marine: anonymised LPIS parcels, CC BY 4.0
- Map imagery: Esri World Imagery; map library: Leaflet

Harvest Star uses NASA data but is not endorsed by NASA.

## Use of AI

Built during the hackathon weekend with Claude (Anthropic) as a coding assistant. The farming rules, data choices and design are my own.

## Limits

- Tests the weather a field has had; it is not a forecast.
- One soil class per field; NASA's grid square is about 50 km across.
- Drought yield losses and disease outbreaks are not in the money figures yet.
- Rain tuning covers the island of Ireland; elsewhere NASA rain is used as it comes.
