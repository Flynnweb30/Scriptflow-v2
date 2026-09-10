import { Appointment } from '../types';
import { getAppAuth } from '../config/firebase-config';

export const US_TIMEZONE_OPTIONS = [
    { value: 'Eastern EDT', label: 'Eastern (EDT)', shortLabel: 'EDT', iana: 'America/New_York' },
    { value: 'Central CDT', label: 'Central (CDT)', shortLabel: 'CDT', iana: 'America/Chicago' },
    { value: 'Mountain MDT', label: 'Mountain (MDT)', shortLabel: 'MDT', iana: 'America/Denver' },
    { value: 'Pacific PDT', label: 'Pacific (PDT)', shortLabel: 'PDT', iana: 'America/Los_Angeles' },
] as const;

const DEFAULT_TIMEZONE = 'Central CDT';
const preferenceKey = (): string => `scriptflow_${getAppAuth()?.currentUser?.uid || 'anonymous'}_timezone`;

export const getWorkspaceTimezone = (): string => {
    try {
        const saved = localStorage.getItem(preferenceKey());
        if (saved && US_TIMEZONE_OPTIONS.some(option => option.value === saved)) return saved;
    } catch { /* storage can be unavailable */ }
    return DEFAULT_TIMEZONE;
};


export const normalizeUSTimezone = (timezone?: string): string => {
    const value = String(timezone || '').trim();
    const lower = value.toLowerCase();
    if (lower.includes('eastern') || ['et', 'est', 'edt'].includes(lower)) return 'Eastern EDT';
    if (lower.includes('central') || ['ct', 'cst', 'cdt'].includes(lower)) return 'Central CDT';
    if (lower.includes('mountain') || ['mt', 'mst', 'mdt'].includes(lower)) return 'Mountain MDT';
    if (lower.includes('pacific') || ['pt', 'pst', 'pdt'].includes(lower)) return 'Pacific PDT';
    return value || DEFAULT_TIMEZONE;
};

export const setWorkspaceTimezone = (timezone: string): void => {
    const valid = US_TIMEZONE_OPTIONS.some(option => option.value === timezone) ? timezone : DEFAULT_TIMEZONE;
    try { localStorage.setItem(preferenceKey(), valid); } catch { /* storage can be unavailable */ }
};

const getIanaTimezone = (timezoneStr?: string): string => {
    const value = String(timezoneStr || DEFAULT_TIMEZONE).trim();
    const direct = US_TIMEZONE_OPTIONS.find(option => option.value === value || option.shortLabel === value.toUpperCase());
    if (direct) return direct.iana;
    const lower = value.toLowerCase();
    if (lower.includes('eastern') || lower === 'et' || lower === 'est' || lower === 'edt') return 'America/New_York';
    if (lower.includes('central') || lower === 'ct' || lower === 'cst' || lower === 'cdt') return 'America/Chicago';
    if (lower.includes('mountain') || lower === 'mt' || lower === 'mst' || lower === 'mdt') return 'America/Denver';
    if (lower.includes('pacific') || lower === 'pt' || lower === 'pst' || lower === 'pdt') return 'America/Los_Angeles';
    if (lower === 'utc' || lower === 'gmt') return 'UTC';
    return 'America/Chicago';
};

const parseLocalDateTimeParts = (dateStr: string, timeStr?: string) => {
    const dateMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return null;
    let hour = 9;
    let minute = 0;
    const rawTime = String(timeStr || '').trim().toUpperCase();
    const timeMatch = rawTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
    if (timeMatch) {
        hour = Number(timeMatch[1]);
        minute = Number(timeMatch[2] || 0);
        const period = timeMatch[3];
        if (period === 'AM' && hour === 12) hour = 0;
        if (period === 'PM' && hour !== 12) hour += 12;
    }
    if (hour > 23 || minute > 59) return null;
    return { year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]), hour, minute };
};

