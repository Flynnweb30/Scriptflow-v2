import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Script, Appointment } from '../types';
import { Utils } from '../utils/helpers';
import { FirestoreService } from '../services/FirestoreService';
import { ConnectionStatus } from './ConnectionStatus';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    onOpenSmartImport: () => void;
    onOpenGlobalSearch: () => void;
    onOpenQuickAdd: () => void;
    onOpenShortcuts: () => void;
    onOpenAuthModal: () => void;
    currentUser: User | null;
    onLogout: () => void;
    scripts: Record<string, Script>;
    currentScriptKey: string;
    setCurrentScriptKey: (key: string) => void;
    onAddScript?: () => void;
    onEditScript?: (key: string) => void;
    onDeleteScript?: (key: string) => void;
    onToggleFavorite?: (key: string) => void;
    onReorderScripts?: (orderedKeys: string[]) => Promise<void>;
    appointments?: Appointment[];
    onOpenActivities?: (preset?: 'overdue') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    onOpenSmartImport,
    onOpenGlobalSearch,
    onOpenQuickAdd,
    onOpenShortcuts,
    onOpenAuthModal,
    currentUser,
    onLogout,
    scripts,
    currentScriptKey,
    setCurrentScriptKey,
    onAddScript,
    onEditScript,
    onDeleteScript,
    onToggleFavorite,
    onReorderScripts,
    appointments = [],
    onOpenActivities
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const [newScriptModalOpen, setNewScriptModalOpen] = useState(false);
    const [newScriptName, setNewScriptName] = useState('');
    const [newScriptContent, setNewScriptContent] = useState('');
    const [draggedScriptKey, setDraggedScriptKey] = useState<string | null>(null);
    const [dragOverScriptKey, setDragOverScriptKey] = useState<string | null>(null);
    const [reorderingScriptKey, setReorderingScriptKey] = useState<string | null>(null);

    const handleScriptSelect = (key: string) => {
        setCurrentScriptKey(key);
        setActiveTab('scripts');
        if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    const handleCreateScript = async () => {
        if (!newScriptName.trim()) return;
        const key = newScriptName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
        const scriptCount = Object.keys(scripts).length;
        const maxOrder = Math.max(-1, ...Object.values(scripts as Record<string, Script>).map(script => Number.isFinite(Number(script.order)) ? Number(script.order) : -1));
        const newScript: Script = {
            name: newScriptName.trim(),
            content: newScriptContent.trim() || '“Hi [Company Name], this is Flynn...”',
            version: 1,
            keyNumber: scriptCount < 9 ? scriptCount + 1 : undefined,
            order: maxOrder + 1,
            favorite: false
        };
        try {
            await FirestoreService.saveScript(key, newScript);
        } catch (error: any) {
            console.error('Create script failed:', error);
            alert(error?.message || 'Unable to create the script. Please sign in and try again.');
            return;
        }
        setCurrentScriptKey(key);
        setActiveTab('scripts');
        setNewScriptName('');
        setNewScriptContent('');
        setNewScriptModalOpen(false);
    };

    const scriptEntries = useMemo(() => {
        return (Object.entries(scripts || {}) as [string, Script][])
            .sort(([keyA, a], [keyB, b]) => {
                const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number(a.keyNumber ?? Number.MAX_SAFE_INTEGER);
                const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number(b.keyNumber ?? Number.MAX_SAFE_INTEGER);
                if (orderA !== orderB) return orderA - orderB;
                return keyA.localeCompare(keyB);
            });
    }, [scripts]);

    const overdueCount = useMemo(() => {
        const today = Utils.getTodayStr();
        return appointments.filter((appt) => {
            const date = Utils.normalizeStoredAppointmentDate(appt);
            const done = ['Completed', 'Held', 'Canceled', 'No Show'].includes(appt.status || '') || Utils.isNoShow(appt);
            return Boolean(date && date < today && !done);
        }).length;
    }, [appointments]);

    const filteredScripts = scriptEntries.filter(([_, item]) => {
        if (!searchQuery) return true;
        return item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
               item.content.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const commitScriptReorder = async (sourceKey: string, targetKey: string) => {
        if (!onReorderScripts || sourceKey === targetKey || reorderingScriptKey) return;
        const allKeys = scriptEntries.map(([key]) => key);
        const sourceIndex = allKeys.indexOf(sourceKey);
        const targetIndex = allKeys.indexOf(targetKey);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const next = [...allKeys];
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);
        setReorderingScriptKey(sourceKey);
        try { await onReorderScripts(next); }
        finally { setReorderingScriptKey(null); }
    };

    const moveScriptBy = async (key: string, direction: -1 | 1) => {
        if (!onReorderScripts || reorderingScriptKey) return;
        const keys = scriptEntries.map(([entryKey]) => entryKey);
        const index = keys.indexOf(key);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= keys.length) return;
        [keys[index], keys[target]] = [keys[target], keys[index]];
        setReorderingScriptKey(key);
        try {
            await onReorderScripts(keys);
        } catch (error: any) {
            alert(error?.message || 'Unable to reorder the call scripts.');
        } finally {
            setReorderingScriptKey(null);
        }
    };

    return (
        <>
            <div 
                className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />
            <aside 
                id="sidebar" 
                className={`sidebar ${sidebarOpen ? 'open' : ''}`}
                style={{
                    width: '270px',
                    minWidth: '270px',
                    background: '#060b17',
                    borderRight: '1px solid #101b30',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh',
                    position: 'sticky',
                    top: 0,
                    zIndex: 40,
                    userSelect: 'none',
                    overflowY: 'hidden'
                }}
            >
                {/* Brand Header */}
                <div style={{ padding: '16px 14px 12px 14px', borderBottom: '1px solid #0f1a2e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            <button 
                                style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    boxShadow: '0 0 16px rgba(37, 99, 235, 0.4)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                }}
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                title="Toggle Sidebar"
                                aria-label="Toggle Sidebar"
                            >
                                <i className="fas fa-bars" style={{ color: '#fff', fontSize: '15px' }}></i>
                            </button>
                            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setActiveTab('scripts')}>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    ScriptFlow Pro
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                                    Smart Call Scripts
                                </div>
                            </div>
                        </div>

                        {/* Close button box */}
                        <button
                            onClick={() => setSidebarOpen(false)}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #1a2744',
                                background: '#0b1326',
                                color: '#94a3b8',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                fontSize: '11px',
                                flexShrink: 0
                            }}
                            className="hover:bg-slate-800"
                            title="Close Sidebar"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    {/* User Profile Avatar / Sign In with Google */}
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#0b1326', borderRadius: '10px', border: '1px solid #16243d' }}>
                        <button 
                            onClick={onOpenAuthModal}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '12px',
                                fontWeight: 600,
                                textAlign: 'left',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                            }}
                            title={currentUser ? (currentUser.email || 'User Account') : 'Sign In with Google'}
                        >
                            {currentUser?.photoURL ? (
                                <img 
                                    src={currentUser.photoURL} 
                                    alt="User" 
                                    style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #3b82f6', flexShrink: 0 }}
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                                    {currentUser ? (currentUser.displayName ? currentUser.displayName[0].toUpperCase() : currentUser.email ? currentUser.email[0].toUpperCase() : 'U') : <i className="fas fa-user" style={{ fontSize: '9px' }}></i>}
                                </div>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#cbd5e1', fontSize: '12px' }}>
                                {currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0]) : 'Sign In with Google'}
                            </span>
                        </button>
                        {currentUser && (
                            <button
                                onClick={onLogout}
                                style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: '2px 4px' }}
                                title="Log Out"
                            >
                                <i className="fas fa-sign-out-alt"></i>
                            </button>
                        )}
                    </div>
                </div>

                {/* Search Scripts Bar */}
                <div style={{ padding: '12px 14px 6px 14px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <i className="fas fa-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#0284c7', fontSize: '12px' }}></i>
                        <input 
                            type="text" 
                            placeholder="Search scripts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                height: '34px',
                                padding: '0 10px 0 30px',
                                borderRadius: '8px',
                                border: '1px solid #142036',
                                background: '#091020',
                                color: '#f1f5f9',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer' }}
                            >
                                <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                            </button>
                        )}
                    </div>
                </div>

                {/* Section Header: CALL SCRIPTS */}
                <div style={{ padding: '8px 16px 4px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fas fa-thumbtack" style={{ fontSize: '10px', color: '#38bdf8' }}></i>
                        <span style={{ color: '#38bdf8' }}>CALL SCRIPTS</span>
                    </div>
                    <button 
                        onClick={() => setNewScriptModalOpen(true)}
                        style={{ border: 'none', background: 'transparent', color: '#38bdf8', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Add New Script"
                    >
                        <i className="fas fa-plus" style={{ fontSize: '10px' }}></i>
                        <span>New</span>
                    </button>
                </div>

                {/* Script Items List */}
                <div className="sidebar-script-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {filteredScripts.length === 0 ? (
                        <div style={{ padding: '20px 10px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                            No scripts found matching "{searchQuery}"
                        </div>
                    ) : (
                        filteredScripts.map(([key, script], idx) => {
                            const isActive = activeTab === 'scripts' && currentScriptKey === key;
                            const keyNum = idx < 9 ? idx + 1 : undefined;

                            return (
                                <div
                                    key={key}
                                    onClick={() => handleScriptSelect(key)}
                                    draggable={Boolean(onReorderScripts) && !reorderingScriptKey}
                                    onDragStart={(e) => {
                                        if (!onReorderScripts) return;
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', key);
                                        setDraggedScriptKey(key);
                                    }}
                                    onDragOver={(e) => {
                                        if (!draggedScriptKey || draggedScriptKey === key) return;
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        setDragOverScriptKey(key);
                                    }}
                                    onDragLeave={() => {
                                        if (dragOverScriptKey === key) setDragOverScriptKey(null);
                                    }}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        const sourceKey = e.dataTransfer.getData('text/plain') || draggedScriptKey;
                                        setDragOverScriptKey(null);
                                        setDraggedScriptKey(null);
                                        if (sourceKey) {
                                            try { await commitScriptReorder(sourceKey, key); }
                                            catch (error: any) { alert(error?.message || 'Unable to reorder the call scripts.'); }
                                        }
                                    }}
                                    onDragEnd={() => { setDraggedScriptKey(null); setDragOverScriptKey(null); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        borderRadius: '10px',
                                        background: isActive ? '#2563eb' : 'transparent',
                                        color: isActive ? '#ffffff' : '#cbd5e1',
                                        cursor: reorderingScriptKey ? 'wait' : 'pointer',
                                        opacity: reorderingScriptKey && reorderingScriptKey !== key ? 0.65 : 1,
                                        transition: 'all 0.15s ease',
                                        border: dragOverScriptKey === key ? '1px solid #38bdf8' : (isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent'),
                                        boxShadow: isActive ? '0 0 16px rgba(37, 99, 235, 0.45)' : 'none'
                                    }}
                                    className={`script-item-row ${isActive ? 'active-script' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}
                                >
                                    {/* Left: Drag dots + Name */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
                                        <i className="fas fa-grip-vertical" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#475569', fontSize: '11px', cursor: onReorderScripts ? 'grab' : 'default' }} title={onReorderScripts ? 'Drag to reorder' : undefined}></i>
                                        <span style={{
                                            fontSize: '12.5px',
                                            fontWeight: isActive ? 700 : 500,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            color: isActive ? '#ffffff' : '#cbd5e1'
                                        }}>
                                            {script.name}
                                        </span>
                                    </div>

                                    {/* Right: Star + Key Badge + Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                        {/* Star Favorite */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onToggleFavorite) onToggleFavorite(key);
                                                else {
                                                    void FirestoreService.saveScript(key, { ...script, favorite: !script.favorite }).catch((error: any) => {
                                                        console.error('Favorite update failed:', error);
                                                        alert(error?.message || 'Unable to update the script favorite. Please sign in and try again.');
                                                    });
                                                }
                                            }}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: (script.favorite || isActive) ? '#f59e0b' : '#475569', fontSize: '11px' }}
                                            title="Toggle Favorite"
                                        >
                                            <i className="fas fa-star"></i>
                                        </button>

                                        {/* Shortcut Key Badge */}
                                        {keyNum !== undefined && (
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 800,
                                                padding: '1px 5px',
                                                borderRadius: '5px',
                                                background: isActive ? 'rgba(0,0,0,0.35)' : '#121e33',
                                                color: isActive ? '#fff' : '#64748b',
                                                border: isActive ? 'none' : '1px solid #1a2944'
                                            }}>
                                                {keyNum}
                                            </span>
                                        )}

                                        {onReorderScripts && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }} onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => void moveScriptBy(key, -1)} aria-label={`Move ${script.name} up`} title="Move up" style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '2px 3px', fontSize: '9px' }}><i className="fas fa-chevron-up"></i></button>
                                                <button onClick={() => void moveScriptBy(key, 1)} aria-label={`Move ${script.name} down`} title="Move down" style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '2px 3px', fontSize: '9px' }}><i className="fas fa-chevron-down"></i></button>
                                            </div>
                                        )}

                                        {/* Edit Icon */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleScriptSelect(key);
                                                if (onEditScript) onEditScript(key);
                                            }}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: isActive ? 'rgba(255,255,255,0.85)' : '#475569', fontSize: '11px' }}
                                            title="Edit Script"
                                        >
                                            <i className="fas fa-edit"></i>
                                        </button>

                                        {/* Trash Delete Icon (only for custom scripts) */}
                                        {key !== 'opening' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Delete script "${script.name}"?`)) {
                                                        if (onDeleteScript) onDeleteScript(key);
                                                        else {
                                                            void FirestoreService.deleteScript(key).catch((error: any) => {
                                                                console.error('Delete script failed:', error);
                                                                alert(error?.message || 'Unable to delete the script. Please sign in and try again.');
                                                            });
                                                        }
                                                    }
                                                }}
                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: isActive ? 'rgba(255,255,255,0.6)' : '#475569', fontSize: '11px' }}
                                                title="Delete Script"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Real-time connection quality indicator */}
                <div className="sidebar-connection-area" aria-label="Real-time internet connection status">
                    <ConnectionStatus />
                </div>

                {/* Collapsible TOOLS & SETTINGS Section */}
                <div style={{ borderTop: '1px solid #0f1a2e', padding: '8px 12px' }}>
                    <button
                        onClick={() => setToolsExpanded(!toolsExpanded)}
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 4px',
                            color: '#94a3b8',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            borderRadius: '6px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fas fa-tools" style={{ color: '#06b6d4', fontSize: '12px' }}></i>
                            <span style={{ letterSpacing: '0.05em' }}>TOOLS & SETTINGS</span>
                        </div>
                        <i className={`fas fa-chevron-${toolsExpanded ? 'down' : 'right'}`} style={{ fontSize: '9px', color: '#64748b' }}></i>
                    </button>

                    {toolsExpanded && (
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '6px' }}>
                            <button
                                onClick={() => {
                                    if (onOpenActivities) onOpenActivities();
                                    else setActiveTab('calendar');
                                    if (window.innerWidth < 1024) setSidebarOpen(false);
                                }}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'calendar' ? '#1e293b' : 'transparent',
                                    color: activeTab === 'calendar' ? '#38bdf8' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-calendar-alt" style={{ width: '16px', color: '#38bdf8' }}></i>
                                <span style={{ flex: 1 }}>Activities</span>
                                {overdueCount > 0 && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); onOpenActivities?.('overdue'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpenActivities?.('overdue'); } }}
                                        title={`${overdueCount} overdue activities`}
                                        aria-label={`Open ${overdueCount} overdue activities`}
                                        style={{ background: '#3f1d1d', color: '#fca5a5', borderRadius: '999px', minWidth: '20px', height: '20px', padding: '0 6px', display: 'inline-grid', placeItems: 'center', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
                                    >{overdueCount}</span>
                                )}
                            </button>

                            <button
                                onClick={() => { setActiveTab('analytics'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'analytics' ? '#1e293b' : 'transparent',
                                    color: activeTab === 'analytics' ? '#38bdf8' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-chart-pie" style={{ width: '16px', color: '#8b5cf6' }}></i>
                                <span>Analytics Hub</span>
                            </button>

                            <button
                                onClick={() => { setActiveTab('tasks'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'tasks' ? '#1e293b' : 'transparent',
                                    color: activeTab === 'tasks' ? '#38bdf8' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-tasks" style={{ width: '16px', color: '#10b981' }}></i>
                                <span>Follow-Up Tasks</span>
                            </button>

                            <button
                                onClick={() => { setActiveTab('closers'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'closers' ? '#1e293b' : 'transparent',
                                    color: activeTab === 'closers' ? '#38bdf8' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-users-cog" style={{ width: '16px', color: '#f59e0b' }}></i>
                                <span>Closer Management</span>
                            </button>

                            <button
                                onClick={() => { setActiveTab('transcript'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'transcript' ? '#1e293b' : 'transparent',
                                    color: activeTab === 'transcript' ? '#38bdf8' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-headphones" style={{ width: '16px', color: '#ec4899' }}></i>
                                <span>Transcript Studio</span>
                            </button>

                            <button
                                onClick={onOpenSmartImport}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-file-import" style={{ width: '16px', color: '#38bdf8' }}></i>
                                <span>Smart Multi-Import</span>
                            </button>

                            <button
                                onClick={() => { setActiveTab('speedtest'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                                style={{
                                    border: 'none',
                                    background: activeTab === 'speedtest' ? '#1e293b' : 'transparent',
                                    color: activeTab === 'speedtest' ? '#38bdf8' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-gauge-high" style={{ width: '16px', color: '#22d3ee' }}></i>
                                <span>Speed Test</span>
                            </button>

                            <button
                                onClick={onOpenShortcuts}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <i className="fas fa-keyboard" style={{ width: '16px', color: '#64748b' }}></i>
                                <span>Shortcuts (Ctrl+Shift+?)</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Sidebar Footer Notice */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #162035', background: '#070b14', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <i className="fas fa-crown" style={{ color: '#eab308', fontSize: '12px' }}></i>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                        Press 1-9 to switch scripts
                    </span>
                </div>
            </aside>

            {/* Create Script Modal */}
            {newScriptModalOpen && (
                <div className="modal-overlay active" onClick={() => setNewScriptModalOpen(false)}>
                    <div className="modal-container active" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
                        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Create New Sales Script</h3>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>
                                    Script Title (e.g. 🎯 Follow Up Script)
                                </label>
                                <input 
                                    type="text"
                                    placeholder="Enter script title..."
                                    value={newScriptName}
                                    onChange={(e) => setNewScriptName(e.target.value)}
                                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #1e293b', background: '#0f172a', color: '#fff', fontSize: '14px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#94a3b8' }}>
                                    Script Body
                                </label>
                                <textarea
                                    placeholder="Enter your script lines... Use [Company Name] and [Name] for dynamic replacement."
                                    value={newScriptContent}
                                    onChange={(e) => setNewScriptContent(e.target.value)}
                                    rows={8}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', background: '#0f172a', color: '#fff', fontSize: '14px', lineHeight: '1.5' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="btn-secondary" onClick={() => setNewScriptModalOpen(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleCreateScript}>Create Script</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
