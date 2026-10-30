const API_URL = "https://creatorpay-backend.onrender.com";

const profileContent = document.getElementById("profileContent");
const backBtn = document.getElementById("backBtn");
const bookingWizardModal = document.getElementById("bookingWizardModal");
const bookingSuccessModal = document.getElementById("bookingSuccessModal");

const params = new URLSearchParams(window.location.search);
const creatorId = params.get("id");
const autoAction = params.get("action");

let selectedCreator = null;

// Wizard State
let wizardStep = 1;
let selectedDate = null;
let selectedTimeSlot = "04:30 PM";
let userNote = "";
let wizardMonthDate = new Date();

if (backBtn) {
    backBtn.addEventListener("click", (e) => {
        if (window.history.length > 1) {
            e.preventDefault();
            window.history.back();
        }
    });
}

// ===============================
// SAFE HTML HELPER
// ===============================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ===============================
// LOAD PROFILE
// ===============================

async function loadProfile() {
    if (!creatorId) {
        displayError("Profile not found", "Please return to Roséia and choose someone to view.");
        return;
    }

    // 1. Check cached creators for instantaneous display
    try {
        const cached = localStorage.getItem("fc_cached_creators");
        if (cached) {
            const list = JSON.parse(cached);
            const found = list.find((item) => String(item.id) === String(creatorId));
            if (found) {
                selectedCreator = found;
                displayProfile(found);
                if (autoAction === "book") {
                    setTimeout(() => openBookingWizard(), 300);
                }
            }
        }
    } catch (_) {}

    // 2. Fetch data (prefer local same-origin proxy, fallback to Render backend)
    try {
        let creators = [];
        let fetchedSuccessfully = false;

        try {
            const localController = new AbortController();
            const localTimeout = setTimeout(() => localController.abort(), 3500);
            const localRes = await fetch("/api/creators", { signal: localController.signal });
            clearTimeout(localTimeout);
            if (localRes.ok) {
                const localData = await localRes.json();
                if (localData && localData.success && Array.isArray(localData.creators) && localData.creators.length > 0) {
                    creators = localData.creators;
                    fetchedSuccessfully = true;
                }
            }
        } catch (_) {}

        if (!fetchedSuccessfully) {
            try {
                const renderController = new AbortController();
                const renderTimeout = setTimeout(() => renderController.abort(), 4500);
                const renderRes = await fetch(`${API_URL}/api/creators`, { signal: renderController.signal });
                clearTimeout(renderTimeout);
                if (renderRes.ok) {
                    const renderData = await renderRes.json();
                    if (renderData && renderData.success && Array.isArray(renderData.creators) && renderData.creators.length > 0) {
                        creators = renderData.creators;
                        fetchedSuccessfully = true;
                    }
                }
            } catch (_) {}
        }

        if (fetchedSuccessfully && creators.length > 0) {
            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(creators));
            } catch (_) {}

            const creator = creators.find((item) => String(item.id) === String(creatorId));
            if (creator) {
                selectedCreator = creator;
                displayProfile(creator);
                if (autoAction === "book" && (!bookingWizardModal || bookingWizardModal.style.display === "none")) {
                    setTimeout(() => openBookingWizard(), 300);
                }
                return;
            }
        }

        if (!selectedCreator) {
            displayError("Profile does not exist", "The requested Roséia profile could not be found.");
        }

    } catch (error) {
        console.error("Profile load error:", error);
        if (!selectedCreator) {
            displayError("Unable to load profile", "Please check your internet connection and try again.");
        }
    }
}


// ===============================
// DISPLAY PROFILE (ROSÉIA REFERENCE DESIGN)
// ===============================

function formatProfileNextDate(dates) {
    if (Array.isArray(dates) && dates.length > 0) {
        const sorted = [...dates].sort();
        const dateStr = sorted[0];
        try {
            const d = new Date(dateStr + "T00:00:00");
            if (!isNaN(d.getTime())) {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
            }
        } catch (_) {}
    }
    return "Oct 30, 2026";
}

function getCreatorDisplayAge(creator) {
    const raw = creator.creator_age || creator.age;
    if (raw && typeof raw === "string" && !raw.includes("http")) {
        const num = raw.trim();
        if (/^\d{2}$/.test(num)) return num;
    }
    if (creator.bio) {
        const m = creator.bio.match(/\b(1[89]|[2-3][0-9])\b/);
        if (m) return m[1];
    }
    return "25";
}

