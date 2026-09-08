import React from 'react';
import { Appointment } from '../types';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointments: Appointment[];
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    appointments
}) => {
    if (!isOpen) return null;

    // Generate recent events from appointments
    const sorted = [...appointments].sort((a, b) => {
        const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
        const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });

    return (
        <div className="modal-overlay active" onClick={onClose}>
            <div 
                className="modal-container active"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '640px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            >
                <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                            <i className="fas fa-history"></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                Activity & Sync History
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                Real-time audit trail of sales calls, imports, and team assignments
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <i className="fas fa-check-circle" style={{ color: '#10b981', fontSize: '16px' }}></i>
                            <div style={{ flex: 1, fontSize: '13px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Cloud Database Synchronized</span>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All leads, scripts, and calendar appointments are cached and live-synced with Firestore.</div>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>Live</span>
                        </div>

                        <h4 style={{ margin: '12px 0 4px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                            Recent Appointment Actions ({sorted.length})
                        </h4>

                        {sorted.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                No recent activity logged yet. Book your first appointment or run a Smart Import!
                            </div>
                        ) : (
                            sorted.slice(0, 15).map((appt, idx) => (
                                <div 
                                    key={appt.id || idx}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: '10px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: appt.status === 'Hot Transfer' ? '#dc2626' : appt.status === 'Completed' ? '#10b981' : '#3b82f6'
                                        }} />
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {appt.business}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {appt.contactName} • {appt.date} {appt.time ? `at ${appt.time}` : ''} • Closer: {appt.closer || 'Unassigned'}
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        {appt.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-primary)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <button 
                        onClick={onClose}
                        className="btn-secondary"
                        style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                    >
                        Close History
                    </button>
                </div>
            </div>
        </div>
    );
};
