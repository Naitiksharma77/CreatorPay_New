const API_URL = "https://creatorpay-backend.onrender.com";

const profileContent = document.getElementById("profileContent");
const backBtn = document.getElementById("backBtn");

const params = new URLSearchParams(window.location.search);
const creatorId = params.get("id");
const autoAction = params.get("action"); // 'chat' | 'voice_call' | 'video_call'

let selectedCreator = null;

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
                if (autoAction && window.openInteractionModal) {
                    const mode = ["chat", "voice_call", "video_call"].includes(autoAction) ? autoAction : "chat";
                    setTimeout(() => window.openInteractionModal(found, mode), 300);
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
                if (autoAction && window.openInteractionModal) {
                    const mode = ["chat", "voice_call", "video_call"].includes(autoAction) ? autoAction : "chat";
                    setTimeout(() => window.openInteractionModal(creator, mode), 300);
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
// FAVORITES & CONTROLS
// ===============================

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

// ===============================
// DISPLAY PROFILE
// Strictly NO age, NO location/city, NO date booking references
// ===============================

function displayProfile(creator) {
    const image =
        (creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http"))
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

    const name = (creator.name && creator.name.trim()) || "Member";

    // Bio & Introduction
    let intro = (creator.bio && creator.bio.trim()) || `This is ${name}. Welcome to my profile!`;

    // Dynamic creator interaction price (same for Chat, Voice Call, Video Call)
    const rawPrice = Number(creator.price);
    const basePrice = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice : 49;
    const priceFormatted = basePrice.toLocaleString("en-IN");

    // Dynamic tags (Interests & Hobbies)
    let interestsStr = "Coffee & Conversation · Fine Dining";
    if (Array.isArray(creator.tags) && creator.tags.length > 0) {
        interestsStr = creator.tags.join(" · ");
    } else if (typeof creator.tags === "string" && creator.tags.trim()) {
        interestsStr = creator.tags.split(",").map(t => t.trim()).join(" · ");
    }

    // Languages
    const languagesStr = creator.languages || "English · Hindi";

    const favs = getFavoritesList();
    const isFav = favs.includes(String(creator.id));

    profileContent.innerHTML = `
        <article class="creator-profile-view">
            <!-- 1. Full-Bleed Immersive Hero Photograph -->
            <div class="creator-hero-frame">
                <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" class="creator-hero-img" style="object-position: 50% 20%;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">

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

                <!-- Bottom Gradient with Name ONLY OVER photo (Strictly NO age, NO location, NO dates) -->
                <div class="creator-hero-overlay">
                    <h1 class="hero-overlay-name" style="margin: 0;">${escapeHTML(name)}</h1>
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
            </div>

            <!-- 3. Roséia Interaction Suite (Chat, Voice Call, Video Call) -->
            <div class="profile-interactions-card">
                <h2 class="profile-interactions-title">Connect with ${escapeHTML(name)}</h2>
                <p class="profile-interactions-sub">Select an interaction below to start your private connection.</p>

                <div class="profile-actions-grid">
                    <!-- Action 1: Chat -->
                    <button type="button" class="profile-interaction-btn" onclick="window.triggerInteraction('chat')" aria-label="Start Chat with ${escapeHTML(name)}">
                        <div class="p-btn-left">
                            <div class="p-btn-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </div>
                            <div class="p-btn-text">
                                <span class="p-btn-title">Chat</span>
                                <span class="p-btn-sub">Direct 1-on-1 private messaging</span>
                            </div>
                        </div>
                        <span class="p-btn-price">₹${priceFormatted}</span>
                    </button>

                    <!-- Action 2: Voice Call -->
                    <button type="button" class="profile-interaction-btn" onclick="window.triggerInteraction('voice_call')" aria-label="Start Voice Call with ${escapeHTML(name)}">
                        <div class="p-btn-left">
                            <div class="p-btn-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </div>
                            <div class="p-btn-text">
                                <span class="p-btn-title">Voice Call</span>
                                <span class="p-btn-sub">High-definition audio conversation</span>
                            </div>
                        </div>
                        <span class="p-btn-price">₹${priceFormatted}</span>
                    </button>

                    <!-- Action 3: Video Call -->
                    <button type="button" class="profile-interaction-btn" onclick="window.triggerInteraction('video_call')" aria-label="Start Video Call with ${escapeHTML(name)}">
                        <div class="p-btn-left">
                            <div class="p-btn-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                </svg>
                            </div>
                            <div class="p-btn-text">
                                <span class="p-btn-title">Video Call</span>
                                <span class="p-btn-sub">Face-to-face video interaction</span>
                            </div>
                        </div>
                        <span class="p-btn-price">₹${priceFormatted}</span>
                    </button>
                </div>
            </div>

            <!-- 4. Sticky Bottom Interaction Bar -->
            <div class="sticky-connect-bar">
                <button type="button" class="sticky-action-pill primary" onclick="window.triggerInteraction('chat')" aria-label="Chat with ${escapeHTML(name)}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>Chat · ₹${priceFormatted}</span>
                </button>

                <button type="button" class="sticky-action-pill" onclick="window.triggerInteraction('voice_call')" aria-label="Voice Call with ${escapeHTML(name)}">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <span>Voice</span>
                </button>

                <button type="button" class="sticky-action-pill" onclick="window.triggerInteraction('video_call')" aria-label="Video Call with ${escapeHTML(name)}">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                    <span>Video</span>
                </button>
            </div>
        </article>
    `;
}

window.triggerInteraction = function(type) {
    if (!selectedCreator) return;
    if (window.openInteractionModal) {
        window.openInteractionModal(selectedCreator, type);
    }
};

function displayError(title, message) {
    profileContent.innerHTML = `
        <div class="profile-error-box" style="text-align: center; padding: 50px 20px;">
            <h2>${escapeHTML(title)}</h2>
            <p style="color: #817783; margin: 8px 0 20px;">${escapeHTML(message)}</p>
            <a href="creator_home.html" class="return-home-btn" style="background: #EC4899; color: #FFF; padding: 12px 24px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-block;">Discover People</a>
        </div>
    `;
}

// Start App
loadProfile();