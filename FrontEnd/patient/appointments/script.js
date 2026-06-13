// patient/appointments/script.js
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
    const appointmentTabs = document.querySelectorAll('.tab');
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
        '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
        '11:00 AM', '11:30 AM', '12:00 PM',
        '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
        '04:00 PM', '04:30 PM', '05:00 PM'
    ];

    const API_BASE_URL = 'http://localhost:5000/api';
    const BACKEND_ORIGIN = 'http://localhost:5000';
    const userId = sessionStorage.getItem('user_id');
    const userRole = sessionStorage.getItem('user_role');
    const userDataRaw = sessionStorage.getItem('user_data');

    if (!userId || !userDataRaw || userRole !== 'patient') {
        window.location.href = '../../auth/login.html';
        return;
    }

    // Cache of the patient's appointments, refreshed by loadAppointments().
    // Keyed by ISO date (YYYY-MM-DD) → array of appointment objects so the
    // calendar can quickly look up which days have bookings.
    let appointmentsByDate = new Map();

    // Doctor avatar helpers (mirrors the doctor's-dashboard pattern).
    // We pre-compute a stable per-doctor fallback URL keyed by doctor id
    // so the same doctor always shows the same colour/initials.
    const doctorAvatarFallbacks = new Map();
    const AVATAR_BG_COLORS = ['1a56db', '10b981', 'ef4444', 'f59e0b', '1c8a8e', '6b7280'];

    function getInitials(name) {
        if (!name) return 'DR';
        const parts = String(name).trim().replace(/^Dr\.?\s*/i, '').split(/\s+/);
        const first = (parts[0]?.[0] || 'D').toUpperCase();
        const second = (parts[1]?.[0] || parts[0]?.[1] || 'R').toUpperCase();
        return first + second;
    }

    // Build a fallback ui-avatars URL for a doctor. We mirror the doctor's
    // dashboard helper (avatarUrl) but scope the cache per doctor id so
    // repeated appointments with the same doctor don't rebuild the URL.
    function doctorAvatarFallbackUrl(name, doctorId) {
        const id = String(doctorId ?? '0');
        if (doctorAvatarFallbacks.has(id)) return doctorAvatarFallbacks.get(id);
        const bg = AVATAR_BG_COLORS[parseInt(doctorId, 10) % AVATAR_BG_COLORS.length] || AVATAR_BG_COLORS[0];
        const initials = getInitials(name);
        const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bg}&color=fff&size=128&bold=true`;
        doctorAvatarFallbacks.set(id, url);
        return url;
    }

    // Resolve the doctor_avatar_url that comes back from the API. The
    // backend stores values like `uploads/doctors/avatars/foo.jpg`, so
    // a relative URL has to be promoted to an absolute backend URL.
    function resolveDoctorPhoto(app) {
        const raw = app?.doctor_avatar_url;
        if (!raw) return null;
        if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
        if (raw.startsWith('/')) return BACKEND_ORIGIN + raw;
        return BACKEND_ORIGIN + '/' + raw;
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

        // When the doctor changes, refresh time slots so booked ones for the new doctor
        // are correctly disabled.
        const doctorSelectEl = document.getElementById('doctorSelect');
        if (doctorSelectEl) {
            doctorSelectEl.addEventListener('change', () => {
                selectedTimeSlot = null;
                selectedTimeInput.value = '';
                updateTimeSlots();
            });
        }
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
        today.setHours(0, 0, 0, 0);
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;

            // Create date object for this day
            const dayDate = new Date(year, month, i);
            dayDate.setHours(0, 0, 0, 0);

            // ISO key for appointments lookup
            const isoKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
            const isBooked = appointmentsByDate.has(isoKey);

            // Past days are dimmed
            if (dayDate < today) {
                day.classList.add('past');
            }

            // Mark today
            if (dayDate.getTime() === today.getTime()) {
                day.classList.add('today');
            }

            // Mark booked days
            if (isBooked) {
                day.classList.add('has-appointment');
            }

            // Mark selected date
            if (selectedDate && dayDate.toDateString() === selectedDate.toDateString()) {
                day.classList.add('selected');
            }

            // Add click event
            day.addEventListener('click', () => {
                if (day.classList.contains('past')) return; // can't book in the past
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

        // Build a set of already-booked times for the selected date+doctor.
        const selectedDoctorId = document.getElementById('doctorSelect')?.value;
        const isoKey = selectedDate
            ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
            : null;
        const bookedSlots = new Set();
        if (isoKey && appointmentsByDate.has(isoKey)) {
            for (const ap of appointmentsByDate.get(isoKey)) {
                if (ap.status === 'cancelled') continue;
                if (selectedDoctorId && String(ap.doctor_id) !== String(selectedDoctorId)) continue;
                if (ap.appointment_time) {
                    // Normalise "HH:MM" or "HH:MM:SS" to 24h HH:MM, then to 12h for comparison
                    const mins = getMinutesFrom24(ap.appointment_time);
                    bookedSlots.add(mins);
                }
            }
        }

        timeSlots.forEach(slot => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'time-slot-btn';
            button.textContent = slot;

            const slotMins = getTimeFromString(slot);
            const isBooked = bookedSlots.has(slotMins);

            // Mark as disabled if it's past the current time for today
            if (selectedDate) {
                const today = new Date();
                if (selectedDate.toDateString() === today.toDateString()) {
                    if (slotMins < today.getHours() * 60 + today.getMinutes()) {
                        button.classList.add('disabled');
                    }
                }
            }

            // Disable booked slots
            if (isBooked) {
                button.classList.add('disabled');
                button.classList.add('booked');
                button.title = 'This slot is already booked';
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

    // Convert "HH:MM" or "HH:MM:SS" 24h to minutes since midnight
    function getMinutesFrom24(time24) {
        if (!time24) return -1;
        const parts = String(time24).split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
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
            cancelModal.classList.add('active');
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

            // Push a notification record so it shows up in the notifications page.
            if (!isEditingAppointment) {
              const doctorName = document.getElementById('doctorSelect')?.selectedOptions[0]?.text || 'your doctor';
              try {
                await fetch(`${API_BASE_URL}/notifications`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    patient_id: parseInt(userId, 10),
                    title: 'Appointment Booked',
                    message: `Your appointment with ${doctorName} on ${dateStr} at ${timeStr} has been confirmed.`,
                  }),
                });
                window.NotificationCount?.refresh();
              } catch (_) { /* non-blocking */ }
            }

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
            // Use the dedicated patient-scope endpoint so we get joined
            // doctor_name / doctor_phone / doctor_specialty as well.
            const res = await fetch(`${API_BASE_URL}/patients/${userId}/appointments`);
            if (!res.ok) {
                console.error('loadAppointments: HTTP', res.status);
                renderEmptyLists();
                return;
            }
            const data = await res.json();
            const appointments = data.appointments || data.data || [];

            // Rebuild the per-day map so the calendar can show booking dots
            appointmentsByDate = new Map();
            for (const ap of appointments) {
                if (!ap.appointment_date) continue;
                const key = String(ap.appointment_date).split('T')[0];
                if (!appointmentsByDate.has(key)) appointmentsByDate.set(key, []);
                appointmentsByDate.get(key).push(ap);
            }

            const upcomingList = document.getElementById('upcomingAppointments');
            const pastList = document.getElementById('pastAppointments');

            upcomingList.innerHTML = '';
            pastList.innerHTML = '';

            // Sort appointments by date/time (ascending)
            appointments.sort((a, b) => {
                const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
                const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
                return dateA - dateB;
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            appointments.forEach(app => {
                const appDate = new Date(app.appointment_date);
                const isPast = appDate < today || app.status === 'completed' || app.status === 'cancelled';

                const card = createAppointmentCard(app);
                if (isPast) {
                    pastList.appendChild(card);
                } else {
                    upcomingList.appendChild(card);
                }
            });

            if (upcomingList.children.length === 0) {
                upcomingList.innerHTML = '<p style="text-align:center;padding:24px;color:#9ca3af;">No upcoming appointments.</p>';
            }
            if (pastList.children.length === 0) {
                pastList.innerHTML = '<p style="text-align:center;padding:24px;color:#9ca3af;">No past appointments.</p>';
            }

            // Refresh the calendar so booked days get their indicator
            renderCalendar();
        } catch (err) {
            console.error('Error loading appointments:', err);
            renderEmptyLists();
        }
    }

    function renderEmptyLists() {
        const upcomingList = document.getElementById('upcomingAppointments');
        const pastList = document.getElementById('pastAppointments');
        if (upcomingList) upcomingList.innerHTML = '<p style="text-align:center;padding:24px;color:#9ca3af;">Could not load appointments.</p>';
        if (pastList)     pastList.innerHTML     = '<p style="text-align:center;padding:24px;color:#9ca3af;">Could not load appointments.</p>';
    }

    function createAppointmentCard(app) {
        const card = document.createElement('div');
        card.className = `appointment-card status-${(app.status || 'scheduled').toLowerCase()}`;
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
        const doctorName = app.doctor_name ? `Dr. ${app.doctor_name}` : 'Doctor TBD';
        const doctorInitials = getInitials(app.doctor_name);
        const specialty = app.doctor_specialty || app.appointment_type || 'General';
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        let dayTag = '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateObj.getTime() === today.getTime())       dayTag = '<span class="ap-day-tag today">Today</span>';
        else if (dateObj.getTime() === tomorrow.getTime()) dayTag = '<span class="ap-day-tag tomorrow">Tomorrow</span>';

        // Build the doctor avatar block. The img is hidden by default
        // (the .has-photo class swaps which child is visible once the
        // photo loads); the onerror handler swaps the source to a stable
        // ui-avatars.com fallback so a doctor without a stored photo
        // still gets a pretty coloured initials badge.
        const photoUrl = resolveDoctorPhoto(app);
        const fallbackUrl = doctorAvatarFallbackUrl(app.doctor_name, app.doctor_id);
        const avatarHtml = photoUrl
            ? `<img class="ap-avatar-img" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(doctorName)}" onerror="this.onerror=null;this.src='${escapeHtml(fallbackUrl)}';">`
            : '';
        const hasPhoto = Boolean(photoUrl);

        card.innerHTML = `
            <div class="appointment-card-header">
                <div class="ap-doctor">
                    <div class="ap-doctor-avatar${hasPhoto ? ' has-photo' : ''}">
                        ${avatarHtml}
                        <span class="ap-avatar-initials">${escapeHtml(doctorInitials)}</span>
                    </div>
                    <div>
                        <div class="ap-doctor-name">${escapeHtml(doctorName)}</div>
                        <div class="ap-doctor-spec">${escapeHtml(specialty)}</div>
                    </div>
                </div>
                <div class="ap-header-right">
                    ${dayTag}
                    <span class="status-badge ${statusClass}">${app.status || 'Scheduled'}</span>
                </div>
            </div>

            <div class="appointment-card-date">
                <i class="far fa-calendar"></i>
                ${formattedDate}
                <span class="ap-dot">•</span>
                <i class="far fa-clock"></i>
                ${time12h}
            </div>

            <div class="appointment-card-details">
                <div class="appointment-card-detail">
                    <label>Type</label>
                    <span>${escapeHtml(app.appointment_type || 'General')}</span>
                </div>
                <div class="appointment-card-detail">
                    <label>Duration</label>
                    <span>${escapeHtml(app.duration || '30 minutes')}</span>
                </div>
                <div class="appointment-card-detail">
                    <label>Doctor Phone</label>
                    <span>${escapeHtml(app.doctor_phone || '—')}</span>
                </div>
            </div>

            ${app.notes ? `
            <div class="appointment-card-reason">
                <label>Reason</label>
                <span>${escapeHtml(app.notes)}</span>
            </div>` : ''}

            <div class="appointment-card-actions">
                ${statusClass === 'scheduled' ? `
                <button class="action-btn small cancel-appointment-btn" data-id="${app.id}">
                    <i class="fas fa-times"></i> Cancel
                </button>
                <button class="action-btn small update-btn" data-id="${app.id}">
                    <i class="fas fa-edit"></i> Update
                </button>` : ''}
                <button class="action-btn small view-btn" data-id="${app.id}">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        `;
        return card;
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
        successModal.classList.remove('active');
    });

    okBtn.addEventListener('click', () => {
        successModal.classList.remove('active');
    });

    closeCancelModal.addEventListener('click', () => {
        cancelModal.classList.remove('active');
        cancelAppointmentId = null;
    });

    cancelNoBtn.addEventListener('click', () => {
        cancelModal.classList.remove('active');
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
                    // Push a notification so the change shows up in the notification center
                    try {
                      const ap = Array.from(appointmentsByDate.values())
                        .flat()
                        .find(a => String(a.id) === String(cancelAppointmentId));
                      const docName = ap ? `Dr. ${ap.doctor_name || 'your doctor'}` : 'your doctor';
                      const when    = ap ? `${ap.appointment_date} at ${ap.appointment_time?.slice(0, 5) || ''}` : '';
                      await fetch(`${API_BASE_URL}/notifications`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          patient_id: parseInt(userId, 10),
                          title: 'Appointment Cancelled',
                          message: `Your appointment with ${docName}${when ? ` (${when})` : ''} has been cancelled.`,
                        }),
                      });
                      window.NotificationCount?.refresh();
                    } catch (_) { /* non-blocking */ }

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
        cancelModal.classList.remove('active');
        cancelAppointmentId = null;
    });

    // Show Success Modal
    function showSuccessModal(message) {
        document.getElementById('successMessage').textContent = message;
        successModal.classList.add('active');
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.classList.remove('active');
        }
        if (e.target === cancelModal) {
            cancelModal.classList.remove('active');
            cancelAppointmentId = null;
        }
    });

    // Load Patient Summary (Vitals & Risk)
    async function loadPatientSummary() {
        if (!userId) return;
        try {
            const [patient, vitals] = await Promise.all([
                fetch(`${API_BASE_URL}/patients/${userId}`).then(r => r.ok ? r.json() : null),
                fetch(`${API_BASE_URL}/patients/${userId}/vitals`).then(r => r.ok ? r.json() : null),
            ]);

            const hrElement = document.querySelector('.risk-metric:nth-child(1) .metric-value');
            const bpElement = document.querySelector('.risk-metric:nth-child(2) .metric-value');
            const riskStatus = document.getElementById('riskStatus');
            const riskDescription = document.querySelector('.risk-description');
            const aiRecommendationText = document.getElementById('aiRecommendationText');
            const aiInsightText = document.getElementById('aiInsightText');

            // Helper: threshold-based risk assessment
            function updateFromThreshold(hr, bpSys) {
                let riskLabel = 'NORMAL', riskColor = '#10b981';
                let desc, rec;
                if (hr > 120 || bpSys > 160) { riskLabel = 'CRITICAL'; riskColor = '#991b1b'; desc = 'Critical vitals detected. Seek immediate medical attention.'; rec = 'Please visit the emergency room or call for urgent care.'; }
                else if (hr > 100 || bpSys > 140) { riskLabel = 'HIGH'; riskColor = '#ef4444'; desc = 'Elevated vitals detected. Monitoring advised.'; rec = 'Consider scheduling an earlier appointment for further evaluation.'; }
                else if (hr < 60) { riskLabel = 'LOW'; riskColor = '#f59e0b'; desc = 'Low heart rate detected. Please consult your doctor.'; rec = 'Schedule a check-up to evaluate your heart rate.'; }
                else { desc = 'Your vitals appear within normal ranges.'; rec = 'Regular monitoring is recommended every 2 weeks.'; }
                if (riskStatus) riskStatus.innerHTML = `<span class="badge" style="background:${riskColor};color:#fff;">${riskLabel}</span>`;
                if (riskDescription) riskDescription.textContent = desc;
                if (aiRecommendationText) aiRecommendationText.textContent = rec;
                if (aiInsightText) aiInsightText.textContent = rec;
            }

            // Update vitals display from DB
            if (vitals) {
                if (vitals.heart_rate && hrElement) {
                    hrElement.textContent = `${vitals.heart_rate} bpm`;
                    hrElement.className = 'metric-value ' + (vitals.heart_rate > 100 || vitals.heart_rate < 60 ? 'high' : 'normal');
                }
                if (vitals.blood_pressure && bpElement) {
                    bpElement.textContent = vitals.blood_pressure;
                    const sys = parseInt(vitals.blood_pressure.split('/')[0]);
                    bpElement.className = 'metric-value ' + (sys > 140 ? 'high' : 'normal');
                }
            }

            // Run AI analysis on vitals
            if (vitals && (vitals.heart_rate || vitals.blood_pressure)) {
                try {
                    const [sys, dia] = (vitals.blood_pressure || '0/0').split('/').map(Number);
                    const aiRes = await fetch(`${API_BASE_URL}/predict/vitals`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            heart_rate: vitals.heart_rate || 0,
                            blood_pressure_systolic: sys || 0,
                            blood_pressure_diastolic: dia || 0,
                            temperature: vitals.body_temperature || 0,
                            respiratory_rate: vitals.respiratory_rate || 0,
                            oxygen_saturation: vitals.spo2 || 0,
                            bmi: vitals.bmi || 0,
                        }),
                    });
                    if (aiRes.ok) {
                        const aiData = await aiRes.json();
                        const riskLevel = aiData.risk_level || aiData.risk || 'unknown';
                        const riskColor = aiData.risk_color || '#6b7280';
                        const riskLabel = (riskLevel || '').toUpperCase();

                        if (riskStatus) {
                            riskStatus.innerHTML = `<span class="badge" style="background:${riskColor};color:#fff;">${riskLabel}</span>`;
                        }
                        if (riskDescription) {
                            riskDescription.textContent = aiData.message_en || `Risk assessment: ${riskLabel}`;
                        }
                        const recText = aiData.recommendation_en || 'Please consult with your healthcare provider for personalized advice.';
                        if (aiRecommendationText) {
                            aiRecommendationText.textContent = recText;
                        }
                        if (aiInsightText) {
                            aiInsightText.textContent = recText;
                        }
                        return;
                    } else {
                        // Model rejected the data — parse the error details
                        const errBody = await aiRes.json().catch(() => ({}));
                        console.error('Vitals model error response:', errBody);
                        const rawError = errBody.error || '';
                        const fieldNames = { blood_pressure_systolic: 'Systolic BP', blood_pressure_diastolic: 'Diastolic BP', heart_rate: 'Heart Rate', temperature: 'Temperature', respiratory_rate: 'Respiratory Rate', oxygen_saturation: 'Oxygen Saturation', bmi: 'BMI' };
                        let detailMsg = '';
                        // Strategy 1: details field (new backend forwards raw model JSON)
                        if (errBody.details) {
                            try {
                                const parsed = typeof errBody.details === 'string' ? JSON.parse(errBody.details) : errBody.details;
                                const items = parsed.detail || [];
                                if (Array.isArray(items)) {
                                    detailMsg = items.map(d => {
                                        const field = d.loc?.slice(-1)[0] || '';
                                        const label = fieldNames[field] || field;
                                        return `• ${label}: ${d.msg}`;
                                    }).join('\n');
                                } else if (typeof items === 'string') {
                                    detailMsg = `• ${items}`;
                                }
                            } catch {}
                        }
                        // Strategy 2: extract JSON with "detail" from error string
                        if (!detailMsg) {
                            const detailMatch = rawError.match(/(\{.*"detail".*\})/s);
                            if (detailMatch) {
                                try {
                                    const parsed = JSON.parse(detailMatch[1]);
                                    const items = parsed.detail || [];
                                    if (Array.isArray(items)) {
                                        detailMsg = items.map(d => {
                                            const field = d.loc?.slice(-1)[0] || '';
                                            const label = fieldNames[field] || field;
                                            return `• ${label}: ${d.msg}`;
                                        }).join('\n');
                                    } else if (typeof items === 'string') {
                                        detailMsg = `• ${items}`;
                                    }
                                } catch {}
                            }
                        }
                        // Strategy 3: check for error/message keys in errBody
                        if (!detailMsg) {
                            const errText = errBody.error || errBody.message || errBody.detail || '';
                            const clean = typeof errText === 'string' ? errText.replace(/^\d{3}\s*-\s*/, '') : '';
                            if (clean) detailMsg = `• ${clean}`;
                        }
                        // Strategy 4: search for "impossible" or key phrases in rawError
                        if (!detailMsg && rawError.includes('impossible')) {
                            const phraseMatch = rawError.match(/Input data is medically impossible[^]*$/);
                            if (phraseMatch) detailMsg = `• ${phraseMatch[0]}`;
                        }
                        const summary = detailMsg
                            ? 'Please correct the following values:\n' + detailMsg
                            : 'Please correct the following values.';
                        if (riskDescription) riskDescription.textContent = summary;
                        if (aiRecommendationText) aiRecommendationText.textContent = summary;
                        if (aiInsightText) aiInsightText.textContent = summary;
                        if (riskStatus) riskStatus.innerHTML = '<span class="badge badge-danger">INVALID DATA</span>';
                        return;
                    }
                } catch (aiErr) {
                    console.error('AI analysis error:', aiErr);
                }
                // Fallback to threshold assessment if AI fails
                const sysNum = parseInt((vitals.blood_pressure || '0').split('/')[0]);
                const hrNum = vitals.heart_rate || 0;
                updateFromThreshold(hrNum, sysNum);
            } else if (vitals) {
                // Vitals exist but partial — still run threshold
                const sysNum = parseInt((vitals.blood_pressure || '0').split('/')[0]);
                const hrNum = vitals.heart_rate || 0;
                updateFromThreshold(hrNum, sysNum);
            } else {
                // No vitals in DB at all
                if (riskDescription) riskDescription.textContent = 'No vitals recorded yet. Visit your profile to add your vital signs.';
                if (riskStatus) riskStatus.innerHTML = `<span class="badge badge-secondary">NO DATA</span>`;
            }

            // Fallback: update from patient condition_text
            if (patient && patient.condition_text) {
                if (riskDescription && riskDescription.textContent === 'No vitals recorded yet. Visit your profile to add your vital signs.') {
                    riskDescription.textContent = patient.condition_text;
                }
                if (aiRecommendationText) {
                    aiRecommendationText.textContent = `Based on your condition: ${patient.condition_text}, please follow your doctor's advice.`;
                }
                if (aiInsightText) {
                    aiInsightText.textContent = aiRecommendationText?.textContent || 'Please follow your doctor\'s advice.';
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
            if (typeof AuthManager !== 'undefined' && AuthManager.handleLogout) {
                AuthManager.handleLogout();
            } else {
                sessionStorage.clear();
                localStorage.removeItem('isLoggedIn');
                window.location.href = '../../auth/login.html';
            }
        });
    }

    // Initialize the page
    initCalendar();
});