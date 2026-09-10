import React, { useEffect, useState } from 'react';
import { NetworkMetrics, networkMonitor } from '../services/NetworkMonitor';

const metric = (value: number | null, unit = '') => value === null ? 'Unavailable' : `${value}${unit}`;

const quality = (metrics: NetworkMetrics) => {
    if (!metrics.online || metrics.signal === 0) return 'Connection Lost';
    return ['Unavailable', 'Poor', 'Fair', 'Good', 'Excellent / Stable'][metrics.signal];
};

export const ConnectionStatus: React.FC = () => {
    const [metrics, setMetrics] = useState<NetworkMetrics>(() => networkMonitor.getSnapshot());
    const [expanded, setExpanded] = useState(false);

    useEffect(() => networkMonitor.subscribe(setMetrics), []);

    const label = quality(metrics);
    const download = metrics.bandwidthStatus === 'testing' ? 'Testing…' : metric(metrics.bandwidthMbps, ' Mbps');
    const upload = metrics.bandwidthStatus === 'testing' ? 'Testing…' : metric(metrics.uploadMbps, ' Mbps');
    const stability = metrics.stabilityPercent === null ? 'Unavailable' : `${metrics.stabilityPercent}%`;

    return (
        <div
            className="network-status"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            onFocus={() => setExpanded(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
            }}
        >
            <button
                type="button"
                className={`network-status-trigger network-quality-${metrics.signal}`}
                aria-label={`Internet connection: ${label}, ${metrics.signal} of 4 bars`}
                aria-expanded={expanded}
                title="Connection quality"
                onClick={() => setExpanded((value) => !value)}
            >
                <span className={`network-bars network-bars-${metrics.signal}`} aria-hidden="true">
                    {[1, 2, 3, 4].map((bar) => <span key={bar} className="network-bar" />)}
                </span>
                <span className={`network-status-dot ${metrics.online ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
                <span className="network-status-label">{label}</span>
            </button>

            {expanded && (
                <div className="network-status-popover" role="tooltip">
                    <div className="network-status-heading">
                        <span>Live Connection</span>
                        <span className={metrics.online ? `network-quality-text-${metrics.signal}` : 'network-offline-text'}>{label}</span>
                    </div>
                    <div className="network-metric-grid">
                        <div><span>Jitter</span><strong>{metric(metrics.jitterMs, ' ms')}</strong></div>
                        <div><span>Round trip</span><strong>{metric(metrics.rttMs, ' ms')}</strong></div>
                        <div><span>Packet loss</span><strong>{metric(metrics.packetLossPercent, '%')}</strong></div>
                        <div><span>Stability</span><strong>{stability}</strong></div>
                        <div><span>Download</span><strong>{download}</strong></div>
                        <div><span>Upload</span><strong>{upload}</strong></div>
                        <div><span>Reconnects</span><strong>{metrics.reconnects}</strong></div>
                        <div><span>Audio loss</span><strong>N/A</strong></div>
                    </div>
                    <div className="network-status-footnote">Jitter is the primary live-call quality signal. Audio-loss statistics are N/A because ScriptFlow does not currently own a WebRTC media session; packet loss and stability are used instead. Bandwidth tests pause during an active live-call state.</div>
                </div>
            )}
        </div>
    );
};
