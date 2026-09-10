import React, { useEffect, useState } from 'react';
import { NetworkMetrics, networkMonitor } from '../services/NetworkMonitor';

const initialMetrics = networkMonitor.getSnapshot();

const formatMetric = (value: number | null, unit: string) => value === null ? '—' : `${value}${unit}`;

const getQualityLabel = (metrics: NetworkMetrics) => {
  if (!metrics.online || metrics.signal === 0) return 'Offline';
  return ['Poor', 'Fair', 'Good', 'Excellent'][metrics.signal - 1] || 'Excellent';
};

export const NetworkStatus: React.FC = () => {
  const [metrics, setMetrics] = useState<NetworkMetrics>(initialMetrics);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => networkMonitor.subscribe(setMetrics), []);

  const quality = getQualityLabel(metrics);
  const label = metrics.online
    ? `Internet connection: ${quality}, ${metrics.signal} of 4 bars`
    : 'Internet connection unavailable: 0 bars';

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
        aria-label={label}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={`network-bars network-bars-${metrics.signal}`} aria-hidden="true">
          {[1, 2, 3, 4].map((bar) => <span key={bar} className="network-bar" />)}
        </span>
        <span className={`network-status-dot ${metrics.online ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
        <span className="network-status-label">{quality}</span>
      </button>

      {expanded && (
        <div className="network-status-popover" role="tooltip">
          <div className="network-status-heading">
            <span>Connection quality</span>
            <span className={metrics.online ? `network-quality-text network-quality-text-${metrics.signal}` : 'network-offline-text'}>
              {quality}
            </span>
          </div>
          <div className="network-metric-grid">
            <div><span>Round trip</span><strong>{formatMetric(metrics.rttMs, ' ms')}</strong></div>
            <div><span>Bandwidth</span><strong>{formatMetric(metrics.bandwidthMbps, ' Mbps')}</strong></div>
            <div><span>Packet loss</span><strong>{metrics.packetLossPercent.toFixed(1)}%</strong></div>
            <div><span>Jitter</span><strong>{formatMetric(metrics.jitterMs, ' ms')}</strong></div>
            <div><span>Stability</span><strong>{formatMetric(metrics.stabilityPercent, '%')}</strong></div>
            <div><span>Reconnects</span><strong>{metrics.reconnects}</strong></div>
          </div>
          <div className="network-status-footnote">
            Metrics update automatically. Bandwidth uses the browser's live network estimate; packet loss and jitter are derived from recent connectivity checks. If a live call is active, these network metrics can help identify connection-related audio issues.
          </div>
        </div>
      )}
    </div>
  );
};
