const API_URL = "https://creatorpay-backend.onrender.com";

const YOUR_UPI_ID = "9329728138@ibl";

const profileContent =
    document.getElementById("profileContent");

const params = new URLSearchParams(
    window.location.search
);

const creatorId = params.get("id");

let selectedCreator = null;


// Load selected creator profile

async function loadProfile() {

    if (!creatorId) {
        showError("Profile not found.");
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/api/creators`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Unable to load profile"
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

        console.error(
            "Profile loading error:",
            error
        );

        showError(
            "Unable to load this profile. Please try again."
        );
    }
}


// Display creator profile

function displayProfile(creator) {

    const image = creator.profile_image
        ? creator.profile_image
        : "https://via.placeholder.com/700";

    const category = creator.category
        ? creator.category
        : "Knowledge Sharing";

    const bio = creator.bio
        ? creator.bio
        : "Explore this profile and learn from this person's experience.";

    const price = Number(
        creator.price
    ).toLocaleString("en-IN");


    profileContent.innerHTML = `

        <div class="profile-card">

            <div class="profile-image-wrapper">

                <img
                    src="${image}"
                    alt="${creator.name}"
                >

            </div>


            <div class="profile-info">

                <p class="eyebrow">
                    PROFILE DETAILS
                </p>

                <h1>
                    ${creator.name}
                </h1>

                <p class="profile-category">
                    ${category}
                </p>

                <p class="profile-bio">
                    ${bio}
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
                >
                    Pay via UPI
                </button>

            </div>

        </div>

    `;


    const payButton =
        document.getElementById("payButton");

    payButton.addEventListener(
        "click",
        startUPIPayment
    );
}


// Start UPI payment

function startUPIPayment() {

    if (!selectedCreator) {
        alert("Profile information is not available.");
        return;
    }

    if (
        !YOUR_UPI_ID ||
        YOUR_UPI_ID === "YOURUPI@upi"
    ) {
        alert("Please add your UPI ID first.");
        return;
    }

    const amount = Number(
        selectedCreator.price
    );

    if (!amount || amount <= 0) {
        alert("Invalid creator price.");
        return;
    }


    const upiLink =
        `upi://pay?pa=${encodeURIComponent(YOUR_UPI_ID)}` +
        `&pn=${encodeURIComponent("CreatorPay")}` +
        `&am=${encodeURIComponent(amount.toFixed(2))}` +
        `&cu=INR` +
        `&tn=${encodeURIComponent(
            "Knowledge-sharing session with " +
            selectedCreator.name
        )}`;


    const paymentDetails = {

        creatorName:
            selectedCreator.name,

        amount:
            amount,

        creatorId:
            selectedCreator.id,

        paymentMethod:
            "UPI",

        paymentStatus:
            "initiated"

    };


    localStorage.setItem(
        "creatorpay_payment",
        JSON.stringify(paymentDetails)
    );


    window.location.href = upiLink;

}


// Show error message

function showError(message) {

    profileContent.innerHTML = `

        <div class="error-state">

            <h2>
                Something went wrong
            </h2>

            <p>
                ${message}
            </p>

        </div>

    `;

}


// Start loading profile

loadProfile();