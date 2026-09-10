export const CONFIG = {
    PRIMARY_STATUSES: ['New Lead', 'Attempted', 'Meeting Booked', 'Hot Transfer', 'Warm Callback', 'Completed', 'Pending', 'Canceled'],
    SECONDARY_STATUSES: ['Meeting Booked', 'Rescheduled', 'Overdue', 'Held'],
    STATUS_OPTIONS: ['New Lead', 'Attempted', 'Meeting Booked', 'Hot Transfer', 'Warm Callback', 'Completed', 'Pending', 'Canceled', 'Rescheduled', 'Overdue', 'Held', 'No Show', 'Quarantined'],
    STATUS_COLORS: {
        'New Lead': '#64748b',
        'Attempted': '#f59e0b',
        'Hot Transfer': '#dc2626',
        'Warm Callback': '#eab308',
        'Completed': '#10b981',
        'Pending': '#94a3b8',
        'Canceled': '#ef4444',
        'Meeting Booked': '#3b82f6',
        'Rescheduled': '#f97316',
        'Overdue': '#8b5cf6',
        'Held': '#06b6d4',
        'No Show': '#ef4444',
        'Quarantined': '#f59e0b'
    } as Record<string, string>,
    TAG_OPTIONS: [
        { id: 'qualified_warm_call', name: 'Qualified Warm Call', color: '#10b981' },
        { id: 'unqualified_warm_callback', name: 'Unqualified Warm Callback', color: '#f59e0b' },
        { id: 'vip', name: 'VIP', color: '#3b82f6' },
        { id: 'negligent_warm_callback', name: 'Negligent Warm Callback', color: '#ef4444' },
        { id: 'no_show', name: 'No Show', color: '#ef4444' }
    ],
    DEFAULT_TEAM_MEMBERS: [
        { id: 'daniel', name: 'Daniel', role: 'Team Lead', email: 'daniel@company.com', phone: '+1-555-0101', avatar: '👨‍💼', color: '#3b82f6', active: true },
        { id: 'sarah', name: 'Sarah', role: 'Senior Agent', email: 'sarah@company.com', phone: '+1-555-0102', avatar: '👩‍💼', color: '#8b5cf6', active: true },
        { id: 'mike', name: 'Mike', role: 'Agent', email: 'mike@company.com', phone: '+1-555-0103', avatar: '👨‍💻', color: '#10b981', active: true },
        { id: 'jessica', name: 'Jessica', role: 'Agent', email: 'jessica@company.com', phone: '+1-555-0104', avatar: '👩‍💻', color: '#f59e0b', active: true },
        { id: 'david', name: 'David', role: 'Junior Agent', email: 'david@company.com', phone: '+1-555-0105', avatar: '👨‍🎓', color: '#ef4444', active: true }
    ],
    DEFAULT_CLOSERS: [
        { id: 'kailan', name: 'Kailan', email: 'kailan@company.com', phone: '+1-555-0201', active: true, default: true },
        { id: 'seif', name: 'Seif', email: 'seif@company.com', phone: '+1-555-0202', active: true, default: false },
        { id: 'seun', name: 'Seun', email: 'seun@company.com', phone: '+1-555-0203', active: true, default: false }
    ],
    DEFAULT_SHORTCUTS: {
        'Smart Import': { keys: ['Ctrl', 'Shift', 'I'], description: 'Open Smart Import modal' },
        'Appointment Calendar': { keys: ['Ctrl', 'Shift', 'C'], description: 'Open Appointment Calendar' },
        'Call Scripts': { keys: ['Ctrl', 'Shift', 'S'], description: 'Open Call Scripts' },
        'Global Search': { keys: ['Ctrl', 'Shift', 'F'], description: 'Open Global Search' },
        'Quick Add Appointment': { keys: ['Ctrl', 'Shift', 'A'], description: 'Quick Add Appointment' },
        'Analytics Hub': { keys: ['Ctrl', 'Shift', 'H'], description: 'Open Analytics Hub' },
        'Closer Management': { keys: ['Ctrl', 'Shift', 'M'], description: 'Open Closer Management' },
        'Keyboard Shortcuts': { keys: ['Ctrl', 'Shift', '?'], description: 'Open Keyboard Shortcuts' },
        'Export to CSV': { keys: ['Ctrl', 'Shift', 'E'], description: 'Export data to CSV' },
        'Toggle Theme': { keys: ['Ctrl', 'Shift', 'T'], description: 'Toggle Dark/Light Mode' },
        'Refresh Data': { keys: ['Ctrl', 'Shift', 'R'], description: 'Refresh data from server' },
        'Bulk Actions': { keys: ['Ctrl', 'Shift', 'B'], description: 'Open Bulk Actions' },
        'Close Panel': { keys: ['Escape'], description: 'Close current panel and return to scripts' }
    } as Record<string, { keys: string[]; description: string }>,
    CALLBACK_OPTIONS: [
        { value: 'none', label: 'None' },
        { value: '24h', label: '24 hours before' },
        { value: '4h', label: '4 hours before' },
        { value: '1h', label: '1 hour before' },
        { value: 'custom', label: 'Custom' }
    ]
};

