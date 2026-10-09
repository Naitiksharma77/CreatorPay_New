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
                svg.setAttribute("fill", "#ef4444");
                svg.setAttribute("stroke", "#ef4444");
            } else {
                btn.classList.remove("is-fav");
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "#94a3b8");
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
// PROFILE CARD COMPONENT RENDERER
// ===============================

function createProfileCardHTML(creator, index) {
    const favIds = getFavorites();
    const isFav = favIds.includes(String(creator.id));
    const isOnline = isCreatorOnline(creator);

    const image =
        (creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http"))
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

    const name = (creator.name && creator.name.trim()) || "Friend";
    const category = (creator.category && creator.category.trim()) || "Conversations & Lifestyle";
    const bio = (creator.bio && creator.bio.trim()) || "Open to friendly conversations, shared experiences and making new friends.";
    const rawPrice = Number(creator.price);
    const price = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice.toLocaleString("en-IN") : "49";
    const profileLink = `friend_profile.html?id=${encodeURIComponent(creator.id)}`;
    const animDelay = Math.min(index * 35, 250);

    return `
        <article class="social-card" style="animation-delay: ${animDelay}ms;" onclick="window.location.href='${profileLink}'" role="button" tabindex="0" onkeydown="if(event.key==='Enter') window.location.href='${profileLink}'">
            <div class="card-top-row">
                <div class="avatar-ring-wrap">
                    <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">
                    ${isOnline ? `<span class="active-status-dot" title="Active now" aria-hidden="true"></span>` : ""}
                </div>

                <div class="card-identity">
                    <div class="name-line">
                        <span class="person-name">${escapeHTML(name)}</span>
                        <span class="verified-badge" title="Verified Member">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" fill="#2563eb"></circle>
                                <path d="M8 12l3 3 5-5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                            </svg>
                        </span>
                    </div>

                    <div class="interest-badge">
                        ${getCategoryIcon(category)}
                        <span>${escapeHTML(category)}</span>
                    </div>
                </div>

                <button
                    type="button"
                    class="card-fav-btn ${isFav ? 'is-fav' : ''}"
                    data-fav-id="${escapeHTML(creator.id)}"
                    onclick="toggleCardFav(event, '${escapeHTML(creator.id)}')"
                    aria-label="Save ${escapeHTML(name)}"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? '#ef4444' : 'none'}" stroke="${isFav ? '#ef4444' : '#94a3b8'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
            </div>

            <p class="card-bio">${escapeHTML(bio)}</p>

            <div class="card-bottom-row">
                <div class="card-price-group">
                    <span class="price-val">₹${price}</span>
                    <span class="price-unit">/ connection</span>
                </div>

                <a class="view-profile-btn" href="${profileLink}" onclick="event.stopPropagation();" aria-label="View profile of ${escapeHTML(name)}">
                    <span>View Profile</span>
                    <svg class="chevron-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </a>
            </div>
        </article>
    `;
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
                <p>Loading people from database...</p>
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

    let filtered = allCreators;

    // Filter by Category
    if (activeFilter !== "all") {
        const filterKey = activeFilter.toLowerCase();
        filtered = filtered.filter((c) => {
            const cat = String(c.category || "").toLowerCase();
            const bio = String(c.bio || "").toLowerCase();

            if (filterKey === "content") {
                return cat.includes("content") || cat.includes("instagram") || cat.includes("fashion") || cat.includes("lifestyle") || bio.includes("instagram");
            }
            if (filterKey === "design") {
                return cat.includes("art") || cat.includes("paint") || cat.includes("design") || cat.includes("creative");
            }
            if (filterKey === "tech") {
                return cat.includes("student") || cat.includes("enginier") || cat.includes("engineer") || cat.includes("tech") || cat.includes("science") || cat.includes("doctor") || cat.includes("medical");
            }
            if (filterKey === "conversation") {
                return cat.includes("coach") || cat.includes("finance") || cat.includes("guidance") || cat.includes("unemployed") || cat.includes("conversation") || cat.includes("teacher");
            }
            return cat.includes(filterKey);
        });
    }

    // Filter by Search Query
    if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((c) => {
            const name = String(c.name || "").toLowerCase();
            const cat = String(c.category || "").toLowerCase();
            const bio = String(c.bio || "").toLowerCase();
            return name.includes(query) || cat.includes(query) || bio.includes(query);
        });
    }

    if (filtered.length === 0) {
        discoverPeopleList.innerHTML = `
            <div class="empty-chats-state">
                <h3 class="empty-title">No people found</h3>
                <p class="empty-desc">Try searching for a different name, stream, or topic.</p>
                <button class="empty-action-btn" onclick="resetFilters()">Reset Filter</button>
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
                <p class="empty-desc">Connect with someone to start your first conversation.</p>
                <button class="empty-action-btn" onclick="switchTab('discover')">Discover People</button>
            </div>
        `;
        return;
    }

    chatsContent.innerHTML = `
        <div class="chats-list">
            ${connections
                .map((conn) => {
                    const profileLink = `friend_profile.html?id=${encodeURIComponent(conn.id)}`;
                    return `
                        <div class="chat-row" onclick="window.location.href='${profileLink}'">
                            <div class="chat-avatar-wrap">
                                <img src="${escapeHTML(conn.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80')}" alt="${escapeHTML(conn.name)}">
                            </div>
                            <div class="chat-info">
                                <div class="chat-header-line">
                                    <span class="chat-name">${escapeHTML(conn.name)}</span>
                                    <span class="chat-time">Active</span>
                                </div>
                                <div class="chat-preview">Connection confirmed · Tap to chat &amp; view session</div>
                            </div>
                        </div>
                    `;
                })
                .join("")}
        </div>
    `;
}

