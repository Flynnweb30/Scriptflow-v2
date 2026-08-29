import { Appointment, ParsedImportRecord } from '../types';
import { CONFIG, SMART_IMPORT_CONFIG } from '../config/constants';

export const Utils = {
    generateId(): string {
        return Date.now().toString() + '_' + Math.random().toString(36).substring(2, 11);
    },

    getTodayStr(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    getCurrentDateTime(): string {
        return new Date().toISOString();
    },

    normalizeDateOnly(value: any, referenceDate: string | null = null): string | null {
        if (value == null || value === '') return null;
        if (typeof value === 'object') {
            if (typeof value.toDate === 'function') {
                const d = value.toDate();
                if (!isNaN(d.getTime())) return this.formatDateForCompare(d);
            }
            if (Number.isFinite(value.seconds)) {
                const d = new Date(value.seconds * 1000);
                if (!isNaN(d.getTime())) return this.formatDateForCompare(d);
            }
        }
        const raw = String(value).trim();
        let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) {
            const y = +m[1], mo = +m[2], day = +m[3];
            const d = new Date(y, mo - 1, day);
            return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === day
                ? `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : null;
        }
        m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) {
            const mo = +m[1], day = +m[2], y = +m[3];
            const d = new Date(y, mo - 1, day);
            return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === day
                ? `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : null;
        }
        return parseDateStringEnhanced(raw, referenceDate || this.getTodayStr());
    },

    normalizeStoredAppointmentDate(appointment: any): string | null {
        if (!appointment) return null;
        const created = appointment.createdAt;
        let reference = this.getTodayStr();
        try {
            let d: Date | null = null;
            if (created && typeof created.toDate === 'function') d = created.toDate();
            else if (created && Number.isFinite(created.seconds)) d = new Date(created.seconds * 1000);
            else if (created) d = new Date(created);
            if (d && !isNaN(d.getTime())) {
                reference = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        } catch (_) {}
        return this.normalizeDateOnly(appointment.date, reference);
    },

    // Calendar/scheduled-date helpers. Keep these tied to appointment.date so the
    // Calendar continues to show when the meeting is actually scheduled.
    isAppointmentToday(appointment: Partial<Appointment> | null | undefined): boolean {
        return this.normalizeStoredAppointmentDate(appointment) === this.getTodayStr();
    },

    // "Appointments made" helpers. These intentionally use createdAt, not the
    // scheduled/held date. New appointments and imports always stamp createdAt
    // at creation time, so a booking made today for tomorrow still counts as Today.
    // Legacy records without createdAt fall back to their scheduled date so they
    // remain visible instead of silently disappearing from historical reporting.
    getAppointmentMadeDateKey(appointment?: Partial<Appointment> | null): string | null {
        const createdKey = this.getAppointmentCreationDateKey(appointment);
        if (createdKey) return createdKey;
        return this.normalizeStoredAppointmentDate(appointment);
    },

    isAppointmentMadeToday(appointment: Partial<Appointment> | null | undefined): boolean {
        return this.getAppointmentMadeDateKey(appointment) === this.getTodayStr();
    },

    getTodayAppointments<T extends Partial<Appointment>>(appointments: T[]): T[] {
        const todayStr = this.getTodayStr();
        return appointments.filter((appointment) => this.getAppointmentMadeDateKey(appointment) === todayStr);
    },

    isAppointmentMadeInDateRange(appointment: Partial<Appointment> | null | undefined, start: Date, end: Date): boolean {
        const key = this.getAppointmentMadeDateKey(appointment);
        if (!key) return false;
        const [year, month, day] = key.split('-').map(Number);
        const value = new Date(year, month - 1, day);
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        return value >= startDay && value <= endDay;
    },

    // Backward-compatible alias for callers that need the scheduled calendar date range.
    isAppointmentInDateRange(appointment: Partial<Appointment> | null | undefined, start: Date, end: Date): boolean {
        const key = this.normalizeStoredAppointmentDate(appointment);
        if (!key) return false;
        const [year, month, day] = key.split('-').map(Number);
        const value = new Date(year, month - 1, day);
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        return value >= startDay && value <= endDay;
    },

    formatDate(dateStr?: string): string {
        const normalized = this.normalizeDateOnly(dateStr);
        if (!normalized) return 'No date';
        const [y, m, day] = normalized.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    formatDateTime(dateStr?: string, timeStr?: string): string {
        const normalized = this.normalizeDateOnly(dateStr);
        if (!normalized) return 'No date';
        const [y, m, day] = normalized.split('-').map(Number);
        const datePart = new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return timeStr ? `${datePart} at ${timeStr}` : datePart;
    },

    formatDateForCompare(date: Date | string): string {
        if (typeof date === 'string') return date;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    formatTime(timeStr?: string): string {
        if (!timeStr) return 'No time';
        return timeStr;
    },

    escapeHtml(s: any): string {
        if (!s) return '';
        return String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
    },

    getStatus(appt?: Partial<Appointment> | null): string {
        if (!appt || !appt.status) return 'Pending';
        return appt.status;
    },

    getStatusClass(status: string): string {
        const map: Record<string, string> = {
            'Hot Transfer': 'status-hot-transfer-sm',
            'Warm Callback': 'status-warm-callback-sm',
            'Completed': 'status-completed-sm',
            'Pending': 'status-pending-sm',
            'Canceled': 'status-canceled-sm',
            'Meeting Booked': 'status-meeting-booked-sm',
            'Rescheduled': 'status-rescheduled-sm',
            'Overdue': 'status-overdue-sm',
            'Held': 'status-held-sm',
            'No Show': 'status-no-show-sm'
        };
        return map[status] || 'status-pending-sm';
    },

    getScoreColor(score: number): string {
        if (score >= 70) return 'score-hot';
        if (score >= 40) return 'score-warm';
        return 'score-cold';
    },

    getPrimaryStatus(status: string): string {
        if (status === 'Rescheduled' || status === 'Overdue') return 'Pending';
        if (status === 'Held') return 'Completed';
        if (CONFIG.PRIMARY_STATUSES.includes(status)) return status;
        return 'Pending';
    },

    isCompletedStatus(status: string): boolean {
        return ['Completed', 'Held', 'Canceled', 'No Show'].includes(status);
    },

    getStatusColor(status: string): string {
        return CONFIG.STATUS_COLORS[status] || '#94a3b8';
    },

    getTagDefinition(tagId: string) {
        const id = String(tagId || '').trim();
        return CONFIG.TAG_OPTIONS.find(tag => tag.id === id) || { id, name: id, color: '#94a3b8' };
    },

    hasTag(appt?: Partial<Appointment> | null, tagId?: string): boolean {
        if (!appt || !tagId) return false;
        const tags = Array.isArray(appt.tags) ? appt.tags : [];
        return tags.some(tag => String(tag).trim().toLowerCase() === String(tagId).trim().toLowerCase());
    },

    isNoShow(appt?: Partial<Appointment> | null): boolean {
        if (!appt) return false;
        if (this.hasTag(appt, 'no_show')) return true;
        const status = String(appt.status || '').toLowerCase().replace(/[-_]/g, ' ').trim();
        const text = String(appt.notes || '').toLowerCase();
        return status.includes('no show') || status === 'noshow' || text.includes('no show') || text.includes('no-show');
    },

    getAppointmentCreatedAt(appt?: Partial<Appointment> | null): Date | null {
        if (!appt || appt.createdAt == null) return null;
        const value = appt.createdAt as any;
        if (value && typeof value.toDate === 'function') {
            const d = value.toDate();
            return d instanceof Date && !isNaN(d.getTime()) ? d : null;
        }
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
        if (typeof value === 'number') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'string') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    },

    getAppointmentCreationDateKey(appt?: Partial<Appointment> | null): string | null {
        const created = this.getAppointmentCreatedAt(appt);
        return created ? this.formatDateForCompare(created) : null;
    },

    getAppointmentCreationMinutes(appt?: Partial<Appointment> | null): number | null {
        const created = this.getAppointmentCreatedAt(appt);
        return created ? created.getHours() * 60 + created.getMinutes() : null;
    },

    isNewlyScheduledAppointment(appt?: Partial<Appointment> | null): boolean {
        return !!appt && this.isMeetingAppointment(appt) && !!this.getAppointmentCreatedAt(appt);
    },

    isCallbackAppointment(appt?: Partial<Appointment> | null): boolean {
        if (!appt) return false;
        const status = String(this.getStatus(appt) || '').toLowerCase().replace(/[-_]/g, ' ').trim();
        const primary = String(appt.primaryStatus || '').toLowerCase().replace(/[-_]/g, ' ').trim();
        return status === 'warm callback' || primary === 'warm callback' || appt.appointmentType === 'callback' || appt.eventType === 'callback';
    },

    isMeetingAppointment(appt?: Partial<Appointment> | null): boolean {
        return !!appt && !this.isCallbackAppointment(appt);
    },

    calculateLeadScore(appt?: Partial<Appointment> | null): number {
        if (!appt) return 0;
        let score = 0;
        const status = this.getStatus(appt);
        const primaryStatus = this.getPrimaryStatus(status);

        if (primaryStatus === 'Hot Transfer') score += 50;
        else if (primaryStatus === 'Completed') score += 40;
        else if (primaryStatus === 'Warm Callback') score += 30;
        else if (primaryStatus === 'Pending') score += 10;
        else if (primaryStatus === 'Canceled') score -= 20;

        if (status === 'Meeting Booked') score += 15;
        if (status === 'Held') score += 10;
        if (status === 'Rescheduled') score += 5;

        if (appt.tags) {
            if (appt.tags.includes('vip')) score += 20;
            if (appt.tags.includes('qualified_warm_call')) score += 15;
            if (appt.tags.includes('negligent_warm_callback')) score -= 10;
        }
        if (appt.notes && appt.notes.length > 10) score += 5;
        if (appt.phone) score += 5;
        if (appt.email) score += 5;
        return Math.max(0, Math.min(100, score));
    },

    parseTimezone(text?: string): string | null {
        if (!text) return null;
        const timezoneMatch = text.match(/\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT|GMT|UTC|ET|CT|MT|PT|Eastern|Central|Mountain|Pacific)\b/i);
        if (timezoneMatch) {
            const tzMap: Record<string, string> = {
                'est': 'Eastern EST',
                'edt': 'Eastern EDT',
                'eastern': 'Eastern EST',
                'cst': 'Central CST',
                'cdt': 'Central CDT',
                'central': 'Central CDT',
                'mst': 'Mountain MST',
                'mdt': 'Mountain MDT',
                'mountain': 'Mountain MDT',
                'pst': 'Pacific PST',
                'pdt': 'Pacific PDT',
                'pacific': 'Pacific PDT',
                'gmt': 'GMT',
                'utc': 'UTC',
                'et': 'Eastern EST',
                'ct': 'Central CDT',
                'mt': 'Mountain MDT',
                'pt': 'Pacific PDT'
            };
            const key = timezoneMatch[1].toLowerCase();
            return tzMap[key] || timezoneMatch[1].toUpperCase();
        }
        return null;
    }
};

export function parseDateStringEnhanced(dateStr?: string, referenceDate: string | null = null): string | null {
    if (!dateStr) return null;

    let trimmed = String(dateStr).trim()
        .replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '')
        .replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, '$1')
        .replace(/[.,]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const reference = referenceDate ? new Date(`${referenceDate}T00:00:00`) : new Date();
    const referenceYear = !isNaN(reference.getTime()) ? reference.getFullYear() : new Date().getFullYear();

    const buildDate = (year: number, monthIndex: number, day: number): string | null => {
        if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return null;
        if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
        const date = new Date(year, monthIndex, day);
        if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) return null;
        return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) return buildDate(+match[1], +match[2] - 1, +match[3]);

    match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return buildDate(+match[3], +match[1] - 1, +match[2]);

    match = trimmed.match(/^(\d{1,2})[\-\/]?(\d{1,2})[\-\/]?(\d{2})$/);
    if (match && /[\-\/]/.test(trimmed)) {
        const shortYear = +match[3];
        const year = shortYear >= 70 ? 1900 + shortYear : 2000 + shortYear;
        return buildDate(year, +match[1] - 1, +match[2]);
    }

    match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (match) {
        const monthIndex = getMonthIndexEnhanced(match[1]);
        return buildDate(+match[3], monthIndex, +match[2]);
    }

    match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/i);
    if (match) {
        const monthIndex = getMonthIndexEnhanced(match[2]);
        return buildDate(+match[3], monthIndex, +match[1]);
    }

    match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})$/i);
    if (match) {
        const monthIndex = getMonthIndexEnhanced(match[1]);
        return buildDate(referenceYear, monthIndex, +match[2]);
    }

    if (/^today$/i.test(trimmed)) return Utils.getTodayStr();
    if (/^tomorrow$/i.test(trimmed)) {
        const d = new Date(); d.setDate(d.getDate() + 1); return Utils.formatDateForCompare(d);
    }
    if (/^yesterday$/i.test(trimmed)) {
        const d = new Date(); d.setDate(d.getDate() - 1); return Utils.formatDateForCompare(d);
    }

    return null;
}

