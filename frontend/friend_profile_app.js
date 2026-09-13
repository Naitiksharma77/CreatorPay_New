const API_URL = "https://creatorpay-backend.onrender.com";

/*
  यह Razorpay TEST KEY ID है.
  Secret Key कभी भी frontend में नहीं डालनी है.
*/
const RAZORPAY_KEY_ID = "rzp_live_TbMnvmib0JVGT3";

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
        : "Friend";

    const bio = creator.bio
        ? creator.bio
        : "Get to know this person and become friends.";

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
                    FRIEND PROFILE
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
                        Pay to be a friend
                    </span>

                    <span class="price">
                        ₹${price}
                    </span>

                </div>

                <button
                    class="pay-button"
                    id="payButton"
                >
                    Pay and Be a Friend
                </button>

            </div>

        </div>

    `;


    const payButton =
        document.getElementById("payButton");

    payButton.addEventListener(
        "click",
        startPayment
    );
}


// Start Razorpay payment
async function startPayment() {

    if (!selectedCreator) {
        alert("Profile information is not available.");
        return;
    }

    if (
        !RAZORPAY_KEY_ID ||
        RAZORPAY_KEY_ID === "YOUR_RAZORPAY_KEY_ID"
    ) {
        alert("Please add your Razorpay Key ID first.");
        return;
    }

    const payButton =
        document.getElementById("payButton");

    payButton.disabled = true;
    payButton.textContent = "Preparing payment...";


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
                "Unable to create payment order"
            );
        }


        const order = result.order;


        const options = {

            key: RAZORPAY_KEY_ID,

            amount: order.amount,

            currency: order.currency,

            name: "CreatorPay",

            description:
                `Friend payment for ${selectedCreator.name}`,

            order_id: order.id,

          handler: async function (response) {
  try {
    const verifyResponse = await fetch(`${API_URL}/api/verify-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    });

    const verifyResult = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyResult.success) {
      throw new Error(
        verifyResult.message || "Payment verification failed"
      );
    }

    const paymentDetails = {
      creatorName: selectedCreator.name,
      amount: selectedCreator.price,
      creatorId: selectedCreator.id,
      orderId: response.razorpay_order_id,
      paymentId: response.razorpay_payment_id
    };

    localStorage.setItem(
      "creatorpay_payment",
      JSON.stringify(paymentDetails)
    );

    window.location.href = "payment_success.html";

  } catch (error) {
    console.error("Payment verification error:", error);

    alert(
      error.message || "Payment could not be verified."
    );
  }
           },
            theme: {
                color: "#2563eb"
            }

        };


        const razorpayCheckout =
            new Razorpay(options);


        razorpayCheckout.open();


        payButton.disabled = false;

        payButton.textContent =
            "Pay and Be a Friend";


    } catch (error) {

        console.error(
            "Payment error:",
            error
        );


        alert(
            error.message ||
            "Unable to start payment."
        );


        payButton.disabled = false;

        payButton.textContent =
            "Pay and Be a Friend";

    }
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