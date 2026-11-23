/**
 * Тексты сайта (английский). Структура должна совпадать со всеми остальными словарями:
 * это проверяет `npm test`. В строках можно использовать {name}, {city}, {phone},
 * {telegram}, {instagram} (значения из src/site.config.js).
 * ДЕМО-ТЕКСТ: цены, цифры и гарантии подтвердите с клиентом.
 */
export default {
  meta: {
    title: "{name} | Family & Cosmetic Dentist in {city}, TX",
    description:
      "{name} in {city}, TX: check-ups, whitening, fillings, crowns and emergency visits. Written price estimate before treatment, open until 7 PM Mon–Thu.",
    ogTitle: "{name} | Dentist in {city}, TX",
    ogDescription: "Straightforward dental care in {city}. Price agreed in writing before we begin.",
    ogAlt: "{name}, dentist in {city}, TX",
  },

  ui: {
    skip: "Skip to content",
    homeAria: "{name}, back to top",
    primaryNav: "Primary",
    mobileNav: "Mobile",
    footerNav: "Footer",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    callAria: "Call us: {phone}",
    whatsapp: "WhatsApp",
    whatsappAria: "Chat with us on WhatsApp",
    requestCallback: "Request a Callback",
    language: "Language",
    quickContact: "Quick contact",
    call: "Call",
    request: "Request",
  },

  nav: { services: "Services", benefits: "Benefits", about: "About", faq: "FAQ", contact: "Contact" },

  hero: {
    eyebrow: "Family & cosmetic dentistry · {city}, TX",
    title: "Dental care in Austin where the price is agreed before we begin",
    lead: "Check-ups, whitening, fillings and same-week emergency visits. You get a written estimate up front, a 60-minute first appointment, and appointments that start on time.",
    trust1: "Open until 7 PM, Mon–Thu",
    trust2: "Insurance benefits checked before your visit",
    trust3: "Saturday appointments",
    chip1Title: "60-minute first visit",
    chip1Text: "Exam, X-rays and a clear treatment plan",
    chip2Title: "No surprise fees",
    chip2Text: "Written estimate before treatment",
    imgAlt: "Illustration of a healthy, bright smile",
  },

  services: {
    eyebrow: "Services & pricing",
    title: "Clear prices for the treatments people ask for most",
    lead: "Starting prices are shown below. After your exam we give you the exact figure in writing, so nothing changes once you sit in the chair.",
    from: "From",
    select: "Select Service",
    items: {
      exam: { title: "Exam & Cleaning", desc: "Full exam, digital X-rays and a professional cleaning, with a plan for anything we find." },
      whitening: { title: "Teeth Whitening", desc: "In-office whitening in one visit, with a gentler option for sensitive teeth." },
      fillings: { title: "Tooth-Colored Fillings", desc: "Natural-looking composite fillings that restore the tooth and blend in." },
      crowns: { title: "Crowns", desc: "Durable porcelain crowns for cracked or heavily filled teeth, matched to your shade." },
      aligners: { title: "Clear Aligners", desc: "Straighten your teeth with removable aligners. Free consultation and a 3D preview." },
      emergency: { title: "Emergency Visit", desc: "Toothache, chipped or broken tooth? We keep slots open each day for urgent cases." },
    },
  },

  benefits: {
    eyebrow: "Why patients stay with us",
    title: "What you can count on at every visit",
    items: [
      { big: "$0", title: "Surprise fees", text: "The price on your written estimate is the price you pay." },
      { big: "≤ 5 days", title: "To your first appointment", text: "New patients are typically seen within the same week." },
      { big: "60 min", title: "First visit", text: "Exam, digital X-rays and a plan you understand before you leave." },
      { big: "2 years", title: "Warranty on fillings and crowns", text: "If a restoration fails under normal use, we redo it at no charge." },
    ],
  },

  about: {
    eyebrow: "About the practice",
    title: "A small practice built around no surprises",
    p1: "{name} is an appointment-only practice in downtown {city}. We keep the schedule deliberately light so you are not left in a waiting room and your dentist is never rushing.",
    p2: "Our approach is simple: explain what we see, show you the options, and put the cost in writing before any work starts. If something can wait, we will tell you.",
    point1: "Infection control that follows CDC guidelines",
    point2: "Digital X-rays and clear images shown to you on screen",
    point3: "Gentle care for anxious patients, at your pace",
    imgAlt: "Bright, calm treatment room at {name}",
  },

  reviews: { eyebrow: "Patient reviews", title: "What our patients say" },

  faq: {
    eyebrow: "FAQ",
    title: "Questions we hear most",
    items: [
      { q: "How much does a first visit cost?", a: "A new-patient exam with X-rays and cleaning starts at $99. If we find something that needs treatment, you receive a written estimate before we do anything." },
      { q: "Do you accept dental insurance?", a: "We work with most major PPO plans. Send us your plan details when you book and we will check your benefits and tell you what to expect before your visit." },
      { q: "What if I have a dental emergency?", a: "Call us as early in the day as you can. We hold time for urgent cases and aim to see you the same day. Outside office hours, leave a message or write on WhatsApp and we will reply first thing." },
      { q: "Is whitening safe for sensitive teeth?", a: "Usually, yes. We check your teeth and gums first and choose a gentler formula if you are prone to sensitivity. Some people feel mild, temporary sensitivity afterwards." },
      { q: "Can I spread the cost of larger treatment?", a: "Yes. For treatment plans such as crowns or aligners we offer monthly payment options. We explain the terms at your consultation, with no obligation to proceed." },
    ],
  },

  contact: {
    eyebrow: "Contact",
    title: "Book a visit or ask a question",
    lead: "Leave your number and we will call you back within one business day. Or reach us the way that suits you.",
    phone: "Phone",
    whatsapp: "WhatsApp",
    whatsappLink: "Message us on WhatsApp",
    social: "Telegram / Instagram",
    address: "Address",
    hours: "Hours",
    mapOpen: "Open in Google Maps",
    telegramLabel: "Telegram @{telegram}",
    instagramLabel: "Instagram @{instagram}",
  },

  form: {
    title: "Request a callback",
    lead: "Tell us how to reach you. Name and phone are enough.",
    name: "Your name",
    namePlaceholder: "Jane Doe",
    phone: "Phone",
    service: "Service",
    serviceAny: "Not sure yet",
    optional: "(optional)",
    notes: "Notes",
    notesPlaceholder: "Preferred time, insurance, anything we should know",
    consentPre: "By sending this form you agree to our",
    submit: "Request a Callback",
    sending: "Sending…",
    success: "Thank you, {firstName}! We received your request and will call you back within one business day.",
    successAnon: "Thank you! We received your request and will call you back within one business day.",
    errorName: "Please enter your name (at least 2 characters).",
    errorPhone: "Please enter a valid 10-digit US phone number, e.g. +1 (555) 000-0000.",
    errorSend: "Sorry, we couldn't send your request. Please call or message us directly:",
    errorRate: "Too many requests in a row. Please try again in a few minutes, or contact us directly:",
    errorOffline: "It looks like you're offline. Please check your connection, or contact us directly:",
  },

  status: {
    open: "Open now · until {time}",
    closedToday: "Closed · opens today at {time}",
    closedTomorrow: "Closed · opens tomorrow at {time}",
    closed: "Closed · opens {day} at {time}",
    closedAlways: "Closed",
  },
  hours: { closed: "Closed" },
  days: {
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },

  privacy: {
    title: "Privacy Policy",
    close: "Close",
    closeAria: "Close privacy policy",
    intro: "This policy explains what personal information {name} collects through this website and how we use it.",
    sections: [
      { h: "What we collect", p: "The name, phone number, selected service and notes you enter in the callback form. We do not collect payment details or health records through this website." },
      { h: "How we use it", p: "Only to contact you about your request and to schedule your visit. We do not sell your information or use it for unrelated marketing." },
      { h: "Who sees it", p: "Your request is delivered to our team through a private messaging channel. We share information with third parties only when required by law." },
      { h: "How long we keep it", p: "We keep requests only as long as needed to respond and schedule care, then delete them." },
      { h: "Your choices", p: "You can ask us to correct or delete your information at any time by calling {phone} or writing to us on WhatsApp." },
    ],
  },

  footer: { rights: "All rights reserved.", privacy: "Privacy Policy", cookies: "Cookie settings" },

  consent: {
    aria: "Cookie consent",
    text: "We would like to use analytics cookies to understand how the site is used. They stay off unless you accept.",
    accept: "Accept",
    decline: "Decline",
  },
};
