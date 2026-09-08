import React from 'react';
import { CONFIG } from '../config/constants';

interface ShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal active" style={{ display: 'flex' }}>
            <div className="modal-content" style={{ width: 'min(640px, 95%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-keyboard" style={{ color: 'var(--primary)', fontSize: '20px' }}></i>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Keyboard Shortcuts</h3>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                        {Object.entries(CONFIG.DEFAULT_SHORTCUTS).map(([name, item]) => (
                            <div 
                                key={name}
                                style={{
                                    background: 'var(--bg-primary)',
                                    borderRadius: '10px',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px'
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.description}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {item.keys.map(k => (
                                        <kbd 
                                            key={k}
                                            style={{
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                color: 'var(--text-secondary)',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            {k}
                                        </kbd>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