function getFavoritesList() {
    try {
        const stored = localStorage.getItem("fc_favorites");
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

window.toggleProfileFav = function(event, id) {
    if (event) event.stopPropagation();
    const favs = getFavoritesList();
    const strId = String(id);
    const idx = favs.indexOf(strId);
    let isNowFav = false;
    if (idx > -1) {
        favs.splice(idx, 1);
    } else {
        favs.push(strId);
        isNowFav = true;
    }
    try {
        localStorage.setItem("fc_favorites", JSON.stringify(favs));
    } catch (_) {}

    const heartIcon = document.getElementById("heroFavHeart");
    if (heartIcon) {
        heartIcon.setAttribute("fill", isNowFav ? "#E11D48" : "none");
        heartIcon.setAttribute("stroke", isNowFav ? "#E11D48" : "#25202A");
    }
};

window.handleProfileBack = function() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = "creator_home.html";
    }
};

window.toggleHeroFullscreen = function() {
    const modal = document.getElementById("heroLightboxModal");
    const imgEl = document.getElementById("lightboxImage");
    if (!modal) return;
    if (modal.style.display === "none" || !modal.style.display) {
        if (selectedCreator && imgEl) {
            imgEl.src = selectedCreator.profile_image || "";
        }
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    } else {
        modal.style.display = "none";
        document.body.style.overflow = "";
    }
};

