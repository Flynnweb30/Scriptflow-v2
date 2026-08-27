// Objection Handler for ScriptFlow Pro
window.OBJECTION_CATEGORIES = {
    reflex: {
        label: '🔄 Reflex Brush-Offs',
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
        label: '💼 "We Don\'t Need It"',
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
        label: '❓ Skeptical Questions',
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
        label: '🚪 Gatekeepers',
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
