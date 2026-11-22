/**
 * Takora — Executive Blue Admin & Subscription Analytics Dashboard
 */

const API_URL = "https://creatorpay-backend.onrender.com";
let allCreators = [];
let allTransactions = [];
let currentFilterText = "";
let currentPeriod = "7d";
let analyticsData = null;
let isRefreshing = false;
let pendingDeleteId = null;

// Modals
const creatorModal = document.getElementById("creatorModal");
const addCreatorButton = document.getElementById("addCreatorButton");
const closeModalButton = document.getElementById("closeModalButton");
const creatorForm = document.getElementById("creatorForm");

const editCreatorModal = document.getElementById("editCreatorModal");
const closeEditModalButton = document.getElementById("closeEditModalButton");
const editCreatorForm = document.getElementById("editCreatorForm");

const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const closeDeleteConfirmBtn = document.getElementById("closeDeleteConfirmBtn");
const abortDeleteBtn = document.getElementById("abortDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const deleteConfirmBody = document.getElementById("deleteConfirmBody");

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
const datePillText = document.getElementById("datePillText");
const manualRefreshBtn = document.getElementById("manualRefreshBtn");
const periodButtons = document.querySelectorAll(".period-btn");

// Top KPIs
const statMrr = document.getElementById("statMrr");
const statActiveSubsTrend = document.getElementById("statActiveSubsTrend");
const statRevenue = document.getElementById("statRevenue");
const statRevenueTrend = document.getElementById("statRevenueTrend");
const statActiveSubs = document.getElementById("statActiveSubs");
const statSubscribersTotal = document.getElementById("statSubscribersTotal");
const statRegisteredUsers = document.getElementById("statRegisteredUsers");
const statVisitorsTrend = document.getElementById("statVisitorsTrend");

// Charts
const revenueBarChartContainer = document.getElementById("revenueBarChartContainer");
const barChartSubtitle = document.getElementById("barChartSubtitle");
const donutSvgWrap = document.getElementById("donutSvgWrap");
const donutLegend = document.getElementById("donutLegend");
const chartTooltip = document.getElementById("chartTooltip");

// Middle Status Cards & Plan Breakdown
const statPaymentSuccessRate = document.getElementById("statPaymentSuccessRate");
const statFailedSummary = document.getElementById("statFailedSummary");
const statCustomersCount = document.getElementById("statCustomersCount");

const subPlanBasicCount = document.getElementById("subPlanBasicCount");
const subPlanProCount = document.getElementById("subPlanProCount");
const subPlanPremiumCount = document.getElementById("subPlanPremiumCount");
const subCancelledCount = document.getElementById("subCancelledCount");
const subFailedCount = document.getElementById("subFailedCount");
const subTransactionsTableBody = document.getElementById("subTransactionsTableBody");

// Status Banners
const bannerTotalCreators = document.getElementById("bannerTotalCreators");
const bannerVerifiedProfiles = document.getElementById("bannerVerifiedProfiles");
const bannerActiveMembers = document.getElementById("bannerActiveMembers");
const bannerSettledPayments = document.getElementById("bannerSettledPayments");

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

function formatDateTime(iso) {
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

function showToast(message, isError = false) {
    let toast = document.getElementById("adminActionToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "adminActionToast";
        toast.style.cssText = "position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; z-index: 9999; box-shadow: 0 10px 25px rgba(15,23,42,0.18); transition: opacity 0.25s ease, transform 0.25s ease; display: flex; align-items: center; gap: 8px;";
        document.body.appendChild(toast);
    }
    toast.style.background = isError ? "#DC2626" : "#16A34A";
    toast.style.color = "#FFFFFF";
    toast.textContent = (isError ? "! " : "✓ ") + message;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
    }, 3400);
}

function updateTopbarDate() {
    if (!datePillText) return;
    try {
        datePillText.textContent = new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric"
        });
    } catch (_) {
        datePillText.textContent = "Today";
    }
}

// ===============================
// MODAL CONTROLS & PHOTO HANDLING
// ===============================

if (addCreatorButton && creatorModal) {
    addCreatorButton.addEventListener("click", () => creatorModal.classList.add("active"));
}
if (closeModalButton && creatorModal) {
    closeModalButton.addEventListener("click", () => creatorModal.classList.remove("active"));
}
if (creatorModal) {
    creatorModal.addEventListener("click", (event) => {
        if (event.target === creatorModal) creatorModal.classList.remove("active");
    });
}

if (closeEditModalButton && editCreatorModal) {
    closeEditModalButton.addEventListener("click", () => editCreatorModal.classList.remove("active"));
}
if (editCreatorModal) {
    editCreatorModal.addEventListener("click", (event) => {
        if (event.target === editCreatorModal) editCreatorModal.classList.remove("active");
    });
}

