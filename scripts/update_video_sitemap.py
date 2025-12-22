#!/usr/bin/env python3
"""
Simple helper to refresh <video:duration> and <video:thumbnail_loc> in sitemap.xml
Requires: an environment variable YT_API_KEY set to a valid YouTube Data API v3 key.
Usage: YT_API_KEY=... python3 scripts/update_video_sitemap.py
"""

import os
import re
import json
import urllib.request
from xml.etree import ElementTree as ET

SITEMAP = 'sitemap.xml'
API_URL = 'https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id={ids}&key={key}'

def find_video_ids(xml_text):
    # find youtube IDs in <video:content_loc> fields
    return re.findall(r'https?://(?:youtu.be/|www\.youtube\.com/watch\?v=|youtube\.com/watch\?v=)([A-Za-z0-9_-]{11})', xml_text)


def fetch_durations(youtube_ids, api_key):
    ids = ','.join(youtube_ids)
    url = API_URL.format(ids=ids, key=api_key)
    with urllib.request.urlopen(url, timeout=10) as r:
        data = json.loads(r.read().decode())
    result = {}
    for item in data.get('items', []):
        vid = item['id']
        dur = item['contentDetails']['duration']  # ISO 8601
        # convert ISO 8601 (PT#H#M#S) to seconds
        m = re.match(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', dur)
        if m:
            h = int(m.group(1) or 0)
            mm = int(m.group(2) or 0)
            s = int(m.group(3) or 0)
            result[vid] = h*3600 + mm*60 + s
    return result


def main():
    api_key = os.getenv('YT_API_KEY')
    if not api_key:
        print('Please set YT_API_KEY environment variable with your YouTube Data API v3 key')
        return 1

    with open(SITEMAP, 'r', encoding='utf8') as f:
        xml = f.read()

    ids = find_video_ids(xml)
    ids = list(dict.fromkeys(ids))  # uniq preserve order
    if not ids:
        print('No YouTube IDs found in sitemap')
        return 0

    durations = fetch_durations(ids, api_key)
    if not durations:
        print('No durations fetched (check API key / quotas)')
        return 1

    # replace durations in sitemap (naive text replacement)
    def replace_duration(match):
        block = match.group(0)
        m = re.search(r'<video:content_loc>(.*?)</video:content_loc>', block)
        if not m: return block
        url = m.group(1)
        vid = re.search(r'(?:vi/|v=|youtu.be/)([A-Za-z0-9_-]{11})', url)
        if not vid: return block
        vid = vid.group(1)
        if vid in durations:
            new = re.sub(r'<video:duration>\d+</video:duration>', f'<video:duration>{durations[vid]}</video:duration>', block)
            print(f'Updated {vid} -> {durations[vid]}s')
            return new
        return block

    new_xml = re.sub(r'<video:video>[\s\S]*?</video:video>', replace_duration, xml)
    if new_xml == xml:
        print('No changes applied')
        return 0

    # write updated sitemap to a new file (backup)
    with open(SITEMAP + '.bak', 'w', encoding='utf8') as f:
        f.write(xml)
    with open(SITEMAP, 'w', encoding='utf8') as f:
        f.write(new_xml)
    print('sitemap updated and backup written to', SITEMAP + '.bak')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
