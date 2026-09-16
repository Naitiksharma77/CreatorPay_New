const API_URL = "https://creatorpay-backend.onrender.com";

const creatorList =
    document.getElementById("creatorList");

const creatorCount =
    document.getElementById("creatorCount");


// Safe text helper

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Load all creators from backend

async function loadCreators() {
    try {
        const response = await fetch(
            `${API_URL}/api/creators`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Unable to load profiles"
            );
        }

        displayCreators(result.creators);

    } catch (error) {
        console.error(
            "Explore page error:",
            error
        );

        creatorList.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load profiles</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}


// Display creator cards

function displayCreators(creators) {

    creatorCount.textContent =
        `${creators.length} ${
            creators.length === 1
                ? "profile"
                : "profiles"
        }`;

    if (creators.length === 0) {
        creatorList.innerHTML = `
            <div class="empty-state">
                <h3>No profiles available yet</h3>
                <p>Please check again later.</p>
            </div>
        `;

        return;
    }

    creatorList.innerHTML = creators.map((creator) => {

        const image = creator.profile_image
            ? creator.profile_image
            : "https://via.placeholder.com/300";

        const bio = creator.bio
            ? creator.bio
            : "Explore this profile and learn from their experience.";

        const price = Number(creator.price || 0)
            .toLocaleString("en-IN");

        return `
            <div class="creator-card">

                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(creator.name)}"
                >

                <h3>
                    ${escapeHTML(creator.name)}
                </h3>

                <p class="creator-category">
                    ${escapeHTML(
                        creator.category ||
                        "Knowledge Sharing"
                    )}
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
                        href="friend_profile.html?id=${encodeURIComponent(
                            creator.id
                        )}"
                    >
                        View Profile
                    </a>

                    <a
                        class="pay-button"
                        href="upi_payment.html?id=${encodeURIComponent(
                            creator.id
                        )}"
                    >
                        Pay via UPI
                    </a>

                </div>

            </div>
        `;

    }).join("");
}


// Start page

loadCreators();