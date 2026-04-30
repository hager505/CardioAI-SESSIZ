// Patient Search script
const API = "http://localhost:5000/api";

function avatarUrl(name, bg = "003785") {
    const parts = (name ?? "X").trim().split(/\s+/);
    const f = encodeURIComponent((parts[0]?.[0] ?? "X").toUpperCase());
    const l = encodeURIComponent((parts[1]?.[0] ?? parts[0]?.[1] ?? "X").toUpperCase());
    return `https://ui-avatars.com/api/?name=${f}+${l}&background=${bg}&color=fff&size=128&bold=true`;
}

document.addEventListener("DOMContentLoaded", async () => {
    const raw = sessionStorage.getItem("user_data");
    if (!raw) {
        window.location.href = "../../../auth/login.html";
        return;
    }
    let user;
    try { user = JSON.parse(raw); } catch (e) { return; }

    // 1. Setup Doctor Pill
    const namePill = document.getElementById("doctorNamePill");
    if (namePill) namePill.textContent = user.full_name || "Doctor";

    const avatarPill = document.getElementById("doctorAvatarPill");
    if (avatarPill) {
        const photo = user.avatar_url || localStorage.getItem(`avatar_${user.id}`) || avatarUrl(user.full_name);
        avatarPill.src = photo;
    }

    // 2. Fetch Patients Data
    try {
        const res = await fetch(`${API}/patients`);
        if (res.ok) {
            const data = await res.json();
            window.patients = (data.patients || []).map(p => ({
                name: p.full_name,
                id: p.serial || `P-${p.id}`,
                phone: p.phone,
                status: "Active", // For demonstration
                gender: p.gender,
                lastVisit: p.created_at ? p.created_at.split("T")[0] : "Unknown"
            }));
            if (typeof performSearch === "function") performSearch();
        }
    } catch (e) { console.error("Could not fetch patients:", e); }
});