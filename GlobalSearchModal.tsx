import React, { useState, useEffect, useRef } from 'react';
import { Appointment, Script } from '../types';
import { OBJECTION_CATEGORIES } from '../config/constants';
import { Utils } from '../utils/helpers';

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointments: Appointment[];
    scripts: Record<string, Script>;
    onSelectAppointment: (appt: Appointment) => void;
    onSelectScript: (scriptKey: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
    isOpen,
    onClose,
    appointments,
    scripts,
    onSelectAppointment,
    onSelectScript
}) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const q = query.toLowerCase().trim();

    // Matching appointments
    const matchedAppointments = q ? appointments.filter(a => 
        (a.business && a.business.toLowerCase().includes(q)) ||
        (a.contactName && a.contactName.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q)) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q))
    ).slice(0, 5) : [];

    // Matching scripts
    const matchedScripts = q ? (Object.entries(scripts) as [string, Script][]).filter(([_, s]) =>
        s.name.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    ).slice(0, 4) : [];

    // Matching objections
    const matchedObjections: Array<{ id: string; objection: string; response: string; category: string }> = [];
    if (q) {
        Object.entries(OBJECTION_CATEGORIES).forEach(([catKey, cat]) => {
            cat.objections.forEach(obj => {
                if (obj.objection.toLowerCase().includes(q) || obj.response.toLowerCase().includes(q) || obj.tip.toLowerCase().includes(q)) {
                    matchedObjections.push({ ...obj, category: cat.label });
                }
            });
        });
    }

    return (
        <div className="modal active" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '80px' }}>
            <div className="modal-content" style={{ width: 'min(680px, 95%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <i className="fas fa-search" style={{ color: 'var(--primary)', fontSize: '18px' }}></i>
                    <input 
                        ref={inputRef}
                        type="text"
                        placeholder="Search appointments, scripts, objections, contacts... (ESC to exit)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            fontSize: '16px',
                            color: 'var(--text-primary)',
                            outline: 'none'
                        }}
                    />
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                    {!query ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                            <i className="fas fa-search" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}></i>
                            <p style={{ margin: 0, fontSize: '14px' }}>Type to search across everything in ScriptFlow Pro</p>
                            <div style={{ fontSize: '12px', marginTop: '6px' }}>Try searching "roofing", "objection", "pricing", or "Daniel"</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Appointments */}
                            {matchedAppointments.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        APPOINTMENTS ({matchedAppointments.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {matchedAppointments.map(appt => (
                                            <div 
                                                key={appt.id}
                                                onClick={() => { onSelectAppointment(appt); onClose(); }}
                                                style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{appt.business}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{appt.contactName} • {appt.phone || 'No phone'}</div>
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 800, color: Utils.getStatusColor(appt.status) }}>
                                                    {appt.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Scripts */}
                            {matchedScripts.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        CALL SCRIPTS ({matchedScripts.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {matchedScripts.map(([key, s]) => (
                                            <div 
                                                key={key}
                                                onClick={() => { onSelectScript(key); onClose(); }}
                                                style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-primary)', cursor: 'pointer' }}
                                            >
                                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>{s.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.content}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Objections */}
                            {matchedObjections.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        OBJECTIONS & REBUTTALS ({matchedObjections.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {matchedObjections.slice(0, 4).map(obj => (
                                            <div 
                                                key={obj.id}
                                                style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-primary)' }}
                                            >
                                                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{obj.objection}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>"{obj.response}"</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {matchedAppointments.length === 0 && matchedScripts.length === 0 && matchedObjections.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                                    No results found for "{query}"
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