function getMonthIndexEnhanced(monthName: string): number {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const abbreviations = ['jan','feb','mar','apr','may','jun','jul','aug','sep','sept','oct','nov','dec'];
    const normalized = String(monthName || '').toLowerCase().replace(/\.$/, '');
    const fullIndex = months.indexOf(normalized);
    if (fullIndex !== -1) return fullIndex;
    return abbreviations.indexOf(normalized);
}

export function extractEmailEnhanced(value?: string): string {
    if (!value) return '';
    const markdownMatch = String(value).match(/(?:\(|mailto:)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?:\))?/i);
    return markdownMatch ? markdownMatch[1].toLowerCase().trim() : '';
}

export function normalizeTimeEnhanced(timeStr?: string): string | null {
    if (!timeStr) return null;

    let cleaned = String(timeStr).trim().replace(/\./g, ':');
    const timezoneMatch = cleaned.match(/\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT|GMT|UTC|ET|CT|MT|PT)\b/i);
    let timezone: string | null = null;
    if (timezoneMatch) {
        timezone = timezoneMatch[1].toUpperCase();
        cleaned = cleaned.replace(timezoneMatch[0], '').trim();
    }
    cleaned = cleaned.replace(/^at\s+/i, '').trim();

    const twentyFourHour = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    let hour: number;
    let minute: number;
    let period: string;

    if (twentyFourHour) {
        const h24 = parseInt(twentyFourHour[1], 10);
        minute = parseInt(twentyFourHour[2], 10);
        if (h24 < 0 || h24 > 23 || minute > 59) return null;
        period = h24 >= 12 ? 'PM' : 'AM';
        hour = h24 % 12 || 12;
    } else {
        const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (!match) return null;
        hour = parseInt(match[1], 10);
        minute = parseInt(match[2] || '0', 10);
        period = match[3].toUpperCase();
        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    }

    let formatted = `${hour}:${String(minute).padStart(2, '0')} ${period}`;
    if (timezone) formatted += ` ${timezone}`;
    return formatted;
}

