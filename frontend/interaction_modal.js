/**
 * Takora — Subscription-Gated Interaction Modal
 * Interaction Order: 1. Chat, 2. Voice Call, 3. Video Call
 * Zero per-creator payments — access strictly controlled by monthly subscription plan.
 */

(function () {
    "use strict";

    let activeCreator = null;
    let selectedMode = "chat";
    let isSubmitting = false;

    function escapeHTML(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeAvatar(url) {
        if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("/"))) {
            return url;
        }
        return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
    }

    function ensureBackdrop() {
        let el = document.getElementById("roseiaInteractionModalBackdrop");
        if (!el) {
            el = document.createElement("div");
            el.id = "roseiaInteractionModalBackdrop";
            el.className = "roseia-modal-backdrop";
            el.setAttribute("aria-hidden", "true");
            el.addEventListener("click", (e) => {
                if (e.target === el) window.closeInteractionModal();
            });
            document.body.appendChild(el);
        }
        return el;
    }

    function getAuthSnapshot() {
        if (window.TakoraAuth && typeof window.TakoraAuth.getState === "function") {
            return window.TakoraAuth.getState();
        }
        return { authenticated: false, subscription: null, entitlements: { chat: false, voice: false, video: false } };
    }

    function getOptionAccess(mode, snap) {
        const ent = snap.entitlements || {};
        if (mode === "chat") {
            return {
                unlocked: Boolean(ent.chat),
                requiredPlan: "basic",
                requiredLabel: "Basic ₹9/mo+"
            };
        }
        if (mode === "voice") {
            return {
                unlocked: Boolean(ent.voice),
                requiredPlan: "pro",
                requiredLabel: "Pro ₹29/mo+"
            };
        }
        return {
            unlocked: Boolean(ent.video),
            requiredPlan: "premium",
            requiredLabel: "Premium ₹99/mo"
        };
    }

    function renderModalContent() {
        const backdrop = ensureBackdrop();
        if (!activeCreator) return;

        const snap = getAuthSnapshot();
        const name = activeCreator.name || "Creator";
        const avatar = safeAvatar(activeCreator.profile_image);
        const category = activeCreator.category || "Verified Profile";

        const chatAccess = getOptionAccess("chat", snap);
        const voiceAccess = getOptionAccess("voice", snap);
        const videoAccess = getOptionAccess("video", snap);

        const options = [
            {
                key: "chat",
                title: "Chat",
                subtitle: "Private 1-on-1 instant messaging",
                access: chatAccess,
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`
            },
            {
                key: "voice",
                title: "Voice Call",
                subtitle: "Live 1-on-1 private audio call",
                access: voiceAccess,
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`
            },
            {
                key: "video",
                title: "Video Call",
                subtitle: "HD face-to-face live video session",
                access: videoAccess,
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`
            }
        ];

        const activeOpt = options.find((o) => o.key === selectedMode) || options[0];
        const sub = snap.subscription;

        let bannerHTML = "";
        if (!snap.authenticated) {
            bannerHTML = `
                <div class="tk-modal-plan-banner">
                    <span>Unlock Chat, Voice &amp; Video with a monthly plan from <strong>₹9/mo</strong>.</span>
                    <a href="pricing.html" class="tk-modal-plan-link">See Plans</a>
                </div>
            `;
        } else if (sub && sub.hasActiveAccess) {
            bannerHTML = `
                <div class="tk-modal-plan-banner">
                    <span>Your Plan: <strong>${escapeHTML(sub.planName)} (₹${escapeHTML(sub.priceInr)}/mo)</strong></span>
                    <a href="pricing.html" class="tk-modal-plan-link">Manage</a>
                </div>
            `;
        } else {
            bannerHTML = `
                <div class="tk-modal-plan-banner">
                    <span>No active monthly plan yet. Plans start at <strong>₹9/month</strong>.</span>
                    <a href="pricing.html" class="tk-modal-plan-link">Subscribe</a>
                </div>
            `;
        }

        let ctaText = "Start Chat";
        if (!snap.authenticated) {
            ctaText = `Continue with ${activeOpt.title}`;
        } else if (activeOpt.access.unlocked) {
            ctaText = activeOpt.key === "chat"
                ? "Open Private Chat"
                : activeOpt.key === "voice"
                    ? "Start Voice Call"
                    : "Start HD Video Call";
        } else if (sub && sub.hasActiveAccess) {
            ctaText = `Upgrade to ${activeOpt.access.requiredLabel}`;
        } else {
            ctaText = `Unlock with ${activeOpt.access.requiredLabel}`;
        }

        backdrop.innerHTML = `
            <div class="roseia-modal-sheet" role="dialog" aria-modal="true" aria-labelledby="interactionSheetTitle">
                <div class="modal-drag-handle" aria-hidden="true"></div>

                <div class="modal-header-row">
                    <div class="modal-creator-mini">
                        <img src="${escapeHTML(avatar)}" alt="${escapeHTML(name)}">
                        <div>
                            <h4 id="interactionSheetTitle">Say Hi to ${escapeHTML(name)}</h4>
                            <p>${escapeHTML(category)} · Central Monthly Membership</p>
                        </div>
                    </div>
                    <button type="button" class="modal-close-x" id="modalCloseBtn" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                ${bannerHTML}

                <div class="modal-section-title">Choose how you'd like to connect</div>

                <div class="interaction-option-list">
                    ${options.map((opt) => {
                        const isSel = opt.key === selectedMode;
                        const statusText = opt.access.unlocked
                            ? "✓ Included"
                            : opt.access.requiredLabel;
                        const statusCls = opt.access.unlocked ? "included" : (snap.authenticated ? "" : "locked");
                        return `
                            <button type="button" class="interaction-option-btn ${isSel ? "selected" : ""}" data-mode="${opt.key}">
                                <div class="option-left-wrap">
                                    <div class="option-icon-circle">${opt.icon}</div>
                                    <div class="option-info">
                                        <h5>${opt.title}</h5>
                                        <span>${opt.subtitle}</span>
                                    </div>
                                </div>
                                <div class="option-right-wrap">
                                    <span class="option-tier-status ${statusCls}">${statusText}</span>
                                    <span class="option-radio-dot" aria-hidden="true"></span>
                                </div>
                            </button>
                        `;
                    }).join("")}
                </div>

                <div class="modal-summary-box">
                    <div class="summary-left-text">
                        <span>Selected Interaction</span>
                        <strong>${activeOpt.title} with ${escapeHTML(name)}</strong>
                    </div>
                    <div class="summary-tier-text ${activeOpt.access.unlocked ? "included" : ""}">
                        ${activeOpt.access.unlocked ? "Included in your plan" : activeOpt.access.requiredLabel}
                    </div>
                </div>

                <button type="button" id="interactionConfirmBtn" class="modal-pay-btn">
                    ${escapeHTML(ctaText)}
                </button>

                <div class="modal-trust-footer">
                    No per-creator charges · Cancel AutoPay anytime · <a href="pricing.html">Compare Monthly Plans</a>
                </div>
            </div>
        `;

        document.getElementById("modalCloseBtn").onclick = window.closeInteractionModal;

        backdrop.querySelectorAll(".interaction-option-btn").forEach((btn) => {
            btn.onclick = () => {
                selectedMode = btn.getAttribute("data-mode") || "chat";
                renderModalContent();
            };
        });

        document.getElementById("interactionConfirmBtn").onclick = async () => {
            if (isSubmitting) return;
            isSubmitting = true;
            const confirmBtn = document.getElementById("interactionConfirmBtn");
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = "Checking membership...";
            }
            try {
                const creatorRef = activeCreator;
                const modeRef = selectedMode;
                window.closeInteractionModal();
                if (window.TakoraAuth && typeof window.TakoraAuth.checkAndStartInteraction === "function") {
                    await window.TakoraAuth.checkAndStartInteraction(creatorRef, modeRef);
                } else {
                    window.location.href = `pricing.html?plan=${modeRef === "video" ? "premium" : modeRef === "voice" ? "pro" : "basic"}`;
                }
            } finally {
                isSubmitting = false;
            }
        };
    }

    window.openInteractionModal = async function (creator, defaultType) {
        if (!creator) return;
        activeCreator = creator;
        selectedMode = defaultType === "video" || defaultType === "voice" ? defaultType : "chat";

        if (window.TakoraAuth && !window.TakoraAuth.getState().loaded) {
            await window.TakoraAuth.refreshSession();
        }

        const backdrop = ensureBackdrop();
        renderModalContent();
        requestAnimationFrame(() => {
            backdrop.classList.add("open");
            backdrop.setAttribute("aria-hidden", "false");
        });
    };

    window.closeInteractionModal = function () {
        const backdrop = document.getElementById("roseiaInteractionModalBackdrop");
        if (backdrop) {
            backdrop.classList.remove("open");
            backdrop.setAttribute("aria-hidden", "true");
        }
    };
})();
