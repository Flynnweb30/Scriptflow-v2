// ICS Calendar Sync
window.ICSCalendarSync = {
    exportToICS: function(appointments) {
        let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ScriptFlow Pro//EN\n";
        appointments.forEach(function(appt) {
            ics += "BEGIN:VEVENT\n";
            ics += "SUMMARY:" + (appt.business || 'Appointment') + " - " + (appt.contactName || '') + "\n";
            ics += "DESCRIPTION:" + (appt.notes || '') + "\n";
            if (appt.date) {
                var d = appt.date.replace(/-/g, '');
                ics += "DTSTART;VALUE=DATE:" + d + "\n";
                ics += "DTEND;VALUE=DATE:" + d + "\n";
            }
            ics += "STATUS:" + (appt.status || 'CONFIRMED') + "\n";
            ics += "END:VEVENT\n";
        });
        ics += "END:VCALENDAR";
        return ics;
    }
};