export function normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = cleaned.substring(1);
    }
    if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
        return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    }
    return cleaned;
}

export function parseDemoDateTimeEnhanced(value?: string, defaultDate: string | null = null): { date?: string; time?: string; timezone?: string } {
    if (!value) return {};
    let raw = String(value).trim();
    const output: { date?: string; time?: string; timezone?: string } = {};

    const tzMatch = raw.match(/\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT|GMT|UTC|ET|CT|MT|PT)\b/i);
    if (tzMatch) {
        output.timezone = Utils.parseTimezone(tzMatch[1]) || undefined;
        raw = raw.replace(tzMatch[0], ' ').replace(/\s+/g, ' ').trim();
    }

    const timeMatch = raw.match(/(?:\bat\s*)?(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/i) || raw.match(/(?:\bat\s*)?(\d{1,2}:\d{2})\b/);
    if (timeMatch) {
        const normalized = normalizeTimeEnhanced(timeMatch[1]);
        if (normalized) output.time = normalized;
    }

    const datePart = raw
        .replace(/\b(?:at)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\b/i, ' ')
        .replace(/\b\d{1,2}:\d{2}\b/, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const parsedDate = parseDateStringEnhanced(datePart, defaultDate);
    if (parsedDate) output.date = parsedDate;

    return output;
}

export function matchFieldName(key: string): string | null {
    const normalizedKey = key.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(SMART_IMPORT_CONFIG.FIELD_ALIASES)) {
        if (aliases.some(alias =>
            normalizedKey === alias ||
            normalizedKey.includes(alias) ||
            alias.includes(normalizedKey) ||
            normalizedKey.split(' ').some(word => word === alias.split(' ')[0])
        )) {
            return field;
        }
    }
    return null;
}

