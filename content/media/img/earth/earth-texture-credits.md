# Earth texture credits

`earth_eox_cloudless_2025_8k.webp` and its 4K/2K delivery variants form the
complete global daytime surface. The `tiles/eox-cloudless-2025` WebP set adds
detail near the camera. Both levels use the same EOxCloudless 2025 imagery, so
scrolling and zooming never switch to a different daytime map.

EOxCloudless contains modified Copernicus Sentinel data 2025 and is licensed
under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

- [EOxCloudless](https://cloudless.eox.at/)
- [EOX tile-service documentation](https://cloudless.eox.at/documentation/usage)

## Berlin close-up

`closeup-berlin-city-lakes-forest-eox-2025.webp` and its 2K delivery variant
provide a balanced Berlin regional view with the city, surrounding lakes, and
forest areas in the first section. The image follows a curved 90° × 70.7°
region—roughly half the camera-facing hemisphere—with its source aspect ratio
preserved, then blends radially into the global daytime surface. Both use the
same EOxCloudless 2025 source. A derived water mask supplies local lake
reflections; geometry and lighting provide subtle 3D depth without artificial
height or normal maps. The regional layer fades away before the global globe
view.

`berlin-city-center-eox-2025-4k-r1.webp` and its 2K delivery variant provide
the tighter Section 1 city view. The 4096 × 3350 source was requested directly
from the official EOX WMS using the `s2cloudless-2025` layer for the Berlin
bounding box `13.08,52.358,13.73,52.682`. The aligned water layer comes from
the official EOX `hydrography` WMS layer. This tighter source preserves roughly
10-metre ground detail instead of enlarging the broader regional image.

`berlin-mitte-truedop-sommer-2025-4k-r2.webp` and its 2K delivery variant are
the current Section 1 surface. They use the official Geoportal Berlin summer
2025 TrueDOP RGB layer for the 6.0 × 4.907 km Berlin-Mitte bounding box
`388779.259,5817618.546,394779.259,5822525.773` in EPSG:25833. The source
orthophoto has 0.20-metre ground resolution and is delivered here at about
1.465 metres per texture pixel. The aligned mask uses the EOX `hydrography`
WMS layer. The TrueDOP data is available under Datenlizenz Deutschland – Zero
– Version 2.0.

- [Geoportal Berlin TrueDOP Sommer 2025](https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-sommer-2025-truedop20rgbi-wms-d714b73c)
- [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0)

`earth_night_8k.jpg` and `earth_clouds_4k.jpg` are by Solar System Scope,
downloaded through Wikimedia Commons, and licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- [8K Earth night map](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_nightmap.jpg)
- [Earth cloud map](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_clouds.jpg)

The Solar System Scope maps are based on NASA elevation and imagery data.

## KTX2 delivery variants

The night and cloud color maps also have KTX2 delivery variants. They were
generated with Khronos KTX-Software 4.4.2 using ETC1S, high quality
(`qlevel 200–210`), a complete Lanczos mipmap pyramid, and OpenGL-compatible
vertical orientation. JPEG and WebP originals remain available as automatic
runtime fallbacks.

## City-light points

`content/media/data/earth-cities.bin` is an optimized derivative of Natural
Earth's public-domain `ne_10m_populated_places` dataset. Population values are
quantized to control the size and intensity of Section 3 city lights.

- [Natural Earth 1:10m Populated Places](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/)
