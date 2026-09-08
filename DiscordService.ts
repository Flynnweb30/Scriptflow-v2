import { Appointment } from '../types';
import { DISCORD_CONFIG, getDiscordWebhookUrl, isValidDiscordWebhook } from '../config/discord-config';
import { Utils } from '../utils/helpers';

interface DiscordEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

interface DiscordEmbed {
    title: string;
    description?: string;
    color: number;
    fields: DiscordEmbedField[];
    timestamp: string;
    footer?: {
        text: string;
        icon_url?: string;
    };
}

interface DiscordWebhookPayload {
    content?: string;
    username?: string;
    avatar_url?: string;
    embeds?: DiscordEmbed[];
}

export class DiscordService {
    private static webhookUrl: string | null = getDiscordWebhookUrl();

    static isEnabled(): boolean {
        return DISCORD_CONFIG.ENABLED && (this.webhookUrl !== null || DISCORD_CONFIG.SIMULATE_WITHOUT_WEBHOOK);
    }

    static isWebhookConfigured(): boolean {
        return this.webhookUrl !== null && isValidDiscordWebhook(this.webhookUrl);
    }

    // Format appointment for Discord display
    private static formatAppointmentForDiscord(appointment: Appointment): string {
        const lines = [
            '═══════════════════════════════════════════',
            '📋 APPOINTMENT DETAILS',
            '═══════════════════════════════════════════',
            '',
            `🏢 Business Name: ${appointment.business || 'N/A'}`,
            `👤 Contact Name: ${appointment.contactName || 'N/A'}`,
            `💼 Role: ${appointment.role || 'N/A'}`,
            `📞 Phone Number: ${appointment.phone || 'N/A'}`,
            `📅 Demo Time & Date: ${this.formatDateTime(appointment)}`,
            `✉️ Email: ${appointment.email || 'N/A'}`,
            '',
            '📊 Additional Details:',
            `   Status: ${appointment.status || 'Pending'}`,
            `   Closer: ${appointment.closer || 'Unassigned'}`,
            `   Lead Score: ${Utils.calculateLeadScore(appointment)}/100`,
            '',
            `📝 Notes: ${appointment.notes || 'No notes provided'}`,
            '',
            '═══════════════════════════════════════════',
            `💬 Synced by @flynn30 • ScriptFlow Pro`,
        ];
        return lines.join('\n');
    }

    // Format date/time for display
    private static formatDateTime(appointment: Appointment): string {
        if (!appointment.date && !appointment.time) return 'Not scheduled';
        
        try {
            const dateObj = new Date(appointment.date);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            return `${formattedDate} at ${appointment.time || 'TBD'} ${appointment.timezone || ''}`;
        } catch {
            return `${appointment.date || 'TBD'} at ${appointment.time || 'TBD'}`;
        }
    }

