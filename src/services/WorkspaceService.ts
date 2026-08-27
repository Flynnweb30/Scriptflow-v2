import { Appointment, Task } from '../types';
import { Utils } from '../utils/helpers';

export const WorkspaceService = {
    // Export appointments to CSV format for Google Sheets / Excel
    exportToCSV(appointments: Appointment[]): string {
        const headers = [
            'ID',
            'Business Name',
            'Contact Name',
            'Role',
            'Phone',
            'Email',
            'Date',
            'Created At',
            'Time',
            'Timezone',
            'Status',
            'Assigned Agent',
            'Closer',
            'Lead Score',
            'Tags',
            'Notes'
        ];

        const rows = appointments.map(a => [
            `"${a.id}"`,
            `"${(a.business || '').replace(/"/g, '""')}"`,
            `"${(a.contactName || '').replace(/"/g, '""')}"`,
            `"${(a.role || '').replace(/"/g, '""')}"`,
            `"${(a.phone || '').replace(/"/g, '""')}"`,
            `"${(a.email || '').replace(/"/g, '""')}"`,
            `"${a.date || ''}"`,
            `"${a.createdAt ? (Utils.getAppointmentCreatedAt(a)?.toISOString() || String(a.createdAt)) : ''}"`,
            `"${a.time || ''}"`,
            `"${a.timezone || ''}"`,
            `"${a.status || ''}"`,
            `"${(a.assigned || '').replace(/"/g, '""')}"`,
            `"${(a.closer || '').replace(/"/g, '""')}"`,
            `"${Utils.calculateLeadScore(a)}"`,
            `"${(a.tags || []).join(', ')}"`,
            `"${(a.notes || '').replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    },

    downloadCSV(appointments: Appointment[], filename = 'scriptflow_appointments.csv') {
        const csv = this.exportToCSV(appointments);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Export appointments to ICS format (Google Calendar, iCal, Outlook)
    exportToICS(appointments: Appointment[]): string {
        let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ScriptFlow Pro//Appointment Calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";

        appointments.forEach(appt => {
            if (!appt.date) return;
            const uid = appt.icsUid || appt.id || Utils.generateId();
            const dateNormalized = appt.date.replace(/-/g, '');
            const nextDate = new Date(`${appt.date}T00:00:00`);
            nextDate.setDate(nextDate.getDate() + 1);
            const dateEndNormalized = [nextDate.getFullYear(), String(nextDate.getMonth() + 1).padStart(2, '0'), String(nextDate.getDate()).padStart(2, '0')].join('');
            ics += "BEGIN:VEVENT\r\n";
            ics += `UID:${uid}@scriptflowpro.app\r\n`;
            ics += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\r\n`;
            ics += `DTSTART;VALUE=DATE:${dateNormalized}\r\n`;
            ics += `DTEND;VALUE=DATE:${dateEndNormalized}\r\n`;
            ics += `SUMMARY:${appt.business || 'Client Appointment'} - ${appt.contactName || ''}\r\n`;
            ics += `DESCRIPTION:${(appt.notes || '').replace(/\n/g, '\\n')} | Status: ${appt.status || ''} | Phone: ${appt.phone || ''}\r\n`;
            ics += `STATUS:${appt.status === 'Canceled' ? 'CANCELLED' : 'CONFIRMED'}\r\n`;
            ics += "END:VEVENT\r\n";
        });

        ics += "END:VCALENDAR\r\n";
        return ics;
    },

    downloadICS(appointments: Appointment[], filename = 'scriptflow_calendar.ics') {
        const ics = this.exportToICS(appointments);
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Google Tasks Quick Sync Payload
    exportToTasksJSON(tasks: Task[]): string {
        return JSON.stringify(tasks.map(t => ({
            title: t.description,
            due: t.dueDate ? new Date(t.dueDate).toISOString() : null,
            status: t.completed ? 'completed' : 'needsAction'
        })), null, 2);
    },

    // Gmail Web Link for Direct Callback / Email outreach
    createGmailComposeUrl(email: string, subject: string, body: string): string {
        const encodedEmail = encodeURIComponent(email);
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}&body=${encodedBody}`;
    },

    // Google Calendar Event Link
    createGoogleCalendarUrl(appt: Appointment): string {
        const title = encodeURIComponent(`${appt.business} - ${appt.contactName || 'Demo Walkthrough'}`);
        const details = encodeURIComponent(`Contact: ${appt.contactName}\nPhone: ${appt.phone}\nStatus: ${appt.status}\nNotes:\n${appt.notes || ''}`);
        let datesParam = '';
        if (appt.date) {
            const d = appt.date.replace(/-/g, '');
            datesParam = `&dates=${d}/${d}`;
        }
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}${datesParam}`;
    }
};
