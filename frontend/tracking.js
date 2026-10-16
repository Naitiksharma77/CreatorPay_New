/**
 * Meet You Partner - Real-Time Visitor & Engagement Tracking Client
 * Lightweight, non-intrusive, privacy-respecting client analytics.
 * Does not block page loading or payment processes.
 */
(function () {
    if (window.__MYP_TRACKER_INITIALIZED__) return;
    window.__MYP_TRACKER_INITIALIZED__ = true;

    // Exclude admin pages from visitor traffic metrics
    const path = window.location.pathname || "";
    if (path.includes("admin_creator")) {
        return;
    }

    // 1. Anonymous Persistent Visitor ID
    let visitorId = null;
    let isNewVisitor = false;
    try {
        visitorId = localStorage.getItem("myp_visitor_id");
        if (!visitorId) {
            visitorId = "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
            localStorage.setItem("myp_visitor_id", visitorId);
            isNewVisitor = true;
        }
    } catch (_) {
        visitorId = "v_anon_" + Math.random().toString(36).substring(2, 8);
    }

    // 2. Tab/Session ID (Scoped to browser session)
    let sessionId = null;
    try {
        sessionId = sessionStorage.getItem("myp_session_id");
        if (!sessionId) {
            sessionId = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
            sessionStorage.setItem("myp_session_id", sessionId);
        }
    } catch (_) {
        sessionId = "s_anon_" + Math.random().toString(36).substring(2, 8);
    }

    // 3. Traffic Source & Campaign Resolution
    let trafficSource = "Direct";
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const utmSource = urlParams.get("utm_source");
        const utmCampaign = urlParams.get("utm_campaign");
        if (utmSource) {
            trafficSource = utmCampaign ? `${utmSource} / ${utmCampaign}` : utmSource;
        } else if (document.referrer) {
            try {
                const refHost = new URL(document.referrer).hostname;
                if (refHost && !refHost.includes(window.location.hostname)) {
                    if (refHost.includes("instagram")) trafficSource = "Instagram";
                    else if (refHost.includes("google")) trafficSource = "Google";
                    else if (refHost.includes("facebook")) trafficSource = "Facebook";
                    else if (refHost.includes("twitter") || refHost.includes("t.co")) trafficSource = "Twitter / X";
                    else trafficSource = `Referral (${refHost})`;
                }
            } catch (_) {
                trafficSource = "Referral";
            }
        }
    } catch (_) {}

    // 4. Resolve Current Page Name & Context
    function getPageIdentifier() {
        const file = path.split("/").pop() || "creator_home.html";
        return file.split("?")[0] || "creator_home.html";
    }

    function getTargetCreatorId() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get("id") || null;
        } catch (_) {
            return null;
        }
    }

    // 5. Global Tracker
    window.MYP_TRACK = {
        visitorId,
        sessionId,
        isNewVisitor,
        trackEvent: function (eventType, data = {}) {
            try {
                const payload = {
                    type: eventType,
                    visitorId,
                    sessionId,
                    isNewVisitor,
                    page: getPageIdentifier(),
                    title: document.title || "Meet You Partner",
                    creatorId: data.creatorId || getTargetCreatorId() || null,
                    creatorName: data.creatorName || null,
                    buttonName: data.buttonName || null,
                    amount: data.amount || null,
                    source: trafficSource,
                    referrer: document.referrer || "",
                    timestamp: new Date().toISOString()
                };

                const body = JSON.stringify(payload);
                const endpoint = "/api/analytics/event";

                // Prefer navigator.sendBeacon when available for reliable dispatch on unload
                if (navigator.sendBeacon) {
                    const blob = new Blob([body], { type: "application/json" });
                    navigator.sendBeacon(endpoint, blob);
                } else {
                    fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body,
                        keepalive: true
                    }).catch(() => {});
                }
            } catch (_) {}
        }
    };

    // 6. Record Initial Page View
    window.MYP_TRACK.trackEvent("page_view");

    // If on a creator's profile, record a creator_view event
    const currentCreatorId = getTargetCreatorId();
    if (currentCreatorId && getPageIdentifier().includes("profile")) {
        window.MYP_TRACK.trackEvent("creator_view", { creatorId: currentCreatorId });
    }

    // 7. Live Activity Heartbeat (every 30 seconds while page is active)
    setInterval(() => {
        if (document.visibilityState === "visible") {
            window.MYP_TRACK.trackEvent("heartbeat");
        }
    }, 30000);

    // 8. Automatic Button Click Tracking on Key CTAs
    document.addEventListener(
        "click",
        function (e) {
            try {
                const target = e.target.closest(
                    "button, a.start-connection-btn, a.post-pay-start-btn, a.home-button, a.cta-btn, .tab-btn"
                );
                if (target) {
                    const label = (
                        target.innerText ||
                        target.getAttribute("aria-label") ||
                        target.id ||
                        ""
                    ).trim().substring(0, 60);

                    if (label) {
                        window.MYP_TRACK.trackEvent("button_click", {
                            buttonName: label,
                            creatorId: getTargetCreatorId()
                        });
                    }
                }
            } catch (_) {}
        },
        { passive: true }
    );
})();
