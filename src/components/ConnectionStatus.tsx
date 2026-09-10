import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ConnectionLevel = 0 | 1 | 2 | 3 | 4;

interface ConnectionMetrics {
    level: ConnectionLevel;
    latencyMs: number | null;
    bandwidthMbps: number | null;
    jitterMs: number | null;
    audioLossPct: number | null;
    reconnects: number;
    online: boolean;
    checkedAt: Date | null;
}

interface NetworkInformationLike {
    downlink?: number;
    rtt?: number;
    effectiveType?: string;
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

const RTT_TIMEOUT_MS = 4500;
const SAMPLE_INTERVAL_MS = 5000;

const getConnection = (): NetworkInformationLike | null => {
    const nav = navigator as Navigator & { connection?: NetworkInformationLike; mozConnection?: NetworkInformationLike; webkitConnection?: NetworkInformationLike };
    return nav.connection || nav.mozConnection || nav.webkitConnection || null;
};

const clampLevel = (value: number): ConnectionLevel => Math.max(0, Math.min(4, Math.round(value))) as ConnectionLevel;

const levelFromMetrics = (online: boolean, latencyMs: number | null, bandwidthMbps: number | null): ConnectionLevel => {
    if (!online) return 0;
    if (latencyMs === null && bandwidthMbps === null) return 4;

    let score = 4;
    if (latencyMs !== null) {
        if (latencyMs > 500) score -= 3;
        else if (latencyMs > 250) score -= 2;
        else if (latencyMs > 120) score -= 1;
    }
    if (bandwidthMbps !== null) {
        if (bandwidthMbps < 1) score -= 3;
        else if (bandwidthMbps < 3) score -= 2;
        else if (bandwidthMbps < 8) score -= 1;
    }
    return clampLevel(score);
};

const formatMetric = (value: number | null, suffix = '') => value === null ? '—' : `${value}${suffix}`;

export const ConnectionStatus: React.FC = () => {
    const [metrics, setMetrics] = useState<ConnectionMetrics>({
        level: 4,
        latencyMs: null,
        bandwidthMbps: null,
        jitterMs: null,
        audioLossPct: null,
        reconnects: 0,
        online: navigator.onLine,
        checkedAt: null,
    });
    const reconnectsRef = useRef(0);
    const previousOnlineRef = useRef(navigator.onLine);
    const mountedRef = useRef(true);

    const measure = useCallback(async () => {
        const online = navigator.onLine;
        if (!online) {
            if (mountedRef.current) setMetrics(prev => ({ ...prev, online: false, level: 0, checkedAt: new Date() }));
            return;
        }

        const network = getConnection();
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), RTT_TIMEOUT_MS);
        const start = performance.now();
        let latencyMs: number | null = null;

        try {
            const url = `${window.location.origin}/?connection_probe=${Date.now()}`;
            const response = await fetch(url, {
                method: 'HEAD',
                cache: 'no-store',
                credentials: 'same-origin',
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Connection probe returned ${response.status}`);
            latencyMs = Math.max(0, Math.round(performance.now() - start));
        } catch {
            if (mountedRef.current) {
                setMetrics(prev => ({ ...prev, online: false, level: 0, checkedAt: new Date() }));
            }
            return;
        } finally {
            window.clearTimeout(timeout);
        }

        const bandwidthMbps = typeof network?.downlink === 'number' && Number.isFinite(network.downlink)
            ? Math.max(0, Number(network.downlink.toFixed(1)))
            : null;
        const browserRtt = typeof network?.rtt === 'number' && Number.isFinite(network.rtt) ? network.rtt : null;
        const effectiveLatency = latencyMs ?? browserRtt;
        const level = levelFromMetrics(true, effectiveLatency, bandwidthMbps);

        if (mountedRef.current) {
            setMetrics(prev => ({
                ...prev,
                online: true,
                latencyMs,
                bandwidthMbps,
                level,
                checkedAt: new Date(),
            }));
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        const handleOnline = () => {
            if (!previousOnlineRef.current) reconnectsRef.current += 1;
            previousOnlineRef.current = true;
            setMetrics(prev => ({ ...prev, online: true, reconnects: reconnectsRef.current, level: 4 }));
            void measure();
        };
        const handleOffline = () => {
            previousOnlineRef.current = false;
            setMetrics(prev => ({ ...prev, online: false, level: 0, checkedAt: new Date() }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        void measure();
        const timer = window.setInterval(() => void measure(), SAMPLE_INTERVAL_MS);

        const network = getConnection();
        const handleNetworkChange = () => void measure();
        network?.addEventListener?.('change', handleNetworkChange);

        return () => {
            mountedRef.current = false;
            window.clearInterval(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            network?.removeEventListener?.('change', handleNetworkChange);
        };
    }, [measure]);

    const bars = useMemo(() => Array.from({ length: 4 }, (_, index) => index < metrics.level), [metrics.level]);
    const statusLabel = !metrics.online ? 'Connection lost' : ['Poor', 'Poor', 'Fair', 'Good', 'Excellent'][metrics.level];
    const statusClass = !metrics.online ? 'connection-status--lost' : `connection-status--${metrics.level}`;

    return (
        <div className={`connection-status ${statusClass}`}>
            <button
                type="button"
                className="connection-status-trigger"
                aria-label={`Internet connection: ${statusLabel}. Hover for connection metrics.`}
                title="Connection quality"
            >
                <span className="connection-signal" aria-hidden="true">
                    {bars.map((filled, index) => (
                        <span key={index} className={`connection-bar ${filled ? 'is-filled' : ''}`} style={{ height: `${7 + index * 3}px` }} />
                    ))}
                </span>
                <span className="connection-status-text">{statusLabel}</span>
            </button>

            <div className="connection-status-popover" role="tooltip">
                <div className="connection-popover-header">
                    <span className="connection-popover-title">Connection quality</span>
                    <span className="connection-popover-state">{statusLabel}</span>
                </div>
                <div className="connection-metrics-grid">
                    <div><span>Round trip</span><strong>{formatMetric(metrics.latencyMs, ' ms')}</strong></div>
                    <div><span>Bandwidth</span><strong>{formatMetric(metrics.bandwidthMbps, ' Mbps')}</strong></div>
                    <div><span>Live call audio loss</span><strong>{metrics.audioLossPct === null ? 'N/A' : `${metrics.audioLossPct.toFixed(1)}%`}</strong></div>
                    <div><span>Jitter</span><strong>{metrics.jitterMs === null ? 'N/A' : `${metrics.jitterMs.toFixed(1)} ms`}</strong></div>
                    <div><span>Reconnects</span><strong>{metrics.reconnects}</strong></div>
                    <div><span>Last check</span><strong>{metrics.checkedAt ? metrics.checkedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Checking…'}</strong></div>
                </div>
                <div className="connection-popover-note">
                    Live-call audio loss and jitter show N/A until a supported WebRTC call exposes audio statistics.
                </div>
            </div>
        </div>
    );
};