function displayProfile(creator) {
    const image =
        (creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http"))
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

    const name = (creator.name && creator.name.trim()) || "Member";
    const age = getCreatorDisplayAge(creator);

    // Bio & Introduction
    let intro = (creator.bio && creator.bio.trim()) || `This is ${name}, Fitness Coach`;
    if (!intro.toLowerCase().startsWith("this is")) {
        intro = `This is ${name}. ${intro}`;
    }

    const rawPrice = Number(creator.price);
    const basePrice = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice : 499;
    const priceFormatted = basePrice.toLocaleString("en-IN");

    // Location: clean single line
    let loc = (creator.creator_location || creator.location || "Available Locally").trim();
    if (loc.toLowerCase().includes("available locally") && loc.includes("·")) {
        loc = "Available Locally";
    }

    // Dynamic tags (Interests & Hobbies)
    let interestsStr = "Coffee & Conversation · Fine Dining";
    if (Array.isArray(creator.tags) && creator.tags.length > 0) {
        interestsStr = creator.tags.join(" · ");
    } else if (typeof creator.tags === "string" && creator.tags.trim()) {
        interestsStr = creator.tags.split(",").map(t => t.trim()).join(" · ");
    }

    // Languages
    const languagesStr = creator.languages || "English · Hindi";

    // Activities
    const activitiesStr = creator.activities || "Coffee & Conversation · Fine Dining · Casual Walk";

    const nextOpenDate = formatProfileNextDate(creator.available_dates);

    const favs = getFavoritesList();
    const isFav = favs.includes(String(creator.id));

    profileContent.innerHTML = `
        <article class="creator-profile-view">
            <!-- 1. Full-Bleed Immersive Hero Photograph -->
            <div class="creator-hero-frame">
                <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" class="creator-hero-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">

                <!-- Floating Top Controls -->
                <div class="creator-hero-controls">
                    <!-- Left: Back Button -->
                    <button type="button" class="hero-float-btn hero-back-btn" onclick="handleProfileBack()" aria-label="Go Back">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25202A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>

                    <!-- Right: Fullscreen & Favorite Buttons -->
                    <div class="hero-right-buttons">
                        <button type="button" class="hero-float-btn hero-expand-btn" onclick="toggleHeroFullscreen()" aria-label="View Fullscreen" title="View Fullscreen">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25202A" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                            </svg>
                        </button>

                        <button type="button" class="hero-float-btn hero-fav-btn" onclick="toggleProfileFav(event, '${escapeHTML(creator.id)}')" aria-label="Save Favorite" title="Save Favorite">
                            <svg id="heroFavHeart" width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? '#E11D48' : 'none'}" stroke="${isFav ? '#E11D48' : '#25202A'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Bottom Gradient with Name, Age, Location, Date OVER photo -->
                <div class="creator-hero-overlay">
                    <h1 class="hero-overlay-name">${escapeHTML(name)}, ${escapeHTML(age)}</h1>
                    
                    <div class="hero-overlay-loc">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>${escapeHTML(loc)} ·</span>
                    </div>

                    <div class="hero-overlay-date">
                        Next open date: ${escapeHTML(nextOpenDate)}
                    </div>
                </div>
            </div>

            <!-- 2. "A Little More About Her" White Rounded Card -->
            <div class="about-her-card">
                <h2 class="about-her-title">A Little More About Her</h2>
                
                <p class="about-her-bio">${escapeHTML(intro)}</p>

                <div class="about-her-divider"></div>

                <div class="about-field-group">
                    <div class="about-field-label">Interests &amp; Hobbies</div>
                    <div class="about-field-val">${escapeHTML(interestsStr)}</div>
                </div>

                <div class="about-her-divider"></div>

                <div class="about-field-group">
                    <div class="about-field-label">Languages Spoken</div>
                    <div class="about-field-val language-val">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D93B78" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        <span>${escapeHTML(languagesStr)}</span>
                    </div>
                </div>

                <div class="about-her-divider"></div>

                <div class="about-field-group">
                    <div class="about-field-label">Preferred Date Activities</div>
                    <div class="about-field-val">${escapeHTML(activitiesStr)}</div>
                </div>
            </div>

            <!-- 3. Sticky Bottom Booking Bar (Follows Reference) -->
            <div class="sticky-booking-bar">
                <div class="sticky-price-col">
                    <div class="sticky-price-figure">₹${priceFormatted}</div>
                    <div class="sticky-price-sub">120 min · Request approval</div>
                </div>

                <button
                    type="button"
                    class="sticky-book-cta-btn"
                    id="bookDateBtn"
                    onclick="openBookingWizard()"
                    aria-label="Book a Date with ${escapeHTML(name)}"
                >
                    Book a Date
                </button>
            </div>
        </article>
    `;
}


// ===============================
// 4-STEP BOOKING WIZARD (PINK THEME)
// ===============================

window.openBookingWizard = function() {
    if (!selectedCreator) return;
    if (window.RoseiaBooking && typeof window.RoseiaBooking.open === "function") {
        window.RoseiaBooking.open(selectedCreator);
        return;
    }
    wizardStep = 1;
    wizardMonthDate = new Date();

    // Default to the first available date if none selected
    const availableDates = Array.isArray(selectedCreator.available_dates) ? selectedCreator.available_dates : [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const futureAvailable = availableDates.filter(d => d >= todayStr).sort();
    if (!selectedDate && futureAvailable.length > 0) {
        selectedDate = futureAvailable[0];
    }

    renderWizardModal();
    if (bookingWizardModal) {
        bookingWizardModal.style.display = "flex";
    }
};

window.closeBookingWizard = function() {
    if (bookingWizardModal) {
        bookingWizardModal.style.display = "none";
    }
};

function calculateBookingPricing(basePrice) {
    const base = Number(basePrice) || 49;
    const platformFee = Math.round(base * 0.10); // 10% Platform Concierge & Safety fee
    const tax = Math.round(base * 0.085);        // 8.5% Estimated Taxes
    const totalPayable = base + platformFee + tax;
    return {
        basePrice: base,
        platformFee,
        tax,
        totalPayable
    };
}

function renderWizardModal() {
    if (!bookingWizardModal || !selectedCreator) return;

    const basePrice = Number(selectedCreator.price) || 49;
    const pricing = calculateBookingPricing(basePrice);
    const creatorName = selectedCreator.name || "Partner";

    bookingWizardModal.innerHTML = `
        <div class="wizard-dialog">
            <!-- Header with step tracking -->
            <div class="wizard-header">
                <div class="wizard-step-tracker">
                    <div class="step-pill ${wizardStep === 1 ? 'active' : (wizardStep > 1 ? 'completed' : '')}">1</div>
                    <div class="step-divider-line ${wizardStep >= 2 ? 'active' : ''}"></div>
                    <div class="step-pill ${wizardStep === 2 ? 'active' : (wizardStep > 2 ? 'completed' : '')}">2</div>
                    <div class="step-divider-line ${wizardStep >= 3 ? 'active' : ''}"></div>
                    <div class="step-pill ${wizardStep === 3 ? 'active' : ''}">3</div>
                </div>

                <button type="button" class="wizard-close-btn" onclick="closeBookingWizard()" aria-label="Close dialog">
                    &times;
                </button>
            </div>

            <div class="wizard-body">
                ${renderWizardStepContent(pricing, creatorName)}
            </div>
        </div>
    `;

    // Re-bind click handlers for dynamic wizard elements
    attachWizardHandlers(pricing);
}

function renderWizardStepContent(pricing, creatorName) {
    // STEP 1: DATE SELECTION
    if (wizardStep === 1) {
        return renderStep1DateSelection(creatorName);
    }

    // STEP 2: TIME SLOT & NOTE
    if (wizardStep === 2) {
        return renderStep2TimeSlotAndNote(creatorName);
    }

    // STEP 3: RECEIPT & TRANSPARENT PRICING SUMMARY
    if (wizardStep === 3) {
        return renderStep3ReceiptSummary(pricing, creatorName);
    }

    return "";
}

function renderStep1DateSelection(creatorName) {
    const year = wizardMonthDate.getFullYear();
    const month = wizardMonthDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const availableDatesSet = new Set(Array.isArray(selectedCreator.available_dates) ? selectedCreator.available_dates : []);
    const todayStr = new Date().toISOString().slice(0, 10);

    let daysHtml = "";
    for (let i = 0; i < firstDayIndex; i++) {
        daysHtml += `<div style="height: 42px;"></div>`;
    }

    for (let day = 1; day <= lastDate; day++) {
        const mm = String(month + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const dateKey = `${year}-${mm}-${dd}`;

        const isAvailableInDb = availableDatesSet.has(dateKey);
        const isPast = dateKey < todayStr;
        const isSelectable = isAvailableInDb && !isPast;
        const isSelected = selectedDate === dateKey;

        let dayClass = "wizard-day-btn disabled";
        if (isSelected) {
            dayClass = "wizard-day-btn selected";
        } else if (isSelectable) {
            dayClass = "wizard-day-btn available";
        }

        daysHtml += `
            <button
                type="button"
                class="${dayClass}"
                data-date="${dateKey}"
                ${isSelectable ? `onclick="selectWizardDate('${dateKey}')"` : 'disabled'}
                title="${isSelected ? 'Selected date' : (isSelectable ? 'Available for booking' : 'Unavailable')}"
            >
                <span>${day}</span>
                ${isSelected ? '<span style="width: 4px; height: 4px; border-radius: 50%; background: #FFF; margin-top: 2px;"></span>' : (isSelectable ? '<span style="width: 4px; height: 4px; border-radius: 50%; background: #EC4899; margin-top: 2px;"></span>' : '')}
            </button>
        `;
    }

    const formattedSelected = selectedDate ? formatDatePretty(selectedDate) : "None selected";

    return `
        <h2 class="wizard-step-title" id="wizardStepTitle">Step 1: Choose Your Date</h2>
        <p class="wizard-step-sub">Select an available date to meet ${escapeHTML(creatorName)}. Only dates marked active in Supabase are bookable.</p>

        <div class="wizard-calendar-box">
            <div class="wizard-calendar-top">
                <span class="wizard-cal-month-title">${monthNames[month]} ${year}</span>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="wizard-cal-nav-btn" onclick="changeWizardMonth(-1)">‹</button>
                    <button type="button" class="wizard-cal-nav-btn" onclick="changeWizardMonth(1)">›</button>
                </div>
            </div>

            <div class="wizard-cal-grid-header">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
            </div>

            <div class="wizard-cal-days-grid">
                ${daysHtml}
            </div>
        </div>

        <div style="margin-top: 14px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #817783;">
            <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="width: 9px; height: 9px; border-radius: 50%; background: #EC4899; display: inline-block;"></span>
                Active available dates
            </span>
            <strong style="color: #DB2777;">${escapeHTML(formattedSelected)}</strong>
        </div>

        <div class="wizard-actions-row">
            <button
                type="button"
                class="wizard-primary-btn"
                onclick="goToWizardStep(2)"
                ${!selectedDate ? 'disabled' : ''}
            >
                <span>Continue to Time Slot</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        </div>
    `;
}

function renderStep2TimeSlotAndNote(creatorName) {
    const slots = [
        { time: "11:00 AM", label: "Morning Coffee & Talk" },
        { time: "02:00 PM", label: "Afternoon Lunch & Chat" },
        { time: "04:30 PM", label: "Sunset Tea & Walk" },
        { time: "07:00 PM", label: "Dinner & Evening Date" }
    ];

    const formattedDate = formatDatePretty(selectedDate);

    return `
        <h2 class="wizard-step-title" id="wizardStepTitle">Step 2: Time Slot &amp; Note</h2>
        <p class="wizard-step-sub">Pick a convenient time slot and share an optional note for ${escapeHTML(creatorName)}.</p>

        <!-- Selected Date Banner -->
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #FFF5F8; border: 1px solid #FCE7F3; border-radius: 12px; margin-bottom: 16px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DB2777" stroke-width="2.3">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
            </svg>
            <span style="font-size: 13px; font-weight: 700; color: #25202A;">${escapeHTML(formattedDate)}</span>
        </div>

        <label style="display: block; font-size: 12px; font-weight: 750; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Select Time Slot</label>
        <div class="time-slots-grid">
            ${slots.map(s => `
                <button
                    type="button"
                    class="time-slot-btn ${selectedTimeSlot === s.time ? 'selected' : ''}"
                    onclick="selectWizardTimeSlot('${s.time}')"
                >
                    <span class="slot-time">${s.time}</span>
                    <span class="slot-label">${s.label}</span>
                </button>
            `).join("")}
        </div>

        <label for="wizardUserNoteInput" style="display: block; font-size: 12px; font-weight: 750; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
            Short Note for Date (Optional)
        </label>
        <textarea
            id="wizardUserNoteInput"
            class="wizard-textarea"
            rows="3"
            placeholder="e.g. Excited to meet for coffee! Love talking about design, books, and indie music..."
            oninput="userNote = this.value"
        >${escapeHTML(userNote)}</textarea>

        <div class="wizard-actions-row">
            <button type="button" class="wizard-back-btn" onclick="goToWizardStep(1)">
                ← Back
            </button>
            <button type="button" class="wizard-primary-btn" onclick="goToWizardStep(3)">
                <span>View Price Summary</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        </div>
    `;
}

function renderStep3ReceiptSummary(pricing, creatorName) {
    const formattedDate = formatDatePretty(selectedDate);

    return `
        <h2 class="wizard-step-title" id="wizardStepTitle">Step 3: Transparent Pricing Summary</h2>
        <p class="wizard-step-sub">Itemized receipt breakdown. No hidden fees. 100% escrow protected.</p>

        <!-- Meeting Summary Badge -->
        <div style="padding: 12px 14px; background: #FFF5F8; border: 1px solid #FCE7F3; border-radius: 14px; margin-bottom: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 750; color: #DB2777; margin-bottom: 3px;">Date Booking Details</div>
            <div style="font-size: 14px; font-weight: 800; color: #1E1B22;">With ${escapeHTML(creatorName)}</div>
            <div style="font-size: 12.5px; color: #64748B; margin-top: 2px;">
                🗓️ ${escapeHTML(formattedDate)} · ⏰ ${escapeHTML(selectedTimeSlot)}
            </div>
            ${userNote ? `<div style="font-size: 12px; color: #817783; font-style: italic; margin-top: 4px;">Note: "${escapeHTML(userNote)}"</div>` : ""}
        </div>

        <!-- Transparent Itemized Receipt Breakdown -->
        <div class="receipt-card">
            <div class="receipt-row">
                <span>Creator Date Fee</span>
                <strong>₹${pricing.basePrice.toLocaleString("en-IN")}</strong>
            </div>
            <div class="receipt-row">
                <span>Platform Concierge &amp; Safety Fee (10%)</span>
                <strong>₹${pricing.platformFee.toLocaleString("en-IN")}</strong>
            </div>
            <div class="receipt-row">
                <span>Estimated Taxes (8.5%)</span>
                <strong>₹${pricing.tax.toLocaleString("en-IN")}</strong>
            </div>
            <div class="receipt-row divider total">
                <span>Total Payable</span>
                <span class="receipt-total-price">₹${pricing.totalPayable.toLocaleString("en-IN")}</span>
            </div>
        </div>

        <div class="trust-badge-row">
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <span><strong>100% Escrow Protection:</strong> Payment released only after date completion.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EC4899" stroke-width="2.3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span><strong>Concierge Support:</strong> Direct communication to coordinate place &amp; time.</span>
            </div>
        </div>

        <div class="wizard-actions-row">
            <button type="button" class="wizard-back-btn" onclick="goToWizardStep(2)">
                ← Back
            </button>
            <button
                type="button"
                class="wizard-primary-btn"
                id="wizardPayButton"
                onclick="executeBookingPayment()"
            >
                <span>Pay ₹${pricing.totalPayable.toLocaleString("en-IN")} &amp; Confirm</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        </div>
    `;
}

function formatDatePretty(dateStr) {
    if (!dateStr) return "";
    try {
        const parts = dateStr.split("-");
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    } catch (_) {
        return dateStr;
    }
}

window.selectWizardDate = function(dateKey) {
    selectedDate = dateKey;
    renderWizardModal();
};

window.changeWizardMonth = function(delta) {
    wizardMonthDate.setMonth(wizardMonthDate.getMonth() + delta);
    renderWizardModal();
};

window.selectWizardTimeSlot = function(timeStr) {
    selectedTimeSlot = timeStr;
    renderWizardModal();
};

window.goToWizardStep = function(step) {
    wizardStep = step;
    renderWizardModal();
};

function attachWizardHandlers(pricing) {
    // Input persistence
    const noteEl = document.getElementById("wizardUserNoteInput");
    if (noteEl) {
        noteEl.value = userNote;
    }
}


// ===============================
// STEP 4: EXECUTE PAYMENT & CONFIRMATION
// ===============================

window.executeBookingPayment = async function() {
    if (!selectedCreator || !selectedDate) {
        alert("Please select a date first.");
        return;
    }

    const payBtn = document.getElementById("wizardPayButton");
    if (payBtn) {
        payBtn.disabled = true;
        payBtn.innerHTML = `<span>Processing Order...</span>`;
    }

    try {
        const basePrice = Number(selectedCreator.price) || 49;
        const pricing = calculateBookingPricing(basePrice);

        // 1. Create Order on Backend
        let res;
        try {
            res = await fetch("/api/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creatorId: selectedCreator.id,
                    type: "date_booking",
                    bookingDate: selectedDate,
                    timeSlot: selectedTimeSlot,
                    userNote: userNote
                })
            });
        } catch (_) {}

        if (!res || !res.ok) {
            res = await fetch(`${API_URL}/api/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creatorId: selectedCreator.id,
                    type: "date_booking",
                    bookingDate: selectedDate,
                    timeSlot: selectedTimeSlot,
                    userNote: userNote
                })
            });
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to initialize booking order.");
        }

        // 2. Open Razorpay Checkout for exact Total Payable
        if (typeof Razorpay === "undefined") {
            throw new Error("Razorpay Checkout SDK not loaded.");
        }

        const options = {
            key: data.keyId,
            amount: data.order.amount,
            currency: data.order.currency || "INR",
            name: "Roséia",
            description: `Date Booking with ${selectedCreator.name}`,
            order_id: data.order.id,

            handler: async function (paymentResponse) {
                if (payBtn) payBtn.innerHTML = `<span>Verifying payment...</span>`;

                try {
                    let verifyRes = await fetch("/api/verify-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: paymentResponse.razorpay_order_id,
                            razorpay_payment_id: paymentResponse.razorpay_payment_id,
                            razorpay_signature: paymentResponse.razorpay_signature,
                            creatorId: selectedCreator.id,
                            bookingDate: selectedDate,
                            timeSlot: selectedTimeSlot,
                            userNote: userNote
                        })
                    });

                    if (!verifyRes.ok) {
                        verifyRes = await fetch(`${API_URL}/api/verify-payment`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                creatorId: selectedCreator.id,
                                bookingDate: selectedDate,
                                timeSlot: selectedTimeSlot,
                                userNote: userNote
                            })
                        });
                    }

                    const verifyData = await verifyRes.json();
                    if (!verifyRes.ok || !verifyData.success) {
                        throw new Error(verifyData.message || "Payment verification failed.");
                    }

                    // Save session token in local storage
                    const sessionData = {
                        token: verifyData.token,
                        paymentId: paymentResponse.razorpay_payment_id,
                        orderId: paymentResponse.razorpay_order_id,
                        creatorId: selectedCreator.id,
                        creatorName: selectedCreator.name,
                        bookingDate: selectedDate,
                        timeSlot: selectedTimeSlot,
                        verifiedAt: Date.now()
                    };
                    localStorage.setItem(`fc_chat_session_${selectedCreator.id}`, JSON.stringify(sessionData));

                    // Close wizard and display confirmed popup
                    closeBookingWizard();
                    showBookingConfirmationPopup(selectedCreator, verifyData.booking || sessionData, pricing);

                } catch (err) {
                    console.error("Verification error:", err);
                    alert("Error verifying booking payment: " + err.message);
                    if (payBtn) {
                        payBtn.disabled = false;
                        payBtn.textContent = `Pay ₹${pricing.totalPayable} & Confirm`;
                    }
                }
            },
            notes: {
                creatorId: selectedCreator.id,
                creatorName: selectedCreator.name,
                type: "date_booking",
                bookingDate: selectedDate,
                timeSlot: selectedTimeSlot
            },
            theme: {
                color: "#EC4899"
            },
            modal: {
                ondismiss: function () {
                    if (payBtn) {
                        payBtn.disabled = false;
                        payBtn.textContent = `Pay ₹${pricing.totalPayable} & Confirm`;
                    }
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (err) {
        console.error("Execute payment error:", err);
        alert(err.message || "Unable to proceed with payment.");
        if (payBtn) {
            payBtn.disabled = false;
            payBtn.textContent = "Try Again";
        }
    }
};

// ===============================
// CONFIRMATION POPUP ("Booking Confirmed! She will contact you soon. Thank you!")
// ===============================

function showBookingConfirmationPopup(creator, booking, pricing) {
    if (!bookingSuccessModal) return;

    const formattedDate = formatDatePretty(booking.booking_date || selectedDate);
    const timeSlot = booking.time_slot || selectedTimeSlot || "11:00 AM";
    const bookingId = booking.id || booking.paymentId || `bk_${Date.now()}`;
    const amount = booking.total_amount || pricing.totalPayable;

    bookingSuccessModal.innerHTML = `
        <div class="wizard-dialog success-card">
            <div class="success-icon-wrap">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>

            <!-- Exact confirmation requirement -->
            <h2 class="success-title">Booking Confirmed!</h2>
            <p class="success-sub">She will contact you soon. Thank you!</p>

            <div class="success-booking-box">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <img
                        src="${escapeHTML(creator.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80')}"
                        alt="${escapeHTML(creator.name)}"
                        style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #FFF;"
                    >
                    <div>
                        <strong style="display: block; font-size: 14px; color: #1E1B22;">${escapeHTML(creator.name || "Partner")}</strong>
                        <span style="font-size: 12px; color: #10B981; font-weight: 700;">● Confirmed in Supabase</span>
                    </div>
                </div>

                <div style="font-size: 12.5px; color: #475569; display: flex; flex-direction: column; gap: 5px;">
                    <div>📅 <strong>Date:</strong> ${escapeHTML(formattedDate)}</div>
                    <div>⏰ <strong>Time:</strong> ${escapeHTML(timeSlot)}</div>
                    <div>📍 <strong>Location:</strong> ${escapeHTML(creator.creator_location || creator.location || "Local Meeting")}</div>
                    <div>💳 <strong>Total Paid:</strong> ₹${amount.toLocaleString("en-IN")}</div>
                    <div style="font-size: 11px; color: #817783; margin-top: 4px;">Ref ID: #${escapeHTML(String(bookingId).substring(0, 14))}</div>
                </div>
            </div>

            <button
                type="button"
                class="wizard-primary-btn"
                onclick="closeBookingSuccessModal()"
                style="width: 100%; font-size: 15px;"
            >
                Done
            </button>
        </div>
    `;

    bookingSuccessModal.style.display = "flex";
}

window.closeBookingSuccessModal = function() {
    if (bookingSuccessModal) {
        bookingSuccessModal.style.display = "none";
    }
    // Refresh page or return to creator home
    window.location.href = "creator_home.html";
};




function displayError(title, message) {
    profileContent.innerHTML = `
        <div class="profile-error-box" style="text-align: center; padding: 50px 20px;">
            <h2>${escapeHTML(title)}</h2>
            <p style="color: #817783; margin: 8px 0 20px;">${escapeHTML(message)}</p>
            <a href="creator_home.html" class="return-home-btn" style="background: #EC4899; color: #FFF; padding: 12px 24px; border-radius: 12px; font-weight: 700;">Discover People</a>
        </div>
    `;
}

// Start App
loadProfile();