function resetFilters() {
    activeFilter = "all";
    searchQuery = "";
    if (discoverSearchInput) discoverSearchInput.value = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";

    document.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.category === "all");
    });

    renderDiscoverFeed();
}


// ===============================
// TAB SWITCHING (HOME, DISCOVER, CHATS)
// ===============================

function switchTab(tabName) {
    currentTab = tabName;

    // Update views
    if (homeView) homeView.classList.toggle("active", tabName === "home");
    if (discoverView) discoverView.classList.toggle("active", tabName === "discover");
    if (chatsView) chatsView.classList.toggle("active", tabName === "chats");

    // Update bottom navigation buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Render corresponding view
    if (tabName === "home") renderHomeFeed();
    if (tabName === "discover") renderDiscoverFeed();
    if (tabName === "chats") renderChatsFeed();

    // Update window hash
    if (window.location.hash !== `#${tabName}`) {
        window.history.replaceState(null, "", `#${tabName}`);
    }
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
                allCreators = list;
                renderHomeFeed();
                renderDiscoverFeed();
                renderChatsFeed();
            }
        }
    } catch (_) {}

    // 2. Fetch fresh live profiles from Render backend
    try {
        const response = await fetch(`${API_URL}/api/creators`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to load profiles");
        }

        const freshList = Array.isArray(result.creators) ? result.creators : [];
        if (freshList.length > 0) {
            allCreators = freshList;
            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(freshList));
            } catch (_) {}

            renderHomeFeed();
            renderDiscoverFeed();
            renderChatsFeed();
        }

    } catch (err) {
        console.warn("Live fetch from Render backend encountered an issue, trying fallback:", err);

        // If nothing was loaded from cache, attempt fallback to local proxy
        if (allCreators.length === 0) {
            try {
                const fallbackRes = await fetch("/api/creators");
                const fallbackData = await fallbackRes.json();
                if (fallbackData && fallbackData.success && Array.isArray(fallbackData.creators)) {
                    allCreators = fallbackData.creators;
                    renderHomeFeed();
                    renderDiscoverFeed();
                    renderChatsFeed();
                    return;
                }
            } catch (_) {}

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

    // Category filter chips in Discover
    document.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");
            activeFilter = chip.dataset.category || "all";
            renderDiscoverFeed();
        });
    });

    // Search input in Discover
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

    // Determine initial tab from URL hash
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash === "discover") {
        switchTab("discover");
    } else if (hash === "chats") {
        switchTab("chats");
    } else {
        switchTab("home");
    }

    // Immediately load creators as soon as website opens
    loadCreators();
});