window.openEditModal = function (id) {
    const creator = allCreators.find((c) => String(c.id) === String(id));
    if (!creator) return;

    document.getElementById("editCreatorId").value = creator.id;
    document.getElementById("editCreatorName").value = creator.name || "";
    document.getElementById("editCreatorCategory").value = creator.category || "";
    document.getElementById("editCreatorBio").value = creator.bio || "";
    document.getElementById("editCreatorPrice").value = creator.price || 49;

    const editAgeEl = document.getElementById("editCreatorAge");
    if (editAgeEl) editAgeEl.value = creator.creator_age || creator.age || "";
    const editLocEl = document.getElementById("editCreatorLocation");
    if (editLocEl) editLocEl.value = creator.creator_location || creator.location || "";
    const editTagsEl = document.getElementById("editCreatorTags");
    if (editTagsEl) {
        editTagsEl.value = Array.isArray(creator.tags)
            ? creator.tags.join(", ")
            : (creator.tags || "");
    }

    const existingPhoto = creator.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
    if (editExistingProfileImage) editExistingProfileImage.value = creator.profile_image || "";
    if (editImagePreview) editImagePreview.src = existingPhoto;
    if (editProfileImage) editProfileImage.value = "";

    if (editPhotoStatusTitle) editPhotoStatusTitle.textContent = "Current Photo Preserved";
    if (editPhotoBadge) {
        editPhotoBadge.textContent = "Kept Safe";
        editPhotoBadge.className = "status-badge verified";
    }
    if (editPhotoStatusSub) editPhotoStatusSub.textContent = "You do not need to re-upload. Your existing photo will be kept.";
    if (revertPhotoBtn) revertPhotoBtn.style.display = "none";

    if (editCreatorModal) editCreatorModal.classList.add("active");
};

if (editProfileImage) {
    editProfileImage.addEventListener("change", function () {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            if (editImagePreview) editImagePreview.src = URL.createObjectURL(file);
            if (editPhotoStatusTitle) editPhotoStatusTitle.textContent = "New Photo Selected";
            if (editPhotoBadge) {
                editPhotoBadge.textContent = "Pending Upload";
                editPhotoBadge.className = "status-badge";
            }
            if (editPhotoStatusSub) editPhotoStatusSub.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
            if (revertPhotoBtn) revertPhotoBtn.style.display = "inline-block";
        }
    });
}

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
        if (editPhotoStatusSub) editPhotoStatusSub.textContent = "You do not need to re-upload. Your existing photo will be kept.";
        revertPhotoBtn.style.display = "none";
    });
}

