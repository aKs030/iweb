#!/usr/bin/env python3
"""
Generate/refresh video entries in sitemap.xml and sitemap-videos.xml from a YouTube channel's uploads.
Usage:
  YT_API_KEY=... python3 scripts/generate_video_sitemaps.py

Environment variables:
  YT_API_KEY        (required)
  YOUTUBE_CHANNEL_ID (optional, defaults to UCTGRherjM4iuIn86xxubuPg)
"""

import os
import re
import json
import urllib.request
from datetime import datetime

SITEMAP = 'sitemap.xml'
VIDEO_SITEMAP = 'sitemap-videos.xml'
API_CHANNELS = 'https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet,statistics&id={channel}&key={key}'
API_PLAYLIST = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId={pl}&maxResults=50&key={key}'
API_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id={ids}&key={key}'
API_CATEGORIES = 'https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&id={ids}&key={key}'

DEFAULT_CHANNEL_ID = 'UCTGRherjM4iuIn86xxubuPg'
PUBLISHER_NAME = 'Abdulkerim Berlin'
PUBLISHER_URL = 'https://www.youtube.com/channel/'


def iso_duration_to_seconds(iso):
    m = re.match(r'^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', iso)
    if not m:
        return None
    h = int(m.group(1) or 0)
    mm = int(m.group(2) or 0)
    s = int(m.group(3) or 0)
    return h*3600 + mm*60 + s


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read().decode())


def fetch_uploads_playlist(channel_id, key):
    url = API_CHANNELS.format(channel=channel_id, key=key)
    data = fetch_json(url)
    items = data.get('items') or []
    if not items:
        raise RuntimeError('Channel not found')
    return items[0].get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads')


def fetch_playlist_items(playlist_id, key):
    url = API_PLAYLIST.format(pl=playlist_id, key=key)
    data = fetch_json(url)
    return data.get('items', [])


def fetch_videos_details(ids, key):
    if not ids:
        return {}
    batches = []
    for i in range(0, len(ids), 50):
        batch = ids[i:i+50]
        url = API_VIDEOS.format(ids=','.join(batch), key=key)
        data = fetch_json(url)
        batches.extend(data.get('items', []))
    out = {}
    for it in batches:
        out[it['id']] = it
    return out


def fetch_category_names(cat_ids, key):
    """Fetch readable category names for a list/set of category IDs. Returns dict id->name."""
    if not cat_ids:
        return {}
    ids = list(cat_ids)
    # API accepts comma-separated ids; split into chunks if necessary
    batches = []
    for i in range(0, len(ids), 50):
        batch = ids[i:i+50]
        url = API_CATEGORIES.format(ids=','.join(batch), key=key)
        try:
            data = fetch_json(url)
            batches.extend(data.get('items', []))
        except Exception as e:
            print(f'Warning: fetching categories failed for batch {batch}: {e}')
            # continue; we can still return whatever we gathered
            continue
    out = {}
    for it in batches:
        cid = it.get('id')
        name = it.get('snippet', {}).get('title')
        if cid and name:
            out[cid] = name
    return out


def normalize_tags(tags):
    """Normalize tags: strip, remove leading #, dedupe preserving order, limit by count/length."""
    if not tags:
        return []
    seen = set()
    out = []
    for t in tags:
        s = str(t).strip()
        # remove leading hashtags
        if s.startswith('#'):
            s = s.lstrip('#')
        # collapse whitespace
        s = re.sub(r'\s+', ' ', s)
        # trim length
        if len(s) > 50:
            s = s[:50].rstrip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= 10:
            break
    return out


def clean_description(s):
    """Unescape HTML entities, remove HTML tags and excessive whitespace from descriptions."""
    if not s:
        return ''
    import html as _html
    s = _html.unescape(s)
    # remove HTML tags
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def clean_title_for_sitemap(title, max_len=150):
    """Remove URLs, collapse whitespace and trim title to max_len characters."""
    if not title:
        return ''
    t = re.sub(r'https?://\S+', '', title)  # remove urls
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) > max_len:
        t = t[:max_len].rstrip()
        # try to avoid cutting in the middle of a word
        if ' ' in t:
            t = t.rsplit(' ', 1)[0]
    return t



