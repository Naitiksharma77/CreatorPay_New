const RENDER_BACKEND_URL = "https://creatorpay-backend.onrender.com";

// State
let allCreators = [];
let currentTab = "home";
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
const chatsContent = document.getElementById("chatsContent");
const profileSheetModal = document.getElementById("profileSheetModal");

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

window.toggleCardFav = function (event, creatorId) {
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

    const buttons = document.querySelectorAll(`[data-fav-id="${creatorId}"]`);
    buttons.forEach((btn) => {
        const svg = btn.querySelector("svg");
        if (svg) {
            if (isNowFav) {
                btn.classList.add("is-fav");
                svg.setAttribute("fill", "#2563EB");
                svg.setAttribute("stroke", "#2563EB");
            } else {
                btn.classList.remove("is-fav");
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "#0F172A");
            }
        }
    });

    updateSheetStats();
};

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
    const profileLink = `friend_profile.html?id=${encodeURIComponent(creator.id)}`;
    const animDelay = Math.min(index * 30, 220);

    let tagsText = "Coffee & Conversation  ·  Fine Dining";
    if (Array.isArray(creator.tags) && creator.tags.length > 0) {
        tagsText = creator.tags.slice(0, 2).map((t) => String(t).trim()).join("  ·  ");
    } else if (typeof creator.tags === "string" && creator.tags.trim()) {
        tagsText = creator.tags.split(",").slice(0, 2).map((t) => t.trim()).join("  ·  ");
    }

    return `
        <article class="roseia-card social-card" style="animation-delay: ${animDelay}ms;" onclick="window.location.href='${profileLink}'" role="button" tabindex="0" onkeydown="if(event.key==='Enter') window.location.href='${profileLink}'">
            <div class="card-image-wrap">
                <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" class="card-image" style="object-position: 50% 20%;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">

                <button
                    type="button"
                    class="card-fav-btn ${isFav ? "is-fav" : ""}"
                    data-fav-id="${escapeHTML(creator.id)}"
                    onclick="toggleCardFav(event, '${escapeHTML(creator.id)}')"
                    aria-label="Save ${escapeHTML(name)}"
                    title="Save profile"
                >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="${isFav ? "#2563EB" : "none"}" stroke="${isFav ? "#2563EB" : "#0F172A"}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>

                <div class="card-image-overlay">
                    <div class="card-overlay-left">
                        <div class="card-overlay-name">${escapeHTML(name)}</div>
                    </div>
                </div>
            </div>

            <div class="card-content-wrap">
                <p class="card-bio-text">${escapeHTML(bio)}</p>

                <div class="card-tags-line">${escapeHTML(tagsText)}</div>

                <div class="card-actions-row">
                    <a class="btn-view-profile" href="${profileLink}" onclick="event.stopPropagation();" aria-label="View Profile of ${escapeHTML(name)}">
                        View Profile
                    </a>
                    <button type="button" class="btn-book-date" onclick="event.stopPropagation(); window.openVideoCallForCreator('${escapeHTML(creator.id)}');" aria-label="Video Call ${escapeHTML(name)}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; flex-shrink: 0;" aria-hidden="true">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                        Video Call
                    </button>
                </div>
            </div>
        </article>
    `;
}

window.openVideoCallForCreator = function (creatorId) {
    const creator = allCreators.find((c) => String(c.id) === String(creatorId));
    if (creator && window.TakoraAuth && typeof window.TakoraAuth.checkAndStartInteraction === "function") {
        window.TakoraAuth.checkAndStartInteraction(creator, "video");
    } else if (creator && window.openInteractionModal) {
        window.openInteractionModal(creator, "video");
    } else {
        window.location.href = `friend_profile.html?id=${encodeURIComponent(creatorId)}&action=video`;
    }
};

window.openConnectForCreator = function (creatorId) {
    const creator = allCreators.find((c) => String(c.id) === String(creatorId));
    if (creator && window.openInteractionModal) {
        window.openInteractionModal(creator, "chat");
    } else {
        window.location.href = `friend_profile.html?id=${encodeURIComponent(creatorId)}&action=chat`;
    }
};

window.openBookingForCreator = window.openConnectForCreator;
window.openSayHiForCreator = window.openConnectForCreator;

// Filters state (no per-creator price filters)
let filterCity = "all";
let filterDate = "";
let filterSort = "popularity";
let filterInterest = "all";

function populateCityOptions() {
    const citySelect = document.getElementById("filterCitySelect");
    if (!citySelect) return;
    const cities = new Set();
    allCreators.forEach((c) => {
        const loc = (c.creator_location || c.location || "").trim();
        if (loc && !loc.toLowerCase().includes("available locally")) {
            const cityName = loc.split(",")[0].trim();
            if (cityName) cities.add(cityName);
        }
    });

    const currentVal = citySelect.value;
    let html = `<option value="all">All Cities</option>`;
    Array.from(cities).sort().forEach((city) => {
        html += `<option value="${escapeHTML(city)}">${escapeHTML(city)}</option>`;
    });
    citySelect.innerHTML = html;
    if (currentVal && cities.has(currentVal)) {
        citySelect.value = currentVal;
    }
}

