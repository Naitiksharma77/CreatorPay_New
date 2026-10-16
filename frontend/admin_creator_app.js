const API_URL = "https://creatorpay-backend.onrender.com";

// ===============================
// STATE & APPLICATION DATA
// ===============================

let allCreators = [];
let currentFilterText = "";
let currentAnalyticsPeriod = "7d";
let analyticsData = null;
let liveRefreshTimer = null;
let isRefreshing = false;

// ===============================
// DOM ELEMENTS
// ===============================

// Modals
const editCreatorModal = document.getElementById("editCreatorModal");
const closeEditModalButton = document.getElementById("closeEditModalButton");
const editCreatorForm = document.getElementById("editCreatorForm");

const creatorModal = document.getElementById("creatorModal");
const addCreatorButton = document.getElementById("addCreatorButton");
const closeModalButton = document.getElementById("closeModalButton");
const creatorForm = document.getElementById("creatorForm");

// Creator list
const creatorList = document.getElementById("creatorList");
const creatorCount = document.getElementById("creatorCount");
const adminSearchInput = document.getElementById("adminSearchInput");

// Header live status
const headerLiveStatus = document.getElementById("headerLiveStatus");
const headerLastUpdated = document.getElementById("headerLastUpdated");
const manualRefreshBtn = document.getElementById("manualRefreshBtn");
const trackingStartedDate = document.getElementById("trackingStartedDate");

// Section A: Live Activity Elements
const liveActiveUsers = document.getElementById("liveActiveUsers");
const liveActiveSessions = document.getElementById("liveActiveSessions");
const liveVisitorsToday = document.getElementById("liveVisitorsToday");
const liveNewVisitorsToday = document.getElementById("liveNewVisitorsToday");
const liveReturningVisitorsToday = document.getElementById("liveReturningVisitorsToday");
const livePageViewsToday = document.getElementById("livePageViewsToday");

// Section B: Active Users Elements
const metricDAU = document.getElementById("metricDAU");
const metricWAU = document.getElementById("metricWAU");
const metricMAU = document.getElementById("metricMAU");
const metricLifetimeVisitors = document.getElementById("metricLifetimeVisitors");
const metricIdentifiedUsers = document.getElementById("metricIdentifiedUsers");
const metricTotalSessions = document.getElementById("metricTotalSessions");
const metricNewVsReturningRatio = document.getElementById("metricNewVsReturningRatio");

const usersChartStat = document.getElementById("usersChartStat");
const usersChartSubtitle = document.getElementById("usersChartSubtitle");
const usersChartContainer = document.getElementById("usersChartContainer");

// Section C: Revenue Elements
const revenueLifetime = document.getElementById("revenueLifetime");
const revenueToday = document.getElementById("revenueToday");
const revenueWeek = document.getElementById("revenueWeek");
const revenueMonth = document.getElementById("revenueMonth");
const revenueNet = document.getElementById("revenueNet");
const revenueRefunds = document.getElementById("revenueRefunds");
const revenueTotalOrders = document.getElementById("revenueTotalOrders");
const revenuePaidOrders = document.getElementById("revenuePaidOrders");
const revenueFailedPayments = document.getElementById("revenueFailedPayments");
const revenueSuccessRate = document.getElementById("revenueSuccessRate");
const revenueSuccessRateBadge = document.getElementById("revenueSuccessRateBadge");
const revenueAOV = document.getElementById("revenueAOV");
const revenueTotalPaymentsCount = document.getElementById("revenueTotalPaymentsCount");

const revenueChartStat = document.getElementById("revenueChartStat");
const revenueChartSubtitle = document.getElementById("revenueChartSubtitle");
const revenueChartContainer = document.getElementById("revenueChartContainer");

// Section D: Funnel Elements
const funnelCount1 = document.getElementById("funnelCount1");
const funnelCount2 = document.getElementById("funnelCount2");
const funnelCount3 = document.getElementById("funnelCount3");
const funnelCount4 = document.getElementById("funnelCount4");
const funnelCount5 = document.getElementById("funnelCount5");
const funnelCount6 = document.getElementById("funnelCount6");
const funnelCount7 = document.getElementById("funnelCount7");

const funnelBar1 = document.getElementById("funnelBar1");
const funnelBar2 = document.getElementById("funnelBar2");
const funnelBar3 = document.getElementById("funnelBar3");
const funnelBar4 = document.getElementById("funnelBar4");
const funnelBar5 = document.getElementById("funnelBar5");
const funnelBar6 = document.getElementById("funnelBar6");
const funnelBar7 = document.getElementById("funnelBar7");

