const API_URL = "https://creatorpay-backend.onrender.com";

const creatorList = document.getElementById("creatorList");
const creatorCount = document.getElementById("creatorCount");

let allLoadedCreators = [];

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
// FAVORITES SYSTEM (LOCAL STORAGE)
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

function toggleFavorite(event, creatorId) {
    if (event) {
        event.stopPropagation();
    }

    const currentFavs = getFavorites();
    const index = currentFavs.indexOf(creatorId);
    let isNowFav = false;

    if (index > -1) {
        currentFavs.splice(index, 1);
    } else {
        currentFavs.push(creatorId);
        isNowFav = true;
    }

    saveFavorites(currentFavs);

    // Update UI on cards
    const buttons = document.querySelectorAll(`[data-fav-id="${creatorId}"]`);
    buttons.forEach((btn) => {
        const svg = btn.querySelector("svg");
        if (svg) {
            if (isNowFav) {
                btn.classList.add("is-favorited");
                svg.setAttribute("fill", "#ef4444");
                svg.setAttribute("stroke", "#ef4444");
            } else {
                btn.classList.remove("is-favorited");
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "#94a3b8");
            }
        }
    });
}


// ===============================
// CATEGORY ICONS (CLEAN SVG LINES)
// ===============================

function getCategoryIcon(cat) {
    const text = String(cat || "").toLowerCase();

    // Art / Design / Creative
    if (text.includes("design") || text.includes("art") || text.includes("ui") || text.includes("ux")) {
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

    // Technology / Architecture / Code
    if (text.includes("tech") || text.includes("ai") || text.includes("code") || text.includes("engineer")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
        `;
    }

    // Content / Video / Creator / Photography
    if (text.includes("content") || text.includes("video") || text.includes("photo") || text.includes("media")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
        `;
    }

    // Conversation / Guidance / Coaching / Social
    if (text.includes("conversation") || text.includes("coach") || text.includes("guidance") || text.includes("career")) {
        return `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        `;
    }

    // Lifestyle / Culture / Startup
    return `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"></path>
        </svg>
    `;
}


// ===============================
// LOAD CREATORS FROM SERVER
// ===============================

async function loadCreators() {
    try {
        const response = await fetch(`${API_URL}/api/creators`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load profiles.");
        }

        const creators = Array.isArray(result.creators) ? result.creators : [];
        allLoadedCreators = creators;

        displayCreators(creators);

    } catch (error) {
        console.error("Explore page error:", error);

        if (creatorCount) {
            creatorCount.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Offline</span>
            `;
        }

        if (creatorList) {
            creatorList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h3>Unable to load people</h3>
                    <p>Please check your connection and tap retry.</p>
                    <button class="retry-button" onclick="loadCreators()">Try again</button>
                </div>
            `;
        }
    }
}


// ===============================
// DISPLAY SOCIAL PROFILE CARDS
// ===============================

function displayCreators(creators) {
    const totalCreators = creators.length;
    const favIds = getFavorites();

    if (creatorCount) {
        creatorCount.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="count-val">${totalCreators} ${totalCreators === 1 ? "person available" : "people available"}</span>
        `;
    }

    if (totalCreators === 0) {
        if (creatorList) {
            creatorList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 12h8"></path>
                        </svg>
                    </div>
                    <h3>No people available right now</h3>
                    <p>Check back shortly for new members to connect with.</p>
                </div>
            `;
        }
        return;
    }

    if (!creatorList) return;

    creatorList.innerHTML = creators
        .map((creator, index) => {
            const image =
                creator.profile_image ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

            const name = creator.name || "Friend";
            const category = creator.category || "Conversations";
            const bio = creator.bio || "Looking to have great 1-on-1 conversations and share interests.";
            const price = Number(creator.price || 0).toLocaleString("en-IN");
            const profileLink = `friend_profile.html?id=${encodeURIComponent(creator.id)}`;
            const isFav = favIds.includes(String(creator.id));
            const animDelay = Math.min(index * 45, 270);

            return `
                <article class="person-card" style="animation-delay: ${animDelay}ms;" onclick="window.location.href='${profileLink}'" role="button" tabindex="0" onkeydown="if(event.key==='Enter') window.location.href='${profileLink}'">
                    <div class="card-header-row">
                        <div class="avatar-wrap">
                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(name)}"
                                loading="lazy"
                            >
                            <span class="status-indicator" title="Available now" aria-hidden="true"></span>
                        </div>

                        <div class="header-details">
                            <div class="name-row">
                                <h2 class="person-name">${escapeHTML(name)}</h2>
                                <span class="verified-glyph" title="Verified Member">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" fill="#2563eb"></circle>
                                        <path d="M8 12l3 3 5-5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                                    </svg>
                                </span>
                            </div>

                            <div class="interest-pill">
                                ${getCategoryIcon(category)}
                                <span>${escapeHTML(category)}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="favorite-btn ${isFav ? 'is-favorited' : ''}"
                            data-fav-id="${creator.id}"
                            onclick="toggleFavorite(event, '${creator.id}')"
                            aria-label="Save ${escapeHTML(name)}"
                            title="Save person"
                        >
                            <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? '#ef4444' : 'none'}" stroke="${isFav ? '#ef4444' : '#94a3b8'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                    </div>

                    <p class="person-bio">
                        ${escapeHTML(bio)}
                    </p>

                    <div class="card-footer-row">
                        <div class="price-container">
                            <span class="price-main">₹${price}</span>
                            <span class="price-sub">/ connection</span>
                        </div>

                        <a
                            class="view-profile-cta"
                            href="${profileLink}"
                            onclick="event.stopPropagation();"
                            aria-label="View profile of ${escapeHTML(name)}"
                        >
                            <span>View Profile</span>
                            <svg class="cta-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </a>
                    </div>
                </article>
            `;
        })
        .join("");
}


// ===============================
// SMOOTH HEADER ELEVATION ON SCROLL
// ===============================

let scrollTicking = false;
window.addEventListener("scroll", () => {
    if (!scrollTicking) {
        window.requestAnimationFrame(() => {
            const header = document.querySelector(".app-header");
            if (header) {
                if (window.scrollY > 6) {
                    header.classList.add("is-scrolled");
                } else {
                    header.classList.remove("is-scrolled");
                }
            }
            scrollTicking = false;
        });
        scrollTicking = true;
    }
}, { passive: true });


// ===============================
// START APP
// ===============================

loadCreators();