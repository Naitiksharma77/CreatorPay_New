const API_URL = "https://creatorpay-backend.onrender.com";

const profileContent = document.getElementById("profileContent");
const backBtn = document.getElementById("backBtn");

const params = new URLSearchParams(window.location.search);
const creatorId = params.get("id");

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
        displayError("Profile not found", "Please return to Discover and choose someone to view.");
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
            }
        }
    } catch (_) {}

    // 2. Fetch live data from Render backend
    try {
        const response = await fetch(`${API_URL}/api/creators`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load profile from database.");
        }

        const creators = Array.isArray(result.creators) ? result.creators : [];
        const creator = creators.find((item) => String(item.id) === String(creatorId));

        if (!creator) {
            if (!selectedCreator) {
                displayError("Profile does not exist", "The requested member profile could not be found.");
            }
            return;
        }

        selectedCreator = creator;
        displayProfile(creator);

    } catch (error) {
        console.error("Profile load error:", error);

        // Fallback to relative endpoint if offline or Render waking up
        if (!selectedCreator) {
            try {
                const fallbackRes = await fetch("/api/creators");
                const fallbackData = await fallbackRes.json();
                if (fallbackData && fallbackData.success && Array.isArray(fallbackData.creators)) {
                    const fallbackCreator = fallbackData.creators.find((item) => String(item.id) === String(creatorId));
                    if (fallbackCreator) {
                        selectedCreator = fallbackCreator;
                        displayProfile(fallbackCreator);
                        return;
                    }
                }
            } catch (_) {}

            displayError("Unable to load profile", "Please check your internet connection and try again.");
        }
    }
}


// ===============================
// DISPLAY PROFILE (iOS SPEC)
// ===============================

function displayProfile(creator) {
    const image =
        (creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http"))
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

    const name = (creator.name && creator.name.trim()) || "Friend";
    const category = (creator.category && creator.category.trim()) || "Conversations & Lifestyle";
    const bio =
        (creator.bio && creator.bio.trim()) ||
        "Connect with this person for a personal 1-on-1 conversation and guidance.";

    const rawPrice = Number(creator.price);
    const price = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice.toLocaleString("en-IN") : "49";

    profileContent.innerHTML = `
        <article class="profile-card">
            <!-- Profile Hero -->
            <div class="profile-hero">
                <div class="profile-portrait-wrap">
                    <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">
                    <span class="profile-online-badge" title="Available now" aria-hidden="true">
                        <span class="status-dot"></span>
                        <span>Available</span>
                    </span>
                </div>

                <div class="profile-header-meta">
                    <div class="profile-name-row">
                        <h1 class="profile-name">${escapeHTML(name)}</h1>
                        <span class="verified-check" title="Verified Member">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" fill="#2563eb"></circle>
                                <path d="M8 12l3 3 5-5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                            </svg>
                        </span>
                    </div>

                    <div class="profile-interest-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"></path>
                        </svg>
                        <span>${escapeHTML(category)}</span>
                    </div>
                </div>
            </div>

            <!-- About Section -->
            <div class="profile-section">
                <h2 class="profile-section-title">About</h2>
                <p class="profile-bio-text">${escapeHTML(bio)}</p>
            </div>

            <!-- Connection Details -->
            <div class="profile-section">
                <h2 class="profile-section-title">Conversation &amp; Connection</h2>
                <div class="connection-perks">
                    <div class="perk-item">
                        <div class="perk-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>1-on-1 Personal Connection</strong>
                            <span>Direct conversation and discussion with ${escapeHTML(name)}</span>
                        </div>
                    </div>

                    <div class="perk-item">
                        <div class="perk-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>Dedicated Session</strong>
                            <span>Private chat arranged directly after connection</span>
                        </div>
                    </div>

                    <div class="perk-item">
                        <div class="perk-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>Verified &amp; Safe</strong>
                            <span>Protected by FriendConnect community guidelines</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Price & Action Box -->
            <div class="profile-action-box">
                <div class="profile-price-row">
                    <span class="price-desc">Personal Conversation</span>
                    <span class="price-amount">₹${price} <small>/ connection</small></span>
                </div>

                <button
                    class="start-connection-btn"
                    id="payButton"
                    type="button"
                >
                    Start Connection
                </button>

                <p class="secure-text">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>Secure payment powered by Razorpay</span>
                </p>
            </div>
        </article>
    `;

    document
        .getElementById("payButton")
        .addEventListener("click", startRazorpayPayment);
}


// ===============================
// ERROR STATE
// ===============================

function displayError(title, message) {
    profileContent.innerHTML = `
        <div class="profile-error-box">
            <div class="error-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h2>${escapeHTML(title)}</h2>
            <p>${escapeHTML(message)}</p>
            <a href="creator_home.html#discover" class="return-home-btn">Browse Friends</a>
        </div>
    `;
}


// ===============================
// START RAZORPAY PAYMENT
// ===============================

async function startRazorpayPayment() {
    if (!selectedCreator) {
        alert("Profile information is not available.");
        return;
    }

    const amount = Number(selectedCreator.price);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Invalid creator price.");
        return;
    }

    const payButton = document.getElementById("payButton");
    payButton.disabled = true;
    payButton.textContent = "Connecting...";

    try {
        const response = await fetch(`${API_URL}/api/create-order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                creatorId: selectedCreator.id
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to create Razorpay order.");
        }

        if (typeof Razorpay === "undefined") {
            throw new Error("Razorpay Checkout script is missing.");
        }

        const options = {
            key: result.keyId,
            amount: result.order.amount,
            currency: result.order.currency || "INR",
            name: "FriendConnect",
            description: `Personal session with ${selectedCreator.name}`,
            order_id: result.order.id,

            handler: function (paymentResponse) {
                // Record confirmed connection in local storage so it shows in Chats tab
                try {
                    const conns = JSON.parse(localStorage.getItem("fc_connections") || "[]");
                    if (!conns.some((c) => String(c.id) === String(selectedCreator.id))) {
                        conns.unshift(selectedCreator);
                        localStorage.setItem("fc_connections", JSON.stringify(conns));
                    }
                } catch (e) {
                    console.warn("Unable to save connection locally:", e);
                }

                alert(
                    "Connection confirmed with " +
                    selectedCreator.name +
                    "!\n\nPayment ID: " +
                    paymentResponse.razorpay_payment_id
                );

                window.location.href = "creator_home.html#chats";
            },

            notes: {
                creatorId: selectedCreator.id,
                creatorName: selectedCreator.name
            },

            theme: {
                color: "#2563eb"
            },

            modal: {
                ondismiss: function () {
                    resetPayButton();
                }
            }
        };

        const razorpayCheckout = new Razorpay(options);

        razorpayCheckout.on("payment.failed", function (response) {
            console.error("Payment failed:", response.error);
            alert(response.error.description || "Connection payment failed. Please try again.");
            resetPayButton();
        });

        razorpayCheckout.open();

    } catch (error) {
        console.error("Razorpay error:", error);
        alert(error.message || "Unable to start connection.");
        resetPayButton();
    }
}

function resetPayButton() {
    const payButton = document.getElementById("payButton");
    if (!payButton) return;
    payButton.disabled = false;
    payButton.textContent = "Start Connection";
}


// ===============================
// START APP
// ===============================

loadProfile();