const funnelRate2 = document.getElementById("funnelRate2");
const funnelRate3 = document.getElementById("funnelRate3");
const funnelRate4 = document.getElementById("funnelRate4");
const funnelRate5 = document.getElementById("funnelRate5");
const funnelRate6 = document.getElementById("funnelRate6");
const funnelRate7 = document.getElementById("funnelRate7");

// Section E & F Elements
const creatorPerformanceTableBody = document.getElementById("creatorPerformanceTableBody");
const topPagesTableBody = document.getElementById("topPagesTableBody");
const trafficSourcesTableBody = document.getElementById("trafficSourcesTableBody");
const recentActivityFeed = document.getElementById("recentActivityFeed");
const chartTooltip = document.getElementById("chartTooltip");

// ===============================
// HELPER: ESCAPE HTML
// ===============================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatINR(val) {
    return "₹" + Number(val || 0).toLocaleString("en-IN");
}

// ===============================
// MODAL CONTROLS (ADD & EDIT)
// ===============================

if (addCreatorButton && creatorModal) {
    addCreatorButton.addEventListener("click", () => {
        creatorModal.classList.add("active");
    });
}

if (closeModalButton && creatorModal) {
    closeModalButton.addEventListener("click", () => {
        creatorModal.classList.remove("active");
    });
}

if (creatorModal) {
    creatorModal.addEventListener("click", (event) => {
        if (event.target === creatorModal) {
            creatorModal.classList.remove("active");
        }
    });
}

if (closeEditModalButton && editCreatorModal) {
    closeEditModalButton.addEventListener("click", () => {
        editCreatorModal.classList.remove("active");
    });
}

if (editCreatorModal) {
    editCreatorModal.addEventListener("click", (event) => {
        if (event.target === editCreatorModal) {
            editCreatorModal.classList.remove("active");
        }
    });
}

// ===============================
// DATE FILTER SEGMENTED CONTROLS
// ===============================

document.querySelectorAll(".segment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const period = btn.dataset.period;
        if (!period || period === currentAnalyticsPeriod) return;

        document.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        currentAnalyticsPeriod = period;
        loadAnalytics(period, false);
    });
});

if (manualRefreshBtn) {
    manualRefreshBtn.addEventListener("click", () => {
        loadAnalytics(currentAnalyticsPeriod, true);
    });
}

// Search filter
if (adminSearchInput) {
    adminSearchInput.addEventListener("input", (e) => {
        currentFilterText = (e.target.value || "").trim().toLowerCase();
        filterAndDisplayCreators();
    });
}

// ===============================
// LOAD & DISPLAY CREATORS (PRESERVED)
// ===============================

async function loadCreators() {
    try {
        let fetchedCreators = [];
        let success = false;

        try {
            const localRes = await fetch("/api/creators");
            if (localRes.ok) {
                const localData = await localRes.json();
                if (localData && localData.success && Array.isArray(localData.creators)) {
                    fetchedCreators = localData.creators;
                    success = true;
                }
            }
        } catch (_) {}

        if (!success) {
            try {
                const res = await fetch(`${API_URL}/api/creators`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success && Array.isArray(data.creators)) {
                        fetchedCreators = data.creators;
                        success = true;
                    }
                }
            } catch (_) {}
        }

        if (success) {
            allCreators = fetchedCreators;
            filterAndDisplayCreators();
        } else {
            creatorList.innerHTML = `
                <div class="empty-state">
                    <h3>Unable to load creators</h3>
                    <p>Could not connect to database.</p>
                </div>
            `;
        }
    } catch (err) {
        console.warn("Issue loading creators:", err);
    }
}

