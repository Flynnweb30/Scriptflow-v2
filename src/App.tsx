import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Appointment, Script, Task, Closer, AppNotification } from './types';
import { DEFAULT_SCRIPTS, CONFIG } from './config/constants';
import { TimezoneUtils } from './utils/timezone-utils';
import { LoadingManager } from './managers/LoadingManager';
import { NotificationManager } from './managers/NotificationManager';
import { AuthService } from './services/AuthService';
import { FirestoreService } from './services/FirestoreService';
import { WorkspaceService } from './services/WorkspaceService';

// Components
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ScriptPanel } from './components/ScriptPanel';
import { ObjectionHandler } from './components/ObjectionHandler';
import { CalendarView } from './components/CalendarView';
import { FollowUpTasks } from './components/FollowUpTasks';
import { AnalyticsHub } from './components/AnalyticsHub';
import { CloserManagement } from './components/CloserManagement';
import { TranscriptStudio } from './components/TranscriptStudio';

// Modals
import { SmartImportModal } from './components/SmartImportModal';
import { AppointmentDetailModal } from './components/AppointmentDetailModal';
import { QuickAddModal } from './components/QuickAddModal';
import { BulkActionsModal } from './components/BulkActionsModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { AuthModal } from './components/AuthModal';
import { CallbackDueModal } from './components/CallbackDueModal';
import { HistoryModal } from './components/HistoryModal';
import { BrandMark } from './components/ui/BrandMark';
import { USTimezoneBar } from './components/USTimezoneBar';
import { SpeedTest } from './components/SpeedTest';

