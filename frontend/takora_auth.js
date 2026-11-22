/**
 * Takora — Client Authentication, Subscription Entitlements & Call Session Module
 * Zero hardcoded secrets, cookie/in-memory auth, strict server-verified gating.
 */
(function () {
    "use strict";

    let authState = {
        loaded: false,
        authenticated: false,
        user: null,
        subscription: null,
        entitlements: { chat: false, voice: false, video: false },
        payments: [],
        plans: null
    };

    let memoryBearerToken = null;
    let pendingCallback = null;
    let activeStream = null;
    let callTimerInterval = null;

    function escapeHTML(val) {
        if (val === undefined || val === null) return "";
        return String(val)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeImageUrl(url) {
        if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("/"))) {
            return url;
        }
        return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
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

    async function apiFetch(url, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (options.body && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        headers["X-Requested-With"] = "Takora-Web";
        if (memoryBearerToken && !headers["Authorization"]) {
            headers["Authorization"] = `Bearer ${memoryBearerToken}`;
        }
        const res = await fetch(url, {
            ...options,
            headers,
            credentials: "include"
        });
        let data = {};
        try {
            data = await res.json();
        } catch (_) {}
        return { res, data };
    }

    function injectStyles() {
        if (document.getElementById("takora-auth-styles")) return;
        const style = document.createElement("style");
        style.id = "takora-auth-styles";
        style.textContent = `
            .tk-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 9500;
                background: rgba(15, 23, 42, 0.52);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                display: none;
                align-items: center;
                justify-content: center;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
            }
            .tk-modal-backdrop.open {
                display: flex;
            }
            .tk-modal-card {
                width: 100%;
                max-width: 440px;
                max-height: 90vh;
                overflow-y: auto;
                background: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 22px;
                padding: 24px;
                box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
                color: #0F172A;
                position: relative;
                animation: tkModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .tk-modal-card.wide {
                max-width: 520px;
            }
            @keyframes tkModalIn {
                from { opacity: 0; transform: translateY(10px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .tk-modal-head {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 16px;
            }
            .tk-modal-title {
                font-size: 20px;
                font-weight: 800;
                color: #0F172A;
                letter-spacing: -0.4px;
                line-height: 1.2;
            }
            .tk-modal-sub {
                font-size: 13px;
                color: #64748B;
                margin-top: 4px;
                line-height: 1.45;
            }
            .tk-close-btn {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                color: #64748B;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: background 0.15s ease, color 0.15s ease;
            }
            .tk-close-btn:hover {
                background: #EFF6FF;
                color: #2563EB;
                border-color: #DBEAFE;
            }
            .tk-free-notice {
                background: #EFF6FF;
                border: 1px solid #DBEAFE;
                border-radius: 12px;
                padding: 10px 14px;
                font-size: 12.5px;
                font-weight: 600;
                color: #1D4ED8;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                line-height: 1.4;
            }
            .tk-tabs {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
                background: #F1F5F9;
                padding: 4px;
                border-radius: 12px;
                margin-bottom: 18px;
            }
            .tk-tab-btn {
                height: 40px;
                border: none;
                background: transparent;
                border-radius: 9px;
                font-size: 13.5px;
                font-weight: 700;
                color: #64748B;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .tk-tab-btn.active {
                background: #FFFFFF;
                color: #0F172A;
                box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
            }
            .tk-field {
                margin-bottom: 14px;
            }
            .tk-field label {
                display: block;
                font-size: 12.5px;
                font-weight: 700;
                color: #334155;
                margin-bottom: 6px;
            }
            .tk-field input {
                width: 100%;
                min-height: 44px;
                padding: 10px 14px;
                border-radius: 12px;
                border: 1px solid #E2E8F0;
                background: #F8FAFC;
                color: #0F172A;
                font-size: 14px;
                outline: none;
                transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
            }
            .tk-field input:focus {
                background: #FFFFFF;
                border-color: #2563EB;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
            }
            .tk-error-box {
                display: none;
                background: #FEF2F2;
                border: 1px solid #FECACA;
                color: #B91C1C;
                border-radius: 12px;
                padding: 10px 12px;
                font-size: 12.5px;
                font-weight: 600;
                margin-bottom: 14px;
                line-height: 1.4;
            }
            .tk-error-box.show {
                display: block;
            }
            .tk-primary-btn {
                width: 100%;
                min-height: 46px;
                padding: 12px 18px;
                border-radius: 14px;
                border: none;
                background: #2563EB;
                color: #FFFFFF;
                font-size: 14.5px;
                font-weight: 700;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                text-decoration: none;
                transition: background 0.15s ease, transform 0.15s ease;
                box-shadow: 0 6px 18px rgba(37, 99, 235, 0.25);
            }
            .tk-primary-btn:hover:not(:disabled) {
                background: #1D4ED8;
            }
            .tk-primary-btn:active:not(:disabled) {
                transform: scale(0.985);
            }
            .tk-primary-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .tk-secondary-btn {
                width: 100%;
                min-height: 42px;
                padding: 10px 16px;
                border-radius: 12px;
                border: 1px solid #E2E8F0;
                background: #FFFFFF;
                color: #0F172A;
                font-size: 13.5px;
                font-weight: 650;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                text-decoration: none;
                transition: background 0.15s ease, border-color 0.15s ease;
            }
            .tk-secondary-btn:hover {
                background: #F8FAFC;
                border-color: #CBD5E1;
            }
            .tk-danger-btn {
                width: 100%;
                min-height: 42px;
                padding: 10px 16px;
                border-radius: 12px;
                border: 1px solid #FECACA;
                background: #FEF2F2;
                color: #B91C1C;
                font-size: 13.5px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.15s ease;
            }
            .tk-danger-btn:hover {
                background: #FEE2E2;
            }
            .tk-sub-panel {
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 16px;
            }
            .tk-sub-panel.active-blue {
                background: #EFF6FF;
                border-color: #DBEAFE;
            }
            .tk-sub-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 10px;
            }
            .tk-plan-name {
                font-size: 17px;
                font-weight: 800;
                color: #0F172A;
            }
            .tk-status-text {
                font-size: 12px;
                font-weight: 700;
                color: #16A34A;
            }
            .tk-status-text.warn {
                color: #D97706;
            }
            .tk-status-text.muted {
                color: #64748B;
            }
            .tk-meta-line {
                font-size: 12.5px;
                color: #64748B;
                line-height: 1.5;
                font-variant-numeric: tabular-nums;
            }
            .tk-cap-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-top: 12px;
            }
            .tk-cap-item {
                background: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 10px;
                padding: 8px 6px;
                text-align: center;
                font-size: 11.5px;
                font-weight: 700;
                color: #64748B;
            }
            .tk-cap-item.enabled {
                border-color: #BFDBFE;
                color: #1D4ED8;
                background: #FFFFFF;
            }
            .tk-history-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
            }
            .tk-history-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 10px 12px;
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-radius: 12px;
                font-size: 12.5px;
                font-variant-numeric: tabular-nums;
            }
            .tk-header-auth-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                min-height: 36px;
                padding: 6px 12px;
                border-radius: 10px;
                border: 1px solid #DBEAFE;
                background: #EFF6FF;
                color: #1D4ED8;
                font-size: 12.5px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                flex-shrink: 0;
                transition: all 0.15s ease;
            }
            .tk-header-auth-btn:hover {
                background: #DBEAFE;
            }
            .tk-header-auth-btn.solid {
                background: #2563EB;
                border-color: #2563EB;
                color: #FFFFFF;
            }
            .tk-header-auth-btn.solid:hover {
                background: #1D4ED8;
            }
            .tk-toast {
                position: fixed;
                bottom: 84px;
                left: 50%;
                transform: translateX(-50%) translateY(16px);
                background: #0F172A;
                color: #FFFFFF;
                padding: 11px 18px;
                border-radius: 14px;
                font-size: 13px;
                font-weight: 600;
                z-index: 9999;
                opacity: 0;
                pointer-events: none;
                box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
                transition: opacity 0.2s ease, transform 0.2s ease;
                max-width: calc(100vw - 32px);
                text-align: center;
            }
            .tk-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            .tk-toast.error {
                background: #B91C1C;
            }
            .tk-call-room {
                text-align: center;
                padding: 12px 4px 4px;
            }
            .tk-call-video-stage {
                position: relative;
                width: 100%;
                aspect-ratio: 4/3;
                border-radius: 18px;
                overflow: hidden;
                background: #0F172A;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .tk-call-video-stage img.remote-photo {
                width: 100%;
                height: 100%;
                object-fit: cover;
                opacity: 0.92;
            }
            .tk-call-local-pip {
                position: absolute;
                bottom: 12px;
                right: 12px;
                width: 96px;
                height: 128px;
                border-radius: 12px;
                overflow: hidden;
                border: 2px solid #FFFFFF;
                background: #1E293B;
                object-fit: cover;
            }
            .tk-call-avatar-ring {
                width: 96px;
                height: 96px;
                border-radius: 50%;
                margin: 8px auto 14px;
                padding: 3px;
                border: 3px solid #2563EB;
                overflow: hidden;
            }
            .tk-call-avatar-ring img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
            }
            .tk-call-timer {
                font-size: 15px;
                font-weight: 700;
                color: #2563EB;
                font-variant-numeric: tabular-nums;
                margin: 6px 0 14px;
            }
            .tk-call-controls {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 14px;
                margin-top: 14px;
            }
            .tk-call-ctrl-btn {
                min-width: 54px;
                height: 48px;
                padding: 0 16px;
                border-radius: 14px;
                border: 1px solid #E2E8F0;
                background: #F8FAFC;
                color: #0F172A;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
            }
            .tk-call-ctrl-btn.active {
                background: #EFF6FF;
                border-color: #2563EB;
                color: #1D4ED8;
            }
            .tk-call-end-btn {
                min-width: 112px;
                height: 48px;
                padding: 0 20px;
                border-radius: 14px;
                border: none;
                background: #DC2626;
                color: #FFFFFF;
                font-size: 13.5px;
                font-weight: 700;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureContainers() {
        injectStyles();
        if (!document.getElementById("tkModalBackdrop")) {
            const backdrop = document.createElement("div");
            backdrop.id = "tkModalBackdrop";
            backdrop.className = "tk-modal-backdrop";
            backdrop.setAttribute("aria-hidden", "true");
            backdrop.addEventListener("click", (e) => {
                if (e.target === backdrop && !document.getElementById("tkCallActiveFlag")) {
                    closeModal();
                }
            });
            document.body.appendChild(backdrop);
        }
        if (!document.getElementById("tkToastEl")) {
            const toast = document.createElement("div");
            toast.id = "tkToastEl";
            toast.className = "tk-toast";
            document.body.appendChild(toast);
        }
    }

    let toastTimer = null;
    function showToast(msg, isError = false) {
        ensureContainers();
        const el = document.getElementById("tkToastEl");
        if (!el) return;
        el.textContent = msg;
        el.className = `tk-toast show${isError ? " error" : ""}`;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.className = "tk-toast";
        }, 3600);
    }

    function stopActiveCallResources() {
        if (callTimerInterval) {
            clearInterval(callTimerInterval);
            callTimerInterval = null;
        }
        if (activeStream) {
            try {
                activeStream.getTracks().forEach((t) => t.stop());
            } catch (_) {}
            activeStream = null;
        }
    }

    function closeModal() {
        stopActiveCallResources();
        const backdrop = document.getElementById("tkModalBackdrop");
        if (!backdrop) return;
        backdrop.classList.remove("open");
        backdrop.setAttribute("aria-hidden", "true");
        backdrop.innerHTML = "";
    }

    function emitAuthChanged() {
        syncHeaderAndSheetUI();
        try {
            window.dispatchEvent(new CustomEvent("takora:auth-changed", { detail: { ...authState } }));
        } catch (_) {}
    }

    function normalizeSubscription(sub, ent) {
        if (!sub && !ent) return null;
        const planCode = (sub && sub.plan_code) || (ent && ent.planCode) || null;
        const planName = (sub && sub.plan_name) || (ent && ent.planName) || "Free";
        const priceInr = (sub && sub.amount_inr !== undefined) ? Number(sub.amount_inr) : Number((ent && ent.amountInr) || 0);
        const hasActiveAccess = Boolean(ent && ent.hasActiveSubscription);
        return {
            ...(sub || {}),
            planCode,
            planName,
            priceInr,
            hasActiveAccess,
            cancelAtPeriodEnd: Boolean((sub && sub.cancel_at_period_end) || (ent && ent.cancelAtPeriodEnd)),
            currentEnd: (sub && sub.current_end) || (ent && ent.currentEnd) || null,
            nextBillingDate: (sub && sub.next_billing_date) || (ent && ent.nextBillingDate) || null
        };
    }

    function normalizeEntitlements(ent) {
        const raw = ent || {};
        return {
            ...raw,
            hasActiveSubscription: Boolean(raw.hasActiveSubscription),
            chat: Boolean(raw.canChat || raw.chat),
            voice: Boolean(raw.canVoiceCall || raw.voice),
            video: Boolean(raw.canVideoCall || raw.video),
            canChat: Boolean(raw.canChat || raw.chat),
            canVoiceCall: Boolean(raw.canVoiceCall || raw.voice),
            canVideoCall: Boolean(raw.canVideoCall || raw.video)
        };
    }

    async function refreshSession() {
        try {
            const { res, data } = await apiFetch("/api/auth/me", { method: "GET" });
            if (res.ok && data && data.authenticated) {
                const ent = normalizeEntitlements(data.entitlements);
                authState.loaded = true;
                authState.authenticated = true;
                authState.user = data.user || null;
                authState.entitlements = ent;
                authState.subscription = data.subscription ? normalizeSubscription(data.subscription, ent) : null;
                authState.payments = Array.isArray(data.paymentHistory)
                    ? data.paymentHistory
                    : (Array.isArray(data.payments) ? data.payments : []);
                emitAuthChanged();
                return authState;
            }
        } catch (_) {}

        authState.loaded = true;
        authState.authenticated = false;
        authState.user = null;
        authState.subscription = null;
        authState.entitlements = normalizeEntitlements(null);
        authState.payments = [];
        emitAuthChanged();
        return authState;
    }

    async function loadPlans() {
        if (authState.plans) return authState.plans;
        try {
            const { res, data } = await apiFetch("/api/subscriptions/plans", { method: "GET" });
            if (res.ok && data && data.success && Array.isArray(data.plans)) {
                authState.plans = data.plans;
                return authState.plans;
            }
        } catch (_) {}
        return [
            { code: "basic", name: "Basic", priceInr: 9, intervalLabel: "month", permissions: { chat: true, voice: false, video: false } },
            { code: "pro", name: "Pro", priceInr: 29, intervalLabel: "month", permissions: { chat: true, voice: true, video: false } },
            { code: "premium", name: "Premium", priceInr: 99, intervalLabel: "month", permissions: { chat: true, voice: true, video: true } }
        ];
    }

    function setSessionToken(token) {
        if (token && typeof token === "string") {
            memoryBearerToken = token;
        }
    }

    function displayUserLabel(user) {
        if (!user) return "";
        const email = String(user.email || "");
        if (email && !email.endsWith("@member.takora.local")) return email;
        if (user.phone) return String(user.phone);
        return "Takora Member";
    }

    function syncHeaderAndSheetUI() {
        const headerBtn = document.getElementById("headerAuthButton");
        const headerPlanBadge = document.getElementById("headerPlanBadge");
        if (headerBtn) {
            if (authState.authenticated && authState.user) {
                const sub = authState.subscription;
                if (sub && sub.hasActiveAccess) {
                    headerBtn.textContent = `${sub.planName} Plan`;
                    headerBtn.className = "tk-header-auth-btn";
                } else {
                    headerBtn.textContent = "Membership";
                    headerBtn.className = "tk-header-auth-btn";
                }
            } else {
                headerBtn.textContent = headerBtn.dataset.guestLabel || "Plans · ₹9/mo";
                headerBtn.className = "tk-header-auth-btn solid";
            }
        }
        if (headerPlanBadge) {
            if (authState.authenticated && authState.subscription && authState.subscription.hasActiveAccess) {
                headerPlanBadge.textContent = `${authState.subscription.planName} · ₹${authState.subscription.priceInr}/mo`;
                headerPlanBadge.style.display = "inline-flex";
            } else {
                headerPlanBadge.style.display = "none";
            }
        }

        // Hydrate bottom sheet #profileSheetModal slots if present
        const sheetNameEl = document.getElementById("sheetUserName");
        const sheetSubEl = document.getElementById("sheetUserSubtitle");
        const sheetAuthSection = document.getElementById("sheetAuthSection");
        if (sheetNameEl) {
            sheetNameEl.textContent = authState.authenticated && authState.user
                ? (authState.user.name || "Takora Member")
                : "Takora Visitor";
        }
        if (sheetSubEl) {
            if (authState.authenticated && authState.subscription && authState.subscription.hasActiveAccess) {
                sheetSubEl.textContent = `${authState.subscription.planName} Member · Active`;
            } else if (authState.authenticated) {
                sheetSubEl.textContent = `${displayUserLabel(authState.user)} · No Active Plan`;
            } else {
                sheetSubEl.textContent = "Choose a monthly plan to unlock Chat & Calls";
            }
        }
        if (sheetAuthSection) {
            if (!authState.authenticated) {
                sheetAuthSection.innerHTML = `
                    <div style="margin-top:16px; display:flex; flex-direction:column; gap:10px;">
                        <a href="pricing.html" class="tk-primary-btn">
                            Choose a Monthly Plan (from ₹9/mo)
                        </a>
                        <button type="button" class="tk-secondary-btn" onclick="if(window.toggleProfileSheet)toggleProfileSheet(); window.TakoraAuth.openAuthModal('login')">
                            Already Subscribed? Sign In
                        </button>
                    </div>
                `;
            } else {
                const sub = authState.subscription;
                const planLine = sub && sub.hasActiveAccess
                    ? `${escapeHTML(sub.planName)} Plan (₹${escapeHTML(sub.priceInr)}/month)${sub.cancelAtPeriodEnd ? " · Cancels " + formatDate(sub.currentEnd) : ""}`
                    : "No active monthly membership yet";
                sheetAuthSection.innerHTML = `
                    <div style="margin-top:16px; padding:14px; border-radius:14px; background:#EFF6FF; border:1px solid #DBEAFE;">
                        <div style="font-size:12px; font-weight:700; color:#1D4ED8; margin-bottom:4px;">Membership Status</div>
                        <div style="font-size:14px; font-weight:700; color:#0F172A;">${planLine}</div>
                    </div>
                    <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
                        <button type="button" class="tk-primary-btn" onclick="if(window.toggleProfileSheet)toggleProfileSheet(); window.TakoraAuth.openAccountModal()">
                            Manage Membership &amp; AutoPay
                        </button>
                        <a href="pricing.html" class="tk-secondary-btn">
                            ${sub && sub.hasActiveAccess ? "Upgrade or Compare Plans" : "Choose a Monthly Plan"}
                        </a>
                        <button type="button" class="tk-secondary-btn" style="color:#64748B;" onclick="window.TakoraAuth.logout()">
                            Sign Out
                        </button>
                    </div>
                `;
            }
        }
    }

    function openAuthModal(_initialMode = "login", onSuccessCallback = null) {
        ensureContainers();
        pendingCallback = typeof onSuccessCallback === "function" ? onSuccessCallback : null;

        const backdrop = document.getElementById("tkModalBackdrop");
        backdrop.innerHTML = `
            <div class="tk-modal-card" role="dialog" aria-modal="true" aria-labelledby="tkAuthTitle">
                <div class="tk-modal-head">
                    <div>
                        <h2 id="tkAuthTitle" class="tk-modal-title">Member Sign In</h2>
                        <p class="tk-modal-sub">Sign in with your existing member email and password.</p>
                    </div>
                    <button type="button" class="tk-close-btn" id="tkAuthCloseBtn" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div id="tkAuthError" class="tk-error-box"></div>

                <form id="tkAuthForm">
                    <div class="tk-field">
                        <label for="tkAuthEmail">Email Address</label>
                        <input type="email" id="tkAuthEmail" placeholder="you@example.com" required autocomplete="email">
                    </div>
                    <div class="tk-field">
                        <label for="tkAuthPassword">Password</label>
                        <input type="password" id="tkAuthPassword" placeholder="Enter password" required minlength="6" autocomplete="current-password">
                    </div>
                    <button type="submit" id="tkAuthSubmitBtn" class="tk-primary-btn">
                        Sign In
                    </button>
                    <a href="pricing.html" class="tk-secondary-btn" style="margin-top:10px; color:#2563EB; border-color:#DBEAFE; background:#EFF6FF;">
                        Or Subscribe Directly (from ₹9/mo)
                    </a>
                </form>
            </div>
        `;

        backdrop.classList.add("open");
        backdrop.setAttribute("aria-hidden", "false");

        document.getElementById("tkAuthCloseBtn").onclick = closeModal;

        document.getElementById("tkAuthForm").onsubmit = async (e) => {
            e.preventDefault();
            const errEl = document.getElementById("tkAuthError");
            const submitBtn = document.getElementById("tkAuthSubmitBtn");
            errEl.classList.remove("show");
            errEl.textContent = "";

            const email = document.getElementById("tkAuthEmail").value.trim();
            const password = document.getElementById("tkAuthPassword").value;

            const origLabel = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "Signing in...";

            try {
                const { res, data } = await apiFetch("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ email, password })
                });

                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Sign in failed.");
                }

                if (data.token) {
                    memoryBearerToken = data.token;
                }

                await refreshSession();
                const cb = pendingCallback;
                pendingCallback = null;
                closeModal();
                showToast("Signed in successfully.");
                if (cb) {
                    cb(authState);
                }
            } catch (err) {
                errEl.textContent = err.message || "Unable to continue.";
                errEl.classList.add("show");
                submitBtn.disabled = false;
                submitBtn.textContent = origLabel;
            }
        };
    }

    async function openAccountModal() {
        ensureContainers();
        if (!authState.loaded) {
            await refreshSession();
        }
        if (!authState.authenticated) {
            window.location.href = "pricing.html";
            return;
        }

        const backdrop = document.getElementById("tkModalBackdrop");
        backdrop.innerHTML = `
            <div class="tk-modal-card wide" role="dialog" aria-modal="true" aria-labelledby="tkAccTitle">
                <div class="tk-modal-head">
                    <div>
                        <h2 id="tkAccTitle" class="tk-modal-title">Membership &amp; AutoPay</h2>
                        <p class="tk-modal-sub">${escapeHTML(authState.user.name || "Takora Member")} · ${escapeHTML(displayUserLabel(authState.user))}</p>
                    </div>
                    <button type="button" class="tk-close-btn" id="tkAccCloseBtn" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div style="padding:20px; text-align:center; color:#64748B; font-size:13.5px;">Loading membership details...</div>
            </div>
        `;
        backdrop.classList.add("open");
        backdrop.setAttribute("aria-hidden", "false");
        document.getElementById("tkAccCloseBtn").onclick = closeModal;

        const { res, data } = await apiFetch("/api/subscriptions/me", { method: "GET" });
        if (res.ok && data && data.success) {
            const entNorm = normalizeEntitlements(data.entitlements);
            authState.entitlements = entNorm;
            authState.subscription = data.subscription ? normalizeSubscription(data.subscription, entNorm) : null;
            authState.payments = Array.isArray(data.paymentHistory)
                ? data.paymentHistory
                : (Array.isArray(data.payments) ? data.payments : []);
            emitAuthChanged();
        }

        const sub = authState.subscription;
        const ent = authState.entitlements;
        const payments = authState.payments || [];

        const hasSub = Boolean(sub && sub.hasActiveAccess);
        const canCancelAutoPay = Boolean(sub && sub.status === "active" && !sub.cancelAtPeriodEnd);
        const statusLabel = !sub
            ? "Free Account"
            : sub.cancelAtPeriodEnd
                ? `Cancels ${formatDate(sub.currentEnd)}`
                : sub.status === "active"
                    ? "Active · AutoPay On"
                    : sub.status === "authenticated"
                        ? "Pending First Payment"
                        : (sub.status || "Inactive");

        const statusClass = sub && sub.status === "active" && !sub.cancelAtPeriodEnd
            ? ""
            : (sub && (sub.cancelAtPeriodEnd || sub.status === "authenticated") ? "warn" : "muted");

        backdrop.innerHTML = `
            <div class="tk-modal-card wide" role="dialog" aria-modal="true" aria-labelledby="tkAccTitle">
                <div class="tk-modal-head">
                    <div>
                        <h2 id="tkAccTitle" class="tk-modal-title">Membership &amp; AutoPay</h2>
                        <p class="tk-modal-sub">${escapeHTML(authState.user.name || "Takora Member")} · ${escapeHTML(displayUserLabel(authState.user))}</p>
                    </div>
                    <button type="button" class="tk-close-btn" id="tkAccCloseBtn" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div class="tk-sub-panel ${hasSub ? "active-blue" : ""}">
                    <div class="tk-sub-top">
                        <span class="tk-plan-name">${hasSub ? `${escapeHTML(sub.planName)} Plan (₹${escapeHTML(sub.priceInr)}/mo)` : "No Active Membership"}</span>
                        <span class="tk-status-text ${statusClass}">${escapeHTML(statusLabel)}</span>
                    </div>
                    <div class="tk-meta-line">
                        ${sub && sub.currentEnd
                            ? (sub.cancelAtPeriodEnd
                                ? `Access remains active until <strong>${formatDate(sub.currentEnd)}</strong>. AutoPay will not renew.`
                                : `Next billing date: <strong>${formatDate(sub.currentEnd)}</strong> via Razorpay AutoPay`)
                            : "Subscribe to Basic (₹9/mo), Pro (₹29/mo), or Premium (₹99/mo) to unlock creator interactions."}
                    </div>
                    <div class="tk-cap-grid">
                        <div class="tk-cap-item ${ent.chat ? "enabled" : ""}">${ent.chat ? "✓" : "✕"} 1:1 Chat</div>
                        <div class="tk-cap-item ${ent.voice ? "enabled" : ""}">${ent.voice ? "✓" : "✕"} Voice Call</div>
                        <div class="tk-cap-item ${ent.video ? "enabled" : ""}">${ent.video ? "✓" : "✕"} Video Call</div>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
                    <a href="pricing.html" class="tk-primary-btn">
                        ${hasSub ? (sub.planCode === "premium" ? "View Plan Details" : "Upgrade Plan") : "Choose a Monthly Plan"}
                    </a>
                    ${canCancelAutoPay ? `
                        <button type="button" id="tkCancelAutoPayBtn" class="tk-danger-btn">Cancel Monthly AutoPay</button>
                        <div id="tkCancelConfirmWrap" style="display:none; background:#FEF2F2; border:1px solid #FECACA; border-radius:12px; padding:12px;">
                            <div style="font-size:12.5px; color:#991B1B; font-weight:600; margin-bottom:10px;">
                                Cancel AutoPay at the end of your current billing cycle? You keep access until ${formatDate(sub.currentEnd)}.
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button type="button" id="tkConfirmCancelBtn" class="tk-danger-btn" style="background:#DC2626; color:#FFFFFF; border-color:#DC2626;">Confirm Cancel</button>
                                <button type="button" id="tkAbortCancelBtn" class="tk-secondary-btn">Keep AutoPay</button>
                            </div>
                        </div>
                    ` : ""}
                </div>

                <div style="border-top:1px solid #E2E8F0; padding-top:14px; margin-bottom:14px;">
                    <div style="font-size:13px; font-weight:700; color:#0F172A; margin-bottom:8px;">Subscription Payment History</div>
                    ${payments.length === 0
                        ? `<div style="font-size:12.5px; color:#64748B;">No subscription payments recorded yet.</div>`
                        : `<div class="tk-history-list">
                            ${payments.slice(0, 6).map((p) => `
                                <div class="tk-history-row">
                                    <div>
                                        <div style="font-weight:700; color:#0F172A;">${escapeHTML((p.plan_code || "plan").toUpperCase())} · ₹${escapeHTML(p.amount_inr || 0)}</div>
                                        <div style="font-size:11.5px; color:#64748B;">${formatDate(p.paid_at || p.created_at)}${p.razorpay_payment_id ? ` · ${escapeHTML(p.razorpay_payment_id)}` : ""}</div>
                                    </div>
                                    <span style="font-weight:700; color:${p.status === "captured" ? "#16A34A" : "#B91C1C"}; text-transform:capitalize;">${escapeHTML(p.status || "recorded")}</span>
                                </div>
                            `).join("")}
                        </div>`
                    }
                </div>

                <button type="button" id="tkLogoutBtn" class="tk-secondary-btn" style="color:#64748B;">Sign Out</button>
            </div>
        `;

        document.getElementById("tkAccCloseBtn").onclick = closeModal;
        document.getElementById("tkLogoutBtn").onclick = () => logout();

        const cancelBtn = document.getElementById("tkCancelAutoPayBtn");
        const confirmWrap = document.getElementById("tkCancelConfirmWrap");
        const confirmBtn = document.getElementById("tkConfirmCancelBtn");
        const abortBtn = document.getElementById("tkAbortCancelBtn");

        if (cancelBtn && confirmWrap) {
            cancelBtn.onclick = () => {
                cancelBtn.style.display = "none";
                confirmWrap.style.display = "block";
            };
            abortBtn.onclick = () => {
                confirmWrap.style.display = "none";
                cancelBtn.style.display = "block";
            };
            confirmBtn.onclick = async () => {
                confirmBtn.disabled = true;
                confirmBtn.textContent = "Cancelling...";
                try {
                    const { res: cRes, data: cData } = await apiFetch("/api/subscriptions/cancel", {
                        method: "POST",
                        body: JSON.stringify({})
                    });
                    if (!cRes.ok || !cData.success) {
                        throw new Error(cData.message || "Unable to cancel AutoPay");
                    }
                    await refreshSession();
                    showToast("AutoPay cancelled. Access stays active until cycle end.");
                    openAccountModal();
                } catch (err) {
                    showToast(err.message || "Cancellation failed", true);
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = "Confirm Cancel";
                }
            };
        }
    }

    function openUpgradeModal({ feature, requiredPlanCode, creator, message }) {
        ensureContainers();
        const planMeta = {
            basic: { name: "Basic", price: 9, summary: "Unlock creator browsing and 1-on-1 Chat." },
            pro: { name: "Pro", price: 29, summary: "Unlock Chat and Voice / Audio Calls with any creator." },
            premium: { name: "Premium", price: 99, summary: "Unlock Chat, Voice Calls, and HD Video Calls across all creators." }
        };
        const target = planMeta[requiredPlanCode] || planMeta.basic;
        const featureLabel = feature === "video" ? "HD Video Calls" : feature === "voice" ? "Voice Calls" : "1-on-1 Chat";

        const backdrop = document.getElementById("tkModalBackdrop");
        backdrop.innerHTML = `
            <div class="tk-modal-card" role="dialog" aria-modal="true" aria-labelledby="tkUpgTitle">
                <div class="tk-modal-head">
                    <div>
                        <h2 id="tkUpgTitle" class="tk-modal-title">${authState.subscription && authState.subscription.hasActiveAccess ? `Upgrade to ${target.name}` : "Membership Required"}</h2>
                        <p class="tk-modal-sub">${creator && creator.name ? `Connect with ${escapeHTML(creator.name)} via ${featureLabel}` : `${featureLabel} Access`}</p>
                    </div>
                    <button type="button" class="tk-close-btn" id="tkUpgCloseBtn" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div class="tk-sub-panel active-blue">
                    <div class="tk-sub-top">
                        <span class="tk-plan-name">${target.name} Plan</span>
                        <span style="font-size:20px; font-weight:800; color:#2563EB;">₹${target.price}<span style="font-size:12px; font-weight:600; color:#64748B;">/month</span></span>
                    </div>
                    <p class="tk-meta-line">${escapeHTML(message || target.summary)}</p>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <a href="pricing.html?plan=${encodeURIComponent(requiredPlanCode || "basic")}" class="tk-primary-btn">
                        ${authState.subscription && authState.subscription.hasActiveAccess ? `Upgrade to ${target.name} · ₹${target.price}/mo` : `View Monthly Plans (from ₹9/mo)`}
                    </a>
                    <button type="button" id="tkUpgCancelBtn" class="tk-secondary-btn">Maybe Later</button>
                </div>
            </div>
        `;
        backdrop.classList.add("open");
        backdrop.setAttribute("aria-hidden", "false");
        document.getElementById("tkUpgCloseBtn").onclick = closeModal;
        document.getElementById("tkUpgCancelBtn").onclick = closeModal;
    }

    async function openCallRoomModal({ creator, mode }) {
        ensureContainers();
        stopActiveCallResources();

        const isVideo = mode === "video";
        const backdrop = document.getElementById("tkModalBackdrop");
        const name = (creator && creator.name) || "Creator";
        const avatar = safeImageUrl(creator && creator.profile_image);

        backdrop.innerHTML = `
            <div class="tk-modal-card" id="tkCallActiveFlag" role="dialog" aria-modal="true">
                <div class="tk-modal-head">
                    <div>
                        <h2 class="tk-modal-title">${isVideo ? "HD Video Call" : "Voice Call"}</h2>
                        <p class="tk-modal-sub">Connected via ${escapeHTML(authState.subscription ? authState.subscription.planName : "Membership")} Plan · ${escapeHTML(name)}</p>
                    </div>
                    <button type="button" class="tk-close-btn" id="tkCallHeaderEnd" aria-label="End Call">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div class="tk-call-room">
                    ${isVideo ? `
                        <div class="tk-call-video-stage">
                            <img src="${escapeHTML(avatar)}" alt="${escapeHTML(name)}" class="remote-photo">
                            <video id="tkLocalVideoPreview" class="tk-call-local-pip" autoplay muted playsinline></video>
                        </div>
                    ` : `
                        <div class="tk-call-avatar-ring">
                            <img src="${escapeHTML(avatar)}" alt="${escapeHTML(name)}">
                        </div>
                    `}
                    <div style="font-size:18px; font-weight:800; color:#0F172A;">${escapeHTML(name)}</div>
                    <div id="tkCallStatusNote" style="font-size:12.5px; color:#64748B; margin-top:4px;">Initializing encrypted media stream...</div>
                    <div id="tkCallTimer" class="tk-call-timer">00:00</div>

                    <div class="tk-call-controls">
                        <button type="button" id="tkToggleMicBtn" class="tk-call-ctrl-btn active">Mic On</button>
                        ${isVideo ? `<button type="button" id="tkToggleCamBtn" class="tk-call-ctrl-btn active">Camera On</button>` : ""}
                        <button type="button" id="tkEndCallBtn" class="tk-call-end-btn">End Call</button>
                    </div>
                </div>
            </div>
        `;
        backdrop.classList.add("open");
        backdrop.setAttribute("aria-hidden", "false");

        let seconds = 0;
        const timerEl = document.getElementById("tkCallTimer");
        const statusEl = document.getElementById("tkCallStatusNote");
        callTimerInterval = setInterval(() => {
            seconds += 1;
            const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
            const secs = String(seconds % 60).padStart(2, "0");
            if (timerEl) timerEl.textContent = `${mins}:${secs}`;
        }, 1000);

        let micEnabled = true;
        let camEnabled = isVideo;

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                activeStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: isVideo
                });
                const localVid = document.getElementById("tkLocalVideoPreview");
                if (localVid && isVideo) {
                    localVid.srcObject = activeStream;
                }
                if (statusEl) statusEl.textContent = isVideo ? "HD Video & Audio Ready" : "Voice Session Active";
            } else {
                if (statusEl) statusEl.textContent = "Browser media devices unavailable — session active in listen mode";
            }
        } catch (_) {
            if (statusEl) statusEl.textContent = "Camera/Microphone access blocked by browser — audio/video muted";
        }

        const micBtn = document.getElementById("tkToggleMicBtn");
        if (micBtn) {
            micBtn.onclick = () => {
                micEnabled = !micEnabled;
                if (activeStream) {
                    activeStream.getAudioTracks().forEach((t) => { t.enabled = micEnabled; });
                }
                micBtn.textContent = micEnabled ? "Mic On" : "Mic Muted";
                micBtn.className = `tk-call-ctrl-btn ${micEnabled ? "active" : ""}`;
            };
        }

        const camBtn = document.getElementById("tkToggleCamBtn");
        if (camBtn) {
            camBtn.onclick = () => {
                camEnabled = !camEnabled;
                if (activeStream) {
                    activeStream.getVideoTracks().forEach((t) => { t.enabled = camEnabled; });
                }
                camBtn.textContent = camEnabled ? "Camera On" : "Camera Off";
                camBtn.className = `tk-call-ctrl-btn ${camEnabled ? "active" : ""}`;
            };
        }

        document.getElementById("tkEndCallBtn").onclick = () => {
            closeModal();
            showToast(`${isVideo ? "Video" : "Voice"} call ended.`);
        };
        document.getElementById("tkCallHeaderEnd").onclick = () => {
            closeModal();
        };
    }

    async function checkAndStartInteraction(creator, feature) {
        const normalizedFeature = feature === "video" || feature === "voice" ? feature : "chat";
        if (!authState.loaded) {
            await refreshSession();
        }

        const requiredPlanForFeature = normalizedFeature === "video"
            ? "premium"
            : normalizedFeature === "voice"
                ? "pro"
                : "basic";

        if (!authState.authenticated) {
            openUpgradeModal({
                feature: normalizedFeature,
                requiredPlanCode: requiredPlanForFeature,
                creator
            });
            return;
        }

        const creatorId = creator && creator.id ? creator.id : null;
        const apiFeature = normalizedFeature === "video"
            ? "video_call"
            : normalizedFeature === "voice"
                ? "voice_call"
                : "chat";
        try {
            const { res, data } = await apiFetch("/api/interactions/start", {
                method: "POST",
                body: JSON.stringify({
                    creatorId,
                    feature: apiFeature
                })
            });

            if (res.status === 401 || res.status === 403 || !data.allowed) {
                openUpgradeModal({
                    feature: normalizedFeature,
                    requiredPlanCode: data.requiredPlan || requiredPlanForFeature,
                    creator,
                    message: data.message
                });
                return;
            }

            if (normalizedFeature === "chat") {
                window.location.href = `chat.html?id=${encodeURIComponent(creatorId || "")}`;
                return;
            }

            await openCallRoomModal({
                creator,
                mode: normalizedFeature,
                sessionId: data.session ? data.session.id : null
            });
        } catch (err) {
            showToast(err.message || "Unable to verify membership access.", true);
        }
    }

    async function logout() {
        try {
            await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
        } catch (_) {}
        memoryBearerToken = null;
        await refreshSession();
        closeModal();
        showToast("Signed out.");
    }

    window.TakoraAuth = {
        getState: () => ({ ...authState }),
        setSessionToken,
        refreshSession,
        loadPlans,
        openAuthModal,
        openAccountModal,
        openUpgradeModal,
        checkAndStartInteraction,
        logout,
        apiFetch,
        showToast,
        closeModal,
        syncHeaderAndSheetUI
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            refreshSession();
        });
    } else {
        refreshSession();
    }
})();
