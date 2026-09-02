import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Appointment, Closer } from '../types';
import { Utils } from '../utils/helpers';
import { WorkspaceService } from '../services/WorkspaceService';
import { FirestoreService } from '../services/FirestoreService';
import { CONFIG } from '../config/constants';
import { getWorkspaceTimezone, setWorkspaceTimezone, US_TIMEZONE_OPTIONS, normalizeUSTimezone } from '../utils/timezone-utils';

interface CalendarViewProps {
    appointments: Appointment[];
    closers?: Closer[];
    onSelectAppointment: (appt: Appointment) => void;
    onOpenQuickAdd: (defaultDate?: string, defaultStatus?: string) => void;
    onOpenSmartImport: () => void;
    onOpenBulkActions: () => void;
    initialListPreset?: 'todo' | 'overdue';
}

interface CalendarDay {
    dateStr: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    items: Appointment[];
    dayOfWeek: string;
}

// Pipeline stages for Kanban
interface PipelineStage {
    id: string;
    title: string;
    icon: string;
    color: string;
    bgColor: string;
    matchStatuses: string[];
    defaultStatus: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
    {
        id: 'new_lead',
        title: 'New Lead',
        icon: 'fa-user-plus',
        color: '#38bdf8',
        bgColor: 'rgba(56, 189, 248, 0.12)',
        matchStatuses: ['New Lead', 'Pending'],
        defaultStatus: 'New Lead'
    },
    {
        id: 'attempted',
        title: 'Attempted',
        icon: 'fa-phone-volume',
        color: '#fbbf24',
        bgColor: 'rgba(251, 191, 36, 0.12)',
        matchStatuses: ['Attempted', 'Warm Callback'],
        defaultStatus: 'Attempted'
    },
    {
        id: 'meeting_booked',
        title: 'Meeting Booked',
        icon: 'fa-calendar-check',
        color: '#34d399',
        bgColor: 'rgba(52, 211, 153, 0.12)',
        matchStatuses: ['Meeting Booked'],
        defaultStatus: 'Meeting Booked'
    },
    {
        id: 'hot_transfer',
        title: 'Hot Transfer',
        icon: 'fa-fire',
        color: '#f87171',
        bgColor: 'rgba(248, 113, 113, 0.12)',
        matchStatuses: ['Hot Transfer'],
        defaultStatus: 'Hot Transfer'
    },
    {
        id: 'rescheduled',
        title: 'Rescheduled',
        icon: 'fa-clock-rotate-left',
        color: '#a78bfa',
        bgColor: 'rgba(167, 139, 250, 0.12)',
        matchStatuses: ['Rescheduled', 'Overdue'],
        defaultStatus: 'Rescheduled'
    },
    {
        id: 'completed',
        title: 'Completed / Won',
        icon: 'fa-circle-check',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.12)',
        matchStatuses: ['Completed', 'Held'],
        defaultStatus: 'Completed'
    },
    {
        id: 'canceled',
        title: 'Canceled / Lost',
        icon: 'fa-circle-xmark',
        color: '#94a3b8',
        bgColor: 'rgba(148, 163, 184, 0.12)',
        matchStatuses: ['Canceled', 'No Show'],
        defaultStatus: 'Canceled'
    }
];

