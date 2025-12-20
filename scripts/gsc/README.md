# Google Search Console automation (Sitemap submission)

This folder contains a small script to submit your sitemap to Google Search Console using a Service Account and the Webmasters API.

Important notes
- You must own or have full permissions for the Search Console property (https://search.google.com/search-console).
- Google has deprecated the simple `https://www.google.com/ping?sitemap=...` ping; use Search Console UI or the API.

Steps

1) Enable APIs & create Service Account

- Open Google Cloud Console and create/select a project.
- Enable the **Search Console API** (also known as Webmasters API).
- Create a Service Account and generate a JSON key. Download the key file.

2) Grant access to the Service Account

- Go to Search Console → Settings → Users and permissions.
- Add the service account's email (from the JSON) as a user with **Owner** or **Full** permissions.
  - If you cannot add the service account as Owner, add the account as a user with full permissions.

3) Run the script

Install dependencies (recommended in virtualenv):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install google-api-python-client google-auth
```

Run (example):

```bash
export SERVICE_ACCOUNT_FILE=/path/to/your/service-account.json
python3 scripts/gsc/submit_sitemap.py --site https://abdulkerimsesli.de --sitemap /sitemap.xml
```

Or explicitly:

```bash
python3 scripts/gsc/submit_sitemap.py --service-account /path/to/service-account.json --site https://abdulkerimsesli.de --sitemap /sitemap.xml
```

4) Optional: list sitemaps

```bash
python3 scripts/gsc/submit_sitemap.py --service-account /path/to/service-account.json --site https://abdulkerimsesli.de --list
```

URL Inspection / Indexing

- The URL Inspection API and Indexing API require additional OAuth scopes and user-level OAuth flows. For immediate index requests you can use Search Console → URL Inspection → Request Indexing.
- If you want, I can prepare a URL Inspection automation script too. It requires either an OAuth client with user consent flow or service account usage combined with domain verification.

Security

- Keep the service account JSON secret and do not commit it to the repo.
- Prefer storing the key in a secure location (e.g. `~/.gcloud/service-account.json`) and use env vars to point to it.

Contact

If you want, I can help generate the OAuth client & script for URL Inspection, or walk you through granting the service account access.
