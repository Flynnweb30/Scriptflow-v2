// Transcript Studio
window.TranscriptStudio = {
    extractBookingData: function(text) {
        return window.extractBookingData ? window.extractBookingData(text) : null;
    }
};
