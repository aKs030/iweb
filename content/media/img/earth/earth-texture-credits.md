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
forest areas mapped across the complete camera-facing hemisphere in the first
section. They use the same EOxCloudless 2025 source as the global daytime
surface. Derived height, normal, and water masks provide the local 3D relief
and lake reflections. The regional layer fades away before the global globe
view.

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
