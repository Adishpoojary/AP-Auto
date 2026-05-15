import config from '../config';

/**
 * Single escalation / ops WebSocket per tab. Pub-sub by message `type`.
 * Also notifies `onConnected` subscribers when the socket opens (shared across consumers).
 */
class OpsWebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.closeTimer = null;
    this.reconnectDelayMs = 3000;
    this.connected = false;
    this.connectHandlers = new Set();
    /** Server sends `idle_drivers` only on new connections; other subscribers keep the socket open, so late subscribers need a replay. */
    this.lastIdleDriversPayload = null;
    this._onVisibility = this._handleVisibility.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibility);
    }
  }

  _handleVisibility() {
    if (document.visibilityState === 'visible' && this.hasListeners() && !this.isSocketActive()) {
      this.reconnectTimer = null;
      this.ensureConnection();
    }
  }

  isSocketActive() {
    return this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING);
  }

  ensureConnection() {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (this.isSocketActive()) {
      return;
    }

    try {
      this.ws = new WebSocket(config.escalationWebsocket);
      this.ws.onopen = () => {
        this.connected = true;
        this.connectHandlers.forEach((h) => {
          try {
            h();
          } catch (_) {
            /* ignore */
          }
        });
      };

      this.ws.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch (_) {
          return;
        }
        const eventType = payload?.type;
        if (!eventType) return;

        if (eventType === 'idle_drivers') {
          this.lastIdleDriversPayload = payload;
        }

        const dispatch = (type) => {
          const handlers = this.listeners.get(type);
          if (!handlers || handlers.size === 0) return;
          handlers.forEach((handler) => {
            try {
              handler(payload);
            } catch (_) {
              /* ignore subscriber errors */
            }
          });
        };

        dispatch(eventType);
        const star = this.listeners.get('*');
        if (star && star.size > 0) {
          star.forEach((handler) => {
            try {
              handler(payload);
            } catch (_) {
              /* ignore */
            }
          });
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connected = false;
      };
    } catch (_) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (!this.hasListeners()) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.hasListeners()) {
        this.ensureConnection();
      }
    }, this.reconnectDelayMs);
  }

  hasListeners() {
    for (const handlers of this.listeners.values()) {
      if (handlers.size > 0) return true;
    }
    return false;
  }

  /** Runs immediately if already open; otherwise on next open. */
  onConnected(handler) {
    if (typeof handler !== 'function') return () => {};
    this.connectHandlers.add(handler);
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        handler();
      } catch (_) {
        /* ignore */
      }
    } else {
      this.ensureConnection();
    }
    return () => {
      this.connectHandlers.delete(handler);
    };
  }

  subscribe(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
    if (eventType === 'idle_drivers' && this.lastIdleDriversPayload) {
      try {
        handler(this.lastIdleDriversPayload);
      } catch (_) {
        /* ignore */
      }
    }
    this.ensureConnection();

    return () => {
      const handlers = this.listeners.get(eventType);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(eventType);
      }
      if (!this.hasListeners()) {
        if (this.closeTimer) clearTimeout(this.closeTimer);
        this.closeTimer = setTimeout(() => {
          this.closeTimer = null;
          if (!this.hasListeners() && this.ws) {
            try {
              this.ws.close();
            } catch (_) {
              /* ignore */
            }
            this.ws = null;
          }
        }, 10000);
      }
    };
  }
}

const opsWebSocket = new OpsWebSocketService();
export default opsWebSocket;
