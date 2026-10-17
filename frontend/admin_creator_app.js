/**
 * Meet You Partner — Executive Pink Admin Dashboard
 * High-performance, clean, mobile-friendly analytics & partner management.
 */

// ===============================
// STATE & CONFIG
// ===============================
const API_URL = "https://creatorpay-backend.onrender.com";
let allCreators = [];
let currentFilterText = "";
let currentPeriod = "7d";
let analyticsData = null;
let isRefreshing = false;

// ===============================
// DOM ELEMENTS
// ===============================

// Modals
const creatorModal = document.getElementById("creatorModal");
const addCreatorButton = document.getElementById("addCreatorButton");
const closeModalButton = document.getElementById("closeModalButton");
const creatorForm = document.getElementById("creatorForm");

const editCreatorModal = document.getElementById("editCreatorModal");
const closeEditModalButton = document.getElementById("closeEditModalButton");
const editCreatorForm = document.getElementById("editCreatorForm");

// Photo Elements in Edit Modal
const editExistingProfileImage = document.getElementById("editExistingProfileImage");
const editImagePreview = document.getElementById("editImagePreview");
const editProfileImage = document.getElementById("editProfileImage");
const editPhotoStatusTitle = document.getElementById("editPhotoStatusTitle");
const editPhotoBadge = document.getElementById("editPhotoBadge");
const editPhotoStatusSub = document.getElementById("editPhotoStatusSub");
const revertPhotoBtn = document.getElementById("revertPhotoBtn");

// Table & Search
const creatorListTableBody = document.getElementById("creatorListTableBody");
const creatorCount = document.getElementById("creatorCount");
const adminSearchInput = document.getElementById("adminSearchInput");
const globalSearchInput = document.getElementById("globalSearchInput");

// Topbar & Refresh
const currentDatePill = document.getElementById("currentDatePill");
const datePillText = document.getElementById("datePillText");
const manualRefreshBtn = document.getElementById("manualRefreshBtn");
const periodButtons = document.querySelectorAll(".period-btn");

// Stat Cards (Top Overview 2x2)
const statRevenue = document.getElementById("statRevenue");
const statRevenueTrend = document.getElementById("statRevenueTrend");
const statOrders = document.getElementById("statOrders");
const statOrdersTrend = document.getElementById("statOrdersTrend");
const statVisitors = document.getElementById("statVisitors");
const statVisitorsTrend = document.getElementById("statVisitorsTrend");
const statNetRevenue = document.getElementById("statNetRevenue");

// Charts
const revenueBarChartContainer = document.getElementById("revenueBarChartContainer");
const barChartSubtitle = document.getElementById("barChartSubtitle");
const donutSvgWrap = document.getElementById("donutSvgWrap");
const donutLegend = document.getElementById("donutLegend");
const chartTooltip = document.getElementById("chartTooltip");

// Middle Status Cards
const statOrdersCount = document.getElementById("statOrdersCount");
const statOrdersAwaiting = document.getElementById("statOrdersAwaiting");
const statCustomersCount = document.getElementById("statCustomersCount");
const statCustomersLive = document.getElementById("statCustomersLive");

// Status Banners
const bannerTotalCreators = document.getElementById("bannerTotalCreators");
const bannerVerifiedProfiles = document.getElementById("bannerVerifiedProfiles");
const bannerChatSessions = document.getElementById("bannerChatSessions");
const bannerDeliveredOrders = document.getElementById("bannerDeliveredOrders");

// ===============================
// UTILITIES
// ===============================

function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatINR(val) {
    return "₹" + Number(val || 0).toLocaleString("en-IN");
}

// Update Topbar Date
function updateTopbarDate() {
    if (!datePillText) return;
    try {
        const now = new Date();
        const options = { weekday: "short", month: "short", day: "numeric" };
        datePillText.textContent = now.toLocaleDateString("en-US", options);
    } catch (_) {
        datePillText.textContent = "Today";
    }
}

// ===============================
// MODAL CONTROLS & PHOTO HANDLING
// ===============================

// Add Modal
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

// Edit Modal
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

