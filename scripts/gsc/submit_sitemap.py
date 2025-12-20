#!/usr/bin/env python3
"""
submit_sitemap.py

Submit a sitemap to Google Search Console (Webmasters API) using a Service Account.

Usage:
  1. Create a Google Cloud project and enable the "Search Console API" (Webmasters API).
  2. Create a Service Account and download the JSON key file.
  3. Grant the service account access to your Search Console property (in Search Console: Settings -> Users and permissions -> Add user with Owner or Full permission).
  4. Place the JSON key at, e.g., ~/.gcloud/service-account.json or in the repo and set the env var SERVICE_ACCOUNT_FILE.
  5. Run: python3 submit_sitemap.py --site https://abdulkerimsesli.de --sitemap /sitemap.xml

Notes:
- This script uses the "webmasters" (Webmasters API) endpoint which supports sitemaps.submit.
- The script will not perform URL Inspection. For URL Inspection, see the README and Search Console UI or the URL Inspection API (requires OAuth user credentials).
"""

import os
import argparse
import google.auth
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/webmasters"]


def get_credentials(sa_key_path: str):
    if not os.path.exists(sa_key_path):
        raise FileNotFoundError(f"Service account key not found: {sa_key_path}")
    creds = service_account.Credentials.from_service_account_file(sa_key_path, scopes=SCOPES)
    return creds


def submit_sitemap(site_url: str, sitemap_path: str, creds):
    service = build('webmasters', 'v3', credentials=creds)
    try:
        print(f"Submitting sitemap {sitemap_path} for site {site_url}...")
        resp = service.sitemaps().submit(siteUrl=site_url, feedpath=sitemap_path).execute()
        print("Sitemap submitted. Google may take a few minutes to process it.")
        return resp
    except HttpError as e:
        print("HTTP Error while submitting sitemap:", e)
        try:
            print(e.content.decode())
        except Exception:
            pass
        raise


def list_sitemaps(site_url: str, creds):
    service = build('webmasters', 'v3', credentials=creds)
    try:
        resp = service.sitemaps().list(siteUrl=site_url).execute()
        return resp
    except HttpError as e:
        print("HTTP Error while listing sitemaps:", e)
        raise


def main():
    p = argparse.ArgumentParser(description='Submit sitemap to Google Search Console (Webmasters API)')
    p.add_argument('--service-account', '-k', default=os.environ.get('SERVICE_ACCOUNT_FILE', ''), help='Path to service account JSON key')
    p.add_argument('--site', '-s', required=True, help='Site URL (e.g., https://example.com)')
    p.add_argument('--sitemap', '-m', required=True, help='Sitemap path (absolute path relative to site root) e.g. /sitemap.xml')
    p.add_argument('--list', action='store_true', help='List sitemaps for the site')
    args = p.parse_args()

    if not args.service_account:
        print('Error: Provide service account key via --service-account or set SERVICE_ACCOUNT_FILE env var')
        return

    creds = get_credentials(args.service_account)

    if args.list:
        print('Listing sitemaps...')
        s = list_sitemaps(args.site, creds)
        print(s)
        return

    submit_sitemap(args.site, args.sitemap, creds)


if __name__ == '__main__':
    main()
