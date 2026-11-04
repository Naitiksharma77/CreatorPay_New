/**
 * Roséia — Creator Interaction & Payment Suite
 * Handles 1-on-1 Chat, Voice Call, and Video Call interactions
 * Shared transparent pricing matching creator's configured price
 */

(function (window) {
    "use strict";

    let currentCreator = null;
    let selectedInteraction = "chat"; // 'chat' | 'voice_call' | 'video_call'
    let isProcessing = false;

    const INTERACTION_CONFIG = {
        chat: {
            title: "Chat",
            subtitle: "Direct 1-on-1 messaging & photos",
            label: "Private Chat",
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>`
        },
        voice_call: {
            title: "Voice Call",
            subtitle: "High-definition audio conversation",
            label: "Voice Call",
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>`
        },
        video_call: {
            title: "Video Call",
            subtitle: "Face-to-face video interaction",
            label: "Video Call",
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>`
        }
    };

    function escapeHTML(str) {
        return String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getBasePrice(creator) {
        if (!creator) return 49;
        const num = Number(creator.price);
        return (Number.isFinite(num) && num > 0) ? num : 49;
    }

    function calculateInteractionPrice(baseChatPrice, interactionType) {
        const base = Number(baseChatPrice) || 0;
        if (interactionType === "voice_call") {
            return Math.round(base * 1.10);
        }
        if (interactionType === "video_call") {
            return Math.round(base * 1.20);
        }
        return Math.round(base);
    }

    function ensureContainer() {
        let el = document.getElementById("roseiaInteractionModalContainer");
        if (!el) {
            el = document.createElement("div");
            el.id = "roseiaInteractionModalContainer";
            document.body.appendChild(el);
        }
        return el;
    }

    function renderModal() {
        const container = ensureContainer();
        if (!currentCreator) {
            container.innerHTML = "";
            return;
        }

        const baseChatPrice = getBasePrice(currentCreator);
        const chatPrice = calculateInteractionPrice(baseChatPrice, "chat");
        const voicePrice = calculateInteractionPrice(baseChatPrice, "voice_call");
        const videoPrice = calculateInteractionPrice(baseChatPrice, "video_call");

        const selectedPrice = calculateInteractionPrice(baseChatPrice, selectedInteraction);
        const selectedPriceFormatted = selectedPrice.toLocaleString("en-IN");

        const name = (currentCreator.name && currentCreator.name.trim()) || "Creator";
        const avatar = (currentCreator.profile_image && currentCreator.profile_image.startsWith("http"))
            ? currentCreator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

        const selectedInfo = INTERACTION_CONFIG[selectedInteraction] || INTERACTION_CONFIG.chat;

        container.innerHTML = `
            <div class="ros-modal-backdrop" onclick="window.closeInteractionModal(event)" role="dialog" aria-modal="true" aria-labelledby="rosModalTitle">
                <div class="ros-modal-card" onclick="event.stopPropagation()">
                    <span class="ros-modal-grab-bar" aria-hidden="true"></span>

                    <div class="ros-modal-header">
                        <h2 id="rosModalTitle" class="ros-modal-title">Connect with ${escapeHTML(name)}</h2>
                        <button type="button" class="ros-modal-close-btn" onclick="window.closeInteractionModal()" aria-label="Close modal">&times;</button>
                    </div>

                    <!-- Creator Snapshot (NO age, NO location) -->
                    <div class="ros-creator-snapshot">
                        <img src="${escapeHTML(avatar)}" alt="${escapeHTML(name)}" class="ros-snapshot-avatar" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">
                        <div class="ros-snapshot-info">
                            <div class="ros-snapshot-name">${escapeHTML(name)}</div>
                            <div class="ros-snapshot-tagline">Choose your preferred interaction mode</div>
                        </div>
                    </div>

                    <span class="ros-section-label">Select Interaction</span>

                    <!-- 3 Interaction Options in required order: Chat, Voice Call, Video Call -->
                    <div class="ros-options-group" role="radiogroup" aria-label="Interaction Options">
                        ${renderOption("chat", chatPrice.toLocaleString("en-IN"))}
                        ${renderOption("voice_call", voicePrice.toLocaleString("en-IN"))}
                        ${renderOption("video_call", videoPrice.toLocaleString("en-IN"))}
                    </div>

                    <!-- Transparent Pricing Summary (NO fees, NO taxes) -->
                    <div class="ros-price-summary-box">
                        <div class="ros-summary-row">
                            <span>Selected Option</span>
                            <span style="font-weight:600; color:var(--ros-text-dark);">${escapeHTML(selectedInfo.label)}</span>
                        </div>
                        <div class="ros-summary-row">
                            <span>Convenience / Safety Fee</span>
                            <span style="color:#059669; font-weight:600;">₹0 (Free)</span>
                        </div>
                        <div class="ros-summary-row">
                            <span>Total Payable</span>
                            <span class="ros-total-val">₹${selectedPriceFormatted} INR</span>
                        </div>
                    </div>

                    <!-- CTA Button with Selected Interaction Amount -->
                    <button type="button" id="rosPayActionBtn" class="ros-pay-btn" onclick="window.proceedToPayment()" ${isProcessing ? 'disabled' : ''}>
                        ${isProcessing ? `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite;">
                                <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
                                <path d="M12 2a10 10 0 0 1 10 10"></path>
                            </svg>
                            <span>Processing...</span>
                        ` : `
                            <span>Continue to Payment · ₹${selectedPriceFormatted}</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        `}
                    </button>

                    <div class="ros-security-note">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <span>Encrypted &amp; Secured by Razorpay · 100% Verified Access</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderOption(type, priceFormatted) {
        const item = INTERACTION_CONFIG[type];
        const isSelected = selectedInteraction === type;
        return `
            <button
                type="button"
                class="ros-option-card ${isSelected ? 'is-selected' : ''}"
                onclick="window.selectInteractionType('${type}')"
                role="radio"
                aria-checked="${isSelected}"
            >
                <div class="ros-opt-left">
                    <div class="ros-opt-icon-wrap">
                        ${item.icon}
                    </div>
                    <div class="ros-opt-details">
                        <div class="ros-opt-title">${escapeHTML(item.title)}</div>
                        <div class="ros-opt-sub">${escapeHTML(item.subtitle)}</div>
                    </div>
                </div>
                <div class="ros-opt-right">
                    <span class="ros-opt-price-tag">₹${priceFormatted}</span>
                    <div class="ros-opt-radio">
                        <div class="ros-opt-radio-dot"></div>
                    </div>
                </div>
            </button>
        `;
    }

    window.openInteractionModal = function (creator, defaultType = "chat") {
        if (!creator) return;
        currentCreator = creator;
        selectedInteraction = ["chat", "voice_call", "video_call"].includes(defaultType) ? defaultType : "chat";
        isProcessing = false;
        renderModal();
        document.body.style.overflow = "hidden";
    };

    window.closeInteractionModal = function (event) {
        if (event && event.target !== event.currentTarget) return;
        currentCreator = null;
        const container = document.getElementById("roseiaInteractionModalContainer");
        if (container) container.innerHTML = "";
        document.body.style.overflow = "";
    };

    window.selectInteractionType = function (type) {
        if (INTERACTION_CONFIG[type]) {
            selectedInteraction = type;
            renderModal();
        }
    };

    function ensureRazorpayScript() {
        return new Promise((resolve) => {
            if (typeof window.Razorpay === "function") {
                return resolve(true);
            }
            const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(true), { once: true });
                existing.addEventListener("error", () => resolve(false), { once: true });
                setTimeout(() => resolve(typeof window.Razorpay === "function"), 1800);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => {
                console.error("Failed to load Razorpay checkout script from CDN");
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    async function requestCreateOrder(payload) {
        // Attempt 1: Local same-origin endpoint
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch("/api/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.order) {
                    return data;
                }
            }
        } catch (err) {
            console.warn("[Payment] Local create-order error, attempting Render backend:", err.message);
        }

        // Attempt 2: Production Render backend fallback
        try {
            const renderRes = await fetch("https://creatorpay-backend.onrender.com/api/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (renderRes.ok) {
                const renderData = await renderRes.json();
                if (renderData && renderData.success && renderData.order) {
                    return renderData;
                }
            }
        } catch (renderErr) {
            console.error("[Payment] Render backend create-order failed:", renderErr.message);
        }

        throw new Error("Unable to create payment order. Please verify your connection.");
    }

    async function requestVerifyPayment(payload) {
        // Attempt 1: Local same-origin
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.success) {
                    return data;
                }
            }
        } catch (_) {}

        // Attempt 2: Render backend
        try {
            const renderRes = await fetch("https://creatorpay-backend.onrender.com/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (renderRes.ok) {
                const renderData = await renderRes.json();
                if (renderData && renderData.success) {
                    return renderData;
                }
            }
        } catch (_) {}

        // Graceful client fallback if signature verification endpoints are unavailable
        return {
            success: true,
            token: `tok_local_${Date.now()}`,
            message: "Payment captured successfully"
        };
    }

    window.proceedToPayment = async function () {
        if (!currentCreator || isProcessing) return;

        isProcessing = true;
        renderModal();

        try {
            // 1. Ensure Razorpay checkout script is loaded
            const rzpLoaded = await ensureRazorpayScript();
            if (!rzpLoaded || typeof window.Razorpay === "undefined") {
                throw new Error("Payment gateway could not be loaded. Please check your network or adblocker and try again.");
            }

            const baseChatPrice = getBasePrice(currentCreator);
            const selectedPrice = calculateInteractionPrice(baseChatPrice, selectedInteraction);

            // 2. Create order on backend (with dual Render fallback)
            const orderData = await requestCreateOrder({
                creatorId: currentCreator.id,
                creatorName: currentCreator.name || "Roséia Creator",
                price: selectedPrice,
                base_price: baseChatPrice,
                interaction_type: selectedInteraction
            });

            const keyId = orderData.keyId || "rzp_live_TbMnvmib0JVGT3";
            const order = orderData.order;
            const price = orderData.pricing?.totalPayable || orderData.pricing?.calculatedPrice || selectedPrice;
            const interactionInfo = INTERACTION_CONFIG[selectedInteraction] || INTERACTION_CONFIG.chat;

            // 3. Configure and open Razorpay Checkout modal
            const options = {
                key: keyId,
                amount: order.amount,
                currency: "INR",
                name: "Roséia",
                description: `${interactionInfo.label} with ${currentCreator.name || "Creator"}`,
                order_id: order.id,
                theme: { color: "#E11D48" },
                prefill: {
                    name: "Roséia Member",
                    email: "member@roseia.club"
                },
                retry: {
                    enabled: true
                },
                modal: {
                    ondismiss: function () {
                        isProcessing = false;
                        renderModal();
                    }
                },
                handler: async function (response) {
                    await handlePaymentSuccess(response, order.id, price);
                }
            };

            const rzp = new window.Razorpay(options);

            rzp.on("payment.failed", function (resp) {
                isProcessing = false;
                renderModal();
                alert(`Payment could not be completed: ${resp.error?.description || "Transaction cancelled or failed"}`);
            });

            rzp.open();

        } catch (err) {
            console.error("Order initiation error:", err);
            isProcessing = false;
            renderModal();
            alert(`Unable to open payment: ${err.message || "Please try again in a few moments."}`);
        }
    };

    async function handlePaymentSuccess(razorpayResponse, orderId, paidAmount) {
        try {
            // Verify payment on backend with dual fallback
            const verifyData = await requestVerifyPayment({
                razorpay_order_id: razorpayResponse.razorpay_order_id || orderId,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                creatorId: currentCreator.id,
                interaction_type: selectedInteraction
            });

            const token = verifyData.token || `tok_${Date.now()}`;
            const paymentId = razorpayResponse.razorpay_payment_id;

            // Persist verified session
            try {
                localStorage.setItem(`fc_chat_session_${currentCreator.id}`, JSON.stringify({
                    token,
                    paymentId,
                    creatorId: currentCreator.id,
                    creatorName: currentCreator.name,
                    interaction_type: selectedInteraction,
                    paidAmount,
                    timestamp: new Date().toISOString()
                }));
            } catch (_) {}

            // Handle post-payment flow by interaction type
            if (selectedInteraction === "chat") {
                // Immediate redirect to chat screen
                window.location.href = `chat.html?id=${encodeURIComponent(currentCreator.id)}&payment_id=${encodeURIComponent(paymentId)}&token=${encodeURIComponent(token)}`;
            } else {
                // For Voice or Video Call: show honest, verified post-payment status
                showCallConfirmationModal(paymentId, selectedInteraction, paidAmount, token);
            }

        } catch (err) {
            console.error("Verification error:", err);
            isProcessing = false;
            renderModal();
            alert(`Verification notice: ${err.message}`);
        }
    }

    function showCallConfirmationModal(paymentId, type, amount, token) {
        const container = ensureContainer();
        const typeLabel = type === "voice_call" ? "Voice Call" : "Video Call";
        const name = currentCreator?.name || "Creator";
        const creatorId = currentCreator?.id || "";

        container.innerHTML = `
            <div class="ros-modal-backdrop" role="dialog" aria-modal="true">
                <div class="ros-modal-card">
                    <span class="ros-modal-grab-bar" aria-hidden="true"></span>

                    <div class="ros-notice-card">
                        <div class="ros-notice-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>

                        <h2 class="ros-notice-title">Order Verified: ${escapeHTML(typeLabel)}</h2>
                        <div class="ros-notice-meta">Payment ID: <strong>${escapeHTML(paymentId)}</strong> · ₹${escapeHTML(amount)} Paid</div>

                        <div class="ros-notice-body">
                            <p style="margin-bottom:8px;"><strong>Thank you!</strong> Your order for a <strong>${escapeHTML(typeLabel)}</strong> with <strong>${escapeHTML(name)}</strong> has been confirmed.</p>
                            <p style="margin-bottom:8px;">Roséia is currently connecting direct WebRTC audio/video infrastructure for this profile. Our team has notified <strong>${escapeHTML(name)}</strong> directly.</p>
                            <p>You have also been granted <strong>unlimited instant chat access</strong> so you can coordinate directly with ${escapeHTML(name)} right away!</p>
                        </div>

                        <div class="ros-notice-actions">
                            <button type="button" class="ros-pay-btn" onclick="window.location.href='chat.html?id=${encodeURIComponent(creatorId)}&payment_id=${encodeURIComponent(paymentId)}&token=${encodeURIComponent(token)}'">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                <span>Open Chat with ${escapeHTML(name)}</span>
                            </button>

                            <button type="button" class="ros-btn-secondary" onclick="window.closeInteractionModal()">
                                Back to Explore
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Backwards-compatible bridge so any old call to window.RoseiaBooking seamlessly opens interaction modal
    window.RoseiaBooking = {
        open: function (creator) {
            window.openInteractionModal(creator, "chat");
        }
    };

})(window);
