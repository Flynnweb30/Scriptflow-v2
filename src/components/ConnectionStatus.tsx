import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ConnectionLevel = 0 | 1 | 2 | 3 | 4;
type NetworkInformation = EventTarget & {
    downlink?: number;
    effectiveType?: string;
};

declare global {
    interface Navigator {
        connection?: NetworkInformation;
        mozConnection?: NetworkInformation;
        webkitConnection?: NetworkInformation;
    }
}

interface Metrics {
    latency: number | null;
    jitter: number | null;
    packetLoss: number;
    bandwidth: number | null;
    effectiveType: string;
    stability: number;
}

const PING_INTERVAL_MS = 8000;
const PING_TIMEOUT_MS = 4500;
const MAX_SAMPLES = 12;

const getConnection = (): NetworkInformation | undefined =>
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getLevel = (online: boolean, metrics: Metrics): ConnectionLevel => {
    if (!online) return 0;
    if (metrics.latency === null) return 4;
    const { latency, jitter, packetLoss, stability } = metrics;
    const quality =
        (latency <= 80 ? 40 : latency <= 150 ? 32 : latency <= 250 ? 22 : latency <= 450 ? 10 : 0) +
        (jitter === null ? 15 : jitter <= 20 ? 20 : jitter <= 40 ? 14 : jitter <= 80 ? 7 : 0) +
        (packetLoss === 0 ? 20 : packetLoss <= 5 ? 14 : packetLoss <= 15 ? 7 : 0) +
        stability * 20;
    if (quality >= 82) return 4;
    if (quality >= 62) return 3;
    if (quality >= 38) return 2;
    if (quality >= 15) return 1;
    return 0;
};

const formatMs = (value: number | null) => value === null ? '—' : `${Math.round(value)} ms`;
const formatBandwidth = (value: number | null) => value === null ? '—' : `${value.toFixed(value >= 10 ? 0 : 1)} Mbps`;
const formatLoss = (value: number) => `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
const formatType = (value: string) => value ? value.toUpperCase() : 'UNKNOWN';

export const ConnectionStatus: React.FC = () => {
    const [online, setOnline] = useState(() => navigator.onLine);
    const [reconnects, setReconnects] = useState(0);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [metrics, setMetrics] = useState<Metrics>(() => {
        const connection = getConnection();
        return {
            latency: null,
            jitter: null,
            packetLoss: 0,
            bandwidth: typeof connection?.downlink === 'number' ? connection.downlink : null,
            effectiveType: connection?.effectiveType || '',
            stability: 1,
        };
    });
    const samplesRef = useRef<number[]>([]);
    const attemptsRef = useRef(0);
    const failuresRef = useRef(0);
    const wasOfflineRef = useRef(false);

    const updateNetworkInfo = useCallback(() => {
        const connection = getConnection();
        setMetrics(current => ({
            ...current,
            bandwidth: typeof connection?.downlink === 'number' ? connection.downlink : current.bandwidth,
            effectiveType: connection?.effectiveType || current.effectiveType,
        }));
    }, []);

    const measureLatency = useCallback(async () => {
        if (!navigator.onLine) {
            setOnline(false);
            return;
        }
        attemptsRef.current += 1;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
        const started = performance.now();
        try {
            const response = await fetch(`/health?connectionProbe=${Date.now()}`, {
                method: 'GET', cache: 'no-store', signal: controller.signal, credentials: 'same-origin'
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const elapsed = performance.now() - started;
            samplesRef.current = [...samplesRef.current, elapsed].slice(-MAX_SAMPLES);
            const samples = samplesRef.current;
            const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
            const jitter = samples.length > 1
                ? samples.slice(1).reduce((sum, sample, index) => sum + Math.abs(sample - samples[index]), 0) / (samples.length - 1)
                : 0;
            setOnline(true);
            setMetrics(current => ({
                ...current,
                latency: average,
                jitter,
                packetLoss: (failuresRef.current / attemptsRef.current) * 100,
                stability: clamp((attemptsRef.current - failuresRef.current) / Math.max(attemptsRef.current, 1), 0, 1),
            }));
        } catch {
            failuresRef.current += 1;
            setOnline(navigator.onLine);
            setMetrics(current => ({
                ...current,
                packetLoss: (failuresRef.current / attemptsRef.current) * 100,
                stability: clamp((attemptsRef.current - failuresRef.current) / Math.max(attemptsRef.current, 1), 0, 1),
            }));
        } finally {
            window.clearTimeout(timeout);
            updateNetworkInfo();
        }
    }, [updateNetworkInfo]);

    useEffect(() => {
        const handleOnline = () => {
            setOnline(true);
            if (wasOfflineRef.current) setReconnects(count => count + 1);
            wasOfflineRef.current = false;
            void measureLatency();
        };
        const handleOffline = () => {
            wasOfflineRef.current = true;
            setOnline(false);
            setMetrics(current => ({ ...current, latency: null, jitter: null }));
        };
        const handleNetworkChange = () => updateNetworkInfo();
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        const connection = getConnection();
        connection?.addEventListener('change', handleNetworkChange);
        void measureLatency();
        const timer = window.setInterval(() => void measureLatency(), PING_INTERVAL_MS);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            connection?.removeEventListener('change', handleNetworkChange);
            window.clearInterval(timer);
        };
    }, [measureLatency, updateNetworkInfo]);

    const level = useMemo(() => getLevel(online, metrics), [online, metrics]);
    const stateLabel = level === 4 ? 'Excellent' : level === 3 ? 'Good' : level === 2 ? 'Fair' : level === 1 ? 'Poor' : 'Disconnected';
    const stateClass = level === 4 ? 'excellent' : level === 3 ? 'good' : level === 2 ? 'fair' : 'poor';

    return (
        <aside className={`connection-status connection-status--${stateClass}`} aria-label={`Internet connection: ${stateLabel}`}>
            <button
                className="connection-status__trigger"
                type="button"
                aria-label="Connection details"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen(open => !open)}
            >
                <span className="connection-status__bars" aria-hidden="true">
                    {[1, 2, 3, 4].map(bar => (
                        <span key={bar} className={`connection-status__bar ${bar <= level ? 'is-active' : ''}`} style={{ height: `${7 + bar * 4}px` }} />
                    ))}
                </span>
                <span className="connection-status__state">{stateLabel}</span>
            </button>
            <div className={`connection-status__popover ${detailsOpen ? 'is-open' : ''}`} role="tooltip">
                <div className="connection-status__popover-header">
                    <div>
                        <strong>Connection</strong>
                        <span>{online ? 'Live network monitor' : 'Connection lost'}</span>
                    </div>
                    <span className="connection-status__indicator" aria-hidden="true" />
                </div>
                <div className="connection-status__metrics">
                    <div><span>Round trip</span><strong>{formatMs(metrics.latency)}</strong></div>
                    <div><span>Bandwidth</span><strong>{formatBandwidth(metrics.bandwidth)}</strong></div>
                    <div><span>Jitter</span><strong>{formatMs(metrics.jitter)}</strong></div>
                    <div><span>Packet loss</span><strong>{formatLoss(metrics.packetLoss)}</strong></div>
                    <div><span>Stability</span><strong>{Math.round(metrics.stability * 100)}%</strong></div>
                    <div><span>Network</span><strong>{formatType(metrics.effectiveType)}</strong></div>
                    <div><span>Reconnects</span><strong>{reconnects}</strong></div>
                </div>
                <div className="connection-status__footer">Updates automatically while this page is open.</div>
            </div>
        </aside>
    );
};

export default ConnectionStatus;
