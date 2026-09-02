import React, { useState, useRef, useEffect } from 'react';
import { AppNotification, Appointment, Task } from '../types';
import { NotificationManager } from '../managers/NotificationManager';
import { Utils } from '../utils/helpers';
import { FirestoreService } from '../services/FirestoreService';
import { getWorkspaceTimezone } from '../utils/timezone-utils';

interface TopBarProps {
    appointments: Appointment[];
    tasks: Task[];
    notifications: AppNotification[];
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
    onRefresh: () => void;
    onOpenGlobalSearch: () => void;
    onOpenSmartImport: () => void;
    onOpenBulkActions: () => void;
    onOpenHistory: () => void;
    onDownloadCSV: () => void;
    onOpenNotificationDetail: (notif: AppNotification) => void;
    onNotificationChange: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
    appointments,
    tasks,
    notifications,
    onToggleSidebar,
    sidebarOpen,
    onRefresh,
    onOpenGlobalSearch,
    onOpenSmartImport,
    onOpenBulkActions,
    onOpenHistory,
    onDownloadCSV,
    onOpenNotificationDetail,
    onNotificationChange
}) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [filterTab, setFilterTab] = useState<'all' | 'due' | 'completed'>('all');
    const [isSyncing, setIsSyncing] = useState(false);
    const [csvMenuOpen, setCsvMenuOpen] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const csvDropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
            if (csvDropdownRef.current && !csvDropdownRef.current.contains(e.target as Node)) {
                setCsvMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate dynamic stats
    const todayStr = Utils.formatDateForCompare(now);
    const todayCount = Utils.getTodayAppointments(appointments).length;
    const todayTarget = 3;

    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    const weekCount = appointments.filter(a => Utils.isAppointmentMadeInDateRange(a, weekStart, weekEnd)).length;
    const weekTarget = 15;

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthCount = appointments.filter(a => {
        const key = Utils.getAppointmentMadeDateKey(a);
        if (!key) return false;
        const [year, month] = key.split('-').map(Number);
        return year === currentYear && month - 1 === currentMonth;
    }).length;
    const monthTarget = 60;

    const scoredList = appointments.map(a => Utils.calculateLeadScore(a));
    const avgScore = scoredList.length > 0 ? Math.round(scoredList.reduce((acc, v) => acc + v, 0) / scoredList.length) : 25;

    const pendingTasksCount = tasks.filter(t => !t.completed).length;

    const handleRefresh = () => {
        setIsSyncing(true);
        onRefresh();
        setTimeout(() => setIsSyncing(false), 600);
    };

    const handleMarkAllRead = () => {
        NotificationManager.markAllAsRead();
        onNotificationChange();
    };

    const handleItemClick = (notif: AppNotification) => {
        NotificationManager.markAsRead(notif.id);
        onNotificationChange();
        setDropdownOpen(false);
        onOpenNotificationDetail(notif);
    };

    const handleDismiss = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        NotificationManager.dismissNotification(id);
        onNotificationChange();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                if (!text) return;
                
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length <= 1) {
                    alert('CSV file appears empty or only contains headers.');
                    return;
                }

                const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
                let importedCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const row = lines[i];
                    const values: string[] = [];
                    let inQuotes = false;
                    let currentValue = '';
                    for (let c = 0; c < row.length; c++) {
                        const char = row[c];
                        if (char === '"' || char === "'") {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            values.push(currentValue.trim());
                            currentValue = '';
                        } else {
                            currentValue += char;
                        }
                    }
                    values.push(currentValue.trim());

                    if (values.length >= 2) {
                        const businessName = values[1] || values[0] || 'Imported Lead';
                        const contactName = values[2] || '';
                        const phone = values[4] || '';
                        const email = values[5] || '';
                        const date = values[6] || todayStr;
                        const time = values[7] || '2:00 PM';
                        const timezone = values[8] || getWorkspaceTimezone();
                        const status = (values[9] || 'Set') as any;

                        const newAppt: Partial<Appointment> & { id: string } = {
                            id: Utils.generateId(),
                            business: businessName.replace(/^["']|["']$/g, ''),
                            contactName: contactName.replace(/^["']|["']$/g, ''),
                            phone: phone.replace(/^["']|["']$/g, ''),
                            email: email.replace(/^["']|["']$/g, ''),
                            date,
                            time,
                            timezone,
                            status,
                            createdAt: new Date().toISOString()
                        };

                        await FirestoreService.saveAppointment(newAppt);
                        importedCount++;
                    }
                }

                alert(`Successfully imported ${importedCount} appointments from CSV!`);
                onRefresh();
            } catch (err) {
                console.error('Error importing CSV:', err);
                alert('Error parsing CSV file. Please make sure the format is valid.');
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setCsvMenuOpen(false);
    };

    const filteredNotifications = notifications.filter(n => {
        if (n.dismissed) return false;
        if (filterTab === 'due') return n.type === 'callback_due';
        if (filterTab === 'completed') return n.type === 'callback_completed';
        return true;
    });

    return (
        <div 
            className="top-bar-card"
            style={{
                background: '#080e1e',
                border: '1px solid #142036',
                borderRadius: '16px',
                padding: '12px 18px',
                marginBottom: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}
        >
            {/* Stats Row - Slimmed */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {onToggleSidebar && (
                        <button
                            onClick={onToggleSidebar}
                            style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: '1px solid #1a2744',
                                color: '#94a3b8',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                fontSize: '13px',
                                transition: 'all 0.15s ease'
                            }}
                            className="hover:bg-slate-800"
                        >
                            <i className="fas fa-bars"></i>
                        </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                            <span style={{ color: '#38bdf8' }}>Today</span>
                            <span style={{ fontWeight: 800, color: '#38bdf8' }}>{todayCount}</span>
                            <span style={{ color: '#64748b' }}>/{todayTarget}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                            <span style={{ color: '#34d399' }}>Week</span>
                            <span style={{ fontWeight: 800, color: '#34d399' }}>{weekCount}</span>
                            <span style={{ color: '#64748b' }}>/{weekTarget}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                            <span style={{ color: '#a78bfa' }}>Month</span>
                            <span style={{ fontWeight: 800, color: '#a78bfa' }}>{monthCount}</span>
                            <span style={{ color: '#64748b' }}>/{monthTarget}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                            <span style={{ color: '#f59e0b' }}>Avg Score</span>
                            <span style={{ fontWeight: 800, color: '#f59e0b' }}>{avgScore}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                            <span style={{ color: '#10b981' }}>Tasks</span>
                            <span style={{ fontWeight: 800, color: '#10b981' }}>{pendingTasksCount}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Notification Bell */}
                    <div className="notification-bell-container" style={{ position: 'relative' }} ref={dropdownRef}>
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: 'transparent',
                                border: '1px solid #1a2744',
                                color: unreadCount > 0 ? '#38bdf8' : '#475569',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                                fontSize: '13px',
                                transition: 'all 0.15s ease'
                            }}
                            className="hover:bg-slate-800"
                        >
                            <i className="fas fa-bell"></i>
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: '#ef4444',
                                    color: '#fff',
                                    fontSize: '8px',
                                    fontWeight: 800,
                                    display: 'grid',
                                    placeItems: 'center',
                                    border: '2px solid #080e1e'
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {dropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '36px',
                                right: 0,
                                width: '340px',
                                maxWidth: '90vw',
                                background: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '12px',
                                boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                                zIndex: 60,
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 700, fontSize: '12px', color: '#f8fafc' }}>Notifications</span>
                                    <button onClick={handleMarkAllRead} style={{ border: 'none', background: 'transparent', color: '#38bdf8', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}>
                                        Mark all read
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '4px', padding: '6px 10px', borderBottom: '1px solid #1e293b', background: '#090e1a' }}>
                                    {['all', 'due', 'completed'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setFilterTab(tab as any)}
                                            style={{
                                                border: 'none',
                                                background: filterTab === tab ? '#1e293b' : 'transparent',
                                                color: filterTab === tab ? '#38bdf8' : '#94a3b8',
                                                padding: '2px 10px',
                                                borderRadius: '10px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {tab === 'all' ? 'All' : tab === 'due' ? 'Due' : 'Done'}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                    {filteredNotifications.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                                            No notifications
                                        </div>
                                    ) : (
                                        filteredNotifications.map(notif => (
                                            <div key={notif.id} onClick={() => handleItemClick(notif)} style={{
                                                padding: '8px 14px',
                                                borderBottom: '1px solid #1e293b',
                                                cursor: 'pointer',
                                                background: !notif.read ? 'rgba(56,189,248,0.04)' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '8px'
                                            }}>
                                                <i className={`fas ${notif.type === 'callback_due' ? 'fa-phone-volume' : 'fa-check-circle'}`} style={{ color: notif.type === 'callback_due' ? '#ef4444' : '#10b981', marginTop: '2px', fontSize: '11px' }}></i>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>{notif.business}</div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{notif.message}</div>
                                                </div>
                                                <button onClick={(e) => handleDismiss(e, notif.id)} style={{ border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', padding: '2px' }}>
                                                    <i className="fas fa-times" style={{ fontSize: '9px' }}></i>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={handleRefresh}
                        style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: 'transparent',
                            border: '1px solid #1a2744',
                            color: '#94a3b8',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            fontSize: '12px',
                            transition: 'all 0.2s ease'
                        }}
                        className="hover:bg-slate-800"
                    >
                        <i className={`fas fa-sync-alt ${isSyncing ? 'fa-spin' : ''}`}></i>
                    </button>
                </div>
            </div>

            {/* Actions Row - Slimmed */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '6px',
                flexWrap: 'wrap',
                paddingTop: '8px',
                borderTop: '1px solid #142036'
            }}>
                <button onClick={onOpenSmartImport} style={actionButtonStyle}>
                    <i className="fas fa-file-import" style={{ fontSize: '11px' }}></i>
                    <span>Import</span>
                </button>
                <button onClick={onOpenBulkActions} style={actionButtonStyle}>
                    <i className="fas fa-tasks" style={{ fontSize: '11px' }}></i>
                    <span>Bulk</span>
                </button>
                <button onClick={onOpenHistory} style={actionButtonStyle}>
                    <i className="fas fa-history" style={{ fontSize: '11px' }}></i>
                    <span>History</span>
                </button>
                <button onClick={onOpenGlobalSearch} style={actionButtonStyle}>
                    <i className="fas fa-search" style={{ fontSize: '11px' }}></i>
                    <span>Search</span>
                </button>

                <div style={{ position: 'relative' }} ref={csvDropdownRef}>
                    <button onClick={() => setCsvMenuOpen(!csvMenuOpen)} style={actionButtonStyle}>
                        <i className="fas fa-file-alt" style={{ fontSize: '11px' }}></i>
                        <span>CSV</span>
                        <i className="fas fa-chevron-down" style={{ fontSize: '8px', color: '#64748b' }}></i>
                    </button>
                    <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                    {csvMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '32px',
                            left: 0,
                            width: '160px',
                            background: '#0f172a',
                            border: '1px solid #1e293b',
                            borderRadius: '10px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                            zIndex: 60,
                            overflow: 'hidden',
                            padding: '4px 0'
                        }}>
                            <button onClick={() => { onDownloadCSV(); setCsvMenuOpen(false); }} style={{
                                width: '100%',
                                padding: '6px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: '#f8fafc',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }} className="hover:bg-slate-800">
                                <i className="fas fa-download" style={{ color: '#38bdf8' }}></i>
                                Export CSV
                            </button>
                            <button onClick={() => { fileInputRef.current?.click(); }} style={{
                                width: '100%',
                                padding: '6px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: '#f8fafc',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }} className="hover:bg-slate-800">
                                <i className="fas fa-upload" style={{ color: '#10b981' }}></i>
                                Import CSV
                            </button>
                        </div>
                    )}
                </div>

                {/* Sync Status */}
                <span style={{
                    fontSize: '10px',
                    color: '#10b981',
                    fontWeight: 600,
                    padding: '2px 12px',
                    borderRadius: '12px',
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '8px' }}></i>
                    Synced • {appointments.length}
                </span>
            </div>
        </div>
    );
};

const actionButtonStyle: React.CSSProperties = {
    padding: '4px 12px',
    borderRadius: '6px',
    border: '1px solid #1a2744',
    background: 'transparent',
    color: '#cbd5e1',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
    height: '28px'
};