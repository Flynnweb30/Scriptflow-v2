import React, { useEffect, useState } from 'react';
import { getWorkspaceTimezone, setWorkspaceTimezone, US_TIMEZONE_OPTIONS } from '../utils/timezone-utils';

/**
 * Global timezone context/control. Kept outside individual views so the same
 * booking timezone preference is visible and available throughout the app.
 */
export const USTimezoneBar: React.FC = () => {
    const [selected, setSelected] = useState(getWorkspaceTimezone());

    useEffect(() => {
        const sync = () => setSelected(getWorkspaceTimezone());
        window.addEventListener('scriptflow:timezone-change', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('scriptflow:timezone-change', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const handleSelect = (value: string) => {
        setWorkspaceTimezone(value);
        setSelected(value);
        window.dispatchEvent(new CustomEvent('scriptflow:timezone-change', { detail: value }));
    };

    return (
        <div className="us-timezone-bar" role="group" aria-label="US time zones: EDT, CDT, MDT, PDT">
            <span className="us-timezone-bar__label">
                <i className="fas fa-globe-americas" aria-hidden="true" />
                <span>US TIME</span>
            </span>
            <div className="us-timezone-bar__zones">
                {US_TIMEZONE_OPTIONS.map((option) => {
                    const active = selected === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={`us-timezone-chip${active ? ' is-active' : ''}`}
                            onClick={() => handleSelect(option.value)}
                            aria-pressed={active}
                            title={`${option.label} — default timezone for new bookings`}
                        >
                            {option.shortLabel}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default USTimezoneBar;
