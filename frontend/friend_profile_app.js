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

    // 2. Fetch data (prefer local proxy for same-origin reliability and CORS safety, fallback to Render backend)
    try {
        let creators = [];
        let fetchedSuccessfully = false;

        // Try local same-origin API first (always fast and immune to third-party CORS/network blocks)
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

        // Fallback to Render backend if local didn't return data
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
            // Update local cache
            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(creators));
            } catch (_) {}

            const creator = creators.find((item) => String(item.id) === String(creatorId));
            if (creator) {
                selectedCreator = creator;
                displayProfile(creator);
                return;
            }
        }

        if (!selectedCreator) {
            displayError("Profile does not exist", "The requested member profile could not be found.");
        }

    } catch (error) {
        console.error("Profile load error:", error);
        if (!selectedCreator) {
            displayError("Unable to load profile", "Please check your internet connection and try again.");
        }
    }
}


// ===============================
// ONLINE & ACTIVITY STATUS CONFIG
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

const LAST_ACTIVE_INTERVALS = [
    "Last active 2 minutes ago",
    "Last active 7 minutes ago",
    "Last active 18 minutes ago",
    "Last active 35 minutes ago",
    "Last active 1 hour ago",
    "Last active 1 hour 20 minutes ago",
    "Last active 2 hours ago"
];

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

function getCreatorLastActive(creator) {
    if (!creator) return "Last active recently";
    const str = String(creator.id || creator.name || "");
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
        sum += str.charCodeAt(i) * (i + 19);
    }
    return LAST_ACTIVE_INTERVALS[Math.abs(sum) % LAST_ACTIVE_INTERVALS.length];
}


