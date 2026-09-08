import { User } from 'firebase/auth';

interface SessionData {
    userId: string;
    sessionId: string;
    startedAt: string;
    lastActive: string;
    device: string;
    browser: string;
    ip: string;
}

export class SessionManager {
    private static instance: SessionManager;
    private sessionData: SessionData | null = null;
    private readonly SESSION_KEY = 'scriptflow_session';
    private readonly SESSION_TIMEOUT = 30 * 60 * 1000;

    private constructor() {
        this.loadSession();
        this.setupActivityTracking();
    }

    static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    private loadSession(): void {
        try {
            const saved = localStorage.getItem(this.SESSION_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                const lastActive = new Date(data.lastActive).getTime();
                const now = Date.now();
                if (now - lastActive < this.SESSION_TIMEOUT) {
                    this.sessionData = data;
                } else {
                    this.clearSession();
                }
            }
        } catch (_) {
            this.sessionData = null;
        }
    }

    private setupActivityTracking(): void {
        const updateActivity = () => {
            if (this.sessionData) {
                this.sessionData.lastActive = new Date().toISOString();
                this.saveSession();
            }
        };

        const events = ['click', 'scroll', 'keydown', 'touchstart', 'mousemove'];
        events.forEach(event => {
            document.addEventListener(event, updateActivity);
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                updateActivity();
            }
        });
    }

    startSession(user: User): void {
        const browser = this.getBrowserInfo();
        const device = this.getDeviceInfo();

        this.sessionData = {
            userId: user.uid,
            sessionId: `${user.uid}_${Date.now()}`,
            startedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            device,
            browser,
            ip: 'unknown'
        };

        this.saveSession();
    }

    private saveSession(): void {
        if (this.sessionData) {
            try {
                localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
            } catch (_) {}
        }
    }

    clearSession(): void {
        this.sessionData = null;
        try {
            localStorage.removeItem(this.SESSION_KEY);
        } catch (_) {}
    }

    getSession(): SessionData | null {
        return this.sessionData;
    }

    isSessionValid(): boolean {
        if (!this.sessionData) return false;
        const lastActive = new Date(this.sessionData.lastActive).getTime();
        return Date.now() - lastActive < this.SESSION_TIMEOUT;
    }

    private getBrowserInfo(): string {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    private getDeviceInfo(): string {
        const ua = navigator.userAgent;
        if (ua.includes('Mobile')) return 'Mobile';
        if (ua.includes('Tablet')) return 'Tablet';
        return 'Desktop';
    }

    getSessionDuration(): number {
        if (!this.sessionData) return 0;
        const start = new Date(this.sessionData.startedAt).getTime();
        return Math.floor((Date.now() - start) / 1000 / 60);
    }
}

export default SessionManager;