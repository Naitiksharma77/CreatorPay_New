const API_URL = "https://creatorpay-backend.onrender.com";

// State
let allCreators = [];
let currentTab = "home";
let activeFilter = "all";
let searchQuery = "";

// DOM Elements
const homeView = document.getElementById("tab-home");
const discoverView = document.getElementById("tab-discover");
const chatsView = document.getElementById("tab-chats");

const homePeopleList = document.getElementById("homePeopleList");
const discoverPeopleList = document.getElementById("discoverPeopleList");
const homePeopleCount = document.getElementById("homePeopleCount");
const discoverSearchInput = document.getElementById("discoverSearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const filterChipsContainer = document.getElementById("filterChips");
const chatsContent = document.getElementById("chatsContent");
const profileSheetModal = document.getElementById("profileSheetModal");

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
// STORAGE: FAVORITES & CONNECTIONS
// ===============================

function getFavorites() {
    try {
        const stored = localStorage.getItem("fc_favorites");
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveFavorites(favorites) {
    try {
        localStorage.setItem("fc_favorites", JSON.stringify(favorites));
    } catch (e) {
        console.warn("Unable to save favorites:", e);
    }
}

function getConnections() {
    try {
        const stored = localStorage.getItem("fc_connections");
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function toggleCardFav(event, creatorId) {
    if (event) {
        event.stopPropagation();
    }

    const currentFavs = getFavorites();
    const index = currentFavs.indexOf(String(creatorId));
    let isNowFav = false;

    if (index > -1) {
        currentFavs.splice(index, 1);
    } else {
        currentFavs.push(String(creatorId));
        isNowFav = true;
    }

    saveFavorites(currentFavs);

    // Update heart icons across cards
    const buttons = document.querySelectorAll(`[data-fav-id="${creatorId}"]`);
    buttons.forEach((btn) => {
        const svg = btn.querySelector("svg");
        if (svg) {
            if (isNowFav) {
                btn.classList.add("is-fav");
                svg.setAttribute("fill", "#EC4899");
                svg.setAttribute("stroke", "#EC4899");
                btn.classList.add("heart-pulse");
                setTimeout(() => btn.classList.remove("heart-pulse"), 450);
            } else {
                btn.classList.remove("is-fav");
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "#817783");
            }
        }
    });

    updateSheetStats();
}


// ===============================
// CATEGORY ICONS
// ===============================

function getCategoryIcon(cat) {
    const text = String(cat || "").toLowerCase();

    // Design / Creative / Art
    if (text.includes("design") || text.includes("art") || text.includes("creative") || text.includes("ui") || text.includes("ux")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7h2c3 0 5.6-2.5 5.6-5.6C22 6.5 17.5 2 12 2z"></path>
            </svg>
        `;
    }

    // Technology / Engineering / Code
    if (text.includes("tech") || text.includes("ai") || text.includes("code") || text.includes("enginier") || text.includes("engineer")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
        `;
    }

    // Fashion / Lifestyle / Travel
    if (text.includes("fashion") || text.includes("lifestyle") || text.includes("travel")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
        `;
    }

    // Doctor / Medical / Science
    if (text.includes("doctor") || text.includes("medical") || text.includes("health")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
        `;
    }

    // Student / Education / Teacher
    if (text.includes("student") || text.includes("teacher") || text.includes("commerce")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
        `;
    }

    // Content / Creator
    if (text.includes("content") || text.includes("instagram") || text.includes("creator")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
        `;
    }

    // Default: Lifestyle / Sparkle
    return `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"></path>
        </svg>
    `;
}


// ===============================
// ONLINE STATUS CONFIG & HELPER
// ===============================

const ONLINE_CREATOR_IDS = new Set([
    "3faaf9a9-c333-4d78-b481-7cb2417aa2da", // Gurleen Singh
    "9ed33502-c94a-4bff-ad72-c205dad86a83", // Sonalika
    "18d38626-af2b-4ec6-93d5-a9e30f51d26d", // Sandhya Sharma
    "a9183d22-3b4b-4f16-b244-cfff0f4e7264", // Chanchal
    "4502fa25-d332-4b53-bc2f-7b126a058a6e", // Deeksha Rajput
    "a7cc3e27-c2cf-4952-8bbf-c0317910fb3c", // Aayushi Sharma
    "6264f38a-6536-4d13-94cd-e87669660a85", // Sanjay Rai
    "1eb155f8-ad20-44b5-b8e3-6bef79cd288c", // Priyanshi Sharma
    "88f1199b-948a-464a-bd42-b3116d84f33d"  // Kum Kum Somvanshi
]);

const ONLINE_CREATOR_NAMES = new Set([
    "gurleensingh",
    "sonalika",
    "sandhyasharma",
    "chanchal",
    "deeksharajput",
    "aayushisharma",
    "sanjayrai",
    "priyanshisharma",
    "kumkumsomvanshi"
]);

function isCreatorOnline(creator) {
    if (!creator) return false;
    if (typeof creator.is_online === "boolean") return creator.is_online;
    if (typeof creator.online === "boolean") return creator.online;

    if (creator.id && ONLINE_CREATOR_IDS.has(String(creator.id).trim())) {
        return true;
    }

    if (creator.name) {
        const normalized = String(creator.name).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (ONLINE_CREATOR_NAMES.has(normalized)) {
            return true;
        }
    }

    return false;
}


// ===============================
// PROFILE CARD COMPONENT RENDERER (ROSÉIA REFERENCE DESIGN)
// ===============================

function formatNextOpenDate(dates) {
    if (Array.isArray(dates) && dates.length > 0) {
        // Sort and pick earliest upcoming or first date
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

function getDisplayAge(creator) {
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

function createProfileCardHTML(creator, index) {
    const favIds = getFavorites();
    const isFav = favIds.includes(String(creator.id));

    const image =
        (creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http"))
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

    const name = (creator.name && creator.name.trim()) || "Member";
    const bio = (creator.bio && creator.bio.trim()) || "Excited to meet lovely people, share meaningful stories and start great conversations.";
    const rawPrice = Number(creator.price);
    const price = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice.toLocaleString("en-IN") : "49";
    const profileLink = `friend_profile.html?id=${encodeURIComponent(creator.id)}`;
    const animDelay = Math.min(index * 35, 250);

    const age = getDisplayAge(creator);
    const location = (creator.creator_location && String(creator.creator_location).trim()) || "Available Locally";

    // Tags with middle dot (Coffee & Conversation  ·  Fine Dining)
    let tagsText = "Coffee & Conversation  ·  Fine Dining";
    if (Array.isArray(creator.tags) && creator.tags.length > 0) {
        tagsText = creator.tags.slice(0, 2).map(t => String(t).trim()).join("  ·  ");
    } else if (typeof creator.tags === "string" && creator.tags.trim()) {
        tagsText = creator.tags.split(",").slice(0, 2).map(t => t.trim()).join("  ·  ");
    }

    const nextOpenDate = formatNextOpenDate(creator.available_dates);

    return `
        <article class="roseia-card social-card" style="animation-delay: ${animDelay}ms;" onclick="window.location.href='${profileLink}'" role="button" tabindex="0" onkeydown="if(event.key==='Enter') window.location.href='${profileLink}'">
            <div class="card-image-wrap">
                <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" class="card-image" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">
                
                <button
                    type="button"
                    class="card-fav-btn ${isFav ? 'is-fav' : ''}"
                    data-fav-id="${escapeHTML(creator.id)}"
                    onclick="toggleCardFav(event, '${escapeHTML(creator.id)}')"
                    aria-label="Save ${escapeHTML(name)}"
                    title="Save person"
                >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="${isFav ? '#E11D48' : 'none'}" stroke="${isFav ? '#E11D48' : '#1F2937'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>

                <div class="card-image-overlay">
                    <div class="card-overlay-left">
                        <div class="card-overlay-name">${escapeHTML(name)}, ${escapeHTML(age)}</div>
                        <div class="card-overlay-location">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>${escapeHTML(location)}</span>
                        </div>
                    </div>
                    <div class="card-overlay-price">₹${price}</div>
                </div>
            </div>

            <div class="card-content-wrap">
                <p class="card-bio-text">${escapeHTML(bio)}</p>

                <div class="card-tags-line">${escapeHTML(tagsText)}</div>

                <div class="card-availability-line">
                    <span class="card-open-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>Next open date: ${escapeHTML(nextOpenDate)}</span>
                    </span>
                    <span class="card-meta-dot">·</span>
                    <span class="card-duration">120 min</span>
                </div>

                <div class="card-actions-row">
                    <a class="btn-view-profile" href="${profileLink}" onclick="event.stopPropagation();" aria-label="View Profile of ${escapeHTML(name)}">
                        View Profile
                    </a>
                    <button type="button" class="btn-book-date" onclick="event.stopPropagation(); window.openBookingForCreator('${escapeHTML(creator.id)}');" aria-label="Book a Date with ${escapeHTML(name)}">
                        Book a Date
                    </button>
                </div>
            </div>
        </article>
    `;
}

// Global hook to open booking modal directly or fallback to friend_profile
window.openBookingForCreator = function(creatorId) {
    const creator = allCreators.find(c => String(c.id) === String(creatorId));
    if (creator && window.RoseiaBooking) {
        window.RoseiaBooking.open(creator);
    } else {
        window.location.href = `friend_profile.html?id=${encodeURIComponent(creatorId)}&action=book`;
    }
};


// ===============================
// SEARCH & FILTERS STATE & LOGIC
// ===============================

let filterCity = "all";
let filterDate = "";
let filterSort = "popularity";
let filterMaxPrice = 500;
let filterInterest = "all";

function populateCityOptions() {
    const citySelect = document.getElementById("filterCitySelect");
    if (!citySelect) return;
    const cities = new Set();
    allCreators.forEach(c => {
        const loc = (c.creator_location || c.location || "").trim();
        if (loc && !loc.toLowerCase().includes("available locally")) {
            const cityName = loc.split(",")[0].trim();
            if (cityName) cities.add(cityName);
        }
    });

    const currentVal = citySelect.value;
    let html = `<option value="all">All Cities</option>`;
    Array.from(cities).sort().forEach(city => {
        html += `<option value="${escapeHTML(city)}">${escapeHTML(city)}</option>`;
    });
    citySelect.innerHTML = html;
    if (currentVal && cities.has(currentVal)) {
        citySelect.value = currentVal;
    }
}

// ===============================
// RENDER FEEDS
// ===============================

function renderHomeFeed() {
    if (!homePeopleList) return;

    if (homePeopleCount) {
        homePeopleCount.textContent = `${allCreators.length} people`;
    }

    if (allCreators.length === 0) {
        homePeopleList.innerHTML = `
            <div class="loading-state">
                <span class="loading-spinner"></span>
                <p>Loading curated profiles...</p>
            </div>
        `;
        return;
    }

    homePeopleList.innerHTML = allCreators
        .map((creator, i) => createProfileCardHTML(creator, i))
        .join("");
}

function renderDiscoverFeed() {
    if (!discoverPeopleList) return;

    let filtered = [...allCreators];

    // 1. Text Search Query
    if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(c => {
            const name = String(c.name || "").toLowerCase();
            const bio = String(c.bio || "").toLowerCase();
            const loc = String(c.creator_location || c.location || "").toLowerCase();
            const tags = Array.isArray(c.tags) ? c.tags.join(" ").toLowerCase() : String(c.tags || "").toLowerCase();
            return name.includes(query) || bio.includes(query) || loc.includes(query) || tags.includes(query);
        });
    }

    // 2. City Filter
    if (filterCity !== "all") {
        const cityLower = filterCity.toLowerCase();
        filtered = filtered.filter(c => {
            const loc = String(c.creator_location || c.location || "").toLowerCase();
            return loc.includes(cityLower);
        });
    }

    // 3. Available Date Filter
    if (filterDate) {
        filtered = filtered.filter(c => {
            if (Array.isArray(c.available_dates) && c.available_dates.length > 0) {
                return c.available_dates.includes(filterDate);
            }
            return true;
        });
    }

    // 4. Maximum Price Slider
    if (filterMaxPrice && filterMaxPrice < 1000) {
        filtered = filtered.filter(c => {
            const price = Number(c.price) || 0;
            return price <= filterMaxPrice;
        });
    }

    // 5. Interest Filter
    if (filterInterest !== "all") {
        const interestLower = filterInterest.toLowerCase();
        filtered = filtered.filter(c => {
            const tags = Array.isArray(c.tags) ? c.tags.join(" ").toLowerCase() : String(c.tags || "").toLowerCase();
            const bio = String(c.bio || "").toLowerCase();
            return tags.includes(interestLower) || bio.includes(interestLower);
        });
    }

    // 6. Sort
    if (filterSort === "price_low") {
        filtered.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (filterSort === "price_high") {
        filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (filterSort === "age_young") {
        filtered.sort((a, b) => (Number(getDisplayAge(a)) || 25) - (Number(getDisplayAge(b)) || 25));
    } else {
        filtered = sortFeaturedCreators(filtered);
    }

    // Update Result Count text
    const countEl = document.getElementById("discoverResultCount");
    if (countEl) {
        countEl.textContent = `Showing ${filtered.length} creator profile${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
        discoverPeopleList.innerHTML = `
            <div class="empty-chats-state" style="grid-column: 1 / -1; padding: 48px 20px;">
                <h3 class="empty-title">No creators found</h3>
                <p class="empty-desc">Try adjusting your city, date, or budget filter to see more profiles.</p>
                <button class="empty-action-btn" onclick="resetFilters()">Reset All Filters</button>
            </div>
        `;
        return;
    }

    discoverPeopleList.innerHTML = filtered
        .map((creator, i) => createProfileCardHTML(creator, i))
        .join("");
}

function renderChatsFeed() {
    if (!chatsContent) return;

    const connections = getConnections();

    if (connections.length === 0) {
        chatsContent.innerHTML = `
            <div class="empty-chats-state">
                <div class="empty-chat-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <h3 class="empty-title">Your conversations will appear here.</h3>
                <p class="empty-desc">Say hi to someone special to start your first beautiful conversation.</p>
                <button class="empty-action-btn" onclick="switchTab('discover')">Discover People</button>
            </div>
        `;
        return;
    }

    chatsContent.innerHTML = `
        <div class="chats-list">
            ${connections
                .map((conn) => {
                    let targetLink = `friend_profile.html?id=${encodeURIComponent(conn.id)}`;
                    let chatSubtitle = "Connection confirmed · Tap to chat";
                    try {
                        const rawSession = localStorage.getItem(`fc_chat_session_${conn.id}`);
                        if (rawSession) {
                            const sess = JSON.parse(rawSession);
                            if (sess && sess.token && sess.paymentId) {
                                targetLink = `chat.html?id=${encodeURIComponent(conn.id)}&payment_id=${encodeURIComponent(sess.paymentId)}&token=${encodeURIComponent(sess.token)}`;
                                chatSubtitle = "Private Chat Unlocked · Tap to message";
                            }
                        }
                    } catch (_) {}
                    return `
                        <div class="chat-row" onclick="window.location.href='${targetLink}'">
                            <div class="chat-avatar-wrap">
                                <img src="${escapeHTML(conn.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80')}" alt="${escapeHTML(conn.name)}">
                            </div>
                            <div class="chat-info">
                                <div class="chat-header-line">
                                    <span class="chat-name">${escapeHTML(conn.name)}</span>
                                    <span class="chat-time">Connected</span>
                                </div>
                                <div class="chat-preview">${chatSubtitle}</div>
                            </div>
                        </div>
                    `;
                })
                .join("")}
        </div>
    `;
}

function resetFilters() {
    searchQuery = "";
    filterCity = "all";
    filterDate = "";
    filterSort = "popularity";
    filterMaxPrice = 500;
    filterInterest = "all";

    const searchInput = document.getElementById("discoverSearchInput");
    if (searchInput) searchInput.value = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";

    const citySelect = document.getElementById("filterCitySelect");
    if (citySelect) citySelect.value = "all";

    const dateInput = document.getElementById("filterDateInput");
    if (dateInput) dateInput.value = "";

    const sortSelect = document.getElementById("filterSortSelect");
    if (sortSelect) sortSelect.value = "popularity";

    const slider = document.getElementById("priceRangeSlider");
    if (slider) slider.value = 500;
    const readout = document.getElementById("priceSliderReadout");
    if (readout) readout.textContent = "Up to ₹500";

    document.querySelectorAll(".interest-tag-btn").forEach((btn) => btn.classList.remove("active"));

    renderDiscoverFeed();
}


const PINNED_NAMES = ["naina", "radhikachouhan", "radhika", "pallavithakur", "pallavi"];
function sortFeaturedCreators(list) {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
        const normA = String(a.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const normB = String(b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const idxA = PINNED_NAMES.findIndex(p => normA.includes(p));
        const idxB = PINNED_NAMES.findIndex(p => normB.includes(p));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });
}

// ===============================
// TAB SWITCHING (EXPLORE, SEARCH, FAVORITES, BOOKINGS)
// ===============================

function switchTab(tabName) {
    // Map aliases
    let normalizedTab = tabName;
    if (tabName === "home") normalizedTab = "explore";
    if (tabName === "discover") normalizedTab = "search";
    if (tabName === "chats") normalizedTab = "bookings";

    if (normalizedTab === "profile") {
        toggleProfileSheet();
        return;
    }

    currentTab = normalizedTab;

    // Update views
    if (homeView) homeView.classList.toggle("active", normalizedTab === "explore" || normalizedTab === "favorites");
    if (discoverView) discoverView.classList.toggle("active", normalizedTab === "search");
    if (chatsView) chatsView.classList.toggle("active", normalizedTab === "bookings");

    // Update bottom navigation buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        const bTab = btn.dataset.tab;
        const matches = (bTab === normalizedTab) ||
            (bTab === "home" && normalizedTab === "explore") ||
            (bTab === "discover" && normalizedTab === "search") ||
            (bTab === "chats" && normalizedTab === "bookings");
        btn.classList.toggle("active", matches);
    });

    // Update desktop navigation links in header
    document.querySelectorAll(".desktop-nav-link").forEach((link) => {
        const lTab = link.dataset.tab;
        const matches = (lTab === normalizedTab) ||
            (lTab === "home" && normalizedTab === "explore") ||
            (lTab === "discover" && normalizedTab === "search") ||
            (lTab === "chats" && normalizedTab === "bookings");
        link.classList.toggle("active", matches);
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Render corresponding view
    if (normalizedTab === "explore") renderHomeFeed();
    if (normalizedTab === "search") renderDiscoverFeed();
    if (normalizedTab === "bookings") renderChatsFeed();
    if (normalizedTab === "favorites") renderFavoritesFeed();

    // Update window hash
    if (window.location.hash !== `#${normalizedTab}`) {
        window.history.replaceState(null, "", `#${normalizedTab}`);
    }
}

function renderFavoritesFeed() {
    if (!homePeopleList) return;
    const favIds = getFavorites();
    const favCreators = allCreators.filter(c => favIds.includes(String(c.id)));

    if (homePeopleCount) {
        homePeopleCount.textContent = `${favCreators.length} saved`;
    }

    if (favCreators.length === 0) {
        homePeopleList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: 20px; border: 1px solid #F3E8EE;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D93B78" stroke-width="1.8" style="margin: 0 auto 14px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <h3 style="font-size: 18px; font-weight: 700; color: #1F2937; margin-bottom: 6px;">No saved favorites yet</h3>
                <p style="color: #6B7280; font-size: 14px; margin-bottom: 18px;">Click the heart icon on any card to save lovely people here.</p>
                <button type="button" onclick="switchTab('explore')" class="btn-book-date" style="display: inline-flex; width: auto; padding: 10px 22px;">Explore Profiles</button>
            </div>
        `;
        return;
    }

    homePeopleList.innerHTML = favCreators.map(createProfileCardHTML).join("");
}


// ===============================
// PROFILE SHEET MODAL
// ===============================

function toggleProfileSheet() {
    if (!profileSheetModal) return;
    const isActive = profileSheetModal.classList.contains("active");

    if (isActive) {
        profileSheetModal.classList.remove("active");
        profileSheetModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    } else {
        updateSheetStats();
        profileSheetModal.classList.add("active");
        profileSheetModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }
}

function updateSheetStats() {
    const connectionsCount = document.getElementById("sheetConnectionsCount");
    const favoritesCount = document.getElementById("sheetFavoritesCount");

    if (connectionsCount) {
        connectionsCount.textContent = getConnections().length;
    }
    if (favoritesCount) {
        favoritesCount.textContent = getFavorites().length;
    }
}


// ===============================
// LOAD DATA FROM SERVER (IMMEDIATE + LIVE)
// ===============================

async function loadCreators() {
    // 1. Immediately display cached profiles if available so screen opens instantly
    try {
        const cached = localStorage.getItem("fc_cached_creators");
        if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list) && list.length > 0) {
                allCreators = sortFeaturedCreators(list);
                renderHomeFeed();
                renderDiscoverFeed();
                renderChatsFeed();
            }
        }
    } catch (_) {}

    // 2. Fetch fresh live profiles (prefer same-origin /api/creators, fallback to Render backend)
    try {
        let freshList = [];
        let fetched = false;

        // Try same-origin first
        try {
            const localController = new AbortController();
            const localTimeout = setTimeout(() => localController.abort(), 3500);
            const localRes = await fetch("/api/creators", { signal: localController.signal });
            clearTimeout(localTimeout);
            if (localRes.ok) {
                const localData = await localRes.json();
                if (localData && localData.success && Array.isArray(localData.creators) && localData.creators.length > 0) {
                    freshList = localData.creators;
                    fetched = true;
                }
            }
        } catch (_) {}

        // Fallback to Render backend if needed
        if (!fetched) {
            try {
                const renderController = new AbortController();
                const renderTimeout = setTimeout(() => renderController.abort(), 4500);
                const response = await fetch(`${API_URL}/api/creators`, { signal: renderController.signal });
                clearTimeout(renderTimeout);
                if (response.ok) {
                    const result = await response.json();
                    if (result && result.success && Array.isArray(result.creators) && result.creators.length > 0) {
                        freshList = result.creators;
                        fetched = true;
                    }
                }
            } catch (_) {}
        }

        if (fetched && freshList.length > 0) {
            allCreators = sortFeaturedCreators(freshList);
            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(allCreators));
            } catch (_) {}

            populateCityOptions();
            renderHomeFeed();
            renderDiscoverFeed();
            renderChatsFeed();
        } else if (allCreators.length === 0) {
            if (homePeopleList) {
                homePeopleList.innerHTML = `
                    <div class="empty-chats-state">
                        <h3 class="empty-title">Loading profiles...</h3>
                        <p class="empty-desc">Render backend is connecting. Tap to refresh.</p>
                        <button class="empty-action-btn" onclick="loadCreators()">Refresh Profiles</button>
                    </div>
                `;
            }
        }

    } catch (err) {
        console.warn("Issue loading creators:", err);
    }
}


// ===============================
// EVENT LISTENERS & INITIALIZATION
// ===============================

document.addEventListener("DOMContentLoaded", () => {
    // Header elevation on scroll
    let ticking = false;
    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const header = document.querySelector(".app-header");
                if (header) {
                    header.classList.toggle("is-scrolled", window.scrollY > 6);
                }
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    // Bottom tab bar buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetTab = btn.dataset.tab;
            if (targetTab) switchTab(targetTab);
        });
    });

    // Search input in Search & Filters
    if (discoverSearchInput) {
        discoverSearchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value;
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchQuery ? "flex" : "none";
            }
            renderDiscoverFeed();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener("click", () => {
            if (discoverSearchInput) discoverSearchInput.value = "";
            searchQuery = "";
            clearSearchBtn.style.display = "none";
            renderDiscoverFeed();
        });
    }

    // City Dropdown Filter
    const citySelect = document.getElementById("filterCitySelect");
    if (citySelect) {
        citySelect.addEventListener("change", (e) => {
            filterCity = e.target.value;
            renderDiscoverFeed();
        });
    }

    // Available Date Filter
    const dateInput = document.getElementById("filterDateInput");
    if (dateInput) {
        dateInput.addEventListener("change", (e) => {
            filterDate = e.target.value;
            renderDiscoverFeed();
        });
    }

    // Sort By Dropdown Filter
    const sortSelect = document.getElementById("filterSortSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            filterSort = e.target.value;
            renderDiscoverFeed();
        });
    }

    // Maximum Date Price Slider
    const priceSlider = document.getElementById("priceRangeSlider");
    const priceReadout = document.getElementById("priceSliderReadout");
    if (priceSlider) {
        priceSlider.addEventListener("input", (e) => {
            filterMaxPrice = Number(e.target.value);
            if (priceReadout) {
                priceReadout.textContent = `Up to ₹${filterMaxPrice}`;
            }
            renderDiscoverFeed();
        });
    }

    // Interests Tag Buttons (toggle filter)
    document.querySelectorAll(".interest-tag-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const interest = btn.dataset.interest;
            if (btn.classList.contains("active")) {
                btn.classList.remove("active");
                filterInterest = "all";
            } else {
                document.querySelectorAll(".interest-tag-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                filterInterest = interest || "all";
            }
            renderDiscoverFeed();
        });
    });

    // Determine initial tab from URL hash
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash === "discover" || hash === "search") {
        switchTab("search");
    } else if (hash === "chats" || hash === "bookings") {
        switchTab("bookings");
    } else if (hash === "favorites") {
        switchTab("favorites");
    } else {
        switchTab("explore");
    }

    // Immediately load creators as soon as website opens
    loadCreators();
});