// ===============================
// ===============================
// DISPLAY PROFILE (MEET YOU PARTNER)
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
        "Excited to meet lovely people, share meaningful stories and start great conversations.";

    const rawPrice = Number(creator.price);
    const price = (Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice.toLocaleString("en-IN") : "49";

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
                        <span class="verified-check" title="Verified Member">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" fill="#EC4899"></circle>
                                <path d="M8 12l3 3 5-5" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path>
                            </svg>
                        </span>
                    </div>

                    <div class="profile-badges-row">
                        <div class="profile-interest-pill">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span>${escapeHTML(category)}</span>
                        </div>
                        ${(creator.creator_age || creator.age) ? `
                        <div class="profile-interest-pill" style="background: rgba(236, 72, 153, 0.08); color: #BE185D;">
                            <span>${escapeHTML(creator.creator_age || creator.age)} years old</span>
                        </div>
                        ` : ""}
                        ${(creator.creator_location || creator.location) ? `
                        <div class="profile-interest-pill" style="background: #F8FAFC; color: #475569; border: 1px solid #E2E8F0;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>${escapeHTML(creator.creator_location || creator.location)}</span>
                        </div>
                        ` : ""}
                    </div>
                </div>
            </div>

            <!-- About Section -->
            <div class="profile-section">
                <h2 class="profile-section-title">About</h2>
                <p class="profile-bio-text">${escapeHTML(bio)}</p>
            </div>

            <!-- Conversation & Connection Information Card -->
            <div class="profile-section">
                <h2 class="profile-section-title">Conversation &amp; Connection</h2>
                <div class="connection-perks">
                    <div class="perk-item">
                        <div class="perk-icon" aria-hidden="true">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>Personal Chat</strong>
                            <span>Connect one-on-one and start a lovely conversation.</span>
                        </div>
                    </div>

                    <div class="perk-item">
                        <div class="perk-icon" aria-hidden="true">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                                <line x1="2" y1="10" x2="22" y2="10"></line>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>One-Time Connection</strong>
                            <span>Connect directly with this person. Your chat will appear in Chats after connecting.</span>
                        </div>
                    </div>

                    <div class="perk-item">
                        <div class="perk-icon" aria-hidden="true">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                        </div>
                        <div class="perk-text">
                            <strong>Verified Member</strong>
                            <span>This profile has been verified by the Meet You Partner team.</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Price & Action Box -->
            <div class="profile-action-box">
                <div class="profile-price-row">
                    <div class="price-service-col">
                        <span class="price-service-label">Personal Chat</span>
                        <span class="price-type-label">one-time connection</span>
                    </div>
                    <div class="price-figure">₹${price}</div>
                </div>

                <button
                    class="start-connection-btn"
                    id="payButton"
                    type="button"
                >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>Say Hi &amp; Start Chat</span>
                </button>

                <p class="secure-text">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#817783" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>Secure payment powered by Razorpay · 100% Private &amp; Safe</span>
                </p>
            </div>
        </article>
    `;

    const payButton = document.getElementById("payButton");
    const verifiedSession = getVerifiedSession(creator.id);
    if (verifiedSession) {
        payButton.innerHTML = `
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Open Chat with ${escapeHTML(name)}</span>
        `;
        payButton.onclick = () => {
            window.location.href = `chat.html?id=${encodeURIComponent(creator.id)}&payment_id=${encodeURIComponent(verifiedSession.paymentId)}&token=${encodeURIComponent(verifiedSession.token)}`;
        };
    } else {
        payButton.addEventListener("click", startRazorpayPayment);
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

function showVerifiedPaymentModal(creator, sessionData) {
    const existing = document.getElementById("postPayModal");
    if (existing) existing.remove();

    const chatUrl = `chat.html?id=${encodeURIComponent(creator.id)}&payment_id=${encodeURIComponent(sessionData.paymentId)}&token=${encodeURIComponent(sessionData.token)}`;

    const modal = document.createElement("div");
    modal.id = "postPayModal";
    modal.className = "post-pay-modal-overlay";
    modal.innerHTML = `
        <div class="post-pay-card" role="dialog" aria-modal="true" aria-labelledby="postPayTitle">
            <div class="post-pay-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <span class="post-pay-badge">Payment Verified ✓</span>
            <h2 id="postPayTitle" class="post-pay-title">You're Connected!</h2>
            <p class="post-pay-desc">Your private connection with <strong>${escapeHTML(creator.name || "your partner")}</strong> is confirmed. You can now start chatting.</p>
            <a href="${chatUrl}" class="post-pay-start-btn" id="modalStartChatBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Start Chat with ${escapeHTML(creator.name || "Partner")}</span>
            </a>
            <a href="creator_home.html#chats" class="post-pay-close-link">Go to All Chats</a>
        </div>
    `;

    document.body.appendChild(modal);

    const payButton = document.getElementById("payButton");
    if (payButton) {
        payButton.disabled = false;
        payButton.innerHTML = `
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Open Chat with ${escapeHTML(creator.name || "Partner")}</span>
        `;
        payButton.onclick = () => {
            window.location.href = chatUrl;
        };
    }
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
            <a href="creator_home.html#discover" class="return-home-btn">Discover Partners</a>
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
    payButton.innerHTML = `<span class="cta-loading-wrap"><span class="cta-spinner"></span> Connecting...</span>`;

    try {
        let response;
        try {
            response = await fetch("/api/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    creatorId: selectedCreator.id
                })
            });
        } catch (_) {}

        if (!response || !response.ok) {
            response = await fetch(`${API_URL}/api/create-order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    creatorId: selectedCreator.id
                })
            });
        }

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
            name: "Meet You Partner",
            description: `Personal session with ${selectedCreator.name}`,
            order_id: result.order.id,

            handler: async function (paymentResponse) {
                const payButton = document.getElementById("payButton");
                if (payButton) {
                    payButton.disabled = true;
                    payButton.innerHTML = `<span>Verifying payment...</span>`;
                }

                try {
                    // 1. Verify payment status server-side
                    let verifyRes;
                    try {
                        verifyRes = await fetch("/api/verify-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                creatorId: selectedCreator.id
                            })
                        });
                    } catch (_) {}

                    if (!verifyRes || !verifyRes.ok) {
                        verifyRes = await fetch(`${API_URL}/api/verify-payment`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                creatorId: selectedCreator.id
                            })
                        });
                    }

                    const verifyData = await verifyRes.json();
                    if (!verifyRes.ok || !verifyData.success) {
                        throw new Error(verifyData.message || "Payment verification could not be confirmed.");
                    }

                    // 2. Store secure session token tied to this person
                    const sessionData = {
                        token: verifyData.token,
                        paymentId: paymentResponse.razorpay_payment_id,
                        orderId: paymentResponse.razorpay_order_id,
                        creatorId: selectedCreator.id,
                        creatorName: selectedCreator.name,
                        verifiedAt: Date.now()
                    };
                    localStorage.setItem(`fc_chat_session_${selectedCreator.id}`, JSON.stringify(sessionData));

                    // 3. Record confirmed connection in local storage so it shows in Chats tab
                    try {
                        const conns = JSON.parse(localStorage.getItem("fc_connections") || "[]");
                        if (!conns.some((c) => String(c.id) === String(selectedCreator.id))) {
                            conns.unshift(selectedCreator);
                            localStorage.setItem("fc_connections", JSON.stringify(conns));
                        }
                    } catch (e) {
                        console.warn("Unable to save connection locally:", e);
                    }

                    // 4. Present verified success modal with Start Chat option
                    showVerifiedPaymentModal(selectedCreator, sessionData);
                } catch (err) {
                    console.error("Payment verification failed:", err);
                    alert("Payment verification error: " + (err.message || "Please contact support."));
                    resetPayButton();
                }
            },
            notes: {
                creatorId: selectedCreator.id,
                creatorName: selectedCreator.name
            },

            theme: {
                color: "#EC4899"
            },

            modal: {
                ondismiss: function () {
                    resetPayButton();
                }
            }
        };

        const razorpayCheckout = new Razorpay(options);

        razorpayCheckout.on("payment.failed", function (response) {
            try {
                if (window.MYP_TRACK) {
                    window.MYP_TRACK.trackEvent("payment_failed", {
                        creatorId: selectedCreator.id,
                        creatorName: selectedCreator.name,
                        amount: Number(selectedCreator.price)
                    });
                }
            } catch (_) {}
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
    if (!payButton || !selectedCreator) return;
    payButton.disabled = false;
    payButton.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Say Hi &amp; Start Chat</span>
    `;
}


// ===============================
// START APP
// ===============================

loadProfile();