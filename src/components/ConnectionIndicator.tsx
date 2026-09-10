import React, { useEffect, useState } from 'react';
import { networkMonitor, NetworkMetrics } from '../services/NetworkMonitor';

const levelLabel: Record<NetworkMetrics['level'], string> = {
    0: 'Connection Lost',
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Excellent / Stable',
};

const formatMetric = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${value}${suffix}`;

export const ConnectionIndicator: React.FC = () => {
    const [metrics, setMetrics] = useState<NetworkMetrics>(() => networkMonitor.getSnapshot());

    useEffect(() => networkMonitor.subscribe(setMetrics), []);

    const level = metrics.online ? metrics.level : 0;
    const statusClass = level === 0 ? 'connection-indicator-lost' : level <= 1 ? 'connection-indicator-poor' : level === 2 ? 'connection-indicator-fair' : 'connection-indicator-good';

    return (
        <div className={`connection-indicator ${statusClass}`} tabIndex={0} title={`Internet connection: ${levelLabel[level]}`}>
            <div className="connection-indicator-main" aria-label={`Internet connection ${levelLabel[level]}`}>
                <span className="connection-indicator-icon" aria-hidden="true">
                    {[0, 1, 2, 3].map((bar) => (
                        <span key={bar} className={`connection-bar ${bar < level ? 'filled' : ''}`} style={{ height: `${7 + bar * 3}px` }} />
                    ))}
                </span>
                <span className="connection-indicator-copy">
                    <span className="connection-indicator-title">Internet</span>
                    <span className="connection-indicator-status">{metrics.status === 'testing' ? 'Testing…' : levelLabel[level]}</span>
                </span>
            </div>
            <div className="connection-metrics-popover" role="tooltip">
                <div className="connection-metrics-heading">
                    <span>Live Connection</span>
                    <span className="connection-metrics-state">{metrics.status === 'testing' ? 'Testing' : levelLabel[level]}</span>
                </div>
                <div className="connection-metrics-grid">
                    <Metric label="Round-trip" value={formatMetric(metrics.latencyMs, ' ms')} />
                    <Metric label="Download" value={formatMetric(metrics.downloadMbps, ' Mbps')} />
                    <Metric label="Upload" value={formatMetric(metrics.uploadMbps, ' Mbps')} />
                    <Metric label="Stability" value={formatMetric(metrics.stabilityPercent, '%')} />
                    <Metric label="Jitter" value={formatMetric(metrics.jitterMs, ' ms')} />
                    <Metric label="Packet loss" value={formatMetric(metrics.packetLossPercent, '%')} />
                    <Metric label="Live-call audio loss" value={metrics.online ? formatMetric(metrics.packetLossPercent, '%') : '100%'} />
                    <Metric label="Reconnects" value={String(metrics.reconnects)} />
                    <Metric label="Bandwidth test" value={metrics.testingBandwidth ? 'Running…' : 'Standby'} />
                </div>
                <div className="connection-metrics-footnote">Lightweight live probes; bandwidth tests run periodically.</div>
            </div>
        </div>
    );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="connection-metric">
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);
