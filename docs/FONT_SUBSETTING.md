# Font Subsetting

This project uses a self-hosted Inter variable font at `content/assets/fonts/InterVariable.woff2`.

Goal: produce a compact subset containing the commonly used Latin characters (including German characters) to reduce bytes and speed up first meaningful paint.

Prerequisites:
- Python and pip available
- `fonttools` Python package installed (provides `pyftsubset`)
  - Install: `pip install fonttools`

Usage:
- `./scripts/subset-fonts.sh`
- Output: `content/assets/fonts/subset/InterVariable-subset.woff2`

Integration suggestions:
- After generating the subset, consider preloading the subset in the head and using it as the primary font for critical text, while loading the full variable font non-blocking for extended weights/styles.
- Test visually and with Lighthouse to verify improvements.