// ===============================
// EDIT CREATOR SUBMIT
// ===============================
if (editCreatorForm) {
    editCreatorForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitBtn = editCreatorForm.querySelector("button[type='submit']");
        const originalBtnText = submitBtn ? submitBtn.textContent : "Update Creator";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Updating Creator...";
        }

        const id = document.getElementById("editCreatorId").value;
        const name = document.getElementById("editCreatorName").value.trim();
        const category = document.getElementById("editCreatorCategory").value.trim();
        const bio = document.getElementById("editCreatorBio").value.trim();
        const priceEl = document.getElementById("editCreatorPrice");
        const price = Number(priceEl && priceEl.value ? priceEl.value : 49) || 49;
        const ageEl = document.getElementById("editCreatorAge");
        const locEl = document.getElementById("editCreatorLocation");
        const tagsEl = document.getElementById("editCreatorTags");
        const creator_age = ageEl ? ageEl.value.trim() : "";
        const creator_location = locEl ? locEl.value.trim() : "";
        const tags_raw = tagsEl ? tagsEl.value.trim() : "";
        const tagsList = tags_raw ? tags_raw.split(",").map((t) => t.trim()).filter(Boolean) : [];

        const creator = allCreators.find((c) => String(c.id) === String(id));
        const existingImage = (editExistingProfileImage && editExistingProfileImage.value) || (creator && creator.profile_image) || "";

        try {
            let finalProfileImage = existingImage;

            if (editProfileImage && editProfileImage.files.length > 0) {
                if (submitBtn) submitBtn.textContent = "Uploading new photo...";
                const imageFormData = new FormData();
                imageFormData.append("profile_image", editProfileImage.files[0]);

                let imgUploaded = false;
                try {
                    const imageResponse = await fetch("/api/upload-creator-image", {
                        method: "POST",
                        body: imageFormData
                    });
                    if (imageResponse.ok) {
                        const imageResult = await imageResponse.json();
                        if (imageResult && imageResult.success && imageResult.image_url) {
                            finalProfileImage = imageResult.image_url;
                            imgUploaded = true;
                        }
                    }
                } catch (_) {}

                if (!imgUploaded) {
                    const remoteImgRes = await fetch(`${API_URL}/api/upload-creator-image`, {
                        method: "POST",
                        body: imageFormData
                    });
                    const remoteResult = await remoteImgRes.json();
                    if (!remoteImgRes.ok || !remoteResult.success) {
                        throw new Error(remoteResult.message || "Image upload failed");
                    }
                    finalProfileImage = remoteResult.image_url;
                }
            }

            if (submitBtn) submitBtn.textContent = "Saving creator...";

            const updatedCreatorData = {
                id,
                name,
                category,
                bio,
                price,
                creator_age,
                creator_location,
                tags: tagsList
            };

            if (finalProfileImage) {
                updatedCreatorData.profile_image = finalProfileImage;
            }

            let result = null;
            try {
                const response = await fetch(`/api/creators/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedCreatorData)
                });
                if (response.ok) {
                    result = await response.json();
                } else {
                    const errData = await response.json().catch(() => ({}));
                    if (response.status === 400 || response.status === 404) {
                        throw new Error(errData.message || `Server returned ${response.status}`);
                    }
                }
            } catch (localErr) {
                console.warn("[Admin Edit] Relative update warning:", localErr.message);
            }

            if (!result || !result.success) {
                const remoteResponse = await fetch(`${API_URL}/api/creators/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedCreatorData)
                });
                const remoteData = await remoteResponse.json();
                if (!remoteResponse.ok || !remoteData.success) {
                    throw new Error(remoteData.message || `Update failed (${remoteResponse.status})`);
                }
                result = remoteData;
            }

            const idx = allCreators.findIndex((c) => String(c.id) === String(id));
            if (idx !== -1) {
                allCreators[idx] = {
                    ...allCreators[idx],
                    ...updatedCreatorData,
                    ...(result.creator || {}),
                    profile_image: finalProfileImage || allCreators[idx].profile_image
                };
            }

            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(allCreators));
            } catch (_) {}

            editCreatorModal.classList.remove("active");
            filterAndDisplayCreators();
            renderCategoryDonut(allCreators);
            showToast(`Creator "${name}" updated successfully.`);
            loadCreators();
        } catch (error) {
            console.error("[Admin Edit] Update creator error:", error);
            showToast(error.message || "Unable to update creator.", true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
}

// ===============================
// ADD CREATOR SUBMIT
// ===============================
if (creatorForm) {
    creatorForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitBtn = creatorForm.querySelector("button[type='submit']");
        const originalText = submitBtn ? submitBtn.textContent : "Save Creator";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";
        }

        const name = document.getElementById("creatorName").value.trim();
        const category = document.getElementById("creatorCategory").value.trim();
        const bio = document.getElementById("creatorBio").value.trim();
        const ageEl = document.getElementById("creatorAge");
        const locEl = document.getElementById("creatorLocation");
        const tagsEl = document.getElementById("creatorTags");
        const creator_age = ageEl ? ageEl.value.trim() : "";
        const creator_location = locEl ? locEl.value.trim() : "";
        const tags_raw = tagsEl ? tagsEl.value.trim() : "";
        const tagsList = tags_raw ? tags_raw.split(",").map((t) => t.trim()).filter(Boolean) : [];
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
                price: 49,
                creator_age,
                creator_location,
                tags: tagsList,
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

            if (data.creator) {
                allCreators.unshift(data.creator);
                try {
                    localStorage.setItem("fc_cached_creators", JSON.stringify(allCreators));
                } catch (_) {}
                filterAndDisplayCreators();
                renderCategoryDonut(allCreators);
            }

            creatorForm.reset();
            creatorModal.classList.remove("active");
            showToast(`Creator "${name}" added successfully.`);
            loadCreators();
        } catch (err) {
            console.error("Add creator error:", err);
            showToast(err.message || "Failed to add creator.", true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });
}

// ===============================
// INLINE DELETE CREATOR CONFIRMATION
// ===============================
function closeDeleteModal() {
    pendingDeleteId = null;
    if (deleteConfirmModal) deleteConfirmModal.classList.remove("active");
}

if (closeDeleteConfirmBtn) closeDeleteConfirmBtn.onclick = closeDeleteModal;
if (abortDeleteBtn) abortDeleteBtn.onclick = closeDeleteModal;
if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener("click", (e) => {
        if (e.target === deleteConfirmModal) closeDeleteModal();
    });
}