export const App: React.FC = () => {
    // Navigation & UI State
    const [activeTab, setActiveTab] = useState<'scripts' | 'calendar' | 'analytics' | 'tasks' | 'closers' | 'transcript' | 'speedtest'>('scripts');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [currentScriptKey, setCurrentScriptKey] = useState<string>('opening');
    const [objectionsOpen, setObjectionsOpen] = useState(false);

    // Data State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [scripts, setScripts] = useState<Record<string, Script>>(DEFAULT_SCRIPTS);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [closers, setClosers] = useState<Closer[]>(CONFIG.DEFAULT_CLOSERS);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal Visibility State
    const [smartImportOpen, setSmartImportOpen] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [quickAddDate, setQuickAddDate] = useState<string | undefined>(undefined);
    const [quickAddStatus, setQuickAddStatus] = useState<string | undefined>(undefined);
    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
    const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [callbackDueModalOpen, setCallbackDueModalOpen] = useState(false);
    const [callbackDueNotif, setCallbackDueNotif] = useState<AppNotification | null>(null);
    const [callbackDueAppt, setCallbackDueAppt] = useState<Appointment | null>(null);
    const [activitiesInitialPreset, setActivitiesInitialPreset] = useState<'todo' | 'overdue'>('todo');

    // Initial app/auth lifecycle. Workspace listeners are created only after Firebase
    // restores the session, preventing unauthenticated permission-denied queries.
    useEffect(() => {
        LoadingManager.init();
        LoadingManager.updateProgress(15, 'Restoring your secure session...');

        const savedTheme = localStorage.getItem('scriptflow_theme');
        const dark = savedTheme !== 'light';
        setIsDarkMode(dark);
        document.body.classList.toggle('dark-theme', dark);
        document.body.classList.toggle('light-theme', !dark);

        let dataCleanups: Array<() => void> = [];

        const stopDataSubscriptions = () => {
            dataCleanups.forEach((cleanup) => cleanup());
            dataCleanups = [];
        };

        const subscribeWorkspace = (user: User) => {
            stopDataSubscriptions();
            setIsLoading(true);
            LoadingManager.updateProgress(45, 'Loading your workspace...');

            dataCleanups = [
                FirestoreService.subscribeAppointments(
                    (data) => {
                        setAppointments(data);
                        setIsLoading(false);
                    },
                    (err) => console.warn('Appointments subscription:', err?.message || err),
                ),
                FirestoreService.subscribeScripts(
                    (data) => setScripts({ ...DEFAULT_SCRIPTS, ...data }),
                    (err) => console.warn('Scripts subscription:', err?.message || err),
                ),
                FirestoreService.subscribeTasks(
                    (data) => setTasks(data),
                    (err) => console.warn('Tasks subscription:', err?.message || err),
                ),
                FirestoreService.subscribeClosers(
                    (data) => setClosers(data),
                    (err) => console.warn('Closers subscription:', err?.message || err),
                ),
            ];

            LoadingManager.updateProgress(
                90,
                `Welcome${user.displayName ? `, ${user.displayName}` : ''}!`,
            );
            window.setTimeout(() => LoadingManager.complete(), 250);
        };

        const unsubscribeAuth = AuthService.onAuthChanged((user) => {
            setCurrentUser(user);
            setAuthReady(true);

            if (user) {
                subscribeWorkspace(user);
            } else {
                stopDataSubscriptions();
                setAppointments([]);
                setTasks([]);
                setScripts(DEFAULT_SCRIPTS);
                setClosers(CONFIG.DEFAULT_CLOSERS);
                setIsLoading(false);
                LoadingManager.updateProgress(100, 'Ready. Sign in to access your workspace.');
                window.setTimeout(() => LoadingManager.complete(), 150);
            }
        });

        return () => {
            stopDataSubscriptions();
            unsubscribeAuth();
        };
    }, []);

    useEffect(() => {
        setNotifications(NotificationManager.loadNotifications());
    }, [currentUser]);

    // Theme Toggle Handler
    const handleToggleTheme = () => {
        const next = !isDarkMode;
        setIsDarkMode(next);
        if (next) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
            localStorage.setItem('scriptflow_theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('scriptflow_theme', 'light');
        }
    };

    // Callback Trigger Polling
    useEffect(() => {
        const interval = setInterval(() => {
            appointments.forEach(appt => {
                if (TimezoneUtils.isCallbackDue(appt)) {
                    const notif = NotificationManager.addNotification(appt, 'callback_due');
                    if (notif) {
                        setNotifications([...NotificationManager.notifications]);
                        setCallbackDueNotif(notif);
                        setCallbackDueAppt(appt);
                        setCallbackDueModalOpen(true);
                        void FirestoreService.saveAppointment({ ...appt, callbackTriggered: true }).catch((error: any) => {
                            console.warn('Callback status sync skipped:', error?.message || error);
                        });
                    }
                }
            });
        }, 30000);

        return () => clearInterval(interval);
    }, [appointments]);

    // Keyboard Shortcuts & Number Key Script Switchers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElem = document.activeElement;
            const isTyping = activeElem && (
                activeElem.tagName === 'INPUT' || 
                activeElem.tagName === 'TEXTAREA' || 
                (activeElem as HTMLElement).isContentEditable
            );

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            if (isCtrlOrCmd && e.shiftKey) {
                const key = e.key.toUpperCase();
                if (key === 'I') { e.preventDefault(); setSmartImportOpen(true); }
                else if (key === 'C') { e.preventDefault(); setActiveTab('calendar'); }
                else if (key === 'S') { e.preventDefault(); setActiveTab('scripts'); }
                else if (key === 'F') { e.preventDefault(); setGlobalSearchOpen(true); }
                else if (key === 'A') { e.preventDefault(); setQuickAddDate(undefined); setQuickAddOpen(true); }
                else if (key === 'H') { e.preventDefault(); setActiveTab('analytics'); }
                else if (key === 'M') { e.preventDefault(); setActiveTab('closers'); }
                else if (key === '?' || key === '/') { e.preventDefault(); setShortcutsOpen(true); }
                else if (key === 'E') { e.preventDefault(); WorkspaceService.downloadCSV(appointments); }
                else if (key === 'T') { e.preventDefault(); handleToggleTheme(); }
                else if (key === 'R') { e.preventDefault(); setNotifications(NotificationManager.loadNotifications()); }
                else if (key === 'B') { e.preventDefault(); setBulkActionsOpen(true); }
            } else if (e.key === 'Escape') {
                setSmartImportOpen(false);
                setQuickAddOpen(false);
                setSelectedAppt(null);
                setBulkActionsOpen(false);
                setGlobalSearchOpen(false);
                setShortcutsOpen(false);
                setAuthModalOpen(false);
                setHistoryModalOpen(false);
                setCallbackDueModalOpen(false);
                setObjectionsOpen(false);
            } else if (!isTyping && !isCtrlOrCmd && !e.altKey) {
                const num = parseInt(e.key, 10);
                if (!isNaN(num) && num >= 1 && num <= 9) {
                    const scriptEntries = (Object.entries(scripts) as [string, Script][])
                        .sort(([keyA, a], [keyB, b]) => {
                            const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number(a.keyNumber ?? Number.MAX_SAFE_INTEGER);
                            const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number(b.keyNumber ?? Number.MAX_SAFE_INTEGER);
                            return orderA !== orderB ? orderA - orderB : keyA.localeCompare(keyB);
                        });
                    const matched = scriptEntries.find(([_, s], idx) => s.keyNumber === num || idx === num - 1);
                    if (matched) {
                        e.preventDefault();
                        setCurrentScriptKey(matched[0]);
                        setActiveTab('scripts');
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [appointments, scripts, isDarkMode]);

    const handleOpenQuickAdd = useCallback((date?: string, defaultStatus?: string) => {
        setQuickAddDate(date);
        setQuickAddStatus(defaultStatus);
        setQuickAddOpen(true);
    }, []);

    const handleLogout = async () => {
        await AuthService.logout();
        setCurrentUser(null);
    };

    if (!authReady || isLoading) {
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '100vh',
                background: '#030712'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <BrandMark size="lg" className="mx-auto" />
                    <div style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600 }}>Loading ScriptFlow Pro...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container" style={{ minHeight: '100vh', background: '#090d16', display: 'flex' }}>
            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                onOpenSmartImport={() => setSmartImportOpen(true)}
                onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
                onOpenQuickAdd={() => handleOpenQuickAdd()}
                onOpenShortcuts={() => setShortcutsOpen(true)}
                onOpenAuthModal={() => setAuthModalOpen(true)}
                currentUser={currentUser}
                onLogout={handleLogout}
                scripts={scripts}
                currentScriptKey={currentScriptKey}
                setCurrentScriptKey={setCurrentScriptKey}
                onToggleFavorite={async (key) => {
                    const s = scripts[key];
                    if (s) {
                        try {
                            await FirestoreService.saveScript(key, { ...s, favorite: !s.favorite });
                        } catch (error: any) {
                            console.error('Sidebar favorite update failed:', error);
                            alert(error?.message || 'Unable to update the script favorite. Please sign in and try again.');
                        }
                    }
                }}
                onReorderScripts={async (orderedKeys) => {
                    await FirestoreService.reorderScripts(orderedKeys);
                }}
                appointments={appointments}
                onOpenActivities={(preset) => {
                    setActivitiesInitialPreset(preset === 'overdue' ? 'overdue' : 'todo');
                    setActiveTab('calendar');
                }}
            />

            {/* Main Content Area */}
            <USTimezoneBar />
            <main 
                className="main-content"
                style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '74px 24px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    background: '#090d16'
                }}
            >
                {/* Top Metrics & Action Bar */}
                <TopBar
                    appointments={appointments}
                    tasks={tasks}
                    notifications={notifications}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    sidebarOpen={sidebarOpen}
                    onRefresh={() => setNotifications(NotificationManager.loadNotifications())}
                    onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
                    onOpenSmartImport={() => setSmartImportOpen(true)}
                    onOpenBulkActions={() => setBulkActionsOpen(true)}
                    onOpenHistory={() => setHistoryModalOpen(true)}
                    onDownloadCSV={() => WorkspaceService.downloadCSV(appointments)}
                    onOpenNotificationDetail={(notif) => {
                        const matched = appointments.find(a => a.id === notif.appointmentId);
                        if (matched) {
                            setSelectedAppt(matched);
                        } else {
                            setCallbackDueNotif(notif);
                            setCallbackDueModalOpen(true);
                        }
                    }}
                    onNotificationChange={() => setNotifications([...NotificationManager.notifications])}
                />

                {/* Viewport Content */}
                <div className="content-viewport" style={{ flex: 1, minWidth: 0 }}>
                    {activeTab === 'scripts' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <ScriptPanel
                                scripts={scripts}
                                currentScriptKey={currentScriptKey}
                                setCurrentScriptKey={setCurrentScriptKey}
                                onToggleObjections={() => setObjectionsOpen(!objectionsOpen)}
                                objectionsOpen={objectionsOpen}
                            />
                            
                            <ObjectionHandler
                                isOpen={objectionsOpen}
                                onClose={() => setObjectionsOpen(false)}
                                triggerButton={false}
                            />
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        <CalendarView
                            appointments={appointments}
                            closers={closers}
                            onSelectAppointment={(appt) => setSelectedAppt(appt)}
                            onOpenQuickAdd={handleOpenQuickAdd}
                            onOpenSmartImport={() => setSmartImportOpen(true)}
                            onOpenBulkActions={() => setBulkActionsOpen(true)}
                            initialListPreset={activitiesInitialPreset}
                        />
                    )}

                    {activeTab === 'analytics' && (
                        <AnalyticsHub appointments={appointments} tasks={tasks} closers={closers} />
                    )}

                    {activeTab === 'tasks' && (
                        <FollowUpTasks
                            tasks={tasks}
                            appointments={appointments}
                            onSelectAppointment={(appt) => setSelectedAppt(appt)}
                        />
                    )}

                    {activeTab === 'closers' && (
                        <CloserManagement closers={closers} />
                    )}

                    {activeTab === 'transcript' && (
                        <TranscriptStudio
                            closers={closers}
                            onAppointmentCreated={(appt) => {
                                setSelectedAppt(appt);
                                setActiveTab('calendar');
                            }}
                        />
                    )}

                    {activeTab === 'speedtest' && <SpeedTest />}
                </div>
            </main>

            {/* Modals */}
            <SmartImportModal
                isOpen={smartImportOpen}
                onClose={() => setSmartImportOpen(false)}
                appointments={appointments}
                closers={closers}
                onImportComplete={() => {
                    setNotifications(NotificationManager.loadNotifications());
                }}
            />

            <QuickAddModal
                isOpen={quickAddOpen}
                defaultDate={quickAddDate}
                defaultStatus={quickAddStatus}
                onClose={() => {
                    setQuickAddOpen(false);
                    setQuickAddStatus(undefined);
                }}
                closers={closers}
                onCreated={(appt) => {
                    setSelectedAppt(appt);
                    setActiveTab('calendar');
                }}
            />

            <AppointmentDetailModal
                appointment={selectedAppt}
                closers={closers}
                isOpen={!!selectedAppt}
                onClose={() => setSelectedAppt(null)}
                onSave={(updated) => {
                    setSelectedAppt(updated);
                }}
                onDelete={() => setSelectedAppt(null)}
            />

            <BulkActionsModal
                isOpen={bulkActionsOpen}
                appointments={appointments}
                onClose={() => setBulkActionsOpen(false)}
                closers={closers}
                onUpdateComplete={() => {}}
            />

            <GlobalSearchModal
                isOpen={globalSearchOpen}
                onClose={() => setGlobalSearchOpen(false)}
                appointments={appointments}
                scripts={scripts}
                onSelectAppointment={(appt) => setSelectedAppt(appt)}
                onSelectScript={(key) => {
                    setCurrentScriptKey(key);
                    setActiveTab('scripts');
                }}
            />

            <HistoryModal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                appointments={appointments}
            />

            <ShortcutsModal
                isOpen={shortcutsOpen}
                onClose={() => setShortcutsOpen(false)}
            />

            <AuthModal
                isOpen={authModalOpen}
                currentUser={currentUser}
                onClose={() => setAuthModalOpen(false)}
                onSuccess={() => {}}
            />

            <CallbackDueModal
                isOpen={callbackDueModalOpen}
                notification={callbackDueNotif}
                appointment={callbackDueAppt}
                onClose={() => {
                    setCallbackDueModalOpen(false);
                    setCallbackDueNotif(null);
                    setCallbackDueAppt(null);
                }}
                onViewAppointment={(appt) => setSelectedAppt(appt)}
                onMarkCompleted={async (appt) => {
                    await FirestoreService.saveAppointment({ ...appt, status: 'Completed' });
                }}
            />
        </div>
    );
};

export default App;