export const SMART_IMPORT_CONFIG = {
    CONFIDENCE: {
        HIGH: 0.8,
        MEDIUM: 0.5,
        LOW: 0.3
    },
    VALIDATION: {
        name: { required: true, minLength: 2, maxLength: 100 },
        business: { required: true, minLength: 2, maxLength: 100 },
        phone: { pattern: /^[\+\d\s\-\(\)]{7,20}$/ },
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        time: { pattern: /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i },
        date: { pattern: /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$|^\d{4}-\d{2}-\d{2}$|^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/ },
        status: { allowed: ['Hot Transfer', 'Warm Callback', 'Completed', 'Pending', 'Canceled', 'Meeting Booked', 'Rescheduled', 'Overdue', 'Held', 'No Show', 'Quarantined'] }
    },
    FIELD_ALIASES: {
        name: ['name', 'full name', 'contact name', 'client name', 'customer name', 'person name', 'first name', 'last name', 'contact', 'client', 'customer', 'person', 'prospect', 'lead name'],
        business: ['business', 'company', 'organization', 'org', 'firm', 'brand', 'store', 'business name', 'company name', 'organization name', 'account', 'client company'],
        phone: ['phone', 'mobile', 'cell', 'telephone', 'number', 'contact number', 'phone number', 'mobile number', 'phone no', 'cell phone', 'work phone', 'home phone'],
        email: ['email', 'e-mail', 'mail', 'email address', 'e-mail address', 'contact email', 'work email', 'personal email', 'business email', 'company email', 'primary email'],
        date: ['date', 'appointment date', 'schedule date', 'meeting date', 'call date', 'day', 'best time', 'callback date', 'scheduled date', 'event date', 'when'],
        time: ['time', 'appointment time', 'schedule time', 'meeting time', 'call time', 'hour', 'callback time', 'scheduled time', 'event time', 'at', 'when'],
        status: ['status', 'state', 'stage', 'lead status', 'appointment status', 'call status', 'phase', 'step'],
        notes: ['notes', 'note', 'comment', 'remarks', 'additional notes', 'info', 'details', 'description', 'summary', 'observation', 'feedback'],
        assigned: ['assigned', 'assigned to', 'owner', 'agent', 'representative', 'rep', 'assigned agent', 'team member', 'handler', 'manager'],
        role: ['role', 'title', 'position', 'job title', 'designation', 'function', 'department'],
        closer: ['closer', 'closer name', 'booking agent', 'demo closer', 'appointment closer', 'closer assigned', 'demo closer name'],
        timezone: ['timezone', 'tz', 'zone', 'time zone', 'local time', 'area', 'region'],
        demoDateTime: ['demo time & date', 'demo date & time', 'demo datetime', 'demo date time', 'meeting date & time', 'meeting time & date', 'appointment date & time', 'appointment time & date', 'scheduled date & time', 'scheduled time & date', 'date & time', 'datetime', 'event date & time']
    } as Record<string, string[]>
};