export function parseRelativeDate(expression: string): string | null {
    const today = new Date();
    const expr = expression.toLowerCase().trim();

    if (expr === 'today') return Utils.formatDateForCompare(today);
    if (expr === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return Utils.formatDateForCompare(tomorrow);
    }
    if (expr === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return Utils.formatDateForCompare(yesterday);
    }
    if (expr === 'next week') {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return Utils.formatDateForCompare(nextWeek);
    }
    if (expr === 'this week') {
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() + (7 - thisWeek.getDay()));
        return Utils.formatDateForCompare(thisWeek);
    }
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = dayNames.indexOf(expr);
    if (dayIndex !== -1) {
        const currentDay = today.getDay();
        let daysUntil = dayIndex - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + daysUntil);
        return Utils.formatDateForCompare(targetDate);
    }
    return null;
}

export function parseAppointmentTextEnhanced(text: string, defaultDate: string | null = null): {
    result: Record<string, any>;
    confidence: Record<string, number>;
    context: {
        hasKeyValue: boolean;
        hasBulletPoints: boolean;
        hasNaturalLanguage: boolean;
        detectedFormat: string;
        synonyms: Record<string, string[]>;
    };
} {
    const result: Record<string, any> = {};
    const confidence: Record<string, number> = {};
    const context = {
        hasKeyValue: false,
        hasBulletPoints: false,
        hasNaturalLanguage: false,
        detectedFormat: 'unknown',
        synonyms: {
            date: [],
            time: [],
            status: [],
            assigned: [],
            email: []
        } as Record<string, string[]>
    };

    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanText.split('\n').filter(line => line.trim());
    const fullText = lines.join(' ');

    context.hasKeyValue = lines.some(line => line.includes(':') || line.includes('=') || line.includes('->'));
    context.hasBulletPoints = lines.some(line => /^[\s]*[•\-*]\s/.test(line));
    context.hasNaturalLanguage = !context.hasKeyValue && !context.hasBulletPoints;

    if (context.hasKeyValue) context.detectedFormat = 'key_value';
    else if (context.hasBulletPoints) context.detectedFormat = 'bullet_points';
    else context.detectedFormat = 'natural_language';

    const separators = [':', '=', '->', '=>'];
    const synonymMap: Record<string, string> = {
        'best time': 'time',
        'callback time': 'time',
        'callback date': 'date',
        'scheduled date': 'date',
        'appointment date': 'date',
        'meeting date': 'date',
        'call date': 'date',
        'scheduled time': 'time',
        'meeting time': 'time',
        'appointment time': 'time',
        'call time': 'time',
        'lead status': 'status',
        'call status': 'status',
        'appointment status': 'status',
        'assigned agent': 'assigned',
        'assigned to': 'assigned',
        'team member': 'assigned',
        'handler': 'assigned',
        'contact number': 'phone',
        'mobile number': 'phone',
        'cell phone': 'phone',
        'business name': 'business',
        'company name': 'business',
        'organization name': 'business',
        'full name': 'name',
        'contact name': 'name',
        'client name': 'name',
        'customer name': 'name',
        'person name': 'name',
        'email address': 'email',
        'business email': 'email',
        'company email': 'email',
        'primary email': 'email'
    };

    if (context.detectedFormat === 'key_value') {
        lines.forEach(line => {
            let separatorIndex = -1;
            let separatorUsed = '';
            for (const sep of separators) {
                const idx = line.indexOf(sep);
                if (idx !== -1 && (separatorIndex === -1 || idx < separatorIndex)) {
                    separatorIndex = idx;
                    separatorUsed = sep;
                }
            }
            if (separatorIndex !== -1) {
                const key = line.substring(0, separatorIndex).trim().toLowerCase();
                const value = line.substring(separatorIndex + separatorUsed.length).trim();
                if (value) {
                    const normalizedKey = key.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
                    if (SMART_IMPORT_CONFIG.FIELD_ALIASES.demoDateTime.includes(normalizedKey) || /(?:demo|meeting|appointment|scheduled).*(?:date.*time|time.*date)|^date.*time$/i.test(normalizedKey)) {
                        const schedule = parseDemoDateTimeEnhanced(value, defaultDate);
                        if (schedule.date) {
                            result.date = schedule.date;
                            confidence.date = 0.98;
                            context.synonyms.date = context.synonyms.date || [];
                            context.synonyms.date.push(key);
                        }
                        if (schedule.time) {
                            result.time = schedule.time;
                            confidence.time = 0.98;
                            context.synonyms.time = context.synonyms.time || [];
                            context.synonyms.time.push(key);
                        }
                        if (schedule.timezone) {
                            result.timezone = schedule.timezone;
                            confidence.timezone = 0.98;
                        }
                        return;
                    }

                    let matchedField: string | null = null;
                    if (synonymMap[key]) {
                        matchedField = synonymMap[key];
                        context.synonyms[matchedField] = context.synonyms[matchedField] || [];
                        context.synonyms[matchedField].push(key);
                    }
                    if (!matchedField) matchedField = matchFieldName(key);

                    if (key.includes('email') || key.includes('e-mail') || key.includes('mail')) {
                        matchedField = 'email';
                        context.synonyms.email = context.synonyms.email || [];
                        context.synonyms.email.push(key);
                    }

                    if (key.includes('best time') || (key.includes('callback') && key.includes('time'))) {
                        const dateMatch = value.match(/(\w+\s+\d{1,2},?\s+\d{4})/i);
                        const timeMatch = value.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
                        const relativeDateMatch = value.match(/\b(today|tomorrow|yesterday|next week|this week)\b/i);
                        const timezoneMatch = value.match(/\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT|GMT|UTC|ET|CT|MT|PT)\b/i);

                        if (dateMatch) { result.date = dateMatch[1]; confidence.date = 0.9; }
                        if (timeMatch) { result.time = timeMatch[1]; confidence.time = 0.9; }
                        if (timezoneMatch) { result.timezone = Utils.parseTimezone(timezoneMatch[1]); confidence.timezone = 0.8; }
                        if (relativeDateMatch) {
                            const rel = parseRelativeDate(relativeDateMatch[1]);
                            if (rel) { result.date = rel; confidence.date = 0.85; }
                        }
                        result.notes = (result.notes ? result.notes + '\n' : '') + `Best time: ${value}`;
                        confidence.notes = 0.6;
                    } else if (matchedField) {
                        if (matchedField === 'email') {
                            const extracted = extractEmailEnhanced(value);
                            if (extracted) { result.email = extracted; confidence.email = 0.98; }
                            else { result.notes = (result.notes ? result.notes + '\n' : '') + `${key}: ${value}`; }
                        } else {
                            result[matchedField] = value;
                            confidence[matchedField] = 0.9;
                            if (matchedField === 'date') {
                                const parsedDate = parseDateStringEnhanced(value, defaultDate);
                                if (parsedDate) { result.date = parsedDate; confidence.date = 0.95; }
                            }
                            if (matchedField === 'timezone') {
                                const tz = Utils.parseTimezone(value);
                                if (tz) { result.timezone = tz; confidence.timezone = 0.9; }
                            }
                        }
                    } else {
                        result.notes = (result.notes ? result.notes + '\n' : '') + `${key}: ${value}`;
                        confidence.notes = 0.5;
                    }
                }
            } else if (line.trim()) {
                result.notes = (result.notes ? result.notes + '\n' : '') + line.trim();
                confidence.notes = 0.4;
            }
        });
    } else {
        // Natural language or bullet points
        const emailMatch = fullText.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
        if (emailMatch) { result.email = emailMatch[1].toLowerCase().trim(); confidence.email = 0.9; }

        const phoneMatch = fullText.match(/(\+?\d[\d\s().-]{7,}\d)/);
        if (phoneMatch) { result.phone = phoneMatch[1].trim(); confidence.phone = 0.85; }

        const busMatch = fullText.match(/(?:business|company|org)[:\s]+([A-Z][a-zA-Z0-9\s&]+?)(?:[,.\n]|$)/i);
        if (busMatch) { result.business = busMatch[1].trim(); confidence.business = 0.75; }

        const nameMatch = fullText.match(/(?:name|contact|client)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        if (nameMatch) { result.name = nameMatch[1].trim(); confidence.name = 0.75; }

        result.notes = fullText;
        confidence.notes = 0.5;
    }

    // Enhance
    if (result.phone) result.phone = normalizePhoneNumber(result.phone);
    if (result.email) result.email = extractEmailEnhanced(result.email) || result.email.toLowerCase().trim();

    if (result.date) {
        const parsed = parseDateStringEnhanced(result.date, defaultDate);
        if (parsed) { result.date = parsed; confidence.date = Math.max(confidence.date || 0, 0.9); }
    } else if (defaultDate) {
        result.date = defaultDate;
        confidence.date = 1.0;
    }

    if (result.time) {
        const norm = normalizeTimeEnhanced(result.time);
        if (norm) { result.time = norm; confidence.time = Math.max(confidence.time || 0, 0.9); }
    }

    return { result, confidence, context };
}

