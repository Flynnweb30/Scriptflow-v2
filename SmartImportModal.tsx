import React, { useState } from 'react';
import { Appointment, Closer, ParsedImportRecord } from '../types';
import { 
    splitAppointments, 
    parseAppointmentTextEnhanced, 
    validateAppointmentData, 
    detectDuplicatesEnhanced,
    Utils 
} from '../utils/helpers';
import { FirestoreService } from '../services/FirestoreService';
import { CONFIG } from '../config/constants';
import { getWorkspaceTimezone } from '../utils/timezone-utils';

interface SmartImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointments: Appointment[];
    onImportComplete: () => void;
    closers?: Closer[];
}

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
    isOpen,
    onClose,
    appointments,
    onImportComplete,
    closers = CONFIG.DEFAULT_CLOSERS as Closer[]
}) => {
    const [rawInput, setRawInput] = useState('');
    const [defaultDate, setDefaultDate] = useState(Utils.getTodayStr());
    const [parsedRecords, setParsedRecords] = useState<ParsedImportRecord[]>([]);
    const [step, setStep] = useState<'input' | 'preview'>('input');
    const [importing, setImporting] = useState(false);

    if (!isOpen) return null;

    const handleParse = () => {
        if (!rawInput.trim()) return;

        const chunks = splitAppointments(rawInput);
        const records: ParsedImportRecord[] = chunks.map((chunk, idx) => {
            const { result, confidence, context } = parseAppointmentTextEnhanced(chunk, defaultDate);
            const { validated, errors, warnings, isValid } = validateAppointmentData(result, defaultDate);
            const duplicates = detectDuplicatesEnhanced(validated, appointments);

            return {
                index: idx + 1,
                raw: chunk,
                parsed: result,
                confidence,
                context,
                validated,
                isValid,
                errors,
                warnings,
                hasDuplicate: duplicates.length > 0,
                duplicates
            };
        });

        setParsedRecords(records);
        setStep('preview');
    };

    const handleImportAll = async () => {
        setImporting(true);
        for (const rec of parsedRecords) {
            const appt: Appointment = {
                id: 'appt_' + Utils.generateId(),
                business: rec.validated.business || 'Imported Lead',
                contactName: rec.validated.name || 'Unknown Contact',
                role: rec.validated.role || '',
                phone: rec.validated.phone || '',
                email: rec.validated.email || '',
                date: rec.validated.date || defaultDate,
                time: rec.validated.time || '09:00 AM',
                timezone: rec.validated.timezone || getWorkspaceTimezone(),
                status: rec.validated.status || 'Pending',
                primaryStatus: Utils.getPrimaryStatus(rec.validated.status || 'Pending'),
                assigned: rec.validated.assigned || CONFIG.DEFAULT_TEAM_MEMBERS.find(member => member.active)?.name || 'Daniel',
                closer: rec.validated.closer || (closers.find(c => c.default && c.active)?.name || closers.find(c => c.active)?.name || 'Kailan'),
                notes: rec.validated.notes || rec.raw,
                createdAt: new Date().toISOString()
            };
            await FirestoreService.saveAppointment(appt);
        }
        setImporting(false);
        onImportComplete();
        onClose();
    };

    const loadSample = () => {
        setRawInput(`Business: Apex Plumbing & Heating
Contact: Sarah Jenkins
Role: Office Manager
Phone: (312) 555-0199
Email: sarah@apexplumbing.com
Demo Time & Date: Tomorrow at 2:00 PM CST
Status: Hot Transfer
Notes: Interested in 10-min website walkthrough. Current site is not mobile-friendly.

---

Business Name: Horizon Dental Care
Name: Dr. Michael Chang
Phone: +1 415 555 7821
Email: mchang@horizondental.com
Demo Time & Date: 2026-08-25 at 11:30 AM EST
Status: Meeting Booked
Notes: Wants online booking integration and modern branding overhaul.`);
    };

    return (
        <div className="modal active" style={{ display: 'flex' }}>
            <div className="modal-content" style={{ width: 'min(900px, 95%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-file-import" style={{ color: 'var(--primary)', fontSize: '20px' }}></i>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Smart Multi-Lead Import</h3>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {step === 'input' ? (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    Paste raw appointment notes, spreadsheet text, emails, or multiple lead records:
                                </div>
                                <button 
                                    className="btn-secondary" 
                                    onClick={loadSample}
                                    style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}
                                >
                                    <i className="fas fa-magic" style={{ marginRight: '4px' }}></i>
                                    Load Sample
                                </button>
                            </div>

                            <textarea
                                rows={12}
                                placeholder="Paste leads here (supports Key: Value, bullets, paragraphs, or --- dividers)..."
                                value={rawInput}
                                onChange={(e) => setRawInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    lineHeight: '1.6',
                                    fontFamily: 'monospace',
                                    resize: 'vertical',
                                    marginBottom: '16px'
                                }}
                            />

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Default Reference Date:</label>
                                <input 
                                    type="date"
                                    value={defaultDate}
                                    onChange={(e) => setDefaultDate(e.target.value)}
                                    style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Parsed {parsedRecords.length} Record(s) for Import
                                </div>
                                <button 
                                    className="btn-secondary"
                                    onClick={() => setStep('input')}
                                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}
                                >
                                    <i className="fas fa-arrow-left" style={{ marginRight: '6px' }}></i>
                                    Edit Raw Text
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {parsedRecords.map((rec) => (
                                    <div 
                                        key={rec.index}
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: '1px solid',
                                            borderColor: !rec.isValid ? 'var(--danger)' : rec.hasDuplicate ? 'var(--warning)' : 'var(--border-color)',
                                            borderRadius: '12px',
                                            padding: '16px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ background: 'var(--primary)', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800 }}>
                                                    {rec.index}
                                                </span>
                                                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                                    {rec.validated.business || 'Untitled Business'}
                                                </span>
                                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    ({rec.validated.name || 'No Contact'})
                                                </span>
                                            </div>

                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                color: 'var(--primary)'
                                            }}>
                                                {rec.validated.status || 'Pending'}
                                            </span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                            <div>📞 <b>Phone:</b> {rec.validated.phone || 'None'}</div>
                                            <div>✉️ <b>Email:</b> {rec.validated.email || 'None'}</div>
                                            <div>📅 <b>Date:</b> {rec.validated.date || 'None'}</div>
                                            <div>⏰ <b>Time:</b> {rec.validated.time || 'None'} ({rec.validated.timezone || 'Central'})</div>
                                        </div>

                                        {rec.hasDuplicate && (
                                            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '12px', color: '#b45309', marginTop: '6px' }}>
                                                <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                                                Potential Duplicate detected: Matches "{rec.duplicates[0]?.existing.business}" ({rec.duplicates[0]?.confidence}% match on {rec.duplicates[0]?.matchedFields.join(', ')})
                                            </div>
                                        )}

                                        {rec.errors.length > 0 && (
                                            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '12px', color: '#b91c1c', marginTop: '6px' }}>
                                                {rec.errors.map((err, eIdx) => (
                                                    <div key={eIdx}>⚠️ {err.message}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="btn-secondary" onClick={onClose} disabled={importing}>
                        Cancel
                    </button>
                    {step === 'input' ? (
                        <button 
                            className="btn-primary" 
                            onClick={handleParse}
                            disabled={!rawInput.trim()}
                        >
                            <i className="fas fa-magic" style={{ marginRight: '6px' }}></i>
                            Parse & Preview Leads
                        </button>
                    ) : (
                        <button 
                            className="btn-primary" 
                            onClick={handleImportAll}
                            disabled={importing || parsedRecords.length === 0}
                        >
                            <i className={`fas fa-${importing ? 'spinner fa-spin' : 'check'}`} style={{ marginRight: '6px' }}></i>
                            <span>{importing ? 'Importing...' : `Import ${parsedRecords.length} Appointment(s)`}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
