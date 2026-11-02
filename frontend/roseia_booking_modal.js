/**
 * Roséia — Legacy Booking Modal Compatibility Bridge
 * Forwards legacy booking calls to the modern Interaction Suite (Chat, Voice Call, Video Call)
 */

(function (window) {
    "use strict";

    window.RoseiaBooking = {
        open: function (creator) {
            if (window.openInteractionModal) {
                window.openInteractionModal(creator, "chat");
            } else if (creator && creator.id) {
                window.location.href = `friend_profile.html?id=${encodeURIComponent(creator.id)}&action=chat`;
            }
        },
        close: function () {
            if (window.closeInteractionModal) {
                window.closeInteractionModal();
            }
        }
    };

})(window);