export function validateAppointmentData(data: Record<string, any>, referenceDate: string | null = null): {
    validated: Record<string, any>;
    errors: { field: string; message: string }[];
    warnings: { field: string; message: string }[];
    isValid: boolean;
} {
    const errors: { field: string; message: string }[] = [];
    const warnings: { field: string; message: string }[] = [];
    const validated: Record<string, any> = {};

    if (!data.name || String(data.name).trim().length < 2) {
        errors.push({ field: 'name', message: 'Contact name is required (min 2 characters)' });
    } else {
        validated.name = String(data.name).trim();
    }

    if (!data.business || String(data.business).trim().length < 2) {
        errors.push({ field: 'business', message: 'Business name is required (min 2 characters)' });
    } else {
        validated.business = String(data.business).trim();
    }

    if (data.phone) {
        const cleanPhone = String(data.phone).replace(/[^\d+]/g, '');
        if (cleanPhone.length < 7 || cleanPhone.length > 15) {
            warnings.push({ field: 'phone', message: 'Phone number format seems unusual (expected 7-15 digits)' });
        }
        validated.phone = cleanPhone;
    }

    if (data.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            warnings.push({ field: 'email', message: 'Email format seems invalid' });
        }
        validated.email = String(data.email).toLowerCase().trim();
    }

    if (data.date) {
        const parsedDate = parseDateStringEnhanced(data.date, referenceDate);
        if (parsedDate) {
            validated.date = parsedDate;
        } else {
            errors.push({ field: 'date', message: 'Date format not recognized' });
        }
    } else if (referenceDate) {
        validated.date = referenceDate;
    } else {
        validated.date = Utils.getTodayStr();
    }

    if (data.time) {
        const norm = normalizeTimeEnhanced(data.time);
        validated.time = norm || data.time;
    }

    if (data.timezone) validated.timezone = data.timezone;

    if (data.status) {
        const allowed = SMART_IMPORT_CONFIG.VALIDATION.status.allowed;
        const matched = allowed.find(s => s.toLowerCase() === String(data.status).toLowerCase());
        validated.status = matched || 'Pending';
    } else {
        validated.status = 'Pending';
    }

    ['assigned', 'role', 'notes', 'tags', 'closer'].forEach(f => {
        if (data[f]) validated[f] = data[f];
    });

    return {
        validated,
        errors,
        warnings,
        isValid: errors.length === 0
    };
}

