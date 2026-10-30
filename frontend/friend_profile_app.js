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
// DISPLAY PROFILE (ROSÉIA DATING PLATFORM)
// ===============================

function displayProfile(creator) {
    const image =
        (creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http"))
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

    const name = (creator.name && creator.name.trim()) || "Member";
    const category = (creator.category && creator.category.trim()) || "Lifestyle & Conversations";
    const bio =
        (creator.bio && creator.bio.trim()) ||
        "Excited to meet lovely people, share meaningful stories and enjoy great coffee together.";

    const rawPrice = Number(creator.price);
    const basePrice = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice : 49;
    const priceFormatted = basePrice.toLocaleString("en-IN");

    const age = creator.creator_age || creator.age;
    const location = creator.creator_location || creator.location || "Delhi, India";

    // Dynamic tags
    const tagsList = Array.isArray(creator.tags) && creator.tags.length > 0
        ? creator.tags
        : (typeof creator.tags === "string" && creator.tags.trim()
            ? creator.tags.split(",").map(t => t.trim())
            : ["Coffee & Conversation", "Fine Dining", "Casual Walk"]);

    // Dynamic available dates count
    const datesList = Array.isArray(creator.available_dates) ? creator.available_dates : [];
    const availableDatesCount = datesList.length;

    profileContent.innerHTML = `
        <article class="profile-card">
            <!-- Profile Hero (Portrait Frame) -->
            <div class="profile-hero">
                <div class="profile-portrait-wrap">
                    <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">
                </div>

                <div class="profile-header-meta">
                    <div class="profile-name-row">
                        <h1 class="profile-name">${escapeHTML(name)}</h1>
                        <span class="verified-check" title="Verified Roséia Member">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" fill="#EC4899"></circle>
                                <path d="M8 12l3 3 5-5" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path>
                            </svg>
                        </span>
                    </div>

                    <div class="profile-badges-row">
                        ${age ? `
                        <div class="profile-interest-pill" style="background: rgba(236, 72, 153, 0.08); color: #BE185D;">
                            <span>${escapeHTML(age)} years old</span>
                        </div>
                        ` : ""}

                        <div class="profile-interest-pill" style="background: #F8FAFC; color: #475569; border: 1px solid #E2E8F0;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EC4899" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>${escapeHTML(location)}</span>
                        </div>

                        <div class="profile-interest-pill" style="background: #FFF1F6; color: #DB2777; border: 1px solid #FCE7F3;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                            </svg>
                            <span>${availableDatesCount > 0 ? `${availableDatesCount} Available Dates` : "Dates Available"}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tags & Date Interests Section -->
            <div class="profile-section">
                <h2 class="profile-section-title">Date Interests &amp; Activities</h2>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">
                    ${tagsList.map(tag => `
                        <div class="profile-interest-pill" style="background: #FFF5F8; color: #DB2777; border: 1px solid #FCE7F3; font-weight: 650; padding: 6px 12px; font-size: 12px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span>${escapeHTML(tag)}</span>
                        </div>
                    `).join("")}
                </div>
            </div>

            <!-- About Section -->
            <div class="profile-section">
                <h2 class="profile-section-title">About ${escapeHTML(name)}</h2>
                <p class="profile-bio-text">${escapeHTML(bio)}</p>
                <div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #817783;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Available in <strong>${escapeHTML(location)}</strong> for verified personal dates</span>
                </div>
            </div>

            <!-- Date Booking Highlights -->
            <div class="profile-section">
                <h2 class="profile-section-title">Date Booking Perks</h2>
                <div class="connection-perks">
                    <div class="perk-item">
                        <div class="perk-icon" aria-hidden="true" style="background: #FFF1F6; color: #EC4899;">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>Choose Your Date &amp; Time Slot</strong>
                            <span>Select from real-time admin enabled dates and convenient slots (11 AM to 7 PM).</span>
                        </div>
                    </div>

                    <div class="perk-item">
                        <div class="perk-icon" aria-hidden="true" style="background: #FFF1F6; color: #EC4899;">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>100% Escrow &amp; Safety Concierge</strong>
                            <span>Your payment is secured until the date takes place. Dedicated concierge assistance.</span>
                        </div>
                    </div>

                    <div class="perk-item">
                        <div class="perk-icon" aria-hidden="true" style="background: #FFF1F6; color: #EC4899;">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>Direct Contact &amp; Chat Access</strong>
                            <span>She will contact you to coordinate venue details directly.</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Primary Price & Action Box -->
            <div class="profile-action-box">
                <div class="profile-price-row">
                    <div class="price-service-col">
                        <span class="price-service-label">Personal Date Booking</span>
                        <span class="price-type-label">Base Fee · Transparent Pricing</span>
                    </div>
                    <div class="price-figure">₹${priceFormatted}</div>
                </div>

                <!-- Primary CTA: 4-Step Booking Wizard -->
                <button
                    class="start-connection-btn"
                    id="bookDateBtn"
                    type="button"
                    onclick="openBookingWizard()"
                    style="background: linear-gradient(135deg, #EC4899 0%, #DB2777 100%); margin-bottom: 8px;"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>Book a Date with ${escapeHTML(name)}</span>
                </button>

                <!-- Secondary Option: Chat only -->
                <button
                    type="button"
                    id="payButton"
                    style="width: 100%; padding: 11px; border-radius: 14px; background: #FFF; border: 1.5px solid #FCE7F3; color: #DB2777; font-weight: 700; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>Or Start Private Chat (₹${priceFormatted})</span>
                </button>

                <p class="secure-text" style="margin-top: 10px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#817783" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>Secure payment powered by Razorpay · 100% Escrow Protected</span>
                </p>
            </div>
        </article>
    `;

    // Chat session check
    const verifiedSession = getVerifiedSession(creator.id);
    const payButton = document.getElementById("payButton");
    if (verifiedSession && payButton) {
        payButton.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Open Verified Chat with ${escapeHTML(name)}</span>
        `;
        payButton.onclick = () => {
            window.location.href = `chat.html?id=${encodeURIComponent(creator.id)}&payment_id=${encodeURIComponent(verifiedSession.paymentId)}&token=${encodeURIComponent(verifiedSession.token)}`;
        };
    } else if (payButton) {
        payButton.onclick = startRazorpayChatPayment;
    }
}

function getVerifiedSession(creatorId) {
    try {
        const raw = localStorage.getItem(`fc_chat_session_${creatorId}`);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data && data.token && data.paymentId) return data;
    } catch (_) {}
    return null;
}


// ===============================
// 4-STEP BOOKING WIZARD (PINK THEME)
// ===============================

window.openBookingWizard = function() {
    if (!selectedCreator) return;
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


// ===============================
// CHAT-ONLY RAZORPAY PAYMENT
// ===============================

async function startRazorpayChatPayment() {
    if (!selectedCreator) return;
    const amount = Number(selectedCreator.price) || 49;

    const payButton = document.getElementById("payButton");
    payButton.disabled = true;
    payButton.innerHTML = `<span>Connecting...</span>`;

    try {
        let res = await fetch("/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorId: selectedCreator.id, type: "chat_access" })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to create chat order");
        }

        const options = {
            key: data.keyId,
            amount: data.order.amount,
            currency: "INR",
            name: "Roséia",
            description: `Chat session with ${selectedCreator.name}`,
            order_id: data.order.id,

            handler: async function (paymentResponse) {
                const verifyRes = await fetch("/api/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_order_id: paymentResponse.razorpay_order_id,
                        razorpay_payment_id: paymentResponse.razorpay_payment_id,
                        razorpay_signature: paymentResponse.razorpay_signature,
                        creatorId: selectedCreator.id
                    })
                });
                const verifyData = await verifyRes.json();
                if (verifyRes.ok && verifyData.success) {
                    const sessionData = {
                        token: verifyData.token,
                        paymentId: paymentResponse.razorpay_payment_id,
                        orderId: paymentResponse.razorpay_order_id,
                        creatorId: selectedCreator.id,
                        creatorName: selectedCreator.name
                    };
                    localStorage.setItem(`fc_chat_session_${selectedCreator.id}`, JSON.stringify(sessionData));
                    window.location.href = `chat.html?id=${encodeURIComponent(selectedCreator.id)}&payment_id=${encodeURIComponent(paymentResponse.razorpay_payment_id)}&token=${encodeURIComponent(verifyData.token)}`;
                } else {
                    alert(verifyData.message || "Verification failed");
                    resetPayButton();
                }
            },
            theme: { color: "#EC4899" },
            modal: { ondismiss: resetPayButton }
        };

        const rzp = new Razorpay(options);
        rzp.open();
    } catch (err) {
        alert(err.message || "Unable to start chat payment.");
        resetPayButton();
    }
}

function resetPayButton() {
    const payButton = document.getElementById("payButton");
    if (!payButton || !selectedCreator) return;
    payButton.disabled = false;
    payButton.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Or Start Private Chat (₹${Number(selectedCreator.price).toLocaleString("en-IN")})</span>
    `;
}

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