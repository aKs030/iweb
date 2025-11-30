#!/usr/bin/env node
// Simple WebSocket echo server for local testing
// Install: npm install --save-dev ws

const WebSocket = require('ws');
const port = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port });

wss.on('connection', (ws, req) => {
  console.log('client connected from', req.socket.remoteAddress);
  ws.send('hello from ws-test-server');
  ws.on('message', (msg) => {
    console.log('received:', msg);
    ws.send('echo:' + msg);
  });
  ws.on('close', (code, reason) =>
    console.log('client disconnected, code:', code, 'reason:', reason)
  );
});

console.log('ws-test-server running on port', port);
