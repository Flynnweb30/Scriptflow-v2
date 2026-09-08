import React from 'react';
import { AppNotification, Appointment } from '../types';
import { Utils } from '../utils/helpers';
import { NotificationManager } from '../managers/NotificationManager';

interface CallbackDueModalProps {
    notification: AppNotification | null;
    appointment: Appointment | null;
    isOpen: boolean;
    onClose: () => void;
    onViewAppointment: (appt: Appointment) => void;
    onMarkCompleted: (appt: Appointment) => void;
}

export const CallbackDueModal: React.FC<CallbackDueModalProps> = ({
    notification,
    appointment,
    isOpen,
    onClose,
    onViewAppointment,
    onMarkCompleted
}) => {
    if (!isOpen || (!notification && !appointment)) return null;

    const appt = appointment || {
        id: notification?.appointmentId || '',
        business: notification?.business || 'Client Callback',
        contactName: notification?.contactName || '',
        phone: notification?.phone || '',
        email: notification?.email || '',
        date: notification?.date || '',
        time: notification?.time || '',
        timezone: notification?.timezone || 'Central CDT',
        status: 'Warm Callback'
    } as Appointment;

    const handleCall = () => {
        if (appt.phone) {
            window.location.href = `tel:${appt.phone}`;
        }
    };

    const handleDismiss = () => {
        if (notification) {
            NotificationManager.dismissNotification(notification.id);
        }
        onClose();
    };

    const handleComplete = () => {
        onMarkCompleted(appt);
        if (notification) {
            NotificationManager.dismissNotification(notification.id);
        }
        onClose();
    };

    return (
        <div className="modal active" style={{ display: 'flex' }}>
            <div className="modal-content" style={{ width: 'min(540px, 95%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ef4444', color: '#fff', display: 'grid', placeItems: 'center' }}>
                            <i className="fas fa-phone-volume"></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>Callback Due Now!</h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Scheduled Lead Outreach Alarm</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {appt.business}
                        </h2>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Contact: <b>{appt.contactName || 'Lead'}</b>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '13px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PHONE NUMBER</div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {appt.phone || 'No phone'}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SCHEDULED TIME</div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {appt.time || '10:00 AM'} ({appt.timezone || 'Central'})
                            </div>
                        </div>
                        {appt.email && (
                            <div style={{ gridColumn: 'span 2' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>EMAIL</div>
                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                                    {appt.email}
                                </div>
                            </div>
                        )}
                    </div>

                    {appt.notes && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>CONTEXT & NOTES:</div>
                            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', fontSize: '12px', color: 'var(--text-secondary)', maxHeight: '100px', overflowY: 'auto' }}>
                                {appt.notes}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        {appt.phone && (
                            <button 
                                className="btn-primary"
                                onClick={handleCall}
                                style={{ flex: 1, height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, background: '#10b981' }}
                            >
                                <i className="fas fa-phone-alt"></i>
                                <span>Call {appt.phone}</span>
                            </button>
                        )}
                        <button 
                            className="btn-secondary"
                            onClick={() => { onViewAppointment(appt); onClose(); }}
                            style={{ flex: 1, height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 }}
                        >
                            <i className="fas fa-external-link-alt"></i>
                            <span>View Full Details</span>
                        </button>
                    </div>
                </div>

                <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <button className="btn-secondary" onClick={handleDismiss}>
                        Dismiss Alarm
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={handleComplete}
                        style={{ padding: '8px 16px', fontWeight: 700 }}
                    >
                        <i className="fas fa-check" style={{ marginRight: '6px' }}></i>
                        Mark Callback Complete
                    </button>
                </div>
            </div>
        </div>
    );
};