export const CalendarView: React.FC<CalendarViewProps> = ({
    appointments,
    closers = CONFIG.DEFAULT_CLOSERS as Closer[],
    onSelectAppointment,
    onOpenQuickAdd,
    onOpenSmartImport,
    onOpenBulkActions,
    initialListPreset = 'todo'
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'kanban' | 'month' | 'week' | 'day' | 'list'>('month');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [assignedFilter, setAssignedFilter] = useState<string>('all');
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [draggedApptId, setDraggedApptId] = useState<string | null>(null);
    const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
    const [showMoreModal, setShowMoreModal] = useState<{ date: string; appointments: Appointment[] } | null>(null);
    const [listPreset, setListPreset] = useState<'todo' | 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'custom'>('todo');
    const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'meeting' | 'callback' | 'followup'>('all');
    const [activitySubtypeFilter, setActivitySubtypeFilter] = useState('all');
    const [timezoneFilter, setTimezoneFilter] = useState('all');
    const [workspaceTimezone, setWorkspaceTimezoneState] = useState(getWorkspaceTimezone());
    const [includeCompleted, setIncludeCompleted] = useState(false);
    const [sortKey, setSortKey] = useState<'date' | 'type' | 'owner' | 'status' | 'business'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [calendarZoom, setCalendarZoom] = useState(1);
    const [selectedCalendarActivity, setSelectedCalendarActivity] = useState<Appointment | null>(null);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        setViewMode('list');
        setListPreset(initialListPreset);
    }, [initialListPreset]);

    const todayStr = Utils.getTodayStr();

    const getActivityKind = useCallback((appt: Appointment): 'meeting' | 'callback' | 'followup' => {
        const explicit = `${appt.appointmentType || ''} ${appt.eventType || ''}`.toLowerCase();
        if (explicit.includes('callback')) return 'callback';
        if (explicit.includes('follow')) return 'followup';
        if (appt.followUpType || (Array.isArray(appt.tags) && appt.tags.some(tag => /follow.?up/i.test(String(tag))))) return 'followup';
        if (Utils.isCallbackAppointment(appt)) return 'callback';
        return 'meeting';
    }, []);

    const getActivityColor = useCallback((appt: Appointment) => {
        if (Utils.isNoShow(appt)) return '#f59e0b';
        const status = String(appt.status || '').toLowerCase();
        if (status.includes('cancel')) return '#94a3b8';
        if (['completed', 'held'].includes(status)) return '#22c55e';
        const date = Utils.normalizeStoredAppointmentDate(appt);
        if (date && date < todayStr && !['completed', 'held', 'canceled', 'no show'].includes(status)) return '#ef4444';
        return '#3b82f6';
    }, [todayStr]);

    const dateOnly = (value?: string) => Utils.normalizeDateOnly(value || '') || '';
    const getWeekBounds = (offsetWeeks = 0) => {
        const base = new Date(`${todayStr}T12:00:00`);
        const day = base.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        base.setDate(base.getDate() + diffToMonday + offsetWeeks * 7);
        const start = new Date(base);
        const end = new Date(base);
        end.setDate(end.getDate() + 6);
        return { start: Utils.normalizeDateOnly(start.toISOString()) || '', end: Utils.normalizeDateOnly(end.toISOString()) || '' };
    };

    // Shared appointment filter used by every calendar/list mode.
    const filteredAppointments = useMemo(() => {
        return appointments.filter(appt => {
            const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
            const matchesAssigned = assignedFilter === 'all' || appt.assigned === assignedFilter || appt.closer === assignedFilter;
            const matchesTag = tagFilter === 'all' || (tagFilter === 'no_show' && Utils.hasTag(appt, 'no_show'));
            const matchesType = activityTypeFilter === 'all' || getActivityKind(appt) === activityTypeFilter;
            const matchesTimezone = timezoneFilter === 'all' || normalizeUSTimezone(appt.timezone) === timezoneFilter;
            const query = searchTerm.trim().toLowerCase();
            const matchesSearch = !query || [appt.business, appt.contactName, appt.phone, appt.email, appt.notes]
                .some(value => String(value || '').toLowerCase().includes(query));
            return matchesStatus && matchesAssigned && matchesTag && matchesType && matchesTimezone && matchesSearch;
        });
    }, [appointments, statusFilter, assignedFilter, tagFilter, activityTypeFilter, timezoneFilter, searchTerm, getActivityKind]);

    const listFilteredAppointments = useMemo(() => {
        if (viewMode !== 'list') return filteredAppointments;
        const today = todayStr;
        let start = '';
        let end = '';
        if (listPreset === 'today') start = end = today;
        else if (listPreset === 'tomorrow') {
            const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + 1);
            start = end = Utils.normalizeDateOnly(d.toISOString()) || '';
        } else if (listPreset === 'this_week') ({ start, end } = getWeekBounds(0));
        else if (listPreset === 'next_week') ({ start, end } = getWeekBounds(1));
        else if (listPreset === 'custom') { start = customStart; end = customEnd || customStart; }

        return filteredAppointments.filter((appt) => {
            const apptDate = dateOnly(appt.date);
            const completed = ['Completed', 'Held', 'Canceled', 'No Show'].includes(appt.status || '') || Utils.isNoShow(appt);
            const overdue = Boolean(apptDate && apptDate < today && !completed);
            if (!includeCompleted && completed) return false;
            const matchesPreset = listPreset === 'todo' ? !completed : listPreset === 'overdue' ? overdue : (!start || apptDate >= start) && (!end || apptDate <= end);
            if (!matchesPreset) return false;
            if (activityTypeFilter !== 'all' && getActivityKind(appt) !== activityTypeFilter) return false;
            if (activitySubtypeFilter !== 'all') {
                const subtype = activityTypeFilter === 'callback' ? (appt.callbackKind || 'Callback') : activityTypeFilter === 'followup' ? (appt.followUpType || 'Follow-up') : (appt.status || '');
                if (subtype !== activitySubtypeFilter) return false;
            }
            return true;
        });
    }, [filteredAppointments, viewMode, listPreset, activityTypeFilter, activitySubtypeFilter, includeCompleted, customStart, customEnd, todayStr, getActivityKind]);

    const timezones = useMemo(() => {
        const stored = appointments.map(a => a.timezone ? normalizeUSTimezone(a.timezone) : '').filter(Boolean);
        return Array.from(new Set([...US_TIMEZONE_OPTIONS.map(option => option.value), ...stored])).sort();
    }, [appointments]);

    // Navigation
    const handlePrev = useCallback(() => {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
        else if (viewMode === 'week') d.setDate(d.getDate() - 7);
        else if (viewMode === 'day') d.setDate(d.getDate() - 1);
        setCurrentDate(d);
    }, [currentDate, viewMode]);

    const handleNext = useCallback(() => {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
        else if (viewMode === 'week') d.setDate(d.getDate() + 7);
        else if (viewMode === 'day') d.setDate(d.getDate() + 1);
        setCurrentDate(d);
    }, [currentDate, viewMode]);

    const handleToday = useCallback(() => {
        setCurrentDate(new Date());
    }, []);

    // Export helpers
    const handleExportCSV = () => {
        WorkspaceService.downloadCSV(filteredAppointments);
    };

    const handleExportICS = () => {
        WorkspaceService.downloadICS(filteredAppointments);
    };

    // Drag & Drop for Kanban Stages
    const handleDragStart = useCallback((e: React.DragEvent, apptId: string) => {
        e.dataTransfer.setData('text/plain', apptId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedApptId(apptId);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggedApptId(null);
        setDragOverColumnId(null);
    }, []);

    const handleDragOverColumn = useCallback((e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverColumnId !== stageId) {
            setDragOverColumnId(stageId);
        }
    }, [dragOverColumnId]);

    const handleDragLeaveColumn = useCallback((stageId: string) => {
        if (dragOverColumnId === stageId) {
            setDragOverColumnId(null);
        }
    }, [dragOverColumnId]);

    const handleDropOnStage = useCallback(async (e: React.DragEvent, stage: PipelineStage) => {
        e.preventDefault();
        setDragOverColumnId(null);
        const apptId = e.dataTransfer.getData('text/plain') || draggedApptId;
        if (!apptId) return;

        const targetAppt = appointments.find(a => a.id === apptId);
        if (targetAppt && targetAppt.status !== stage.defaultStatus) {
            const updated: Appointment = {
                ...targetAppt,
                status: stage.defaultStatus,
                primaryStatus: Utils.getPrimaryStatus(stage.defaultStatus),
                updatedAt: new Date().toISOString()
            };
            try {
                await FirestoreService.saveAppointment(updated);
            } catch (error: any) {
                alert(error?.message || 'Unable to move the appointment. Please try again.');
            }
        }
        setDraggedApptId(null);
    }, [appointments, draggedApptId]);

    // Move stage with quick buttons
    const handleMoveStage = useCallback(async (appt: Appointment, direction: 'prev' | 'next') => {
        const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.matchStatuses.includes(appt.status || 'Pending'));
        const newIndex = direction === 'next' ? currentStageIndex + 1 : currentStageIndex - 1;
        if (newIndex >= 0 && newIndex < PIPELINE_STAGES.length) {
            const nextStage = PIPELINE_STAGES[newIndex];
            const updated: Appointment = {
                ...appt,
                status: nextStage.defaultStatus,
                primaryStatus: Utils.getPrimaryStatus(nextStage.defaultStatus),
                updatedAt: new Date().toISOString()
            };
            try {
                await FirestoreService.saveAppointment(updated);
            } catch (error: any) {
                alert(error?.message || 'Unable to move the appointment. Please try again.');
            }
        }
    }, []);

    // Generate Month Grid with fixed dimensions
    const monthGrid = useMemo((): CalendarDay[] => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const totalDays = new Date(year, month + 1, 0).getDate();
        const startingDayOfWeek = firstDay.getDay();

        const grid: CalendarDay[] = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayNum = prevMonthLastDay - i;
            const pMonth = month === 0 ? 11 : month - 1;
            const pYear = month === 0 ? year - 1 : year;
            const dateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            grid.push({
                dateStr,
                dayNumber: dayNum,
                isCurrentMonth: false,
                isToday: dateStr === Utils.getTodayStr(),
                items: filteredAppointments.filter(a => Utils.normalizeStoredAppointmentDate(a) === dateStr),
                dayOfWeek: dayNames[i]
            });
        }

        // Current month
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeekIndex = new Date(year, month, day).getDay();
            grid.push({
                dateStr,
                dayNumber: day,
                isCurrentMonth: true,
                isToday: dateStr === Utils.getTodayStr(),
                items: filteredAppointments.filter(a => Utils.normalizeStoredAppointmentDate(a) === dateStr),
                dayOfWeek: dayNames[dayOfWeekIndex]
            });
        }

        // Next month padding (ensure 42 cells total for 6 rows)
        const remaining = 42 - grid.length;
        for (let day = 1; day <= remaining; day++) {
            const nMonth = month === 11 ? 0 : month + 1;
            const nYear = month === 11 ? year + 1 : year;
            const dateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeekIndex = new Date(nYear, nMonth, day).getDay();
            grid.push({
                dateStr,
                dayNumber: day,
                isCurrentMonth: false,
                isToday: dateStr === Utils.getTodayStr(),
                items: filteredAppointments.filter(a => Utils.normalizeStoredAppointmentDate(a) === dateStr),
                dayOfWeek: dayNames[dayOfWeekIndex]
            });
        }

        return grid;
    }, [currentDate, filteredAppointments]);

    // Generate Week View Days
    const weekDays = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day;
        const startOfWeek = new Date(d.setDate(diff));

        const days: Array<{
            dateStr: string;
            dayName: string;
            dayNumber: number;
            isToday: boolean;
            items: Appointment[];
        }> = [];

        for (let i = 0; i < 7; i++) {
            const current = new Date(startOfWeek);
            current.setDate(startOfWeek.getDate() + i);
            const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            days.push({
                dateStr,
                dayName: current.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
                dayNumber: current.getDate(),
                isToday: dateStr === Utils.getTodayStr(),
                items: filteredAppointments.filter(a => Utils.normalizeStoredAppointmentDate(a) === dateStr)
            });
        }
        return days;
    }, [currentDate, filteredAppointments]);

    const parseTimeMinutes = (value?: string): number | null => {
        if (!value) return null;
        const raw = String(value).trim().toUpperCase();
        const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
        if (!match) return null;
        let hour = Number(match[1]);
        const minute = Number(match[2] || 0);
        const period = match[3];
        if (minute > 59) return null;
        if (period === 'AM' && hour === 12) hour = 0;
        if (period === 'PM' && hour !== 12) hour += 12;
        if (hour > 23) return null;
        return hour * 60 + minute;
    };

    const timelineDays = useMemo(() => {
        const sourceDays = viewMode === 'day'
            ? [Utils.normalizeDateOnly(currentDate.toISOString()) || todayStr]
            : weekDays.map(day => day.dateStr);
        return sourceDays.map(dateStr => {
            const items = filteredAppointments.filter(appt => Utils.normalizeStoredAppointmentDate(appt) === dateStr);
            const timed = items.map(appt => {
                const start = parseTimeMinutes(appt.time);
                const kind = getActivityKind(appt);
                const compact = kind === 'followup' || appt.allDay || start === null;
                const duration = compact ? (kind === 'followup' ? 24 : 32) : Math.max(15, Number(appt.durationMinutes) || (kind === 'meeting' ? 60 : 30) + (kind === 'meeting' ? Number(appt.gracePeriodMinutes) || 15 : 0));
                return { appt, start: start ?? 0, duration, compact };
            }).sort((a, b) => {
                const aDone = ['Completed', 'Held', 'Canceled', 'No Show'].includes(a.appt.status || '') || Utils.isNoShow(a.appt);
                const bDone = ['Completed', 'Held', 'Canceled', 'No Show'].includes(b.appt.status || '') || Utils.isNoShow(b.appt);
                return a.start - b.start || Number(aDone) - Number(bDone) || a.appt.id.localeCompare(b.appt.id);
            });

            // Collapse five or more activities scheduled at exactly the same minute.
            const groups: Array<{ key: string; items: typeof timed; start: number; grouped: boolean }> = [];
            const byTime = new Map<number, typeof timed>();
            timed.forEach(item => {
                const bucket = byTime.get(item.start) || [];
                bucket.push(item);
                byTime.set(item.start, bucket);
            });
            byTime.forEach((group, start) => groups.push({ key: `${dateStr}-${start}`, items: group, start, grouped: group.length >= 5 }));
            groups.sort((a, b) => a.start - b.start);

            const placed: Array<{ appt: Appointment; start: number; duration: number; compact: boolean; column: number; columns: number }> = [];
            const ungrouped = groups.filter(g => !g.grouped).flatMap(g => g.items);
            ungrouped.forEach(item => {
                const overlapping = placed.filter(existing => existing.start < item.start + item.duration && existing.start + existing.duration > item.start);
                const used = new Set(overlapping.map(existing => existing.column));
                let column = 0; while (used.has(column)) column += 1;
                placed.push({ ...item, column, columns: 1 });
            });
            placed.forEach(item => {
                const overlaps = placed.filter(other => other.start < item.start + item.duration && other.start + other.duration > item.start);
                item.columns = Math.max(1, ...overlaps.map(other => other.column + 1));
            });
            return { dateStr, groups, placed };
        });
    }, [viewMode, currentDate, filteredAppointments, weekDays, todayStr, getActivityKind]);

    const sortedListAppointments = useMemo(() => {
        const value = (appt: Appointment): string | number => {
            if (sortKey === 'date') return `${Utils.normalizeStoredAppointmentDate(appt) || ''} ${parseTimeMinutes(appt.time) ?? 9999}`;
            if (sortKey === 'type') return getActivityKind(appt);
            if (sortKey === 'owner') return appt.assigned || appt.closer || '';
            if (sortKey === 'status') return appt.status || '';
            return appt.business || '';
        };
        return [...listFilteredAppointments].sort((a, b) => {
            const av = value(a), bv = value(b);
            const result = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDirection === 'asc' ? result : -result;
        });
    }, [listFilteredAppointments, sortKey, sortDirection, getActivityKind]);

    // Title Text
    const titleText = useMemo(() => {
        if (viewMode === 'kanban') {
            return 'Lead Pipeline Board';
        } else if (viewMode === 'month') {
            return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        } else if (viewMode === 'week') {
            return `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else if (viewMode === 'list') {
            return 'Appointment List';
        } else {
            return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
    }, [currentDate, viewMode]);

    // Pipeline Metrics
    const pipelineMetrics = useMemo(() => {
        const total = filteredAppointments.length;
        const newLeads = filteredAppointments.filter(a => ['New Lead', 'Pending'].includes(a.status || '')).length;
        const booked = filteredAppointments.filter(a => a.status === 'Meeting Booked').length;
        const hot = filteredAppointments.filter(a => a.status === 'Hot Transfer').length;
        const completed = filteredAppointments.filter(a => ['Completed', 'Held'].includes(a.status || '')).length;
        const rate = total > 0 ? Math.round(((booked + hot + completed) / total) * 100) : 0;
        return { total, newLeads, booked, hot, completed, rate };
    }, [filteredAppointments]);

    // Render compact appointment card for month view
    const renderAppointmentCard = (appt: Appointment, index: number, maxDisplay: number = 3) => {
        const statusColor = getActivityColor(appt);
        const timeDisplay = appt.time || '';

        if (index >= maxDisplay) return null;

        return (
            <div
                key={appt.id}
                draggable
                onDragStart={(e) => handleDragStart(e, appt.id)}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelectAppointment(appt);
                }}
                style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    marginBottom: '2px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: '#e2e8f0',
                    borderLeft: `2px solid ${statusColor}`,
                    transition: 'all 0.15s ease',
                    maxWidth: '100%',
                    overflow: 'hidden'
                }}
                className="hover:bg-slate-700/30"
                title={`${appt.business} - ${appt.contactName || ''}`}
            >
                {timeDisplay && (
                    <span style={{ 
                        fontSize: '8px', 
                        color: '#94a3b8', 
                        flexShrink: 0,
                        fontWeight: 600
                    }}>
                        {timeDisplay}
                    </span>
                )}
                <span style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    flex: 1,
                    fontWeight: 500
                }}>
                    {appt.business}
                </span>
                {appt.contactName && (
                    <span style={{ 
                        fontSize: '8px', 
                        color: '#64748b',
                        flexShrink: 0,
                        maxWidth: '40px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {appt.contactName}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="calendar-container" style={{ padding: '0 0 24px 0' }}>
            {/* Top Control Bar */}
            <div className="activities-hero-nav" style={{ 
                position: 'sticky',
                top: 0,
                zIndex: 40,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '12px',
                padding: '10px 0 12px',
                margin: '0 -2px 14px',
                background: 'linear-gradient(180deg, #090d16 82%, rgba(9,13,22,0.94) 100%)',
                borderBottom: '1px solid #142036',
                boxShadow: '0 8px 20px rgba(0,0,0,0.18)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {viewMode !== 'kanban' && viewMode !== 'list' && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            background: '#0d1527', 
                            border: '1px solid #1a2744', 
                            borderRadius: '10px', 
                            overflow: 'hidden' 
                        }}>
                            <button onClick={handlePrev} style={{ 
                                padding: '6px 10px', 
                                border: 'none', 
                                background: 'transparent', 
                                color: '#94a3b8', 
                                cursor: 'pointer' 
                            }}>
                                <i className="fas fa-chevron-left"></i>
                            </button>
                            <button onClick={handleToday} style={{ 
                                padding: '6px 12px', 
                                border: 'none', 
                                borderLeft: '1px solid #1a2744', 
                                borderRight: '1px solid #1a2744', 
                                background: 'transparent', 
                                color: '#f8fafc', 
                                fontWeight: 700, 
                                fontSize: '12px', 
                                cursor: 'pointer' 
                            }}>
                                Today
                            </button>
                            <button onClick={handleNext} style={{ 
                                padding: '6px 10px', 
                                border: 'none', 
                                background: 'transparent', 
                                color: '#94a3b8', 
                                cursor: 'pointer' 
                            }}>
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    )}
                    
                    <h2 style={{ 
                        margin: 0, 
                        fontSize: '20px', 
                        fontWeight: 800, 
                        color: '#f8fafc', 
                        letterSpacing: '-0.02em' 
                    }}>
                        {titleText}
                    </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '4px', background: '#0d1527', border: '1px solid #1a2744', borderRadius: '10px', padding: '3px' }}>
                        {(['list', 'calendar'] as const).map(mode => {
                            const active = mode === 'list' ? viewMode === 'list' : viewMode !== 'list';
                            return (
                                <button key={mode} onClick={() => setViewMode(mode === 'list' ? 'list' : (viewMode === 'kanban' ? 'kanban' : 'month'))} style={{ padding: '5px 13px', borderRadius: '6px', border: 'none', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : '#94a3b8', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                                    {mode === 'list' ? 'List' : 'Calendar'}
                                </button>
                            );
                        })}
                    </div>
                    {viewMode !== 'list' && (
                        <div style={{ display: 'flex', gap: '2px', background: '#0d1527', border: '1px solid #1a2744', borderRadius: '8px', padding: '2px' }}>
                            {(['month', 'week', 'day', 'kanban'] as const).map(mode => (
                                <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '4px 8px', borderRadius: '5px', border: 'none', background: viewMode === mode ? '#1e3a8a' : 'transparent', color: viewMode === mode ? '#dbeafe' : '#64748b', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                    {mode[0].toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                    {(viewMode === 'day' || viewMode === 'week') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#0d1527', border: '1px solid #1a2744', borderRadius: '8px', padding: '2px' }} aria-label="Calendar zoom">
                            <button onClick={() => setCalendarZoom(z => Math.max(0.65, +(z - 0.1).toFixed(2)))} title="Zoom out" style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px 6px' }}>−</button>
                            <span style={{ fontSize: '10px', color: '#cbd5e1', minWidth: '42px', textAlign: 'center' }}>{Math.round(calendarZoom * 100)}%</span>
                            <button onClick={() => setCalendarZoom(z => Math.min(1.6, +(z + 0.1).toFixed(2)))} title="Zoom in" style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px 6px' }}>+</button>
                        </div>
                    )}

                    <div className="activities-timezone-control" style={{ display: 'flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 8px 0 10px', borderRadius: '9px', border: '1px solid #1a2744', background: '#0d1527' }} title="Default timezone for new bookings">
                        <i className="fas fa-globe-americas" style={{ fontSize: '11px', color: '#64748b' }}></i>
                        <select
                            value={workspaceTimezone}
                            onChange={(e) => { setWorkspaceTimezoneState(e.target.value); setWorkspaceTimezone(e.target.value); }}
                            aria-label="Default booking timezone"
                            style={{ border: 'none', outline: 'none', background: 'transparent', color: '#dbeafe', fontSize: '11px', fontWeight: 800, cursor: 'pointer', maxWidth: '128px' }}
                        >
                            {US_TIMEZONE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </div>
                    <button 
                        onClick={() => onOpenQuickAdd()}
                        style={{
                            padding: '4px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#2563eb',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <i className="fas fa-plus" style={{ fontSize: '10px' }}></i>
                        <span>Add</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ 
                background: '#0d1527', 
                border: '1px solid #1a2744', 
                borderRadius: '12px', 
                padding: '10px 14px', 
                marginBottom: '14px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                flexWrap: 'wrap' 
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                    <i className="fas fa-search" style={{ 
                        position: 'absolute', 
                        left: '10px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: '#64748b', 
                        fontSize: '11px' 
                    }}></i>
                    <input 
                        type="text" 
                        placeholder="Search leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ 
                            width: '100%', 
                            height: '32px', 
                            padding: '0 10px 0 30px', 
                            borderRadius: '8px', 
                            border: '1px solid #1e293b', 
                            background: '#090e1a', 
                            color: '#f8fafc', 
                            fontSize: '12px',
                            outline: 'none'
                        }}
                    />
                </div>

                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ 
                        height: '32px', 
                        padding: '0 10px', 
                        borderRadius: '8px', 
                        border: '1px solid #1e293b', 
                        background: '#090e1a', 
                        color: '#f8fafc', 
                        fontSize: '11px',
                        outline: 'none'
                    }}
                >
                    <option value="all">All Statuses</option>
                    {CONFIG.STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select 
                    value={assignedFilter}
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    style={{ 
                        height: '32px', 
                        padding: '0 10px', 
                        borderRadius: '8px', 
                        border: '1px solid #1e293b', 
                        background: '#090e1a', 
                        color: '#f8fafc', 
                        fontSize: '11px',
                        outline: 'none'
                    }}
                >
                    <option value="all">All Agents</option>
                    {CONFIG.DEFAULT_TEAM_MEMBERS.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                    {closers.map(c => (
                        <option key={c.id} value={c.name}>{c.name}{!c.active ? ' (Inactive)' : ''}</option>
                    ))}
                </select>

                {viewMode !== 'list' && <select
                    value={activityTypeFilter}
                    onChange={(e) => { setActivityTypeFilter(e.target.value as 'all' | 'meeting' | 'callback' | 'followup'); setActivitySubtypeFilter('all'); }}
                    aria-label="Activity type"
                    style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px', outline: 'none' }}
                >
                    <option value="all">All Activities</option>
                    <option value="meeting">Meetings</option>
                    <option value="callback">Callbacks</option>
                    <option value="followup">Follow-ups</option>
                </select>}

                <select
                    value={timezoneFilter}
                    onChange={(e) => setTimezoneFilter(e.target.value)}
                    aria-label="Timezone"
                    style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px', outline: 'none' }}
                >
                    <option value="all">All Timezones</option>
                    {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>

                <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    style={{
                        height: '32px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid #1e293b',
                        background: '#090e1a',
                        color: '#f8fafc',
                        fontSize: '11px',
                        outline: 'none'
                    }}
                >
                    <option value="all">All Tags</option>
                    <option value="no_show">No-Show</option>
                </select>

                <span style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    fontWeight: 600,
                    marginLeft: 'auto'
                }}>
                    {filteredAppointments.length} leads
                </span>
            </div>

            {/* Main Calendar Views */}
            <div
                onWheel={(e) => {
                    if ((viewMode === 'day' || viewMode === 'week') && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        setCalendarZoom(z => Math.max(0.65, Math.min(1.6, +(z + (e.deltaY < 0 ? 0.08 : -0.08)).toFixed(2))));
                    }
                }}
                style={{ minWidth: 0 }}
            >
            {viewMode === 'kanban' ? (
                // Kanban View - Same as before
                <div>
                    {/* Pipeline Metrics */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                        gap: '10px', 
                        marginBottom: '14px' 
                    }}>
                        <div style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '12px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>TOTAL</div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc' }}>{pipelineMetrics.total}</div>
                        </div>
                        <div style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '12px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '10px', color: '#34d399', fontWeight: 700 }}>BOOKED</div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#34d399' }}>{pipelineMetrics.booked}</div>
                        </div>
                        <div style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '12px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '10px', color: '#f87171', fontWeight: 700 }}>HOT</div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#f87171' }}>{pipelineMetrics.hot}</div>
                        </div>
                        <div style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '12px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700 }}>CONVERSION</div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#a78bfa' }}>{pipelineMetrics.rate}%</div>
                        </div>
                    </div>

                    {/* Kanban Columns */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        overflowX: 'auto', 
                        paddingBottom: '12px', 
                        minHeight: '400px',
                        alignItems: 'stretch'
                    }}>
                        {PIPELINE_STAGES.map(stage => {
                            const stageAppointments = filteredAppointments.filter(a => stage.matchStatuses.includes(a.status || 'Pending'));
                            const isOver = dragOverColumnId === stage.id;

                            return (
                                <div 
                                    key={stage.id}
                                    style={{
                                        flex: '0 0 260px',
                                        minWidth: '260px',
                                        maxWidth: '260px',
                                        background: '#0d1527',
                                        border: `1px solid ${isOver ? '#38bdf8' : '#1a2744'}`,
                                        borderRadius: '14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'all 0.2s ease',
                                        maxHeight: '500px'
                                    }}
                                    onDragOver={(e) => handleDragOverColumn(e, stage.id)}
                                    onDragLeave={() => handleDragLeaveColumn(stage.id)}
                                    onDrop={(e) => handleDropOnStage(e, stage)}
                                >
                                    <div style={{ 
                                        padding: '10px 14px', 
                                        borderBottom: '1px solid #1a2744',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexShrink: 0
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ 
                                                width: '24px', 
                                                height: '24px', 
                                                borderRadius: '6px', 
                                                background: stage.bgColor, 
                                                color: stage.color,
                                                display: 'grid',
                                                placeItems: 'center',
                                                fontSize: '11px'
                                            }}>
                                                <i className={`fas ${stage.icon}`}></i>
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                                                {stage.title}
                                            </span>
                                        </div>
                                        <span style={{ 
                                            fontSize: '10px', 
                                            fontWeight: 800, 
                                            padding: '1px 8px', 
                                            borderRadius: '10px', 
                                            background: '#090e1a', 
                                            color: stage.color,
                                            border: '1px solid #1e293b'
                                        }}>
                                            {stageAppointments.length}
                                        </span>
                                    </div>

                                    <div style={{ 
                                        flex: 1, 
                                        padding: '8px', 
                                        overflowY: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        minHeight: '200px'
                                    }}>
                                        {stageAppointments.length === 0 ? (
                                            <div style={{ 
                                                flex: 1, 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                padding: '20px',
                                                color: '#475569',
                                                fontSize: '11px',
                                                border: '1px dashed #1e293b',
                                                borderRadius: '8px'
                                            }}>
                                                <i className={`fas ${stage.icon}`} style={{ fontSize: '16px', marginBottom: '6px', opacity: 0.3 }}></i>
                                                <span>Drop leads here</span>
                                            </div>
                                        ) : (
                                            stageAppointments.map(appt => {
                                                const score = Utils.calculateLeadScore(appt);
                                                return (
                                                    <div
                                                        key={appt.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, appt.id)}
                                                        onDragEnd={handleDragEnd}
                                                        onClick={() => onSelectAppointment(appt)}
                                                        style={{
                                                            background: '#090e1a',
                                                            border: '1px solid #1e293b',
                                                            borderRadius: '8px',
                                                            padding: '8px 10px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        className="hover:border-slate-600"
                                                    >
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            justifyContent: 'space-between',
                                                            alignItems: 'flex-start',
                                                            marginBottom: '4px'
                                                        }}>
                                                            <span style={{ 
                                                                fontSize: '12px', 
                                                                fontWeight: 700, 
                                                                color: '#f8fafc',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                flex: 1
                                                            }}>
                                                                {appt.business}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '9px',
                                                                fontWeight: 800,
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                background: score >= 70 ? 'rgba(239,68,68,0.2)' : 'rgba(56,189,248,0.2)',
                                                                color: score >= 70 ? '#f87171' : '#38bdf8',
                                                                flexShrink: 0,
                                                                marginLeft: '6px'
                                                            }}>
                                                                {score}
                                                            </span>
                                                        </div>
                                                        <div style={{ 
                                                            fontSize: '10px', 
                                                            color: '#94a3b8',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            flexWrap: 'wrap'
                                                        }}>
                                                            <span>{appt.contactName || 'No contact'}</span>
                                                            {appt.time && (
                                                                <span style={{ fontSize: '9px', color: '#64748b' }}>
                                                                    • {appt.time}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : viewMode === 'list' ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {([['todo', 'To-do'], ['overdue', 'Overdue'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['this_week', 'This week'], ['next_week', 'Next week'], ['custom', 'Custom']] as const).map(([value, label]) => (
                            <button key={value} onClick={() => setListPreset(value)} aria-pressed={listPreset === value} style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid #2a3852', background: listPreset === value ? '#18243b' : '#0d1527', color: listPreset === value ? '#f8fafc' : '#94a3b8', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{label}</button>
                        ))}
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
                            Include completed
                        </label>
                    </div>
                    {listPreset === 'custom' && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Custom start date" style={{ height: '32px', padding: '0 9px', borderRadius: '7px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px' }} />
                            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="Custom end date" min={customStart || undefined} style={{ height: '32px', padding: '0 9px', borderRadius: '7px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px' }} />
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                        <button onClick={() => { setActivityTypeFilter('all'); setActivitySubtypeFilter('all'); }} aria-pressed={activityTypeFilter === 'all'} style={{ padding: '7px 11px', borderRadius: '8px', border: `1px solid ${activityTypeFilter === 'all' ? '#64748b' : '#2a3852'}`, background: activityTypeFilter === 'all' ? '#162036' : '#0d1527', color: '#e2e8f0', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>All</button>
                        {([['meeting', 'Meetings', '#8b9cff'], ['callback', 'Callbacks', '#fbbf24'], ['followup', 'Follow-ups', '#34d399']] as const).map(([value, label, dot]) => (
                            <button key={value} onClick={() => { setActivityTypeFilter(activityTypeFilter === value ? 'all' : value); setActivitySubtypeFilter('all'); }} aria-pressed={activityTypeFilter === value} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 11px', borderRadius: '8px', border: `1px solid ${activityTypeFilter === value ? dot : '#2a3852'}`, background: activityTypeFilter === value ? '#162036' : '#0d1527', color: '#e2e8f0', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot }}></span>{label}</button>
                        ))}
                    </div>
                    {activityTypeFilter !== 'all' && activityTypeFilter !== 'meeting' && (
                        <select
                            value={activitySubtypeFilter}
                            onChange={(e) => setActivitySubtypeFilter(e.target.value)}
                            aria-label={`${activityTypeFilter} subtype`}
                            style={{ height: '32px', marginBottom: '10px', padding: '0 10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px' }}
                        >
                            <option value="all">All {activityTypeFilter === 'callback' ? 'Callback Kinds' : 'Follow-up Types'}</option>
                            {Array.from(new Set(filteredAppointments.map(appt => activityTypeFilter === 'callback' ? (appt.callbackKind || 'Callback') : (appt.followUpType || 'Follow-up')))).sort().map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                    )}
                    <div style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '14px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '14px 16px', borderBottom: '1px solid #1a2744', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Showing <strong style={{ color: '#f8fafc' }}>{sortedListAppointments.length}</strong> activities</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>Central (CDT)</span>
                                <button onClick={() => onOpenQuickAdd()} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #2563eb', background: 'rgba(37,99,235,.12)', color: '#60a5fa', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}><i className="fas fa-plus" style={{ marginRight: '6px' }}></i>Quick Add</button>
                            </div>
                        </div>
                        {sortedListAppointments.length === 0 ? (
                            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                                <i className="fas fa-calendar-xmark" style={{ fontSize: '26px', marginBottom: '10px' }}></i>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>No activities found</div>
                                <div style={{ fontSize: '11px', marginTop: '4px' }}>Adjust the filters or add a new activity.</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                                    <thead>
                                        <tr style={{ background: '#090e1a' }}>
                                            {([['date','Date / Time'], ['type','Type'], ['business','Business'], ['owner','Owner'], ['status','Status']] as const).map(([key,label]) => (
                                                <th key={key} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '.04em', borderBottom: '1px solid #1a2744', whiteSpace: 'nowrap' }}>
                                                    <button onClick={() => { if (sortKey === key) setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDirection('asc'); } }} style={{ border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}>{label} <i className={`fas fa-sort${sortKey === key ? sortDirection === 'asc' ? '-up' : '-down' : ''}`} style={{ marginLeft: '3px' }}></i></button>
                                                </th>
                                            ))}
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#64748b', borderBottom: '1px solid #1a2744' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedListAppointments.map(appt => {
                                            const kind = getActivityKind(appt);
                                            const statusColor = getActivityColor(appt);
                                            const completed = ['Completed','Held','Canceled','No Show'].includes(appt.status || '') || Utils.isNoShow(appt);
                                            const typeIcon = kind === 'callback' ? 'fa-phone-volume' : kind === 'followup' ? 'fa-list-check' : 'fa-calendar-check';
                                            const typeLabel = kind === 'callback' ? (appt.callbackKind || 'Callback') : kind === 'followup' ? (appt.followUpType || 'Follow-up') : 'Meeting';
                                            const openRecord = () => onSelectAppointment(appt);
                                            const markDone = async () => {
                                                if (completed) return;
                                                try { await FirestoreService.saveAppointment({ ...appt, status: 'Completed', primaryStatus: Utils.getPrimaryStatus('Completed'), updatedAt: new Date().toISOString() }); }
                                                catch (error: any) { alert(error?.message || 'Unable to mark the activity done.'); }
                                            };
                                            const togglePause = async () => {
                                                try { await FirestoreService.saveAppointment({ ...appt, callbackPaused: !appt.callbackPaused, updatedAt: new Date().toISOString() }); }
                                                catch (error: any) { alert(error?.message || 'Unable to update the callback.'); }
                                            };
                                            return (
                                                <tr key={appt.id} style={{ borderBottom: '1px solid rgba(26,39,68,.7)' }} className="hover:bg-slate-800/30">
                                                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }} onClick={openRecord}><div style={{ fontSize: '11px', fontWeight: 800, color: '#f8fafc' }}>{Utils.formatDate(appt.date)}</div><div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.time || 'All day'}{appt.timezone ? ` • ${appt.timezone}` : ''}</div></td>
                                                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }} onClick={openRecord}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#cbd5e1' }}><i className={`fas ${typeIcon}`} style={{ color: kind === 'callback' ? '#fbbf24' : kind === 'followup' ? '#34d399' : '#8b9cff' }}></i>{typeLabel}</span></td>
                                                    <td style={{ padding: '11px 14px', minWidth: '180px' }} onClick={openRecord}><div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.business || 'Untitled'}</div><div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.contactName || 'No contact'}{appt.phone ? ` • ${appt.phone}` : ''}</div></td>
                                                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }} onClick={openRecord}><div style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>{appt.assigned || 'Unassigned'}</div><div style={{ fontSize: '10px', color: '#64748b' }}>{appt.closer ? `Closer: ${appt.closer}` : 'No closer'}</div></td>
                                                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }} onClick={openRecord}><span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 9px', borderRadius: '999px', background: `${statusColor}1c`, color: statusColor, fontSize: '10px', fontWeight: 800 }}>{appt.status || 'Pending'}</span></td>
                                                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            {appt.phone && <button onClick={() => { window.location.href = `tel:${appt.phone}`; }} title="Call" aria-label={`Call ${appt.contactName || appt.business}`} style={{ border: 'none', background: 'transparent', color: '#60a5fa', cursor: 'pointer', padding: '5px' }}><i className="fas fa-phone"></i></button>}
                                                            <select
                                                                value={appt.assigned || ''}
                                                                onChange={async (e) => {
                                                                    e.stopPropagation();
                                                                    try { await FirestoreService.saveAppointment({ ...appt, assigned: e.target.value, updatedAt: new Date().toISOString() }); }
                                                                    catch (error: any) { alert(error?.message || 'Unable to reassign the activity.'); }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                title="Reassign owner"
                                                                aria-label="Reassign owner"
                                                                style={{ maxWidth: 90, height: 26, borderRadius: 6, border: '1px solid #1e293b', background: '#091020', color: '#94a3b8', fontSize: 9, padding: '0 4px' }}
                                                            >
                                                                <option value="">Owner</option>
                                                                {CONFIG.DEFAULT_TEAM_MEMBERS.filter(m => m.active).map(member => <option key={member.id} value={member.name}>{member.name}</option>)}
                                                            </select>
                                                            <button onClick={openRecord} title={kind === 'meeting' ? 'Open meeting' : 'Open contact'} aria-label={kind === 'meeting' ? 'Open meeting' : 'Open contact'} style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '5px' }}><i className={`fas ${kind === 'meeting' ? 'fa-calendar-check' : 'fa-address-card'}`}></i></button>
                                                            {kind === 'callback' && <button onClick={() => void togglePause()} title={appt.callbackPaused ? 'Return callback to pool' : 'Pause callback'} aria-label={appt.callbackPaused ? 'Return callback to pool' : 'Pause callback'} style={{ border: 'none', background: 'transparent', color: '#fbbf24', cursor: 'pointer', padding: '5px' }}><i className={`fas ${appt.callbackPaused ? 'fa-play' : 'fa-pause'}`}></i></button>}
                                                            {kind === 'callback' && !completed && <button onClick={() => void markDone()} title="Mark done" aria-label="Mark callback done" style={{ border: 'none', background: 'transparent', color: '#22c55e', cursor: 'pointer', padding: '5px' }}><i className="fas fa-check"></i></button>}
                                                            <button onClick={openRecord} title="Reschedule" aria-label="Reschedule" style={{ border: 'none', background: 'transparent', color: '#a78bfa', cursor: 'pointer', padding: '5px' }}><i className="fas fa-calendar-days"></i></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            ) : viewMode === 'month' ? (
                // Month View - Fixed Layout
                <div style={{ 
                    background: '#0d1527', 
                    border: '1px solid #1a2744', 
                    borderRadius: '14px', 
                    overflow: 'hidden' 
                }}>
                    {/* Day Headers */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 1fr)', 
                        background: '#090e1a', 
                        borderBottom: '1px solid #1a2744',
                        textAlign: 'center',
                        padding: '8px 0',
                        fontWeight: 700,
                        fontSize: '11px',
                        color: '#64748b',
                        letterSpacing: '0.05em'
                    }}>
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                    </div>

                    {/* Calendar Grid - Fixed Height Cells */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gridTemplateRows: 'repeat(6, 1fr)',
                        height: 'calc(100vh - 340px)',
                        minHeight: '420px',
                        maxHeight: '620px'
                    }}>
                        {monthGrid.map((cell, idx) => {
                            const maxDisplay = 3;
                            const hasMore = cell.items.length > maxDisplay;
                            const displayItems = cell.items.slice(0, maxDisplay);

                            return (
                                <div 
                                    key={idx}
                                    onClick={() => onOpenQuickAdd(cell.dateStr)}
                                    style={{
                                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid #1a2744' : 'none',
                                        borderBottom: idx < 35 ? '1px solid #1a2744' : 'none',
                                        padding: '4px 6px',
                                        background: cell.isToday ? 'rgba(56, 189, 248, 0.04)' : cell.isCurrentMonth ? '#0d1527' : '#080d1a',
                                        opacity: cell.isCurrentMonth ? 1 : 0.4,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                        minHeight: '60px',
                                        overflow: 'hidden',
                                        transition: 'background 0.15s ease'
                                    }}
                                    className="hover:bg-slate-800/30"
                                >
                                    {/* Day Number */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexShrink: 0,
                                        marginBottom: '2px'
                                    }}>
                                        <span style={{
                                            fontSize: '12px',
                                            fontWeight: cell.isToday ? 900 : 600,
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            display: 'grid',
                                            placeItems: 'center',
                                            background: cell.isToday ? '#2563eb' : 'transparent',
                                            color: cell.isToday ? '#fff' : '#e2e8f0'
                                        }}>
                                            {cell.dayNumber}
                                        </span>
                                        {cell.items.length > 0 && (
                                            <span style={{
                                                fontSize: '9px',
                                                fontWeight: 700,
                                                color: '#38bdf8',
                                                background: 'rgba(56,189,248,0.1)',
                                                padding: '0 6px',
                                                borderRadius: '8px'
                                            }}>
                                                {cell.items.length}
                                            </span>
                                        )}
                                    </div>

                                    {/* Appointments Container - Fixed height, scrollable */}
                                    <div style={{
                                        flex: 1,
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1px',
                                        minHeight: '0'
                                    }}>
                                        {displayItems.map((appt, index) => renderAppointmentCard(appt, index, maxDisplay))}
                                        
                                        {hasMore && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowMoreModal({ 
                                                        date: cell.dateStr, 
                                                        appointments: cell.items 
                                                    });
                                                }}
                                                style={{
                                                    fontSize: '9px',
                                                    color: '#38bdf8',
                                                    fontWeight: 600,
                                                    padding: '1px 6px',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    borderRadius: '4px',
                                                    background: 'rgba(56,189,248,0.06)',
                                                    transition: 'all 0.15s ease',
                                                    flexShrink: 0
                                                }}
                                                className="hover:bg-slate-700/30"
                                            >
                                                +{cell.items.length - maxDisplay} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                // Week / Day timeline. Activities use the same filtered dataset as List view.
                <div style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '14px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${timelineDays.length}, minmax(180px, 1fr))`, overflowX: 'auto', background: '#090e1a', borderBottom: '1px solid #1a2744' }}>
                        <div style={{ padding: '12px 8px', fontSize: '9px', color: '#64748b', textAlign: 'center' }}>TIME</div>
                        {timelineDays.map(day => { const date = new Date(`${day.dateStr}T12:00:00`); return <div key={day.dateStr} style={{ padding: '9px 10px', textAlign: 'center', borderLeft: '1px solid #1a2744' }}><div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div><div style={{ marginTop: '2px', fontSize: '14px', color: day.dateStr === todayStr ? '#38bdf8' : '#f8fafc', fontWeight: 900 }}>{date.getDate()}</div></div>; })}
                    </div>
                    <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 315px)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${timelineDays.length}, minmax(180px, 1fr))`, minWidth: `${64 + timelineDays.length * 180}px`, height: `${1440 * calendarZoom}px` }}>
                            <div style={{ position: 'relative', borderRight: '1px solid #1a2744', background: '#090e1a' }}>
                                {Array.from({ length: 24 }, (_, hour) => <div key={hour} style={{ position: 'absolute', top: `${hour * 60 * calendarZoom}px`, left: 0, right: 0, height: 1, borderTop: '1px solid #1a2744' }}><span style={{ position: 'absolute', top: '-7px', right: '7px', fontSize: '9px', color: '#64748b' }}>{String(hour).padStart(2,'0')}:00</span></div>)}
                            </div>
                            {timelineDays.map((day, dayIndex) => (
                                <div key={day.dateStr} onDoubleClick={() => onOpenQuickAdd(day.dateStr)} style={{ position: 'relative', borderRight: dayIndex < timelineDays.length - 1 ? '1px solid #1a2744' : 'none', background: day.dateStr === todayStr ? 'rgba(56,189,248,.025)' : '#0d1527' }}>
                                    {Array.from({ length: 24 }, (_, hour) => <div key={hour} style={{ position: 'absolute', top: `${hour * 60 * calendarZoom}px`, left: 0, right: 0, borderTop: '1px solid rgba(26,39,68,.65)', pointerEvents: 'none' }} />)}
                                    {day.groups.filter(g => g.grouped).map(group => { const first = group.items[0].appt; const top = group.start * calendarZoom; return <button key={group.key} onClick={() => setShowMoreModal({ date: day.dateStr, appointments: group.items.map(i => i.appt) })} style={{ position: 'absolute', top, left: 6, right: 6, minHeight: `${Math.max(38, 36 * calendarZoom)}px`, border: '1px solid #334155', borderRadius: 8, background: 'rgba(37,99,235,.18)', color: '#dbeafe', cursor: 'pointer', textAlign: 'left', padding: '7px 9px', zIndex: 4 }}><strong style={{ fontSize: '11px' }}>{group.items.length} activities</strong><div style={{ fontSize: '9px', color: '#93c5fd', marginTop: 2 }}>{first.time || 'All day'} • grouped</div></button>; })}
                                    {day.placed.map(item => { const width = 100 / Math.max(1, item.columns); const left = width * item.column; const color = getActivityColor(item.appt); const kind = getActivityKind(item.appt); const top = item.start * calendarZoom; const height = Math.max(item.compact ? 22 : 30, item.duration * calendarZoom); return <button key={item.appt.id} onClick={() => setSelectedCalendarActivity(item.appt)} title={`${item.appt.business} — ${item.appt.contactName || ''}`} style={{ position: 'absolute', top, left: `calc(${left}% + 3px)`, width: `calc(${width}% - 6px)`, height, border: `1px solid ${color}66`, borderLeft: `3px solid ${color}`, borderRadius: 7, background: `${color}20`, color: '#e2e8f0', cursor: 'pointer', padding: '5px 7px', textAlign: 'left', overflow: 'hidden', zIndex: 3 }}><div style={{ fontSize: '10px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.appt.business || 'Untitled'}</div><div style={{ fontSize: '9px', color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.appt.time || 'All day'} • {kind}</div></button>; })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            </div>

            {/* Calendar Activity Popover */}
            {selectedCalendarActivity && (() => {
                const activity = selectedCalendarActivity;
                const kind = getActivityKind(activity);
                const color = getActivityColor(activity);
                const isMeeting = kind === 'meeting';
                return (
                    <div style={{ position: 'fixed', top: '92px', right: '22px', zIndex: 1000, width: 'min(360px, calc(100vw - 32px))', background: '#0d1527', border: `1px solid ${color}66`, borderRadius: '14px', boxShadow: '0 18px 50px rgba(0,0,0,.45)', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div><div style={{ fontSize: '10px', color, fontWeight: 900, textTransform: 'uppercase' }}>{kind}</div><h3 style={{ margin: '4px 0 0', fontSize: '15px', color: '#f8fafc' }}>{activity.business || 'Untitled'}</h3><div style={{ marginTop: 3, fontSize: '11px', color: '#94a3b8' }}>{activity.time || 'All day'} • {activity.contactName || 'No contact'}</div></div>
                            <button onClick={() => setSelectedCalendarActivity(null)} aria-label="Close activity details" style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer' }}><i className="fas fa-times"></i></button>
                        </div>
                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                            <div style={{ padding: 8, borderRadius: 8, background: '#091020' }}><div style={{ fontSize: 9, color: '#64748b' }}>Status</div><div style={{ fontSize: 11, fontWeight: 800, color }}>{activity.status || 'Pending'}</div></div>
                            <div style={{ padding: 8, borderRadius: 8, background: '#091020' }}><div style={{ fontSize: 9, color: '#64748b' }}>Timezone</div><div style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1' }}>{normalizeUSTimezone(activity.timezone)}</div></div>
                            {isMeeting && <><div style={{ padding: 8, borderRadius: 8, background: '#091020' }}><div style={{ fontSize: 9, color: '#64748b' }}>Closer</div><div style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1' }}>{activity.closer || 'Unassigned'}</div></div><div style={{ padding: 8, borderRadius: 8, background: '#091020' }}><div style={{ fontSize: 9, color: '#64748b' }}>Booker / Owner</div><div style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1' }}>{activity.assigned || 'Unassigned'}</div></div><div style={{ padding: 8, borderRadius: 8, background: '#091020' }}><div style={{ fontSize: 9, color: '#64748b' }}>Quality</div><div style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1' }}>{activity.qualityScore ?? '—'}</div></div><div style={{ padding: 8, borderRadius: 8, background: '#091020' }}><div style={{ fontSize: 9, color: '#64748b' }}>Confirmation</div><div style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1' }}>{activity.confirmationStatus || '—'}</div></div></>}
                        </div>
                        {isMeeting && <div style={{ marginTop: 8, fontSize: 10, color: '#64748b' }}>Website: {activity.websiteStatus || '—'}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                            {activity.phone && <button onClick={() => { window.location.href = `tel:${activity.phone}`; }} style={{ flex: 1, border: '1px solid #1e3a8a', background: 'rgba(37,99,235,.12)', color: '#60a5fa', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontWeight: 800, fontSize: 11 }}><i className="fas fa-phone" style={{ marginRight: 5 }}></i>Call</button>}
                            <button onClick={() => { setSelectedCalendarActivity(null); onSelectAppointment(activity); }} style={{ flex: 1, border: '1px solid #334155', background: '#111b2d', color: '#e2e8f0', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>Open {isMeeting ? 'meeting' : 'contact'}</button>
                        </div>
                    </div>
                );
            })()}

            {/* Show More Modal */}
            {showMoreModal && (
                <div 
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999,
                        padding: '20px'
                    }}
                    onClick={() => setShowMoreModal(null)}
                >
                    <div 
                        style={{
                            background: '#0d1527',
                            border: '1px solid #1a2744',
                            borderRadius: '16px',
                            padding: '24px',
                            maxWidth: '500px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflow: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                        }}>
                            <h3 style={{ 
                                margin: 0, 
                                fontSize: '16px', 
                                fontWeight: 800, 
                                color: '#f8fafc' 
                            }}>
                                {Utils.formatDate(showMoreModal.date)}
                            </h3>
                            <button
                                onClick={() => setShowMoreModal(null)}
                                style={{
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#94a3b8',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'grid',
                                    placeItems: 'center'
                                }}
                                className="hover:bg-slate-700/30"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {showMoreModal.appointments.map(appt => {
                                const statusColor = getActivityColor(appt);
                                return (
                                    <div
                                        key={appt.id}
                                        onClick={() => {
                                            onSelectAppointment(appt);
                                            setShowMoreModal(null);
                                        }}
                                        style={{
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '8px',
                                            borderLeft: `3px solid ${statusColor}`,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'all 0.15s ease'
                                        }}
                                        className="hover:bg-slate-700/20"
                                    >
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                                                {appt.business}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                {appt.contactName || 'No contact'} • {appt.time || 'All day'}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            padding: '2px 10px',
                                            borderRadius: '10px',
                                            background: `${statusColor}22`,
                                            color: statusColor
                                        }}>
                                            {appt.status || 'Pending'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;