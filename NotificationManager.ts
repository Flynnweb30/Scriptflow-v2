import { AppNotification, Appointment } from '../types';
import { Utils } from '../utils/helpers';
import { TimezoneUtils } from '../utils/timezone-utils';

export const NotificationManager = {
    notifications: [] as AppNotification[],
    unreadCount: 0,

    loadNotifications(): AppNotification[] {
        try {
            const saved = localStorage.getItem('scriptflow_notifications');
            if (saved) {
                const data = JSON.parse(saved);
                this.notifications = data.notifications || [];
                this.unreadCount = this.notifications.filter(n => !n.read && !n.dismissed).length;
            }
        } catch (e) {
            console.warn('Failed to load notifications:', e);
            this.notifications = [];
            this.unreadCount = 0;
        }
        return this.notifications;
    },

    saveNotifications() {
        try {
            localStorage.setItem('scriptflow_notifications', JSON.stringify({
                notifications: this.notifications,
                lastUpdated: new Date().toISOString()
            }));
        } catch (e) {
            console.warn('Failed to save notifications:', e);
        }
    },

    addNotification(appt: Appointment, type: 'callback_due' | 'callback_completed' = 'callback_due'): AppNotification | null {
        if (!appt || !appt.id) return null;
        this.loadNotifications();

        const id = 'notif_' + Utils.generateId();
        const now = new Date().toISOString();

        const existing = this.notifications.find(n => n.appointmentId === appt.id && n.type === type && !n.dismissed);
        if (existing) {
            existing.timestamp = now;
            existing.read = false;
            existing.count = (existing.count || 1) + 1;
            this.saveNotifications();
            return existing;
        }

        const callbackTime = TimezoneUtils.calculateCallbackTime(appt);
        const formattedCallbackTime = callbackTime ? TimezoneUtils.formatCallbackTime(appt) : 'Not scheduled';

        const notif: AppNotification = {
            id,
            appointmentId: appt.id,
            type,
            business: appt.business || 'Unknown Business',
            contactName: appt.contactName || 'Unknown Contact',
            phone: appt.phone || '',
            email: appt.email || '',
            date: appt.date || '',
            time: appt.time || '',
            timezone: appt.timezone || 'Central CDT',
            callbackTime: callbackTime ? callbackTime.toISOString() : null,
            formattedCallbackTime,
            message: type === 'callback_due' ? `${appt.business} callback is due now.` : `${appt.business} callback completed.`,
            timestamp: now,
            read: false,
            dismissed: false,
            count: 1,
            createdAt: now
        };

        this.notifications.unshift(notif);
        this.unreadCount++;
        this.saveNotifications();
        this.playNotificationSound();
        return notif;
    },

    playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const notes = [800, 600];
            notes.forEach((freq, index) => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.frequency.value = freq;
                oscillator.type = 'sine';
                const startTime = audioCtx.currentTime + (index * 0.15);
                gainNode.gain.setValueAtTime(0.15, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
                oscillator.start(startTime);
                oscillator.stop(startTime + 0.15);
            });
        } catch (e) {
            // Audio error non-blocking
        }
    },

    markAsRead(id: string) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.read) {
            notif.read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.saveNotifications();
        }
    },

    markAllAsRead() {
        this.notifications.forEach(n => {
            if (!n.dismissed) n.read = true;
        });
        this.unreadCount = 0;
        this.saveNotifications();
    },

    dismissNotification(id: string) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif) {
            notif.dismissed = true;
            notif.read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.saveNotifications();
        }
    }
};
