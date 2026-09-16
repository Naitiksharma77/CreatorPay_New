const API_URL = "https://creatorpay-backend.onrender.com";

const profileContent = document.getElementById("profileContent");

const params = new URLSearchParams(window.location.search);
const creatorId = params.get("id");

let selectedCreator = null;


// ===============================
// LOAD CREATOR PROFILE
// ===============================

async function loadProfile() {
    if (!creatorId) {
        showError("Profile not found.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/creators`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to load profile."
            );
        }

        const creator = result.creators.find(
            (item) => item.id === creatorId
        );

        if (!creator) {
            showError("This profile does not exist.");
            return;
        }

        selectedCreator = creator;
        displayProfile(creator);

    } catch (error) {
        console.error("Profile loading error:", error);

        showError(
            "Unable to load this profile. Please try again."
        );
    }
}


// ===============================
// DISPLAY PROFILE
// ===============================

function displayProfile(creator) {
    const image =
        creator.profile_image ||
        "https://via.placeholder.com/700";

    const category =
        creator.category ||
        "Knowledge Sharing";

    const bio =
        creator.bio ||
        "Explore this profile and learn from this person's experience.";

    const price = Number(creator.price).toLocaleString("en-IN");

    profileContent.innerHTML = `
        <div class="profile-card">

            <div class="profile-image-wrapper">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(creator.name)}"
                    loading="lazy"
                >
            </div>

            <div class="profile-info">

                <p class="eyebrow">
                    PROFILE DETAILS
                </p>

                <h1>
                    ${escapeHTML(creator.name)}
                </h1>

                <p class="profile-category">
                    ${escapeHTML(category)}
                </p>

                <p class="profile-bio">
                    ${escapeHTML(bio)}
                </p>

                <div class="price-box">
                    <span class="price-label">
                        Conversation and knowledge-sharing session
                    </span>

                    <span class="price">
                        ₹${price}
                    </span>
                </div>

                <button
                    class="pay-button"
                    id="payButton"
                    type="button"
                >
                    Pay via Razorpay
                </button>

                <p class="secure-payment-text">
                    Secure payment powered by Razorpay
                </p>

            </div>

        </div>
    `;

    document
        .getElementById("payButton")
        .addEventListener("click", startRazorpayPayment);
}


// ===============================
// START RAZORPAY PAYMENT
// ===============================

async function startRazorpayPayment() {
    if (!selectedCreator) {
        alert("Profile information is not available.");
        return;
    }

    const amount = Number(selectedCreator.price);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Invalid creator price.");
        return;
    }

    const payButton = document.getElementById("payButton");

    payButton.disabled = true;
    payButton.textContent = "Please wait...";

    try {
        const response = await fetch(
            `${API_URL}/api/create-order`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    creatorId: selectedCreator.id
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Unable to create Razorpay order."
            );
        }

        if (typeof Razorpay === "undefined") {
            throw new Error(
                "Razorpay Checkout script is missing."
            );
        }

        const options = {
            key: result.keyId,

            amount: result.order.amount,

            currency: result.order.currency || "INR",

            name: "CreatorPay",

            description:
                `Session with ${selectedCreator.name}`,

            order_id: result.order.id,

            handler: function (paymentResponse) {
                alert(
                    "Payment successful!\n\nPayment ID: " +
                    paymentResponse.razorpay_payment_id
                );

                console.log(
                    "Payment response:",
                    paymentResponse
                );

                resetPayButton();
            },

            notes: {
                creatorId: selectedCreator.id,
                creatorName: selectedCreator.name
            },

            theme: {
                color: "#2563eb"
            },

            modal: {
                ondismiss: function () {
                    resetPayButton();
                }
            }
        };

        const razorpayCheckout = new Razorpay(options);

        razorpayCheckout.on(
            "payment.failed",
            function (response) {
                console.error(
                    "Payment failed:",
                    response.error
                );

                alert(
                    response.error.description ||
                    "Payment failed. Please try again."
                );

                resetPayButton();
            }
        );

        razorpayCheckout.open();

    } catch (error) {
        console.error("Razorpay error:", error);

        alert(
            error.message ||
            "Unable to start payment."
        );

        resetPayButton();
    }
}


// ===============================
// RESET PAYMENT BUTTON
// ===============================

function resetPayButton() {
    const payButton = document.getElementById("payButton");

    if (!payButton) {
        return;
    }

    payButton.disabled = false;
    payButton.textContent = "Pay via Razorpay";
}


// ===============================
// SHOW ERROR
// ===============================

function showError(message) {
    profileContent.innerHTML = `
        <div class="error-state">
            <h2>
                Something went wrong
            </h2>

            <p>
                ${escapeHTML(message)}
            </p>
        </div>
    `;
}


// ===============================
// ESCAPE HTML
// ===============================

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ===============================
// START APP
// ===============================

loadProfile();