// Convert a wall-clock appointment time in an IANA zone to the correct UTC instant.
// Intl supplies the DST-aware offset for the selected date, so EDT/EST transitions
// and the equivalent Central/Mountain/Pacific transitions are handled correctly.
const zonedLocalToUtc = (dateStr: string, timeStr?: string, timezoneStr?: string): Date | null => {
    const parts = parseLocalDateTimeParts(dateStr, timeStr);
    if (!parts) return null;
    const zone = getIanaTimezone(timezoneStr);
    const naiveUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        });
        const formatted = formatter.formatToParts(new Date(naiveUtc));
        const values: Record<string, number> = {};
        formatted.forEach(part => { if (part.type !== 'literal') values[part.type] = Number(part.value); });
        const representedUtc = Date.UTC(values.year, (values.month || 1) - 1, values.day || 1, values.hour || 0, values.minute || 0);
        const offset = representedUtc - naiveUtc;
        return new Date(naiveUtc - offset);
    } catch {
        return new Date(naiveUtc);
    }
};

const formatInTimezone = (date: Date, timezoneStr?: string): string => {
    const zone = getIanaTimezone(timezoneStr);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: zone, month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    }).format(date);
};

export const TimezoneUtils = {
    getTimezoneOffset: function(timezoneStr?: string): number {
        const zone = getIanaTimezone(timezoneStr);
        const now = new Date();
        try {
            const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset', hour: '2-digit' }).formatToParts(now);
            const value = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT';
            const match = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
            if (!match) return 0;
            const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
            return match[1] === '-' ? -minutes : minutes;
        } catch {
            return 0;
        }
    },

    parseTimeWithTimezone: function(dateStr?: string, timeStr?: string, timezoneStr?: string): Date | null {
        if (!dateStr) return null;
        return zonedLocalToUtc(dateStr, timeStr, timezoneStr || DEFAULT_TIMEZONE);
    },

    calculateCallbackTime: function(appointment?: Partial<Appointment> | null): Date | null {
        if (!appointment || !appointment.date || !appointment.callbackSetting || appointment.callbackSetting === 'none') return null;
        const appointmentUTC = this.parseTimeWithTimezone(appointment.date, appointment.time, appointment.timezone || DEFAULT_TIMEZONE);
        if (!appointmentUTC) return null;
        let offsetMs = 0;
        if (appointment.callbackSetting === '24h') offsetMs = 24 * 60 * 60 * 1000;
        else if (appointment.callbackSetting === '4h') offsetMs = 4 * 60 * 60 * 1000;
        else if (appointment.callbackSetting === '1h') offsetMs = 60 * 60 * 1000;
        else if (appointment.callbackSetting === 'custom' && appointment.callbackCustomValue) {
            const value = parseInt(appointment.callbackCustomValue, 10);
            const unit = appointment.callbackCustomUnit || 'hours';
            if (unit === 'hours') offsetMs = value * 60 * 60 * 1000;
            else if (unit === 'minutes') offsetMs = value * 60 * 1000;
            else if (unit === 'days') offsetMs = value * 24 * 60 * 60 * 1000;
        }
        return offsetMs ? new Date(appointmentUTC.getTime() - offsetMs) : null;
    },

    isCallbackDue: function(appointment?: Partial<Appointment> | null): boolean {
        if (!appointment || !appointment.callbackSetting || appointment.callbackSetting === 'none' || appointment.callbackTriggered || appointment.callbackPaused) return false;
        const callbackTime = this.calculateCallbackTime(appointment);
        if (!callbackTime) return false;
        const timeDiff = Date.now() - callbackTime.getTime();
        return timeDiff >= 0 && timeDiff < 10 * 60 * 1000;
    },

    formatCallbackTime: function(appointment?: Partial<Appointment> | null): string {
        const callbackTime = this.calculateCallbackTime(appointment);
        if (!callbackTime) return 'Not scheduled';
        return `${formatInTimezone(callbackTime, appointment?.timezone || DEFAULT_TIMEZONE)} ${appointment?.timezone || DEFAULT_TIMEZONE}`;
    },
};
