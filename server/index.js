#!/usr/bin/env node
/* Simple Express proxy for Google Gemini API
   - This keeps the API key on the server and avoids exposing it to visitors.
   - Use with environment variable GEMINI_API_KEY.
*/
const express = require('express');
const cors = require('cors');
const fetch = global.fetch || require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

const allowedOrigin = process.env.PROXY_ALLOWED_ORIGIN || 'http://127.0.0.1:8081';
app.use(cors({origin: allowedOrigin}));
app.use(express.json({limit: '512kb'}));

const modelBase = 'https://generativelanguage.googleapis.com/v1beta/models';

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const serverKey = process.env.GEMINI_API_KEY;
    if (!serverKey) {
      return res.status(500).json({error: 'No Gemini API key configured on server.'});
    }

    const model = (req.body && req.body.model) || 'gemini-flash-latest';
    const url = `${modelBase}/${model}:generateContent?key=${serverKey}`;

    // Sanitize body: forward only the expected fields
    const payload = {
      contents: req.body?.contents || [],
      generationConfig: req.body?.generationConfig || {temperature: 0.7, maxOutputTokens: 200}
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({error: json || 'error'});
    }
    // Return the OCI JSON to the frontend as-is (without key)
    return res.status(200).json(json);
  } catch (err) {
    return res.status(500).json({error: String(err)});
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Gemini proxy server listening at http://127.0.0.1:${port}`);
});