// Open Edit Modal with rock-solid image preservation
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

    // Save existing photo URL so it is NEVER lost
    const existingPhoto = creator.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
    if (editExistingProfileImage) {
        editExistingProfileImage.value = creator.profile_image || "";
    }

    // Set preview to current photo
    if (editImagePreview) {
        editImagePreview.src = existingPhoto;
    }

    // Reset file input
    if (editProfileImage) {
        editProfileImage.value = "";
    }

    // Reset status badges & texts
    if (editPhotoStatusTitle) {
        editPhotoStatusTitle.textContent = "Current Photo Preserved";
    }
    if (editPhotoBadge) {
        editPhotoBadge.textContent = "Kept Safe";
        editPhotoBadge.className = "status-badge verified";
    }
    if (editPhotoStatusSub) {
        editPhotoStatusSub.textContent = "You do not need to re-upload. Your existing photo will be kept.";
    }
    if (revertPhotoBtn) {
        revertPhotoBtn.style.display = "none";
    }

    if (editCreatorModal) {
        editCreatorModal.classList.add("active");
    }
};

// Handle selecting a new photo in the Edit Modal
if (editProfileImage) {
    editProfileImage.addEventListener("change", function () {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            const objectUrl = URL.createObjectURL(file);

            if (editImagePreview) {
                editImagePreview.src = objectUrl;
            }
            if (editPhotoStatusTitle) {
                editPhotoStatusTitle.textContent = "New Photo Selected";
            }
            if (editPhotoBadge) {
                editPhotoBadge.textContent = "Pending Upload";
                editPhotoBadge.className = "status-badge";
            }
            if (editPhotoStatusSub) {
                editPhotoStatusSub.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
            }
            if (revertPhotoBtn) {
                revertPhotoBtn.style.display = "inline-block";
            }
        }
    });
}

// Revert back to the existing photo
if (revertPhotoBtn) {
    revertPhotoBtn.addEventListener("click", function () {
        const creatorId = document.getElementById("editCreatorId").value;
        const creator = allCreators.find((c) => String(c.id) === String(creatorId));
        const originalPhoto = (creator && creator.profile_image) || (editExistingProfileImage && editExistingProfileImage.value) || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

        if (editProfileImage) editProfileImage.value = "";
        if (editImagePreview) editImagePreview.src = originalPhoto;
        if (editPhotoStatusTitle) editPhotoStatusTitle.textContent = "Current Photo Preserved";
        if (editPhotoBadge) {
            editPhotoBadge.textContent = "Kept Safe";
            editPhotoBadge.className = "status-badge verified";
        }
        if (editPhotoStatusSub) {
            editPhotoStatusSub.textContent = "You do not need to re-upload. Your existing photo will be kept.";
        }
        revertPhotoBtn.style.display = "none";
    });
}

