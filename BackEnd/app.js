// app.js — CardioAI Server
import express  from "express";
import cors     from "cors";
import path     from "path";
import { fileURLToPath } from "url";
import { initDB } from "./config/db.js";

import patientsRouter       from "./routes/patientRoutes.js";
import doctorsRouter        from "./routes/doctorRoutes.js";
import recordsRoutes        from "./routes/recordsRoutes.js";
import medicationRoutes     from "./routes/medicationRoutes.js";      // separate file
import notificationRoutes   from "./routes/notificationRoutes.js";    // separate file
import appointmentRoutes    from "./routes/appointmentRoutes.js";     // ← NEW
import doctorRequestRoutes  from "./routes/doctorRequestRoutes.js";   // ← NEW

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/patients",        patientsRouter);
app.use("/api/doctors",         doctorsRouter);
app.use("/api/records",         recordsRoutes);
app.use("/api/medications",     medicationRoutes);
app.use("/api/notifications",   notificationRoutes);
app.use("/api/appointments",    appointmentRoutes);      // ← NEW
app.use("/api/doctor/requests", doctorRequestRoutes);   // ← NEW

// Init DB then start server
initDB()
  .then(() => {
    console.log("✅ DB initialized");
    app.listen(5000, () =>
      console.log("🚀 Server running on http://localhost:5000")
    );
  })
  .catch((err) => {
    console.error("❌ DB init failed:", err.message);
    process.exit(1);
  });