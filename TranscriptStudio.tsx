import React, { useState } from 'react';
import { extractBookingData, bookingFormat } from '../utils/helpers';
import { Appointment, Closer } from '../types';
import { Utils } from '../utils/helpers';
import { FirestoreService } from '../services/FirestoreService';
import { CONFIG } from '../config/constants';
import { getWorkspaceTimezone } from '../utils/timezone-utils';

interface TranscriptStudioProps {
    closers?: Closer[];
    onAppointmentCreated: (appt: Appointment) => void;
}

export const TranscriptStudio: React.FC<TranscriptStudioProps> = ({ onAppointmentCreated, closers = CONFIG.DEFAULT_CLOSERS as Closer[] }) => {
    const [rawTranscript, setRawTranscript] = useState('');
    const [extracted, setExtracted] = useState<ReturnType<typeof extractBookingData> | null>(null);
    const [formattedOutput, setFormattedOutput] = useState('');
    const [copied, setCopied] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    const handleProcess = () => {
        if (!rawTranscript.trim()) return;
        const data = extractBookingData(rawTranscript);
        setExtracted(data);
        setFormattedOutput(bookingFormat(data));
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(formattedOutput);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCreateAppointment = async () => {
        if (!extracted) return;
        const appt: Appointment = {
            id: 'appt_' + Utils.generateId(),
            business: extracted.business !== 'Not specified' ? extracted.business : 'New Lead',
            contactName: extracted.name !== 'Not specified' ? extracted.name : 'Unknown Contact',
            role: extracted.role !== 'Not specified' ? extracted.role : '',
            phone: extracted.phone !== 'Not specified' ? extracted.phone : '',
            email: extracted.email !== 'Not specified' ? extracted.email : '',
            date: Utils.getTodayStr(),
            time: '10:00 AM',
            timezone: getWorkspaceTimezone(),
            status: 'Hot Transfer',
            primaryStatus: 'Hot Transfer',
            assigned: CONFIG.DEFAULT_TEAM_MEMBERS.find(member => member.active)?.name || 'Daniel',
            notes: formattedOutput,
            createdAt: new Date().toISOString()
        };

        await FirestoreService.saveAppointment(appt);
        onAppointmentCreated(appt);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
    };

    const loadSample = () => {
        const sample = `Call recording summary:
Client spoke with John Doe from Apex Roofing LLC.
Contact Phone: +1 312 555 0199
Email address: john@apexroofing.com
Role: Managing Director
They are extremely interested in the preview website walkthrough.
Scheduled Demo Date & Time: Tomorrow at 2:00 PM CST.
Notes:
- Looking to replace current outdated WordPress website.
- Needs job lead form and local SEO optimization.
- Requested pricing walkthrough on the screen share call.`;
        setRawTranscript(sample);
    };

    return (
        <div className="transcript-container" style={{ padding: '0 0 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        <i className="fas fa-headphones" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                        Transcript Studio & Booking Parser
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Paste raw call transcripts or recording notes to automatically extract structured demo bookings
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        className="btn-secondary" 
                        onClick={loadSample}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}
                    >
                        <i className="fas fa-magic"></i>
                        <span>Load Sample</span>
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Input Panel */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
                        Raw Call Transcript / Notes:
                    </label>
                    <textarea 
                        rows={14}
                        placeholder="Paste call notes, Otter.ai / Fireflies transcript, or agent summary here..."
                        value={rawTranscript}
                        onChange={(e) => setRawTranscript(e.target.value)}
                        style={{
                            width: '100%',
                            flex: 1,
                            minHeight: '260px',
                            padding: '14px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            marginBottom: '14px'
                        }}
                    />
                    <button 
                        className="btn-primary" 
                        onClick={handleProcess}
                        disabled={!rawTranscript.trim()}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', fontWeight: 800, fontSize: '14px' }}
                    >
                        <i className="fas fa-bolt"></i>
                        <span>Extract & Structure Booking</span>
                    </button>
                </div>

                {/* Output Panel */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Structured Booking Format:
                        </label>
                        {formattedOutput && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                    className="btn-secondary"
                                    onClick={handleCopy}
                                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                                >
                                    <i className={`fas fa-${copied ? 'check text-green-500' : 'copy'}`} style={{ marginRight: '4px' }}></i>
                                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                                </button>
                                <button 
                                    className="btn-primary"
                                    onClick={handleCreateAppointment}
                                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                                >
                                    <i className="fas fa-calendar-plus" style={{ marginRight: '4px' }}></i>
                                    <span>{savedSuccess ? 'Added!' : 'Add to Calendar'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <textarea 
                        readOnly
                        rows={14}
                        placeholder="Structured output will appear here..."
                        value={formattedOutput}
                        style={{
                            width: '100%',
                            flex: 1,
                            minHeight: '260px',
                            padding: '14px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            fontFamily: 'monospace',
                            resize: 'none'
                        }}
                    />

                    {extracted && (
                        <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>Detected Entities:</div>
                            <div>• Business: <b>{extracted.business}</b></div>
                            <div>• Contact: <b>{extracted.name}</b> ({extracted.role})</div>
                            <div>• Phone: <b>{extracted.phone}</b> | Email: <b>{extracted.email}</b></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