function sortCreatorsByNewestFirst(list) {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
        const timeA = a && a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b && b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
    });
}
const sortFeaturedCreators = sortCreatorsByNewestFirst;

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

    if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((c) => {
            const name = String(c.name || "").toLowerCase();
            const bio = String(c.bio || "").toLowerCase();
            const loc = String(c.creator_location || c.location || "").toLowerCase();
            const tags = Array.isArray(c.tags) ? c.tags.join(" ").toLowerCase() : String(c.tags || "").toLowerCase();
            return name.includes(query) || bio.includes(query) || loc.includes(query) || tags.includes(query);
        });
    }

    if (filterCity !== "all") {
        const cityLower = filterCity.toLowerCase();
        filtered = filtered.filter((c) => {
            const loc = String(c.creator_location || c.location || "").toLowerCase();
            return loc.includes(cityLower);
        });
    }

    if (filterDate) {
        filtered = filtered.filter((c) => {
            if (Array.isArray(c.available_dates) && c.available_dates.length > 0) {
                return c.available_dates.includes(filterDate);
            }
            return true;
        });
    }

    if (filterInterest !== "all") {
        const interestLower = filterInterest.toLowerCase();
        filtered = filtered.filter((c) => {
            const tags = Array.isArray(c.tags) ? c.tags.join(" ").toLowerCase() : String(c.tags || "").toLowerCase();
            const bio = String(c.bio || "").toLowerCase();
            return tags.includes(interestLower) || bio.includes(interestLower);
        });
    }

    if (filterSort === "name_asc") {
        filtered.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (filterSort === "age_young") {
        filtered.sort((a, b) => (Number(getDisplayAge(a)) || 25) - (Number(getDisplayAge(b)) || 25));
    } else {
        filtered = sortFeaturedCreators(filtered);
    }

    const countEl = document.getElementById("discoverResultCount");
    if (countEl) {
        countEl.textContent = `Showing ${filtered.length} creator profile${filtered.length === 1 ? "" : "s"}`;
    }

    if (filtered.length === 0) {
        discoverPeopleList.innerHTML = `
            <div class="empty-chats-state" style="grid-column: 1 / -1; padding: 48px 20px;">
                <h3 class="empty-title">No creators found</h3>
                <p class="empty-desc">Try adjusting your search query or interest filter to see more profiles.</p>
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

    const auth = window.TakoraAuth ? window.TakoraAuth.getState() : { authenticated: false, entitlements: { chat: false } };
    const connections = getConnections();

    if (!auth.authenticated || !auth.entitlements || !auth.entitlements.chat) {
        chatsContent.innerHTML = `
            <div class="empty-chats-state">
                <div class="empty-chat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <h3 class="empty-title">Unlock 1-on-1 Chat &amp; Calls</h3>
                <p class="empty-desc">Activate a monthly membership starting at ₹9/month to chat, call, and connect across all creators.</p>
                <a href="pricing.html" class="empty-action-btn">View Membership Plans</a>
            </div>
        `;
        return;
    }

    if (connections.length === 0) {
        chatsContent.innerHTML = `
            <div class="empty-chats-state">
                <div class="empty-chat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <h3 class="empty-title">Your membership is active</h3>
                <p class="empty-desc">Connect with any creator from Explore to start your first private conversation.</p>
                <button type="button" class="empty-action-btn" onclick="switchTab('explore')">Explore Creators</button>
            </div>
        `;
        return;
    }

    chatsContent.innerHTML = `
        <div class="chats-list">
            ${connections
                .map((conn) => {
                    const targetLink = `chat.html?id=${encodeURIComponent(conn.id)}`;
                    return `
                        <div class="chat-row" onclick="window.location.href='${targetLink}'">
                            <div class="chat-avatar-wrap">
                                <img src="${escapeHTML(conn.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80")}" alt="${escapeHTML(conn.name)}">
                            </div>
                            <div class="chat-info">
                                <div class="chat-header-line">
                                    <span class="chat-name">${escapeHTML(conn.name)}</span>
                                    <span class="chat-time">Membership Active</span>
                                </div>
                                <div class="chat-preview">Tap to continue your private conversation</div>
                            </div>
                        </div>
                    `;
                })
                .join("")}
        </div>
    `;
}

window.resetFilters = function () {
    searchQuery = "";
    filterCity = "all";
    filterDate = "";
    filterSort = "popularity";
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

    document.querySelectorAll(".interest-tag-btn").forEach((btn) => btn.classList.remove("active"));
    renderDiscoverFeed();
};

window.switchTab = function (tabName) {
    let normalizedTab = tabName;
    if (tabName === "home") normalizedTab = "explore";
    if (tabName === "discover") normalizedTab = "search";
    if (tabName === "chats") normalizedTab = "bookings";

    if (normalizedTab === "profile") {
        toggleProfileSheet();
        return;
    }

    currentTab = normalizedTab;

    if (homeView) homeView.classList.toggle("active", normalizedTab === "explore" || normalizedTab === "favorites");
    if (discoverView) discoverView.classList.toggle("active", normalizedTab === "search");
    if (chatsView) chatsView.classList.toggle("active", normalizedTab === "bookings");

    document.querySelectorAll(".tab-btn").forEach((btn) => {
        const bTab = btn.dataset.tab;
        const matches =
            (bTab === normalizedTab) ||
            (bTab === "home" && normalizedTab === "explore") ||
            (bTab === "discover" && normalizedTab === "search") ||
            (bTab === "chats" && normalizedTab === "bookings");
        btn.classList.toggle("active", matches);
    });

    document.querySelectorAll(".desktop-nav-link").forEach((link) => {
        const lTab = link.dataset.tab;
        const matches =
            (lTab === normalizedTab) ||
            (lTab === "home" && normalizedTab === "explore") ||
            (lTab === "discover" && normalizedTab === "search") ||
            (lTab === "chats" && normalizedTab === "bookings");
        link.classList.toggle("active", matches);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (normalizedTab === "explore") renderHomeFeed();
    if (normalizedTab === "search") renderDiscoverFeed();
    if (normalizedTab === "bookings") renderChatsFeed();
    if (normalizedTab === "favorites") renderFavoritesFeed();

    if (window.location.hash !== `#${normalizedTab}`) {
        window.history.replaceState(null, "", `#${normalizedTab}`);
    }
};

