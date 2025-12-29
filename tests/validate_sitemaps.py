#!/usr/bin/env python3
"""Validate sitemap-videos.xml structure and basic constraints.
Usage: python3 tests/validate_sitemaps.py [path/to/sitemap-videos.xml]
Exits with non-zero code on failure.
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

VIDEO_NS = "http://www.google.com/schemas/sitemap-video/1.1"
NS = {"video": VIDEO_NS}

sitemap = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("sitemap-videos.xml")
if not sitemap.exists():
    print("sitemap-videos.xml not found at", sitemap)
    sys.exit(2)

try:
    tree = ET.parse(sitemap)
    root = tree.getroot()
except Exception as e:
    print("Failed to parse XML:", e)
    sys.exit(3)

videos = root.findall('.//{'+VIDEO_NS+'}video')
if not videos:
    print('No <video:video> entries found')
    sys.exit(4)

errors = []

for idx, v in enumerate(videos, start=1):
    # Required child elements
    def has(tag):
        return v.find(f'{{{VIDEO_NS}}}{tag}') is not None

    if not has('thumbnail_loc'):
        errors.append(f'video #{idx} missing thumbnail_loc')
    if not has('title'):
        errors.append(f'video #{idx} missing title')
    if not (has('content_loc') or has('player_loc')):
        errors.append(f'video #{idx} missing content_loc/player_loc')
    if not has('publication_date'):
        errors.append(f'video #{idx} missing publication_date')

    # likes must not be present
    if has('likes'):
        errors.append(f'video #{idx} contains disallowed <video:likes> element')

    # view_count, if present, must be integer
    vc = v.find(f'{{{VIDEO_NS}}}view_count')
    if vc is not None:
        txt = (vc.text or '').strip()
        if not txt.isdigit():
            errors.append(f'video #{idx} has non-numeric view_count: {txt}')

if errors:
    print('Validation failed:')
    for e in errors:
        print('-', e)
    sys.exit(1)

print(f'Validation passed: {len(videos)} video entries OK')
sys.exit(0)
