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
type LiveCallStateEvent = CustomEvent<{ active?: boolean }>;

declare global {
  interface Window {
    __SCRIPTFLOW_LIVE_CALL_ACTIVE__?: boolean;
  }
}

const HEARTBEAT_INTERVAL_MS = 5000;
const BANDWIDTH_INTERVAL_MS = 60000;
const BANDWIDTH_TIMEOUT_MS = 12000;
const HEARTBEAT_TIMEOUT_MS = 4500;
const HISTORY_SIZE = 20;
const DOWNLOAD_BYTES = 500_000;
const UPLOAD_BYTES = 250_000;
const DOWNLOAD_URL = '/api/network/download';
const UPLOAD_URL = '/api/network/upload';

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
  private liveCallActive = typeof window !== 'undefined' ? Boolean(window.__SCRIPTFLOW_LIVE_CALL_ACTIVE__) : false;
  private rttHistory: number[] = [];
  private probeHistory: boolean[] = [];
  private totalSamples = 0;
  private failedSamples = 0;
  private reconnects = 0;
  private connectionLost = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  private consecutiveFailures = 0;
  private bandwidthRunning = false;
  private lastBandwidthTestAt = 0;
  private jitterDecisionMs: number | null = null;
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

  getSnapshot() {
    return this.metrics;
  }

  private start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('pageshow', this.handlePageShow);
    window.addEventListener('pagehide', this.handlePageHide);
    window.addEventListener('scriptflow:live-call-state', this.handleLiveCallState as EventListener);
    document.addEventListener('visibilitychange', this.handleVisibility);
    getConnectionInfo()?.addEventListener?.('change', this.handleConnectionChange);
    void this.sample();
    this.scheduleHeartbeat();
    this.scheduleBandwidth();
  }

  private stopIfUnused() {
    if (this.listeners.size === 0) this.stop();
  }

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
    this.bandwidthRunning = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('pageshow', this.handlePageShow);
    window.removeEventListener('pagehide', this.handlePageHide);
    window.removeEventListener('scriptflow:live-call-state', this.handleLiveCallState as EventListener);
    document.removeEventListener('visibilitychange', this.handleVisibility);
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
      if (!this.hidden && !this.liveCallActive) await this.measureBandwidth();
      this.scheduleBandwidth();
    }, BANDWIDTH_INTERVAL_MS);
  }

  private handleOnline = () => {
    if (this.connectionLost) this.reconnects += 1;
    this.connectionLost = false;
    this.consecutiveFailures = 0;
    this.update({ online: true, signal: 4, reconnects: this.reconnects });
    void this.sample();
  };

  private handleOffline = () => {
    this.connectionLost = true;
    this.consecutiveFailures = 0;
    this.jitterDecisionMs = null;
    this.update({ online: false, signal: 0, rttMs: null, jitterMs: null, packetLossPercent: 100, stabilityPercent: 0 });
  };

  private handleVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden) {
      this.heartbeatRequest?.abort();
      this.bandwidthRequest?.abort();
      return;
    }
    void this.sample();
    if (!this.liveCallActive && Date.now() - this.lastBandwidthTestAt >= BANDWIDTH_INTERVAL_MS) void this.measureBandwidth();
    this.scheduleHeartbeat();
    this.scheduleBandwidth();
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
    if (!this.liveCallActive && Date.now() - this.lastBandwidthTestAt >= BANDWIDTH_INTERVAL_MS) void this.measureBandwidth();
    this.scheduleHeartbeat();
    this.scheduleBandwidth();
  };

  private handleConnectionChange = () => {
    void this.sample();
  };

  private handleLiveCallState = (event: LiveCallStateEvent) => {
    this.liveCallActive = Boolean(event.detail?.active);
    if (this.liveCallActive) {
      this.bandwidthRequest?.abort();
      this.update({ bandwidthStatus: 'idle' });
    } else if (!this.hidden && Date.now() - this.lastBandwidthTestAt >= BANDWIDTH_INTERVAL_MS) {
      void this.measureBandwidth();
    }
  };

  private calculateJitter() {
    if (this.rttHistory.length < 2) return null;
    let deltaSum = 0;
    for (let i = 1; i < this.rttHistory.length; i += 1) deltaSum += Math.abs(this.rttHistory[i] - this.rttHistory[i - 1]);
    return round(deltaSum / (this.rttHistory.length - 1), 1);
  }

  private updateJitterDecision(rawJitter: number | null) {
    if (rawJitter === null) {
      this.jitterDecisionMs = null;
      return;
    }
    // Adaptive smoothing is used only for the signal decision. The raw measured
    // jitter remains untouched in metrics.jitterMs and is what users see.
    this.jitterDecisionMs = this.jitterDecisionMs === null
      ? rawJitter
      : round((this.jitterDecisionMs * 0.65) + (rawJitter * 0.35), 1);
  }

  private calculatePacketLoss() {
    if (this.probeHistory.length === 0) return null;
    const failures = this.probeHistory.filter(success => !success).length;
    return round((failures / this.probeHistory.length) * 100, 1);
  }

  private calculateStability(jitter = this.jitterDecisionMs) {
    const loss = this.calculatePacketLoss();
    if (loss === null) return null;
    const lossPenalty = Math.min(100, loss * 3);
    const jitterPenalty = jitter === null ? 0 : Math.min(40, jitter / 2);
    return round(Math.max(0, 100 - lossPenalty - jitterPenalty), 1);
  }

  private calculateSignal(online: boolean, rttMs: number | null, jitterMs: number | null, downloadMbps: number | null, uploadMbps: number | null, loss: number | null): 0 | 1 | 2 | 3 | 4 {
    if (!online) return 0;
    // Jitter is deliberately evaluated first because it is the most important
    // live-call quality signal. Other metrics can only reduce the resulting level.
    let score = 4;
    if (jitterMs !== null) {
      if (jitterMs > 80) score = 1;
      else if (jitterMs > 40) score = 2;
      else if (jitterMs > 20) score = 3;
    }
    if (rttMs !== null) {
      if (rttMs > 300) score = Math.min(score, 1);
      else if (rttMs > 150) score = Math.min(score, 2);
      else if (rttMs > 80) score = Math.min(score, 3);
    }
    if (loss !== null) {
      if (loss >= 10) score = Math.min(score, 1);
      else if (loss >= 5) score = Math.min(score, 2);
      else if (loss >= 2) score = Math.min(score, 3);
    }
    if (downloadMbps !== null) {
      if (downloadMbps < 1) score = Math.min(score, 1);
      else if (downloadMbps < 3) score = Math.min(score, 2);
      else if (downloadMbps < 10) score = Math.min(score, 3);
    }
    if (uploadMbps !== null) {
      if (uploadMbps < 0.25) score = Math.min(score, 1);
      else if (uploadMbps < 0.5) score = Math.min(score, 2);
      else if (uploadMbps < 1) score = Math.min(score, 3);
    }
    return score as 1 | 2 | 3 | 4;
  }

  private update(partial: Partial<NetworkMetrics>) {
    const next = { ...this.metrics, ...partial, reconnects: this.reconnects, samples: this.totalSamples, failedSamples: this.failedSamples, updatedAt: Date.now() };
    if (partial.packetLossPercent === undefined) next.packetLossPercent = this.calculatePacketLoss();
    if (partial.stabilityPercent === undefined) next.stabilityPercent = this.calculateStability();
    this.metrics = next;
    this.listeners.forEach(listener => listener(this.metrics));
  }

  private async sample() {
    if (!this.started || this.hidden) return;
    if (!navigator.onLine) {
      this.connectionLost = true;
      this.update({ online: false, signal: 0, rttMs: null, jitterMs: null });
      return;
    }

    this.heartbeatRequest?.abort();
    const controller = new AbortController();
    this.heartbeatRequest = controller;
    const timer = window.setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    const startedAt = performance.now();

    try {
      const response = await fetch(`${'/api/network/ping'}?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) throw new Error(`Heartbeat ${response.status}`);
      const rttMs = Math.max(1, Math.round(performance.now() - startedAt));
      this.totalSamples += 1;
      this.probeHistory = [...this.probeHistory.slice(-(HISTORY_SIZE - 1)), true];
      this.rttHistory = [...this.rttHistory.slice(-(HISTORY_SIZE - 1)), rttMs];
      this.consecutiveFailures = 0;
      const recovered = this.connectionLost;
      this.connectionLost = false;
      if (recovered) this.reconnects += 1;
      const rawJitter = this.calculateJitter();
      this.updateJitterDecision(rawJitter);
      const packetLoss = this.calculatePacketLoss();
      const signal = this.calculateSignal(true, rttMs, this.jitterDecisionMs, this.metrics.bandwidthMbps, this.metrics.uploadMbps, packetLoss);
      this.update({ online: true, rttMs, jitterMs: rawJitter, packetLossPercent: packetLoss, stabilityPercent: this.calculateStability(), signal, reconnects: this.reconnects });
    } catch {
      if (controller.signal.aborted) return;
      this.totalSamples += 1;
      this.failedSamples += 1;
      this.consecutiveFailures += 1;
      this.probeHistory = [...this.probeHistory.slice(-(HISTORY_SIZE - 1)), false];
      const packetLoss = this.calculatePacketLoss();
      const confirmedLost = !navigator.onLine || this.consecutiveFailures >= 3;
      if (confirmedLost && !this.connectionLost) this.connectionLost = true;
      if (confirmedLost) this.jitterDecisionMs = null;
      const signal = confirmedLost ? 0 : this.calculateSignal(true, null, null, this.metrics.bandwidthMbps, this.metrics.uploadMbps, packetLoss);
      this.update({
        online: !confirmedLost,
        signal,
        rttMs: null,
        jitterMs: null,
        packetLossPercent: packetLoss,
        stabilityPercent: this.calculateStability(null),
      });
    } finally {
      window.clearTimeout(timer);
      if (this.heartbeatRequest === controller) this.heartbeatRequest = null;
    }
  }

  private async measureBandwidth() {
    if (!this.started || this.hidden || this.liveCallActive || !navigator.onLine || this.bandwidthRunning) return;
    this.bandwidthRunning = true;
    this.lastBandwidthTestAt = Date.now();
    this.update({ bandwidthStatus: 'testing', bandwidthMbps: null, uploadMbps: null });
    const controller = new AbortController();
    this.bandwidthRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), BANDWIDTH_TIMEOUT_MS);

    try {
      const downloadStart = performance.now();
      const downloadResponse = await fetch(`${DOWNLOAD_URL}?bytes=${DOWNLOAD_BYTES}&t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!downloadResponse.ok) throw new Error(`Download ${downloadResponse.status}`);
      const downloadBuffer = await downloadResponse.arrayBuffer();
      const downloadSeconds = Math.max((performance.now() - downloadStart) / 1000, 0.001);
      const downloadMbps = round((downloadBuffer.byteLength * 8) / downloadSeconds / 1_000_000, 2);

      if (this.hidden || this.liveCallActive || !navigator.onLine) return;

      const uploadBody = new Uint8Array(UPLOAD_BYTES);
      const uploadStart = performance.now();
      const uploadResponse = await fetch(`${UPLOAD_URL}?t=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-cache' },
        body: uploadBody,
        signal: controller.signal,
      });
      if (!uploadResponse.ok) throw new Error(`Upload ${uploadResponse.status}`);
      await uploadResponse.arrayBuffer();
      const uploadSeconds = Math.max((performance.now() - uploadStart) / 1000, 0.001);
      const uploadMbps = round((uploadBody.byteLength * 8) / uploadSeconds / 1_000_000, 2);

      this.update({ bandwidthMbps: Number.isFinite(downloadMbps) ? downloadMbps : null, uploadMbps: Number.isFinite(uploadMbps) ? uploadMbps : null, bandwidthStatus: Number.isFinite(downloadMbps) && Number.isFinite(uploadMbps) ? 'available' : 'unavailable' });
    } catch {
      // A bandwidth-test failure is not a connection-loss signal. The live
      // heartbeat continues independently and will determine connectivity.
      this.update({ bandwidthMbps: null, uploadMbps: null, bandwidthStatus: 'unavailable' });
    } finally {
      window.clearTimeout(timeout);
      if (this.bandwidthRequest === controller) this.bandwidthRequest = null;
      this.bandwidthRunning = false;
    }
  }
}

export const networkMonitor = new NetworkMonitor();
