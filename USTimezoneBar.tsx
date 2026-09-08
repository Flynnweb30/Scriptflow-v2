import React, { useEffect, useMemo, useState } from 'react';
import { US_TIMEZONE_OPTIONS } from '../utils/timezone-utils';

const formatClock = (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
}).format(date);

const formatExactLocal = (date: Date) => new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
}).format(date);

export const USTimezoneBar: React.FC = () => {
    const [now, setNow] = useState(() => new Date());
    const clocks = useMemo(() => US_TIMEZONE_OPTIONS.map(option => ({
        ...option,
        value: formatClock(now, option.iana),
    })), [now]);

    useEffect(() => {
        const tick = () => setNow(new Date());
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <div className="us-timezone-bar" role="status" aria-label="Current US timezone clocks">
            <span className="us-timezone-exact">
                <span className="us-timezone-live-dot" aria-hidden="true" />
                <span className="us-timezone-exact-label">EXACT</span>
                <span>{formatExactLocal(now)}</span>
            </span>
            <span className="us-timezone-divider" aria-hidden="true" />
            {clocks.map((clock) => (
                <span className="us-timezone-clock" key={clock.iana} title={`${clock.label} — live current time`}>
                    <span className="us-timezone-label">{clock.shortLabel}</span>
                    <span className="us-timezone-value">{clock.value.replace(/\s+/, ' ')}</span>
                </span>
            ))}
        </div>
    );
};
