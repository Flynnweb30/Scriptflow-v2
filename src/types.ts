export interface Appointment {
    userId?: string;
    id: string;
    business: string;
    contactName: string;
    role?: string;
    phone?: string;
    email?: string;
    date: string; // YYYY-MM-DD
    time?: string;
    timezone?: string;
    status: string;
    primaryStatus?: string;
    assigned?: string;
    closer?: string;
    notes?: string;
    crmLink?: string;
    tags?: string[];
    createdAt?: string | { toDate?: () => Date; seconds?: number };
    updatedAt?: string;
    callbackSetting?: string;
    callbackCustomValue?: string;
    callbackCustomUnit?: string;
    callbackTriggered?: boolean;
    callbackTime?: string | null;
    callbackPaused?: boolean;
    callbackKind?: string;
    callbackOfAppointmentId?: string;
    callbackSource?: 'meeting_reminder' | 'manual';
    followUpType?: string;
    durationMinutes?: number;
    gracePeriodMinutes?: number;
    qualityScore?: number;
    confirmationStatus?: string;
    websiteStatus?: string;
    source?: string;
    icsUid?: string;
    allDay?: boolean;
    appointmentType?: string;
    eventType?: string;
    callCount?: number;
    dateKey?: string;
}

export interface Script {
    id?: string;
    userId?: string;
    name: string;
    content: string;
    version?: number;
    keyNumber?: number;
    favorite?: boolean;
    order?: number;
    createdAt?: any;
}

export interface Task {
    userId?: string;
    id: string;
    description: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
    appointmentId?: string | null;
    completed: boolean;
    createdAt?: string;
}

export interface Closer {
    userId?: string;
    id: string;
    name: string;
    email?: string;
    phone?: string;
    active: boolean;
    default: boolean;
}

export interface TeamMember {
    id: string;
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    color?: string;
    active: boolean;
}

export interface AppNotification {
    id: string;
    appointmentId: string;
    type: 'callback_due' | 'callback_completed' | 'appointment_reminder';
    business: string;
    contactName?: string;
    phone?: string;
    email?: string;
    date?: string;
    time?: string;
    timezone?: string;
    callbackTime?: string | null;
    callbackPaused?: boolean;
    callbackKind?: string;
    followUpType?: string;
    durationMinutes?: number;
    gracePeriodMinutes?: number;
    qualityScore?: number;
    confirmationStatus?: string;
    websiteStatus?: string;
    formattedCallbackTime?: string;
    message: string;
    timestamp: string;
    read: boolean;
    dismissed: boolean;
    count: number;
    createdAt: string;
    snoozedUntil?: string;
}

export interface ParsedImportRecord {
    index: number;
    raw: string;
    parsed: Record<string, any>;
    confidence: Record<string, number>;
    context: {
        hasKeyValue: boolean;
        hasBulletPoints: boolean;
        hasNaturalLanguage: boolean;
        detectedFormat: string;
        synonyms: Record<string, string[]>;
    };
    validated: Record<string, any>;
    isValid: boolean;
    errors: { field: string; message: string }[];
    warnings: { field: string; message: string }[];
    referenceDate?: string;
    hasDuplicate: boolean;
    duplicates: {
        existing: Appointment;
        confidence: number;
        matchedFields: string[];
        score: number;
    }[];
}

export interface AnalyticsFilterState {
    preset: string;
    startDate: string | null;
    endDate: string | null;
    startTime: string;
    endTime: string;
    timezone: string;
    user: string;
    groupBy: 'day' | 'week' | 'month';
}
