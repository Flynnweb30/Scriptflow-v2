export type ConnectionLevel = 0 | 1 | 2 | 3 | 4;

export interface NetworkMetrics {
    level: ConnectionLevel;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'lost' | 'testing';
    latencyMs: number | null;
    downloadMbps: number | null;
    uploadMbps: number | null;
    stabilityPercent: number | null;
    jitterMs: number | null;
    packetLossPercent: number | null;
    reconnects: number;
    online: boolean;
    testingBandwidth: boolean;
    lastUpdated: number;
}

type Listener = (metrics: NetworkMetrics) => void;

const PING_INTERVAL_MS = 15000;
const DOWNLOAD_INTERVAL_MS = 60000;
const UPLOAD_INTERVAL_MS = 120000;
const PING_TIMEOUT_MS = 5000;
const DOWNLOAD_BYTES = 256 * 1024;
const UPLOAD_BYTES = 128 * 1024;

const initialOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

const initialMetrics: NetworkMetrics = {
    level: initialOnline ? 4 : 0,
    status: initialOnline ? 'testing' : 'lost',
    latencyMs: null,
    downloadMbps: null,
    uploadMbps: null,
    stabilityPercent: null,
    jitterMs: null,
    packetLossPercent: initialOnline ? null : 100,
    reconnects: 0,
    online: initialOnline,
    testingBandwidth: false,
    lastUpdated: Date.now(),
};