export function detectDuplicatesEnhanced(newData: Record<string, any>, allAppointments: Appointment[]): {
    existing: Appointment;
    confidence: number;
    matchedFields: string[];
    score: number;
}[] {
    const duplicates: { existing: Appointment; confidence: number; matchedFields: string[]; score: number }[] = [];
    if (!allAppointments || allAppointments.length === 0) return duplicates;

    const newName = (newData.name || '').toLowerCase().trim();
    const newBusiness = (newData.business || '').toLowerCase().trim();
    const newPhone = (newData.phone || '').replace(/[^\d+]/g, '');
    const newEmail = (newData.email || '').toLowerCase().trim();

    for (const existing of allAppointments) {
        let score = 0;
        const matchedFields: string[] = [];
        let totalFields = 0;

        if (newName && existing.contactName) {
            const existingName = existing.contactName.toLowerCase().trim();
            totalFields++;
            if (newName === existingName) {
                score += 0.6;
                matchedFields.push('name');
            } else if (newName.includes(existingName) || existingName.includes(newName)) {
                score += 0.3;
                matchedFields.push('name_partial');
            }
        }

        if (newBusiness && existing.business) {
            const existingBusiness = existing.business.toLowerCase().trim();
            totalFields++;
            if (newBusiness === existingBusiness) {
                score += 0.5;
                matchedFields.push('business');
            } else if (newBusiness.includes(existingBusiness) || existingBusiness.includes(newBusiness)) {
                score += 0.25;
                matchedFields.push('business_partial');
            }
        }

        if (newPhone && existing.phone) {
            const existingPhone = existing.phone.replace(/[^\d+]/g, '');
            totalFields++;
            if (newPhone === existingPhone) {
                score += 0.7;
                matchedFields.push('phone');
            }
        }

        if (newEmail && existing.email) {
            const existingEmail = existing.email.toLowerCase().trim();
            totalFields++;
            if (newEmail === existingEmail) {
                score += 0.8;
                matchedFields.push('email');
            }
        }

        const confidence = totalFields > 0 ? Math.min(score + (totalFields - 1) * 0.1, 1) : 0;
        if (confidence >= 0.5) {
            duplicates.push({
                existing,
                confidence: Math.round(confidence * 100),
                matchedFields,
                score
            });
        }
    }
    return duplicates.sort((a, b) => b.confidence - a.confidence);
}

