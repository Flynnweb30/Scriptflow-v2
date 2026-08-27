import React, { useState, useMemo, useCallback } from 'react';
import { Appointment } from '../types';
import { Utils } from '../utils/helpers';
import { WorkspaceService } from '../services/WorkspaceService';
import { FirestoreService } from '../services/FirestoreService';
import { CONFIG } from '../config/constants';

interface CalendarViewProps {
    appointments: Appointment[];
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

    // Filters
    const filteredAppointments = useMemo(() => {
        return appointments.filter(appt => {
            const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
            const matchesAssigned = assignedFilter === 'all' || appt.assigned === assignedFilter || appt.closer === assignedFilter;
            const matchesTag = tagFilter === 'all' || (tagFilter === 'no_show' && Utils.hasTag(appt, 'no_show'));
            const matchesSearch = !searchTerm || 
                (appt.business && appt.business.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (appt.contactName && appt.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (appt.phone && appt.phone.includes(searchTerm)) ||
                (appt.notes && appt.notes.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesStatus && matchesAssigned && matchesTag && matchesSearch;
        });
    }, [appointments, statusFilter, assignedFilter, tagFilter, searchTerm]);

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
        const statusColor = Utils.getStatusColor(appt.status);
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
                    <div style={{ 
                        display: 'flex', 
                        gap: '4px', 
                        background: '#0d1527', 
                        border: '1px solid #1a2744', 
                        borderRadius: '10px', 
                        padding: '3px' 
                    }}>
                        {['kanban', 'month', 'week', 'list'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode as any)}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: viewMode === mode ? '#2563eb' : 'transparent',
                                    color: viewMode === mode ? '#fff' : '#94a3b8',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {mode === 'kanban' ? 'Kanban' : mode === 'month' ? 'Month' : mode === 'week' ? 'Week' : 'List'}
                            </button>
                        ))}
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
                    {CONFIG.DEFAULT_CLOSERS.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
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
                // List View - Responsive appointment table
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
                            Showing <strong style={{ color: '#f8fafc' }}>{filteredAppointments.length}</strong> appointments
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
                    {filteredAppointments.length === 0 ? (
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
                                        {['Date / Time', 'Business', 'Contact', 'Status', 'Tags', 'Closer'].map(label => (
                                            <th key={label} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', borderBottom: '1px solid #1a2744', whiteSpace: 'nowrap' }}>{label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...filteredAppointments]
                                        .sort((a, b) => {
                                            const dateCompare = (Utils.normalizeStoredAppointmentDate(a) || '').localeCompare(Utils.normalizeStoredAppointmentDate(b) || '');
                                            if (dateCompare !== 0) return dateCompare;
                                            return String(a.time || '').localeCompare(String(b.time || ''));
                                        })
                                        .map(appt => {
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
                                                        {isNoShow ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                                                <i className="fas fa-circle-xmark" style={{ fontSize: '9px' }}></i>
                                                                No-Show
                                                            </span>
                                                        ) : <span style={{ fontSize: '10px', color: '#475569' }}>—</span>}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>{appt.closer || appt.assigned || 'Unassigned'}</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
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
                                    const statusColor = Utils.getStatusColor(appt.status);
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
                                const statusColor = Utils.getStatusColor(appt.status);
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