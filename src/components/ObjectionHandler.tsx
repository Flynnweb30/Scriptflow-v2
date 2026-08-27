import React, { useState, useMemo, useRef, useEffect } from 'react';
import { OBJECTION_CATEGORIES } from '../config/constants';

interface Objection {
    id: string;
    objection: string;
    response: string;
    tip: string;
    categoryKey: string;
    categoryLabel: string;
    categoryColor: string;
    categoryIcon: string;
}

interface ObjectionHandlerProps {
    isOpen?: boolean;
    onClose?: () => void;
    triggerButton?: boolean;
}

export const ObjectionHandler: React.FC<ObjectionHandlerProps> = ({ 
    isOpen: externalIsOpen, 
    onClose,
    triggerButton = false // Disabled - no floating button
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('objection_favorites');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('objection_recently_used');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [activeObjectionId, setActiveObjectionId] = useState<string | null>(null);
    const [quickSelectOpen, setQuickSelectOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
    const setIsOpen = (value: boolean) => {
        if (externalIsOpen !== undefined) {
            if (!value && onClose) onClose();
        } else {
            setInternalIsOpen(value);
        }
    };

    const allObjections: Objection[] = useMemo(() => {
        const result: Objection[] = [];
        Object.entries(OBJECTION_CATEGORIES).forEach(([catKey, cat]) => {
            cat.objections.forEach(obj => {
                result.push({
                    ...obj,
                    categoryKey: catKey,
                    categoryLabel: cat.label,
                    categoryColor: cat.color,
                    categoryIcon: cat.icon || '💬'
                });
            });
        });
        return result;
    }, []);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allObjections.forEach(obj => {
            counts[obj.categoryKey] = (counts[obj.categoryKey] || 0) + 1;
        });
        return counts;
    }, [allObjections]);

    const filteredObjections = useMemo(() => {
        let filtered = allObjections;
        if (showFavoritesOnly) {
            filtered = filtered.filter(obj => favorites.includes(obj.id));
        }
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(obj => obj.categoryKey === selectedCategory);
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(obj =>
                obj.objection.toLowerCase().includes(term) ||
                obj.response.toLowerCase().includes(term) ||
                obj.tip.toLowerCase().includes(term) ||
                obj.categoryLabel.toLowerCase().includes(term)
            );
        }
        return filtered.sort((a, b) => {
            const aFav = favorites.includes(a.id) ? 0 : 1;
            const bFav = favorites.includes(b.id) ? 0 : 1;
            if (aFav !== bFav) return aFav - bFav;
            return a.objection.localeCompare(b.objection);
        });
    }, [allObjections, favorites, showFavoritesOnly, selectedCategory, searchTerm]);

    const recentObjections = useMemo(() => {
        return allObjections
            .filter(obj => recentlyUsed.includes(obj.id))
            .slice(0, 5);
    }, [allObjections, recentlyUsed]);

    const quickSelectCategories = useMemo(() => {
        const cats = Object.entries(OBJECTION_CATEGORIES).map(([key, cat]) => ({
            key,
            label: cat.label,
            icon: cat.icon || '💬',
            color: cat.color,
            count: categoryCounts[key] || 0
        }));
        return [
            { key: 'all', label: 'All Rebuttals', icon: '⚡', color: '#38bdf8', count: allObjections.length },
            ...cats
        ];
    }, [allObjections.length, categoryCounts]);

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
            if (!recentlyUsed.includes(id)) {
                const updated = [id, ...recentlyUsed.filter(r => r !== id)].slice(0, 10);
                setRecentlyUsed(updated);
                localStorage.setItem('objection_recently_used', JSON.stringify(updated));
            }
        });
    };

    const toggleFavorite = (id: string) => {
        const updated = favorites.includes(id)
            ? favorites.filter(f => f !== id)
            : [...favorites, id];
        setFavorites(updated);
        localStorage.setItem('objection_favorites', JSON.stringify(updated));
    };

    const activateObjection = (id: string) => {
        const obj = allObjections.find(o => o.id === id);
        if (obj) {
            setActiveObjectionId(id);
            if (!recentlyUsed.includes(id)) {
                const updated = [id, ...recentlyUsed.filter(r => r !== id)].slice(0, 10);
                setRecentlyUsed(updated);
                localStorage.setItem('objection_recently_used', JSON.stringify(updated));
            }
            navigator.clipboard.writeText(obj.response);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && isOpen) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                searchInputRef.current?.blur();
                setQuickSelectOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <>
            {/* Sidebar Overlay */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 9998,
                        animation: 'fadeIn 0.2s ease'
                    }}
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    right: isOpen ? 0 : '-480px',
                    width: 'min(480px, 92vw)',
                    height: '100vh',
                    background: '#0d1527',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
                    zIndex: 9999,
                    transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: '#090e1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '14px',
                            color: '#fff'
                        }}>
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                                Objection Handler
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                {filteredObjections.length} rebuttals • {favorites.length} favorites
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'transparent',
                            color: '#94a3b8',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                        className="hover:bg-slate-700/30 hover:text-white"
                    >
                        <i className="fas fa-times" style={{ fontSize: '13px' }}></i>
                    </button>
                </div>

                {/* Toolbar */}
                <div style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                    flexShrink: 0
                }}>
                    <button
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: '1px solid',
                            borderColor: showFavoritesOnly ? '#f59e0b' : 'rgba(255,255,255,0.06)',
                            background: showFavoritesOnly ? 'rgba(245,158,11,0.1)' : 'transparent',
                            color: showFavoritesOnly ? '#f59e0b' : '#94a3b8',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <i className="fas fa-star"></i>
                        <span>{favorites.length}</span>
                    </button>

                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setQuickSelectOpen(!quickSelectOpen)}
                            style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'transparent',
                                color: '#94a3b8',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            className="hover:bg-slate-700/20"
                        >
                            <i className="fas fa-bolt"></i>
                            <span>Quick</span>
                            <i className={`fas fa-chevron-${quickSelectOpen ? 'up' : 'down'}`} style={{ fontSize: '7px' }}></i>
                        </button>
                        {quickSelectOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '28px',
                                left: 0,
                                width: '180px',
                                background: '#0f172a',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '8px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                zIndex: 10,
                                overflow: 'hidden',
                                padding: '4px 0',
                                animation: 'slideDown 0.15s ease'
                            }}>
                                {quickSelectCategories.map(cat => (
                                    <button
                                        key={cat.key}
                                        onClick={() => {
                                            setSelectedCategory(cat.key);
                                            setQuickSelectOpen(false);
                                            if (cat.key === 'all') setShowFavoritesOnly(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '5px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: selectedCategory === cat.key ? 'rgba(56,189,248,0.06)' : 'transparent',
                                            border: 'none',
                                            color: selectedCategory === cat.key ? '#38bdf8' : '#e2e8f0',
                                            fontSize: '11px',
                                            fontWeight: selectedCategory === cat.key ? 700 : 500,
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                        className="hover:bg-slate-700/20"
                                    >
                                        <span>{cat.icon}</span>
                                        <span style={{ flex: 1 }}>{cat.label}</span>
                                        <span style={{
                                            fontSize: '9px',
                                            color: '#64748b',
                                            background: 'rgba(255,255,255,0.04)',
                                            padding: '0 6px',
                                            borderRadius: '6px'
                                        }}>
                                            {cat.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div style={{
                    padding: '8px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    flexShrink: 0
                }}>
                    <div style={{ position: 'relative' }}>
                        <i className="fas fa-search" style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#475569',
                            fontSize: '12px'
                        }}></i>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search objections... (Ctrl+K)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                height: '32px',
                                padding: '0 10px 0 32px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(255,255,255,0.02)',
                                color: '#f8fafc',
                                fontSize: '12px',
                                outline: 'none',
                                transition: 'border-color 0.15s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#475569',
                                    cursor: 'pointer'
                                }}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Pills */}
                <div style={{
                    padding: '6px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    gap: '4px',
                    overflowX: 'auto',
                    flexShrink: 0,
                    scrollbarWidth: 'none'
                }}>
                    <button
                        onClick={() => { setSelectedCategory('all'); setShowFavoritesOnly(false); }}
                        style={{
                            padding: '2px 10px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: selectedCategory === 'all' && !showFavoritesOnly ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                            background: selectedCategory === 'all' && !showFavoritesOnly ? 'rgba(56,189,248,0.1)' : 'transparent',
                            color: selectedCategory === 'all' && !showFavoritesOnly ? '#38bdf8' : '#94a3b8',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        All
                    </button>
                    {Object.entries(OBJECTION_CATEGORIES).map(([key, cat]) => (
                        <button
                            key={key}
                            onClick={() => { setSelectedCategory(key); setShowFavoritesOnly(false); }}
                            style={{
                                padding: '2px 10px',
                                borderRadius: '10px',
                                border: '1px solid',
                                borderColor: selectedCategory === key ? cat.color : 'rgba(255,255,255,0.06)',
                                background: selectedCategory === key ? `${cat.color}15` : 'transparent',
                                color: selectedCategory === key ? cat.color : '#94a3b8',
                                fontSize: '10px',
                                fontWeight: selectedCategory === key ? 700 : 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                {/* Recently Used */}
                {recentObjections.length > 0 && !searchTerm && selectedCategory === 'all' && !showFavoritesOnly && (
                    <div style={{
                        padding: '6px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        flexShrink: 0
                    }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            <i className="fas fa-clock" style={{ marginRight: '4px' }}></i>
                            Recent
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {recentObjections.map(obj => (
                                <button
                                    key={obj.id}
                                    onClick={() => activateObjection(obj.id)}
                                    style={{
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        background: activeObjectionId === obj.id ? 'rgba(16,185,129,0.1)' : 'transparent',
                                        color: activeObjectionId === obj.id ? '#10b981' : '#e2e8f0',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    className="hover:bg-slate-700/20"
                                >
                                    <span>{obj.categoryIcon}</span>
                                    <span>{obj.objection.length > 20 ? obj.objection.slice(0, 20) + '...' : obj.objection}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results Count */}
                <div style={{
                    padding: '4px 16px',
                    fontSize: '10px',
                    color: '#64748b',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span>{filteredObjections.length} results</span>
                    {showFavoritesOnly && <span style={{ color: '#f59e0b' }}>⭐</span>}
                    {selectedCategory !== 'all' && (
                        <span style={{
                            padding: '0 6px',
                            borderRadius: '6px',
                            background: 'rgba(56,189,248,0.06)',
                            color: '#38bdf8',
                            fontSize: '9px'
                        }}>
                            {Object.entries(OBJECTION_CATEGORIES).find(([key]) => key === selectedCategory)?.[1]?.label || selectedCategory}
                        </span>
                    )}
                    {activeObjectionId && <span style={{ color: '#10b981' }}>🟢 Active</span>}
                </div>

                {/* Objection List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px 12px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    {filteredObjections.length === 0 ? (
                        <div style={{ padding: '30px 10px', textAlign: 'center', color: '#64748b' }}>
                            <i className="fas fa-search" style={{ fontSize: '24px', display: 'block', marginBottom: '8px', opacity: 0.3 }}></i>
                            <p style={{ fontSize: '12px', margin: 0 }}>No results found</p>
                        </div>
                    ) : (
                        filteredObjections.map(item => {
                            const isExpanded = expandedId === item.id;
                            const isFavorite = favorites.includes(item.id);
                            const isCopied = copiedId === item.id;
                            const isActive = activeObjectionId === item.id;

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        background: isActive ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.01)',
                                        border: `1px solid ${isActive ? '#10b981' : isExpanded ? item.categoryColor : 'rgba(255,255,255,0.04)'}`,
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div
                                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                        style={{
                                            padding: '6px 10px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                        className="hover:bg-slate-700/10"
                                    >
                                        <div style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            background: isActive ? 'rgba(16,185,129,0.12)' : `${item.categoryColor}15`,
                                            color: isActive ? '#10b981' : item.categoryColor,
                                            display: 'grid',
                                            placeItems: 'center',
                                            fontSize: '11px',
                                            flexShrink: 0
                                        }}>
                                            {item.categoryIcon}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: isActive ? '#10b981' : '#f8fafc',
                                                lineHeight: '1.3',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {item.objection}
                                            </div>
                                            <div style={{ fontSize: '9px', color: '#64748b', display: 'flex', gap: '4px' }}>
                                                <span style={{ color: item.categoryColor }}>{item.categoryLabel}</span>
                                                {isFavorite && <span style={{ color: '#f59e0b' }}>★</span>}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); activateObjection(item.id); }}
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    border: isActive ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.06)',
                                                    background: isActive ? 'rgba(16,185,129,0.1)' : 'transparent',
                                                    color: isActive ? '#10b981' : '#94a3b8',
                                                    fontSize: '9px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                                className="hover:bg-slate-700/20"
                                            >
                                                <i className={`fas fa-${isActive ? 'check-circle' : 'play'}`}></i>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                                                style={{
                                                    padding: '2px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: isFavorite ? '#f59e0b' : '#475569',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <i className={`fas fa-${isFavorite ? 'star' : 'star'}`} style={{ fontSize: '10px' }}></i>
                                            </button>
                                            <div style={{
                                                width: '18px',
                                                height: '18px',
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: '#475569',
                                                fontSize: '10px',
                                                transition: 'transform 0.15s ease',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                            }}>
                                                <i className="fas fa-chevron-down"></i>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ padding: '0 10px 8px 10px', animation: 'fadeIn 0.15s ease' }}>
                                            <div style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                borderRadius: '6px',
                                                padding: '6px 10px',
                                                marginBottom: '6px',
                                                borderLeft: `2px solid ${item.categoryColor}`
                                            }}>
                                                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Response
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#e2e8f0', lineHeight: '1.4' }}>
                                                    "{item.response}"
                                                </div>
                                            </div>
                                            {item.tip && (
                                                <div style={{
                                                    background: 'rgba(245,158,11,0.04)',
                                                    borderRadius: '6px',
                                                    padding: '4px 10px',
                                                    marginBottom: '6px',
                                                    borderLeft: '2px solid #f59e0b'
                                                }}>
                                                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
                                                        <i className="fas fa-lightbulb" style={{ marginRight: '4px' }}></i>Tip
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.tip}</div>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={() => handleCopy(item.id, item.response)}
                                                    style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        background: isCopied ? 'rgba(16,185,129,0.1)' : 'transparent',
                                                        color: isCopied ? '#10b981' : '#94a3b8',
                                                        fontSize: '9px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <i className={`fas fa-${isCopied ? 'check' : 'copy'}`}></i>
                                                    {isCopied ? 'Copied!' : 'Copy'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const text = `Objection: ${item.objection}\nResponse: "${item.response}"\nTip: ${item.tip}`;
                                                        handleCopy(`full_${item.id}`, text);
                                                    }}
                                                    style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        background: 'transparent',
                                                        color: '#94a3b8',
                                                        fontSize: '9px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                    className="hover:bg-slate-700/20"
                                                >
                                                    <i className="fas fa-copy"></i> All
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '6px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    background: '#090e1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    fontSize: '9px',
                    color: '#64748b'
                }}>
                    <span><kbd style={{ padding: '1px 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', fontSize: '8px' }}>ESC</kbd> close</span>
                    <span><kbd style={{ padding: '1px 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', fontSize: '8px' }}>Ctrl+K</kbd> search</span>
                    <span>{favorites.length} ★</span>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .hover\\:bg-slate-700\\/20:hover { background: rgba(51,65,85,0.2); }
                .hover\\:bg-slate-700\\/30:hover { background: rgba(51,65,85,0.3); }
                .hover\\:bg-slate-800:hover { background: #1e293b; }
                .hover\\:text-white:hover { color: #ffffff; }
            `}</style>
        </>
    );
};

export default ObjectionHandler;