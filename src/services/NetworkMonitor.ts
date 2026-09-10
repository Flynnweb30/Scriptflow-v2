export interface NetworkMetrics {
  online: boolean;
  signal: 0 | 1 | 2 | 3 | 4;
  rttMs: number | null;
  bandwidthMbps: number | null;
  packetLossPercent: number;
  jitterMs: number | null;
  stabilityPercent: number | null;
  reconnects: number;
  samples: number;
  failedSamples: number;
  updatedAt: number;
}

type NetworkListener = (metrics: NetworkMetrics) => void;

type NetworkInformationLike = EventTarget & {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

const HEARTBEAT_INTERVAL_MS = 5000;
const HISTORY_SIZE = 20;
const HEARTBEAT_PATH = '/favicon.svg';

const getConnectionInfo = (): NetworkInformationLike | null => {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection || null;
};

const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

class NetworkMonitor {
  private listeners = new Set<NetworkListener>();
  private timer: number | null = null;
  private started = false;
  private rttHistory: number[] = [];
  private totalSamples = 0;
  private failedSamples = 0;
  private reconnects = 0;
  private connectionLost = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  private metrics: NetworkMetrics = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    // Start at 4 when the browser reports a healthy connection. The signal is
    // refined after the first heartbeat instead of visually starting at 1–3.
    signal: typeof navigator === 'undefined' || navigator.onLine ? 4 : 0,
    rttMs: null,
    bandwidthMbps: null,
    packetLossPercent: 0,
    jitterMs: null,
    stabilityPercent: null,
    reconnects: 0,
    samples: 0,
    failedSamples: 0,
    updatedAt: Date.now(),
  };

  subscribe(listener: NetworkListener) {
    this.listeners.add(listener);
    this.start();
    listener(this.metrics);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.metrics;
  }

  private start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    const connection = getConnectionInfo();
    connection?.addEventListener?.('change', this.handleConnectionChange);

    void this.sample();
    this.timer = window.setInterval(() => void this.sample(), HEARTBEAT_INTERVAL_MS);
  }

  private handleOnline = () => {
    if (this.connectionLost) this.reconnects += 1;
    this.connectionLost = false;
    this.update({ online: true, signal: 4, reconnects: this.reconnects });
    void this.sample();
  };

  private handleOffline = () => {
    if (!this.connectionLost) this.connectionLost = true;
    this.update({ online: false, signal: 0 });
  };

  private handleConnectionChange = () => {
    const connection = getConnectionInfo();
    this.update({ bandwidthMbps: this.getBandwidth(connection) });
  };

  private getBandwidth(connection = getConnectionInfo()) {
    const downlink = connection?.downlink;
    return typeof downlink === 'number' && Number.isFinite(downlink) && downlink >= 0 ? round(downlink, 2) : null;
  }

  private calculateJitter() {
    if (this.rttHistory.length < 2) return null;
    let deltaSum = 0;
    for (let i = 1; i < this.rttHistory.length; i += 1) {
      deltaSum += Math.abs(this.rttHistory[i] - this.rttHistory[i - 1]);
    }
    return round(deltaSum / (this.rttHistory.length - 1), 1);
  }

  private calculateStability(loss: number, jitterMs: number | null) {
    if (this.totalSamples === 0) return null;
    const lossPenalty = Math.min(100, loss * 3);
    const jitterPenalty = jitterMs === null ? 0 : Math.min(40, jitterMs / 2);
    return round(Math.max(0, 100 - lossPenalty - jitterPenalty), 1);
  }

  private calculateSignal(online: boolean, rttMs: number | null, bandwidthMbps: number | null, loss: number) {
    if (!online) return 0 as const;
    // Unknown metrics are treated as healthy until measurements prove otherwise.
    let score = 4;
    if (loss >= 10 || (rttMs !== null && rttMs > 300) || (bandwidthMbps !== null && bandwidthMbps < 1)) score = 1;
    else if (loss >= 5 || (rttMs !== null && rttMs > 150) || (bandwidthMbps !== null && bandwidthMbps < 3)) score = 2;
    else if (loss >= 2 || (rttMs !== null && rttMs > 80) || (bandwidthMbps !== null && bandwidthMbps < 10)) score = 3;
    return score as 1 | 2 | 3 | 4;
  }

  private update(partial: Partial<NetworkMetrics>) {
    const packetLossPercent = this.totalSamples ? round((this.failedSamples / this.totalSamples) * 100, 1) : 0;
    const jitterMs = partial.jitterMs ?? this.metrics.jitterMs;
    this.metrics = {
      ...this.metrics,
      ...partial,
      packetLossPercent,
      jitterMs,
      stabilityPercent: this.calculateStability(packetLossPercent, jitterMs),
      reconnects: this.reconnects,
      samples: this.totalSamples,
      failedSamples: this.failedSamples,
      updatedAt: Date.now(),
    };
    this.listeners.forEach((listener) => listener(this.metrics));
  }

  private async sample() {
    const startedAt = performance.now();
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;

    if (!online) {
      this.connectionLost = true;
      this.update({ online: false, signal: 0 });
      return;
    }

    try {
      const url = `${HEARTBEAT_PATH}?sf_net=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) throw new Error(`Heartbeat ${response.status}`);
      await response.body?.cancel();

      const rttMs = Math.max(1, Math.round(performance.now() - startedAt));
      this.totalSamples += 1;
      this.rttHistory.push(rttMs);
      if (this.rttHistory.length > HISTORY_SIZE) this.rttHistory.shift();

      if (this.connectionLost) this.reconnects += 1;
      this.connectionLost = false;

      const bandwidthMbps = this.getBandwidth();
      const packetLossPercent = this.totalSamples ? (this.failedSamples / this.totalSamples) * 100 : 0;
      const jitterMs = this.calculateJitter();
      this.update({
        online: true,
        rttMs,
        bandwidthMbps,
        jitterMs,
        stabilityPercent: this.calculateStability(packetLossPercent, jitterMs),
        signal: this.calculateSignal(true, rttMs, bandwidthMbps, packetLossPercent),
      });
    } catch {
      this.totalSamples += 1;
      this.failedSamples += 1;
      this.connectionLost = true;
      const bandwidthMbps = this.getBandwidth();
      const packetLossPercent = (this.failedSamples / this.totalSamples) * 100;
      this.update({
        online: navigator.onLine,
        bandwidthMbps,
        signal: this.calculateSignal(navigator.onLine, this.metrics.rttMs, bandwidthMbps, packetLossPercent),
      });
    }
  }
}

export const networkMonitor = new NetworkMonitor();
