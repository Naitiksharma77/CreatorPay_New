const API_URL = "http://localhost:5000";

const creatorPricingGrid =
    document.getElementById("creatorPricingGrid");

const creatorPricingStatus =
    document.getElementById("creatorPricingStatus");


async function loadCreatorPricing() {

    try {

        const response =
            await fetch(`${API_URL}/api/creators`);

        if (!response.ok) {
            throw new Error("Creators load नहीं हो पाए");
        }

        const creators = await response.json();

        creatorPricingGrid.innerHTML = "";

        if (!creators || creators.length === 0) {

            creatorPricingStatus.textContent =
                "अभी कोई mentor listed नहीं है।";

            return;
        }

        creatorPricingStatus.textContent =
            `${creators.length} mentor pricing options available.`;

        creators.forEach((creator) => {

            const card =
                document.createElement("div");

            card.className = "creator-price-card";

            const name =
                creator.name || "Unnamed Mentor";

            const category =
                creator.category || "Educational Guidance";

            const bio =
                creator.bio ||
                "Educational guidance session available.";

            const price =
                Number(creator.price || 0);

            card.innerHTML = `

                <h3>
                    ${escapeHTML(name)}
                </h3>

                <div class="creator-category">
                    ${escapeHTML(category)}
                </div>

                <p class="creator-bio">
                    ${escapeHTML(bio)}
                </p>

                <div class="creator-amount">
                    ₹${price.toLocaleString("en-IN")}
                </div>

                <a
                    href="explore.html"
                    class="creator-view-button"
                >
                    View Mentor
                </a>

            `;

            creatorPricingGrid.appendChild(card);

        });

    } catch (error) {

        console.error(
            "Pricing loading error:",
            error
        );

        creatorPricingStatus.textContent =
            "Mentor pricing load नहीं हो सकी। Backend running है या नहीं, check करें.";

    }

}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


loadCreatorPricing();