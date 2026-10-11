const API_URL = "https://creatorpay-backend.onrender.com";

// ===============================
// STATE & APPLICATION DATA
// ===============================

let allCreators = [];
let currentFilterText = "";
let currentAnalyticsPeriod = "7d";
let analyticsData = null;

// ===============================
// DOM ELEMENTS
// ===============================

const editCreatorModal = document.getElementById("editCreatorModal");
const closeEditModalButton = document.getElementById("closeEditModalButton");
const editCreatorForm = document.getElementById("editCreatorForm");

const creatorModal = document.getElementById("creatorModal");
const addCreatorButton = document.getElementById("addCreatorButton");
const closeModalButton = document.getElementById("closeModalButton");
const creatorForm = document.getElementById("creatorForm");

const creatorList = document.getElementById("creatorList");
const creatorCount = document.getElementById("creatorCount");
const adminSearchInput = document.getElementById("adminSearchInput");

// Analytics metric DOM elements
const metricActiveUsers = document.getElementById("metricActiveUsers");
const metricActiveTrend = document.getElementById("metricActiveTrend");
const metricActivePeriodLabel = document.getElementById("metricActivePeriodLabel");
const metricPeriodRevenue = document.getElementById("metricPeriodRevenue");
const metricPaymentsCount = document.getElementById("metricPaymentsCount");
const metricTotalRevenue = document.getElementById("metricTotalRevenue");
const metricTotalCount = document.getElementById("metricTotalCount");
const metricCreatorCount = document.getElementById("metricCreatorCount");

const usersChartStat = document.getElementById("usersChartStat");
const revenueChartStat = document.getElementById("revenueChartStat");
const usersChartSubtitle = document.getElementById("usersChartSubtitle");
const revenueChartSubtitle = document.getElementById("revenueChartSubtitle");

const usersChartContainer = document.getElementById("usersChartContainer");
const revenueChartContainer = document.getElementById("revenueChartContainer");
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
        loadAnalytics(period);
    });
});

// Search filter
if (adminSearchInput) {
    adminSearchInput.addEventListener("input", (e) => {
        currentFilterText = (e.target.value || "").trim().toLowerCase();
        filterAndDisplayCreators();
    });
}

// ===============================
// LOAD & DISPLAY CREATORS
// ===============================