// ===============================
// EDIT CREATOR FORM SUBMIT (PHOTO NEVER LOST)
// ===============================
if (editCreatorForm) {
    editCreatorForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitBtn = editCreatorForm.querySelector("button[type='submit']");
        const originalBtnText = submitBtn ? submitBtn.textContent : "Update Partner";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Updating Partner...";
        }

        const id = document.getElementById("editCreatorId").value;
        const name = document.getElementById("editCreatorName").value.trim();
        const category = document.getElementById("editCreatorCategory").value.trim();
        const bio = document.getElementById("editCreatorBio").value.trim();
        const price = document.getElementById("editCreatorPrice").value;
        const instagram_url = document.getElementById("editCreatorInstagram").value.trim();
        const upi_id = document.getElementById("editCreatorUpi").value.trim();

        // Safe existing image fallback
        const creator = allCreators.find((c) => String(c.id) === String(id));
        const existingImage = (editExistingProfileImage && editExistingProfileImage.value) || (creator && creator.profile_image) || "";

        try {
            let finalProfileImage = existingImage;

            // Only upload if the user deliberately chose a new file
            if (editProfileImage && editProfileImage.files.length > 0) {
                if (submitBtn) submitBtn.textContent = "Uploading new photo...";
                const imageFormData = new FormData();
                imageFormData.append("profile_image", editProfileImage.files[0]);

                let imageResponse = await fetch("/api/upload-creator-image", {
                    method: "POST",
                    body: imageFormData
                });

                if (!imageResponse.ok) {
                    imageResponse = await fetch(`${API_URL}/api/upload-creator-image`, {
                        method: "POST",
                        body: imageFormData
                    });
                }

                const imageResult = await imageResponse.json();
                if (!imageResponse.ok || !imageResult.success) {
                    throw new Error(imageResult.message || "Image upload failed");
                }

                finalProfileImage = imageResult.image_url;
            }

            if (submitBtn) submitBtn.textContent = "Saving partner...";

            const updatedCreatorData = {
                name,
                category,
                bio,
                price: Number(price),
                instagram_url,
                upi_id
            };

            // Explicitly pass profile_image to preserve it completely
            if (finalProfileImage) {
                updatedCreatorData.profile_image = finalProfileImage;
            }

            let response = await fetch(`/api/creators/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedCreatorData)
            });

            if (!response.ok) {
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

            // Immediately update local array
            const idx = allCreators.findIndex((c) => String(c.id) === String(id));
            if (idx !== -1) {
                allCreators[idx] = {
                    ...allCreators[idx],
                    ...updatedCreatorData,
                    profile_image: finalProfileImage || allCreators[idx].profile_image
                };
            }

            editCreatorModal.classList.remove("active");
            filterAndDisplayCreators();
            renderCategoryDonut(allCreators);

            // Background reload to keep in sync
            loadCreators();

        } catch (error) {
            console.error("Update creator error:", error);
            alert(error.message || "Unable to update creator.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
}

// ===============================
// ADD CREATOR FORM SUBMIT
// ===============================
if (creatorForm) {
    creatorForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitBtn = creatorForm.querySelector("button[type='submit']");
        const originalText = submitBtn ? submitBtn.textContent : "Save Partner";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";
        }

        const name = document.getElementById("creatorName").value.trim();
        const category = document.getElementById("creatorCategory").value.trim();
        const bio = document.getElementById("creatorBio").value.trim();
        const price = document.getElementById("creatorPrice").value;
        const instagram_url = document.getElementById("creatorInstagram").value.trim();
        const upi_id = document.getElementById("creatorUpi").value.trim();
        const imageInput = document.getElementById("creatorImage");

        try {
            let uploadedImageUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

            if (imageInput && imageInput.files.length > 0) {
                if (submitBtn) submitBtn.textContent = "Uploading image...";
                const imageFormData = new FormData();
                imageFormData.append("profile_image", imageInput.files[0]);

                let imgRes = await fetch("/api/upload-creator-image", {
                    method: "POST",
                    body: imageFormData
                });

                if (!imgRes.ok) {
                    imgRes = await fetch(`${API_URL}/api/upload-creator-image`, {
                        method: "POST",
                        body: imageFormData
                    });
                }

                const imgData = await imgRes.json();
                if (imgRes.ok && imgData.success && imgData.image_url) {
                    uploadedImageUrl = imgData.image_url;
                }
            }

            const payload = {
                name,
                category,
                bio,
                price: Number(price),
                instagram_url,
                upi_id,
                profile_image: uploadedImageUrl
            };

            let res = await fetch("/api/creators", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                res = await fetch(`${API_URL}/api/creators`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to add creator");
            }

            creatorForm.reset();
            creatorModal.classList.remove("active");
            loadCreators();

        } catch (err) {
            console.error("Add creator error:", err);
            alert(err.message || "Failed to add partner");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });
}

// ===============================
// DELETE CREATOR
// ===============================
window.deleteCreator = async function (id) {
    const creator = allCreators.find((c) => String(c.id) === String(id));
    const creatorName = creator ? creator.name : "this partner";

    if (!confirm(`Are you sure you want to remove "${creatorName}"?`)) {
        return;
    }

    try {
        let res = await fetch(`/api/creators/${id}`, { method: "DELETE" });
        if (!res.ok) {
            res = await fetch(`${API_URL}/api/creators/${id}`, { method: "DELETE" });
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || "Unable to delete partner");
        }

        allCreators = allCreators.filter((c) => String(c.id) !== String(id));
        filterAndDisplayCreators();
        renderCategoryDonut(allCreators);

    } catch (err) {
        console.error("Delete error:", err);
        alert(err.message || "Unable to remove partner.");
    }
};

// ===============================
// LOAD & RENDER CREATORS (RESILIENT CACHE + FALLBACK)
// ===============================

const RENDER_BACKEND_URL = "https://creatorpay-backend.onrender.com";

async function loadCreators() {
    // 1. Immediately hydrate from cache so table renders in 0ms without waiting
    try {
        const cached = localStorage.getItem("fc_cached_creators");
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allCreators = parsed;
                filterAndDisplayCreators();
                try { renderCategoryDonut(allCreators); } catch (_) {}
            }
        }
    } catch (_) {}

    // 2. Fetch fresh live data from database
    try {
        let fetched = [];
        let success = false;

        // Try same-origin /api/creators first
        try {
            const localController = new AbortController();
            const localTimeout = setTimeout(() => localController.abort(), 4000);
            const res = await fetch("/api/creators", { signal: localController.signal });
            clearTimeout(localTimeout);
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && Array.isArray(data.creators) && data.creators.length > 0) {
                    fetched = data.creators;
                    success = true;
                }
            }
        } catch (_) {}

        // Fallback to Render production backend if same-origin is slow or paused
        if (!success) {
            try {
                const remoteController = new AbortController();
                const remoteTimeout = setTimeout(() => remoteController.abort(), 5000);
                const res = await fetch(`${RENDER_BACKEND_URL}/api/creators`, { signal: remoteController.signal });
                clearTimeout(remoteTimeout);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success && Array.isArray(data.creators) && data.creators.length > 0) {
                        fetched = data.creators;
                        success = true;
                    }
                }
            } catch (_) {}
        }

        if (success && fetched.length > 0) {
            allCreators = fetched;
            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(fetched));
            } catch (_) {}
            filterAndDisplayCreators();
            try { renderCategoryDonut(allCreators); } catch (_) {}
        } else if (allCreators.length === 0) {
            if (creatorListTableBody) {
                creatorListTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--dash-text-tertiary); padding: 40px;">
                            <div style="font-size: 14px; font-weight: 700; color: var(--dash-text-primary); margin-bottom: 6px;">
                                Database Connection Paused
                            </div>
                            <div style="font-size: 12px; color: var(--dash-text-secondary); margin-bottom: 12px;">
                                Could not load partner records. Click below to reconnect.
                            </div>
                            <button type="button" class="action-icon-btn" onclick="loadCreators()" style="display: inline-block; cursor: pointer; padding: 6px 16px;">
                                ↻ Try Again
                            </button>
                        </td>
                    </tr>
                `;
            }
        }
    } catch (err) {
        console.warn("Issue loading creators:", err);
    }
}

