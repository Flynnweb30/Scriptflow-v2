import React, { useState, useEffect } from 'react';
import { Appointment } from '../types';
import { Utils } from '../utils/helpers';
import { FirestoreService } from '../services/FirestoreService';
import { CONFIG } from '../config/constants';
import { getWorkspaceTimezone, setWorkspaceTimezone, US_TIMEZONE_OPTIONS } from '../utils/timezone-utils';

interface QuickAddModalProps {
    isOpen: boolean;
    defaultDate?: string;
    defaultStatus?: string;
    onClose: () => void;
    onCreated: (appt: Appointment) => void;
    closers?: import('../types').Closer[];
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
    isOpen,
    defaultDate,
    defaultStatus,
    onClose,
    onCreated,
    closers = CONFIG.DEFAULT_CLOSERS
}) => {
    const [business, setBusiness] = useState('');
    const [contactName, setContactName] = useState('');
    const [role, setRole] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [date, setDate] = useState(defaultDate || Utils.getTodayStr());
    const [time, setTime] = useState('10:00 AM');
    const [timezone, setTimezone] = useState(getWorkspaceTimezone());
    const [status, setStatus] = useState(defaultStatus || 'New Lead');
    const [activityType, setActivityType] = useState<'meeting' | 'callback' | 'followup'>('meeting');
    const defaultCloser = closers.find(c => c.default && c.active) || closers.find(c => c.active) || CONFIG.DEFAULT_CLOSERS[0];
    const [closer, setCloser] = useState(defaultCloser?.name || '');
    const [callbackSetting, setCallbackSetting] = useState('none');
    const [notes, setNotes] = useState('');
    const [noShow, setNoShow] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // Always start from a clean form so a cancelled/failed entry cannot leak
        // into the next appointment or make the UI appear to save stale data.
        setBusiness('');
        setContactName('');
        setRole('');
        setPhone('');
        setEmail('');
        setDate(defaultDate || Utils.getTodayStr());
        setTime('10:00 AM');
        setTimezone(getWorkspaceTimezone());
        setStatus(defaultStatus || 'New Lead');
        setActivityType(defaultStatus === 'Warm Callback' ? 'callback' : 'meeting');
        setCloser(defaultCloser?.name || '');
        setCallbackSetting('none');
        setNotes('');
        setNoShow(false);
    }, [isOpen, defaultDate, defaultStatus, defaultCloser?.id, defaultCloser?.name]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!business.trim() || !contactName.trim()) return;

        const normalizedDate = Utils.normalizeDateOnly(date) || Utils.getTodayStr();

        const newAppt: Appointment = {
            id: 'appt_' + Utils.generateId(),
            business: business.trim(),
            contactName: contactName.trim(),
            role: role.trim(),
            phone: phone.trim(),
            email: email.trim(),
            date: normalizedDate,
            time,
            timezone,
            status,
            primaryStatus: Utils.getPrimaryStatus(status),
            assigned: CONFIG.DEFAULT_TEAM_MEMBERS.find(member => member.active)?.name || 'Daniel',
            closer,
            appointmentType: activityType,
            eventType: activityType,
            followUpType: activityType === 'followup' ? 'Task' : undefined,
            callbackSetting,
            notes: notes.trim(),
            tags: noShow ? ['no_show'] : [],
            createdAt: new Date().toISOString()
        };

        try {
            await FirestoreService.saveAppointment(newAppt);
        } catch (error: any) {
            alert(error?.message || 'Unable to save the appointment. Please try again.');
            return;
        }
        onCreated(newAppt);
        onClose();

        // Reset
        setBusiness('');
        setContactName('');
        setRole('');
        setPhone('');
        setEmail('');
        setNotes('');
        setNoShow(false);
    };

    return (
        <div className="modal active" style={{ display: 'flex' }}>
            <div className="modal-content" style={{ width: 'min(640px, 95%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-plus-circle" style={{ color: 'var(--primary)', fontSize: '20px' }}></i>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Quick Add Appointment</h3>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Business Name *</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Apex Roofing" 
                                    value={business}
                                    onChange={(e) => setBusiness(e.target.value)}
                                    required
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Contact Name *</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Sarah Jenkins" 
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    required
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Role / Title</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Managing Director" 
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Phone Number</label>
                                <input 
                                    type="tel" 
                                    placeholder="+1 (555) 019-2834" 
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Email Coordinate</label>
                                <input 
                                    type="email" 
                                    placeholder="sarah@apexroofing.com" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Date</label>
                                <input 
                                    type="date" 
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Time & Timezone</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input 
                                        type="text" 
                                        placeholder="10:00 AM" 
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        style={{ width: '60%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                    />
                                    <select 
                                        value={timezone}
                                        onChange={(e) => { setTimezone(e.target.value); setWorkspaceTimezone(e.target.value); }}
                                        style={{ width: '40%', height: '40px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12px' }}
                                    >
                                        {US_TIMEZONE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Activity Type</label>
                                <select
                                    value={activityType}
                                    onChange={(e) => setActivityType(e.target.value as 'meeting' | 'callback' | 'followup')}
                                    style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                >
                                    <option value="meeting">Meeting</option>
                                    <option value="callback">Callback</option>
                                    <option value="followup">Follow-up</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Status</label>
                                <select 
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                >
                                    {CONFIG.STATUS_OPTIONS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Assigned Closer</label>
                                <select 
                                    value={closer}
                                    onChange={(e) => setCloser(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                >
                                    {closers.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Callback Alarm</label>
                                <select 
                                    value={callbackSetting}
                                    onChange={(e) => setCallbackSetting(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                >
                                    {CONFIG.CALLBACK_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '12px 14px',
                            marginBottom: '14px',
                            borderRadius: '10px',
                            border: '1px solid rgba(239, 68, 68, 0.28)',
                            background: 'rgba(239, 68, 68, 0.06)'
                        }}>
                            <label htmlFor="quick-add-no-show" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0 }}>
                                <input
                                    id="quick-add-no-show"
                                    type="checkbox"
                                    checked={noShow}
                                    onChange={(e) => setNoShow(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer', flexShrink: 0 }}
                                />
                                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}>No-Show</span>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Add the No-Show tag to this appointment</span>
                                </span>
                            </label>
                            {noShow && (
                                <span style={{ padding: '4px 9px', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.14)', color: '#f87171', fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    Tagged
                                </span>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Walkthrough Notes & Context</label>
                            <textarea 
                                rows={3}
                                placeholder="Add any details about preview requests or customer feedback..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical' }}
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontWeight: 700 }}>
                            <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>
                            Create Appointment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