class NetworkMonitor {
    private metrics: NetworkMetrics = initialMetrics;
    private listeners = new Set<Listener>();
    private started = false;
    private pingTimer: number | null = null;
    private downloadTimer: number | null = null;
    private uploadTimer: number | null = null;
    private pingInFlight = false;
    private bandwidthInFlight = false;
    private consecutiveFailures = 0;
    private probeSuccesses = 0;
    private probeFailures = 0;
    private rttSamples: number[] = [];
    private lastProbeFailure = false;

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.metrics);
        this.start();
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) this.stop();
        };
    }

    getSnapshot(): NetworkMetrics {
        return this.metrics;
    }

    private start(): void {
        if (this.started) return;
        this.started = true;
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        void this.runPing();
        this.pingTimer = window.setInterval(() => void this.runPing(), PING_INTERVAL_MS);
        this.downloadTimer = window.setInterval(() => void this.runBandwidthTest('download'), DOWNLOAD_INTERVAL_MS);
        this.uploadTimer = window.setInterval(() => void this.runBandwidthTest('upload'), UPLOAD_INTERVAL_MS);
        window.setTimeout(() => void this.runBandwidthTest('download'), 2500);
        window.setTimeout(() => void this.runBandwidthTest('upload'), 7000);
    }

    private stop(): void {
        if (!this.started) return;
        this.started = false;
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
        if (this.downloadTimer !== null) window.clearInterval(this.downloadTimer);
        if (this.uploadTimer !== null) window.clearInterval(this.uploadTimer);
        this.pingTimer = null;
        this.downloadTimer = null;
        this.uploadTimer = null;
    }

    private handleOnline = (): void => {
        this.consecutiveFailures = 0;
        this.setMetrics({
            online: true,
            level: 4,
            status: 'testing',
            packetLossPercent: null,
        });
        void this.runPing();
    };

    private handleOffline = (): void => {
        if (this.metrics.online || this.metrics.level > 0) {
            this.metrics.reconnects += 1;
        }
        this.consecutiveFailures = 0;
        this.setMetrics({
            online: false,
            level: 0,
            status: 'lost',
            latencyMs: null,
            jitterMs: null,
            packetLossPercent: 100,
            stabilityPercent: this.calculateStability(),
            testingBandwidth: false,
        });
    };

    private async runPing(): Promise<void> {
        if (this.pingInFlight || !navigator.onLine) return;
        this.pingInFlight = true;
        const startedAt = performance.now();
        try {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
            const response = await fetch(`/api/network/ping?t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
                signal: controller.signal,
            });
            window.clearTimeout(timeout);
            if (!response.ok) throw new Error(`Ping failed: ${response.status}`);
            const rtt = Math.max(0.1, performance.now() - startedAt);
            this.probeSuccesses += 1;
            this.consecutiveFailures = 0;
            this.rttSamples = [...this.rttSamples.slice(-9), rtt];
            const jitter = this.calculateJitter();
            const packetLoss = this.calculatePacketLoss();
            const recovered = this.lastProbeFailure;
            this.lastProbeFailure = false;
            if (recovered) this.metrics.reconnects += 1;
            this.setMetrics({
                online: true,
                latencyMs: Math.round(rtt),
                jitterMs: jitter === null ? null : Math.round(jitter),
                packetLossPercent: packetLoss,
                stabilityPercent: this.calculateStability(),
                reconnects: this.metrics.reconnects,
            });
        } catch {
            this.probeFailures += 1;
            this.consecutiveFailures += 1;
            this.lastProbeFailure = true;
            const packetLoss = this.calculatePacketLoss();
            const lost = !navigator.onLine || this.consecutiveFailures >= 3;
            this.setMetrics({
                online: !lost,
                level: lost ? 0 : Math.min(this.metrics.level, 1) as ConnectionLevel,
                status: lost ? 'lost' : 'poor',
                latencyMs: null,
                jitterMs: this.calculateJitter(),
                packetLossPercent: packetLoss,
                stabilityPercent: this.calculateStability(),
            });
        } finally {
            this.pingInFlight = false;
        }
    }

    private async runBandwidthTest(direction: 'download' | 'upload'): Promise<void> {
        if (this.bandwidthInFlight || !navigator.onLine) return;
        this.bandwidthInFlight = true;
        this.setMetrics({ testingBandwidth: true });
        try {
            if (direction === 'download') {
                const startedAt = performance.now();
                const response = await fetch(`/api/network/download?bytes=${DOWNLOAD_BYTES}&t=${Date.now()}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' },
                });
                if (!response.ok) throw new Error(`Download test failed: ${response.status}`);
                const data = await response.arrayBuffer();
                const durationSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
                const mbps = (data.byteLength * 8) / durationSeconds / 1_000_000;
                this.setMetrics({ downloadMbps: Math.round(mbps * 10) / 10 });
            } else {
                const payload = new Uint8Array(UPLOAD_BYTES);
                const startedAt = performance.now();
                const response = await fetch(`/api/network/upload?t=${Date.now()}`, {
                    method: 'POST',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-cache' },
                    body: payload,
                });
                if (!response.ok) throw new Error(`Upload test failed: ${response.status}`);
                await response.arrayBuffer();
                const durationSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
                const mbps = (payload.byteLength * 8) / durationSeconds / 1_000_000;
                this.setMetrics({ uploadMbps: Math.round(mbps * 10) / 10 });
            }
        } catch {
            this.setMetrics({});
        } finally {
            this.bandwidthInFlight = false;
            this.setMetrics({ testingBandwidth: false });
        }
    }

    private calculateJitter(): number | null {
        if (this.rttSamples.length < 2) return null;
        const differences = this.rttSamples.slice(1).map((value, index) => Math.abs(value - this.rttSamples[index]));
        return differences.reduce((sum, value) => sum + value, 0) / differences.length;
    }

    private calculatePacketLoss(): number {
        const total = this.probeSuccesses + this.probeFailures;
        if (!total) return 0;
        return Math.round((this.probeFailures / total) * 1000) / 10;
    }

    private calculateStability(): number {
        const total = this.probeSuccesses + this.probeFailures;
        if (!total) return 100;
        return Math.round((this.probeSuccesses / total) * 1000) / 10;
    }

    private deriveLevel(metrics: NetworkMetrics): ConnectionLevel {
        if (!metrics.online) return 0;
        if (metrics.latencyMs === null || metrics.packetLossPercent === null) return 4;
        const bandwidthReady = metrics.downloadMbps !== null && metrics.uploadMbps !== null;
        const download = metrics.downloadMbps ?? Number.POSITIVE_INFINITY;
        const upload = metrics.uploadMbps ?? Number.POSITIVE_INFINITY;
        const jitter = metrics.jitterMs ?? 0;
        const loss = metrics.packetLossPercent;
        if (metrics.latencyMs <= 100 && jitter <= 20 && loss <= 1 && (!bandwidthReady || (download >= 5 && upload >= 1))) return 4;
        if (metrics.latencyMs <= 200 && jitter <= 40 && loss <= 3 && (!bandwidthReady || (download >= 2 && upload >= 0.5))) return 3;
        if (metrics.latencyMs <= 350 && jitter <= 80 && loss <= 7 && (!bandwidthReady || (download >= 1 && upload >= 0.25))) return 2;
        return 1;
    }

    private deriveStatus(level: ConnectionLevel): NetworkMetrics['status'] {
        if (level === 0) return 'lost';
        if (level === 1) return 'poor';
        if (level === 2) return 'fair';
        if (level === 3) return 'good';
        return 'excellent';
    }

    private setMetrics(patch: Partial<NetworkMetrics>): void {
        const next = { ...this.metrics, ...patch, lastUpdated: Date.now() };
        if (patch.level === undefined && patch.status === undefined && next.status !== 'testing') {
            const level = this.deriveLevel(next);
            next.level = level;
            next.status = this.deriveStatus(level);
        }
        this.metrics = next;
        this.listeners.forEach(listener => listener(this.metrics));
    }
}

export const networkMonitor = new NetworkMonitor();
