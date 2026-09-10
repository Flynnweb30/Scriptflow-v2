import React, { useEffect, useState } from 'react';
import { NetworkMetrics, networkMonitor } from '../services/NetworkMonitor';

const metric = (value: number | null, unit = '') => value === null ? 'Unavailable' : `${value}${unit}`;
const quality = (m: NetworkMetrics) => !m.online || m.signal === 0 ? 'Connection Lost' : ['Unavailable', 'Poor', 'Fair', 'Good', 'Excellent'][m.signal];

export const ConnectionStatus: React.FC = () => {
  const [metrics, setMetrics] = useState<NetworkMetrics>(() => networkMonitor.getSnapshot());
  const [expanded, setExpanded] = useState(false);
  useEffect(() => networkMonitor.subscribe(setMetrics), []);
  const label = quality(metrics);
  const download = metrics.bandwidthStatus === 'testing' ? 'Testing…' : metric(metrics.bandwidthMbps, ' Mbps');
  const upload = metrics.bandwidthStatus === 'testing' ? 'Testing…' : metric(metrics.uploadMbps, ' Mbps');
  return <div className="network-status" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)} onFocus={() => setExpanded(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setExpanded(false); }}>
    <button type="button" className={`network-status-trigger network-quality-${metrics.signal}`} aria-label={!metrics.online ? 'Internet connection lost: 0 bars' : `Internet connection: ${label}, ${metrics.signal} of 4 bars`} aria-expanded={expanded} title="Connection quality" onClick={() => setExpanded(v => !v)}>
      <span className={`network-bars network-bars-${metrics.signal}`} aria-hidden="true">{[1,2,3,4].map(bar => <span key={bar} className="network-bar" />)}</span>
      <span className={`network-status-dot ${metrics.online ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
      <span className="network-status-label">{label}</span>
    </button>
    {expanded && <div className="network-status-popover" role="tooltip">
      <div className="network-status-heading"><span>Connection quality</span><span className={metrics.online ? `network-quality-text network-quality-text-${metrics.signal}` : 'network-offline-text'}>{label}</span></div>
      <div className="network-metric-grid">
        <div><span>Round trip</span><strong>{metric(metrics.rttMs, ' ms')}</strong></div>
        <div><span>Download</span><strong>{download}</strong></div>
        <div><span>Upload</span><strong>{upload}</strong></div>
        <div><span>Jitter</span><strong>{metric(metrics.jitterMs, ' ms')}</strong></div>
        <div><span>Packet loss</span><strong>{metrics.packetLossPercent === null ? 'Unavailable' : `${metrics.packetLossPercent.toFixed(1)}%`}</strong></div>
        <div><span>Stability</span><strong>{metric(metrics.stabilityPercent, '%')}</strong></div>
        <div><span>Reconnects</span><strong>{metrics.reconnects}</strong></div>
        <div><span>Samples</span><strong>{metrics.samples}</strong></div>
      </div>
      <div className="network-status-footnote">Latency and loss use lightweight probes. Download/upload use separate throughput tests and a failed speed test never marks the connection as lost.</div>
    </div>}
  </div>;
};
