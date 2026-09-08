export const LoadingManager = {
    state: {
        isVisible: true,
        progress: 0,
        steps: [
            { id: 'init', label: 'Initializing...', progress: 10 },
            { id: 'firebase', label: 'Connecting to Firebase...', progress: 25 },
            { id: 'auth', label: 'Checking authentication...', progress: 40 },
            { id: 'data', label: 'Loading your data...', progress: 60 },
            { id: 'scripts', label: 'Loading scripts...', progress: 75 },
            { id: 'calendar', label: 'Preparing calendar...', progress: 85 },
            { id: 'features', label: 'Loading features...', progress: 95 },
            { id: 'complete', label: 'Ready!', progress: 100 }
        ],
        currentStepIndex: 0,
        intervalId: null as any,
        onComplete: null as any,
        isComplete: false,
        isStarted: false,
        isHidden: false
    },

    init: function () {
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) {
            return this;
        }
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
        loadingScreen.style.visibility = 'visible';
        loadingScreen.style.pointerEvents = 'auto';
        this.updateProgress(0, 'Starting ScriptFlow Pro...');
        return this;
    },

    updateProgress: function (percent: number, message?: string) {
        const progressBar = document.getElementById('loadingProgress');
        const loadingSubtitle = document.querySelector('.loading-subtitle');
        if (progressBar) {
            progressBar.style.width = Math.min(percent, 100) + '%';
            progressBar.style.transition = 'width 0.5s ease';
        }
        if (loadingSubtitle && message) {
            loadingSubtitle.textContent = message;
        }
        this.state.progress = Math.min(percent, 100);
        return this;
    },

    complete: function () {
        if (this.state.isComplete || this.state.isHidden) return this;
        this.state.isComplete = true;
        const loadingScreen = document.getElementById('loadingScreen');
        const appWrapper = document.getElementById('appWrapper');
        this.updateProgress(100, 'Ready! 🚀');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.4s ease';
            loadingScreen.style.pointerEvents = 'none';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                loadingScreen.style.visibility = 'hidden';
                this.state.isHidden = true;
                this.state.isVisible = false;
            }, 450);
        }
        if (appWrapper) {
            appWrapper.style.display = 'flex';
            appWrapper.style.opacity = '1';
        }
        return this;
    },

    forceComplete: function () {
        const loadingScreen = document.getElementById('loadingScreen');
        const appWrapper = document.getElementById('appWrapper');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
            loadingScreen.style.visibility = 'hidden';
            loadingScreen.style.opacity = '0';
            this.state.isHidden = true;
            this.state.isVisible = false;
        }
        if (appWrapper) {
            appWrapper.style.display = 'flex';
            appWrapper.style.opacity = '1';
        }
        this.state.isComplete = true;
        return this;
    }
};
