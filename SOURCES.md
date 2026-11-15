# Harvest Star – Sources and resources

Every data source, model and tool Harvest Star uses, with links. Built for the NASA Space Apps Challenge 2026 (Field Shift: Adapting Farms with NASA Data) at HackAthlone.

Harvest Star uses NASA data but is not endorsed by NASA.

## NASA

| Resource | What Harvest Star uses it for | Link |
|---|---|---|
| NASA POWER (Prediction Of Worldwide Energy Resources), NASA Langley Research Center | Daily rain, max/min temperature, dew point, wind, solar radiation and pressure for the tapped field, 1984 to present | https://power.larc.nasa.gov/ |
| POWER Daily API (point) | The API call the app makes (`community=AG`) | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ |
| POWER methodology | How POWER's values are produced | https://power.larc.nasa.gov/docs/methodology/ |
| MERRA-2, NASA Global Modeling and Assimilation Office | Reanalysis behind POWER's weather values | https://gmao.gsfc.nasa.gov/gmao-products/merra-2 |
| CERES, NASA Langley Research Center | Satellite radiation record behind POWER's solar values | https://ceres.larc.nasa.gov/ |
| NASA GIBS (Global Imagery Browse Services) | Live NASA map layers on the My field screen | https://www.earthdata.nasa.gov/technology/global-imagery-browse-services-gibs |
| MODIS on Terra: Vegetation Indices 16-day (NDVI) | "NASA greenness" map layer | https://modis.gsfc.nasa.gov/data/dataprod/mod13.php |
| GPM IMERG precipitation | "NASA rain" map layer | https://www.earthdata.nasa.gov/news/feature-articles/explore-20-years-rain-snowfall-data-from-nasas-precipitation-missions |
| SMAP Level 4 surface soil moisture | "NASA soil moisture" map layer | https://gmao.gsfc.nasa.gov/gmao-products/smap-l4 |
| NASA Worldview | "See the rain from space" link in How it works | https://worldview.earthdata.nasa.gov/ |

GIBS acknowledgement: We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).

## Met Éireann (Ireland's national weather service)

| Resource | What Harvest Star uses it for | Link |
|---|---|---|
| Climatological Note No. 22: Long-term rainfall averages for Ireland 1991–2020 (CC BY 4.0) | Monthly scaling of NASA rain to Irish averages | https://edepositireland.ie/handle/2262/108693 |
| National gridded datasets (1 km rainfall grid) | The 1 km rainfall map sampled in `rain_grid.json` | https://cli.fusio.net/cli/grids/ |
| Historical station data (Mullingar) | Validation of the engine (`validation/`) | https://www.met.ie/climate/available-data/historical-data |
| Hybrid soil moisture deficit model (Schulte et al., 2005, Teagasc and Met Éireann) | Soil wetness and days fit to sow, by drainage class | https://core.ac.uk/download/18440142.pdf |

## Teagasc, EPA and Irish Government

| Resource | What Harvest Star uses it for | Link |
|---|---|---|
| Teagasc Crop Costs and Returns 2025 | Gross margins per hectare | https://teagasc.ie/publications/crop-costs-and-returns-2025-php/ |
| Teagasc sowing windows; break-crop, cover-crop and fodder guidance | Sowing windows, rotation rules, fodder yields, 50 mm drought rule | Teagasc tillage and grassland advice (named in the app) |
| Irish Soil Information System (Teagasc and EPA) | Soil type and drainage for the tapped field | https://gis.teagasc.ie/soils/ |
| EPA GeoServer, national soils layer | The soil lookup the app calls | https://gis.epa.ie/ |
| S.I. No. 113 of 2022 (Good Agricultural Practice for Protection of Waters Regulations) | Legal nitrogen maximums per crop | https://www.irishstatutebook.ie/eli/2022/si/113 |
| Department of Agriculture, Food and the Marine: anonymised LPIS parcels (CC BY 4.0) | The example field and its crop history | https://data.gov.ie/organization/department-of-agriculture-food-and-the-marine |

## Other methods and references

| Resource | What Harvest Star uses it for | Link |
|---|---|---|
| FAO Irrigation and Drainage Paper 56 (Penman-Monteith) | Evaporation from NASA weather | https://www.fao.org/3/X0490E/x0490e00.htm |
| AFBI: Forage maize growing conditions (Ontario heat units) | Maize heat thresholds (about 2,300 open, 2,100 under film) | https://www.afbini.gov.uk/sites/afbini.gov.uk/files/publications/%5Bcurrent-domain%3Amachine-name%5D/Forage%20Maize%20-%20Growing%20Conditions.pdf |

## Maps and code

| Resource | What Harvest Star uses it for | Link |
|---|---|---|
| Esri World Imagery | Satellite photo basemap | https://goto.arcgis.com/maps/World_Imagery |
| Leaflet 1.9.4 | Map library | https://leafletjs.com/ |
| OpenStreetMap Nominatim | Place search on the map | https://nominatim.org/ |

## Project links

- Live app: https://harvest-star.netlify.app
- Code: https://github.com/Mikegonewildee/harvest-star
- Demo slides: in this repo (`Harvest Star NASA Space Apps 2026 Demo.powerpoint.pptx`)
