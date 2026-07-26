# Earth texture credits

`earth_day_relief_8k.jpg`, `earth_day_relief_4k.jpg`, and
`earth_day_relief_2k.jpg` are resized derivatives of NASA Visible Earth's
August Blue Marble Next Generation map with topography and bathymetry. The
relief variants provide subtle natural variation in ocean depth.

- [NASA Visible Earth relief source](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/world.topo.bathy.200408.3x21600x10800.jpg)

`earth_night_8k.jpg` and `earth_clouds_4k.jpg` are by Solar System Scope,
downloaded through Wikimedia Commons, and licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- [8K Earth night map](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_nightmap.jpg)
- [Earth cloud map](https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_clouds.jpg)

The Solar System Scope maps are based on NASA elevation and imagery data.

## Regional close-up

`closeup-terrain-v14.webp`, its optimized 2K delivery variant, the derived
height and normal maps, and
`berlin-clouds-v2.webp` form the regional Europe/Berlin close-up. The terrain
uses modified Copernicus Sentinel imagery from
[EOX Cloudless](https://cloudless.eox.at/). The height, normal, and cloud masks
are derived display assets used by the 3D scene.

## KTX2 delivery variants

The `earth_day_relief_*`, `earth_night*`, and `earth_clouds_4k` color maps also
have KTX2 delivery variants. They were generated with Khronos KTX-Software
4.4.2 using ETC1S, high quality (`qlevel 200–210`), a complete Lanczos mipmap
pyramid, and OpenGL-compatible vertical orientation. JPEG and WebP originals
remain available as automatic runtime fallbacks.
