const RENDER_BACKEND_URL = "https://creatorpay-backend.onrender.com";

const creatorList = document.getElementById("creatorList");
const creatorCount = document.getElementById("creatorCount");
let exploreCreatorsList = [];

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
    } catch (_) {}
}

window.toggleFavorite = function (event, creatorId) {
    if (event) event.stopPropagation();
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

    const buttons = document.querySelectorAll(`[data-fav-id="${creatorId}"]`);
    buttons.forEach((btn) => {
        const svg = btn.querySelector("svg");
        if (svg) {
            btn.classList.toggle("is-favorited", isNowFav);
            svg.setAttribute("fill", isNowFav ? "#2563EB" : "none");
            svg.setAttribute("stroke", isNowFav ? "#2563EB" : "#64748B");
        }
    });
};

async function loadCreators() {
    try {
        let creators = [];
        let fetched = false;

        try {
            const localRes = await fetch("/api/creators");
            if (localRes.ok) {
                const localData = await localRes.json();
                if (localData && localData.success && Array.isArray(localData.creators)) {
                    creators = localData.creators;
                    fetched = true;
                }
            }
        } catch (_) {}

        if (!fetched) {
            const response = await fetch(`${RENDER_BACKEND_URL}/api/creators`);
            const result = await response.json();
            if (response.ok && result.success && Array.isArray(result.creators)) {
                creators = result.creators;
                fetched = true;
            }
        }

        if (!fetched) throw new Error("Unable to load profiles.");
        displayCreators(creators);
    } catch (error) {
        console.error("Explore page error:", error);
    }
}

window.openExploreVideoCall = function (creatorId) {
    const creator = exploreCreatorsList.find((c) => String(c.id) === String(creatorId));
    if (creator && window.TakoraAuth && typeof window.TakoraAuth.checkAndStartInteraction === "function") {
        window.TakoraAuth.checkAndStartInteraction(creator, "video");
    } else {
        window.location.href = `friend_profile.html?id=${encodeURIComponent(creatorId)}&action=video`;
    }
};

function displayCreators(creators) {
    if (!creatorList) return;
    exploreCreatorsList = Array.isArray(creators) ? creators : [];
    const favIds = getFavorites();

    if (creatorCount) {
        creatorCount.textContent = `${creators.length} ${creators.length === 1 ? "person available" : "people available"}`;
    }

    creatorList.innerHTML = creators
        .map((creator, index) => {
            const image = creator.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
            const name = creator.name || "Creator";
            const bio = creator.bio || "Looking to have great 1-on-1 conversations and share interests.";
            const profileLink = `friend_profile.html?id=${encodeURIComponent(creator.id)}`;
            const isFav = favIds.includes(String(creator.id));

            return `
                <article class="person-card social-card" onclick="window.location.href='${profileLink}'" role="button" tabindex="0">
                    <div class="card-header-row card-top-row">
                        <div class="avatar-wrap avatar-ring-wrap">
                            <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" style="object-position: 50% 20%;">
                        </div>
                        <div class="header-details card-identity">
                            <h2 class="person-name">${escapeHTML(name)}</h2>
                        </div>
                        <button type="button" class="favorite-btn card-fav-btn ${isFav ? "is-favorited" : ""}" data-fav-id="${escapeHTML(creator.id)}" onclick="toggleFavorite(event, '${escapeHTML(creator.id)}')" aria-label="Save ${escapeHTML(name)}">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="${isFav ? "#2563EB" : "none"}" stroke="${isFav ? "#2563EB" : "#64748B"}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        </button>
                    </div>
                    <p class="person-bio card-bio">${escapeHTML(bio)}</p>
                    <div class="card-footer-row card-bottom-row" style="display:flex; gap:8px;">
                        <a class="btn-view-profile" href="${profileLink}" onclick="event.stopPropagation();" style="flex:1; display:inline-flex; align-items:center; justify-content:center; text-align:center; background:#F8FAFC; border:1px solid #E2E8F0; color:#0F172A; font-weight:600; padding:8px 12px; border-radius:10px;">View Profile</a>
                        <button type="button" class="btn-book-date" onclick="event.stopPropagation(); window.openExploreVideoCall('${escapeHTML(creator.id)}');" aria-label="Video Call ${escapeHTML(name)}" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#2563EB; color:#FFFFFF; font-weight:700; padding:8px 12px; border:none; border-radius:10px; cursor:pointer;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </svg>
                            Video Call
                        </button>
                    </div>
                </article>
            `;
        })
        .join("");
}

if (creatorList) {
    loadCreators();
}