document.addEventListener("DOMContentLoaded", function () {
    const creatorCards = document.querySelectorAll(".creator-card");

    creatorCards.forEach(function (card) {
        card.style.cursor = "pointer";

        card.addEventListener("click", function () {
            window.location.href = "explore.html";
        });
    });
});