async function loadCreators() {
    try {
        let fetchedCreators = [];
        let success = false;

        // Try local same-origin API first (fastest and resilient)
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

        // Fallback to Render backend if needed
        if (!success) {
            const response = await fetch(`${API_URL}/api/creators`);
            const result = await response.json();
            if (result.success && Array.isArray(result.creators)) {
                fetchedCreators = result.creators;
                success = true;
            } else {
                throw new Error(result.message || "Failed to load creators");
            }
        }

        allCreators = fetchedCreators;
        if (metricCreatorCount) {
            metricCreatorCount.textContent = allCreators.length;
        }

        filterAndDisplayCreators();

    } catch (error) {
        console.error("Unable to load creators:", error);
        if (creatorList) {
            creatorList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon" aria-hidden="true">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h3>Unable to load creators</h3>
                    <p>Please make sure the backend service is running.</p>
                </div>
            `;
        }
    }
}

function filterAndDisplayCreators() {
    let filtered = allCreators;
    if (currentFilterText) {
        filtered = allCreators.filter((c) => {
            const name = (c.name || "").toLowerCase();
            const cat = (c.category || "").toLowerCase();
            const bio = (c.bio || "").toLowerCase();
            return name.includes(currentFilterText) || cat.includes(currentFilterText) || bio.includes(currentFilterText);
        });
    }
    displayCreators(filtered);
}

function displayCreators(creators) {
    if (creatorCount) {
        creatorCount.textContent = `${creators.length} ${creators.length === 1 ? "creator" : "creators"}`;
    }

    if (!creatorList) return;

    if (creators.length === 0) {
        creatorList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3>${currentFilterText ? "No matching creators" : "No creators yet"}</h3>
                <p>${currentFilterText ? "Try searching for a different keyword." : "Add your first creator to get started."}</p>
            </div>
        `;
        return;
    }

    creatorList.innerHTML = creators.map((creator) => {
        const image = creator.profile_image
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

        const formattedPrice = Number(creator.price || 0).toLocaleString("en-IN");
        const categoryTag = creator.category ? `<span class="creator-category-badge">${escapeHTML(creator.category)}</span>` : "";

        return `
            <div class="creator-item">
                <div class="creator-avatar-wrap">
                    <img
                        src="${escapeHTML(image)}"
                        class="creator-image"
                        alt="${escapeHTML(creator.name)}"
                        loading="lazy"
                    >
                </div>

                <div class="creator-details">
                    <div class="creator-name-row">
                        <h3>${escapeHTML(creator.name)}</h3>
                        ${categoryTag}
                    </div>
                    <p class="creator-bio-text">${escapeHTML(creator.bio || "No biography provided")}</p>
                </div>

                <div class="creator-price-col">
                    <div class="creator-price">₹${formattedPrice}</div>
                    <div class="creator-price-label">Fee / session</div>
                </div>

                <div class="creator-actions">
                    <button
                        type="button"
                        class="creator-action"
                        onclick="editCreator('${escapeHTML(creator.id)}')"
                        aria-label="Edit ${escapeHTML(creator.name)}"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Edit</span>
                    </button>

                    <button
                        type="button"
                        class="creator-action delete-action"
                        onclick="deleteCreator('${escapeHTML(creator.id)}')"
                        aria-label="Delete ${escapeHTML(creator.name)}"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// ===============================
// EDIT CREATOR MODAL POPULATION
// ===============================

function editCreator(id) {
    const creator = allCreators.find((item) => String(item.id) === String(id));

    if (!creator) {
        alert("Creator not found");
        return;
    }

    document.getElementById("editCreatorId").value = creator.id;
    document.getElementById("editCreatorName").value = creator.name || "";
    document.getElementById("editCreatorCategory").value = creator.category || "";
    document.getElementById("editCreatorBio").value = creator.bio || "";
    document.getElementById("editCreatorPrice").value = creator.price || "";
    document.getElementById("editCreatorInstagram").value = creator.instagram_url || "";
    document.getElementById("editCreatorUpi").value = creator.upi_id || "";

    const editImageInput = document.getElementById("editProfileImage");
    if (editImageInput) {
        editImageInput.value = "";
    }

    editCreatorModal.classList.add("active");
}

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
        const imageFile = document.getElementById("creatorImage").files[0];

        try {
            let profileImageUrl = "";

            if (imageFile) {
                const imageFormData = new FormData();
                imageFormData.append("profile_image", imageFile);

                let uploadResponse;
                try {
                    uploadResponse = await fetch("/api/upload-creator-image", {
                        method: "POST",
                        body: imageFormData
                    });
                } catch (_) {}

                if (!uploadResponse || !uploadResponse.ok) {
                    uploadResponse = await fetch(`${API_URL}/api/upload-creator-image`, {
                        method: "POST",
                        body: imageFormData
                    });
                }

                const uploadResult = await uploadResponse.json();
                if (!uploadResponse.ok || !uploadResult.success) {
                    throw new Error(uploadResult.message || "Image upload failed");
                }

                profileImageUrl = uploadResult.image_url;
            }

            const payload = {
                name,
                category,
                bio,
                price,
                instagram_url,
                upi_id,
                profile_image: profileImageUrl
            };

            let response;
            try {
                response = await fetch("/api/creators", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } catch (_) {}

            if (!response || !response.ok) {
                response = await fetch(`${API_URL}/api/creators`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            }

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to add creator");
            }

            alert("Creator added successfully!");
            creatorForm.reset();
            creatorModal.classList.remove("active");
            loadCreators();

        } catch (error) {
            console.error("Add creator error:", error);
            alert(error.message || "Unable to add creator.");
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

        } catch (error) {
            console.error("Update creator error:", error);
            alert(error.message || "Unable to update creator.");
        }
    });
}

// ===============================
// DELETE CREATOR HANDLER (PRESERVED)
// ===============================

async function deleteCreator(id) {
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

    } catch (error) {
        console.error("Delete creator error:", error);
        alert("Unable to delete creator. Please try again.");
    }
}

// ===============================
// ANALYTICS: LOAD & RENDER CHARTS
// ===============================

async function loadAnalytics(period = "7d") {
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
                updateAnalyticsUI(data, period);
                return;
            }
        }

        renderEmptyAnalytics(period);

    } catch (err) {
        console.warn("Analytics fetch issue:", err);
        renderEmptyAnalytics(period);
    }
}

function updateAnalyticsUI(data, period) {
    const activeUsers = data.activeUsers || {};
    const revenue = data.revenue || {};
    const timeline = Array.isArray(data.timeline) ? data.timeline : [];

    // Period labels
    let periodText = "Last 7 Days";
    if (period === "today") periodText = "Today";
    else if (period === "30d") periodText = "Last 30 Days";

    if (metricActivePeriodLabel) {
        metricActivePeriodLabel.textContent = `in ${periodText.toLowerCase()}`;
    }

    // 1. Metric: Active Users
    if (metricActiveUsers) {
        metricActiveUsers.textContent = (activeUsers.count || 0).toLocaleString("en-US");
    }
    if (usersChartStat) {
        usersChartStat.textContent = (activeUsers.count || 0).toLocaleString("en-US");
    }
    if (usersChartSubtitle) {
        usersChartSubtitle.textContent = `Unique audience during ${periodText.toLowerCase()}`;
    }

    // Trend badge
    if (metricActiveTrend) {
        if (typeof activeUsers.comparisonPercent === "number") {
            const isPos = activeUsers.comparisonPercent >= 0;
            metricActiveTrend.className = `metric-badge-trend ${isPos ? "positive" : "neutral"}`;
            metricActiveTrend.textContent = `${isPos ? "+" : ""}${activeUsers.comparisonPercent}% vs prior`;
        } else {
            metricActiveTrend.className = "metric-badge-trend neutral";
            metricActiveTrend.textContent = activeUsers.hasHistoricalData ? "Real-time active" : "Tracking initialized";
        }
    }

    // 2. Metric: Revenue
    const periodRev = revenue.periodRevenue || 0;
    const periodCount = revenue.periodPaymentsCount || 0;

    if (metricPeriodRevenue) {
        metricPeriodRevenue.textContent = `₹${periodRev.toLocaleString("en-IN")}`;
    }
    if (revenueChartStat) {
        revenueChartStat.textContent = `₹${periodRev.toLocaleString("en-IN")}`;
    }
    if (revenueChartSubtitle) {
        revenueChartSubtitle.textContent = `Verified payments during ${periodText.toLowerCase()}`;
    }
    if (metricPaymentsCount) {
        metricPaymentsCount.textContent = `${periodCount} payment${periodCount === 1 ? "" : "s"}`;
    }

    // 3. Metric: All-Time Revenue & Total Orders
    const totalRev = revenue.totalRevenue || 0;
    const totalCount = revenue.totalPaymentsCount || 0;
    if (metricTotalRevenue) {
        metricTotalRevenue.textContent = `₹${totalRev.toLocaleString("en-IN")}`;
    }
    if (metricTotalCount) {
        metricTotalCount.textContent = `${totalCount} verified transaction${totalCount === 1 ? "" : "s"}`;
    }

    // 4. Render SVG Charts
    renderInteractiveLineChart({
        container: usersChartContainer,
        data: timeline,
        valKey: "activeUsers",
        formatVal: (v) => `${v} users`,
        color: "#2563eb",
        gradientId: "usersGrad",
        yLabel: "Users"
    });

    renderInteractiveLineChart({
        container: revenueChartContainer,
        data: timeline,
        valKey: "revenue",
        formatVal: (v) => `₹${v.toLocaleString("en-IN")}`,
        color: "#10b981",
        gradientId: "revGrad",
        yLabel: "Revenue"
    });
}

function renderEmptyAnalytics(period) {
    if (usersChartContainer) {
        usersChartContainer.innerHTML = `
            <div class="chart-empty-state">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                </svg>
                <p>No active user records logged yet</p>
                <span>Users appear here when visiting the platform</span>
            </div>
        `;
    }
    if (revenueChartContainer) {
        revenueChartContainer.innerHTML = `
            <div class="chart-empty-state">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <p>No verified payments recorded yet</p>
                <span>Completed Razorpay transactions reflect in real-time</span>
            </div>
        `;
    }
}

// ===============================
// PREMIUM APPLE-STYLE SVG CHART GENERATOR
// ===============================

function renderInteractiveLineChart({ container, data, valKey, formatVal, color, gradientId }) {
    if (!container) return;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<div class="chart-empty-state"><p>No data recorded for this period.</p></div>`;
        return;
    }

    const width = 500;
    const height = 220;
    const padding = { top: 20, right: 24, bottom: 34, left: 36 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map((d) => Number(d[valKey]) || 0);
    const maxVal = Math.max(...values, 5); // default min roof to avoid flat zero divide
    const minVal = 0;

    const points = data.map((d, index) => {
        const x = padding.left + (data.length === 1 ? chartW / 2 : (index / (data.length - 1)) * chartW);
        const y = padding.top + chartH - ((Number(d[valKey]) || 0) / maxVal) * chartH;
        return { x, y, label: d.label, val: Number(d[valKey]) || 0 };
    });

    // Build curved cubic path
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

    // Area path for gradient fill
    const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

    // Horizontal grid lines (3 levels)
    const gridY1 = padding.top + chartH;
    const gridY2 = padding.top + chartH * 0.5;
    const gridY3 = padding.top;

    const svgHTML = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${color}" stop-opacity="0.22" />
                    <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
                </linearGradient>
            </defs>

            <!-- Background subtle grid -->
            <line x1="${padding.left}" y1="${gridY1}" x2="${width - padding.right}" y2="${gridY1}" stroke="#f1f5f9" stroke-width="1" />
            <line x1="${padding.left}" y1="${gridY2}" x2="${width - padding.right}" y2="${gridY2}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3" />
            <line x1="${padding.left}" y1="${gridY3}" x2="${width - padding.right}" y2="${gridY3}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3" />

            <!-- Soft Gradient Area -->
            <path d="${areaD}" fill="url(#${gradientId})" />

            <!-- Main Trend Line -->
            <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

            <!-- Data Points -->
            ${points.map((p, i) => `
                <circle
                    cx="${p.x}"
                    cy="${p.y}"
                    r="4"
                    fill="#ffffff"
                    stroke="${color}"
                    stroke-width="2.2"
                    data-point-idx="${i}"
                    style="cursor: pointer; transition: transform 0.15s ease;"
                />
            `).join("")}

            <!-- X Axis Date Labels -->
            ${points.filter((_, i) => data.length <= 8 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((p) => `
                <text
                    x="${p.x}"
                    y="${height - 10}"
                    font-size="11"
                    font-weight="500"
                    fill="#94a3b8"
                    text-anchor="middle"
                    font-family="-apple-system, BlinkMacSystemFont, sans-serif"
                >${escapeHTML(p.label)}</text>
            `).join("")}
        </svg>
    `;

    container.innerHTML = svgHTML;

    // Attach interactive hover tooltips
    const circles = container.querySelectorAll("circle");
    circles.forEach((circle) => {
        circle.addEventListener("mouseenter", (e) => {
            const idx = Number(circle.getAttribute("data-point-idx"));
            const pt = points[idx];
            if (!pt || !chartTooltip) return;

            circle.setAttribute("r", "6");
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
            circle.setAttribute("r", "4");
            circle.setAttribute("fill", "#ffffff");
            if (chartTooltip) chartTooltip.style.opacity = "0";
        });
    });
}

// ===============================
// INITIALIZE ADMIN DASHBOARD
// ===============================

document.addEventListener("DOMContentLoaded", () => {
    loadCreators();
    loadAnalytics(currentAnalyticsPeriod);
});

// Initial load
loadCreators();
loadAnalytics(currentAnalyticsPeriod);