def build_video_xml(entry, details_map, channel_id, category_map=None):
    vid = entry['snippet']['resourceId']['videoId']
    title = entry['snippet'].get('title','').strip()
    desc = entry['snippet'].get('description','').strip()
    thumb = entry['snippet'].get('thumbnails',{}).get('high',{}).get('url') or entry['snippet'].get('thumbnails',{}).get('default',{}).get('url') or ''
    pub = entry['snippet'].get('publishedAt')
    duration_iso = details_map.get(vid,{}).get('contentDetails',{}).get('duration')
    dur = iso_duration_to_seconds(duration_iso) if duration_iso else ''

    # Prefer richer snippet from details_map (from videos?part=snippet)
    details_snippet = details_map.get(vid,{}).get('snippet', {})

    # tags and category
    tags_raw = details_snippet.get('tags') or entry['snippet'].get('tags') or []
    tags = normalize_tags(tags_raw)
    category_id = details_snippet.get('categoryId') or entry['snippet'].get('categoryId') or None
    category_name = None
    if category_map and category_id:
        category_name = category_map.get(category_id)

    # statistics
    stats = details_map.get(vid,{}).get('statistics', {})
    view_count = stats.get('viewCount')
    like_count = stats.get('likeCount')

    # sanitize fields
    def esc(s):
        return (s or '').replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

    # trim and clean descriptions to avoid extremely large sitemap entries
    MAX_DESC = 2000
    desc_trimmed = clean_description((desc or '')[:MAX_DESC])

    xml = []
    xml.append('    <video:video>')
    xml.append(f'      <video:thumbnail_loc>{esc(thumb)}</video:thumbnail_loc>')
    # Clean and normalize title for sitemap
    title_clean = clean_title_for_sitemap(title)
    title_to_use = title_clean
    if title_clean and not (title_clean.endswith(PUBLISHER_NAME) or title_clean.rstrip().endswith('— ' + PUBLISHER_NAME) or title_clean.rstrip().endswith('- ' + PUBLISHER_NAME)):
        title_to_use = f"{title_clean} — {PUBLISHER_NAME}"
    xml.append(f'      <video:title>{esc(title_to_use)}</video:title>')
    xml.append(f'      <video:description>{esc(desc_trimmed)}</video:description>')
    xml.append(f'      <video:content_loc>https://youtu.be/{vid}</video:content_loc>')
    xml.append(f'      <video:player_loc>https://www.youtube.com/embed/{vid}</video:player_loc>')
    if dur != '':
        xml.append(f'      <video:duration>{dur}</video:duration>')
    if category_name:
        xml.append(f'      <video:category>{esc(str(category_name))}</video:category>')
    elif category_id:
        xml.append(f'      <video:category>{esc(str(category_id))}</video:category>')
    for t in tags:
        xml.append(f'      <video:tag>{esc(str(t))}</video:tag>')
    # add view count if available (standardized name)
    if view_count is not None:
        xml.append(f'      <video:view_count>{esc(str(view_count))}</video:view_count>')
    xml.append(f'      <video:publication_date>{pub}</video:publication_date>')
    xml.append('      <video:family_friendly>yes</video:family_friendly>')
    xml.append('      <video:requires_subscription>no</video:requires_subscription>')
    xml.append(f'      <video:uploader info="{PUBLISHER_URL}{channel_id}">{PUBLISHER_NAME}</video:uploader>')
    xml.append('      <video:live>no</video:live>')
    xml.append('    </video:video>')
    return '\n'.join(xml)


def replace_videos_in_sitemap(sitemap_path, video_xml_blocks, no_backup=False):
    with open(sitemap_path, 'r', encoding='utf8') as f:
        xml = f.read()

    # find the <url> block for /videos/
    m = re.search(r'(<url>\s*<loc>https://abdulkerimsesli.de/videos/</loc>[\s\S]*?</url>)', xml)
    if not m:
        raise RuntimeError('videos <url> block not found in ' + sitemap_path)
    old = m.group(1)

    # build new block (keep same lastmod/changefreq/priority header)
    header_m = re.search(r'(<url>\s*<loc>https://abdulkerimsesli.de/videos/</loc>\s*<lastmod>.*?</lastmod>\s*<changefreq>.*?</changefreq>\s*<priority>.*?</priority>)', old)
    now = datetime.utcnow().date().isoformat()
    if header_m:
        header = header_m.group(1)
        # replace lastmod in header with today's date to keep sitemaps fresh
        header = re.sub(r'<lastmod>.*?</lastmod>', f'<lastmod>{now}</lastmod>', header)
    else:
        # fallback minimal header
        header = f'<url>\n    <loc>https://abdulkerimsesli.de/videos/</loc>\n    <lastmod>{now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>'

    new_block = header + '\n\n' + '\n\n'.join(video_xml_blocks) + '\n\n  </url>'
    new_xml = xml.replace(old, new_block)

    # write (optionally skip backup)
    if not no_backup:
        with open(sitemap_path + '.bak', 'w', encoding='utf8') as f:
            f.write(xml)
    with open(sitemap_path, 'w', encoding='utf8') as f:
        f.write(new_xml)

    # validate written XML
    try:
        import xml.etree.ElementTree as ET
        ET.parse(sitemap_path)
    except Exception as e:
        raise RuntimeError(f'Written XML {sitemap_path} is not well-formed: {e}')

    suffix = ' (no backup)' if no_backup else ''
    print(f'Updated {sitemap_path} with {len(video_xml_blocks)} video entries{suffix}')