export function splitAppointments(text: string): string[] {
    const appointments: string[] = [];
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    let current: string[] = [];
    let hasBusinessField = false;

    const normalizeKey = (key: string) => key
        .toLowerCase()
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    const isKnownField = (key: string) => {
        const normalized = normalizeKey(key);
        return Object.keys(SMART_IMPORT_CONFIG.FIELD_ALIASES).some(field =>
            SMART_IMPORT_CONFIG.FIELD_ALIASES[field].includes(normalized)
        ) || SMART_IMPORT_CONFIG.FIELD_ALIASES.demoDateTime.includes(normalized);
    };

    const isBusinessKey = (key: string) => /^(business|business name|company|company name|organization|organization name|firm|brand|store)$/i.test(normalizeKey(key));

    const flush = () => {
        if (current.length) appointments.push(current.join('\n'));
        current = [];
        hasBusinessField = false;
    };

    for (const line of lines) {
        if (/^---+\s*$/.test(line) || /^={3,}\s*$/.test(line) || /^Appointment\s+#\d+/i.test(line)) {
            flush();
            continue;
        }

        const fieldMatch = line.match(/^([^:=\-]{1,50})\s*(?::|=|->|=>)\s*(.*)$/);
        if (fieldMatch) {
            const key = normalizeKey(fieldMatch[1]);
            const recognized = isKnownField(key);

            if (recognized && isBusinessKey(key) && hasBusinessField && current.length) {
                flush();
            }
            if (recognized && isBusinessKey(key)) hasBusinessField = true;
        }

        if (/^\d+\.\s+/.test(line) && current.length) {
            flush();
        }

        current.push(line);
    }

    flush();
    if (!appointments.length && text.trim()) appointments.push(text.trim());
    return appointments;
}