window.deleteCreator = function (id) {
    const creator = allCreators.find((c) => String(c.id) === String(id));
    const creatorName = creator ? creator.name : "this creator";
    pendingDeleteId = id;
    if (deleteConfirmBody) {
        deleteConfirmBody.textContent = `Remove "${creatorName}" from the Takora creator directory?`;
    }
    if (deleteConfirmModal) {
        deleteConfirmModal.classList.add("active");
    }
};

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
        if (!pendingDeleteId) return;
        const targetId = pendingDeleteId;
        const creator = allCreators.find((c) => String(c.id) === String(targetId));
        const creatorName = creator ? creator.name : "Creator";
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = "Removing...";

        try {
            let res = await fetch(`/api/creators/${targetId}`, { method: "DELETE" });
            if (!res.ok) {
                res = await fetch(`${API_URL}/api/creators/${targetId}`, { method: "DELETE" });
            }

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Unable to remove creator");
            }

            allCreators = allCreators.filter((c) => String(c.id) !== String(targetId));
            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(allCreators));
            } catch (_) {}
            filterAndDisplayCreators();
            renderCategoryDonut(allCreators);
            closeDeleteModal();
            showToast(`Creator "${creatorName}" removed.`);
        } catch (err) {
            console.error("Delete error:", err);
            showToast(err.message || "Unable to remove creator.", true);
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = "Remove";
        }
    });
}

// ===============================
// LOAD & RENDER CREATORS
// ===============================