if __name__ == '__main__':
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true', help='Print generated blocks and do not write files')
    p.add_argument('--channel-id', default=os.getenv('YOUTUBE_CHANNEL_ID') or DEFAULT_CHANNEL_ID)
    p.add_argument('--source', choices=['api','local'], default='api', help='Source of video data (api=YouTube API, local=pages/videos/index.html JSON-LD)')
    p.add_argument('--no-backup', action='store_true', help='Do not create .bak backups when writing sitemaps')
    args = p.parse_args()

    key = os.getenv('YT_API_KEY')
    channel_id = args.channel_id
    print('Using channel:', channel_id)

    if args.source == 'api' and not key:
        print('Please set YT_API_KEY env var for API mode')
        raise SystemExit(1)

    blocks = []

    if args.source == 'local':
        # Parse local pages/videos/index.html for JSON-LD VideoObjects / ItemList
        import html
        pth = os.path.join('pages','videos','index.html')
        with open(pth, 'r', encoding='utf8') as f:
            html_text = f.read()
        m_all = re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>([\s\S]*?)</script>', html_text)
        if not m_all:
            print('No JSON-LD block found in pages/videos/index.html')
            raise SystemExit(1)
        ld = None
        for block in m_all:
            try:
                parsed = json.loads(block)
                if isinstance(parsed, dict) and parsed.get('@type') == 'ItemList':
                    ld = parsed
                    break
            except Exception:
                continue
        if not ld:
            print('No ItemList JSON-LD found in pages/videos/index.html')
            raise SystemExit(1)
        items = []
        for li in ld.get('itemListElement', []):
            item = li.get('item')
            if item and item.get('@type') == 'VideoObject':
                vid = None
                if 'contentUrl' in item and item['contentUrl'].startswith('https://youtu.be/'):
                    vid = item['contentUrl'].split('/')[-1]
                elif 'embedUrl' in item and item['embedUrl'].rstrip('/').split('/')[-1]:
                    vid = item['embedUrl'].rstrip('/').split('/')[-1]
                snippet = {
                    'resourceId': {'videoId': vid},
                    'title': item.get('name'),
                    'description': item.get('description'),
                    'thumbnails': {'high': {'url': item.get('thumbnailUrl')}} if item.get('thumbnailUrl') else {},
                    'publishedAt': item.get('uploadDate')
                }
                items.append({'snippet': snippet, 'item': item})
        # details_map can be built from 'duration' in JSON-LD
        details_map = {}
        for it in items:
            vid = it['snippet']['resourceId']['videoId']
            if 'item' in it and it['item'].get('duration'):
                details_map[vid] = {'contentDetails': {'duration': it['item']['duration']}}
        blocks = [build_video_xml(it, details_map, channel_id) for it in items]
    else:
        uploads = fetch_uploads_playlist(channel_id, key)
        if not uploads:
            print('No uploads playlist found')
            raise SystemExit(1)
        print('Uploads playlist:', uploads)

        items = fetch_playlist_items(uploads, key)
        if not items:
            print('No items in uploads playlist')
            raise SystemExit(0)

        ids = [it['snippet']['resourceId']['videoId'] for it in items]
        details = fetch_videos_details(ids, key)

        # collect category ids and fetch readable names
        cat_ids = set()
        for vid, info in details.items():
            cid = info.get('snippet', {}).get('categoryId')
            if cid:
                cat_ids.add(cid)
        category_map = fetch_category_names(cat_ids, key)

        blocks = [build_video_xml(it, details, channel_id, category_map) for it in items]

    if args.dry_run:
        print('\n--- DRY RUN: Generated video blocks ---\n')
        for b in blocks:
            print(b)
            print('\n-----\n')
        print(f'Generated {len(blocks)} blocks (dry run).')
    else:
        # Replace videos in sitemap.xml and sitemap-videos.xml
        replace_videos_in_sitemap(SITEMAP, blocks, no_backup=args.no_backup)
        replace_videos_in_sitemap(VIDEO_SITEMAP, blocks, no_backup=args.no_backup)
        print('Done')
