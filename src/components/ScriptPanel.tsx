import React, { useState } from 'react';
import { Script } from '../types';
import { FirestoreService } from '../services/FirestoreService';
import { DEFAULT_SCRIPTS } from '../config/constants';

interface ScriptPanelProps {
    scripts: Record<string, Script>;
    currentScriptKey: string;
    setCurrentScriptKey: (key: string) => void;
    onToggleObjections: () => void;
    objectionsOpen: boolean;
}

export const ScriptPanel: React.FC<ScriptPanelProps> = ({
    scripts,
    currentScriptKey,
    setCurrentScriptKey,
    onToggleObjections,
    objectionsOpen
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [editedName, setEditedName] = useState('');
    const [copied, setCopied] = useState(false);
    
    // Live Replacement Variables
    const [companyName, setCompanyName] = useState('');
    const [contactName, setContactName] = useState('');
    const [repName, setRepName] = useState('Flynn');
    const [timeSlot, setTimeSlot] = useState('');
    const [showVariableBar, setShowVariableBar] = useState(false);

    const currentScript = scripts[currentScriptKey] || {
        name: '🎯 Opening Script',
        content: `3-2-1 Framework: 3 steps, 2 types, 1 thing\nCurious Tone + Smile and Dial\nWebsite Sample Appointment Script\n1. No Website — Primary Opener\n\nSetter:\n"Hi, is this [Company Name]?"\n\nHey, this is Flynn. I found your business online, and my team actually created a custom website sample for your business. It's already done. I was just wondering if you’d have a few moments today or tomorrow to take a quick look and maybe share your thoughts. "`,
        version: 1956,
        keyNumber: 1,
        favorite: true
    };

    const handleStartEdit = () => {
        setEditedName(currentScript.name);
        setEditedContent(currentScript.content);
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        const nextVersion = (currentScript.version || 1) + 1;
        const updated: Script = {
            ...currentScript,
            name: editedName.trim() || currentScript.name,
            content: editedContent,
            version: nextVersion
        };
        try {
            await FirestoreService.saveScript(currentScriptKey, updated);
            setIsEditing(false);
        } catch (error: any) {
            console.error('Script save failed:', error);
            alert(error?.message || 'Unable to save the script. Please sign in and try again.');
        }
    };

    const handleReset = async () => {
        if (confirm(`Reset "${currentScript.name}" to initial default template?`)) {
            const template = DEFAULT_SCRIPTS[currentScriptKey];
            if (!template) {
                alert('This script does not have a default template to reset.');
                return;
            }
            const nextVersion = (currentScript.version || 1) + 1;
            const updated: Script = {
                ...currentScript,
                name: template.name,
                content: template.content,
                favorite: template.favorite,
                keyNumber: template.keyNumber,
                version: nextVersion
            };
            try {
                await FirestoreService.saveScript(currentScriptKey, updated);
                setIsEditing(false);
            } catch (error: any) {
                console.error('Script reset failed:', error);
                alert(error?.message || 'Unable to reset the script. Please sign in and try again.');
            }
        }
    };

    const handleToggleFavorite = async () => {
        const updated: Script = {
            ...currentScript,
            favorite: !currentScript.favorite
        };
        try {
            await FirestoreService.saveScript(currentScriptKey, updated);
        } catch (error: any) {
            console.error('Script favorite update failed:', error);
            alert(error?.message || 'Unable to update the script favorite. Please sign in and try again.');
        }
    };

    const getProcessedContent = (raw: string) => {
        let text = raw;
        if (companyName) {
            text = text.replace(/\[Company Name\]/gi, companyName);
        }
        if (contactName) {
            text = text.replace(/\[Name\]/gi, contactName);
        }
        if (repName) {
            text = text.replace(/Flynn/g, repName);
        }
        if (timeSlot) {
            text = text.replace(/\[Time\]/gi, timeSlot);
        }
        return text;
    };

    const handleCopy = async () => {
        const text = getProcessedContent(currentScript.content);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Clipboard copy failed:', error);
            alert('Unable to copy the script. Please check browser clipboard permissions.');
        }
    };

    return (
        <div 
            style={{
                background: '#080e1e',
                border: '1px solid #142036',
                borderRadius: '24px',
                padding: '24px 28px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                position: 'relative'
            }}
        >
            {/* Header: Title + Version + Key + Action Buttons */}
            <div 
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    paddingBottom: '18px',
                    borderBottom: '1px solid #142036'
                }}
            >
                {/* Left side: Icon, Name, Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div 
                        style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: '#2563eb',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#fff',
                            fontSize: '16px',
                            boxShadow: '0 0 16px rgba(37, 99, 235, 0.35)'
                        }}
                    >
                        <i className="fas fa-bookmark"></i>
                    </div>

                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
                        {currentScript.name}
                    </h2>

                    {/* Version Badge */}
                    <div 
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '14px',
                            background: '#0d172c',
                            border: '1px solid #182846',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#94a3b8'
                        }}
                    >
                        <i className="far fa-clock" style={{ fontSize: '10px' }}></i>
                        <span>v {currentScript.version || 1957}</span>
                    </div>

                    {/* Key Badge */}
                    <div 
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '14px',
                            background: '#0d172c',
                            border: '1px solid #182846',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#94a3b8'
                        }}
                    >
                        <i className="fas fa-key" style={{ fontSize: '10px' }}></i>
                        <span>Key: {currentScript.keyNumber || 1}</span>
                    </div>
                </div>

                {/* Right side: Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Edit Button */}
                    {!isEditing ? (
                        <button
                            onClick={handleStartEdit}
                            style={{
                                padding: '5px 14px',
                                borderRadius: '20px',
                                background: '#0d172c',
                                border: '1px solid #182846',
                                color: '#f1f5f9',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease'
                            }}
                            className="hover:bg-slate-800 hover:border-slate-600"
                        >
                            <i className="fas fa-edit" style={{ fontSize: '11px', color: '#94a3b8' }}></i>
                            <span>Edit</span>
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                onClick={handleSaveEdit}
                                style={{
                                    padding: '5px 14px',
                                    borderRadius: '20px',
                                    background: '#2563eb',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <i className="fas fa-save" style={{ fontSize: '11px' }}></i>
                                <span>Save</span>
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                style={{
                                    padding: '5px 14px',
                                    borderRadius: '20px',
                                    background: '#1e293b',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Copy Button */}
                    <button
                        onClick={handleCopy}
                        style={{
                            padding: '5px 14px',
                            borderRadius: '20px',
                            background: '#0d172c',
                            border: '1px solid #182846',
                            color: copied ? '#10b981' : '#f1f5f9',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                        className="hover:bg-slate-800 hover:border-slate-600"
                    >
                        <i className={`fas fa-${copied ? 'check' : 'copy'}`} style={{ fontSize: '11px', color: copied ? '#10b981' : '#94a3b8' }}></i>
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    {/* Reset Button */}
                    <button
                        onClick={handleReset}
                        style={{
                            padding: '5px 14px',
                            borderRadius: '20px',
                            background: '#0d172c',
                            border: '1px solid #182846',
                            color: '#f1f5f9',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                        className="hover:bg-slate-800 hover:border-slate-600"
                        title="Reset Script"
                    >
                        <i className="fas fa-undo" style={{ fontSize: '11px', color: '#94a3b8' }}></i>
                        <span>Reset</span>
                    </button>

                    {/* Star Favorite Button */}
                    <button
                        onClick={handleToggleFavorite}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#0d172c',
                            border: '1px solid #182846',
                            color: currentScript.favorite ? '#f59e0b' : '#64748b',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                        className="hover:bg-slate-800 hover:border-slate-600"
                        title="Favorite"
                    >
                        <i className="fas fa-star" style={{ fontSize: '12px' }}></i>
                    </button>

                    {/* Objections Button - Updated for Sidebar Integration */}
                    <button
                        onClick={onToggleObjections}
                        style={{
                            padding: '6px 20px',
                            borderRadius: '20px',
                            background: objectionsOpen ? '#10b981' : '#7c3aed',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: objectionsOpen 
                                ? '0 0 16px rgba(16, 185, 129, 0.5)' 
                                : '0 0 16px rgba(124, 58, 237, 0.7)',
                            transition: 'all 0.2s ease'
                        }}
                        className="hover:opacity-90"
                    >
                        {objectionsOpen ? (
                            <>
                                <i className="fas fa-check-circle" style={{ fontSize: '13px' }}></i>
                                <span>Objections Open</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-shield-alt" style={{ fontSize: '13px' }}></i>
                                <span>Objections</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Quick Variable Bar Toggle */}
            <div style={{ margin: '14px 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={() => setShowVariableBar(!showVariableBar)}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#38bdf8',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: 0
                    }}
                >
                    <i className="fas fa-sliders-h"></i>
                    <span>{showVariableBar ? 'Hide Live Variables' : '⚡ Live Variable Inputs ([Company Name], Flynn, [Time])'}</span>
                </button>
            </div>

            {/* Live Variable Replacement Inputs */}
            {showVariableBar && (
                <div 
                    style={{
                        background: '#060b17',
                        border: '1px solid #142036',
                        borderRadius: '14px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px'
                    }}
                >
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                            [Company Name]
                        </label>
                        <input 
                            type="text"
                            placeholder="e.g. Apex Roofing"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #182846', background: '#091020', color: '#fff', fontSize: '12px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                            [Name]
                        </label>
                        <input 
                            type="text"
                            placeholder="e.g. John"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #182846', background: '#091020', color: '#fff', fontSize: '12px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                            Rep Name
                        </label>
                        <input 
                            type="text"
                            placeholder="Flynn"
                            value={repName}
                            onChange={(e) => setRepName(e.target.value)}
                            style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #182846', background: '#091020', color: '#fff', fontSize: '12px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                            [Time]
                        </label>
                        <input 
                            type="text"
                            placeholder="e.g. 2:00 PM"
                            value={timeSlot}
                            onChange={(e) => setTimeSlot(e.target.value)}
                            style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #182846', background: '#091020', color: '#fff', fontSize: '12px' }}
                        />
                    </div>
                </div>
            )}

            {/* Script Content Box */}
            <div style={{ marginTop: '16px', minHeight: '300px' }}>
                {isEditing ? (
                    <div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Script Name</label>
                            <input 
                                type="text" 
                                value={editedName} 
                                onChange={(e) => setEditedName(e.target.value)} 
                                style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #182846', background: '#091020', color: '#fff', fontSize: '14px' }}
                            />
                        </div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Script Body</label>
                        <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            rows={14}
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid #182846',
                                background: '#091020',
                                color: '#f1f5f9',
                                fontSize: '15px',
                                lineHeight: '1.65',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                ) : (
                    <div 
                        style={{
                            fontSize: '16px',
                            lineHeight: '1.8',
                            color: '#e2e8f0',
                            whiteSpace: 'pre-wrap',
                            fontWeight: 400,
                            letterSpacing: '0.01em'
                        }}
                    >
                        {getProcessedContent(currentScript.content)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptPanel;