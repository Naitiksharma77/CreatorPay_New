const API_URL = "http://localhost:5000";

let allCreators = [];

const editCreatorModal =
    document.getElementById("editCreatorModal");

const closeEditModalButton =
    document.getElementById("closeEditModalButton");

const editCreatorForm =
    document.getElementById("editCreatorForm");

const creatorModal =
    document.getElementById("creatorModal");

const addCreatorButton =
    document.getElementById("addCreatorButton");

const closeModalButton =
    document.getElementById("closeModalButton");

const creatorForm =
    document.getElementById("creatorForm");

const creatorList =
    document.getElementById("creatorList");

const creatorCount =
    document.getElementById("creatorCount");


// Open add creator modal

addCreatorButton.addEventListener("click", () => {
    creatorModal.classList.add("active");
});


// Close add creator modal

closeModalButton.addEventListener("click", () => {
    creatorModal.classList.remove("active");
});


// Close add modal when clicking outside

creatorModal.addEventListener("click", (event) => {
    if (event.target === creatorModal) {
        creatorModal.classList.remove("active");
    }
});


// Load creators

async function loadCreators() {
    try {
        const response = await fetch(
            `${API_URL}/api/creators`
        );

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        allCreators = result.creators;

        displayCreators(allCreators);

    } catch (error) {
        console.error(
            "Unable to load creators:",
            error
        );

        creatorList.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load creators</h3>
                <p>Please make sure the backend server is running.</p>
            </div>
        `;
    }
}


// Display creators

function displayCreators(creators) {
    creatorCount.textContent =
        `${creators.length} ${
            creators.length === 1
                ? "creator"
                : "creators"
        }`;

    if (creators.length === 0) {
        creatorList.innerHTML = `
            <div class="empty-state">
                <h3>No creators yet</h3>
                <p>Add your first creator to get started.</p>
            </div>
        `;

        return;
    }

    creatorList.innerHTML = creators.map((creator) => {
        const image = creator.profile_image
            ? creator.profile_image
            : "https://via.placeholder.com/58";

        return `
            <div class="creator-item">

                <img
                    src="${image}"
                    class="creator-image"
                    alt="${creator.name}"
                >

                <div class="creator-details">
                    <h3>${creator.name}</h3>

                    <p>
                        ${creator.category || "No category"}
                    </p>
                </div>

                <div class="creator-price">
                    ₹${Number(
                        creator.price
                    ).toLocaleString("en-IN")}
                </div>

                <div class="creator-actions">

                    <button
                        class="creator-action"
                        onclick="editCreator('${creator.id}')"
                    >
                        Edit
                    </button>

                    <button
                        class="creator-action"
                        onclick="deleteCreator('${creator.id}')"
                    >
                        Delete
                    </button>

                </div>

            </div>
        `;
    }).join("");
}


// Open edit creator modal

function editCreator(id) {
    const creator = allCreators.find(
        (item) => item.id === id
    );

    if (!creator) {
        alert("Creator not found");
        return;
    }

    document.getElementById(
        "editCreatorId"
    ).value = creator.id;

    document.getElementById(
        "editCreatorName"
    ).value = creator.name || "";

    document.getElementById(
        "editCreatorCategory"
    ).value = creator.category || "";

    document.getElementById(
        "editCreatorBio"
    ).value = creator.bio || "";

    document.getElementById(
        "editCreatorPrice"
    ).value = creator.price || "";

    document.getElementById(
        "editCreatorInstagram"
    ).value = creator.instagram_url || "";

    // Clear previous selected photo
    const editImageInput = document.getElementById(
        "editProfileImage"
    );

    if (editImageInput) {
        editImageInput.value = "";
    }

    editCreatorModal.classList.add("active");
}


// Close edit creator modal

closeEditModalButton.addEventListener("click", () => {
    editCreatorModal.classList.remove("active");
});


// Close edit modal when clicking outside

editCreatorModal.addEventListener("click", (event) => {
    if (event.target === editCreatorModal) {
        editCreatorModal.classList.remove("active");
    }
});


// Add creator

creatorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name =
        document.getElementById(
            "creatorName"
        ).value.trim();

    const category =
        document.getElementById(
            "creatorCategory"
        ).value.trim();

    const bio =
        document.getElementById(
            "creatorBio"
        ).value.trim();

    const price =
        document.getElementById(
            "creatorPrice"
        ).value;

    const instagram_url =
        document.getElementById(
            "creatorInstagram"
        ).value.trim();

    const imageFile =
        document.getElementById(
            "creatorImage"
        ).files[0];

    try {
        let profileImageUrl = "";

        // Upload new creator photo first

        if (imageFile) {
            const imageFormData = new FormData();

            imageFormData.append(
                "profile_image",
                imageFile
            );

            const uploadResponse = await fetch(
                `${API_URL}/api/upload-creator-image`,
                {
                    method: "POST",
                    body: imageFormData
                }
            );

            const uploadResult =
                await uploadResponse.json();

            if (
                !uploadResponse.ok ||
                !uploadResult.success
            ) {
                throw new Error(
                    uploadResult.message ||
                    "Image upload failed"
                );
            }

            profileImageUrl =
                uploadResult.image_url;
        }

        // Save creator details

        const response = await fetch(
            `${API_URL}/api/creators`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name,
                    category,
                    bio,
                    price,
                    instagram_url,
                    profile_image: profileImageUrl
                })
            }
        );

        const result =
            await response.json();

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.message ||
                "Unable to add creator"
            );
        }

        alert("Creator added successfully!");

        creatorForm.reset();

        creatorModal.classList.remove(
            "active"
        );

        loadCreators();

    } catch (error) {
        console.error(
            "Add creator error:",
            error
        );

        alert(
            error.message ||
            "Unable to add creator."
        );
    }
});


// Update creator from edit form

editCreatorForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const id =
            document.getElementById(
                "editCreatorId"
            ).value;

        const name =
            document.getElementById(
                "editCreatorName"
            ).value.trim();

        const category =
            document.getElementById(
                "editCreatorCategory"
            ).value.trim();

        const bio =
            document.getElementById(
                "editCreatorBio"
            ).value.trim();

        const price =
            document.getElementById(
                "editCreatorPrice"
            ).value;

        const instagram_url =
            document.getElementById(
                "editCreatorInstagram"
            ).value.trim();

        // Get selected edit photo

        const editImageInput =
            document.getElementById(
                "editProfileImage"
            );

        try {
            let updatedProfileImage = null;

            // Upload new photo only if selected

            if (
                editImageInput &&
                editImageInput.files.length > 0
            ) {
                const imageFormData =
                    new FormData();

                imageFormData.append(
                    "profile_image",
                    editImageInput.files[0]
                );

                const imageResponse =
                    await fetch(
                        `${API_URL}/api/upload-creator-image`,
                        {
                            method: "POST",
                            body: imageFormData
                        }
                    );

                const imageResult =
                    await imageResponse.json();

                if (
                    !imageResponse.ok ||
                    !imageResult.success
                ) {
                    throw new Error(
                        imageResult.message ||
                        "Image upload failed"
                    );
                }

                updatedProfileImage =
                    imageResult.image_url;
            }

            // Prepare updated creator data

            const updatedCreatorData = {
                name,
                category,
                bio,
                price,
                instagram_url
            };

            // Add profile_image only when new photo is selected

            if (updatedProfileImage) {
                updatedCreatorData.profile_image =
                    updatedProfileImage;
            }

            // Update creator in Supabase

            const response = await fetch(
                `${API_URL}/api/creators/${id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(
                        updatedCreatorData
                    )
                }
            );

            const result =
                await response.json();

            if (
                !response.ok ||
                !result.success
            ) {
                throw new Error(
                    result.message ||
                    "Unable to update creator"
                );
            }

            alert(
                "Creator updated successfully!"
            );

            editCreatorForm.reset();

            editCreatorModal.classList.remove(
                "active"
            );

            loadCreators();

        } catch (error) {
            console.error(
                "Update creator error:",
                error
            );

            alert(
                error.message ||
                "Unable to update creator."
            );
        }
    }
);


// Delete creator

async function deleteCreator(id) {
    const confirmDelete = confirm(
        "Are you sure you want to delete this creator?"
    );

    if (!confirmDelete) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/api/creators/${id}`,
            {
                method: "DELETE"
            }
        );

        const result =
            await response.json();

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.message ||
                "Unable to delete creator"
            );
        }

        alert(
            "Creator deleted successfully!"
        );

        loadCreators();

    } catch (error) {
        console.error(
            "Delete creator error:",
            error
        );

        alert(
            "Unable to delete creator. Please try again."
        );
    }
}


// Load creators when page opens

loadCreators();