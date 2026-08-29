import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Appointment, Closer } from '../types';
import { Utils } from '../utils/helpers';
import { WorkspaceService } from '../services/WorkspaceService';
import { FirestoreService } from '../services/FirestoreService';
import { CONFIG } from '../config/constants';

interface CalendarViewProps {
    appointments: Appointment[];
    closers?: Closer[];
    onSelectAppointment: (appt: Appointment) => void;
    onOpenQuickAdd: (defaultDate?: string, defaultStatus?: string) => void;
    onOpenSmartImport: () => void;
    onOpenBulkActions: () => void;
    initialListPreset?: 'todo' | 'overdue' | null;
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
    initialListPreset = null
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'kanban' | 'month' | 'week' | 'day' | 'list'>('month');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [activityFilter, setActivityFilter] = useState<'all' | 'meeting' | 'callback' | 'followup'>('all');
    const [assignedFilter, setAssignedFilter] = useState<string>('all');
    const [timezoneFilter, setTimezoneFilter] = useState<string>('all');
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [draggedApptId, setDraggedApptId] = useState<string | null>(null);
    const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
    const [showMoreModal, setShowMoreModal] = useState<{ date: string; appointments: Appointment[] } | null>(null);
    const [activityPopover, setActivityPopover] = useState<Appointment | null>(null);
    const [listPreset, setListPreset] = useState<'todo' | 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'custom'>(initialListPreset);
    const [includeCompleted, setIncludeCompleted] = useState(false);
    const [listSort, setListSort] = useState<{ key: 'date' | 'business' | 'contact' | 'type' | 'status' | 'closer'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });
    const [callbackKindFilter, setCallbackKindFilter] = useState('all');
    const [followUpTypeFilter, setFollowUpTypeFilter] = useState('all');
    const [timelineZoom, setTimelineZoom] = useState(1);
    const timelineRef = useRef<HTMLDivElement | null>(null);
    const [listCategory, setListCategory] = useState<'all' | 'meetings' | 'callbacks' | 'followups'>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        if (initialListPreset) {
            setListPreset(initialListPreset);
            setViewMode('list');
        }
    }, [initialListPreset]);

    const dateOnly = (value?: string) => Utils.normalizeDateOnly(value || '') || '';

    const activityType = useCallback((appt: Appointment): 'meeting' | 'callback' | 'followup' => {
        const explicit = String(appt.activityType || appt.appointmentType || appt.eventType || '').toLowerCase();
        if (explicit.includes('callback')) return 'callback';
        if (explicit.includes('follow')) return 'followup';
        if (Utils.isCallbackAppointment(appt) || Boolean(appt.callbackTime) || Boolean(appt.callbackSetting && appt.callbackSetting !== 'none')) return 'callback';
        if (['attempted', 'rescheduled', 'overdue'].includes(String(appt.status || '').toLowerCase()) || Boolean(appt.followUpType)) return 'followup';
        return 'meeting';
    }, []);

    const isCompletedStatus = (status?: string) => ['Completed', 'Held', 'Canceled', 'Cancelled', 'No Show', 'No-show'].includes(status || '');
    const isOverdue = useCallback((appt: Appointment) => {
        const d = dateOnly(appt.date);
        return Boolean(d && d < todayStr && !isCompletedStatus(appt.status));
    }, [todayStr]);

    const getActivityStatusColor = useCallback((appt: Appointment) => {
        if (isOverdue(appt)) return '#ef4444';
        const status = String(appt.status || '').toLowerCase();
        if (status.includes('completed') || status === 'held') return '#22c55e';
        if (status.includes('no show') || status.includes('no-show')) return '#f59e0b';
        if (status.includes('cancel')) return '#64748b';
        return '#3b82f6';
    }, [isOverdue]);

    const parseMinutes = useCallback((time?: string) => {
        if (!time) return null;
        const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
        if (!match) return null;
        let hour = Number(match[1]);
        const minute = Number(match[2] || 0);
        const period = match[3]?.toUpperCase();
        if (period === 'PM' && hour < 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return Math.max(0, Math.min(1439, hour * 60 + minute));
    }, []);

    const getDuration = useCallback((appt: Appointment) => Math.max(15, Number(appt.durationMinutes || 30) + Number(appt.gracePeriodMinutes ?? 15)), []);
    const todayStr = Utils.getTodayStr();
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

    // Shared appointment filter used by every calendar mode.
    const filteredAppointments = useMemo(() => {
        return appointments.filter(appt => {
            const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
            const explicitActivity = String(appt.activityType || appt.appointmentType || appt.eventType || '').toLowerCase();
            const matchesActivity = activityFilter === 'all' || (activityFilter === 'callback' && (explicitActivity.includes('callback') || Utils.isCallbackAppointment(appt) || Boolean(appt.callbackTime) || Boolean(appt.callbackSetting && appt.callbackSetting !== 'none'))) || (activityFilter === 'followup' && (explicitActivity.includes('follow') || Boolean(appt.followUpType) || ['attempted','rescheduled','overdue'].includes(String(appt.status || '').toLowerCase()))) || (activityFilter === 'meeting' && !explicitActivity.includes('callback') && !explicitActivity.includes('follow') && !Utils.isCallbackAppointment(appt) && !appt.callbackTime && !(appt.callbackSetting && appt.callbackSetting !== 'none') && !appt.followUpType && !['attempted','rescheduled','overdue'].includes(String(appt.status || '').toLowerCase()));
            const matchesAssigned = assignedFilter === 'all' || appt.assigned === assignedFilter || appt.closer === assignedFilter;
            const matchesTag = tagFilter === 'all' || (tagFilter === 'no_show' && Utils.hasTag(appt, 'no_show'));
            const matchesTimezone = timezoneFilter === 'all' || (appt.timezone || 'Central (CDT)') === timezoneFilter;
            const matchesSearch = !searchTerm || 
                (appt.business && appt.business.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (appt.contactName && appt.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (appt.phone && appt.phone.includes(searchTerm)) ||
                (appt.notes && appt.notes.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesStatus && matchesActivity && matchesAssigned && matchesTimezone && matchesTag && matchesSearch;
        });

    }, [appointments, statusFilter, activityFilter, assignedFilter, timezoneFilter, tagFilter, searchTerm]);

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
            const completed = isCompletedStatus(appt.status);
            const overdue = isOverdue(appt);
            if (!includeCompleted && completed) return false;
            const matchesPreset = listPreset === 'todo' ? !completed : listPreset === 'overdue' ? overdue : (!start || apptDate >= start) && (!end || apptDate <= end);
            if (!matchesPreset) return false;

            const type = activityType(appt);
            if (listCategory !== 'all' && type !== listCategory.slice(0, -1)) return false;
            if (type === 'callback' && callbackKindFilter !== 'all') {
                const kind = String(appt.callbackKind || appt.callbackSetting || 'scheduled').toLowerCase();
                if (kind !== callbackKindFilter) return false;
            }
            if (type === 'followup' && followUpTypeFilter !== 'all' && String(appt.followUpType || '').toLowerCase() !== followUpTypeFilter) return false;
            return true;
        });
    }, [filteredAppointments, viewMode, listPreset, listCategory, customStart, customEnd, todayStr, includeCompleted, callbackKindFilter, followUpTypeFilter, activityType, isOverdue]);

    const sortedListAppointments = useMemo(() => {
        const direction = listSort.direction === 'asc' ? 1 : -1;
        return [...listFilteredAppointments].sort((a, b) => {
            const typeA = activityType(a); const typeB = activityType(b);
            let av = ''; let bv = '';
            switch (listSort.key) {
                case 'business': av = a.business || ''; bv = b.business || ''; break;
                case 'contact': av = a.contactName || ''; bv = b.contactName || ''; break;
                case 'type': av = typeA; bv = typeB; break;
                case 'status': av = a.status || ''; bv = b.status || ''; break;
                case 'closer': av = a.closer || a.assigned || ''; bv = b.closer || b.assigned || ''; break;
                default: av = `${Utils.normalizeStoredAppointmentDate(a) || ''} ${a.time || ''}`; bv = `${Utils.normalizeStoredAppointmentDate(b) || ''} ${b.time || ''}`;
            }
            return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * direction;
        });
    }, [listFilteredAppointments, listSort, activityType]);

    const toggleListSort = (key: typeof listSort.key) => {
        setListSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
    };

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
        const diff = d.getDate() - (day === 0 ? 6 : day - 1);
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

    // Title Text
    const titleText = useMemo(() => {
        if (viewMode === 'kanban') {
            return 'Lead Pipeline Board';
        } else if (viewMode === 'month') {
            return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        } else if (viewMode === 'week') {
            return `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else if (viewMode === 'list') {
            return 'Activities';
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
        const statusColor = getActivityStatusColor(appt);
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
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '12px', 
                marginBottom: '16px' 
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
                                    {mode === 'kanban' ? 'Kanban' : mode[0].toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}

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
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value as typeof activityFilter)}
                    aria-label="Activity type filter"
                    style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px', outline: 'none' }}
                >
                    <option value="all">All Activities</option>
                    <option value="meeting">Meetings</option>
                    <option value="callback">Callbacks</option>
                    <option value="followup">Follow-ups</option>
                </select>

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

                <select
                    value={timezoneFilter}
                    onChange={(e) => setTimezoneFilter(e.target.value)}
                    style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px', outline: 'none' }}
                    aria-label="Timezone filter"
                >
                    <option value="all">All Timezones</option>
                    {[...new Set(appointments.map(a => a.timezone || 'Central (CDT)'))].sort().map(zone => <option key={zone} value={zone}>{zone}</option>)}
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
                    {filteredAppointments.length} activities
                </span>
            </div>

            {/* Main Calendar Views */}
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
                // List View - responsive task/appointment workspace aligned with the reference layout.
                <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {([['todo', 'To-do'], ['overdue', 'Overdue'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['this_week', 'This week'], ['next_week', 'Next week'], ['custom', 'Custom']] as const).map(([value, label]) => (
                        <button key={value} onClick={() => setListPreset(value)} style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid #2a3852', background: listPreset === value ? '#18243b' : '#0d1527', color: listPreset === value ? '#f8fafc' : '#94a3b8', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{label}</button>
                    ))}
                </div>
                {listPreset === 'custom' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Custom start date" style={{ height: '32px', padding: '0 9px', borderRadius: '7px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px' }} />
                        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="Custom end date" style={{ height: '32px', padding: '0 9px', borderRadius: '7px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px' }} />
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <select value={listCategory} onChange={(e) => setListCategory(e.target.value as typeof listCategory)} aria-label="Activity type" style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #2a3852', background: '#0d1527', color: '#e2e8f0', fontSize: '11px', fontWeight: 800 }}>
                        <option value="all">All activities</option>
                        <option value="meetings">Meetings</option>
                        <option value="callbacks">Callbacks</option>
                        <option value="followups">Follow-ups</option>
                    </select>
                    {listCategory === 'callbacks' && (
                        <select value={callbackKindFilter} onChange={(e) => setCallbackKindFilter(e.target.value)} aria-label="Callback kind" style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #2a3852', background: '#0d1527', color: '#e2e8f0', fontSize: '11px' }}>
                            <option value="all">All callback kinds</option>
                            <option value="24h">24-hour</option><option value="4h">4-hour</option><option value="1h">1-hour</option><option value="custom">Custom</option><option value="scheduled">Scheduled</option>
                        </select>
                    )}
                    {listCategory === 'followups' && (
                        <select value={followUpTypeFilter} onChange={(e) => setFollowUpTypeFilter(e.target.value)} aria-label="Follow-up type" style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #2a3852', background: '#0d1527', color: '#e2e8f0', fontSize: '11px' }}>
                            <option value="all">All follow-up types</option><option value="call">Call</option><option value="email">Email</option><option value="task">Task</option>
                        </select>
                    )}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 10px', border: '1px solid #2a3852', borderRadius: '8px', background: '#0d1527', color: '#cbd5e1', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} /> Include completed
                    </label>
                    <span style={{ marginLeft: 'auto', padding: '7px 10px', border: '1px solid #2a3852', borderRadius: '7px', background: '#0d1527', color: '#cbd5e1', fontSize: '11px', fontWeight: 700 }}>Central (CDT)</span>
                </div>
                <div style={{
                    background: '#0d1527',
                    border: '1px solid #1a2744',
                    borderRadius: '14px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '14px 16px',
                        borderBottom: '1px solid #1a2744',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            Showing <strong style={{ color: '#f8fafc' }}>{listFilteredAppointments.length}</strong> appointments
                        </div>
                        <button
                            onClick={() => onOpenQuickAdd()}
                            style={{
                                padding: '7px 12px',
                                borderRadius: '8px',
                                border: '1px solid #2563eb',
                                background: 'rgba(37, 99, 235, 0.12)',
                                color: '#60a5fa',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>
                            Quick Add Appointment
                        </button>
                    </div>
                    {listFilteredAppointments.length === 0 ? (
                        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                            <i className="fas fa-calendar-xmark" style={{ fontSize: '26px', marginBottom: '10px' }}></i>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>No appointments found</div>
                            <div style={{ fontSize: '11px', marginTop: '4px' }}>Adjust the filters or add a new appointment.</div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                                <thead>
                                    <tr style={{ background: '#090e1a' }}>
                                        {([['date','Date / Time'],['business','Business'],['contact','Contact'],['type','Type'],['status','Status'],['closer','Owner / Closer']] as const).map(([key,label]) => (
                                            <th key={key} onClick={() => toggleListSort(key)} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', borderBottom: '1px solid #1a2744', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                                                {label} <i className={`fas fa-sort${listSort.key === key ? (listSort.direction === 'asc' ? '-up' : '-down') : ''}`} style={{ marginLeft: '4px', opacity: listSort.key === key ? 1 : .35 }}></i>
                                            </th>
                                        ))}
                                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '10px', fontWeight: 800, color: '#64748b', borderBottom: '1px solid #1a2744', whiteSpace: 'nowrap' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedListAppointments.map(appt => {
                                        const color = getActivityStatusColor(appt);
                                        const type = activityType(appt);
                                        const typeLabel = type === 'meeting' ? 'Meeting' : type === 'callback' ? 'Callback' : 'Follow-up';
                                        const icon = type === 'meeting' ? 'fa-calendar-check' : type === 'callback' ? 'fa-phone' : (String(appt.followUpType || '').toLowerCase() === 'email' ? 'fa-envelope' : String(appt.followUpType || '').toLowerCase() === 'task' ? 'fa-list-check' : 'fa-phone-volume');
                                        return (
                                            <tr key={appt.id} style={{ borderBottom: '1px solid rgba(26, 39, 68, 0.7)' }}>
                                                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => onSelectAppointment(appt)}>
                                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#f8fafc' }}>{Utils.formatDate(appt.date)}</div>
                                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.time || 'All day'}{appt.timezone ? ` • ${appt.timezone}` : ''}</div>
                                                </td>
                                                <td style={{ padding: '12px 14px', minWidth: '160px', cursor: 'pointer' }} onClick={() => onSelectAppointment(appt)}><div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.business || 'Untitled'}</div>{appt.role && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.role}</div>}</td>
                                                <td style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => onSelectAppointment(appt)}><div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{appt.contactName || 'No contact'}</div>{appt.phone && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.phone}</div>}</td>
                                                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 800, color: '#cbd5e1' }}><i className={`fas ${icon}`} style={{ color }}></i>{typeLabel}{type === 'followup' && appt.followUpType ? ` • ${appt.followUpType}` : ''}</span></td>
                                                <td style={{ padding: '12px 14px' }}><span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 9px', borderRadius: '999px', background: `${color}1c`, color, fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}>{isOverdue(appt) ? 'Overdue' : (appt.status || 'Pending')}</span></td>
                                                <td style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>{appt.closer || appt.assigned || 'Unassigned'}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        {appt.phone && <a href={`tel:${appt.phone}`} onClick={(e) => e.stopPropagation()} title="Call" aria-label={`Call ${appt.contactName || appt.business}`} style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '7px', border: '1px solid #24324b', background: '#101a2e', color: '#38bdf8', textDecoration: 'none' }}><i className="fas fa-phone"></i></a>}
                                                        <button onClick={() => onSelectAppointment(appt)} title={type === 'meeting' ? 'Open meeting' : 'Open contact'} aria-label={type === 'meeting' ? 'Open meeting' : 'Open contact'} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #24324b', background: '#101a2e', color: '#cbd5e1', cursor: 'pointer' }}><i className={`fas ${type === 'meeting' ? 'fa-calendar' : 'fa-user'}`}></i></button>
                                                        <button onClick={() => onSelectAppointment(appt)} title={type === 'callback' ? 'Reschedule / reassign callback' : 'Open record'} aria-label={type === 'callback' ? 'Reschedule or reassign callback' : 'Open record'} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #24324b', background: '#101a2e', color: '#a78bfa', cursor: 'pointer' }}><i className={`fas ${type === 'callback' ? 'fa-clock-rotate-left' : 'fa-arrow-up-right-from-square'}`}></i></button>
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
            ) : viewMode === 'day' ? (
                <>
                <div
                    ref={timelineRef}
                    onWheel={(e) => {
                        if (!(e.ctrlKey || e.metaKey)) return;
                        e.preventDefault();
                        setTimelineZoom(z => Math.max(0.7, Math.min(2, z + (e.deltaY < 0 ? 0.1 : -0.1))));
                    }}
                    style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '14px', overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}
                >
                    <div style={{ minWidth: '760px', minHeight: `${Math.round(1440 * timelineZoom)}px`, position: 'relative', paddingLeft: '64px' }}>
                        {Array.from({ length: 25 }, (_, hour) => (
                            <div key={hour} style={{ position: 'absolute', left: 0, right: 0, top: `${hour * 60 * timelineZoom}px`, borderTop: hour === 24 ? '1px solid #2a3852' : '1px solid rgba(42,56,82,.55)', height: 0 }}>
                                <span style={{ position: 'absolute', left: '8px', top: '-8px', fontSize: '10px', color: '#64748b', width: '48px', textAlign: 'right' }}>{String(hour).padStart(2, '0')}:00</span>
                            </div>
                        ))}
                        {(() => {
                            const day = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                            const items = filteredAppointments.filter(a => Utils.normalizeStoredAppointmentDate(a) === day);
                            const timed = items.filter(a => parseMinutes(a.time) !== null && activityType(a) !== 'followup');
                            const allDay = items.filter(a => parseMinutes(a.time) === null);
                            const lanes: Appointment[][] = [];
                            const positions = new Map<string, { lane: number; lanes: number; start: number; duration: number }>();
                            timed.sort((a,b) => (parseMinutes(a.time) ?? 0) - (parseMinutes(b.time) ?? 0));
                            timed.forEach(appt => {
                                const start = parseMinutes(appt.time) ?? 0;
                                const end = start + getDuration(appt);
                                let lane = 0;
                                while (lanes[lane]?.some(other => { const os = parseMinutes(other.time) ?? 0; return start < os + getDuration(other) && end > os; })) lane++;
                                (lanes[lane] ||= []).push(appt);
                                positions.set(appt.id, { lane, lanes: 1, start, duration: getDuration(appt) });
                            });
                            positions.forEach((pos, id) => {
                                const overlapCount = timed.filter(other => { if (other.id === id) return false; const os = parseMinutes(other.time) ?? 0; return pos.start < os + getDuration(other) && pos.start + pos.duration > os; }).length + 1;
                                pos.lanes = Math.max(1, overlapCount);
                            });
                            return (
                                <>
                                    {allDay.length > 0 && <div style={{ position: 'absolute', top: '8px', left: '74px', right: '14px', padding: '8px', borderRadius: '8px', background: '#101a2e', border: '1px solid #24324b', color: '#cbd5e1', fontSize: '11px' }}>All day: {allDay.map(a => a.business).join(' • ')}</div>}
                                    {items.length >= 5 && (() => {
                                        const byTime = new Map<string, Appointment[]>();
                                        items.forEach(a => { const key = a.time || 'all-day'; byTime.set(key, [...(byTime.get(key) || []), a]); });
                                        return Array.from(byTime.entries()).filter(([, group]) => group.length >= 5).map(([time, group]) => <div key={`group-${time}`} style={{ position: 'absolute', top: `${(parseMinutes(time) ?? 0) * timelineZoom}px`, left: '74px', right: '14px', minHeight: '34px', borderRadius: '8px', background: '#101a2e', border: '1px solid #2a3852', display: 'flex', alignItems: 'center', padding: '0 10px', color: '#cbd5e1', fontSize: '11px', fontWeight: 800 }}>+ {group.length} activities at {time}</div>);
                                    })()}
                                    {timed.map(appt => {
                                        const pos = positions.get(appt.id)!;
                                        const hiddenByGroup = items.filter(a => (a.time || 'all-day') === (appt.time || 'all-day')).length >= 5;
                                        if (hiddenByGroup) return null;
                                        const width = `calc((100% - 88px) / ${pos.lanes})`;
                                        return <div key={appt.id} onClick={(e) => { e.stopPropagation(); setActivityPopover(appt); }} style={{ position: 'absolute', top: `${pos.start * timelineZoom + 2}px`, left: `calc(74px + ${pos.lane} * ((100% - 88px) / ${pos.lanes}))`, width, height: `${Math.max(28, pos.duration * timelineZoom - 4)}px`, minWidth: '150px', overflow: 'hidden', borderRadius: '8px', padding: '7px 9px', boxSizing: 'border-box', background: `${getActivityStatusColor(appt)}20`, borderLeft: `3px solid ${getActivityStatusColor(appt)}`, borderTop: '1px solid rgba(255,255,255,.06)', cursor: 'pointer', zIndex: 2 }}>
                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{appt.time} • {activityType(appt)}</div>
                                            <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.business || 'Untitled'}</div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.contactName || 'No contact'}{activityType(appt) === 'meeting' && appt.closer ? ` • ${appt.closer}` : ''}</div>
                                        </div>;
                                    })}
                                    {items.filter(a => activityType(a) === 'followup').map(appt => { const start = parseMinutes(appt.time) ?? 0; return <div key={`fu-${appt.id}`} onClick={() => onSelectAppointment(appt)} style={{ position: 'absolute', top: `${start * timelineZoom + 2}px`, left: '74px', right: '14px', height: '22px', display: 'flex', alignItems: 'center', padding: '0 8px', borderRadius: '5px', background: '#34d39918', borderLeft: '2px solid #34d399', color: '#a7f3d0', fontSize: '10px', cursor: 'pointer', zIndex: 3 }}>{appt.time ? `${appt.time} • ` : ''}{appt.business} • Follow-up{appt.followUpType ? ` (${appt.followUpType})` : ''}</div>; })}
                                </>
                            );
                        })()}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px', color: '#64748b', fontSize: '10px' }}>Ctrl/Cmd + wheel: zoom <button onClick={() => setTimelineZoom(z => Math.max(.7, z - .1))} style={{ marginLeft: '8px', border: '1px solid #2a3852', background: '#0d1527', color: '#cbd5e1', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer' }}>−</button><button onClick={() => setTimelineZoom(z => Math.min(2, z + .1))} style={{ border: '1px solid #2a3852', background: '#0d1527', color: '#cbd5e1', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer' }}>+</button></div>
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
                // Week View
                <div style={{ 
                    background: '#0d1527', 
                    border: '1px solid #1a2744', 
                    borderRadius: '14px', 
                    overflow: 'hidden' 
                }}>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 1fr)', 
                        borderBottom: '1px solid #1a2744',
                        background: '#090e1a'
                    }}>
                        {weekDays.map((d, i) => (
                            <div key={i} style={{ 
                                padding: '10px', 
                                textAlign: 'center', 
                                borderRight: i < 6 ? '1px solid #1a2744' : 'none'
                            }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{d.dayName}</div>
                                <div style={{ 
                                    fontSize: '14px', 
                                    fontWeight: 900, 
                                    color: d.isToday ? '#38bdf8' : '#f8fafc',
                                    marginTop: '2px'
                                }}>
                                    {d.dayNumber}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        minHeight: '400px',
                        maxHeight: 'calc(100vh - 360px)'
                    }}>
                        {weekDays.map((d, i) => (
                            <div 
                                key={i}
                                onClick={() => onOpenQuickAdd(d.dateStr)}
                                style={{ 
                                    borderRight: i < 6 ? '1px solid #1a2744' : 'none',
                                    padding: '6px',
                                    background: d.isToday ? 'rgba(56,189,248,0.03)' : '#0d1527',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    minHeight: '100px'
                                }}
                                className="hover:bg-slate-800/20"
                            >
                                {d.items.slice(0, 4).map(appt => {
                                    const statusColor = getActivityStatusColor(appt);
                                    return (
                                        <div
                                            key={appt.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectAppointment(appt);
                                            }}
                                            style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '4px',
                                                padding: '3px 6px',
                                                borderLeft: `2px solid ${statusColor}`,
                                                cursor: 'pointer',
                                                fontSize: '10px',
                                                color: '#e2e8f0',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.15s ease'
                                            }}
                                            className="hover:bg-slate-700/30"
                                            title={`${appt.business} - ${appt.contactName || ''}`}
                                        >
                                            {appt.time && (
                                                <span style={{ color: '#94a3b8', marginRight: '4px' }}>
                                                    {appt.time}
                                                </span>
                                            )}
                                            {appt.business}
                                        </div>
                                    );
                                })}
                                {d.items.length > 4 && (
                                    <div style={{ 
                                        fontSize: '9px', 
                                        color: '#38bdf8', 
                                        fontWeight: 600,
                                        padding: '2px 6px'
                                    }}>
                                        +{d.items.length - 4} more
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activityPopover && (
                <div onClick={() => setActivityPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.25)' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)', width: 'min(420px, calc(100vw - 32px))', background: '#0d1527', border: '1px solid #2a3852', borderRadius: '14px', padding: '16px', boxShadow: '0 20px 50px rgba(0,0,0,.45)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                            <div><div style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc' }}>{activityPopover.business || 'Untitled'}</div><div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>{activityPopover.contactName || 'No contact'} • {activityPopover.date} {activityPopover.time || 'All day'}</div></div>
                            <button onClick={() => setActivityPopover(null)} aria-label="Close activity details" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}><i className="fas fa-times"></i></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px', marginTop: '14px' }}>
                            <div style={{ padding: '9px', borderRadius: '8px', background: '#091020' }}><div style={{ fontSize: '9px', color: '#64748b' }}>TYPE</div><div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 800 }}>{activityType(activityPopover)}</div></div>
                            <div style={{ padding: '9px', borderRadius: '8px', background: '#091020' }}><div style={{ fontSize: '9px', color: '#64748b' }}>STATUS</div><div style={{ fontSize: '11px', color: getActivityStatusColor(activityPopover), fontWeight: 800 }}>{isOverdue(activityPopover) ? 'Overdue' : activityPopover.status}</div></div>
                            {activityType(activityPopover) === 'meeting' && <><div style={{ padding: '9px', borderRadius: '8px', background: '#091020' }}><div style={{ fontSize: '9px', color: '#64748b' }}>CLOSER / BOOKER</div><div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 800 }}>{activityPopover.closer || 'Unassigned'}{activityPopover.booker ? ` / ${activityPopover.booker}` : ''}</div></div><div style={{ padding: '9px', borderRadius: '8px', background: '#091020' }}><div style={{ fontSize: '9px', color: '#64748b' }}>QUALITY / CONFIRMATION</div><div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 800 }}>{activityPopover.qualityScore ?? '—'}{activityPopover.confirmationStatus ? ` • ${activityPopover.confirmationStatus}` : ''}</div></div></>}
                        </div>
                        {activityPopover.websiteStatus && <div style={{ marginTop: '8px', fontSize: '10px', color: '#94a3b8' }}>Website status: <strong style={{ color: '#cbd5e1' }}>{activityPopover.websiteStatus}</strong></div>}
                        <button onClick={() => { const appt = activityPopover; setActivityPopover(null); onSelectAppointment(appt); }} style={{ width: '100%', marginTop: '14px', height: '36px', borderRadius: '8px', border: '1px solid #2563eb', background: 'rgba(37,99,235,.14)', color: '#60a5fa', fontWeight: 800, cursor: 'pointer' }}>{activityType(activityPopover) === 'meeting' ? 'Open meeting' : 'Open contact'}</button>
                    </div>
                </div>
            )}

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
                                const statusColor = getActivityStatusColor(appt);
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