document.addEventListener("DOMContentLoaded", function () {
    const creatorCards = document.querySelectorAll(".creator-card");

    creatorCards.forEach(function (card) {
        card.style.cursor = "pointer";

        card.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                window.location.href = "explore.html";
            }
        });
    });
});