export const OBJECTION_CATEGORIES = {
    reflex: {
        label: 'Reflex Brush-Offs',
        icon: '🔄',
        color: '#f59e0b',
        objections: [
            {
                id: 'not_interested',
                objection: '"I\'m not interested."',
                response: "I totally understand, I'm not trying to sell you anything. The website is already built and it's yours to look at for free.",
                tip: "Take the pressure off immediately. Remind them it's free and already done."
            },
            {
                id: 'too_busy',
                objection: '"I\'m too busy."',
                response: "Totally get it, I don't want to take up your time right now. I just wanted to show it to you another day, it would only take like 10 minutes.",
                tip: "Acknowledge their time constraints while keeping the door open for a quick 10-minute look."
            },
            {
                id: 'send_info',
                objection: '"Just send me the info."',
                response: "I could send you some info about the offer, but honestly you should take a look for yourself, the website looks great. It only takes 10 minutes.",
                tip: "Gently steer them toward seeing it themselves rather than just reading about it."
            },
            {
                id: 'email_website',
                objection: '"Can you just email me the website?"',
                response: "I'd love to, but the website isn't online yet, right now it's just a file on our end. The only way to actually show it to you is to share my screen, and it only takes 10 minutes.",
                tip: "Explain why screen sharing is necessary while emphasizing the short time commitment."
            },
            {
                id: 'call_back_later',
                objection: '"Call me back later."',
                response: "Sure. Just so I'm not calling back and forth, can we lock in a specific time that works for you?",
                tip: 'Convert a vague "later" into a concrete appointment.'
            }
        ]
    },
    existing: {
        label: '"We Don\'t Need It"',
        icon: '💼',
        color: '#3b82f6',
        objections: [
            {
                id: 'already_website',
                objection: '"We already have a website."',
                response: "Oh nice, when was it last updated? We actually put together a modern version specifically for your business, might be worth a quick look to compare.",
                tip: "Acknowledge their existing site while highlighting the value of a comparison."
            },
            {
                id: 'no_website_needed',
                objection: '"We don\'t need a website."',
                response: "Totally fair, but it's not really about the website, it's about more jobs. A good site gets you found by more people and brings in more work. You're not saying no to more customers, right? And it's free to take a look.",
                tip: 'Reframe the conversation from "website" to "more jobs" and "more customers."'
            },
            {
                id: 'do_it_myself',
                objection: '"I\'ll do it myself."',
                response: "That's great. How long have you been planning to? What if it was basically done for you by the end of this week?",
                tip: "Challenge their timeline gently while offering a faster alternative."
            },
            {
                id: 'have_designer',
                objection: '"We already have a web designer."',
                response: "Right, isn't it better to have options? There's a big difference between just getting a website and getting one done well, and the look costs you nothing.",
                tip: "Position your offer as a free option to compare against their current designer."
            },
            {
                id: 'someone_working',
                objection: '"We have someone working on it."',
                response: "Awesome, then you should definitely take a look. Worst case, you get some inspiration or get to compare the two. But I bet you're going to like ours better, and if you do, we can work together.",
                tip: "Use friendly competition to pique their interest in seeing your work."
            },
            {
                id: 'word_of_mouth',
                objection: '"Word of mouth is enough."',
                response: "Word of mouth is great, it means you do solid work. But it only reaches people who already know you. A website puts you in front of everyone searching for what you do right now, that's a whole stream of new jobs you're missing. And it's free to take a look.",
                tip: "Acknowledge their success while showing the untapped potential of a website."
            },
            {
                id: 'too_small',
                objection: '"We\'re too small."',
                response: "Honestly, smaller businesses are where a website makes the biggest difference. It makes you look just as professional as the big guys.",
                tip: "Flip their concern into a strength—small businesses benefit the most from a professional online presence."
            }
        ]
    },
    skeptical: {
        label: 'Skeptical Questions',
        icon: '❓',
        color: '#8b5cf6',
        objections: [
            {
                id: 'how_much',
                objection: '"How much is this going to cost?"',
                response: "Great question. The walkthrough is completely free, there's no cost just to look at the website. The price does vary a little depending on the website, but I promise it's very affordable, and my colleague covers all the options on the call.",
                tip: "Keep the focus on the free walkthrough and defer pricing details to the closer."
            },
            {
                id: 'whats_catch',
                objection: '"What\'s the catch?"',
                response: "No catch. If you love it, you pay us to fully flesh it out and get it online for you. If you don't like it, we just leave it at that, no hard feelings.",
                tip: "Be transparent and straightforward—no hidden agendas."
            },
            {
                id: 'will_help',
                objection: '"Is this going to help my business?"',
                response: "Of course it will. It'll make you way easier to find on Google, make you look more trustworthy and professional, and give customers an easy way to reach you and book you. A good website brings in business, that's the whole point.",
                tip: "Focus on the practical, tangible benefits they'll see."
            },
            {
                id: 'got_number',
                objection: '"How did you get my number?"',
                response: "Your business shows up on Google, that's where we found you. We noticed you didn't have a website linked to your profile.",
                tip: "Be honest and specific about how you found them."
            },
            {
                id: 'are_you_local',
                objection: '"Are you local?"',
                response: "We're based in Delaware, but we work with businesses like yours all over, and everything we do is focused on helping you show up better in your own area online.",
                tip: "Acknowledge location while emphasizing local business focus."
            }
        ]
    },
    gatekeeper: {
        label: 'Gatekeepers',
        icon: '🚪',
        color: '#ef4444',
        objections: [
            {
                id: 'owner_not_in',
                objection: '"The owner isn\'t in right now."',
                response: "Alright, no problem, I can give them a call back. When will they be back in?",
                tip: "Stay friendly, don't push, and get a concrete time for callback."
            }
        ]
    }
};