function filterAndDisplayCreators() {
    if (!creatorListTableBody) return;

    let filtered = allCreators;
    if (currentFilterText) {
        const query = currentFilterText.toLowerCase();
        filtered = allCreators.filter((c) => {
            const nameMatch = (c.name || "").toLowerCase().includes(query);
            const catMatch = (c.category || "").toLowerCase().includes(query);
            const bioMatch = (c.bio || "").toLowerCase().includes(query);
            return nameMatch || catMatch || bioMatch;
        });
    }

    // Update count labels
    if (creatorCount) {
        creatorCount.textContent = `${filtered.length} partner${filtered.length === 1 ? "" : "s"}`;
    }
    if (bannerTotalCreators) {
        bannerTotalCreators.textContent = allCreators.length;
    }
    if (bannerVerifiedProfiles) {
        bannerVerifiedProfiles.textContent = allCreators.length;
    }
    if (statCustomersCount) {
        statCustomersCount.textContent = allCreators.length;
    }

    if (filtered.length === 0) {
        creatorListTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--dash-text-tertiary); padding: 50px 20px;">
                    <div style="font-size: 15px; font-weight: 700; color: var(--dash-text-primary); margin-bottom: 4px;">
                        ${currentFilterText ? "No matching partners found" : "No partners listed yet"}
                    </div>
                    <div style="font-size: 12.5px; color: var(--dash-text-secondary);">
                        ${currentFilterText ? "Try searching with a different term." : "Click '+ Add Partner' to list your first profile."}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    creatorListTableBody.innerHTML = filtered
        .map((creator) => {
            const avatar = (creator.profile_image && typeof creator.profile_image === "string" && creator.profile_image.startsWith("http"))
                ? creator.profile_image
                : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

            const name = creator.name || "Unnamed Partner";
            const category = creator.category || "General";
            const bio = creator.bio || "No introduction provided.";
            const price = creator.price || 49;
            const subText = creator.instagram_url ? `@${creator.instagram_url.split("/").filter(Boolean).pop() || "partner"}` : `ID: #${String(creator.id).substring(0, 8)}`;

            return `
                <tr data-id="${escapeHTML(creator.id)}">
                    <td>
                        <div class="partner-info-cell">
                            <img
                                src="${escapeHTML(avatar)}"
                                alt="${escapeHTML(name)}"
                                class="partner-avatar"
                                onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';"
                            >
                            <div>
                                <div class="partner-name">${escapeHTML(name)}</div>
                                <div class="partner-sub-text">${escapeHTML(subText)}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="category-tag-pill">${escapeHTML(category)}</span>
                    </td>
                    <td>
                        <span class="price-tag">₹${escapeHTML(price)}</span>
                    </td>
                    <td style="max-width: 280px; color: var(--dash-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(bio)}">
                        ${escapeHTML(bio)}
                    </td>
                    <td>
                        <span class="status-badge verified">● Active</span>
                    </td>
                    <td>
                        <div class="table-action-btns">
                            <a
                                href="friend_profile.html?id=${encodeURIComponent(creator.id)}"
                                class="action-icon-btn"
                                target="_blank"
                                rel="noopener"
                                title="View public profile"
                            >
                                View
                            </a>
                            <button
                                type="button"
                                class="action-icon-btn"
                                onclick="openEditModal('${escapeHTML(creator.id)}')"
                                title="Edit details & bio"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                class="action-icon-btn delete"
                                onclick="deleteCreator('${escapeHTML(creator.id)}')"
                                title="Remove partner"
                            >
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

// Search Inputs Handlers
if (adminSearchInput) {
    adminSearchInput.addEventListener("input", (e) => {
        currentFilterText = e.target.value.trim();
        filterAndDisplayCreators();
    });
}

if (globalSearchInput) {
    globalSearchInput.addEventListener("input", (e) => {
        currentFilterText = e.target.value.trim();
        if (adminSearchInput) adminSearchInput.value = currentFilterText;
        filterAndDisplayCreators();
    });
}

// ===============================
// CATEGORY DONUT CHART (CLEAN PINK THEME)
// ===============================

function renderCategoryDonut(creators) {
    if (!donutSvgWrap || !donutLegend) return;

    if (!creators || creators.length === 0) {
        donutSvgWrap.innerHTML = `
            <svg viewBox="0 0 140 140" width="100%" height="100%">
                <circle cx="70" cy="70" r="50" fill="none" stroke="#FCE7F3" stroke-width="16"/>
                <text x="70" y="74" text-anchor="middle" font-size="12" fill="#9CA3AF" font-weight="600">No data</text>
            </svg>
        `;
        donutLegend.innerHTML = `<span style="font-size: 12px; color: var(--dash-text-tertiary);">No partner categories yet.</span>`;
        return;
    }

    // Count categories
    const counts = {};
    creators.forEach((c) => {
        const cat = (c.category && c.category.trim()) || "Lifestyle";
        counts[cat] = (counts[cat] || 0) + 1;
    });

    const total = creators.length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // Top categories + Other
    const topCategories = sorted.slice(0, 4);
    if (sorted.length > 4) {
        const otherCount = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
        topCategories.push(["Other", otherCount]);
    }

    // Palette: Luxurious pinks and complementary accents
    const palette = [
        "#EC4899", // Primary Pink
        "#F472B6", // Soft Pink
        "#FB7185", // Rose Coral
        "#C084FC", // Purple Lilac
        "#FBBF24"  // Warm Gold
    ];

    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    let circlesSvg = "";
    let legendHtml = "";

    topCategories.forEach(([catName, count], idx) => {
        const color = palette[idx % palette.length];
        const pct = Math.round((count / total) * 100);
        const strokeLength = (count / total) * circumference;
        const gapLength = circumference - strokeLength;

        circlesSvg += `
            <circle
                cx="70"
                cy="70"
                r="${radius}"
                fill="none"
                stroke="${color}"
                stroke-width="16"
                stroke-dasharray="${strokeLength} ${gapLength}"
                stroke-dashoffset="${-accumulatedOffset}"
                transform="rotate(-90 70 70)"
                style="transition: stroke-dasharray 0.4s ease;"
            />
        `;

        accumulatedOffset += strokeLength;

        legendHtml += `
            <div class="legend-item">
                <div class="legend-label-group">
                    <span class="legend-dot" style="background: ${color};"></span>
                    <span class="legend-text" title="${escapeHTML(catName)}">${escapeHTML(catName)}</span>
                </div>
                <span class="legend-pct">${pct}%</span>
            </div>
        `;
    });

    donutSvgWrap.innerHTML = `
        <svg viewBox="0 0 140 140" width="100%" height="100%">
            <!-- Soft Pink Base Track -->
            <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#FDF2F7" stroke-width="16"/>
            ${circlesSvg}
            <!-- Center Hole Stats -->
            <text x="70" y="66" text-anchor="middle" font-size="19" font-weight="800" fill="#1E1B22">${total}</text>
            <text x="70" y="82" text-anchor="middle" font-size="10.5" font-weight="600" fill="#9CA3AF" text-transform="uppercase" letter-spacing="0.5">Partners</text>
        </svg>
    `;

    donutLegend.innerHTML = legendHtml;
}

// ===============================
// REVENUE & ACTIVITY BAR CHART (PINK GRADIENT)
// ===============================

function renderRevenueBarChart(timeline) {
    if (!revenueBarChartContainer) return;

    if (!timeline || timeline.length === 0) {
        revenueBarChartContainer.innerHTML = `
            <div style="display: flex; height: 100%; min-height: 200px; align-items: center; justify-content: center; color: var(--dash-text-tertiary); font-size: 13px;">
                No transaction volume recorded for this period.
            </div>
        `;
        return;
    }

    // Chart dimensions
    const width = 500;
    const height = 210;
    const padTop = 15;
    const padBottom = 28;
    const padLeft = 32;
    const padRight = 14;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Use revenue if present, else fallback to active views/activity to keep bars alive
    const values = timeline.map((t) => t.revenue || t.pageViews || t.activeUsers || 0);
    const maxVal = Math.max(...values, 50);

    const barCount = timeline.length;
    const gap = Math.max(6, Math.min(16, (chartW / barCount) * 0.25));
    const barWidth = Math.max(12, (chartW - gap * (barCount - 1)) / barCount);

    let barsSvg = "";
    let labelsSvg = "";

    // Gridlines (3 levels)
    const gridLinesSvg = [0.25, 0.5, 0.75, 1.0]
        .map((frac) => {
            const y = padTop + chartH - chartH * frac;
            const gridVal = Math.round(maxVal * frac);
            return `
                <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#FCE7F3" stroke-width="1" stroke-dasharray="3,3" />
                <text x="${padLeft - 6}" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#9CA3AF" font-weight="600">${gridVal >= 1000 ? (gridVal / 1000).toFixed(1) + "k" : gridVal}</text>
            `;
        })
        .join("");

    timeline.forEach((item, idx) => {
        const val = item.revenue !== undefined ? item.revenue : (item.pageViews || 0);
        const barH = Math.max(6, (val / maxVal) * chartH);
        const x = padLeft + idx * (barWidth + gap);
        const y = padTop + chartH - barH;

        const dateLabel = item.label || item.date || "";
        // Clean short label (e.g. "Oct 16" or day)
        const shortLabel = dateLabel.includes(" ") ? dateLabel.split(" ")[1] || dateLabel : dateLabel.slice(-2);

        barsSvg += `
            <g class="chart-bar-group" data-label="${escapeHTML(dateLabel)}" data-val="${val}" data-revenue="${item.revenue || 0}">
                <!-- Subtle hover backdrop highlight -->
                <rect x="${x - gap / 3}" y="${padTop}" width="${barWidth + (gap * 2) / 3}" height="${chartH}" rx="8" fill="transparent" class="bar-hover-zone"/>
                <!-- Actual Bar -->
                <rect
                    x="${x}"
                    y="${y}"
                    width="${barWidth}"
                    height="${barH}"
                    rx="6"
                    fill="url(#pinkBarGradient)"
                    class="chart-bar"
                    style="transform-origin: bottom; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);"
                />
            </g>
        `;

        // Only draw labels if not overly crowded
        if (barCount <= 12 || idx % 2 === 0 || idx === barCount - 1) {
            labelsSvg += `
                <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="9.5" fill="#9CA3AF" font-weight="600">
                    ${escapeHTML(shortLabel)}
                </text>
            `;
        }
    });

    revenueBarChartContainer.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="overflow: visible;">
            <defs>
                <linearGradient id="pinkBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#EC4899"/>
                    <stop offset="100%" stop-color="#DB2777"/>
                </linearGradient>
            </defs>

            <!-- Grid Lines -->
            ${gridLinesSvg}

            <!-- Bottom Base Axis -->
            <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="#F6DCE8" stroke-width="1.5" />

            <!-- Bars -->
            ${barsSvg}

            <!-- X Labels -->
            ${labelsSvg}
        </svg>
    `;

    // Tooltip interaction
    setupChartTooltips();
}

function setupChartTooltips() {
    if (!revenueBarChartContainer || !chartTooltip) return;

    const barGroups = revenueBarChartContainer.querySelectorAll(".chart-bar-group");
    barGroups.forEach((group) => {
        group.addEventListener("mouseenter", (e) => {
            const label = group.getAttribute("data-label");
            const rev = group.getAttribute("data-revenue");
            const val = group.getAttribute("data-val");

            const barRect = group.querySelector(".chart-bar");
            if (barRect) {
                barRect.style.filter = "brightness(1.15)";
                barRect.style.transform = "scaleY(1.03)";
            }

            const displayText = Number(rev) > 0 ? `₹${Number(rev).toLocaleString("en-IN")}` : `${val} activities`;
            chartTooltip.innerHTML = `<strong>${escapeHTML(label)}</strong><br>${displayText}`;
            chartTooltip.style.display = "block";
        });

        group.addEventListener("mousemove", (e) => {
            chartTooltip.style.left = `${e.pageX + 12}px`;
            chartTooltip.style.top = `${e.pageY - 34}px`;
        });

        group.addEventListener("mouseleave", () => {
            const barRect = group.querySelector(".chart-bar");
            if (barRect) {
                barRect.style.filter = "none";
                barRect.style.transform = "none";
            }
            chartTooltip.style.display = "none";
        });
    });
}

// ===============================
// COMPLETE ANALYTICS CONTROLLER
// ===============================

async function loadAnalytics(period = currentPeriod, isManual = false) {
    if (isRefreshing) return;
    isRefreshing = true;

    if (manualRefreshBtn) {
        manualRefreshBtn.style.transform = "rotate(360deg)";
        manualRefreshBtn.style.transition = "transform 0.4s ease";
    }

    try {
        let res = await fetch(`/api/analytics?period=${encodeURIComponent(period)}`);
        if (!res.ok) {
            res = await fetch(`${API_URL}/api/analytics?period=${encodeURIComponent(period)}`);
        }

        if (res && res.ok) {
            const data = await res.json();
            if (data && data.success) {
                analyticsData = data;
                updateOverviewDashboard(data, period);
            }
        }
    } catch (err) {
        console.warn("Analytics fetch error:", err);
    } finally {
        isRefreshing = false;
        if (manualRefreshBtn) {
            setTimeout(() => {
                manualRefreshBtn.style.transform = "none";
                manualRefreshBtn.style.transition = "none";
            }, 400);
        }
    }
}

function updateOverviewDashboard(data, period) {
    const rev = data.revenue || {};
    const users = data.users || {};
    const live = data.live || {};

    let periodLabel = "Last 7 Days";
    if (period === "today") periodLabel = "Today";
    else if (period === "30d") periodLabel = "This Month";
    else if (period === "lifetime") periodLabel = "Lifetime";

    // 1. Total Revenue Card
    if (statRevenue) {
        const revenueAmount = (period === "lifetime" || period === "today")
            ? (rev.periodRevenue || rev.lifetimeRevenue || 0)
            : (rev.periodRevenue || rev.lifetimeRevenue || 0);
        statRevenue.textContent = formatINR(revenueAmount);
    }
    if (statRevenueTrend) {
        statRevenueTrend.textContent = rev.totalSuccessfulPayments > 0 ? "↑ Verified" : "0 Verified";
    }

    // 2. Total Orders Card
    if (statOrders) {
        statOrders.textContent = (rev.totalOrders || 0).toLocaleString();
    }
    if (statOrdersTrend) {
        statOrdersTrend.textContent = `${rev.paidOrders || 0} Paid`;
    }

    // 3. Total Visitors Card (Real live tracked visitors)
    if (statVisitors) {
        const visitorsCount = (period === "today")
            ? (live.visitorsToday || 1)
            : (users.lifetimeUniqueVisitors || users.periodActiveUsers || 1);
        statVisitors.textContent = visitorsCount.toLocaleString();
    }
    if (statVisitorsTrend) {
        statVisitorsTrend.textContent = live.activeUsers > 0 ? `● ${live.activeUsers} Live` : "Live";
    }

    // 4. Net Revenue Card
    if (statNetRevenue) {
        const netAmt = rev.netRevenue !== undefined ? rev.netRevenue : rev.lifetimeRevenue;
        statNetRevenue.textContent = formatINR(netAmt || 0);
    }

    // 5. Middle Wavy Status Cards
    if (statOrdersCount) {
        statOrdersCount.textContent = (rev.totalOrders || 0).toLocaleString();
    }
    if (statOrdersAwaiting) {
        const successRate = rev.paymentSuccessRate !== undefined ? rev.paymentSuccessRate : 100;
        statOrdersAwaiting.textContent = `${successRate}%`;
    }

    // 6. Status Banners across list
    if (bannerChatSessions) {
        bannerChatSessions.textContent = (rev.paidOrders || rev.totalSuccessfulPayments || 1).toLocaleString();
    }
    if (bannerDeliveredOrders) {
        bannerDeliveredOrders.textContent = (rev.paidOrders || rev.totalSuccessfulPayments || 0).toLocaleString();
    }

    // 7. Subtitle for Bar Chart
    if (barChartSubtitle) {
        barChartSubtitle.textContent = `Verified transaction volume (${periodLabel})`;
    }

    // 8. Render Bar Chart
    if (data.timeline && Array.isArray(data.timeline)) {
        renderRevenueBarChart(data.timeline);
    }
}

// ===============================
// PERIOD SELECTOR BUTTONS
// ===============================
if (periodButtons) {
    periodButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            periodButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            currentPeriod = btn.getAttribute("data-period") || "7d";
            loadAnalytics(currentPeriod, true);
        });
    });
}

// Manual Refresh Button
if (manualRefreshBtn) {
    manualRefreshBtn.addEventListener("click", () => {
        loadCreators();
        loadAnalytics(currentPeriod, true);
    });
}

// Navigation buttons
const navDashboardBtn = document.getElementById("navDashboardBtn");
const navCreatorsBtn = document.getElementById("navCreatorsBtn");
if (navDashboardBtn) {
    navDashboardBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// ===============================
// INITIALIZATION
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    updateTopbarDate();
    loadCreators();
    loadAnalytics(currentPeriod);

    // Auto-refresh analytics every 30 seconds
    setInterval(() => {
        loadAnalytics(currentPeriod, false);
    }, 30000);
});