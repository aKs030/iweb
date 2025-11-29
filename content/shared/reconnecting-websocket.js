// Simple ReconnectingWebSocket with exponential backoff and visibility/online awareness
export class ReconnectingWebSocket {
  constructor(url, protocols = []) {
    this.url = url;
    this.protocols = protocols;

    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000;
    this.manualClose = false;

    this._setupEventHandlers();
    this._connect();
  }

  _setupEventHandlers() {
    window.addEventListener('online', () => this._onOnline());
    document.addEventListener('visibilitychange', () => this._onVisibilityChange());
  }

  _onOnline() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this._connect();
    }
  }

  _onVisibilityChange() {
    // If page becomes visible and the socket is closed, try reconnect
    if (document.visibilityState === 'visible' && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
      this._connect();
    }
  }

  _backoffDelay() {
    const base = Math.min(1000 * Math.pow(1.7, this.reconnectAttempts), this.maxReconnectDelay);
    const jitter = Math.random() * 300;
    return Math.floor(base + jitter);
  }

  _connect() {
    if (this.manualClose) return;
    try {
      this.ws = new WebSocket(this.url, this.protocols);
    } catch (e) {
      // Synchronous failure, schedule reconnect
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = (e) => {
      this.reconnectAttempts = 0;
      if (this.onopen) try { this.onopen(e); } catch (err) { console.warn(err); }
    };

    this.ws.onmessage = (e) => { if (this.onmessage) this.onmessage(e); };
    this.ws.onerror = (e) => { if (this.onerror) this.onerror(e); };
    this.ws.onclose = (event) => {
      if (this.onclose) this.onclose(event);

      // If client closed manually, don't try to reconnect
      if (this.manualClose) return;

      // If server asked to close gracefully, don't spam reconnects (code 1000)
      if (event && event.code === 1000) return;

      // Some browsers provide reason: try again
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    this.reconnectAttempts += 1;
    const delay = this._backoffDelay();
    setTimeout(() => this._connect(), delay);
  }

  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(data);
    return true;
  }

  close(code = 1000) {
    this.manualClose = true;
    if (this.ws) this.ws.close(code);
  }
}

// Common use example:
// import { ReconnectingWebSocket } from '/content/shared/reconnecting-websocket.js';
// const rws = new ReconnectingWebSocket('ws://127.0.0.1:3001');
// rws.onmessage = e => console.log('msg', e.data);
// rws.onopen = () => rws.send('hello');
