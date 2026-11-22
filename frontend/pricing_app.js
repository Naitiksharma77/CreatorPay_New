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

    let plansList = [...DEFAULT_PLANS];
    let gatewayInfo = { configured: true, missingEnvVars: [] };
    let checkoutBusyPlan = null;

    function escapeHTML(val) {
        return String(val ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
            memberStatusTitle.textContent = "Instant Monthly Membership";
            memberStatusSub.textContent = "Select Basic, Pro, or Premium below to unlock creator interactions immediately — no account creation required.";
            memberStatusActions.innerHTML = `
                <a href="creator_home.html" class="bar-btn">Explore Creators</a>
            `;
            return;
        }

        const sub = auth.subscription;
        const contactDisplay = auth.user.email && !String(auth.user.email).endsWith("@member.takora.local")
            ? auth.user.email
            : (auth.user.phone || "Active Member");

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

        const auth = window.TakoraAuth ? window.TakoraAuth.getState() : { subscription: null };
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

    async function startPlanCheckout(planCode) {
        if (checkoutBusyPlan) return;
        showAlert("", "");

        if (!gatewayInfo.configured) {
            const missing = (gatewayInfo.missingEnvVars || []).join(", ") || "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET";
            showAlert(
                "warn",
                `<strong>Razorpay AutoPay Gateway Not Configured:</strong> Missing environment variables (<code>${escapeHTML(missing)}</code>). Configure your Razorpay API credentials in the server environment to process live subscriptions.`
            );
            return;
        }

        const auth = window.TakoraAuth ? window.TakoraAuth.getState() : { subscription: null };
        const sub = auth.subscription;
        const isUpgrade = Boolean(sub && sub.hasActiveAccess && !sub.cancelAtPeriodEnd);
        const endpoint = isUpgrade ? "/api/subscriptions/upgrade" : "/api/subscriptions/create";

        checkoutBusyPlan = planCode;
        renderPlanCards();

        try {
            const { res, data } = await window.TakoraAuth.apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify({ planCode })
            });

            if (data && data.sessionToken && window.TakoraAuth && window.TakoraAuth.setSessionToken) {
                window.TakoraAuth.setSessionToken(data.sessionToken);
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
                throw new Error(data.message || "Unable to create Razorpay subscription.");
            }

            if (typeof window.Razorpay !== "function") {
                throw new Error("Razorpay Checkout script failed to load. Please refresh and try again.");
            }

            const options = {
                key: data.keyId,
                subscription_id: data.subscription.id,
                name: "Takora",
                description: `${data.plan.name} Monthly Membership (₹${data.plan.priceInr}/month)`,
                prefill: data.prefill || {},
                notes: {
                    planCode: data.plan.code
                },
                theme: {
                    color: "#2563EB"
                },
                modal: {
                    ondismiss: () => {
                        checkoutBusyPlan = null;
                        renderPlanCards();
                        window.TakoraAuth.showToast("Subscription checkout closed before completion.");
                    }
                },
                handler: async function (rzpResponse) {
                    await verifySubscriptionPayment(rzpResponse, data.plan);
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", (resp) => {
                checkoutBusyPlan = null;
                renderPlanCards();
                const desc = (resp && resp.error && resp.error.description) || "Payment authorization failed.";
                showAlert("error", `<strong>Subscription Payment Failed:</strong> ${escapeHTML(desc)}`);
            });
            rzp.open();
        } catch (err) {
            checkoutBusyPlan = null;
            renderPlanCards();
            showAlert("error", `<strong>Checkout Error:</strong> ${escapeHTML(err.message || "Unable to start subscription checkout.")}`);
        }
    }

    async function verifySubscriptionPayment(rzpResponse, plan) {
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
                showAlert(
                    "warn",
                    `<strong>AutoPay Mandate Authorized — Waiting for Payment Settlement:</strong> ${escapeHTML(data.message || "Paid access will unlock automatically once Razorpay confirms the initial charge.")}`
                );
                return;
            }

            if (!res.ok || !data.success) {
                renderPlanCards();
                showAlert("error", `<strong>Verification Failed:</strong> ${escapeHTML(data.message || "Could not confirm your payment.")}`);
                return;
            }

            await window.TakoraAuth.refreshSession();
            const subId = encodeURIComponent(rzpResponse.razorpay_subscription_id || "");
            const planCode = encodeURIComponent((plan && plan.code) || "");
            window.location.href = `payment_success.html?subscription_id=${subId}&plan=${planCode}`;
        } catch (err) {
            checkoutBusyPlan = null;
            renderPlanCards();
            showAlert("error", `<strong>Verification Network Error:</strong> ${escapeHTML(err.message || "Please check Account Settings in a moment.")}`);
        }
    }

    async function initPricingPage() {
        renderPlanCards();
        renderMemberStatus();

        try {
            const fetcher = window.TakoraAuth ? window.TakoraAuth.apiFetch : (u) => fetch(u).then(async (r) => ({ res: r, data: await r.json() }));
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