import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
    onOpenBulkActions
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
    const [listCategory, setListCategory] = useState<'all' | 'meetings' | 'callbacks' | 'followups'>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'meeting' | 'callback' | 'followup'>('all');
    const [timezoneFilter, setTimezoneFilter] = useState('all');
    const [includeCompleted, setIncludeCompleted] = useState(false);
    const [subtypeFilter, setSubtypeFilter] = useState('all');
    const [listSort, setListSort] = useState<{ key: 'date' | 'business' | 'contact' | 'status' | 'closer'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });
    const [timelineZoom, setTimelineZoom] = useState(1);

    const dateOnly = (value?: string) => Utils.normalizeDateOnly(value || '') || '';
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
            const matchesAssigned = assignedFilter === 'all' || appt.assigned === assignedFilter || appt.closer === assignedFilter;
            const matchesTag = tagFilter === 'all' || (tagFilter === 'no_show' && Utils.hasTag(appt, 'no_show'));
            const matchesType = activityTypeFilter === 'all' || Utils.getActivityType(appt) === activityTypeFilter;
            const matchesTimezone = timezoneFilter === 'all' || String(appt.timezone || '').toLowerCase() === timezoneFilter.toLowerCase();
            const subtypeValue = Utils.getActivityType(appt) === 'callback' ? (appt.callbackKind || '') : Utils.getActivityType(appt) === 'followup' ? (appt.followUpType || '') : (appt.meetingStatus || appt.status || '');
            const matchesSubtype = subtypeFilter === 'all' || String(subtypeValue).toLowerCase() === subtypeFilter.toLowerCase();
            const query = searchTerm.toLowerCase().trim();
            const matchesSearch = !query || [appt.business, appt.contactName, appt.phone, appt.email, appt.notes, appt.assigned, appt.closer]
                .filter(Boolean).some(value => String(value).toLowerCase().includes(query));
            return matchesStatus && matchesAssigned && matchesTag && matchesType && matchesTimezone && matchesSubtype && matchesSearch;
        });
    }, [appointments, statusFilter, assignedFilter, tagFilter, activityTypeFilter, timezoneFilter, subtypeFilter, searchTerm]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ preset?: 'todo' | 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'custom' }>).detail;
            setViewMode('list');
            if (detail?.preset) setListPreset(detail.preset);
        };
        window.addEventListener('scriptflow:open-activities', handler);
        return () => window.removeEventListener('scriptflow:open-activities', handler);
    }, []);

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
            const completed = Utils.isCompletedActivity(appt);
            if (!includeCompleted && completed) return false;
            if (listPreset === 'todo') return true;
            if (listPreset === 'overdue') return Utils.isOverdueActivity(appt);
            return (!start || apptDate >= start) && (!end || apptDate <= end);
        });
    }, [filteredAppointments, viewMode, listPreset, customStart, customEnd, includeCompleted, todayStr]);

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
        const statusColor = Utils.getActivityStatusColor(appt);
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

    const handleTimelineWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        setTimelineZoom((zoom) => Math.max(0.7, Math.min(1.8, zoom + (e.deltaY < 0 ? 0.1 : -0.1))));
    }, []);

    const dayAppointments = useMemo(() => {
        const date = Utils.normalizeDateOnly(currentDate.toISOString()) || todayStr;
        return filteredAppointments.filter((appt) => Utils.normalizeStoredAppointmentDate(appt) === date);
    }, [currentDate, filteredAppointments, todayStr]);

    const timelineAppointments = useMemo(() => {
        const timed = dayAppointments.filter((appt) => Utils.parseTimeToMinutes(appt.time) !== null);
        const untimed = dayAppointments.filter((appt) => Utils.parseTimeToMinutes(appt.time) === null);
        const groupedStarts = new Set<number>();
        const groups = new Map<number, Appointment[]>();
        timed.forEach((appt) => { const start = Utils.parseTimeToMinutes(appt.time)!; const group = groups.get(start) || []; group.push(appt); groups.set(start, group); });
        groups.forEach((items, start) => { if (items.length >= 5) groupedStarts.add(start); });
        const blocks = timed.filter((appt) => !groupedStarts.has(Utils.parseTimeToMinutes(appt.time)!)).map((appt) => {
            const start = Utils.parseTimeToMinutes(appt.time)!;
            const duration = Math.max(30, Number(appt.durationMinutes || 30) + Number(appt.gracePeriodMinutes || 0));
            return { appt, start, end: Math.min(1440, start + duration), lane: 0, laneCount: 1 };
        }).sort((a, b) => a.start - b.start);
        const lanes: number[] = [];
        blocks.forEach((block) => {
            let lane = lanes.findIndex((end) => end <= block.start);
            if (lane < 0) { lane = lanes.length; lanes.push(block.end); } else lanes[lane] = block.end;
            block.lane = lane;
        });
        blocks.forEach((block) => {
            const done = Utils.isCompletedActivity(block.appt);
            block.laneCount = Math.max(1, blocks.filter(other => Utils.isCompletedActivity(other.appt) === done && other.start < block.end && other.end > block.start).reduce((max, other) => Math.max(max, other.lane + 1), 1));
        });
        const grouped = [...groups.entries()].filter(([start]) => groupedStarts.has(start)).map(([start, items]) => ({ kind: 'group' as const, start, items }));
        return { blocks, grouped, untimed };
    }, [dayAppointments]);

    const actionButtonStyle: React.CSSProperties = { border: '1px solid #24324a', background: '#101a2c', color: '#cbd5e1', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };
    const sortedListAppointments = useMemo(() => {
        const value = (appt: Appointment) => {
            if (listSort.key === 'date') return `${Utils.normalizeStoredAppointmentDate(appt) || ''} ${appt.time || ''}`;
            if (listSort.key === 'business') return appt.business || '';
            if (listSort.key === 'contact') return appt.contactName || '';
            if (listSort.key === 'status') return appt.status || '';
            return appt.closer || appt.assigned || '';
        };
        return [...listFilteredAppointments].sort((a, b) => {
            const result = value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: 'base' });
            return listSort.direction === 'asc' ? result : -result;
        });
    }, [listFilteredAppointments, listSort]);
    const setListSortKey = (key: typeof listSort.key) => setListSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
    const handleInlineReschedule = async (appt: Appointment) => {
        const nextDate = window.prompt('New date (YYYY-MM-DD):', Utils.normalizeStoredAppointmentDate(appt) || Utils.getTodayStr());
        if (!nextDate) return;
        const normalizedDate = Utils.normalizeDateOnly(nextDate);
        if (!normalizedDate) { alert('Please enter a valid date.'); return; }
        const nextTime = window.prompt('New time (e.g. 2:30 PM). Leave blank to keep the current time:', appt.time || '');
        try {
            const reactivate = ['Canceled', 'Cancelled', 'No Show'].includes(appt.status || '');
            await FirestoreService.saveAppointment({ ...appt, date: normalizedDate, ...(nextTime ? { time: nextTime.trim() } : {}), status: reactivate ? 'Rescheduled' : appt.status, primaryStatus: Utils.getPrimaryStatus(reactivate ? 'Rescheduled' : appt.status || 'Pending') });
        } catch (error: any) { alert(error?.message || 'Unable to reschedule this activity.'); }
    };
    const handleInlineReassign = async (appt: Appointment, owner: string) => {
        try { await FirestoreService.saveAppointment({ ...appt, assigned: owner }); }
        catch (error: any) { alert(error?.message || 'Unable to reassign this activity.'); }
    };
    const handleMarkDone = async (appt: Appointment) => {
        try { await FirestoreService.saveAppointment({ ...appt, status: 'Completed', primaryStatus: 'Completed', callbackTriggered: true }); }
        catch (error: any) { alert(error?.message || 'Unable to mark this activity as completed.'); }
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
                    value={activityTypeFilter}
                    onChange={(e) => setActivityTypeFilter(e.target.value as typeof activityTypeFilter)}
                    style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px', outline: 'none' }}
                >
                    <option value="all">All Activities</option>
                    <option value="meeting">Meetings</option>
                    <option value="callback">Callbacks</option>
                    <option value="followup">Follow-ups</option>
                </select>
                <select
                    value={timezoneFilter}
                    onChange={(e) => setTimezoneFilter(e.target.value)}
                    style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '11px', outline: 'none' }}
                >
                    <option value="all">All Timezones</option>
                    {[...new Set(appointments.map(a => a.timezone).filter(Boolean) as string[])].map(tz => <option key={tz} value={tz}>{tz}</option>)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {([['meetings', 'Meetings', '#8b9cff'], ['callbacks', 'Callbacks', '#fbbf24'], ['followups', 'Follow-ups', '#34d399']] as const).map(([value, label, dot]) => (
                        <button key={value} onClick={() => { const next = listCategory === value ? 'all' : value; setListCategory(next); setSubtypeFilter('all'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 11px', borderRadius: '8px', border: `1px solid ${listCategory === value ? dot : '#2a3852'}`, background: listCategory === value ? '#162036' : '#0d1527', color: '#e2e8f0', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot }}></span>{label}<i className="fas fa-chevron-down" style={{ fontSize: '8px', opacity: .7 }}></i></button>
                    ))}
                </div>
                {listCategory !== 'all' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{listCategory === 'callbacks' ? 'Callback kind' : listCategory === 'followups' ? 'Follow-up type' : 'Meeting status'}</span>
                        <select value={subtypeFilter} onChange={(e) => setSubtypeFilter(e.target.value)} style={{ height: '30px', padding: '0 9px', borderRadius: '7px', border: '1px solid #2a3852', background: '#0d1527', color: '#cbd5e1', fontSize: '10px' }}>
                            <option value="all">All</option>
                            {listCategory === 'callbacks' && <><option value="qualified">Qualified</option><option value="unqualified">Unqualified</option><option value="recovery">Recovery</option></>}
                            {listCategory === 'followups' && <><option value="call">Call</option><option value="email">Email</option><option value="task">Task</option></>}
                            {listCategory === 'meetings' && <><option value="meeting booked">Meeting Booked</option><option value="held">Held</option><option value="completed">Completed</option><option value="no show">No Show</option><option value="canceled">Canceled</option></>}
                        </select>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Timezone</div>
                    <span style={{ padding: '7px 10px', border: '1px solid #2a3852', borderRadius: '7px', background: '#0d1527', color: '#cbd5e1', fontSize: '11px', fontWeight: 700 }}>Central (CDT)</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer' }}>
                        <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} /> Include completed
                    </label>
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
                                        {([['date', 'Date / Time'], ['business', 'Business'], ['contact', 'Contact'], ['status', 'Status'], ['type', 'Type'], ['closer', 'Owner / Closer']] as const).map(([key, label]) => (
                                            <th key={key} onClick={() => key !== 'type' && setListSortKey(key as typeof listSort.key)} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', borderBottom: '1px solid #1a2744', whiteSpace: 'nowrap', cursor: key !== 'type' ? 'pointer' : 'default' }}>{label} {listSort.key === key && <span>{listSort.direction === 'asc' ? '↑' : '↓'}</span>}</th>
                                        ))}
                                        <th style={{ padding: '10px 14px', fontSize: '10px', fontWeight: 800, color: '#64748b', borderBottom: '1px solid #1a2744', whiteSpace: 'nowrap' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedListAppointments.map(appt => {
                                            const statusColor = Utils.getStatusColor(appt.status || 'Pending');
                                            const isNoShow = Utils.isNoShow(appt);
                                            return (
                                                <tr key={appt.id} onClick={() => onSelectAppointment(appt)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(26, 39, 68, 0.7)' }} className="hover:bg-slate-800/30">
                                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#f8fafc' }}>{Utils.formatDate(appt.date)}</div>
                                                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.time || 'All day'}{appt.timezone ? ` • ${appt.timezone}` : ''}</div>
                                                    </td>
                                                    <td style={{ padding: '12px 14px', minWidth: '180px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.business || 'Untitled'}</div>
                                                        {appt.role && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.role}</div>}
                                                    </td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{appt.contactName || 'No contact'}</div>
                                                        {appt.phone && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{appt.phone}</div>}
                                                    </td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 9px', borderRadius: '999px', background: `${statusColor}1c`, color: statusColor, fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}>{appt.status || 'Pending'}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontSize: '10px' }}>{Utils.getActivityType(appt) === 'meeting' ? '📅' : Utils.getActivityType(appt) === 'callback' ? '↻' : '✓'}</span>
                                                            <span style={{ fontSize: '10px', color: isNoShow ? '#f87171' : '#64748b', fontWeight: 800 }}>{isNoShow ? 'No-Show' : Utils.getActivityType(appt)}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 14px' }}>
                                                        <select value={appt.assigned || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => void handleInlineReassign(appt, e.target.value)} style={{ maxWidth: '150px', height: '28px', borderRadius: '6px', border: '1px solid #24324a', background: '#090e1a', color: '#cbd5e1', fontSize: '10px' }}>
                                                            <option value="">Unassigned</option>
                                                            {CONFIG.DEFAULT_TEAM_MEMBERS.filter(m => m.active).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                                        </select>
                                                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '3px' }}>Closer: {appt.closer || 'Unassigned'}</div>
                                                    </td>
                                                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            {appt.phone && <button title="Call" onClick={() => window.open(`tel:${appt.phone}`)} style={actionButtonStyle}>☎</button>}
                                                            <button title="Open contact" onClick={() => onSelectAppointment(appt)} style={actionButtonStyle}>👤</button>
                                                            {Utils.getActivityType(appt) === 'meeting' && <button title="Open meeting" onClick={() => onSelectAppointment(appt)} style={actionButtonStyle}>↗</button>}
                                                            <button title="Reschedule" onClick={() => void handleInlineReschedule(appt)} style={actionButtonStyle}>⟳</button>
                                                            {Utils.getActivityType(appt) === 'callback' && !Utils.isCompletedActivity(appt) && <button title="Mark done" onClick={() => void handleMarkDone(appt)} style={actionButtonStyle}>✓</button>}
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
            ) : viewMode === 'day' ? (
                <div style={{ background: '#0d1527', border: '1px solid #1a2744', borderRadius: '14px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a2744', background: '#090e1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div><div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>{Utils.formatDate(Utils.normalizeDateOnly(currentDate.toISOString()) || todayStr)}</div><div style={{ fontSize: '10px', color: '#64748b' }}>Full day • 00:00–24:00 • {dayAppointments.length} activities</div></div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ fontSize: '10px', color: '#3b82f6' }}>● Upcoming</span><span style={{ fontSize: '10px', color: '#ef4444' }}>● Overdue</span><span style={{ fontSize: '10px', color: '#10b981' }}>● Completed</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Zoom {Math.round(timelineZoom * 100)}% • Ctrl/Cmd + wheel</div>
                    </div>
                    {timelineAppointments.untimed.length > 0 && <div style={{ padding: '8px 16px', borderBottom: '1px solid #1a2744', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {timelineAppointments.untimed.map(appt => <button key={appt.id} onClick={() => onSelectAppointment(appt)} style={{ border: `1px solid ${Utils.getActivityStatusColor(appt)}`, background: `${Utils.getActivityStatusColor(appt)}18`, color: '#e2e8f0', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', cursor: 'pointer' }}>{Utils.getActivityType(appt)} • {appt.business}</button>)}
                    </div>}
                    <div onWheel={handleTimelineWheel} style={{ position: 'relative', height: 'calc(100vh - 260px)', minHeight: '520px', overflowY: 'auto', background: '#0a1120' }}>
                        <div style={{ position: 'relative', height: `${1440 * timelineZoom}px`, minHeight: '1440px', left: '64px' }}>
                            {Array.from({ length: 25 }, (_, hour) => <div key={hour} style={{ position: 'absolute', top: `${hour * 60 * timelineZoom}px`, left: 0, right: 0, borderTop: hour < 24 ? '1px solid rgba(148,163,184,0.08)' : 'none' }}><span style={{ position: 'absolute', left: '-58px', top: '-7px', width: '50px', textAlign: 'right', fontSize: '9px', color: '#64748b' }}>{String(hour).padStart(2, '0')}:00</span></div>)}
                            {timelineAppointments.grouped.map((entry) => {
                                const top = Math.min(1410, entry.start) * timelineZoom;
                                return <button key={`group-${entry.start}`} onClick={() => setShowMoreModal({ date: Utils.normalizeDateOnly(currentDate.toISOString()) || todayStr, appointments: entry.items })} style={{ position: 'absolute', top, left: '8px', right: '8px', height: 38, border: '1px solid #3b82f6', borderRadius: '8px', background: 'rgba(59,130,246,0.14)', color: '#e2e8f0', textAlign: 'left', padding: '7px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>{entry.items.length} activities at {entry.items[0].time || 'scheduled time'} — Open group</button>;
                            })}
                            {timelineAppointments.blocks.map((block) => {
                                const appt = block.appt;
                                const color = Utils.getActivityStatusColor(appt);
                                const gap = 6;
                                const done = Utils.isCompletedActivity(appt);
                                const sideWidth = 50;
                                const width = `calc(${sideWidth / block.laneCount}% - ${gap}px)`;
                                const left = `calc(${(done ? sideWidth : 0) + (sideWidth / block.laneCount) * block.lane}% + 4px)`;
                                return <button key={appt.id} onClick={() => onSelectAppointment(appt)} style={{ position: 'absolute', top: block.start * timelineZoom, left, width, height: Math.max(30, (block.end - block.start) * timelineZoom), border: `1px solid ${color}`, borderLeft: `4px solid ${color}`, borderRadius: '8px', background: `${color}18`, color: '#f8fafc', textAlign: 'left', padding: '7px 10px', cursor: 'pointer', overflow: 'hidden' }}>
                                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{appt.time} • {Utils.getActivityType(appt)}</div><div style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.business}</div><div style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.contactName || 'No contact'}{appt.closer ? ` • Closer: ${appt.closer}` : ''}</div>
                                </button>;
                            })}
                        </div>
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
                                    const statusColor = Utils.getActivityStatusColor(appt);
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
                                const statusColor = Utils.getActivityStatusColor(appt);
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