function filterAndDisplayCreators() {
    if (!creatorList) return;

    let filtered = allCreators;
    if (currentFilterText) {
        filtered = allCreators.filter((c) => {
            const nameMatch = (c.name || "").toLowerCase().includes(currentFilterText);
            const catMatch = (c.category || "").toLowerCase().includes(currentFilterText);
            return nameMatch || catMatch;
        });
    }

    if (creatorCount) {
        creatorCount.textContent = `${filtered.length} creator${filtered.length === 1 ? "" : "s"}`;
    }

    if (filtered.length === 0) {
        creatorList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <h3>No creators found</h3>
                <p>${currentFilterText ? "No matches for your search." : "Add your first creator to get started."}</p>
            </div>
        `;
        return;
    }

    creatorList.innerHTML = filtered
        .map((creator) => {
            const avatar = creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http")
                ? creator.profile_image
                : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

            return `
                <div class="creator-item" data-id="${escapeHTML(creator.id)}">
                    <div class="creator-avatar-wrap">
                        <img src="${escapeHTML(avatar)}" alt="${escapeHTML(creator.name)}" class="creator-image">
                    </div>
                    <div class="creator-details">
                        <div class="creator-name-row">
                            <h3>${escapeHTML(creator.name)}</h3>
                            <span class="creator-category-badge">${escapeHTML(creator.category || "General")}</span>
                        </div>
                        <p class="creator-bio-text">${escapeHTML(creator.bio || "No bio provided.")}</p>
                    </div>
                    <div class="creator-price-col">
                        <div class="creator-price">₹${escapeHTML(creator.price || 49)}</div>
                        <div class="creator-price-label">session fee</div>
                    </div>
                    <div class="creator-actions">
                        <a href="friend_profile.html?id=${encodeURIComponent(creator.id)}" class="creator-action" target="_blank" rel="noopener" title="Preview public profile">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <span>View</span>
                        </a>
                        <button type="button" class="creator-action" onclick="openEditModal('${escapeHTML(creator.id)}')" title="Edit profile">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            <span>Edit</span>
                        </button>
                        <button type="button" class="creator-action delete-action" onclick="deleteCreator('${escapeHTML(creator.id)}')" title="Remove profile">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            `;
        })
        .join("");
}

window.openEditModal = function (id) {
    const creator = allCreators.find((c) => String(c.id) === String(id));
    if (!creator) return;

    document.getElementById("editCreatorId").value = creator.id;
    document.getElementById("editCreatorName").value = creator.name || "";
    document.getElementById("editCreatorCategory").value = creator.category || "";
    document.getElementById("editCreatorBio").value = creator.bio || "";
    document.getElementById("editCreatorPrice").value = creator.price || "";
    document.getElementById("editCreatorInstagram").value = creator.instagram_url || "";
    document.getElementById("editCreatorUpi").value = creator.upi_id || "";

    if (editCreatorModal) {
        editCreatorModal.classList.add("active");
    }
};

// ===============================
// ADD CREATOR HANDLER (PRESERVED)
// ===============================

if (creatorForm) {
    creatorForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("creatorName").value.trim();
        const category = document.getElementById("creatorCategory").value.trim();
        const bio = document.getElementById("creatorBio").value.trim();
        const price = document.getElementById("creatorPrice").value;
        const instagram_url = document.getElementById("creatorInstagram").value.trim();
        const upi_id = document.getElementById("creatorUpi").value.trim();
        const imageInput = document.getElementById("creatorImage");

        try {
            let profile_image = null;

            if (imageInput && imageInput.files.length > 0) {
                const imageFormData = new FormData();
                imageFormData.append("profile_image", imageInput.files[0]);

                let imageResponse;
                try {
                    imageResponse = await fetch("/api/upload-creator-image", {
                        method: "POST",
                        body: imageFormData
                    });
                } catch (_) {}

                if (!imageResponse || !imageResponse.ok) {
                    imageResponse = await fetch(`${API_URL}/api/upload-creator-image`, {
                        method: "POST",
                        body: imageFormData
                    });
                }

                const imageResult = await imageResponse.json();
                if (!imageResponse.ok || !imageResult.success) {
                    throw new Error(imageResult.message || "Image upload failed");
                }

                profile_image = imageResult.image_url;
            }

            const creatorData = {
                name,
                category,
                bio,
                price,
                instagram_url,
                upi_id,
                profile_image
            };

            let response;
            try {
                response = await fetch("/api/creators", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(creatorData)
                });
            } catch (_) {}

            if (!response || !response.ok) {
                response = await fetch(`${API_URL}/api/creators`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(creatorData)
                });
            }

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to save creator");
            }

            alert("Creator saved successfully!");
            creatorForm.reset();
            creatorModal.classList.remove("active");
            loadCreators();
            loadAnalytics(currentAnalyticsPeriod, false);

        } catch (error) {
            console.error("Create creator error:", error);
            alert(error.message || "Unable to save creator.");
        }
    });
}

// ===============================
// EDIT CREATOR HANDLER (PRESERVED)
// ===============================

if (editCreatorForm) {
    editCreatorForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const id = document.getElementById("editCreatorId").value;
        const name = document.getElementById("editCreatorName").value.trim();
        const category = document.getElementById("editCreatorCategory").value.trim();
        const bio = document.getElementById("editCreatorBio").value.trim();
        const price = document.getElementById("editCreatorPrice").value;
        const instagram_url = document.getElementById("editCreatorInstagram").value.trim();
        const upi_id = document.getElementById("editCreatorUpi").value.trim();
        const editImageInput = document.getElementById("editProfileImage");

        try {
            let updatedProfileImage = null;

            if (editImageInput && editImageInput.files.length > 0) {
                const imageFormData = new FormData();
                imageFormData.append("profile_image", editImageInput.files[0]);

                let imageResponse;
                try {
                    imageResponse = await fetch("/api/upload-creator-image", {
                        method: "POST",
                        body: imageFormData
                    });
                } catch (_) {}

                if (!imageResponse || !imageResponse.ok) {
                    imageResponse = await fetch(`${API_URL}/api/upload-creator-image`, {
                        method: "POST",
                        body: imageFormData
                    });
                }

                const imageResult = await imageResponse.json();
                if (!imageResponse.ok || !imageResult.success) {
                    throw new Error(imageResult.message || "Image upload failed");
                }

                updatedProfileImage = imageResult.image_url;
            }

            const updatedCreatorData = {
                name,
                category,
                bio,
                price,
                instagram_url,
                upi_id
            };

            if (updatedProfileImage) {
                updatedCreatorData.profile_image = updatedProfileImage;
            }

            let response;
            try {
                response = await fetch(`/api/creators/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedCreatorData)
                });
            } catch (_) {}

            if (!response || !response.ok) {
                response = await fetch(`${API_URL}/api/creators/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedCreatorData)
                });
            }

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to update creator");
            }

            alert("Creator updated successfully!");
            editCreatorForm.reset();
            editCreatorModal.classList.remove("active");
            loadCreators();
            loadAnalytics(currentAnalyticsPeriod, false);

        } catch (error) {
            console.error("Update creator error:", error);
            alert(error.message || "Unable to update creator.");
        }
    });
}

// ===============================
// DELETE CREATOR HANDLER (PRESERVED)
// ===============================

window.deleteCreator = async function (id) {
    const confirmDelete = confirm("Are you sure you want to delete this creator?");
    if (!confirmDelete) return;

    try {
        let response;
        try {
            response = await fetch(`/api/creators/${id}`, { method: "DELETE" });
        } catch (_) {}

        if (!response || !response.ok) {
            response = await fetch(`${API_URL}/api/creators/${id}`, { method: "DELETE" });
        }

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to delete creator");
        }

        alert("Creator deleted successfully!");
        loadCreators();
        loadAnalytics(currentAnalyticsPeriod, false);

    } catch (error) {
        console.error("Delete creator error:", error);
        alert("Unable to delete creator. Please try again.");
    }
};

// ===============================
// COMPLETE ANALYTICS CONTROLLER
// ===============================

async function loadAnalytics(period = "7d", isManual = false) {
    if (isRefreshing) return;
    isRefreshing = true;

    if (manualRefreshBtn) {
        manualRefreshBtn.style.transform = "rotate(180deg)";
        manualRefreshBtn.style.transition = "transform 0.4s ease";
    }

    try {
        let res;
        try {
            res = await fetch(`/api/analytics?period=${encodeURIComponent(period)}`);
        } catch (_) {}

        if (!res || !res.ok) {
            res = await fetch(`${API_URL}/api/analytics?period=${encodeURIComponent(period)}`);
        }

        if (res && res.ok) {
            const data = await res.json();
            if (data && data.success) {
                analyticsData = data;
                updateAllDashboardSections(data, period);
            }
        }
    } catch (err) {
        console.warn("Analytics fetch error:", err);
    } finally {
        isRefreshing = false;
        if (manualRefreshBtn) {
            setTimeout(() => {
                manualRefreshBtn.style.transform = "none";
            }, 400);
        }
    }
}

function updateAllDashboardSections(data, period) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (headerLastUpdated) {
        headerLastUpdated.textContent = `Updated ${timeStr}`;
    }

    let periodLabel = "Last 7 Days";
    if (period === "today") periodLabel = "Today";
    else if (period === "30d") periodLabel = "Last 30 Days";
    else if (period === "lifetime") periodLabel = "Lifetime";

    // 1. SECTION A: LIVE ACTIVITY
    const live = data.live || {};
    if (liveActiveUsers) liveActiveUsers.textContent = (live.activeUsers || 0).toLocaleString();
    if (liveActiveSessions) liveActiveSessions.textContent = (live.activeSessions || 0).toLocaleString();
    if (liveVisitorsToday) liveVisitorsToday.textContent = (live.visitorsToday || 0).toLocaleString();
    if (liveNewVisitorsToday) liveNewVisitorsToday.textContent = (live.newVisitorsToday || 0).toLocaleString();
    if (liveReturningVisitorsToday) liveReturningVisitorsToday.textContent = (live.returningVisitorsToday || 0).toLocaleString();
    if (livePageViewsToday) livePageViewsToday.textContent = (live.pageViewsToday || 0).toLocaleString();

    if (trackingStartedDate && data.trackingStarted) {
        try {
            const d = new Date(data.trackingStarted);
            trackingStartedDate.textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        } catch (_) {}
    }

    // 2. SECTION B: ACTIVE USERS & AUDIENCE METRICS
    const users = data.users || {};
    if (metricDAU) metricDAU.textContent = (users.dau || 0).toLocaleString();
    if (metricWAU) metricWAU.textContent = (users.wau || 0).toLocaleString();
    if (metricMAU) metricMAU.textContent = (users.mau || 0).toLocaleString();
    if (metricLifetimeVisitors) metricLifetimeVisitors.textContent = (users.lifetimeUniqueVisitors || 0).toLocaleString();
    if (metricIdentifiedUsers) metricIdentifiedUsers.textContent = (users.lifetimeIdentifiedUsers || 0).toLocaleString();
    if (metricTotalSessions) metricTotalSessions.textContent = (users.totalSessions || 0).toLocaleString();

    if (metricNewVsReturningRatio) {
        const total = (users.periodNewUsers || 0) + (users.periodReturningUsers || 0);
        const newPct = total > 0 ? Math.round(((users.periodNewUsers || 0) / total) * 100) : 0;
        metricNewVsReturningRatio.textContent = `${newPct}% new · ${100 - newPct}% returning`;
    }

    if (usersChartStat) usersChartStat.textContent = (users.periodActiveUsers || 0).toLocaleString();
    if (usersChartSubtitle) usersChartSubtitle.textContent = `Unique audience during ${periodLabel.toLowerCase()}`;

    // 3. SECTION C: REVENUE ANALYTICS
    const rev = data.revenue || {};
    if (revenueLifetime) revenueLifetime.textContent = formatINR(rev.lifetimeRevenue);
    if (revenueToday) revenueToday.textContent = formatINR(rev.todayRevenue);
    if (revenueWeek) revenueWeek.textContent = formatINR(rev.weekRevenue);
    if (revenueMonth) revenueMonth.textContent = formatINR(rev.monthRevenue);
    if (revenueNet) revenueNet.textContent = formatINR(rev.netRevenue);
    if (revenueRefunds) revenueRefunds.textContent = `₹${rev.refundAmount || 0} refunded (0%)`;

    if (revenueTotalOrders) revenueTotalOrders.textContent = (rev.totalOrders || 0).toLocaleString();
    if (revenuePaidOrders) revenuePaidOrders.textContent = (rev.paidOrders || 0).toLocaleString();
    if (revenueFailedPayments) revenueFailedPayments.textContent = (rev.failedPayments || 0).toLocaleString();
    if (revenueSuccessRate) revenueSuccessRate.textContent = `${rev.paymentSuccessRate || 100}%`;
    if (revenueSuccessRateBadge) {
        revenueSuccessRateBadge.textContent = rev.failedPayments > 0 ? `${rev.paidOrders} of ${rev.paidOrders + rev.failedPayments} paid` : "100% success";
    }
    if (revenueAOV) revenueAOV.textContent = formatINR(rev.averageOrderValue);
    if (revenueTotalPaymentsCount) revenueTotalPaymentsCount.textContent = `${rev.totalSuccessfulPayments || 0} verified payment${rev.totalSuccessfulPayments === 1 ? "" : "s"}`;

    if (revenueChartStat) revenueChartStat.textContent = formatINR(rev.periodRevenue);
    if (revenueChartSubtitle) revenueChartSubtitle.textContent = `Verified Razorpay volume in ${periodLabel.toLowerCase()}`;

    // 4. SECTION D: CONVERSION FUNNEL
    const funnel = data.funnel || {};
    const fVisitors = Math.max(funnel.visitors || 1, 1);

    if (funnelCount1) funnelCount1.textContent = (funnel.visitors || 0).toLocaleString();
    if (funnelCount2) funnelCount2.textContent = (funnel.profileViews || 0).toLocaleString();
    if (funnelCount3) funnelCount3.textContent = (funnel.payClicks || 0).toLocaleString();
    if (funnelCount4) funnelCount4.textContent = (funnel.checkoutInitiated || 0).toLocaleString();
    if (funnelCount5) funnelCount5.textContent = (funnel.successfulPayments || 0).toLocaleString();
    if (funnelCount6) funnelCount6.textContent = (funnel.failedPayments || 0).toLocaleString();
    if (funnelCount7) funnelCount7.textContent = (funnel.messageSubmissions || 0).toLocaleString();

    // Bars
    if (funnelBar1) funnelBar1.style.width = "100%";
    if (funnelBar2) funnelBar2.style.width = `${Math.min(100, Math.max(4, Math.round(((funnel.profileViews || 0) / fVisitors) * 100)))}%`;
    if (funnelBar3) funnelBar3.style.width = `${Math.min(100, Math.max(4, Math.round(((funnel.payClicks || 0) / fVisitors) * 100)))}%`;
    if (funnelBar4) funnelBar4.style.width = `${Math.min(100, Math.max(4, Math.round(((funnel.checkoutInitiated || 0) / fVisitors) * 100)))}%`;
    if (funnelBar5) funnelBar5.style.width = `${Math.min(100, Math.max(4, Math.round(((funnel.successfulPayments || 0) / fVisitors) * 100)))}%`;
    if (funnelBar6) funnelBar6.style.width = `${Math.min(100, Math.max(0, Math.round(((funnel.failedPayments || 0) / fVisitors) * 100)))}%`;
    if (funnelBar7) funnelBar7.style.width = `${Math.min(100, Math.max(4, Math.round(((funnel.messageSubmissions || 0) / fVisitors) * 100)))}%`;

    if (funnelRate2) funnelRate2.textContent = `${funnel.profileViewRate || 0}% of visitors`;
    if (funnelRate3) funnelRate3.textContent = `${funnel.payClickRate || 0}% of profiles`;
    if (funnelRate4) funnelRate4.textContent = `${funnel.checkoutRate || 0}% of clicks`;
    if (funnelRate5) funnelRate5.textContent = `${funnel.paymentSuccessRate || 0}% of checkouts`;
    if (funnelRate6) funnelRate6.textContent = `${funnel.failedPayments || 0} drops`;
    if (funnelRate7) funnelRate7.textContent = `${funnel.messageRate || 0}% of paid users`;

    // 5. SECTION E: TABLES & QUAD CARDS
    const activity = data.activity || {};

    // Creator Performance Table
    if (creatorPerformanceTableBody) {
        const topCreators = Array.isArray(activity.topCreators) ? activity.topCreators : [];
        if (topCreators.length === 0) {
            creatorPerformanceTableBody.innerHTML = `
                <tr><td colspan="5" style="text-align: center; color: var(--ios-text-tertiary); padding: 20px;">No partner activity recorded yet.</td></tr>
            `;
        } else {
            creatorPerformanceTableBody.innerHTML = topCreators
                .map((c) => {
                    const avatar = c.profile_image && typeof c.profile_image === "string" && c.profile_image.startsWith("http")
                        ? c.profile_image
                        : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

                    return `
                        <tr>
                            <td>
                                <div class="table-creator-cell">
                                    <img src="${escapeHTML(avatar)}" alt="${escapeHTML(c.name)}" class="table-creator-avatar">
                                    <strong>${escapeHTML(c.name)}</strong>
                                </div>
                            </td>
                            <td><span class="creator-category-badge">${escapeHTML(c.category || "General")}</span></td>
                            <td>${c.views || 0}</td>
                            <td><strong>${c.paidSessions || 0}</strong></td>
                            <td style="text-align: right;"><span class="table-revenue-tag">${formatINR(c.revenue || 0)}</span></td>
                        </tr>
                    `;
                })
                .join("");
        }
    }

    // Top Pages Table
    if (topPagesTableBody) {
        const topPages = Array.isArray(activity.topPages) ? activity.topPages : [];
        if (topPages.length === 0) {
            topPagesTableBody.innerHTML = `
                <tr><td colspan="3" style="text-align: center; color: var(--ios-text-tertiary); padding: 16px;">Visitor navigations will appear here.</td></tr>
            `;
        } else {
            topPagesTableBody.innerHTML = topPages
                .map((p) => `
                    <tr>
                        <td><strong>${escapeHTML(p.name)}</strong></td>
                        <td>${p.views}</td>
                        <td>
                            <div class="percent-bar-cell">
                                <div class="percent-track">
                                    <div class="percent-fill" style="width: ${p.percentage}%;"></div>
                                </div>
                                <span style="font-size: 11px; font-weight: 600;">${p.percentage}%</span>
                            </div>
                        </td>
                    </tr>
                `)
                .join("");
        }
    }

    // Traffic Sources Table
    if (trafficSourcesTableBody) {
        const sources = Array.isArray(activity.trafficSources) ? activity.trafficSources : [];
        if (sources.length === 0) {
            trafficSourcesTableBody.innerHTML = `
                <tr><td colspan="3" style="text-align: center; color: var(--ios-text-tertiary); padding: 16px;">Referral sources will appear here.</td></tr>
            `;
        } else {
            trafficSourcesTableBody.innerHTML = sources
                .map((s) => `
                    <tr>
                        <td><strong>${escapeHTML(s.source)}</strong></td>
                        <td>${s.count}</td>
                        <td>
                            <div class="percent-bar-cell">
                                <div class="percent-track">
                                    <div class="percent-fill" style="width: ${s.percentage}%; background: #DB2777;"></div>
                                </div>
                                <span style="font-size: 11px; font-weight: 600;">${s.percentage}%</span>
                            </div>
                        </td>
                    </tr>
                `)
                .join("");
        }
    }

    // 6. SECTION F: RECENT REAL-TIME ACTIVITY FEED
    if (recentActivityFeed) {
        const recent = Array.isArray(data.recentEvents) ? data.recentEvents : [];
        if (recent.length === 0) {
            recentActivityFeed.innerHTML = `
                <div style="text-align: center; color: var(--ios-text-tertiary); padding: 32px;">
                    No recent events yet. Navigate the website or complete a connection to see live tracking.
                </div>
            `;
        } else {
            recentActivityFeed.innerHTML = recent
                .map((evt) => {
                    let iconClass = "";
                    let iconSvg = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    `;

                    if (evt.type === "payment_success") {
                        iconClass = "payment";
                        iconSvg = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        `;
                    } else if (evt.type === "payment_failed") {
                        iconClass = "failed";
                        iconSvg = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                        `;
                    } else if (evt.type === "checkout_initiated") {
                        iconSvg = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                        `;
                    } else if (evt.type === "message_sent") {
                        iconSvg = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        `;
                    } else if (evt.type === "creator_view") {
                        iconSvg = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        `;
                    }

                    return `
                        <div class="feed-item">
                            <div class="feed-item-left">
                                <div class="feed-icon-wrap ${iconClass}">
                                    ${iconSvg}
                                </div>
                                <div style="min-width: 0;">
                                    <div class="feed-item-title">${escapeHTML(evt.title)}</div>
                                    <div class="feed-item-detail">${escapeHTML(evt.details)}</div>
                                </div>
                            </div>
                            <div class="feed-item-right">
                                <span class="feed-source-pill">${escapeHTML(evt.source || "Direct")}</span>
                                <span class="feed-item-time">${escapeHTML(evt.relativeTime)}</span>
                            </div>
                        </div>
                    `;
                })
                .join("");
        }
    }

    // 7. PINK-THEMED INTERACTIVE LINE CHARTS
    const timeline = Array.isArray(data.timeline) ? data.timeline : [];

    renderInteractiveLineChart({
        container: usersChartContainer,
        data: timeline,
        valKey: "activeUsers",
        formatVal: (v) => `${v} unique visitor${v === 1 ? "" : "s"}`,
        color: "#EC4899",
        gradientId: "usersGradPink"
    });

    renderInteractiveLineChart({
        container: revenueChartContainer,
        data: timeline,
        valKey: "revenue",
        formatVal: (v) => formatINR(v),
        color: "#DB2777",
        gradientId: "revGradPink"
    });
}

// ===============================
// LUXURY PINK-THEMED SVG CHART RENDERER
// ===============================

function renderInteractiveLineChart({ container, data, valKey, formatVal, color, gradientId }) {
    if (!container) return;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<div class="chart-empty-state"><p>No activity recorded in this period.</p></div>`;
        return;
    }

    const width = 500;
    const height = 220;
    const padding = { top: 22, right: 24, bottom: 34, left: 36 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map((d) => Number(d[valKey]) || 0);
    const maxVal = Math.max(...values, 5); // avoid division by zero
    const minVal = 0;

    const points = data.map((d, index) => {
        const x = padding.left + (data.length === 1 ? chartW / 2 : (index / (data.length - 1)) * chartW);
        const y = padding.top + chartH - ((Number(d[valKey]) || 0) / maxVal) * chartH;
        return { x, y, label: d.label, val: Number(d[valKey]) || 0 };
    });

    // Build smooth cubic bezier curve
    let pathD = "";
    if (points.length === 1) {
        pathD = `M ${padding.left} ${points[0].y} L ${padding.left + chartW} ${points[0].y}`;
    } else {
        pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cx = (p0.x + p1.x) / 2;
            pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

    const gridY1 = padding.top + chartH;
    const gridY2 = padding.top + chartH * 0.5;
    const gridY3 = padding.top;

    const svgHTML = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${color}" stop-opacity="0.28" />
                    <stop offset="70%" stop-color="${color}" stop-opacity="0.08" />
                    <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
                </linearGradient>
            </defs>

            <!-- Grid Lines -->
            <line x1="${padding.left}" y1="${gridY1}" x2="${width - padding.right}" y2="${gridY1}" stroke="#FCE7F3" stroke-width="1" />
            <line x1="${padding.left}" y1="${gridY2}" x2="${width - padding.right}" y2="${gridY2}" stroke="#FCE7F3" stroke-width="1" stroke-dasharray="3,3" />
            <line x1="${padding.left}" y1="${gridY3}" x2="${width - padding.right}" y2="${gridY3}" stroke="#FCE7F3" stroke-width="1" stroke-dasharray="3,3" />

            <!-- Soft Pink Area Fill -->
            <path d="${areaD}" fill="url(#${gradientId})" />

            <!-- Main Pink Stroke Line -->
            <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />

            <!-- Interactive Data Points -->
            ${points.map((p, i) => `
                <circle
                    cx="${p.x}"
                    cy="${p.y}"
                    r="4.5"
                    fill="#FFFFFF"
                    stroke="${color}"
                    stroke-width="2.5"
                    data-point-idx="${i}"
                    style="cursor: pointer; transition: transform 0.15s ease;"
                />
            `).join("")}

            <!-- X-Axis Labels -->
            ${points.filter((_, i) => data.length <= 8 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((p) => `
                <text
                    x="${p.x}"
                    y="${height - 10}"
                    font-size="11"
                    font-weight="600"
                    fill="#9CA3AF"
                    text-anchor="middle"
                    font-family="-apple-system, BlinkMacSystemFont, sans-serif"
                >${escapeHTML(p.label)}</text>
            `).join("")}
        </svg>
    `;

    container.innerHTML = svgHTML;

    // Attach Interactive Tooltips
    const circles = container.querySelectorAll("circle");
    circles.forEach((circle) => {
        circle.addEventListener("mouseenter", () => {
            const idx = Number(circle.getAttribute("data-point-idx"));
            const pt = points[idx];
            if (!pt || !chartTooltip) return;

            circle.setAttribute("r", "6.5");
            circle.setAttribute("fill", color);

            const rect = container.getBoundingClientRect();
            const ptX = (pt.x / width) * rect.width;
            const ptY = (pt.y / height) * rect.height;

            chartTooltip.innerHTML = `<strong>${escapeHTML(pt.label)}</strong>: ${escapeHTML(formatVal(pt.val))}`;
            chartTooltip.style.left = `${rect.left + ptX}px`;
            chartTooltip.style.top = `${rect.top + ptY - 8}px`;
            chartTooltip.style.opacity = "1";
        });

        circle.addEventListener("mouseleave", () => {
            circle.setAttribute("r", "4.5");
            circle.setAttribute("fill", "#FFFFFF");
            if (chartTooltip) chartTooltip.style.opacity = "0";
        });
    });
}

// ===============================
// INITIALIZATION & REAL-TIME POLLING
// ===============================

document.addEventListener("DOMContentLoaded", () => {
    loadCreators();
    loadAnalytics(currentAnalyticsPeriod, false);

    // Auto-refresh real-time analytics every 10 seconds
    liveRefreshTimer = setInterval(() => {
        loadAnalytics(currentAnalyticsPeriod, false);
    }, 10000);
});

// Run immediate load
loadCreators();
loadAnalytics(currentAnalyticsPeriod, false);