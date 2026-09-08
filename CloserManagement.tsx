import React, { useState } from 'react';
import { Closer } from '../types';
import { Utils } from '../utils/helpers';
import { FirestoreService } from '../services/FirestoreService';

interface CloserManagementProps {
    closers: Closer[];
}

export const CloserManagement: React.FC<CloserManagementProps> = ({ closers }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [editingCloserId, setEditingCloserId] = useState<string | null>(null);

    const handleAddOrEditCloser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const id = editingCloserId || 'closer_' + Utils.generateId();
        const previousCloser = editingCloserId ? closers.find(c => c.id === editingCloserId) : undefined;

        try {
            const newCloser: Closer = {
            id,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            active: previousCloser?.active ?? true,
            default: isDefault
        };

            await FirestoreService.saveCloser(newCloser, previousCloser?.name);
        } catch (error: any) {
            alert(error?.message || 'Unable to save the closer. Please try again.');
            return;
        }
        setName('');
        setEmail('');
        setPhone('');
        setIsDefault(false);
        setEditingCloserId(null);
    };

    const handleEdit = (closer: Closer) => {
        setEditingCloserId(closer.id);
        setName(closer.name);
        setEmail(closer.email || '');
        setPhone(closer.phone || '');
        setIsDefault(Boolean(closer.default && closer.active));
    };

    const handleToggleActive = async (closer: Closer) => {
        try {
            await FirestoreService.saveCloser({
                ...closer,
                active: !closer.active
            });
        } catch (error: any) {
            alert(error?.message || 'Unable to update the closer. Please try again.');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to remove this closer?')) {
            try {
                await FirestoreService.deleteCloser(id);
            } catch (error: any) {
                alert(error?.message || 'Unable to delete the closer. Please try again.');
            }
        }
    };

    const handleSetDefault = async (closer: Closer) => {
        if (!closer.active) {
            alert('Activate this closer before making them the default.');
            return;
        }
        try {
            await FirestoreService.saveCloser({ ...closer, active: true, default: true });
        } catch (error: any) {
            alert(error?.message || 'Unable to set the default closer. Please try again.');
        }
    };

    return (
        <div className="closers-container" style={{ padding: '0 0 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        <i className="fas fa-users-cog" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                        Closer & Team Management
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Configure default appointment recipients, contact details, and active status
                    </p>
                </div>
            </div>

            {/* Closer Form */}
            <form onSubmit={handleAddOrEditCloser} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800 }}>
                    {editingCloserId ? 'Edit Closer' : 'Add New Closer'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Full Name:</label>
                        <input 
                            type="text"
                            placeholder="e.g. Kailan Miller"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Email Coordinate:</label>
                        <input 
                            type="email"
                            placeholder="kailan@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Phone / Transfer Line:</label>
                        <input 
                            type="tel"
                            placeholder="+1 (555) 020-1923"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                        <input 
                            type="checkbox"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                        />
                        <span>Set as Default Closer for new bookings</span>
                    </label>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {editingCloserId && (
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setEditingCloserId(null);
                                    setName('');
                                    setEmail('');
                                    setPhone('');
                                    setIsDefault(false);
                                }}
                                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px' }}
                            >
                                Cancel
                            </button>
                        )}
                        <button 
                            type="submit" 
                            className="btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '10px', fontWeight: 700, fontSize: '13px' }}
                        >
                            <i className="fas fa-save"></i>
                            <span>{editingCloserId ? 'Update Closer' : 'Save Closer'}</span>
                        </button>
                    </div>
                </div>
            </form>

            {/* Closer Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {closers.map(closer => (
                    <div 
                        key={closer.id}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid',
                            borderColor: closer.default ? 'var(--primary)' : 'var(--border-color)',
                            borderRadius: '16px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            position: 'relative'
                        }}
                    >
                        {closer.default && (
                            <div style={{ position: 'absolute', top: '14px', right: '14px', background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em' }}>
                                DEFAULT CLOSER
                            </div>
                        )}

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: '18px', fontWeight: 800 }}>
                                    {closer.name[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        {closer.name}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: closer.active ? 'var(--success)' : 'var(--danger)' }} />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {closer.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                {closer.email && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="far fa-envelope" style={{ width: '16px', color: 'var(--text-muted)' }}></i>
                                        <span>{closer.email}</span>
                                    </div>
                                )}
                                {closer.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="fas fa-phone-alt" style={{ width: '16px', color: 'var(--text-muted)' }}></i>
                                        <span>{closer.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '6px' }}>
                            <button
                                onClick={() => handleToggleActive(closer)}
                                style={{ border: 'none', background: 'transparent', color: closer.active ? 'var(--text-muted)' : 'var(--success)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                                {closer.active ? 'Deactivate' : 'Activate'}
                            </button>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                {!closer.default && closer.active && (
                                    <button
                                        onClick={() => handleSetDefault(closer)}
                                        style={{ border: 'none', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Make Default
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(closer)}
                                    style={{ border: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}
                                    title="Edit"
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button
                                    onClick={() => handleDelete(closer.id)}
                                    style={{ border: 'none', background: 'var(--bg-primary)', color: 'var(--danger)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}
                                    title="Delete"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
