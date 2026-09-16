document.addEventListener("DOMContentLoaded", function () {
    const buttons = document.querySelectorAll(".view-profile-button");

    buttons.forEach(function (button) {
        button.addEventListener("click", function () {
            window.location.href = "explore.html";
        });
    });
});