import React, { useEffect, useState } from 'react';

export const SpeedTest: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoaded(current => { if (!current) setFallback(true); return current; });
    }, 10000);
    return () => window.clearTimeout(timer);
  }, []);

  return <section className="speed-test-panel" aria-label="Internet speed test">
    <div className="speed-test-header">
      <div>
        <div className="speed-test-eyebrow">NETWORK TOOLS</div>
        <h2>Speed Test</h2>
        <p>Run a full internet speed test with Fast.com. The test starts only when this tab is opened.</p>
      </div>
      <a className="speed-test-external" href="https://fast.com/" target="_blank" rel="noopener noreferrer">
        Open Fast.com <i className="fas fa-external-link-alt" aria-hidden="true" />
      </a>
    </div>
    <div className="speed-test-frame-wrap">
      {!loaded && !fallback && <div className="speed-test-loading"><i className="fas fa-spinner fa-spin" aria-hidden="true" /><span>Loading Fast.com…</span></div>}
      {!fallback && <iframe src="https://fast.com/" title="Fast.com Internet Speed Test" width="100%" height="400" frameBorder="0" scrolling="no" loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFallback(true)} />}
      {fallback && <div className="speed-test-fallback">
        <div className="speed-test-fallback-icon"><i className="fas fa-gauge-high" aria-hidden="true" /></div>
        <h3>Fast.com could not be embedded</h3>
        <p>Your browser or Fast.com may block embedded tests. Open it in a new tab to run the test normally.</p>
        <a href="https://fast.com/" target="_blank" rel="noopener noreferrer" className="btn-primary">Open Fast.com</a>
      </div>}
    </div>
  </section>;
};
