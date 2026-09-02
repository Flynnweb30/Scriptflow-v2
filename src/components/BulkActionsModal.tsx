import React, { useEffect, useState } from 'react';
import { Appointment } from '../types';
import { FirestoreService } from '../services/FirestoreService';
import { CONFIG } from '../config/constants';

interface BulkActionsModalProps {
    isOpen: boolean;
    appointments: Appointment[];
    onClose: () => void;
    onUpdateComplete: () => void;
    closers?: import('../types').Closer[];
}

export const BulkActionsModal: React.FC<BulkActionsModalProps> = ({
    isOpen,
    appointments,
    onClose,
    onUpdateComplete,
    closers = CONFIG.DEFAULT_CLOSERS
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [targetStatus, setTargetStatus] = useState<string>('Meeting Booked');
    const defaultCloser = closers.find(c => c.default && c.active) || closers.find(c => c.active) || CONFIG.DEFAULT_CLOSERS[0];
    const [targetCloser, setTargetCloser] = useState<string>(defaultCloser?.name || '');
    const [targetDate, setTargetDate] = useState<string>('');
    const [actionType, setActionType] = useState<'status' | 'closer' | 'reschedule' | 'delete'>('status');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!closers.some(c => c.name === targetCloser && c.active)) {
            setTargetCloser(defaultCloser?.name || '');
        }
    }, [closers, defaultCloser?.name, targetCloser]);

    if (!isOpen) return null;

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === appointments.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(appointments.map(a => a.id));
        }
    };

    const handleApply = async () => {
        if (selectedIds.length === 0) return;
        if (actionType === 'reschedule' && !targetDate) return;
        setProcessing(true);
        try {
        for (const id of selectedIds) {
            const appt = appointments.find(a => a.id === id);
            if (!appt) continue;

            if (actionType === 'status') {
                await FirestoreService.saveAppointment({ ...appt, status: targetStatus });
            } else if (actionType === 'closer') {
                await FirestoreService.saveAppointment({ ...appt, closer: targetCloser });
            } else if (actionType === 'reschedule' && targetDate) {
                await FirestoreService.saveAppointment({ ...appt, date: targetDate, status: 'Rescheduled' });
            } else if (actionType === 'delete') {
                await FirestoreService.deleteAppointment(id);
            }
        }
        onUpdateComplete();
        onClose();
        setSelectedIds([]);
        } catch (error: any) {
            alert(error?.message || 'One or more bulk actions could not be completed.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="modal active" style={{ display: 'flex' }}>
            <div className="modal-content" style={{ width: 'min(780px, 95%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-tasks" style={{ color: 'var(--primary)', fontSize: '20px' }}></i>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Bulk Actions ({selectedIds.length} Selected)</h3>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {/* Action Selector */}
                    <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>Choose Action:</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setActionType('status')}
                                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: actionType === 'status' ? 'var(--primary)' : 'var(--border-color)', background: actionType === 'status' ? 'var(--primary)' : 'var(--bg-card)', color: actionType === 'status' ? '#fff' : 'var(--text-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Change Status
                            </button>
                            <button
                                type="button"
                                onClick={() => setActionType('closer')}
                                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: actionType === 'closer' ? 'var(--primary)' : 'var(--border-color)', background: actionType === 'closer' ? 'var(--primary)' : 'var(--bg-card)', color: actionType === 'closer' ? '#fff' : 'var(--text-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Reassign Closer
                            </button>
                            <button
                                type="button"
                                onClick={() => setActionType('reschedule')}
                                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: actionType === 'reschedule' ? 'var(--primary)' : 'var(--border-color)', background: actionType === 'reschedule' ? 'var(--primary)' : 'var(--bg-card)', color: actionType === 'reschedule' ? '#fff' : 'var(--text-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Reschedule Date
                            </button>
                            <button
                                type="button"
                                onClick={() => setActionType('delete')}
                                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: actionType === 'delete' ? 'var(--danger)' : 'var(--border-color)', background: actionType === 'delete' ? 'var(--danger)' : 'var(--bg-card)', color: actionType === 'delete' ? '#fff' : 'var(--text-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Delete Selected
                            </button>
                        </div>

                        {/* Action Parameters */}
                        <div style={{ marginTop: '12px' }}>
                            {actionType === 'status' && (
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>New Status:</label>
                                    <select 
                                        value={targetStatus}
                                        onChange={(e) => setTargetStatus(e.target.value)}
                                        style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', marginLeft: '8px' }}
                                    >
                                        {CONFIG.STATUS_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {actionType === 'closer' && (
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>New Closer:</label>
                                    <select 
                                        value={targetCloser}
                                        onChange={(e) => setTargetCloser(e.target.value)}
                                        style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', marginLeft: '8px' }}
                                    >
                                        {closers.filter(c => c.active).map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {actionType === 'reschedule' && (
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>New Date:</label>
                                    <input 
                                        type="date"
                                        value={targetDate}
                                        onChange={(e) => setTargetDate(e.target.value)}
                                        style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', marginLeft: '8px' }}
                                    />
                                </div>
                            )}

                            {actionType === 'delete' && (
                                <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 700 }}>
                                    ⚠️ Warning: This will permanently remove {selectedIds.length} appointments.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selection Table */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <button 
                            type="button"
                            onClick={handleSelectAll}
                            style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                            {selectedIds.length === appointments.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {selectedIds.length} of {appointments.length} selected
                        </span>
                    </div>

                    <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                        {appointments.map(appt => (
                            <div 
                                key={appt.id}
                                onClick={() => handleToggleSelect(appt.id)}
                                style={{
                                    padding: '10px 14px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: selectedIds.includes(appt.id) ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input 
                                        type="checkbox"
                                        checked={selectedIds.includes(appt.id)}
                                        onChange={() => {}}
                                        style={{ accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {appt.business}
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        ({appt.contactName || 'No contact'})
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{appt.date}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>{appt.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="btn-secondary" onClick={onClose} disabled={processing}>
                        Cancel
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={handleApply}
                        disabled={processing || selectedIds.length === 0}
                        style={{ padding: '8px 20px', fontWeight: 700 }}
                    >
                        {processing ? 'Processing...' : `Apply to ${selectedIds.length} Items`}
                    </button>
                </div>
            </div>
        </div>
    );
};
