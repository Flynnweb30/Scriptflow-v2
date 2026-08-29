import { Appointment } from '../types';

export const TimezoneUtils = {
    getTimezoneOffset: function(timezoneStr?: string): number {
        if (!timezoneStr) return 0;
        const tzMap: Record<string, number> = {
            'Eastern EDT': -240,
            'Eastern EST': -300,
            'Eastern': -240,
            'EDT': -240,
            'EST': -300,
            'Central CDT': -300,
            'Central CST': -360,
            'Central': -300,
            'CDT': -300,
            'CST': -360,
            'Mountain MDT': -360,
            'Mountain MST': -420,
            'Mountain': -360,
            'MDT': -360,
            'MST': -420,
            'Pacific PDT': -420,
            'Pacific PST': -480,
            'Pacific': -420,
            'PDT': -420,
            'PST': -480,
            'UTC': 0,
            'GMT': 0
        };
        if (tzMap[timezoneStr] !== undefined) {
            return tzMap[timezoneStr];
        }
        for (const [key, offset] of Object.entries(tzMap)) {
            if (timezoneStr.includes(key) || key.includes(timezoneStr)) {
                return offset;
            }
        }
        return 0;
    },

    parseTimeWithTimezone: function(dateStr?: string, timeStr?: string, timezoneStr?: string): Date | null {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr + 'T00:00:00');
            if (isNaN(date.getTime())) return null;
            let hour = 9;
            let minute = 0;
            if (timeStr) {
                const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (timeMatch) {
                    hour = parseInt(timeMatch[1], 10);
                    minute = parseInt(timeMatch[2], 10);
                    if (timeMatch[3].toUpperCase() === 'PM' && hour < 12) hour += 12;
                    if (timeMatch[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
                } else {
                    const simpleMatch = timeStr.match(/(\d{1,2})\s*(AM|PM)/i);
                    if (simpleMatch) {
                        hour = parseInt(simpleMatch[1], 10);
                        if (simpleMatch[2].toUpperCase() === 'PM' && hour < 12) hour += 12;
                        if (simpleMatch[2].toUpperCase() === 'AM' && hour === 12) hour = 0;
                        minute = 0;
                    }
                }
            }
            date.setHours(hour, minute, 0, 0);
            const tzOffset = this.getTimezoneOffset(timezoneStr || 'Central CDT');
            const utcDate = new Date(date.getTime() - (tzOffset * 60 * 1000));
            return utcDate;
        } catch (e) {
            console.warn('Error parsing time with timezone:', e);
            return null;
        }
    },

    calculateCallbackTime: function(appointment?: Partial<Appointment> | null): Date | null {
        if (!appointment || !appointment.date || !appointment.callbackSetting || appointment.callbackSetting === 'none') {
            return null;
        }
        try {
            const appointmentUTC = this.parseTimeWithTimezone(
                appointment.date,
                appointment.time,
                appointment.timezone || 'Central CDT'
            );
            if (!appointmentUTC) return null;
            let offsetMs = 0;
            if (appointment.callbackSetting === '24h') {
                offsetMs = 24 * 60 * 60 * 1000;
            } else if (appointment.callbackSetting === '4h') {
                offsetMs = 4 * 60 * 60 * 1000;
            } else if (appointment.callbackSetting === '1h') {
                offsetMs = 60 * 60 * 1000;
            } else if (appointment.callbackSetting === 'custom' && appointment.callbackCustomValue) {
                const value = parseInt(appointment.callbackCustomValue, 10);
                const unit = appointment.callbackCustomUnit || 'hours';
                if (unit === 'hours') {
                    offsetMs = value * 60 * 60 * 1000;
                } else if (unit === 'minutes') {
                    offsetMs = value * 60 * 1000;
                } else if (unit === 'days') {
                    offsetMs = value * 24 * 60 * 60 * 1000;
                }
            }
            if (offsetMs === 0) return null;
            return new Date(appointmentUTC.getTime() - offsetMs);
        } catch (e) {
            console.warn('Error calculating callback time:', e);
            return null;
        }
    },

    isCallbackDue: function(appointment?: Partial<Appointment> | null): boolean {
        if (!appointment || !appointment.callbackSetting || appointment.callbackSetting === 'none') {
            return false;
        }
        if (appointment.callbackTriggered || appointment.callbackPaused) {
            return false;
        }
        const callbackTime = this.calculateCallbackTime(appointment);
        if (!callbackTime) return false;
        const now = new Date();
        const timeDiff = now.getTime() - callbackTime.getTime();
        return timeDiff >= 0 && timeDiff < 10 * 60 * 1000;
    },

    formatCallbackTime: function(appointment?: Partial<Appointment> | null): string {
        const callbackTime = this.calculateCallbackTime(appointment);
        if (!callbackTime) return 'Not scheduled';
        const tzOffset = this.getTimezoneOffset(appointment?.timezone || 'Central CDT');
        const localTime = new Date(callbackTime.getTime() + (tzOffset * 60 * 1000));
        return localTime.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC'
        }) + ' ' + (appointment?.timezone || 'Central CDT');
    }
};