export function extractBookingData(text: string) {
    const sourceRaw = String(text || '').replace(/\r/g, '').trim();
    const source = sourceRaw.replace(/\s+/g, ' ').trim();
    const NOT_SPECIFIED = 'Not specified';

    const cleanValue = (value: string) => String(value || '')
        .replace(/^\s*[-•*]\s*/, '')
        .replace(/[|;]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();

    const firstMatch = (patterns: RegExp[]) => {
        for (const pattern of patterns) {
            const match = sourceRaw.match(pattern) || source.match(pattern);
            if (match && match[1] && cleanValue(match[1])) return cleanValue(match[1]);
        }
        return '';
    };

    const emailRaw = firstMatch([
        /(?:business\s+)?e-?mail(?:\s+address)?\s*[:=-]\s*([^\s,;|]+)/i,
        /(?:mailto:)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
    ]);
    const email = emailRaw.replace(/^mailto:/i, '').replace(/[)\]>,.]+$/, '').toLowerCase();

    const phone = firstMatch([
        /(?:phone(?:\s+number)?|mobile|cell|telephone|contact\s+number)\s*[:=-]\s*([+\d][\d\s().-]{6,})/i,
        /(\+?\d[\d\s().-]{7,}\d)/
    ]);

    const business = firstMatch([
        /(?:^|\n)\s*(?:business\s+name|company\s+name|organization\s+name|business|company|organization|firm)\s*[:=-]\s*([^\n,|;]+)/im
    ]);

    const name = firstMatch([
        /(?:^|\n)\s*(?:full\s+name|contact\s+name|customer\s+name|prospect\s+name|client\s+name|name)\s*[:=-]\s*([^\n,|;]+)/im
    ]);

    const role = firstMatch([
        /(?:^|\n)\s*(?:role|title|position|job\s+title|designation)\s*[:=-]\s*([^\n,|;]+)/im
    ]);

    const schedule = parseDemoDateTimeEnhanced(sourceRaw);
    const scheduleDisplay = schedule.date && schedule.time ? `${schedule.date} at ${schedule.time} ${schedule.timezone || ''}` : NOT_SPECIFIED;

    return {
        business: business || NOT_SPECIFIED,
        name: name || NOT_SPECIFIED,
        role: role || NOT_SPECIFIED,
        phone: phone || NOT_SPECIFIED,
        dateTime: scheduleDisplay,
        email: email || NOT_SPECIFIED,
        notes: sourceRaw
    };
}

export function bookingFormat(data: ReturnType<typeof extractBookingData>): string {
    return [
        `Business Name: ${data.business}`,
        `Name: ${data.name}`,
        `Role: ${data.role}`,
        `Phone Number: ${data.phone}`,
        `Demo Time & Date: ${data.dateTime}`,
        `Email: ${data.email}`,
        '',
        'Notes for the Developer:',
        '',
        data.notes ? `- ${data.notes.replace(/\n/g, '\n- ')}` : '- General inquiry and website walkthrough requested.'
    ].join('\n');
}
