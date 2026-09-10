import React, { useEffect, useState } from 'react';
import { NetworkMetrics, networkMonitor } from '../services/NetworkMonitor';

const initialMetrics = networkMonitor.getSnapshot();

const formatMetric = (value: number | null, unit: string) => value === null ? '—' : `${value}${unit}`;

export const NetworkStatus: React.FC = () => {
  const [metrics, setMetrics] = useState<NetworkMetrics>(initialMetrics);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => networkMonitor.subscribe(setMetrics), []);

  const label = metrics.online ? `Internet connection: ${metrics.signal} of 4 bars` : 'Internet connection unavailable';

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
        className="network-status-trigger"
        aria-label={label}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={`network-bars network-bars-${metrics.signal}`} aria-hidden="true">
          {[1, 2, 3, 4].map((bar) => <span key={bar} className="network-bar" />)}
        </span>
        <span className={`network-status-dot ${metrics.online ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
        <span className="network-status-label">{metrics.online ? 'Connection' : 'Offline'}</span>
      </button>

      {expanded && (
        <div className="network-status-popover" role="tooltip">
          <div className="network-status-heading">
            <span>Network quality</span>
            <span className={metrics.online ? 'network-online-text' : 'network-offline-text'}>
              {metrics.online ? 'Live' : 'Offline'}
            </span>
          </div>
          <div className="network-metric-grid">
            <div><span>Round trip</span><strong>{formatMetric(metrics.rttMs, ' ms')}</strong></div>
            <div><span>Bandwidth</span><strong>{formatMetric(metrics.bandwidthMbps, ' Mbps')}</strong></div>
            <div><span>Live internet loss</span><strong>{metrics.packetLossPercent.toFixed(1)}%</strong></div>
            <div><span>Jitter</span><strong>{formatMetric(metrics.jitterMs, ' ms')}</strong></div>
            <div><span>Reconnects</span><strong>{metrics.reconnects}</strong></div>
            <div><span>Samples</span><strong>{metrics.samples}</strong></div>
          </div>
          <div className="network-status-footnote">
            Bandwidth is the browser's live network estimate. Loss and jitter are calculated from recent same-origin connectivity samples.
          </div>
        </div>
      )}
    </div>
  );
};
