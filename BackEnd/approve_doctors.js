import db from "./config/db.js";

async function approveDoctors() {
    try {
        const [result] = await db.query("UPDATE doctors SET status = 'approved' WHERE status = 'pending'");
        console.log(`✅ Approved ${result.affectedRows} pending doctors`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

approveDoctors();
