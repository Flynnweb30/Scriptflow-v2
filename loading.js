// Loading Manager for ScriptFlow Pro
window.LoadingManager = {
    state: {
        isVisible: true,
        progress: 0,
        currentStepIndex: 0,
        isComplete: false,
        isHidden: false
    },
    init: function() {
        var screen = document.getElementById('loadingScreen');
        if (screen) {
            screen.style.display = 'flex';
            screen.style.opacity = '1';
        }
        this.updateProgress(20, 'Initializing ScriptFlow Pro...');
        return this;
    },
    updateProgress: function(percent, message) {
        var bar = document.getElementById('loadingProgress');
        var sub = document.querySelector('.loading-subtitle');
        if (bar) bar.style.width = Math.min(percent, 100) + '%';
        if (sub && message) sub.textContent = message;
        this.state.progress = percent;
        return this;
    },
    complete: function() {
        if (this.state.isComplete) return this;
        this.state.isComplete = true;
        var screen = document.getElementById('loadingScreen');
        var app = document.getElementById('appWrapper');
        this.updateProgress(100, 'Ready! 🚀');
        if (screen) {
            screen.style.opacity = '0';
            setTimeout(function() {
                screen.style.display = 'none';
            }, 400);
        }
        if (app) {
            app.style.display = 'flex';
            app.style.opacity = '1';
        }
        return this;
    }
};