async function loadCreators() {
    try {
        const cached = localStorage.getItem("fc_cached_creators");
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allCreators = parsed;
                filterAndDisplayCreators();
                renderCategoryDonut(allCreators);
            }
        }
    } catch (_) {}

    try {
        let fetched = [];
        let success = false;

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

        if (!success) {
            try {
                const remoteController = new AbortController();
                const remoteTimeout = setTimeout(() => remoteController.abort(), 5000);
                const res = await fetch(`${API_URL}/api/creators`, { signal: remoteController.signal });
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
            renderCategoryDonut(allCreators);
        } else if (allCreators.length === 0 && creatorListTableBody) {
            creatorListTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--dash-text-tertiary); padding: 40px;">
                        <div style="font-size: 14px; font-weight: 700; color: var(--dash-text-primary); margin-bottom: 6px;">
                            No creator records loaded
                        </div>
                        <button type="button" class="action-icon-btn" onclick="loadCreators()">Retry</button>
                    </td>
                </tr>
            `;
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

    if (creatorCount) creatorCount.textContent = `${filtered.length} creator${filtered.length === 1 ? "" : "s"}`;
    if (bannerTotalCreators) bannerTotalCreators.textContent = allCreators.length;
    if (bannerVerifiedProfiles) bannerVerifiedProfiles.textContent = allCreators.length;
    if (statCustomersCount) statCustomersCount.textContent = allCreators.length;

    if (filtered.length === 0) {
        creatorListTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--dash-text-tertiary); padding: 44px 20px;">
                    <div style="font-size: 15px; font-weight: 700; color: var(--dash-text-primary); margin-bottom: 4px;">
                        ${currentFilterText ? "No matching creators found" : "No creators listed yet"}
                    </div>
                    <div style="font-size: 12.5px; color: var(--dash-text-secondary);">
                        ${currentFilterText ? "Try searching with a different term." : "Click '+ Add Creator' to list your first profile."}
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

            const name = creator.name || "Unnamed Creator";
            const category = creator.category || "General";
            const bio = creator.bio || "No introduction provided.";
            const ageVal = creator.creator_age || creator.age;
            const locVal = creator.creator_location || creator.location;
            const metaParts = [];
            if (ageVal) metaParts.push(`${ageVal} yrs`);
            if (locVal) metaParts.push(locVal);
            const subText = metaParts.length > 0 ? metaParts.join(" · ") : `ID: #${String(creator.id).substring(0, 8)}`;

            const tagsList = Array.isArray(creator.tags)
                ? creator.tags
                : (typeof creator.tags === "string" ? creator.tags.split(",") : []);

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
                        ${tagsList.length > 0 ? `
                            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px;">
                                ${tagsList.slice(0, 3).map((t) => `<span style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #DBEAFE; border-radius: 6px; font-size: 10.5px; padding: 1px 6px; font-weight: 600;">${escapeHTML(String(t).trim())}</span>`).join("")}
                            </div>
                        ` : ""}
                    </td>
                    <td style="max-width: 280px; color: var(--dash-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(bio)}">
                        ${escapeHTML(bio)}
                    </td>
                    <td>
                        <span class="status-badge verified">● Active</span>
                    </td>
                    <td>
                        <div class="table-action-btns">
                            <button type="button" class="action-icon-btn" onclick="openEditModal('${escapeHTML(creator.id)}')" title="Edit Profile">
                                Edit
                            </button>
                            <button type="button" class="action-icon-btn blue" onclick="openDatesModal('${escapeHTML(creator.id)}')" title="Manage Available Dates">
                                Dates (${Array.isArray(creator.available_dates) ? creator.available_dates.length : 0})
                            </button>
                            <a href="friend_profile.html?id=${encodeURIComponent(creator.id)}" class="action-icon-btn" target="_blank" rel="noopener" title="View public profile">
                                View
                            </a>
                            <button type="button" class="action-icon-btn delete" onclick="deleteCreator('${escapeHTML(creator.id)}')" title="Remove creator">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

// ===============================
// MANAGE AVAILABLE DATES (BLUE CALENDAR MODAL)
// ===============================

let datesActiveCreatorId = null;
let currentCalendarDate = new Date();
let activeAvailableDatesSet = new Set();

const datesModal = document.getElementById("datesModal");
const closeDatesModalButton = document.getElementById("closeDatesModalButton");
const cancelDatesBtn = document.getElementById("cancelDatesBtn");
const saveDatesBtn = document.getElementById("saveDatesBtn");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const quickNext7Btn = document.getElementById("quickNext7Btn");
const quickClearBtn = document.getElementById("quickClearBtn");

window.openDatesModal = function (id) {
    const creator = allCreators.find((c) => String(c.id) === String(id));
    if (!creator) return;
    datesActiveCreatorId = id;

    const avatarEl = document.getElementById("datesCreatorAvatar");
    if (avatarEl) {
        avatarEl.src = (creator.profile_image && creator.profile_image.startsWith("http"))
            ? creator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
    }
    const nameEl = document.getElementById("datesCreatorName");
    if (nameEl) nameEl.textContent = creator.name || "Creator";

    activeAvailableDatesSet = new Set(Array.isArray(creator.available_dates) ? creator.available_dates : []);
    currentCalendarDate = new Date();
    renderAdminCalendar();

    if (datesModal) datesModal.classList.add("active");
};

function renderAdminCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const titleEl = document.getElementById("calendarMonthTitle");
    if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

    const daysGrid = document.getElementById("calendarDaysGrid");
    if (!daysGrid) return;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let html = "";
    for (let i = 0; i < firstDayIndex; i++) {
        html += `<div style="height: 38px;"></div>`;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    for (let day = 1; day <= lastDate; day++) {
        const mm = String(month + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const dateKey = `${year}-${mm}-${dd}`;
        const isSelected = activeAvailableDatesSet.has(dateKey);
        const isPast = dateKey < todayStr;

        const bg = isSelected ? "#2563EB" : (isPast ? "#F8FAFC" : "#FFFFFF");
        const color = isSelected ? "#FFFFFF" : (isPast ? "#94A3B8" : "#0F172A");
        const border = isSelected ? "1px solid #1D4ED8" : (isPast ? "1px solid #F1F5F9" : "1px solid #DBEAFE");
        const fontWeight = isSelected ? "700" : "500";

        html += `
            <button
                type="button"
                data-date="${dateKey}"
                onclick="toggleAdminDate('${dateKey}')"
                style="height: 38px; border-radius: 8px; border: ${border}; background: ${bg}; color: ${color}; font-weight: ${fontWeight}; font-size: 12.5px; cursor: pointer; transition: all 0.15s ease; display: flex; flex-direction: column; align-items: center; justify-content: center;"
            >
                <span>${day}</span>
                ${isSelected ? '<span style="width: 4px; height: 4px; border-radius: 50%; background: #FFFFFF; margin-top: 2px;"></span>' : ""}
            </button>
        `;
    }

    daysGrid.innerHTML = html;

    const count = activeAvailableDatesSet.size;
    const summaryText = document.getElementById("selectedDatesSummaryText");
    if (summaryText) summaryText.textContent = `${count} date${count === 1 ? "" : "s"} selected`;
    const metaEl = document.getElementById("datesCreatorMeta");
    if (metaEl) metaEl.textContent = `${count} date${count === 1 ? "" : "s"} enabled in database`;
}

window.toggleAdminDate = function (dateKey) {
    if (activeAvailableDatesSet.has(dateKey)) {
        activeAvailableDatesSet.delete(dateKey);
    } else {
        activeAvailableDatesSet.add(dateKey);
    }
    renderAdminCalendar();
};

if (prevMonthBtn) {
    prevMonthBtn.onclick = () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderAdminCalendar();
    };
}
if (nextMonthBtn) {
    nextMonthBtn.onclick = () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderAdminCalendar();
    };
}
if (quickNext7Btn) {
    quickNext7Btn.onclick = () => {
        const today = new Date();
        for (let i = 1; i <= 7; i++) {
            const d = new Date();
            d.setDate(today.getDate() + i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            activeAvailableDatesSet.add(`${yyyy}-${mm}-${dd}`);
        }
        renderAdminCalendar();
    };
}
if (quickClearBtn) {
    quickClearBtn.onclick = () => {
        activeAvailableDatesSet.clear();
        renderAdminCalendar();
    };
}
if (closeDatesModalButton && datesModal) closeDatesModalButton.onclick = () => datesModal.classList.remove("active");
if (cancelDatesBtn && datesModal) cancelDatesBtn.onclick = () => datesModal.classList.remove("active");
if (datesModal) {
    datesModal.onclick = (e) => {
        if (e.target === datesModal) datesModal.classList.remove("active");
    };
}
if (saveDatesBtn) {
    saveDatesBtn.onclick = async () => {
        if (!datesActiveCreatorId) return;
        const originalText = saveDatesBtn.textContent;
        saveDatesBtn.disabled = true;
        saveDatesBtn.textContent = "Saving dates...";

        const datesArray = Array.from(activeAvailableDatesSet).sort();
        try {
            const res = await fetch(`/api/creators/${datesActiveCreatorId}/dates`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ available_dates: datesArray })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to update dates");
            }

            const creator = allCreators.find((c) => String(c.id) === String(datesActiveCreatorId));
            if (creator) creator.available_dates = datesArray;
            try {
                localStorage.setItem("fc_cached_creators", JSON.stringify(allCreators));
            } catch (_) {}

            datesModal.classList.remove("active");
            filterAndDisplayCreators();
            showToast(`Available dates saved (${datesArray.length} dates).`);
        } catch (err) {
            console.error("Save dates error:", err);
            showToast("Error saving dates: " + err.message, true);
        } finally {
            saveDatesBtn.disabled = false;
            saveDatesBtn.textContent = originalText;
        }
    };
}

// ===============================
// SEARCH FILTERING (CREATORS + TRANSACTIONS)
// ===============================
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
        renderSubscriptionTransactions(allTransactions);
    });
}

// ===============================
// CATEGORY DONUT CHART (BLUE THEME)
// ===============================

function renderCategoryDonut(creators) {
    if (!donutSvgWrap || !donutLegend) return;

    if (!creators || creators.length === 0) {
        donutSvgWrap.innerHTML = `
            <svg viewBox="0 0 140 140" width="100%" height="100%">
                <circle cx="70" cy="70" r="50" fill="none" stroke="#E2E8F0" stroke-width="16"/>
                <text x="70" y="74" text-anchor="middle" font-size="12" fill="#94A3B8" font-weight="600">No data</text>
            </svg>
        `;
        donutLegend.innerHTML = `<span style="font-size: 12px; color: var(--dash-text-tertiary);">No creator categories yet.</span>`;
        return;
    }

    const counts = {};
    creators.forEach((c) => {
        const cat = (c.category && c.category.trim()) || "Lifestyle";
        counts[cat] = (counts[cat] || 0) + 1;
    });

    const total = creators.length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topCategories = sorted.slice(0, 4);
    if (sorted.length > 4) {
        const otherCount = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
        topCategories.push(["Other", otherCount]);
    }

    const palette = ["#2563EB", "#1D4ED8", "#3B82F6", "#0284C7", "#60A5FA"];
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
            <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#EFF6FF" stroke-width="16"/>
            ${circlesSvg}
            <text x="70" y="66" text-anchor="middle" font-size="19" font-weight="800" fill="#0F172A">${total}</text>
            <text x="70" y="82" text-anchor="middle" font-size="10.5" font-weight="600" fill="#64748B">Creators</text>
        </svg>
    `;

    donutLegend.innerHTML = legendHtml;
}

// ===============================
// REVENUE BAR CHART (BLUE GRADIENT)
// ===============================

function renderRevenueBarChart(timeline) {
    if (!revenueBarChartContainer) return;

    if (!timeline || timeline.length === 0) {
        revenueBarChartContainer.innerHTML = `
            <div style="display: flex; height: 100%; min-height: 200px; align-items: center; justify-content: center; color: var(--dash-text-tertiary); font-size: 13px;">
                No subscription transaction volume recorded for this period.
            </div>
        `;
        return;
    }

    const width = 500;
    const height = 210;
    const padTop = 15;
    const padBottom = 28;
    const padLeft = 36;
    const padRight = 14;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const values = timeline.map((t) => t.revenue || t.pageViews || t.activeUsers || 0);
    const maxVal = Math.max(...values, 50);

    const barCount = timeline.length;
    const gap = Math.max(6, Math.min(16, (chartW / barCount) * 0.25));
    const barWidth = Math.max(12, (chartW - gap * (barCount - 1)) / barCount);

    let barsSvg = "";
    let labelsSvg = "";

    const gridLinesSvg = [0.25, 0.5, 0.75, 1.0]
        .map((frac) => {
            const y = padTop + chartH - chartH * frac;
            const gridVal = Math.round(maxVal * frac);
            return `
                <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3" />
                <text x="${padLeft - 6}" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#94A3B8" font-weight="600">${gridVal >= 1000 ? (gridVal / 1000).toFixed(1) + "k" : gridVal}</text>
            `;
        })
        .join("");

    timeline.forEach((item, idx) => {
        const val = item.revenue !== undefined ? item.revenue : (item.pageViews || 0);
        const barH = Math.max(6, (val / maxVal) * chartH);
        const x = padLeft + idx * (barWidth + gap);
        const y = padTop + chartH - barH;

        const dateLabel = item.label || item.date || "";
        const shortLabel = dateLabel.includes(" ") ? dateLabel.split(" ")[1] || dateLabel : dateLabel.slice(-2);

        barsSvg += `
            <g class="chart-bar-group" data-label="${escapeHTML(dateLabel)}" data-val="${val}" data-revenue="${item.revenue || 0}">
                <rect x="${x - gap / 3}" y="${padTop}" width="${barWidth + (gap * 2) / 3}" height="${chartH}" rx="8" fill="transparent" class="bar-hover-zone"/>
                <rect
                    x="${x}"
                    y="${y}"
                    width="${barWidth}"
                    height="${barH}"
                    rx="6"
                    fill="url(#blueBarGradient)"
                    class="chart-bar"
                    style="transform-origin: bottom; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);"
                />
            </g>
        `;

        if (barCount <= 12 || idx % 2 === 0 || idx === barCount - 1) {
            labelsSvg += `
                <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="9.5" fill="#94A3B8" font-weight="600">
                    ${escapeHTML(shortLabel)}
                </text>
            `;
        }
    });

    revenueBarChartContainer.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="overflow: visible;">
            <defs>
                <linearGradient id="blueBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3B82F6"/>
                    <stop offset="100%" stop-color="#1D4ED8"/>
                </linearGradient>
            </defs>
            ${gridLinesSvg}
            <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="#CBD5E1" stroke-width="1.5" />
            ${barsSvg}
            ${labelsSvg}
        </svg>
    `;

    setupChartTooltips();
}

function setupChartTooltips() {
    if (!revenueBarChartContainer || !chartTooltip) return;
    revenueBarChartContainer.querySelectorAll(".chart-bar-group").forEach((group) => {
        group.addEventListener("mouseenter", () => {
            const label = group.getAttribute("data-label");
            const rev = group.getAttribute("data-revenue");
            const val = group.getAttribute("data-val");
            const barRect = group.querySelector(".chart-bar");
            if (barRect) barRect.style.filter = "brightness(1.15)";
            const displayText = Number(rev) > 0 ? `₹${Number(rev).toLocaleString("en-IN")}` : `${val} activity`;
            chartTooltip.innerHTML = `<strong>${escapeHTML(label)}</strong><br>${displayText}`;
            chartTooltip.style.display = "block";
        });
        group.addEventListener("mousemove", (e) => {
            chartTooltip.style.left = `${e.pageX + 12}px`;
            chartTooltip.style.top = `${e.pageY - 34}px`;
        });
        group.addEventListener("mouseleave", () => {
            const barRect = group.querySelector(".chart-bar");
            if (barRect) barRect.style.filter = "none";
            chartTooltip.style.display = "none";
        });
    });
}

// ===============================
// SUBSCRIPTION TRANSACTIONS TABLE
// ===============================

function renderSubscriptionTransactions(transactions) {
    if (!subTransactionsTableBody) return;
    let list = Array.isArray(transactions) ? transactions : [];
    if (currentFilterText) {
        const q = currentFilterText.toLowerCase();
        list = list.filter((tx) => {
            const email = String(tx.user_email || "").toLowerCase();
            const plan = String(tx.plan_code || "").toLowerCase();
            const payId = String(tx.razorpay_payment_id || "").toLowerCase();
            return email.includes(q) || plan.includes(q) || payId.includes(q);
        });
    }

    if (list.length === 0) {
        subTransactionsTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--dash-text-secondary); padding: 28px;">
                    ${currentFilterText ? "No matching subscription transactions found." : "No subscription transactions recorded yet."}
                </td>
            </tr>
        `;
        return;
    }

    subTransactionsTableBody.innerHTML = list
        .map((tx) => {
            const statusLower = String(tx.status || "pending").toLowerCase();
            const pillClass = statusLower === "captured" || statusLower === "verified" || statusLower === "authorized"
                ? "ok"
                : (statusLower === "failed" ? "failed" : "pending");
            const planLabel = String(tx.plan_code || "basic").toUpperCase();
            return `
                <tr>
                    <td><strong>${escapeHTML(tx.user_email || "Member")}</strong></td>
                    <td><span class="category-tag-pill">${escapeHTML(planLabel)}</span></td>
                    <td><strong>${formatINR(tx.amount_inr || 0)}</strong></td>
                    <td>${escapeHTML(tx.method || "autopay")}</td>
                    <td><span class="tx-status-pill ${pillClass}">${escapeHTML(tx.status || "pending")}</span></td>
                    <td style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; color: var(--dash-text-secondary);">${escapeHTML(tx.razorpay_payment_id || "—")}</td>
                    <td style="text-align: right; color: var(--dash-text-secondary);">${formatDateTime(tx.paid_at)}</td>
                </tr>
            `;
        })
        .join("");
}

// ===============================
// ANALYTICS CONTROLLER
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
                if (isManual) showToast("Live metrics refreshed.");
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
    const sub = data.subscriptions || {};
    const rev = data.revenue || {};
    const users = data.users || {};

    let periodLabel = "Last 7 Days";
    if (period === "today") periodLabel = "Today";
    else if (period === "30d") periodLabel = "This Month";
    else if (period === "lifetime") periodLabel = "Lifetime";

    // Top 2x2 KPIs
    if (statMrr) statMrr.textContent = formatINR(sub.mrr || 0);
    if (statActiveSubsTrend) statActiveSubsTrend.textContent = `${sub.activeSubscriptions || 0} active`;

    const periodRevAmt = period === "lifetime"
        ? (sub.totalSubscriptionRevenue ?? rev.lifetimeRevenue ?? 0)
        : period === "today"
            ? (sub.todaySubscriptionRevenue ?? rev.todayRevenue ?? 0)
            : (sub.periodSubscriptionRevenue ?? rev.periodRevenue ?? 0);

    if (statRevenue) statRevenue.textContent = formatINR(periodRevAmt);
    if (statRevenueTrend) statRevenueTrend.textContent = `${sub.successfulSubscriptionPayments || 0} verified`;

    if (statActiveSubs) statActiveSubs.textContent = Number(sub.activeSubscriptions || 0).toLocaleString();
    if (statSubscribersTotal) statSubscribersTotal.textContent = `${sub.totalSubscribers || 0} total`;

    if (statRegisteredUsers) statRegisteredUsers.textContent = Number(users.registeredUsers || 0).toLocaleString();
    if (statVisitorsTrend) statVisitorsTrend.textContent = `${users.lifetimeUniqueVisitors || 0} visitors`;

    // Middle Status
    if (statPaymentSuccessRate) {
        const rate = sub.paymentSuccessRate !== undefined ? sub.paymentSuccessRate : 100;
        statPaymentSuccessRate.textContent = `${rate}%`;
    }
    if (statFailedSummary) {
        statFailedSummary.textContent = `${sub.failedSubscriptionPayments || 0} failed · ${sub.cancelledSubscriptions || 0} cancelled`;
    }

    // Plan Breakdown Tiles
    const counts = sub.planCounts || {};
    if (subPlanBasicCount) subPlanBasicCount.textContent = Number(counts.basic || 0).toLocaleString();
    if (subPlanProCount) subPlanProCount.textContent = Number(counts.pro || 0).toLocaleString();
    if (subPlanPremiumCount) subPlanPremiumCount.textContent = Number(counts.premium || 0).toLocaleString();
    if (subCancelledCount) subCancelledCount.textContent = Number(sub.cancelledSubscriptions || 0).toLocaleString();
    if (subFailedCount) subFailedCount.textContent = Number(sub.failedSubscriptionPayments || 0).toLocaleString();

    // Directory Banners
    if (bannerActiveMembers) bannerActiveMembers.textContent = Number(sub.activeSubscriptions || 0).toLocaleString();
    if (bannerSettledPayments) bannerSettledPayments.textContent = Number(sub.successfulSubscriptionPayments || 0).toLocaleString();

    // Chart
    if (barChartSubtitle) barChartSubtitle.textContent = `Daily settled subscription volume (${periodLabel})`;
    if (data.timeline && Array.isArray(data.timeline)) {
        renderRevenueBarChart(data.timeline);
    }

    // Transactions Table
    allTransactions = Array.isArray(sub.subscriptionTransactions) ? sub.subscriptionTransactions : [];
    renderSubscriptionTransactions(allTransactions);
}

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

if (manualRefreshBtn) {
    manualRefreshBtn.addEventListener("click", () => {
        loadCreators();
        loadAnalytics(currentPeriod, true);
    });
}

const navDashboardBtn = document.getElementById("navDashboardBtn");
if (navDashboardBtn) {
    navDashboardBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateTopbarDate();
    loadCreators();
    loadAnalytics(currentPeriod);

    setInterval(() => {
        loadAnalytics(currentPeriod, false);
    }, 30000);
});