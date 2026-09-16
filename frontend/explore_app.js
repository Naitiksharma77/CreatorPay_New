const API_URL = "https://creatorpay-backend.onrender.com";

const creatorList = document.getElementById("creatorList");
const creatorCount = document.getElementById("creatorCount");


// ===============================
// SAFE HTML TEXT
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
// LOAD CREATORS
// ===============================

async function loadCreators() {
    try {
        const response = await fetch(
            `${API_URL}/api/creators`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Unable to load profiles."
            );
        }

        displayCreators(
            Array.isArray(result.creators)
                ? result.creators
                : []
        );

    } catch (error) {
        console.error(
            "Explore page error:",
            error
        );

        creatorCount.textContent = "Unable to load";

        creatorList.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load mentors</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}


// ===============================
// DISPLAY CREATOR CARDS
// ===============================

function displayCreators(creators) {
    const totalCreators = creators.length;

    creatorCount.textContent =
        `${totalCreators} ${
            totalCreators === 1
                ? "mentor"
                : "mentors"
        }`;

    if (totalCreators === 0) {
        creatorList.innerHTML = `
            <div class="empty-state">
                <h3>No mentors available yet</h3>
                <p>Please check again later.</p>
            </div>
        `;

        return;
    }

    creatorList.innerHTML = creators
        .map((creator) => {
            const image =
                creator.profile_image ||
                "https://via.placeholder.com/300";

            const name =
                creator.name ||
                "Creator";

            const category =
                creator.category ||
                "Knowledge Sharing";

            const bio =
                creator.bio ||
                "Explore this profile and learn from their experience.";

            const price = Number(
                creator.price || 0
            ).toLocaleString("en-IN");

            const profileLink =
                `friend_profile.html?id=${encodeURIComponent(
                    creator.id
                )}`;

            return `
                <article class="creator-card">

                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(name)}"
                        loading="lazy"
                    >

                    <h3>
                        ${escapeHTML(name)}
                    </h3>

                    <p class="creator-category">
                        ${escapeHTML(category)}
                    </p>

                    <p class="creator-bio">
                        ${escapeHTML(bio)}
                    </p>

                    <div class="creator-price">
                        ₹${price}
                    </div>

                    <div class="creator-actions">

                        <a
                            class="view-profile-button"
                            href="${profileLink}"
                        >
                            View Profile
                        </a>

                    </div>

                </article>
            `;
        })
        .join("");
}


// ===============================
// START APP
// ===============================

loadCreators();