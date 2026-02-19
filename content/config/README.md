# Configuration Files

## YouTube API Configuration

To use the YouTube API features, set your API key via environment variable:

```bash
# .dev.vars
YOUTUBE_API_KEY=your_api_key_here
YOUTUBE_CHANNEL_ID=UCTGRherjM4iuIn86xxubuPg
```

The configuration is provided to Cloudflare Pages Functions and used by the YouTube API proxy.

### Mock Mode

For development without an API key, the app automatically uses mock data when running on localhost.

Force mock mode with: `?mockVideos=1`

## Brand Data

All brand information (name, contact, social links) is centralized in `brand-data.json`.

This file is used by:

- SEO meta tags
- Schema.org structured data
- Footer contact information

## Site Configuration

`site-config.js` contains environment-specific settings:

- Google Tag Manager IDs
- Google Analytics IDs
- Google Ads conversion tracking

Configure per hostname or use the `default` configuration.