function renderFavoritesFeed() {
    if (!homePeopleList) return;
    const favIds = getFavorites();
    const favCreators = allCreators.filter((c) => favIds.includes(String(c.id)));

    if (homePeopleCount) {
        homePeopleCount.textContent = `${favCreators.length} saved`;
    }

    if (favCreators.length === 0) {
        homePeopleList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="1.8" style="margin: 0 auto 14px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <h3 style="font-size: 18px; font-weight: 700; color: #0F172A; margin-bottom: 6px;">No saved favorites yet</h3>
                <p style="color: #64748B; font-size: 14px; margin-bottom: 18px;">Tap the heart icon on any creator card to save favorites here.</p>
                <button type="button" onclick="switchTab('explore')" class="btn-book-date" style="display: inline-flex; width: auto; padding: 10px 22px;">Explore Profiles</button>
            </div>
        `;
        return;
    }

    homePeopleList.innerHTML = favCreators.map(createProfileCardHTML).join("");
}

window.toggleProfileSheet = function () {
    if (!profileSheetModal) return;
    const isActive = profileSheetModal.classList.contains("active");

    if (isActive) {
        profileSheetModal.classList.remove("active");
        profileSheetModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    } else {
        updateSheetStats();
        if (window.TakoraAuth) {
            window.TakoraAuth.syncHeaderAndSheetUI();
        }
        profileSheetModal.classList.add("active");
        profileSheetModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }
};

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

async function loadCreators() {
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

    try {
        let freshList = [];
        let fetched = false;

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

        if (!fetched) {
            try {
                const renderController = new AbortController();
                const renderTimeout = setTimeout(() => renderController.abort(), 4500);
                const response = await fetch(`${RENDER_BACKEND_URL}/api/creators`, { signal: renderController.signal });
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
        } else if (allCreators.length === 0 && homePeopleList) {
            homePeopleList.innerHTML = `
                <div class="empty-chats-state">
                    <h3 class="empty-title">Loading profiles...</h3>
                    <p class="empty-desc">Connecting to Takora creators. Tap below to retry.</p>
                    <button class="empty-action-btn" onclick="loadCreators()">Refresh Profiles</button>
                </div>
            `;
        }
    } catch (err) {
        console.warn("Issue loading creators:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
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

    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetTab = btn.dataset.tab;
            if (targetTab) switchTab(targetTab);
        });
    });

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

    const citySelect = document.getElementById("filterCitySelect");
    if (citySelect) {
        citySelect.addEventListener("change", (e) => {
            filterCity = e.target.value;
            renderDiscoverFeed();
        });
    }

    const dateInput = document.getElementById("filterDateInput");
    if (dateInput) {
        dateInput.addEventListener("change", (e) => {
            filterDate = e.target.value;
            renderDiscoverFeed();
        });
    }

    const sortSelect = document.getElementById("filterSortSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            filterSort = e.target.value;
            renderDiscoverFeed();
        });
    }

    document.querySelectorAll(".interest-tag-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const interest = btn.dataset.interest;
            if (btn.classList.contains("active")) {
                btn.classList.remove("active");
                filterInterest = "all";
            } else {
                document.querySelectorAll(".interest-tag-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                filterInterest = interest || "all";
            }
            renderDiscoverFeed();
        });
    });

    window.addEventListener("takora:auth-changed", () => {
        if (currentTab === "bookings") {
            renderChatsFeed();
        }
    });

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

    loadCreators();
});
