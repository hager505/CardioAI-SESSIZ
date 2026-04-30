// DOM Elements
document.addEventListener('DOMContentLoaded', function () {
    // Calendar Elements
    const calendarDays = document.getElementById('calendarDays');
    const currentMonthElement = document.getElementById('currentMonth');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const selectedDateInput = document.getElementById('selectedDate');
    const timeSlotsGrid = document.getElementById('timeSlotsGrid');
    const selectedTimeInput = document.getElementById('selectedTime');

    // Form Elements
    const appointmentForm = document.getElementById('appointmentForm');
    const confirmationSection = document.getElementById('confirmationSection');
    const submitBookingBtn = document.getElementById('submitBookingBtn');
    const cancelBookingBtn = document.getElementById('cancelBookingBtn');
    const formTitle = document.getElementById('formTitle');
    const bookingSection = document.getElementById('bookingSection');

    // Confirmation Actions
    const backToBookingBtn = document.getElementById('backToBookingBtn');
    const viewAppointmentsBtn = document.getElementById('viewAppointmentsBtn');

    // Appointment Tabs
    const appointmentTabs = document.querySelectorAll('.appointment-tab');
    const appointmentsLists = document.querySelectorAll('.appointments-list');

    // Modals
    const successModal = document.getElementById('successModal');
    const cancelModal = document.getElementById('cancelModal');
    const closeSuccessModal = document.getElementById('closeSuccessModal');
    const closeCancelModal = document.getElementById('closeCancelModal');
    const okBtn = document.getElementById('okBtn');
    const cancelNoBtn = document.getElementById('cancelNoBtn');
    const cancelYesBtn = document.getElementById('cancelYesBtn');
    const cancelMessage = document.getElementById('cancelMessage');

    // Calendar Variables
    let currentDate = new Date(); // Today
    let selectedDate = null;
    let selectedTimeSlot = null;

    // Editing Variables
    let isEditingAppointment = false;
    let editingAppointmentId = null;

    // Cancel Variables
    let cancelAppointmentId = null;

    // Sample Data
    const timeSlots = [
        '09:00 AM', '10:00 AM', '11:00 AM',
        '02:00 PM', '03:00 PM', '04:00 PM'
    ];

    const API_BASE_URL = 'http://localhost:5000/api';
    const userId = sessionStorage.getItem('user_id');

    // Redirect to login if no user_id (optional but good practice)
    if (!userId) {
        console.warn("No user_id found in sessionStorage. Redirecting to login...");
        // window.location.href = "../../auth/login.html"; 
    }

    // Initialize Calendar
    function initCalendar() {
        // Set default date to today
        selectedDate = new Date();
        const y = selectedDate.getFullYear();
        const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const d = String(selectedDate.getDate()).padStart(2, '0');
        selectedDateInput.value = `${y}-${m}-${d}`;

        renderCalendar();
        generateTimeSlots();
        setupEventListeners();

        loadDoctors();
        loadAppointments();
        loadPatientSummary();
    }

    // Setup Event Listeners for appointment buttons
    function setupEventListeners() {
        // Handle View button click
        document.addEventListener('click', function (e) {
            if (e.target.closest('.view-btn')) {
                const appointmentId = e.target.closest('.view-btn').getAttribute('data-id');
                viewAppointmentDetails(appointmentId);
            }

            // Handle Update button click
            if (e.target.closest('.update-btn')) {
                const appointmentId = e.target.closest('.update-btn').getAttribute('data-id');
                updateAppointment(appointmentId);
            }

            // Handle Cancel button click on appointment card
            if (e.target.closest('.cancel-appointment-btn')) {
                const appointmentId = e.target.closest('.cancel-appointment-btn').getAttribute('data-id');
                cancelAppointment(appointmentId);
            }
        });

        // Appointment Tabs
        appointmentTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');

                // Update active tab
                appointmentTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show corresponding list
                appointmentsLists.forEach(list => {
                    list.classList.remove('active');
                    if (list.id === `${tabId}Appointments`) {
                        list.classList.add('active');
                    }
                });
            });
        });

        // Sync native date input with the calendar logic
        selectedDateInput.addEventListener('change', function () {
            if (this.value) {
                selectedDate = new Date(this.value);
                // Also update calendar view if needed (re-render)
                currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                renderCalendar();
                updateTimeSlots();
            }
        });
    }

    // Parse date string to Date object
    function parseDateString(dateStr) {
        const parts = dateStr.split(' ');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames.indexOf(parts[0]);
        const day = parseInt(parts[1].replace(',', ''));
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
    }

    // Render Calendar
    function renderCalendar() {
        calendarDays.innerHTML = '';

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Update month display
        currentMonthElement.textContent = `${currentDate.toLocaleDateString('en-US', { month: 'long' })} ${year}`;

        // Get first day of month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Get day of week for first day (0 = Sunday, 6 = Saturday)
        const firstDayIndex = firstDay.getDay();

        // Get previous month's last days
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        // Previous month days
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const day = document.createElement('div');
            day.className = 'calendar-day disabled';
            day.textContent = prevMonthLastDay - i;
            calendarDays.appendChild(day);
        }

        // Current month days
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;

            // Create date object for this day
            const dayDate = new Date(year, month, i);

            // Mark today
            if (dayDate.toDateString() === today.toDateString()) {
                day.classList.add('today');
                day.style.backgroundColor = 'rgba(135, 175, 18, 0.2)';
                day.style.borderColor = 'var(--accent-green)';
            }

            // Mark selected date
            if (selectedDate && dayDate.toDateString() === selectedDate.toDateString()) {
                day.classList.add('selected');
            }

            // Mark available dates (every weekday)
            const dayOfWeek = dayDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
                day.classList.add('available');
            }

            // Add click event
            day.addEventListener('click', () => {
                if (!day.classList.contains('disabled')) {
                    // Remove selected from all days
                    document.querySelectorAll('.calendar-day.selected').forEach(d => {
                        d.classList.remove('selected');
                    });

                    // Add selected to clicked day
                    day.classList.add('selected');

                    // Update selected date
                    selectedDate = new Date(year, month, i);

                    // Native date input value must be YYYY-MM-DD
                    const y = selectedDate.getFullYear();
                    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const d = String(selectedDate.getDate()).padStart(2, '0');
                    selectedDateInput.value = `${y}-${m}-${d}`;

                    // Clear selected time
                    selectedTimeSlot = null;
                    selectedTimeInput.value = '';
                    updateTimeSlots();
                }
            });

            calendarDays.appendChild(day);
        }

        // Next month days (to fill the grid)
        const totalCells = 42; // 6 rows * 7 columns
        const nextDays = totalCells - (firstDayIndex + daysInMonth);

        for (let i = 1; i <= nextDays; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day disabled';
            day.textContent = i;
            calendarDays.appendChild(day);
        }
    }

    // Generate Time Slots
    function generateTimeSlots() {
        timeSlotsGrid.innerHTML = '';

        timeSlots.forEach(slot => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'time-slot-btn';
            button.textContent = slot;

            // Mark as disabled if it's past the current time for today
            if (selectedDate) {
                const today = new Date();
                if (selectedDate.toDateString() === today.toDateString()) {
                    const slotTime = getTimeFromString(slot);
                    if (slotTime < today.getHours() * 60 + today.getMinutes()) {
                        button.classList.add('disabled');
                    }
                }
            }

            // Mark as selected if it matches the selected time
            if (selectedTimeSlot === slot) {
                button.classList.add('selected');
            }

            button.addEventListener('click', () => {
                if (!button.classList.contains('disabled')) {
                    // Remove selected from all time slots
                    document.querySelectorAll('.time-slot-btn.selected').forEach(btn => {
                        btn.classList.remove('selected');
                    });

                    // Add selected to clicked time slot
                    button.classList.add('selected');
                    selectedTimeSlot = slot;
                    selectedTimeInput.value = slot;
                }
            });

            timeSlotsGrid.appendChild(button);
        });
    }

    // Helper function to convert time string to minutes
    function getTimeFromString(timeString) {
        const [time, modifier] = timeString.split(' ');
        let [hours, minutes] = time.split(':');

        hours = parseInt(hours);
        minutes = minutes ? parseInt(minutes) : 0;

        if (modifier === 'PM' && hours < 12) {
            hours += 12;
        }
        if (modifier === 'AM' && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    }

    // Update time slots when date changes
    function updateTimeSlots() {
        generateTimeSlots();
    }

    // View appointment details
    function viewAppointmentDetails(appointmentId) {
        // Find the appointment card
        const appointmentCard = document.querySelector(`.appointment-card[data-id="${appointmentId}"]`);
        if (appointmentCard) {
            const date = appointmentCard.querySelector('.appointment-card-date').textContent;
            const doctor = appointmentCard.querySelector('.appointment-card-detail:nth-child(1) span').textContent;
            const type = appointmentCard.querySelector('.appointment-card-detail:nth-child(2) span').textContent;
            const reason = appointmentCard.querySelector('.appointment-card-reason span').textContent;
            const status = appointmentCard.querySelector('.status-badge').textContent;

            alert(`Appointment Details:\n\nID: ${appointmentId}\nDate: ${date}\nDoctor: ${doctor}\nType: ${type}\nStatus: ${status}\nReason: ${reason}`);
        }
    }

    // Update an appointment
    function updateAppointment(appointmentId) {
        // Find the appointment card
        const appointmentCard = document.querySelector(`.appointment-card[data-id="${appointmentId}"]`);
        if (appointmentCard) {
            // Set form to edit mode
            isEditingAppointment = true;
            editingAppointmentId = appointmentId;

            // Update form title
            formTitle.textContent = 'Update Appointment';

            // Update submit button text
            submitBookingBtn.innerHTML = '<i class="fas fa-save"></i> Update Appointment';

            // Get appointment data
            const dateText = appointmentCard.querySelector('.appointment-card-date').textContent;
            const doctor = appointmentCard.querySelector('.appointment-card-detail:nth-child(1) span').textContent;
            const type = appointmentCard.querySelector('.appointment-card-detail:nth-child(2) span').textContent;
            const reason = appointmentCard.querySelector('.appointment-card-reason span').textContent;

            // Parse date from text (format: "January 25, 2025 • 10:00 AM")
            const dateParts = dateText.split('•')[0].trim();
            selectedDate = new Date(dateParts);

            // Parse time from text
            const timeParts = dateText.split('•')[1].trim();
            selectedTimeSlot = timeParts;

            // Fill doctor select
            const doctorSelect = document.getElementById('doctorSelect');
            doctorSelect.value = appointmentCard.getAttribute('data-doctor-id');

            // Fill visit type
            const visitType = document.getElementById('visitType');
            const typeText = appointmentCard.querySelector('.appointment-card-detail:nth-child(2) span').textContent;
            for (let i = 0; i < visitType.options.length; i++) {
                if (visitType.options[i].text === typeText || visitType.options[i].value === typeText.toLowerCase().replace(' ', '_')) {
                    visitType.selectedIndex = i;
                    break;
                }
            }

            // Update calendar to show the appointment month
            currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            renderCalendar();

            // Update selected date input
            const y = selectedDate.getFullYear();
            const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const d = String(selectedDate.getDate()).padStart(2, '0');
            selectedDateInput.value = `${y}-${m}-${d}`;

            // Set time slot
            selectedTimeInput.value = selectedTimeSlot;
            updateTimeSlots();

            // Fill reason
            document.getElementById('reason').value = reason;

            // Scroll to booking form
            bookingSection.scrollIntoView({ behavior: 'smooth' });

            // Hide confirmation section if visible
            confirmationSection.style.display = 'none';
        }
    }

    // Cancel an appointment
    function cancelAppointment(appointmentId) {
        // Store appointment ID for modal
        cancelAppointmentId = appointmentId;

        // Find the appointment
        const appointmentCard = document.querySelector(`.appointment-card[data-id="${appointmentId}"]`);
        if (appointmentCard) {
            const doctor = appointmentCard.querySelector('.appointment-card-detail:nth-child(1) span').textContent;
            const date = appointmentCard.querySelector('.appointment-card-date').textContent;

            // Update modal message
            cancelMessage.textContent = `Are you sure you want to cancel appointment ${appointmentId} with ${doctor} on ${date}?`;

            // Show confirmation modal
            cancelModal.style.display = 'block';
        }
    }

    // Form Submission
    appointmentForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Validate form
        if (!selectedDate || !selectedTimeSlot) {
            alert('Please select a date and time for your appointment.');
            return;
        }

        const doctorId = document.getElementById('doctorSelect').value;
        const visitType = document.getElementById('visitType').value;
        const reason = document.getElementById('reason').value;

        if (!doctorId) {
            alert('Please select a doctor.');
            return;
        }

        const sy = selectedDate.getFullYear();
        const sm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const sd = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${sy}-${sm}-${sd}`;
        const timeStr = convertTo24Hour(selectedTimeSlot);

        const userData = JSON.parse(sessionStorage.getItem('user_data') || '{}');
        const payload = {
            doctor_id: doctorId,
            patient_id: userId,
            patient_name: userData.full_name || 'Patient',
            phone: userData.phone || null,
            email: userData.email || null,
            appointment_type: visitType,
            appointment_date: dateStr,
            appointment_time: timeStr,
            notes: reason,
            status: 'scheduled'
        };

        try {
            let res;
            if (isEditingAppointment && editingAppointmentId) {
                res = await fetch(`${API_BASE_URL}/appointments/${editingAppointmentId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch(`${API_BASE_URL}/appointments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to save appointment');
            }

            const result = await res.json();

            // Show success modal
            showSuccessModal(isEditingAppointment ? 'Appointment updated successfully!' : 'Appointment booked successfully!');

            // Reset form
            resetFormToBookingMode();

            // Refresh appointment lists
            loadAppointments();

            // Hide confirmation if it was showing
            confirmationSection.style.display = 'none';

        } catch (err) {
            console.error('Error saving appointment:', err);
            alert('Error saving appointment: ' + err.message);
        }
    });

    function convertTo24Hour(time12h) {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return `${String(hours).padStart(2, '0')}:${minutes || '00'}`;
    }

    // Load Doctors from API
    async function loadDoctors() {
        try {
            const res = await fetch(`${API_BASE_URL}/doctors`);
            if (!res.ok) return;
            const data = await res.json();
            const doctorSelect = document.getElementById('doctorSelect');

            // Keep the first option
            doctorSelect.innerHTML = '<option value="">Choose Doctor</option>';

            data.doctors.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `Dr. ${doc.full_name} (${doc.specialty || 'Cardiologist'})`;
                doctorSelect.appendChild(option);
            });
        } catch (err) {
            console.error('Error loading doctors:', err);
        }
    }

    // Load Appointments from API
    async function loadAppointments() {
        if (!userId) return;
        try {
            const res = await fetch(`${API_BASE_URL}/appointments?patient_id=${userId}`);
            if (!res.ok) return;
            const data = await res.json();

            const upcomingList = document.getElementById('upcomingAppointments');
            const pastList = document.getElementById('pastAppointments');

            upcomingList.innerHTML = '';
            pastList.innerHTML = '';

            // Sort appointments by date/time
            data.appointments.sort((a, b) => {
                const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
                const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
                return dateB - dateA; // Descending
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            data.appointments.forEach(app => {
                const appDate = new Date(app.appointment_date);
                const isPast = appDate < today || app.status === 'completed' || app.status === 'cancelled';

                const card = createAppointmentCard(app);
                if (isPast) {
                    pastList.appendChild(card);
                } else {
                    upcomingList.prepend(card); // Keep upcoming in ascending order for display
                }
            });

            if (upcomingList.children.length === 0) {
                upcomingList.innerHTML = '<p style="text-align:center;padding:24px;color:#9ca3af;">No upcoming appointments.</p>';
            }
            if (pastList.children.length === 0) {
                pastList.innerHTML = '<p style="text-align:center;padding:24px;color:#9ca3af;">No past appointments.</p>';
            }
        } catch (err) {
            console.error('Error loading appointments:', err);
        }
    }

    function createAppointmentCard(app) {
        const card = document.createElement('div');
        card.className = 'appointment-card';
        card.dataset.id = app.id;
        card.dataset.doctorId = app.doctor_id;

        const dateObj = new Date(app.appointment_date);
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const time12h = format12Hour(app.appointment_time);
        const statusClass = app.status ? app.status.toLowerCase() : 'scheduled';

        card.innerHTML = `
            <div class="appointment-card-header">
                <span class="appointment-card-id">APT-${app.id}</span>
                <span class="status-badge ${statusClass}">${app.status || 'Scheduled'}</span>
            </div>
            <div class="appointment-card-date">${formattedDate} • ${time12h}</div>
            
            <div class="appointment-card-details">
                <div class="appointment-card-detail">
                    <label>Doctor</label>
                    <span>Dr. ${app.doctor_name || 'TBD'}</span>
                </div>
                <div class="appointment-card-detail">
                    <label>Visit Type</label>
                    <span>${app.appointment_type || 'General'}</span>
                </div>
                <div class="appointment-card-detail">
                    <label>Duration</label>
                    <span>${app.duration || '30 minutes'}</span>
                </div>
            </div>
            
            <div class="appointment-card-reason">
                <label>Reason:</label>
                <span>${app.notes || 'No reason provided'}</span>
            </div>
            
            <div class="appointment-card-actions">
                ${statusClass === 'scheduled' ? `
                <button class="action-btn small cancel-appointment-btn" data-id="${app.id}">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
                <button class="action-btn small update-btn" data-id="${app.id}">
                    <i class="fas fa-edit"></i>
                    Update
                </button>
                ` : ''}
                <button class="action-btn small view-btn" data-id="${app.id}">
                    <i class="fas fa-eye"></i>
                    View
                </button>
            </div>
        `;
        return card;
    }

    function format12Hour(time24h) {
        if (!time24h) return 'N/A';
        const [hours, minutes] = time24h.split(':');
        let h = parseInt(hours, 10);
        const m = minutes || '00';
        const modifier = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${modifier}`;
    }

    // Cancel Booking button
    cancelBookingBtn.addEventListener('click', () => {
        if (isEditingAppointment) {
            // If editing, just reset to normal booking mode
            resetFormToBookingMode();
        } else {
            // If new booking, clear everything
            if (confirm('Are you sure you want to cancel this booking?')) {
                resetFormToBookingMode();
            }
        }
    });

    // Back to Booking button
    backToBookingBtn.addEventListener('click', () => {
        // Hide confirmation section
        confirmationSection.style.display = 'none';

        // Scroll to booking form
        bookingSection.scrollIntoView({ behavior: 'smooth' });
    });

    // View Appointments button
    viewAppointmentsBtn.addEventListener('click', () => {
        // Hide confirmation section
        confirmationSection.style.display = 'none';

        // Scroll to appointments section
        document.querySelector('.appointments-tabs').scrollIntoView({ behavior: 'smooth' });
    });

    // Reset form to normal booking mode
    function resetFormToBookingMode() {
        isEditingAppointment = false;
        editingAppointmentId = null;

        // Reset form title
        formTitle.textContent = 'Book New Appointment';

        // Reset submit button text
        submitBookingBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Confirm Booking';

        // Reset form
        appointmentForm.reset();
        selectedDate = null;
        selectedTimeSlot = null;
        selectedDateInput.value = '';
        selectedTimeInput.value = '';

        // Reset calendar selection
        document.querySelectorAll('.calendar-day.selected').forEach(day => {
            day.classList.remove('selected');
        });

        // Reset time slots selection
        document.querySelectorAll('.time-slot-btn.selected').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Reset to current month
        currentDate = new Date();
        currentDate.setDate(1); // Set to 1st to avoid rollover bugs
        renderCalendar();
        updateTimeSlots();
    }

    // Calendar navigation
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setDate(1); // Set to 1st to avoid rollover
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setDate(1); // Set to 1st to avoid rollover
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Modal Events
    closeSuccessModal.addEventListener('click', () => {
        successModal.style.display = 'none';
    });

    okBtn.addEventListener('click', () => {
        successModal.style.display = 'none';
    });

    closeCancelModal.addEventListener('click', () => {
        cancelModal.style.display = 'none';
        cancelAppointmentId = null;
    });

    cancelNoBtn.addEventListener('click', () => {
        cancelModal.style.display = 'none';
        cancelAppointmentId = null;
    });

    cancelYesBtn.addEventListener('click', async () => {
        if (cancelAppointmentId) {
            try {
                const res = await fetch(`${API_BASE_URL}/appointments/${cancelAppointmentId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'cancelled' })
                });

                if (res.ok) {
                    showSuccessModal('Appointment cancelled successfully!');
                    loadAppointments(); // Refresh list
                } else {
                    const err = await res.json();
                    alert('Error cancelling appointment: ' + err.message);
                }
            } catch (err) {
                console.error('Error cancelling appointment:', err);
            }
        }

        // Close modal
        cancelModal.style.display = 'none';
        cancelAppointmentId = null;
    });

    // Show Success Modal
    function showSuccessModal(message) {
        document.getElementById('successMessage').textContent = message;
        successModal.style.display = 'block';
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.style.display = 'none';
        }
        if (e.target === cancelModal) {
            cancelModal.style.display = 'none';
            cancelAppointmentId = null;
        }
    });

    // Load Patient Summary (Vitals & Risk)
    async function loadPatientSummary() {
        if (!userId) return;
        try {
            const patientRes = await fetch(`${API_BASE_URL}/patients/${userId}`);
            if (patientRes.ok) {
                const patient = await patientRes.json();
                const hrElement = document.querySelector('.risk-metric:nth-child(1) .metric-value');
                const bpElement = document.querySelector('.risk-metric:nth-child(2) .metric-value');
                const riskDescription = document.querySelector('.risk-description');
                const aiRecommendationText = document.getElementById('aiRecommendationText');

                if (patient.condition_text && riskDescription) {
                    riskDescription.textContent = patient.condition_text;
                }
                if (patient.condition_text && aiRecommendationText) {
                    aiRecommendationText.textContent = `Based on your condition: ${patient.condition_text}, please follow your doctor's advice.`;
                }

                const vitalsRes = await fetch(`${API_BASE_URL}/patients/${userId}/vitals`);
                if (vitalsRes.ok) {
                    const vitals = await vitalsRes.json();
                    if (vitals && vitals.heart_rate && hrElement) {
                        hrElement.textContent = `${vitals.heart_rate} bpm`;
                        hrElement.className = 'metric-value ' + (vitals.heart_rate > 100 || vitals.heart_rate < 60 ? 'high' : 'normal');
                    }
                    if (vitals && vitals.blood_pressure && bpElement) {
                        bpElement.textContent = vitals.blood_pressure;
                        const sys = parseInt(vitals.blood_pressure.split('/')[0]);
                        bpElement.className = 'metric-value ' + (sys > 140 ? 'high' : 'normal');
                    }
                }
            }
        } catch (err) {
            console.error('Error loading patient summary:', err);
        }
    }

    // Logout Functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to log out?')) {
                sessionStorage.clear();
                localStorage.removeItem('isLoggedIn');
                window.location.href = '../../auth/login.html';
            }
        });
    }

    // Initialize the page
    initCalendar();
});