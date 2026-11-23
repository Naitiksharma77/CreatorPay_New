/**
 * Takora — Centralized Monthly Subscription & Razorpay AutoPay Checkout
 * Basic ₹9/mo · Pro ₹29/mo · Premium ₹99/mo
 */
(function () {
    "use strict";

    const DEFAULT_PLANS = [
        {
            code: "basic",
            name: "Basic",
            priceInr: 9,
            interval: "month",
            badge: "Starter",
            tagline: "Browse creator profiles and enjoy unlimited 1-on-1 Chat.",
            features: { profiles: true, chat: true, voice_call: false, video_call: false },
            featureList: [
                { label: "Browse all creator profiles", included: true },
                { label: "Unlimited 1-on-1 Chat access", included: true },
                { label: "Voice / Phone Call access", included: false },
                { label: "HD Video Call access", included: false }
            ]
        },
        {
            code: "pro",
            name: "Pro",
            priceInr: 29,
            interval: "month",
            badge: "Most Popular",
            tagline: "Chat plus private 1-on-1 Voice & Audio calls across Takora.",
            features: { profiles: true, chat: true, voice_call: true, video_call: false },
            featureList: [
                { label: "Browse all creator profiles", included: true },
                { label: "Unlimited 1-on-1 Chat access", included: true },
                { label: "Voice / Phone Call access", included: true },
                { label: "HD Video Call access", included: false }
            ]
        },
        {
            code: "premium",
            name: "Premium",
            priceInr: 99,
            interval: "month",
            badge: "All Access",
            tagline: "Complete access including Chat, Voice Calls, and HD Video Calls.",
            features: { profiles: true, chat: true, voice_call: true, video_call: true },
            featureList: [
                { label: "Browse all creator profiles", included: true },
                { label: "Unlimited 1-on-1 Chat access", included: true },
                { label: "Voice / Phone Call access", included: true },
                { label: "HD Video Call access", included: true }
            ]
        }
    ];

    const TIER_RANK = { basic: 1, pro: 2, premium: 3 };

    const plansGrid = document.getElementById("plansGrid");
    const memberStatusBar = document.getElementById("memberStatusBar");
    const memberStatusTitle = document.getElementById("memberStatusTitle");
    const memberStatusSub = document.getElementById("memberStatusSub");
    const memberStatusActions = document.getElementById("memberStatusActions");
    const pricingAlertBox = document.getElementById("pricingAlertBox");

    const urlParams = new URLSearchParams(window.location.search);
    const highlightedPlan = String(urlParams.get("plan") || "").trim().toLowerCase();
    const callbackError = String(urlParams.get("checkout_error") || "").trim();

    let plansList = [...DEFAULT_PLANS];
    let gatewayInfo = { configured: true, missingEnvVars: [] };
    let checkoutBusyPlan = null;
    let activePendingCheckout = null;
    let syncPollTimer = null;
    let syncPollAttempts = 0;
    let frameCheckTimer = null;

    function escapeHTML(val) {
        return String(val ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeExternalUrl(url) {
        if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
            return url;
        }
        return "";
    }

    function formatDate(iso) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
        } catch (_) {
            return "—";
        }
    }

    function stopFrameCheck() {
        if (frameCheckTimer) {
            clearTimeout(frameCheckTimer);
            frameCheckTimer = null;
        }
    }

    function stopSyncPolling() {
        if (syncPollTimer) {
            clearInterval(syncPollTimer);
            syncPollTimer = null;
        }
        syncPollAttempts = 0;
    }

    function showAlert(kind, htmlMessage) {
        if (!pricingAlertBox) return;
        if (!htmlMessage) {
            pricingAlertBox.className = "inline-alert";
            pricingAlertBox.innerHTML = "";
            return;
        }
        pricingAlertBox.className = `inline-alert show ${kind || "info"}`;
        pricingAlertBox.innerHTML = htmlMessage;
    }

    function ensureRazorpayLoaded(timeoutMs = 7000) {
        if (typeof window.Razorpay === "function") {
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            const startedAt = Date.now();
            const existingScript = document.querySelector('script[src*="checkout.razorpay.com/v1/checkout.js"]');

            if (!existingScript) {
                const script = document.createElement("script");
                script.src = "https://checkout.razorpay.com/v1/checkout.js";
                script.async = true;
                script.onload = () => resolve(typeof window.Razorpay === "function");
                script.onerror = () => resolve(false);
                document.head.appendChild(script);
            }

            const poll = setInterval(() => {
                if (typeof window.Razorpay === "function") {
                    clearInterval(poll);
                    resolve(true);
                    return;
                }
                if (Date.now() - startedAt >= timeoutMs) {
                    clearInterval(poll);
                    resolve(typeof window.Razorpay === "function");
                }
            }, 150);
        });
    }

    function isRazorpayModalMounted() {
        const frame = document.querySelector(".razorpay-checkout-frame");
        if (!frame) return false;
        const rect = frame.getBoundingClientRect();
        const style = window.getComputedStyle(frame);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 40 && rect.height > 40;
    }

    function showCheckoutHelperPanel({ kind, headline, detail, subscriptionId, plan, shortUrl }) {
        const safeUrl = safeExternalUrl(shortUrl);
        const actionButtons = [
            safeUrl
                ? `<a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer" class="alert-action-btn primary">Open Official Razorpay Payment Page ↗</a>`
                : "",
            subscriptionId
                ? `<button type="button" id="syncStatusNowBtn" class="alert-action-btn">I've Paid — Verify &amp; Activate</button>`
                : ""
        ]
            .filter(Boolean)
            .join("");

        showAlert(
            kind || "info",
            `
                <div><strong>${escapeHTML(headline)}</strong> ${escapeHTML(detail)}</div>
                ${actionButtons ? `<div class="inline-alert-actions">${actionButtons}</div>` : ""}
            `
        );

        const syncBtn = document.getElementById("syncStatusNowBtn");
        if (syncBtn && subscriptionId) {
            syncBtn.addEventListener("click", () => {
                syncSubscriptionStatus(subscriptionId, plan, { manual: true });
            });
        }
    }

    function startSyncPolling(subscriptionId, plan) {
        stopSyncPolling();
        if (!subscriptionId) return;

        syncPollAttempts = 0;
        syncPollTimer = setInterval(async () => {
            syncPollAttempts += 1;
            if (syncPollAttempts > 85) {
                stopSyncPolling();
                return;
            }
            await syncSubscriptionStatus(subscriptionId, plan, { manual: false });
        }, 3500);
    }

    async function syncSubscriptionStatus(subscriptionId, plan, { manual = false } = {}) {
        if (!subscriptionId || !window.TakoraAuth) return false;
        const syncBtn = document.getElementById("syncStatusNowBtn");
        if (manual && syncBtn) {
            syncBtn.disabled = true;
            syncBtn.textContent = "Checking Razorpay...";
        }

        try {
            const { res, data } = await window.TakoraAuth.apiFetch("/api/subscriptions/sync-status", {
                method: "POST",
                body: JSON.stringify({ subscriptionId })
            });

            if (res.ok && data && data.success) {
                stopSyncPolling();
                stopFrameCheck();
                checkoutBusyPlan = null;
                activePendingCheckout = null;
                await window.TakoraAuth.refreshSession();
                const subId = encodeURIComponent(subscriptionId);
                const planCode = encodeURIComponent((plan && plan.code) || "");
                window.location.href = `payment_success.html?subscription_id=${subId}&plan=${planCode}`;
                return true;
            }

            if (manual) {
                if (syncBtn) {
                    syncBtn.disabled = false;
                    syncBtn.textContent = "I've Paid — Verify & Activate";
                }
                const statusMsg =
                    (data && data.message) ||
                    "Payment not confirmed on Razorpay yet. If you just paid, wait a few seconds and click Verify again.";
                window.TakoraAuth.showToast(statusMsg, res.status >= 400);
            }
        } catch (_) {
            if (manual && syncBtn) {
                syncBtn.disabled = false;
                syncBtn.textContent = "I've Paid — Verify & Activate";
            }
        }
        return false;
    }

    function renderMemberStatus() {
        const auth = window.TakoraAuth
            ? window.TakoraAuth.getState()
            : { loaded: false, authenticated: false, user: null, subscription: null };

        if (!auth.loaded) {
            memberStatusTitle.textContent = "Checking your membership status...";
            return;
        }

        if (!auth.authenticated || !auth.user) {
            memberStatusBar.classList.remove("has-plan");
            memberStatusTitle.textContent = "Sign In or Create a Free Account";
            memberStatusSub.textContent = "Free account required so your monthly membership and Razorpay AutoPay stay linked to your profile.";
            memberStatusActions.innerHTML = `
                <button type="button" class="bar-btn primary" onclick="window.TakoraAuth && window.TakoraAuth.openAuthModal('register')">Create Free Account</button>
                <button type="button" class="bar-btn" onclick="window.TakoraAuth && window.TakoraAuth.openAuthModal('login')">Sign In</button>
                <a href="creator_home.html" class="bar-btn">Explore Creators</a>
            `;
            return;
        }

        const sub = auth.subscription;
        const contactDisplay = auth.user.email || auth.user.phone || "Active Member";

        if (sub && sub.hasActiveAccess) {
            memberStatusBar.classList.add("has-plan");
            memberStatusTitle.textContent = `${sub.planName} Plan Active · ₹${sub.priceInr}/month`;
            memberStatusSub.textContent = sub.cancelAtPeriodEnd
                ? `${contactDisplay}. AutoPay cancelled — access active until ${formatDate(sub.currentEnd)}.`
                : `${contactDisplay}. Next Razorpay AutoPay renewal: ${formatDate(sub.currentEnd)}.`;
            memberStatusActions.innerHTML = `
                <button type="button" class="bar-btn primary" onclick="window.TakoraAuth.openAccountModal()">Manage AutoPay</button>
                <a href="creator_home.html" class="bar-btn">Explore Creators</a>
            `;
            return;
        }

        if (sub && sub.status === "authenticated" && !sub.hasActiveAccess) {
            memberStatusBar.classList.remove("has-plan");
            memberStatusTitle.textContent = "Mandate Pending Confirmation";
            memberStatusSub.textContent = `Your ${sub.planName || ""} AutoPay mandate is awaiting bank payment settlement.`;
            memberStatusActions.innerHTML = `
                <button type="button" class="bar-btn primary" onclick="window.TakoraAuth.openAccountModal()">Check Status</button>
            `;
            return;
        }

        memberStatusBar.classList.remove("has-plan");
        memberStatusTitle.textContent = "Ready to Subscribe";
        memberStatusSub.textContent = "No active monthly plan yet. Select a plan below to start connecting with creators.";
        memberStatusActions.innerHTML = `
            <a href="creator_home.html" class="bar-btn">Explore Creators</a>
        `;
    }

    function renderPlanCards() {
        if (!plansGrid) return;

        const auth = window.TakoraAuth
            ? window.TakoraAuth.getState()
            : { authenticated: false, subscription: null };
        const sub = auth.subscription;
        const activePlanCode = sub && sub.hasActiveAccess ? sub.planCode : null;
        const activeRank = activePlanCode ? (TIER_RANK[activePlanCode] || 0) : 0;

        plansGrid.innerHTML = plansList
            .map((plan) => {
                const isRecommended = plan.code === "pro";
                const isFocused = highlightedPlan && highlightedPlan === plan.code;
                const planRank = TIER_RANK[plan.code] || 0;
                const isCurrentPlan = Boolean(activePlanCode === plan.code && !sub.cancelAtPeriodEnd);
                const isLowerThanActive = Boolean(activeRank > 0 && planRank < activeRank && !sub.cancelAtPeriodEnd);
                const isUpgrade = Boolean(activeRank > 0 && planRank > activeRank && !sub.cancelAtPeriodEnd);
                const isBusy = checkoutBusyPlan === plan.code;

                let ctaLabel = `Choose ${plan.name} · ₹${plan.priceInr}/mo`;
                let ctaClass = isRecommended ? "plan-cta-btn primary" : "plan-cta-btn";
                let ctaDisabled = false;

                if (isBusy) {
                    ctaLabel = "Opening Razorpay Checkout...";
                    ctaDisabled = true;
                } else if (isCurrentPlan) {
                    ctaLabel = "✓ Current Active Plan (Manage)";
                    ctaClass = "plan-cta-btn active-current";
                } else if (isUpgrade) {
                    ctaLabel = `Upgrade to ${plan.name} · ₹${plan.priceInr}/mo`;
                    ctaClass = "plan-cta-btn primary";
                } else if (isLowerThanActive) {
                    ctaLabel = `Included in your ${sub.planName} Plan`;
                    ctaClass = "plan-cta-btn";
                }

                const featuresHTML = (plan.featureList || [])
                    .map((item) => {
                        const cls = item.included ? "inc" : "exc";
                        return `
                            <li class="${cls}">
                                <span class="feat-icon" aria-hidden="true">${item.included ? "✓" : "✕"}</span>
                                <span>${escapeHTML(item.label)}</span>
                            </li>
                        `;
                    })
                    .join("");

                return `
                    <article class="plan-card ${isRecommended ? "recommended" : ""} ${isFocused ? "focused" : ""}" data-plan-card="${escapeHTML(plan.code)}">
                        <div class="plan-top-row">
                            <h2 class="plan-name">${escapeHTML(plan.name)}</h2>
                            <span class="plan-badge">${escapeHTML(plan.badge || "Monthly")}</span>
                        </div>
                        <div class="plan-price-row">
                            <span class="plan-currency">₹</span>
                            <span class="plan-amount">${escapeHTML(plan.priceInr)}</span>
                            <span class="plan-period">/ month</span>
                        </div>
                        <p class="plan-tagline">${escapeHTML(plan.tagline)}</p>
                        <ul class="plan-features">${featuresHTML}</ul>
                        <button
                            type="button"
                            class="${ctaClass}"
                            data-select-plan="${escapeHTML(plan.code)}"
                            ${ctaDisabled ? "disabled" : ""}
                        >
                            ${escapeHTML(ctaLabel)}
                        </button>
                    </article>
                `;
            })
            .join("");

        plansGrid.querySelectorAll("[data-select-plan]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const code = btn.getAttribute("data-select-plan");
                handlePlanSelect(code);
            });
        });
    }

    async function handlePlanSelect(planCode) {
        if (window.TakoraAuth && !window.TakoraAuth.getState().loaded) {
            await window.TakoraAuth.refreshSession();
        }

        const auth = window.TakoraAuth ? window.TakoraAuth.getState() : { authenticated: false, subscription: null };
        if (!auth.authenticated || !auth.user) {
            if (window.TakoraAuth && typeof window.TakoraAuth.openAuthModal === "function") {
                window.TakoraAuth.openAuthModal("register", () => {
                    startPlanCheckout(planCode);
                });
                return;
            }
            showAlert("warn", "<strong>Sign In Required:</strong> Please sign in or create a free account before purchasing a subscription.");
            return;
        }

        const sub = auth.subscription;
        if (sub && sub.hasActiveAccess && !sub.cancelAtPeriodEnd) {
            const currentRank = TIER_RANK[sub.planCode] || 0;
            const targetRank = TIER_RANK[planCode] || 0;
            if (targetRank <= currentRank) {
                window.TakoraAuth.openAccountModal();
                return;
            }
        }

        await startPlanCheckout(planCode);
    }

    async function fallbackApiFetch(url, opts) {
        const RENDER_BACKEND_URL = "https://creatorpay-backend.onrender.com";
        const host = (window.location && window.location.hostname || "").toLowerCase();
        const isStaticHost =
            host.endsWith(".vercel.app") ||
            host.endsWith(".netlify.app") ||
            host.endsWith(".pages.dev") ||
            host.endsWith(".github.io");
        const fetchOpts = {
            ...opts,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "Takora-Web",
                ...((opts && opts.headers) || {})
            }
        };
        const parseResp = async (r) => {
            const txt = await r.text();
            let parsed = {};
            try {
                parsed = txt ? JSON.parse(txt) : {};
            } catch (_) {
                parsed = { success: false, message: `Server returned HTTP ${r.status} (${r.statusText || "Error"}).` };
            }
            return { res: r, data: parsed };
        };

        const targetUrl = isStaticHost && url.startsWith("/api/") ? `${RENDER_BACKEND_URL}${url}` : url;
        let res = await fetch(targetUrl, fetchOpts);
        if (!isStaticHost && url.startsWith("/api/") && (res.status === 404 || res.status === 405)) {
            res = await fetch(`${RENDER_BACKEND_URL}${url}`, fetchOpts);
        }
        return parseResp(res);
    }

    async function startPlanCheckout(planCode) {
        if (checkoutBusyPlan) return;
        stopFrameCheck();
        stopSyncPolling();
        showAlert("", "");

        if (!gatewayInfo.configured) {
            const missing = (gatewayInfo.missingEnvVars || []).join(", ") || "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET";
            showAlert(
                "warn",
                `<strong>Razorpay AutoPay Gateway Not Configured:</strong> Missing environment variables (<code>${escapeHTML(missing)}</code>). Configure your Razorpay API credentials in the server environment to process live subscriptions.`
            );
            return;
        }

        const auth = window.TakoraAuth ? window.TakoraAuth.getState() : { authenticated: false, subscription: null };
        if (!auth.authenticated || !auth.user) {
            if (window.TakoraAuth && typeof window.TakoraAuth.openAuthModal === "function") {
                window.TakoraAuth.openAuthModal("register", () => startPlanCheckout(planCode));
                return;
            }
            showAlert("warn", "<strong>Sign In Required:</strong> Please sign in or create a free account before subscribing.");
            return;
        }

        const sub = auth.subscription;
        const isUpgrade = Boolean(sub && sub.hasActiveAccess && !sub.cancelAtPeriodEnd);
        const endpoint = isUpgrade ? "/api/subscriptions/upgrade" : "/api/subscriptions/create";

        checkoutBusyPlan = planCode;
        renderPlanCards();

        const safeApiFetch = (url, opts) => {
            if (window.TakoraAuth && typeof window.TakoraAuth.apiFetch === "function") {
                return window.TakoraAuth.apiFetch(url, opts);
            }
            return fallbackApiFetch(url, opts);
        };

        try {
            const { res, data } = await safeApiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify({ planCode })
            });

            if (res.status === 401 || (data && data.code === "AUTH_REQUIRED")) {
                checkoutBusyPlan = null;
                renderPlanCards();
                if (window.TakoraAuth && typeof window.TakoraAuth.openAuthModal === "function") {
                    window.TakoraAuth.openAuthModal("login", () => startPlanCheckout(planCode));
                    return;
                }
                throw new Error(data.message || "Please sign in or create a free account before continuing.");
            }

            if (res.status === 503 || data.code === "RAZORPAY_NOT_CONFIGURED") {
                const missing = (data.missingEnvVars || []).join(", ") || "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET";
                showAlert(
                    "warn",
                    `<strong>Razorpay AutoPay Gateway Not Configured:</strong> ${escapeHTML(data.message || `Set ${missing} in server environment variables.`)}`
                );
                checkoutBusyPlan = null;
                renderPlanCards();
                return;
            }

            if (!res.ok || !data.success || !data.subscription || !data.subscription.id) {
                throw new Error(
                    data.message || `Unable to create Razorpay subscription (HTTP ${res.status}).`
                );
            }

            const subscriptionId = data.subscription.id;
            const shortUrl = data.subscription.short_url || "";
            activePendingCheckout = {
                subscriptionId,
                plan: data.plan,
                shortUrl
            };

            // Ensure Razorpay checkout.js is loaded (with dynamic retry)
            const rzpLoaded = await ensureRazorpayLoaded();
            if (!rzpLoaded || typeof window.Razorpay !== "function") {
                checkoutBusyPlan = null;
                renderPlanCards();
                if (shortUrl) {
                    showCheckoutHelperPanel({
                        kind: "warn",
                        headline: "Complete Payment on Razorpay:",
                        detail: `Your ${data.plan.name} (₹${data.plan.priceInr}/mo) subscription is ready. Open the official Razorpay payment page below to complete payment, and your membership will activate automatically.`,
                        subscriptionId,
                        plan: data.plan,
                        shortUrl
                    });
                    startSyncPolling(subscriptionId, data.plan);
                    return;
                }
                throw new Error("Razorpay Checkout script failed to load. Please refresh and try again.");
            }

            const hasPrefill = Boolean(
                data.prefill &&
                (data.prefill.email || data.prefill.contact || data.prefill.name)
            );

            const options = {
                key: data.keyId,
                subscription_id: subscriptionId,
                name: "Takora",
                description: `${data.plan.name} Plan · ₹${data.plan.priceInr}/month (Monthly AutoPay Mandate · Cancel Anytime)`,
                notes: {
                    planCode: data.plan.code,
                    billingCycle: "monthly",
                    amountInr: String(data.plan.priceInr)
                },
                theme: {
                    color: "#2563EB"
                },
                retry: {
                    enabled: true
                },
                modal: {
                    confirm_close: true,
                    escape: true,
                    backdropclose: false,
                    ondismiss: () => {
                        stopFrameCheck();
                        checkoutBusyPlan = null;
                        renderPlanCards();
                        syncSubscriptionStatus(subscriptionId, data.plan, { manual: false });
                        if (shortUrl) {
                            showCheckoutHelperPanel({
                                kind: "info",
                                headline: "Checkout Window Closed:",
                                detail: `Your ${data.plan.name} (₹${data.plan.priceInr}/month · AutoPay) subscription was not completed yet. Open the official Razorpay link below or select a plan card to retry.`,
                                subscriptionId,
                                plan: data.plan,
                                shortUrl
                            });
                        } else if (window.TakoraAuth) {
                            window.TakoraAuth.showToast("Subscription checkout closed before payment.");
                        }
                    }
                },
                handler: async function (rzpResponse) {
                    stopFrameCheck();
                    await verifySubscriptionPayment(rzpResponse, data.plan);
                }
            };

            if (hasPrefill) {
                options.prefill = data.prefill;
            }

            const rzp = new window.Razorpay(options);

            rzp.on("payment.failed", (resp) => {
                stopFrameCheck();
                checkoutBusyPlan = null;
                renderPlanCards();
                const errObj = (resp && resp.error) || {};
                const desc = errObj.description || errObj.reason || "Payment authorization failed on Razorpay.";
                showCheckoutHelperPanel({
                    kind: "error",
                    headline: "Subscription Payment Failed:",
                    detail: `${desc}${errObj.code ? ` (${errObj.code})` : ""} Please retry with UPI AutoPay or Card below.`,
                    subscriptionId,
                    plan: data.plan,
                    shortUrl
                });
            });

            rzp.on("fault.close", () => {
                stopFrameCheck();
                checkoutBusyPlan = null;
                renderPlanCards();
                showCheckoutHelperPanel({
                    kind: "warn",
                    headline: "Embedded Checkout Unavailable:",
                    detail: `Your browser or preview frame closed the embedded Razorpay popup. Click "Open Official Razorpay Payment Page ↗" below to authorize your ${data.plan.name} (₹${data.plan.priceInr}/month) AutoPay mandate securely on Razorpay.`,
                    subscriptionId,
                    plan: data.plan,
                    shortUrl
                });
            });

            // Start hosted fallback helper & automatic Razorpay settlement polling
            startSyncPolling(subscriptionId, data.plan);
            showCheckoutHelperPanel({
                kind: "info",
                headline: `Razorpay AutoPay Ready — ${data.plan.name} (₹${data.plan.priceInr}/month):`,
                detail: "Billed monthly via Razorpay AutoPay (UPI AutoPay / Card, cancel anytime). Complete authorization in the Razorpay window or use the official link below.",
                subscriptionId,
                plan: data.plan,
                shortUrl
            });

            rzp.open();

            // Verify Razorpay modal actually rendered visibly; release button & surface fallback if blocked
            frameCheckTimer = setTimeout(() => {
                frameCheckTimer = null;
                checkoutBusyPlan = null;
                renderPlanCards();
                if (!isRazorpayModalMounted() && shortUrl) {
                    showCheckoutHelperPanel({
                        kind: "warn",
                        headline: "Popup Blocked or Restricted by Browser Frame:",
                        detail: `Click "Open Official Razorpay Payment Page ↗" below to pay ₹${data.plan.priceInr} securely on Razorpay, then return here or click Verify.`,
                        subscriptionId,
                        plan: data.plan,
                        shortUrl
                    });
                }
            }, 2500);
        } catch (err) {
            stopFrameCheck();
            checkoutBusyPlan = null;
            renderPlanCards();
            showAlert("error", `<strong>Checkout Error:</strong> ${escapeHTML(err.message || "Unable to start subscription checkout.")}`);
        }
    }

    async function verifySubscriptionPayment(rzpResponse, plan) {
        stopSyncPolling();
        showAlert("info", "Verifying your Razorpay AutoPay authorization and payment with the server...");
        try {
            const { res, data } = await window.TakoraAuth.apiFetch("/api/subscriptions/verify", {
                method: "POST",
                body: JSON.stringify({
                    razorpay_payment_id: rzpResponse.razorpay_payment_id,
                    razorpay_subscription_id: rzpResponse.razorpay_subscription_id,
                    razorpay_signature: rzpResponse.razorpay_signature
                })
            });

            checkoutBusyPlan = null;

            if (res.status === 202 || data.pendingConfirmation) {
                await window.TakoraAuth.refreshSession();
                renderPlanCards();
                startSyncPolling(rzpResponse.razorpay_subscription_id, plan);
                showCheckoutHelperPanel({
                    kind: "warn",
                    headline: "AutoPay Mandate Authorized — Confirming Settlement:",
                    detail: data.message || "Paid access will unlock automatically once Razorpay confirms the initial charge.",
                    subscriptionId: rzpResponse.razorpay_subscription_id,
                    plan,
                    shortUrl: activePendingCheckout ? activePendingCheckout.shortUrl : ""
                });
                return;
            }

            if (!res.ok || !data.success) {
                renderPlanCards();
                showAlert("error", `<strong>Verification Failed:</strong> ${escapeHTML(data.message || "Could not confirm your payment.")}`);
                return;
            }

            activePendingCheckout = null;
            await window.TakoraAuth.refreshSession();
            const subId = encodeURIComponent(rzpResponse.razorpay_subscription_id || "");
            const planCode = encodeURIComponent((plan && plan.code) || "");
            window.location.href = `payment_success.html?subscription_id=${subId}&plan=${planCode}`;
        } catch (err) {
            checkoutBusyPlan = null;
            renderPlanCards();
            showAlert("error", `<strong>Verification Network Error:</strong> ${escapeHTML(err.message || "Please click Verify Payment Status or check Account Settings in a moment.")}`);
        }
    }

    async function initPricingPage() {
        renderPlanCards();
        renderMemberStatus();

        if (callbackError) {
            showAlert(
                "warn",
                "<strong>Checkout Redirect Notice:</strong> Your Razorpay payment did not complete or could not be verified yet. Please select a plan below to retry."
            );
        }

        try {
            const fetcher = window.TakoraAuth && window.TakoraAuth.apiFetch
                ? window.TakoraAuth.apiFetch
                : (u, o) => fallbackApiFetch(u, o);
            const { res, data } = await fetcher("/api/subscriptions/plans", { method: "GET" });
            if (res.ok && data && data.success) {
                if (Array.isArray(data.plans) && data.plans.length > 0) {
                    plansList = data.plans;
                }
                if (data.razorpay) {
                    gatewayInfo = data.razorpay;
                    if (!gatewayInfo.configured) {
                        const missing = (gatewayInfo.missingEnvVars || []).join(", ") || "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET";
                        showAlert(
                            "warn",
                            `<strong>Razorpay AutoPay Gateway Setup Required:</strong> Server environment variables missing (<code>${escapeHTML(missing)}</code>). Plans are displayed below, and live checkout activates automatically once Razorpay credentials are configured.`
                        );
                    }
                }
            }
        } catch (_) {}

        renderPlanCards();

        if (highlightedPlan) {
            const card = plansGrid.querySelector(`[data-plan-card="${highlightedPlan}"]`);
            if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }

    window.addEventListener("takora:auth-changed", () => {
        renderMemberStatus();
        renderPlanCards();
    });

    document.addEventListener("DOMContentLoaded", initPricingPage);
})();