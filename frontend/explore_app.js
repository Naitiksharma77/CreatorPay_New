const API_URL = "http://localhost:5000";

const creatorList =
    document.getElementById("creatorList");

const creatorCount =
    document.getElementById("creatorCount");


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
                "Unable to load friends"
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
                <h3>Unable to load friends</h3>
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
                ? "friend"
                : "friends"
        }`;

    if (creators.length === 0) {
        creatorList.innerHTML = `
            <div class="empty-state">
                <h3>No friends available yet</h3>
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
            : "Get to know this person and become friends.";

        return `
            <div class="creator-card">

                <img
                    src="${image}"
                    alt="${creator.name}"
                >

                <h3>
                    ${creator.name}
                </h3>

                <p class="creator-category">
                    ${creator.category || "Friend"}
                </p>

                <p class="creator-bio">
                    ${bio}
                </p>

                <div class="creator-price">
                    ₹${Number(
                        creator.price
                    ).toLocaleString("en-IN")}
                </div>

                <a
                    class="view-profile-button"
                    href="friend_profile.html?id=${creator.id}"
                >
                    View Profile
                </a>

            </div>
        `;
    }).join("");
}


// Start page

loadCreators();