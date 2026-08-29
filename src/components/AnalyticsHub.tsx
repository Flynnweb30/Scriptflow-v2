import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Closer, Task } from '../types';
import { Utils } from '../utils/helpers';
import { CONFIG } from '../config/constants';
import DiscordService from '../services/DiscordService';

interface AnalyticsHubProps {
    appointments: Appointment[];
    tasks?: Task[];
    closers?: Closer[];
}

export const AnalyticsHub: React.FC<AnalyticsHubProps> = ({ appointments, tasks = [], closers = CONFIG.DEFAULT_CLOSERS as Closer[] }) => {
    const [preset, setPreset] = useState<'today' | 'week' | 'month' | 'all'>('month');
    const [selectedAgent, setSelectedAgent] = useState<string>('all');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    // Analytics periods are based on when appointments were made (createdAt), not
    // the scheduled date shown by the Calendar. The Calendar itself remains schedule-date based.
    // The parent workspace is already scoped to the signed-in Firebase user; this component never
    // pulls or aggregates data outside the appointments supplied by that workspace subscription.
    const filteredAppointments = useMemo(() => {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = Utils.formatDateForCompare(today);
        const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);

        return appointments.filter(a => {
            if (selectedAgent !== 'all' && a.assigned !== selectedAgent && a.closer !== selectedAgent) {
                return false;
            }

            const madeDate = Utils.getAppointmentMadeDateKey(a);
            if (!madeDate) return preset === 'all';

            if (preset === 'today') return madeDate === todayStr;
            if (preset === 'week') return Utils.isAppointmentMadeInDateRange(a, weekStart, weekEnd);
            if (preset === 'month') {
                const [year, month] = madeDate.split('-').map(Number);
                return year === today.getFullYear() && month - 1 === today.getMonth();
            }
            return true;
        });
    }, [appointments, preset, selectedAgent, now]);

    // Reference-aligned KPI definitions. Outcome rates use the meeting lifecycle denominator:
    // all scheduled meeting records with an outcome or active booking state. Warm callbacks are
    // follow-ups and are intentionally excluded from show/no-show/reschedule rates.
    const metrics = useMemo(() => {
        const meetingAppointments = filteredAppointments.filter(a => !Utils.isCallbackAppointment(a));
        const total = filteredAppointments.length;

        const hotTransfers = meetingAppointments.filter(a => Utils.getStatus(a) === 'Hot Transfer' || a.primaryStatus === 'Hot Transfer').length;
        const warmCallbacks = filteredAppointments.filter(a => Utils.isCallbackAppointment(a)).length;
        const completed = meetingAppointments.filter(a => ['Completed', 'Held'].includes(Utils.getStatus(a))).length;
        const noShows = meetingAppointments.filter(a => Utils.isNoShow(a)).length;
        const rescheduled = meetingAppointments.filter(a => ['Rescheduled', 'Overdue'].includes(Utils.getStatus(a))).length;
        const canceled = meetingAppointments.filter(a => Utils.getStatus(a) === 'Canceled').length;
        const pending = filteredAppointments.filter(a => ['Pending', 'New Lead', 'Attempted'].includes(Utils.getStatus(a))).length;

        // A booking remains a booking for analytics even after it becomes held/no-show/rescheduled.
        // A No-Show tag is also treated as a resolved booking even if an older record still
        // carries a generic status such as New Lead or Pending. Hot transfers are tracked separately.
        const bookedStatuses = new Set(['Meeting Booked', 'Completed', 'Held', 'No Show', 'Rescheduled', 'Overdue']);
        const booked = meetingAppointments.filter(a => bookedStatuses.has(Utils.getStatus(a)) || Utils.isNoShow(a)).length;
        const resolved = booked + hotTransfers;

        const showRate = resolved > 0 ? Math.round((completed / resolved) * 100) : 0;
        const noShowRate = resolved > 0 ? Number(((noShows / resolved) * 100).toFixed(1)) : 0;
        const rescheduleRate = resolved > 0 ? Math.round((rescheduled / resolved) * 100) : 0;

        // This app does not store raw dial/call volume. Do not fabricate it from appointment rows.
        // Keep the reference metric visible and report a value only when a real call count exists.
        const explicitCallCount = meetingAppointments.reduce((sum, a) => {
            const value = Number((a as Appointment & { callCount?: number }).callCount);
            return Number.isFinite(value) && value >= 0 ? sum + value : sum;
        }, 0);
        const per100Calls = explicitCallCount > 0 ? Number(((booked / explicitCallCount) * 100).toFixed(1)) : 0;

        const scores = meetingAppointments.map(a => Utils.calculateLeadScore(a));
        const avgQuality = scores.length > 0
            ? Number((scores.reduce((acc, v) => acc + v, 0) / scores.length / 10).toFixed(1))
            : 0;

        return {
            total,
            hotTransfers,
            warmCallbacks,
            meetingsBooked: booked,
            booked,
            completed,
            noShows,
            rescheduled,
            pending,
            canceled,
            resolved,
            showRate,
            noShowRate,
            rescheduleRate,
            conversionRate: resolved > 0 ? Math.round((booked / resolved) * 100) : 0,
            per100Calls,
            avgQuality,
            totalBookings: booked,
            totalCalls: explicitCallCount
        };
    }, [filteredAppointments]);

    // Status breakdown for chart
    const statusBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        CONFIG.STATUS_OPTIONS.forEach(s => { counts[s] = 0; });
        filteredAppointments.forEach(a => {
            const st = a.status || 'Pending';
            counts[st] = (counts[st] || 0) + 1;
        });
        return counts;
    }, [filteredAppointments]);

    // Sync all appointments to Discord
    const syncAllToDiscord = async () => {
        if (filteredAppointments.length === 0) {
            setSyncError('❌ No appointments to sync');
            setTimeout(() => setSyncError(null), 3000);
            return;
        }

        setIsSyncingAll(true);
        setSyncMessage(null);
        setSyncError(null);
        setPreviewContent(null);
        setShowPreview(false);

        try {
            const result = await DiscordService.syncAllAppointmentsToDiscord(filteredAppointments);
            
            if (result.success) {
                setSyncMessage(result.message);
                if (result.preview) {
                    setPreviewContent(result.preview);
                    setShowPreview(true);
                }
            } else {
                setSyncError(result.message);
            }
        } catch (error: any) {
            setSyncError(`❌ ${error.message || 'Failed to sync'}`);
        } finally {
            setIsSyncingAll(false);
            setTimeout(() => {
                setSyncMessage(null);
                setSyncError(null);
            }, 8000);
        }
    };

    // Sync a single appointment to Discord
    const syncSingleAppointment = async (appointment: Appointment) => {
        setIsSyncing(true);
        setSyncMessage(null);
        setSyncError(null);
        setPreviewContent(null);
        setShowPreview(false);
        setSelectedAppointment(appointment);

        try {
            const result = await DiscordService.syncAppointmentToDiscord(appointment);
            
            if (result.success) {
                setSyncMessage(result.message);
                if (result.preview) {
                    setPreviewContent(result.preview);
                    setShowPreview(true);
                }
            } else {
                setSyncError(result.message);
            }
        } catch (error: any) {
            setSyncError(`❌ ${error.message || 'Failed to sync'}`);
        } finally {
            setIsSyncing(false);
            setTimeout(() => {
                setSyncMessage(null);
                setSyncError(null);
                setSelectedAppointment(null);
            }, 8000);
        }
    };

    // Copy report to clipboard
    const copyReportToClipboard = () => {
        const report = `
📊 SCRIPTFLOW PRO ANALYTICS REPORT
====================================
📈 Overview
- Total Appointments: ${metrics.total}
- Booked: ${metrics.booked}
- Completed: ${metrics.completed}
- Resolved: ${metrics.resolved}

📊 Performance
- Show Rate: ${metrics.showRate}%
- No-Show Rate: ${metrics.noShowRate}%
- Reschedule Rate: ${metrics.rescheduleRate}%
- Conversion Rate: ${metrics.conversionRate}%

📋 Status Breakdown
- Hot Transfers: ${metrics.hotTransfers}
- Warm Callbacks: ${metrics.warmCallbacks}
- Pending: ${metrics.pending}
- Canceled: ${metrics.canceled}

⭐ Quality Metrics
- Avg Quality Score: ${metrics.avgQuality}/10
- Per 100 Calls: ${metrics.per100Calls}

📅 Appointments made: ${preset}
👤 Filter: ${selectedAgent === 'all' ? 'All Agents' : selectedAgent}
        `.trim();

        navigator.clipboard.writeText(report).then(() => {
            setSyncMessage('✅ Report copied to clipboard!');
            setTimeout(() => setSyncMessage(null), 3000);
        }).catch(() => {
            setSyncError('❌ Failed to copy report');
            setTimeout(() => setSyncError(null), 3000);
        });
    };

    // Check if Discord is configured
    const isDiscordConfigured = DiscordService.isWebhookConfigured();
    const activityWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const activityWeekEnd = new Date(activityWeekStart.getFullYear(), activityWeekStart.getMonth(), activityWeekStart.getDate() + 6);
    const activityAppointments = selectedAgent === 'all'
        ? appointments
        : appointments.filter(a => a.assigned === selectedAgent || a.closer === selectedAgent);
    const activityTodayCount = Utils.getTodayAppointments(activityAppointments).length;
    const activityWeekCount = activityAppointments.filter(a => Utils.isAppointmentMadeInDateRange(a, activityWeekStart, activityWeekEnd)).length;
    const activityMonthCount = activityAppointments.filter(a => {
        const key = Utils.getAppointmentMadeDateKey(a);
        if (!key) return false;
        const [year, month] = key.split('-').map(Number);
        return year === now.getFullYear() && month - 1 === now.getMonth();
    }).length;
    const activityAvgScore = Math.round(activityAppointments.length
        ? activityAppointments.reduce((sum, a) => sum + Utils.calculateLeadScore(a), 0) / activityAppointments.length
        : 0);
    const activityOpenTasks = tasks.filter(t => !t.completed).length;

    return (
        <div className="analytics-container" style={{ padding: '0 0 24px 0' }}>
            {/* Header */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '14px', 
                marginBottom: '20px' 
            }}>
                <div>
                    <h2 style={{ 
                        margin: 0, 
                        fontSize: '22px', 
                        fontWeight: 800, 
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <i className="fas fa-chart-line" style={{ color: 'var(--primary)' }}></i>
                        Performance Analytics Hub
                    </h2>
                    <p style={{ 
                        margin: '4px 0 0', 
                        fontSize: '13px', 
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>Real-time lead scoring, conversion metrics, and appointment creation velocity</span>
                        <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 10px', 
                            borderRadius: '12px', 
                            background: isDiscordConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(88, 101, 242, 0.15)',
                            color: isDiscordConfigured ? '#10b981' : '#5865F2',
                            fontWeight: 600
                        }}>
                            <i className={`fas fa-${isDiscordConfigured ? 'check-circle' : 'eye'}`} style={{ marginRight: '4px' }}></i>
                            {isDiscordConfigured ? 'Discord Connected' : 'Preview Mode'}
                        </span>
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Sync All Appointments Button */}
                    <button
                        onClick={syncAllToDiscord}
                        disabled={isSyncingAll || filteredAppointments.length === 0}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            background: isSyncingAll ? '#2f3136' : '#5865F2',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: isSyncingAll || filteredAppointments.length === 0 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                            opacity: isSyncingAll || filteredAppointments.length === 0 ? 0.7 : 1
                        }}
                    >
                        <i className={`fas fa-${isSyncingAll ? 'spinner fa-spin' : 'sync'}`}></i>
                        <span>{isSyncingAll ? 'Syncing...' : `Sync ${filteredAppointments.length} Appointments`}</span>
                    </button>

                    {/* Copy Report Button */}
                    <button
                        onClick={copyReportToClipboard}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: '1px solid #1e293b',
                            background: '#0d172c',
                            color: '#f1f5f9',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <i className="fas fa-copy"></i>
                        <span>Copy Report</span>
                    </button>
                </div>
            </div>

            {/* Status Messages */}
            {syncMessage && (
                <div style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: syncMessage.includes('Preview') ? 'rgba(88, 101, 242, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    border: syncMessage.includes('Preview') ? '1px solid rgba(88, 101, 242, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                    color: syncMessage.includes('Preview') ? '#5865F2' : '#10b981',
                    fontSize: '13px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <i className={`fas fa-${syncMessage.includes('Preview') ? 'eye' : 'check-circle'}`}></i>
                    <span>{syncMessage}</span>
                </div>
            )}

            {syncError && (
                <div style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: '13px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{syncError}</span>
                </div>
            )}

            {/* Preview Modal */}
            {showPreview && previewContent && (
                <div style={{
                    marginBottom: '16px',
                    background: '#0d172c',
                    border: `2px solid ${isDiscordConfigured ? '#10b981' : '#5865F2'}`,
                    borderRadius: '16px',
                    padding: '20px',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                    }}>
                        <h4 style={{
                            margin: 0,
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <i className={`fab fa-${isDiscordConfigured ? 'discord' : 'eye'}`} style={{ color: isDiscordConfigured ? '#5865F2' : '#f59e0b' }}></i>
                            {isDiscordConfigured ? 'Discord Preview' : 'Preview Mode'}
                        </h4>
                        <button
                            onClick={() => setShowPreview(false)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <pre style={{
                        background: '#090e1a',
                        padding: '16px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        lineHeight: '1.6',
                        color: '#e2e8f0',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '400px',
                        overflow: 'auto',
                        margin: 0
                    }}>
                        {previewContent}
                    </pre>
                    {!isDiscordConfigured && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(88, 101, 242, 0.06)',
                            border: '1px solid rgba(88, 101, 242, 0.2)',
                            fontSize: '12px',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <i className="fas fa-info-circle"></i>
                            <span>Preview mode. To enable Discord auto-sync, add your webhook URL to <code style={{ background: '#1e293b', padding: '2px 8px', borderRadius: '4px' }}>src/config/discord-config.ts</code></span>
                        </div>
                    )}
                    {isDiscordConfigured && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.06)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            fontSize: '12px',
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <i className="fas fa-check-circle"></i>
                            <span>Webhook connected! Data will be sent to Discord automatically.</span>
                        </div>
                    )}
                </div>
            )}

            {/* Filter Controls - Same as before */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '14px', 
                marginBottom: '20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '14px 18px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Appointments made:</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {(['today', 'week', 'month', 'all'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPreset(p)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: preset === p ? 'var(--primary)' : 'transparent',
                                    color: preset === p ? '#fff' : 'var(--text-secondary)',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {p === 'today' ? 'Today' : p === 'week' ? '7 Days' : p === 'month' ? 'This Month' : 'All Time'}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Agent:</label>
                    <select
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        style={{ 
                            height: '36px', 
                            padding: '0 12px', 
                            borderRadius: '10px', 
                            border: '1px solid var(--border-color)', 
                            background: 'var(--bg-primary)', 
                            color: 'var(--text-primary)', 
                            fontSize: '13px', 
                            fontWeight: 600,
                            outline: 'none'
                        }}
                    >
                        <option value="all">All Agents</option>
                        {CONFIG.DEFAULT_TEAM_MEMBERS.map(m => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                        {closers.map(c => (
                            <option key={c.id} value={c.name}>{c.name} (Closer)</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Appointments Made summary — intentionally based on createdAt, not scheduled date. */}
            <div style={{
                background: '#080e1e',
                border: '1px solid #142036',
                borderRadius: '14px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                flexWrap: 'wrap',
                boxShadow: '0 4px 18px rgba(0,0,0,0.18)'
            }}>
                {[
                    { label: 'Today', value: activityTodayCount, target: 3, color: '#38bdf8' },
                    { label: 'Week', value: activityWeekCount, target: 15, color: '#34d399' },
                    { label: 'Month', value: activityMonthCount, target: 60, color: '#a78bfa' },
                    { label: 'Avg Score', value: activityAvgScore, target: null, color: '#f59e0b' },
                    { label: 'Tasks', value: activityOpenTasks, target: null, color: '#10b981' }
                ].map((item, index) => (
                    <React.Fragment key={item.label}>
                        {index > 0 && <span style={{ color: '#1e293b', height: '22px', width: '1px', background: '#1e293b' }} />}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', minWidth: 'max-content' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.label}</span>
                            <strong style={{ fontSize: '14px', fontWeight: 900, color: item.color }}>{item.value}</strong>
                            {item.target !== null && <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>/{item.target}</span>}
                        </div>
                    </React.Fragment>
                ))}
            </div>

            {/* Reference-style Scheduled Bookings KPI strip */}
            <div className="analytics-kpi-strip" style={{
                background: '#0b1120',
                border: '1px solid #1e293b',
                borderRadius: '14px',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
                marginBottom: '20px'
            }}>
                {[
                    { label: 'Booked', value: metrics.booked, sub: 'appointments made', color: '#8fb3ff' },
                    { label: 'Completed', value: metrics.completed, sub: 'meetings held', color: '#8fb3ff' },
                    { label: 'Per 100 calls', value: metrics.per100Calls, sub: metrics.totalCalls > 0 ? `${metrics.totalCalls} calls tracked` : 'call volume not tracked', color: '#f8fafc' },
                    { label: 'Show rate', value: `${metrics.showRate}%`, sub: `${metrics.completed} of ${metrics.resolved} resolved`, color: '#f8fafc' },
                    { label: 'No-show rate', value: `${metrics.noShowRate}%`, sub: `${metrics.noShows} no-show`, color: '#f8fafc' },
                    { label: 'Reschedule rate', value: `${metrics.rescheduleRate}%`, sub: `${metrics.rescheduled} rescheduled`, color: '#f8fafc' },
                    { label: 'Avg quality', value: `${metrics.avgQuality}/10`, sub: `${filteredAppointments.length} records scored`, color: '#f8fafc' },
                ].map((metric, index) => (
                    <div key={metric.label} style={{
                        minWidth: 0,
                        padding: '14px 16px 13px',
                        borderRight: index < 6 ? '1px solid #1e293b' : 'none',
                        background: 'rgba(15, 23, 42, 0.42)'
                    }}>
                        <div style={{
                            fontSize: '11px',
                            color: '#94a3b8',
                            fontWeight: 600,
                            marginBottom: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>{metric.label}</div>
                        <div style={{
                            fontSize: '20px',
                            lineHeight: 1.05,
                            fontWeight: 900,
                            color: metric.color,
                            whiteSpace: 'nowrap'
                        }}>{metric.value}</div>
                        <div style={{
                            marginTop: '2px',
                            fontSize: '10px',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>{metric.sub}</div>
                    </div>
                ))}
            </div>

            {/* Status Breakdown Panel - Same as before */}
            <div style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '16px', 
                padding: '24px',
                marginBottom: '20px'
            }}>
                <h3 style={{ 
                    margin: '0 0 16px', 
                    fontSize: '16px', 
                    fontWeight: 800, 
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <i className="fas fa-chart-pie" style={{ color: 'var(--primary)' }}></i>
                    Status Distribution
                </h3>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '14px' 
                }}>
                    {(Object.entries(statusBreakdown) as [string, number][]).map(([status, count]) => {
                        const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                        const color = Utils.getStatusColor(status);
                        return (
                            <div key={status} style={{ 
                                background: 'var(--bg-primary)', 
                                borderRadius: '12px', 
                                padding: '14px', 
                                borderLeft: `4px solid ${color}` 
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    marginBottom: '6px' 
                                }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{status}</span>
                                    <span style={{ fontSize: '14px', fontWeight: 900, color }}>{count}</span>
                                </div>
                                <div style={{ 
                                    width: '100%', 
                                    height: '6px', 
                                    background: 'var(--border-color)', 
                                    borderRadius: '3px', 
                                    overflow: 'hidden' 
                                }}>
                                    <div style={{ 
                                        width: `${pct}%`, 
                                        height: '100%', 
                                        background: color, 
                                        transition: 'width 0.4s ease' 
                                    }} />
                                </div>
                                <div style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--text-muted)', 
                                    marginTop: '4px', 
                                    textAlign: 'right' 
                                }}>
                                    {pct}% of total
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Appointment List with Sync Buttons */}
            <div style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '16px', 
                padding: '20px',
                marginBottom: '20px'
            }}>
                <h3 style={{ 
                    margin: '0 0 16px', 
                    fontSize: '16px', 
                    fontWeight: 800, 
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                }}>
                    <span>
                        <i className="fas fa-list" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                        Appointments ({filteredAppointments.length})
                    </span>
                    {filteredAppointments.length > 0 && (
                        <button
                            onClick={syncAllToDiscord}
                            disabled={isSyncingAll}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isSyncingAll ? '#2f3136' : '#5865F2',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: isSyncingAll ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <i className={`fas fa-${isSyncingAll ? 'spinner fa-spin' : 'sync'}`}></i>
                            <span>{isSyncingAll ? 'Syncing...' : 'Sync All'}</span>
                        </button>
                    )}
                </h3>

                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}>
                    {filteredAppointments.length === 0 ? (
                        <div style={{ 
                            padding: '40px 20px', 
                            textAlign: 'center', 
                            color: 'var(--text-muted)',
                            border: '2px dashed var(--border-color)',
                            borderRadius: '12px'
                        }}>
                            <i className="fas fa-calendar-plus" style={{ fontSize: '32px', display: 'block', marginBottom: '12px', opacity: 0.5 }}></i>
                            <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>No appointments found</p>
                            <p style={{ fontSize: '12px', marginTop: '4px' }}>Add appointments to see them here</p>
                        </div>
                    ) : (
                        filteredAppointments.map((appt, index) => {
                            const score = Utils.calculateLeadScore(appt);
                            const isSyncingThis = isSyncing && selectedAppointment?.id === appt.id;
                            
                            return (
                                <div 
                                    key={appt.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        gap: '12px',
                                        flexWrap: 'wrap',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px' }}>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            minWidth: '24px'
                                        }}>
                                            #{index + 1}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ 
                                                fontSize: '13px', 
                                                fontWeight: 700, 
                                                color: 'var(--text-primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                flexWrap: 'wrap'
                                            }}>
                                                {appt.business}
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    background: score >= 70 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                                                    color: score >= 70 ? '#dc2626' : '#38bdf8'
                                                }}>
                                                    Score: {score}
                                                </span>
                                            </div>
                                            <div style={{ 
                                                fontSize: '11px', 
                                                color: 'var(--text-muted)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                flexWrap: 'wrap'
                                            }}>
                                                <span>{appt.contactName || 'No contact'}</span>
                                                {appt.phone && <span>• 📞 {appt.phone}</span>}
                                                {appt.date && <span>• 📅 {appt.date}</span>}
                                                {appt.time && <span>• ⏰ {appt.time}</span>}
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    background: Utils.getStatusColor(appt.status) + '22',
                                                    color: Utils.getStatusColor(appt.status),
                                                    fontSize: '10px',
                                                    fontWeight: 700
                                                }}>
                                                    {appt.status || 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            onClick={() => syncSingleAppointment(appt)}
                                            disabled={isSyncingThis}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                border: '1px solid #1e293b',
                                                background: isSyncingThis ? '#2f3136' : 'transparent',
                                                color: isSyncingThis ? '#64748b' : '#94a3b8',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: isSyncingThis ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            className="hover:border-blue-400 hover:text-blue-400"
                                        >
                                            <i className={`fas fa-${isSyncingThis ? 'spinner fa-spin' : 'share'}`}></i>
                                            <span>{isSyncingThis ? '...' : 'Sync'}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Additional Insights - Same as before */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px'
            }}>
                {/* Quick Stats */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px'
                }}>
                    <h4 style={{
                        margin: '0 0 12px',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <i className="fas fa-bolt" style={{ color: '#f59e0b' }}></i>
                        Quick Insights
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Resolved</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{metrics.resolved}</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Pending</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>{metrics.pending}</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Canceled</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{metrics.canceled}</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Rescheduled</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#8b5cf6' }}>{metrics.rescheduled}</span>
                        </div>
                    </div>
                </div>

                {/* Quality Metrics */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px'
                }}>
                    <h4 style={{
                        margin: '0 0 12px',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <i className="fas fa-star" style={{ color: '#f59e0b' }}></i>
                        Quality Metrics
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Average Quality Score</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa' }}>{metrics.avgQuality}/10</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Hot Transfers per 100 Calls</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>{metrics.per100Calls}</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Reschedule Rate</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>{metrics.rescheduleRate}%</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '8px 0'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Booked</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6' }}>{metrics.booked}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)'
            }}>
                <span>
                    <i className="fas fa-sync" style={{ marginRight: '6px' }}></i>
                    Data updated: {new Date().toLocaleString()}
                </span>
                <span>
                    <i className="fab fa-discord" style={{ color: '#5865F2', marginRight: '6px' }}></i>
                    @flynn30 • {isDiscordConfigured ? 'Webhook Connected' : 'Preview Mode'}
                </span>
                <span>
                    {metrics.total} appointments • {metrics.resolved} resolved
                </span>
            </div>
        </div>
    );
};