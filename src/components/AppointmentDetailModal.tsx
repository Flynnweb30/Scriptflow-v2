import React, { useState, useEffect } from 'react';
import { Appointment, Closer } from '../types';
import { Utils } from '../utils/helpers';
import { TimezoneUtils } from '../utils/timezone-utils';
import { FirestoreService } from '../services/FirestoreService';
import { WorkspaceService } from '../services/WorkspaceService';
import { CONFIG } from '../config/constants';
import { US_TIMEZONE_OPTIONS, normalizeUSTimezone } from '../utils/timezone-utils';

interface AppointmentDetailModalProps {
    appointment: Appointment | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (appt: Appointment) => void;
    onDelete: (id: string) => void;
    closers?: Closer[];
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
    appointment,
    isOpen,
    onClose,
    onSave,
    onDelete,
    closers = CONFIG.DEFAULT_CLOSERS as Closer[]
}) => {
    const [formData, setFormData] = useState<Partial<Appointment>>({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (appointment) {
            setFormData({ ...appointment, timezone: normalizeUSTimezone(appointment.timezone) });
            setIsEditing(false);
        }
    }, [appointment]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !appointment) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const updated: Appointment = {
            ...appointment,
            ...formData,
            timezone: normalizeUSTimezone(formData.timezone),
            primaryStatus: Utils.getPrimaryStatus(formData.status || 'Pending'),
            updatedAt: new Date().toISOString()
        } as Appointment;

        try {
            await FirestoreService.saveAppointment(updated);
            onSave(updated);
            setIsEditing(false);
        } catch (error: any) {
            console.error('Appointment save failed:', error);
            alert(error?.message || 'Unable to save this appointment. Please try again.');
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete appointment for "${appointment.business}"?`)) return;
        try {
            await FirestoreService.deleteAppointment(appointment.id);
            onDelete(appointment.id);
            onClose();
        } catch (error: any) {
            console.error('Appointment delete failed:', error);
            alert(error?.message || 'Unable to delete this appointment. Please try again.');
        }
    };

    const leadScore = Utils.calculateLeadScore(formData as Appointment);
    const callbackDueText = TimezoneUtils.formatCallbackTime(formData as Appointment);

    const handleGoogleCalendar = () => {
        const url = WorkspaceService.createGoogleCalendarUrl(appointment);
        window.open(url, '_blank');
    };

    const handleGmail = () => {
        if (!appointment.email) return;
        const subject = `Website Preview Walkthrough - ${appointment.business}`;
        const body = `Hi ${appointment.contactName || 'there'},\n\nLooking forward to showing you the modern preview concept created for ${appointment.business} on our upcoming walkthrough call.\n\nBest regards,\nScriptFlow Pro Team`;
        const url = WorkspaceService.createGmailComposeUrl(appointment.email, subject, body);
        window.open(url, '_blank');
    };

    return (
        <div 
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(4, 8, 19, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'flex-end',
                zIndex: 99999,
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            {/* Side Drawer Panel positioned on the right side */}
            <div 
                className="side-drawer-panel"
                style={{ 
                    width: 'min(620px, 95vw)', 
                    height: '100vh', 
                    background: '#0d1527',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
                    display: 'flex', 
                    flexDirection: 'column',
                    animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    overflow: 'hidden'
                }}
            >
                {/* Drawer Header */}
                <div 
                    style={{ 
                        padding: '18px 24px', 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        background: '#090e1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: Utils.getStatusColor(formData.status || 'Pending'),
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 900,
                            fontSize: '15px',
                            boxShadow: `0 0 16px ${Utils.getStatusColor(formData.status || 'Pending')}55`
                        }}>
                            {leadScore}
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                                {formData.business || 'Appointment Details'}
                            </h3>
                            <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Lead Score: <b>{leadScore}/100</b></span>
                                <span>•</span>
                                <span>ID: {appointment.id.substring(0, 8)}</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        className="close-btn" 
                        onClick={onClose}
                        title="Close Drawer (Esc)"
                        style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: '#94a3b8',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Drawer Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
                    {isEditing ? (
                        <form id="apptEditForm" onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Business Name *</label>
                                    <input 
                                        type="text"
                                        value={formData.business || ''}
                                        onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                                        required
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Contact Name *</label>
                                    <input 
                                        type="text"
                                        value={formData.contactName || ''}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                        required
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Phone Number</label>
                                    <input 
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Email Address</label>
                                    <input 
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Appointment Date *</label>
                                    <input 
                                        type="date"
                                        value={formData.date || ''}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Time & Period</label>
                                    <input 
                                        type="text"
                                        value={formData.time || ''}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        placeholder="e.g. 2:00 PM"
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Appointment Timezone</label>
                                    <select
                                        value={normalizeUSTimezone(formData.timezone)}
                                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    >
                                        {US_TIMEZONE_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Pipeline Status Stage</label>
                                    <select 
                                        value={formData.status || 'Pending'}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    >
                                        {CONFIG.STATUS_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Assigned Closer</label>
                                    <select 
                                        value={formData.closer || closers.find(c => c.default && c.active)?.name || closers.find(c => c.active)?.name || 'Kailan'}
                                        onChange={(e) => setFormData({ ...formData, closer: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    >
                                        {closers.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1', padding: '10px 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px' }}>STATUS TAGS</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {CONFIG.TAG_OPTIONS.map(tag => {
                                            const selected = Utils.hasTag(formData, tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentTags = Array.isArray(formData.tags) ? formData.tags : [];
                                                        const nextTags = selected ? currentTags.filter(value => value !== tag.id) : [...currentTags, tag.id];
                                                        setFormData({ ...formData, tags: nextTags });
                                                    }}
                                                    style={{ padding: '5px 9px', borderRadius: '999px', border: `1px solid ${selected ? tag.color : '#2a3852'}`, background: selected ? `${tag.color}1f` : '#0d1527', color: selected ? tag.color : '#94a3b8', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                                                >
                                                    {tag.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Callback Reminder</label>
                                    <select 
                                        value={formData.callbackSetting || 'none'}
                                        onChange={(e) => setFormData({ ...formData, callbackSetting: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px' }}
                                    >
                                        {CONFIG.CALLBACK_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>Notes & Walkthrough Instructions</label>
                                <textarea 
                                    rows={5}
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b', background: '#090e1a', color: '#f8fafc', fontSize: '13px', resize: 'vertical', lineHeight: '1.6' }}
                                />
                            </div>
                        </form>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Key Badges */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '6px 14px', borderRadius: '20px', background: Utils.getStatusColor(formData.status || 'Pending'), color: '#fff', fontSize: '12px', fontWeight: 800, boxShadow: `0 2px 8px ${Utils.getStatusColor(formData.status || 'Pending')}44` }}>
                                    {formData.status}
                                </span>
                                <span style={{ padding: '6px 14px', borderRadius: '20px', background: '#131d33', border: '1px solid #1e293b', color: '#e2e8f0', fontSize: '12px', fontWeight: 700 }}>
                                    👤 Closer: {formData.closer || 'Unassigned'}
                                </span>
                                {(Array.isArray(formData.tags) ? formData.tags : []).map(tagId => { const tag = Utils.getTagDefinition(tagId); return <span key={tagId} style={{ padding: '5px 10px', borderRadius: '999px', background: `${tag.color}18`, border: `1px solid ${tag.color}55`, color: tag.color, fontSize: '10px', fontWeight: 800 }}>{tag.name}</span>; })}
                                {formData.role && (
                                    <span style={{ padding: '6px 14px', borderRadius: '20px', background: '#131d33', border: '1px solid #1e293b', color: '#94a3b8', fontSize: '12px' }}>
                                        💼 {formData.role}
                                    </span>
                                )}
                                {Utils.isNoShow(formData) && (
                                    <span style={{ padding: '6px 14px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '12px', fontWeight: 800 }}>
                                        No-Show
                                    </span>
                                )}
                            </div>

                            {/* Contact Grid Card */}
                            <div style={{ background: '#090e1a', border: '1px solid #1e293b', borderRadius: '16px', padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '13px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>CONTACT PERSON</div>
                                    <div style={{ fontWeight: 800, color: '#f8fafc' }}>{formData.contactName}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>PHONE NUMBER</div>
                                    <div style={{ fontWeight: 800, color: '#f8fafc' }}>
                                        {formData.phone ? (
                                            <a href={`tel:${formData.phone}`} style={{ color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <i className="fas fa-phone-alt" style={{ fontSize: '11px' }}></i>
                                                <span>{formData.phone}</span>
                                            </a>
                                        ) : 'Not provided'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>EMAIL ADDRESS</div>
                                    <div style={{ fontWeight: 800, color: '#f8fafc' }}>
                                        {formData.email ? (
                                            <span style={{ color: '#38bdf8' }}>{formData.email}</span>
                                        ) : 'Not provided'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>SCHEDULED WALKTHROUGH</div>
                                    <div style={{ fontWeight: 800, color: '#f8fafc' }}>
                                        {Utils.formatDate(formData.date)} at {formData.time || 'TBD'} ({formData.timezone || 'Central'})
                                    </div>
                                </div>
                            </div>

                            {/* Callback Due Info */}
                            {formData.callbackSetting && formData.callbackSetting !== 'none' && (
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '14px', fontSize: '13px', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <i className="fas fa-bell" style={{ color: '#f59e0b', fontSize: '16px' }}></i>
                                    <div>
                                        <b>Callback Alert Configured:</b> {formData.callbackSetting} before appointment ({callbackDueText})
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.04em' }}>LEAD NOTES & SCRIPT LOG:</div>
                                <div style={{ background: '#090e1a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                                    {formData.notes || 'No notes added.'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Drawer Footer */}
                <div 
                    style={{ 
                        padding: '16px 24px', 
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        background: '#090e1a',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        flexWrap: 'wrap', 
                        gap: '10px',
                        flexShrink: 0
                    }}
                >
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            className="btn-secondary" 
                            onClick={handleGoogleCalendar}
                            title="Add to Google Calendar"
                            style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}
                        >
                            <i className="fas fa-calendar-plus text-blue-400" style={{ marginRight: '6px' }}></i>
                            Google Cal
                        </button>
                        {formData.email && (
                            <button 
                                className="btn-secondary" 
                                onClick={handleGmail}
                                title="Compose in Gmail"
                                style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}
                            >
                                <i className="fas fa-envelope text-red-400" style={{ marginRight: '6px' }}></i>
                                Gmail
                            </button>
                        )}
                        <button 
                            onClick={handleDelete}
                            style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            <i className="fas fa-trash-alt" style={{ marginRight: '4px' }}></i>
                            Delete
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {!isEditing && (Utils.isNoShow(appointment) || ['Canceled', 'No Show'].includes(appointment.status || '')) && (
                            <button
                                className="btn-secondary"
                                onClick={() => { setFormData(prev => ({ ...prev, status: 'Rescheduled', primaryStatus: Utils.getPrimaryStatus('Rescheduled') })); setIsEditing(true); }}
                                style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, borderColor: '#f59e0b', color: '#fbbf24' }}
                            >
                                <i className="fas fa-calendar-days" style={{ marginRight: '6px' }}></i>
                                Reschedule
                            </button>
                        )}
                        {!isEditing ? (
                            <button 
                                className="btn-primary" 
                                onClick={() => setIsEditing(true)}
                                style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}
                            >
                                <i className="fas fa-edit" style={{ marginRight: '6px' }}></i>
                                Edit Lead
                            </button>
                        ) : (
                            <>
                                <button 
                                    className="btn-secondary" 
                                    onClick={() => setIsEditing(false)}
                                    style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="btn-primary" 
                                    onClick={handleSave}
                                    style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}
                                >
                                    Save Changes
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

