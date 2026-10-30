/**
 * Roséia — 4-Step Booking Modal & Controller
 * Matches reference screenshots:
 * - image_230f091a.png (Step 1: Calendar)
 * - image_cee10c3b.png (Step 2: Time slot & note)
 * - image_d21b3975.png (Step 3: Review & Transparent Pricing)
 * - Step 4: Razorpay live checkout
 */

(function (window) {
    "use strict";

    let modalCreator = null;
    let wizardStep = 1;
    let selectedDate = null;
    let selectedTimeSlot = "07:00 PM";
    let userNote = "";
    let calMonthDate = new Date();

    const MONTH_NAMES = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    function escapeHTML(str) {
        return String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function ensureModalContainer() {
        let container = document.getElementById("roseiaBookingModalContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "roseiaBookingModalContainer";
            container.style.display = "none";
            document.body.appendChild(container);
        }
        return container;
    }

    function calculatePricing(basePrice) {
        const base = Math.max(1, Math.round(Number(basePrice) || 499));
        const platformFee = Math.round(base * 0.10 * 100) / 100;
        const tax = Math.round(base * 0.085 * 100) / 100;
        const total = Math.round((base + platformFee + tax) * 100) / 100;
        return {
            basePrice: base,
            platformFee: platformFee,
            tax: tax,
            totalPayable: total
        };
    }

    function formatDatePretty(dateStr) {
        if (!dateStr) return "Friday, October 30";
        try {
            const parts = dateStr.split("-");
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            if (!isNaN(d.getTime())) {
                const dayName = DAY_NAMES[d.getDay()];
                const monthName = MONTH_NAMES[d.getMonth()];
                return `${dayName}, ${monthName} ${d.getDate()}`;
            }
        } catch (_) {}
        return dateStr;
    }

    function getTodayKey() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function openModal(creator) {
        if (!creator) return;
        modalCreator = creator;
        wizardStep = 1;
        userNote = "";

        // Determine default selected date from creator's available dates or upcoming
        const availableDates = Array.isArray(creator.available_dates) ? creator.available_dates : [];
        const todayStr = getTodayKey();
        
        // Find first upcoming available date, or today
        const validUpcoming = availableDates.filter(d => d >= todayStr).sort();
        if (validUpcoming.length > 0) {
            selectedDate = validUpcoming[0];
            const p = selectedDate.split("-");
            calMonthDate = new Date(Number(p[0]), Number(p[1]) - 1, 1);
        } else {
            selectedDate = todayStr;
            calMonthDate = new Date();
        }

        renderModal();
        const container = ensureModalContainer();
        container.style.display = "block";
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        const container = ensureModalContainer();
        container.style.display = "none";
        document.body.style.overflow = "";
    }

    function renderModal() {
        const container = ensureModalContainer();
        if (!modalCreator) return;

        const pricing = calculatePricing(modalCreator.price);
        const name = (modalCreator.name && modalCreator.name.trim()) || "Member";

        container.innerHTML = `
            <div class="roseia-modal-backdrop" role="dialog" aria-modal="true">
                <div class="roseia-modal-shell">
                    
                    <!-- Top Navigation Bar -->
                    <div class="roseia-wizard-topbar">
                        <button type="button" class="wizard-back-icon-btn" onclick="window.RoseiaBooking.handleBack()" aria-label="Go Back">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>

                        <div class="wizard-step-indicator">
                            <span class="wizard-step-label">Step ${wizardStep} of 4</span>
                            <div class="wizard-step-bars">
                                <div class="wizard-step-bar ${wizardStep >= 1 ? 'active' : ''}"></div>
                                <div class="wizard-step-bar ${wizardStep >= 2 ? 'active' : ''}"></div>
                                <div class="wizard-step-bar ${wizardStep >= 3 ? 'active' : ''}"></div>
                                <div class="wizard-step-bar ${wizardStep >= 4 ? 'active' : ''}"></div>
                            </div>
                        </div>

                        <button type="button" class="wizard-cancel-link" onclick="window.RoseiaBooking.close()">
                            Cancel
                        </button>
                    </div>

                    <!-- Step Content -->
                    <div class="wizard-main-content">
                        ${renderCurrentStepHTML(pricing, name)}
                    </div>

                </div>
            </div>
        `;

        // Restore note value if on step 2
        if (wizardStep === 2) {
            const textarea = document.getElementById("wizardUserNote");
            if (textarea) textarea.value = userNote;
        }
    }

    function renderCurrentStepHTML(pricing, name) {
        if (wizardStep === 1) return renderStep1CalendarHTML();
        if (wizardStep === 2) return renderStep2TimeHTML(name);
        if (wizardStep === 3) return renderStep3ReviewHTML(pricing, name);
        if (wizardStep === 4) return renderStep4ConfirmedHTML(pricing, name);
        return "";
    }

    // =========================================================
    // STEP 1: CALENDAR (Plan Something Beautiful)
    // =========================================================
    function renderStep1CalendarHTML() {
        const year = calMonthDate.getFullYear();
        const month = calMonthDate.getMonth();
        const monthTitle = `${MONTH_NAMES[month]} ${year}`;

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        const availableDatesSet = new Set(Array.isArray(modalCreator.available_dates) ? modalCreator.available_dates : []);
        const todayStr = getTodayKey();

        let cellsHtml = "";
        for (let i = 0; i < firstDayIndex; i++) {
            cellsHtml += `<div class="cal-day-cell empty" style="pointer-events: none;"></div>`;
        }

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const mm = String(month + 1).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            const dateKey = `${year}-${mm}-${dd}`;

            const isToday = (dateKey === todayStr);
            const isSelected = (selectedDate === dateKey);
            const isAvailable = availableDatesSet.has(dateKey) || (isToday);
            const isPast = (dateKey < todayStr);

            let cellClass = "cal-day-cell";
            if (isSelected) {
                cellClass += " selected";
            } else if (isPast || !isAvailable) {
                cellClass += " unavailable";
            } else {
                cellClass += " available";
            }

            const canSelect = isAvailable && !isPast;

            cellsHtml += `
                <button
                    type="button"
                    class="${cellClass}"
                    data-date="${dateKey}"
                    ${canSelect ? `onclick="window.RoseiaBooking.selectDate('${dateKey}')"` : 'disabled'}
                >
                    <span>${day}</span>
                    ${isToday ? `<span class="cal-day-subtext">Today</span>` : ''}
                </button>
            `;
        }

        const formatted = formatDatePretty(selectedDate);

        return `
            <div class="wizard-heading-wrap">
                <h1 class="wizard-page-title">Plan Something Beautiful</h1>
                <p class="wizard-page-sub">Choose a date that works for you.</p>
            </div>

            <div class="roseia-wizard-card">
                <div class="cal-header-row">
                    <button type="button" class="cal-nav-btn" onclick="window.RoseiaBooking.changeMonth(-1)" aria-label="Previous Month">‹</button>
                    <span class="cal-month-title">${monthTitle}</span>
                    <button type="button" class="cal-nav-btn" onclick="window.RoseiaBooking.changeMonth(1)" aria-label="Next Month">›</button>
                </div>

                <div class="cal-weekdays-grid">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>

                <div class="cal-days-grid">
                    ${cellsHtml}
                </div>

                <div class="cal-legend-row">
                    <div class="cal-legend-item">
                        <span class="legend-dot available"></span>
                        <span>Available</span>
                    </div>
                    <div class="cal-legend-item">
                        <span class="legend-dot selected"></span>
                        <span>Selected</span>
                    </div>
                    <div class="cal-legend-item">
                        <span class="legend-dot unavailable"></span>
                        <span>Unavailable</span>
                    </div>
                </div>
            </div>

            <div class="cal-bottom-preview-card">
                <div class="cal-preview-left">
                    <span class="cal-preview-label">Your Preferred Date</span>
                    <span class="cal-preview-date">${escapeHTML(formatted)}</span>
                </div>
                <button type="button" class="cal-choose-time-btn" onclick="window.RoseiaBooking.goToStep(2)">
                    Choose Time
                </button>
            </div>
        `;
    }

    // =========================================================
    // STEP 2: TIME SLOTS & NOTE (What Time Works Best?)
    // =========================================================
    function renderStep2TimeHTML(name) {
        const slots = ["11:00 AM", "02:00 PM", "04:30 PM", "07:00 PM"];
        const formattedDate = formatDatePretty(selectedDate);

        return `
            <div class="wizard-heading-wrap">
                <h1 class="wizard-page-title">What Time Works Best?</h1>
                <p class="wizard-page-sub">${escapeHTML(formattedDate)} · 120-minute curated date</p>
            </div>

            <div class="roseia-wizard-card">
                <div class="wizard-timezone-notice">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Timezone: Local Time</span>
                </div>

                <div class="wizard-time-slots-grid">
                    ${slots.map(s => `
                        <button
                            type="button"
                            class="wizard-time-pill ${selectedTimeSlot === s ? 'selected' : ''}"
                            onclick="window.RoseiaBooking.selectTime('${s}')"
                        >
                            ${s}
                        </button>
                    `).join("")}
                </div>

                <div class="wizard-card-divider"></div>

                <label for="wizardUserNote" class="wizard-note-label">
                    Short Note for ${escapeHTML(name)} (Optional)
                </label>
                <textarea
                    id="wizardUserNote"
                    class="wizard-note-textarea"
                    placeholder="Share which activity from her profile caught your eye..."
                    oninput="window.RoseiaBooking.saveNote(this.value)"
                >${escapeHTML(userNote)}</textarea>
            </div>

            <button type="button" class="wizard-full-pink-btn" onclick="window.RoseiaBooking.goToStep(3)">
                Review Date Summary
            </button>
        `;
    }

    // =========================================================
    // STEP 3: REVIEW & TRANSPARENT PRICING
    // =========================================================
    function renderStep3ReviewHTML(pricing, name) {
        const formattedDate = formatDatePretty(selectedDate);
        const image = (modalCreator.profile_image && modalCreator.profile_image.startsWith("http"))
            ? modalCreator.profile_image
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";

        // Clean location (remove any duplicate "Available Locally · Available Locally")
        let loc = (modalCreator.creator_location || modalCreator.location || "Available Locally").trim();
        if (loc.toLowerCase().includes("available locally") && loc.includes("·")) {
            loc = "Available Locally";
        }

        return `
            <div class="wizard-heading-wrap">
                <h1 class="wizard-page-title">Review Your Date</h1>
                <p class="wizard-page-sub">Confirm your preferred details and transparent pricing.</p>
            </div>

            <div class="roseia-wizard-card">
                <!-- Creator Header -->
                <div class="review-creator-row">
                    <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" class="review-creator-avatar" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';">
                    <div class="review-creator-meta">
                        <span class="review-creator-name">${escapeHTML(name)}</span>
                        <span class="review-creator-loc">${escapeHTML(loc)}</span>
                    </div>
                </div>

                <!-- Preferred Details Table -->
                <div class="review-details-table">
                    <div class="review-detail-row">
                        <span>Preferred Date</span>
                        <span class="review-detail-val">${escapeHTML(formattedDate)}</span>
                    </div>
                    <div class="review-detail-row">
                        <span>Preferred Time</span>
                        <span class="review-detail-val">${escapeHTML(selectedTimeSlot)} (Local Time)</span>
                    </div>
                    <div class="review-detail-row">
                        <span>Date Duration</span>
                        <span class="review-detail-val">120 minutes</span>
                    </div>
                </div>

                <!-- Transparent Itemized Price Breakdown -->
                <div class="review-price-table">
                    <div class="review-price-row">
                        <span>Creator Date Fee</span>
                        <span class="review-detail-val">₹${pricing.basePrice.toFixed(2)}</span>
                    </div>
                    <div class="review-price-row">
                        <span>Platform Concierge &amp; Safety Fee (10%)</span>
                        <span class="review-detail-val">₹${pricing.platformFee.toFixed(2)}</span>
                    </div>
                    <div class="review-price-row">
                        <span>Estimated Taxes (8.5%)</span>
                        <span class="review-detail-val">₹${pricing.tax.toFixed(2)}</span>
                    </div>
                    <div class="review-price-row total">
                        <span>Total Payable</span>
                        <span class="review-total-val">₹${pricing.totalPayable.toFixed(2)} INR</span>
                    </div>
                </div>

                <div class="review-policy-link-row">
                    <button type="button" class="review-policy-link" onclick="window.RoseiaBooking.showPolicy()">
                        View cancellation &amp; consent policy
                    </button>
                </div>
            </div>

            <button type="button" id="roseiaContinuePaymentBtn" class="wizard-full-pink-btn" onclick="window.RoseiaBooking.startPayment()">
                Continue to Payment
            </button>
        `;
    }

    // =========================================================
    // STEP 4: CONFIRMED CELEBRATION
    // =========================================================
    function renderStep4ConfirmedHTML(pricing, name) {
        const formattedDate = formatDatePretty(selectedDate);
        return `
            <div class="roseia-wizard-card" style="margin-top: 20px;">
                <div class="booking-success-box">
                    <div class="success-heart-icon">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                    </div>

                    <h2 class="success-booking-title">Booking Confirmed!</h2>
                    <p class="success-booking-desc">
                        Your 120-minute date with <strong>${escapeHTML(name)}</strong> is confirmed. Roséia concierge will connect you directly.
                    </p>

                    <div class="success-booking-receipt">
                        <div><strong>Date:</strong> ${escapeHTML(formattedDate)}</div>
                        <div><strong>Time:</strong> ${escapeHTML(selectedTimeSlot)}</div>
                        <div><strong>Duration:</strong> 120 minutes</div>
                        <div><strong>Total Paid:</strong> ₹${pricing.totalPayable.toFixed(2)} INR</div>
                    </div>

                    <button type="button" class="wizard-full-pink-btn" onclick="window.RoseiaBooking.viewBookings()">
                        View in My Bookings
                    </button>
                </div>
            </div>
        `;
    }

    // =========================================================
    // RAZORPAY PAYMENT FLOW (Real Backend Verification)
    // =========================================================
    async function startPayment() {
        if (!modalCreator || !selectedDate) {
            alert("Please choose a date before proceeding.");
            return;
        }

        const btn = document.getElementById("roseiaContinuePaymentBtn");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span>Creating Secure Order...</span>`;
        }

        try {
            // 1. Create order on backend
            const res = await fetch("/api/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creatorId: modalCreator.id,
                    type: "date_booking",
                    bookingDate: selectedDate,
                    timeSlot: selectedTimeSlot,
                    userNote: userNote
                })
            });

            const data = await res.json();
            if (!data.success || !data.order || !data.order.id) {
                throw new Error(data.message || "Unable to initiate payment order.");
            }

            const keyId = data.key_id || "rzp_live_TbMnvmib0JVGT3";
            const orderId = data.order.id;
            const amountInPaise = data.order.amount;

            // 2. Open Razorpay Checkout modal
            const options = {
                key: keyId,
                amount: amountInPaise,
                currency: "INR",
                name: "Roséia",
                description: `Date Booking with ${modalCreator.name || "Member"} (120 min)`,
                order_id: orderId,
                image: modalCreator.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
                handler: async function (response) {
                    try {
                        if (btn) btn.innerHTML = `<span>Verifying Payment...</span>`;

                        const verifyRes = await fetch("/api/verify-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                creatorId: modalCreator.id,
                                bookingDate: selectedDate,
                                timeSlot: selectedTimeSlot
                            })
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyData.success) {
                            // Record local booking
                            saveConfirmedBooking({
                                id: response.razorpay_payment_id,
                                creatorId: modalCreator.id,
                                creatorName: modalCreator.name,
                                creatorImage: modalCreator.profile_image,
                                date: selectedDate,
                                time: selectedTimeSlot,
                                note: userNote,
                                price: modalCreator.price,
                                paidAt: new Date().toISOString()
                            });

                            wizardStep = 4;
                            renderModal();
                        } else {
                            alert("Payment verification issue: " + (verifyData.message || "Please contact support."));
                            if (btn) {
                                btn.disabled = false;
                                btn.innerHTML = `Continue to Payment`;
                            }
                        }
                    } catch (err) {
                        console.error("Verification error:", err);
                        alert("Unable to verify payment with server. Please check your network.");
                        if (btn) {
                            btn.disabled = false;
                            btn.innerHTML = `Continue to Payment`;
                        }
                    }
                },
                modal: {
                    ondismiss: function () {
                        if (btn) {
                            btn.disabled = false;
                            btn.innerHTML = `Continue to Payment`;
                        }
                    }
                },
                theme: {
                    color: "#D93B78"
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", function (resp) {
                alert("Payment was unsuccessful: " + (resp.error.description || "Payment failed."));
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `Continue to Payment`;
                }
            });
            rzp.open();

        } catch (err) {
            console.error("Order error:", err);
            alert("Error initiating booking: " + err.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `Continue to Payment`;
            }
        }
    }

    function saveConfirmedBooking(booking) {
        try {
            const stored = localStorage.getItem("fc_bookings");
            const list = stored ? JSON.parse(stored) : [];
            list.unshift(booking);
            localStorage.setItem("fc_bookings", JSON.stringify(list));

            // Also add to connections
            const connStored = localStorage.getItem("fc_connections");
            const connList = connStored ? JSON.parse(connStored) : [];
            if (!connList.includes(String(booking.creatorId))) {
                connList.push(String(booking.creatorId));
                localStorage.setItem("fc_connections", JSON.stringify(connList));
            }
        } catch (_) {}
    }

    function showPolicyModal() {
        alert(
            "Roséia Cancellation & Mutual Consent Policy:\n\n" +
            "1. 100% Escrow Protection: Your booking fee is held in escrow and released only after your curated date takes place.\n" +
            "2. Easy Cancellations: Cancel up to 12 hours in advance for a complete 100% refund.\n" +
            "3. Responsive Guarantee: If the member does not confirm your date within 24 hours, you receive an immediate full refund.\n" +
            "4. Mutual Safety: All members are identity-verified for a safe and respectful in-person dating experience."
        );
    }

    // Public API
    window.RoseiaBooking = {
        open: openModal,
        close: closeModal,
        goToStep: function (step) {
            wizardStep = step;
            renderModal();
        },
        handleBack: function () {
            if (wizardStep > 1) {
                wizardStep--;
                renderModal();
            } else {
                closeModal();
            }
        },
        changeMonth: function (delta) {
            calMonthDate.setMonth(calMonthDate.getMonth() + delta);
            renderModal();
        },
        selectDate: function (dateKey) {
            selectedDate = dateKey;
            renderModal();
        },
        selectTime: function (slot) {
            selectedTimeSlot = slot;
            renderModal();
        },
        saveNote: function (val) {
            userNote = val;
        },
        showPolicy: showPolicyModal,
        startPayment: startPayment,
        viewBookings: function () {
            closeModal();
            if (typeof window.switchTab === "function") {
                window.switchTab("bookings");
            } else {
                window.location.href = "creator_home.html#bookings";
            }
        }
    };

})(window);