export const DEFAULT_SCRIPTS: Record<string, { name: string; content: string; version: number; keyNumber: number; favorite: boolean }> = {
    "opening": {
        name: "Opening Script",
        content: `3-2-1 Framework: 3 steps, 2 types, 1 thing
Curious Tone + Smile and Dial
Website Sample Appointment Script
1. No Website — Primary Opener

Setter:
"Hi, is this [Company Name]?"

Hey, this is Flynn. I found your business online, and my team actually created a custom website sample for your business. It's already done. I was just wondering if you’d have a few moments today or tomorrow to take a quick look and maybe share your thoughts. "

If they sound interested:
"Awesome! We have two quick options — I can either share my screen right now for 5 minutes, or we can lock in a quick walkthrough for Daniel to show you around later today or tomorrow. Which works better for you?"`,
        version: 1956,
        keyNumber: 1,
        favorite: true
    },
    "reminder": {
        name: "Reminder Call",
        content: `"Hi [Name], this is Flynn following up on the custom website sample walkthrough we scheduled for today.

Just checking in to make sure we're still good for [Time]?"

If they need to reschedule:
"No problem at all! How does tomorrow at the same time look for you, or would an afternoon slot work better?"`,
        version: 412,
        keyNumber: 2,
        favorite: true
    },
    "no_show": {
        name: "NO-SHOW",
        content: `"Hey [Name], Flynn here with ScriptFlow. I tried connecting with you for our scheduled website sample walkthrough at [Time], but wasn't able to catch you. 

I know things get busy running [Company Name]! 

When is a better 10-minute window this afternoon or tomorrow to quickly share my screen and get your eyes on the demo?"`,
        version: 289,
        keyNumber: 3,
        favorite: true
    },
    "beautiful_website": {
        name: "Beautiful Website",
        content: `"Hi [Name], I was looking at your business online and noticed your brand has great reviews, but your current website doesn't show off the quality of your work.

My team put together a modern, high-converting website sample specifically designed for [Company Name]. 

When would be a good 5-10 minutes for you today or tomorrow to take a quick look?"`,
        version: 512,
        keyNumber: 4,
        favorite: true
    },
    "senior_opener": {
        name: "⏱️ Senior Opener",
        content: `"Hey [Name], this is Flynn. I'm reaching out directly because we just finalized a custom digital sample for [Company Name] designed to increase direct phone inquiries in your local area.

Do you have 5 minutes today or tomorrow for a rapid screen share review with our lead architect?"`,
        version: 340,
        keyNumber: 5,
        favorite: true
    },
    "owner_yes": {
        name: "👑 Owner - Yes",
        content: `"Perfect! Daniel will call you shortly to showcase your preview concept. Is this the best direct number to connect with you?"`,
        version: 120,
        keyNumber: 6,
        favorite: false
    },
    "owner_no": {
        name: "🤤 Not Owner",
        content: `"No worries! Who usually drives your design, online advertising, or website decisions? What is the best coordinate to reach them today?"`,
        version: 98,
        keyNumber: 7,
        favorite: false
    },
    "closing": {
        name: "🤝 Closing Script",
        content: `"Thank you for your time today! I'll have Daniel send over the calendar invite and walk you through the sample. You're going to love what we built for [Company Name]."`,
        version: 154,
        keyNumber: 8,
        favorite: false
    }
};