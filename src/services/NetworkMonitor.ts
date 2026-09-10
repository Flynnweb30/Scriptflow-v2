export interface NetworkMetrics {
  online: boolean;
  signal: 0 | 1 | 2 | 3 | 4;
  rttMs: number | null;
  bandwidthMbps: number | null;
  uploadMbps: number | null;
  packetLossPercent: number | null;
  jitterMs: number | null;
  stabilityPercent: number | null;
  reconnects: number;
  samples: number;
  failedSamples: number;
  bandwidthStatus: 'idle' | 'testing' | 'available' | 'unavailable';
  updatedAt: number;
}

type NetworkListener = (metrics: NetworkMetrics) => void;
type NetworkInformationLike = EventTarget & { downlink?: number; rtt?: number; effectiveType?: string };

const HEARTBEAT_INTERVAL_MS = 5000;
const BANDWIDTH_INTERVAL_MS = 60000;
const BANDWIDTH_TIMEOUT_MS = 12000;
const HISTORY_SIZE = 20;
const DOWNLOAD_BYTES = 500_000;
const UPLOAD_BYTES = 250_000;
const DOWNLOAD_URL = `https://speed.cloudflare.com/__down?bytes=${DOWNLOAD_BYTES}`;
const UPLOAD_URL = 'https://speed.cloudflare.com/__up';

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
  private heartbeatTimer: number | null = null;
  private bandwidthTimer: number | null = null;
  private heartbeatRequest: AbortController | null = null;
  private bandwidthRequest: AbortController | null = null;
  private started = false;
  private hidden = typeof document !== 'undefined' ? document.hidden : false;
  private rttHistory: number[] = [];
  private totalSamples = 0;
  private failedSamples = 0;
  private reconnects = 0;
  private connectionLost = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  private bandwidthRunning = false;
  private lastBandwidthTestAt = 0;
  private metrics: NetworkMetrics = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    signal: typeof navigator === 'undefined' || navigator.onLine ? 4 : 0,
    rttMs: null,
    bandwidthMbps: null,
    uploadMbps: null,
    packetLossPercent: null,
    jitterMs: null,
    stabilityPercent: null,
    reconnects: 0,
    samples: 0,
    failedSamples: 0,
    bandwidthStatus: 'idle',
    updatedAt: Date.now(),
  };

  subscribe(listener: NetworkListener) {
    this.listeners.add(listener);
    this.start();
    listener(this.metrics);
    return () => {
      this.listeners.delete(listener);
      this.stopIfUnused();
    };
  }

  getSnapshot() { return this.metrics; }

  private start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('pagehide', this.handlePageHide);
    window.addEventListener('pageshow', this.handlePageShow);
    const connection = getConnectionInfo();
    connection?.addEventListener?.('change', this.handleConnectionChange);
    void this.sample();
    this.scheduleHeartbeat();
    this.scheduleBandwidth();
  }

  private stopIfUnused() { if (this.listeners.size === 0) this.stop(); }

  private stop() {
    if (!this.started) return;
    this.started = false;
    if (this.heartbeatTimer !== null) window.clearTimeout(this.heartbeatTimer);
    if (this.bandwidthTimer !== null) window.clearTimeout(this.bandwidthTimer);
    this.heartbeatTimer = null;
    this.bandwidthTimer = null;
    this.heartbeatRequest?.abort();
    this.bandwidthRequest?.abort();
    this.heartbeatRequest = null;
    this.bandwidthRequest = null;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('pagehide', this.handlePageHide);
    window.removeEventListener('pageshow', this.handlePageShow);
    getConnectionInfo()?.removeEventListener?.('change', this.handleConnectionChange);
  }

  private scheduleHeartbeat() {
    if (!this.started) return;
    if (this.heartbeatTimer !== null) window.clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = window.setTimeout(async () => {
      this.heartbeatTimer = null;
      if (!this.hidden) await this.sample();
      this.scheduleHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private scheduleBandwidth() {
    if (!this.started) return;
    if (this.bandwidthTimer !== null) window.clearTimeout(this.bandwidthTimer);
    this.bandwidthTimer = window.setTimeout(async () => {
      this.bandwidthTimer = null;
      if (!this.hidden) await this.measureBandwidth();
      this.scheduleBandwidth();
    }, BANDWIDTH_INTERVAL_MS);
  }

  private handleOnline = () => {
    if (this.connectionLost) this.reconnects += 1;
    this.connectionLost = false;
    this.update({ online: true, signal: 4, reconnects: this.reconnects });
    void this.sample();
  };

  private handleOffline = () => {
    this.connectionLost = true;
    this.update({ online: false, signal: 0 });
  };

  private handleVisibility = () => {
    this.hidden = document.hidden;
    if (!this.hidden) {
      void this.sample();
      if (Date.now() - this.lastBandwidthTestAt >= BANDWIDTH_INTERVAL_MS) void this.measureBandwidth();
    } else {
      this.bandwidthRequest?.abort();
      this.bandwidthRequest = null;
    }
  };

  private handlePageHide = () => {
    if (this.heartbeatTimer !== null) window.clearTimeout(this.heartbeatTimer);
    if (this.bandwidthTimer !== null) window.clearTimeout(this.bandwidthTimer);
    this.heartbeatTimer = null;
    this.bandwidthTimer = null;
    this.heartbeatRequest?.abort();
    this.bandwidthRequest?.abort();
  };

  private handlePageShow = () => {
    if (!this.started || document.hidden) return;
    void this.sample();
    this.scheduleHeartbeat();
    if (Date.now() - this.lastBandwidthTestAt >= BANDWIDTH_INTERVAL_MS) void this.measureBandwidth();
    this.scheduleBandwidth();
  };

  private handleConnectionChange = () => { void this.sample(); };

  private calculateJitter() {
    if (this.rttHistory.length < 2) return null;
    let deltaSum = 0;
    for (let i = 1; i < this.rttHistory.length; i += 1) deltaSum += Math.abs(this.rttHistory[i] - this.rttHistory[i - 1]);
    return round(deltaSum / (this.rttHistory.length - 1), 1);
  }

  private calculateStability() {
    if (this.totalSamples === 0) return null;
    const loss = this.failedSamples / this.totalSamples * 100;
    const jitter = this.metrics.jitterMs ?? 0;
    return round(Math.max(0, 100 - Math.min(100, loss * 3) - Math.min(40, jitter / 2)), 1);
  }

  private calculateSignal(online: boolean, rttMs: number | null, downloadMbps: number | null, loss: number | null): 0 | 1 | 2 | 3 | 4 {
    if (!online) return 0;
    let score = 4;
    if (loss !== null && loss >= 10) score = Math.min(score, 1);
    else if (loss !== null && loss >= 5) score = Math.min(score, 2);
    else if (loss !== null && loss >= 2) score = Math.min(score, 3);
    if (rttMs !== null) {
      if (rttMs > 300) score = Math.min(score, 1);
      else if (rttMs > 150) score = Math.min(score, 2);
      else if (rttMs > 80) score = Math.min(score, 3);
    }
    if (downloadMbps !== null) {
      if (downloadMbps < 1) score = Math.min(score, 1);
      else if (downloadMbps < 3) score = Math.min(score, 2);
      else if (downloadMbps < 10) score = Math.min(score, 3);
    }
    return score as 1 | 2 | 3 | 4;
  }

  private update(partial: Partial<NetworkMetrics>) {
    const packetLossPercent = this.totalSamples > 0 ? round(this.failedSamples / this.totalSamples * 100, 1) : null;
    this.metrics = { ...this.metrics, ...partial, packetLossPercent, stabilityPercent: this.calculateStability(), reconnects: this.reconnects, samples: this.totalSamples, failedSamples: this.failedSamples, updatedAt: Date.now() };
    this.listeners.forEach(listener => listener(this.metrics));
  }

  private async sample() {
    if (!this.started || this.hidden) return;
    if (!navigator.onLine) {
      this.connectionLost = true;
      this.update({ online: false, signal: 0 });
      return;
    }
    this.heartbeatRequest?.abort();
    const controller = new AbortController();
    this.heartbeatRequest = controller;
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const startedAt = performance.now();
    try {
      const response = await fetch(`/favicon.svg?sf_net=${Date.now()}`, { method: 'GET', cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw new Error(`Heartbeat ${response.status}`);
      await response.body?.cancel();
      const rttMs = Math.max(1, Math.round(performance.now() - startedAt));
      this.totalSamples += 1;
      this.rttHistory.push(rttMs);
      if (this.rttHistory.length > HISTORY_SIZE) this.rttHistory.shift();
      if (this.connectionLost) this.reconnects += 1;
      this.connectionLost = false;
      const jitterMs = this.calculateJitter();
      const loss = this.totalSamples ? this.failedSamples / this.totalSamples * 100 : 0;
      this.update({ online: true, rttMs, jitterMs, signal: this.calculateSignal(true, rttMs, this.metrics.bandwidthMbps, loss) });
    } catch {
      this.totalSamples += 1;
      this.failedSamples += 1;
      this.connectionLost = true;
      this.update({ online: false, signal: 0 });
    } finally {
      window.clearTimeout(timer);
      if (this.heartbeatRequest === controller) this.heartbeatRequest = null;
    }
  }

  private async measureBandwidth() {
    if (!this.started || this.hidden || !navigator.onLine || this.bandwidthRunning) return;
    this.bandwidthRunning = true;
    this.lastBandwidthTestAt = Date.now();
    this.update({ bandwidthStatus: 'testing' });
    let timeout: number | null = null;
    try {
      this.bandwidthRequest?.abort();
      const controller = new AbortController();
      this.bandwidthRequest = controller;
      timeout = window.setTimeout(() => controller.abort(), BANDWIDTH_TIMEOUT_MS);
      const downloadStart = performance.now();
      const downloadResponse = await fetch(`${DOWNLOAD_URL}&sf=${Date.now()}`, { method: 'GET', cache: 'no-store', mode: 'cors', signal: controller.signal });
      if (!downloadResponse.ok) throw new Error(`Download ${downloadResponse.status}`);
      const downloadBuffer = await downloadResponse.arrayBuffer();
      const downloadSeconds = Math.max((performance.now() - downloadStart) / 1000, 0.001);
      const downloadMbps = round(downloadBuffer.byteLength * 8 / downloadSeconds / 1_000_000, 2);
      if (!navigator.onLine || this.hidden) return;
      const uploadBody = new Uint8Array(UPLOAD_BYTES);
      const uploadStart = performance.now();
      const uploadResponse = await fetch(`${UPLOAD_URL}?sf=${Date.now()}`, { method: 'POST', body: uploadBody, cache: 'no-store', mode: 'cors', headers: { 'Content-Type': 'application/octet-stream' }, signal: controller.signal });
      if (!uploadResponse.ok) throw new Error(`Upload ${uploadResponse.status}`);
      await uploadResponse.arrayBuffer().catch(() => undefined);
      const uploadSeconds = Math.max((performance.now() - uploadStart) / 1000, 0.001);
      const uploadMbps = round(UPLOAD_BYTES * 8 / uploadSeconds / 1_000_000, 2);
      this.update({ bandwidthMbps: Number.isFinite(downloadMbps) ? downloadMbps : null, uploadMbps: Number.isFinite(uploadMbps) ? uploadMbps : null, bandwidthStatus: Number.isFinite(downloadMbps) && Number.isFinite(uploadMbps) ? 'available' : 'unavailable' });
    } catch {
      this.update({ bandwidthStatus: 'unavailable' });
    } finally {
      if (timeout !== null) window.clearTimeout(timeout);
      this.bandwidthRequest = null;
      this.bandwidthRunning = false;
    }
  }
}

export const networkMonitor = new NetworkMonitor();