    // Generate Discord embed for appointment
    private static generateAppointmentEmbed(appointment: Appointment): DiscordEmbed {
        const score = Utils.calculateLeadScore(appointment);
        const isHot = score >= 70;
        
        return {
            title: `📋 ${isHot ? '🔥' : '📞'} New Appointment: ${appointment.business}`,
            color: isHot ? 0xdc2626 : 0x5865F2,
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: '🏢 Business',
                    value: appointment.business || 'N/A',
                    inline: true
                },
                {
                    name: '👤 Contact',
                    value: appointment.contactName || 'N/A',
                    inline: true
                },
                {
                    name: '💼 Role',
                    value: appointment.role || 'N/A',
                    inline: true
                },
                {
                    name: '📞 Phone',
                    value: appointment.phone || 'N/A',
                    inline: true
                },
                {
                    name: '✉️ Email',
                    value: appointment.email || 'N/A',
                    inline: true
                },
                {
                    name: '📅 Demo Time',
                    value: this.formatDateTime(appointment),
                    inline: false
                },
                {
                    name: '⭐ Lead Score',
                    value: `${score}/100 - ${isHot ? '🔥 Hot Lead' : score >= 40 ? '📊 Warm Lead' : '📉 Cold Lead'}`,
                    inline: true
                },
                {
                    name: '📊 Status',
                    value: appointment.status || 'Pending',
                    inline: true
                },
                {
                    name: '🎯 Closer',
                    value: appointment.closer || 'Unassigned',
                    inline: true
                }
            ],
            footer: {
                text: 'Synced by @flynn30 • ScriptFlow Pro',
                icon_url: DISCORD_CONFIG.AVATAR_URL
            }
        };
    }

    // Sync a single appointment to Discord
    static async syncAppointmentToDiscord(appointment: Appointment): Promise<{ success: boolean; message: string; preview?: string }> {
        const previewText = this.formatAppointmentForDiscord(appointment);

        // If webhook is configured, send it
        if (this.webhookUrl && isValidDiscordWebhook(this.webhookUrl)) {
            try {
                const embed = this.generateAppointmentEmbed(appointment);
                const payload: DiscordWebhookPayload = {
                    username: DISCORD_CONFIG.USERNAME,
                    avatar_url: DISCORD_CONFIG.AVATAR_URL,
                    embeds: [embed]
                };

                const response = await fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Discord API error: ${response.status} - ${errorText}`);
                }

                return {
                    success: true,
                    message: `✅ Appointment for "${appointment.business}" sent to Discord!`,
                    preview: previewText
                };
            } catch (error: any) {
                console.error('Discord sync error:', error);
                return {
                    success: false,
                    message: `❌ Failed to send to Discord: ${error.message}`,
                    preview: previewText
                };
            }
        }

        // No webhook - use preview mode
        return {
            success: true,
            message: `📋 Preview: Appointment "${appointment.business}" (No Discord webhook configured)`,
            preview: previewText
        };
    }

    // Sync all appointments to Discord
    static async syncAllAppointmentsToDiscord(appointments: Appointment[]): Promise<{ 
        success: boolean; 
        message: string; 
        preview?: string;
        syncedCount: number;
    }> {
        if (appointments.length === 0) {
            return {
                success: true,
                message: '📋 No appointments to sync',
                syncedCount: 0,
                preview: 'No appointments found to sync.'
            };
        }

        // Build a combined report
        const lines = [
            '═══════════════════════════════════════════',
            '📊 SCRIPTFLOW PRO - ALL APPOINTMENTS',
            '═══════════════════════════════════════════',
            '',
            `📈 Total Appointments: ${appointments.length}`,
            '',
            '📋 APPOINTMENTS LIST:',
            ''
        ];

        appointments.forEach((appt, index) => {
            lines.push(`🔹 Appointment #${index + 1}`);
            lines.push(`   🏢 Business: ${appt.business || 'N/A'}`);
            lines.push(`   👤 Contact: ${appt.contactName || 'N/A'}`);
            lines.push(`   💼 Role: ${appt.role || 'N/A'}`);
            lines.push(`   📞 Phone: ${appt.phone || 'N/A'}`);
            lines.push(`   📅 Date/Time: ${this.formatDateTime(appt)}`);
            lines.push(`   ✉️ Email: ${appt.email || 'N/A'}`);
            lines.push(`   📊 Status: ${appt.status || 'Pending'}`);
            lines.push(`   ⭐ Score: ${Utils.calculateLeadScore(appt)}/100`);
            lines.push(`   🎯 Closer: ${appt.closer || 'Unassigned'}`);
            lines.push(`   📝 Notes: ${appt.notes || 'No notes'}`);
            lines.push('');
        });

        lines.push('═══════════════════════════════════════════');
        lines.push(`💬 Synced by @flynn30 • ${appointments.length} appointments synced`);
        lines.push('📋 To send to Discord, configure your webhook URL');

        const previewText = lines.join('\n');

        // If webhook is configured, send all appointments
        if (this.webhookUrl && isValidDiscordWebhook(this.webhookUrl)) {
            try {
                // Send first appointment as detailed embed
                if (appointments.length > 0) {
                    const firstEmbed = this.generateAppointmentEmbed(appointments[0]);
                    const payload: DiscordWebhookPayload = {
                        username: DISCORD_CONFIG.USERNAME,
                        avatar_url: DISCORD_CONFIG.AVATAR_URL,
                        content: `📊 **${appointments.length} Appointments Synced**`,
                        embeds: [firstEmbed]
                    };

                    const response = await fetch(this.webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Discord API error: ${response.status} - ${errorText}`);
                    }

                    // Send remaining appointments as separate messages (chunked)
                    for (let i = 1; i < appointments.length; i++) {
                        const embed = this.generateAppointmentEmbed(appointments[i]);
                        const chunkPayload: DiscordWebhookPayload = {
                            username: DISCORD_CONFIG.USERNAME,
                            avatar_url: DISCORD_CONFIG.AVATAR_URL,
                            embeds: [embed]
                        };
                        await fetch(this.webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(chunkPayload)
                        });
                        // Rate limiting delay
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    return {
                        success: true,
                        message: `✅ All ${appointments.length} appointments synced to Discord!`,
                        preview: previewText,
                        syncedCount: appointments.length
                    };
                }
            } catch (error: any) {
                console.error('Discord sync error:', error);
                return {
                    success: false,
                    message: `❌ Failed to sync to Discord: ${error.message}`,
                    preview: previewText,
                    syncedCount: 0
                };
            }
        }

        // Preview mode
        return {
            success: true,
            message: `📋 Preview: ${appointments.length} appointments ready (No Discord webhook configured)`,
            preview: previewText,
            syncedCount: appointments.length
        };
    }

    // Sync analytics report to Discord
    static async sendAnalyticsReport(
        appointments: Appointment[],
        metrics: {
            total: number;
            hotTransfers: number;
            warmCallbacks: number;
            meetingsBooked: number;
            completed: number;
            noShows: number;
            rescheduled: number;
            pending: number;
            canceled: number;
            showRate: number;
            noShowRate: number;
            rescheduleRate: number;
            conversionRate: number;
            per100Calls: number;
            avgQuality: number;
            resolved: number;
            totalBookings: number;
        },
        preset: string,
        selectedAgent: string
    ): Promise<{ success: boolean; preview?: string; message: string }> {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        const embed: DiscordEmbed = {
            title: '📊 ScriptFlow Pro Analytics Report',
            color: 0x5865F2,
            timestamp: now.toISOString(),
            fields: [
                {
                    name: '📈 Overview',
                    value: [
                        `**Total Appointments:** ${metrics.total}`,
                        `**Booked:** ${metrics.meetingsBooked}`,
                        `**Completed:** ${metrics.completed}`,
                        `**Resolved:** ${metrics.resolved}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📊 Performance',
                    value: [
                        `**Show Rate:** ${metrics.showRate}%`,
                        `**No-Show Rate:** ${metrics.noShowRate}%`,
                        `**Reschedule Rate:** ${metrics.rescheduleRate}%`,
                        `**Conversion Rate:** ${metrics.conversionRate}%`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📋 Status Breakdown',
                    value: [
                        `**Hot Transfers:** ${metrics.hotTransfers}`,
                        `**Warm Callbacks:** ${metrics.warmCallbacks}`,
                        `**Pending:** ${metrics.pending}`,
                        `**Canceled:** ${metrics.canceled}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⭐ Quality Metrics',
                    value: [
                        `**Avg Quality Score:** ${metrics.avgQuality}/10`,
                        `**Per 100 Calls:** ${metrics.per100Calls}`,
                        `**Total Leads:** ${metrics.total}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📅 Report Period',
                    value: `**${preset.charAt(0).toUpperCase() + preset.slice(1)}** • ${dateStr} • ${timeStr}`,
                    inline: false
                },
                {
                    name: '👤 Agent Filter',
                    value: selectedAgent === 'all' ? 'All Agents' : selectedAgent,
                    inline: true
                }
            ],
            footer: {
                text: 'Synced by @flynn30 • ScriptFlow Pro',
                icon_url: DISCORD_CONFIG.AVATAR_URL
            }
        };

        const previewText = this.generatePreviewText(embed, dateStr, timeStr, metrics, preset, selectedAgent);

        if (this.webhookUrl && isValidDiscordWebhook(this.webhookUrl)) {
            try {
                const payload: DiscordWebhookPayload = {
                    username: DISCORD_CONFIG.USERNAME,
                    avatar_url: DISCORD_CONFIG.AVATAR_URL,
                    embeds: [embed]
                };

                const response = await fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`Discord API error: ${response.status}`);
                }

                return {
                    success: true,
                    message: '✅ Report sent to Discord successfully!',
                    preview: previewText
                };
            } catch (error: any) {
                return {
                    success: false,
                    message: `❌ Failed to send: ${error.message}`,
                    preview: previewText
                };
            }
        }

        return {
            success: true,
            message: '📋 Preview Mode: Report generated (No Discord webhook configured)',
            preview: previewText
        };
    }

    private static generatePreviewText(embed: DiscordEmbed, dateStr: string, timeStr: string, metrics: any, preset: string, selectedAgent: string): string {
        const lines = [
            '═══════════════════════════════════════════',
            '📊 SCRIPTFLOW PRO ANALYTICS REPORT',
            '═══════════════════════════════════════════',
            '',
            '📈 OVERVIEW',
            `   Total Appointments: ${metrics.total}`,
            `   Booked: ${metrics.meetingsBooked}`,
            `   Completed: ${metrics.completed}`,
            `   Resolved: ${metrics.resolved}`,
            '',
            '📊 PERFORMANCE',
            `   Show Rate: ${metrics.showRate}%`,
            `   No-Show Rate: ${metrics.noShowRate}%`,
            `   Reschedule Rate: ${metrics.rescheduleRate}%`,
            `   Conversion Rate: ${metrics.conversionRate}%`,
            '',
            '📋 STATUS BREAKDOWN',
            `   Hot Transfers: ${metrics.hotTransfers}`,
            `   Warm Callbacks: ${metrics.warmCallbacks}`,
            `   Pending: ${metrics.pending}`,
            `   Canceled: ${metrics.canceled}`,
            '',
            '⭐ QUALITY METRICS',
            `   Avg Quality Score: ${metrics.avgQuality}/10`,
            `   Per 100 Calls: ${metrics.per100Calls}`,
            `   Total Leads: ${metrics.total}`,
            '',
            '📅 REPORT PERIOD',
            `   ${preset.charAt(0).toUpperCase() + preset.slice(1)} • ${dateStr} • ${timeStr}`,
            '',
            '👤 AGENT FILTER',
            `   ${selectedAgent === 'all' ? 'All Agents' : selectedAgent}`,
            '',
            '═══════════════════════════════════════════',
            '💬 Synced by @flynn30 • ScriptFlow Pro',
        ];
        return lines.join('\n');
    }

}

export default DiscordService;