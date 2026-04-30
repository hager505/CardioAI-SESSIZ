import multer from "multer";
import path from "path";
import fs from "fs";

function makeStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = `uploads/${subfolder}`;
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  });
}

const allowedMimes = [
  "image/jpeg","image/jpg","image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function fileFilter(req, file, cb) {
  if (allowedMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG"), false);
}

const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB

// للمريض — ملف واحد
export const patientUpload = multer({
  storage: makeStorage("patients/prescriptions"),
  fileFilter, limits,
});

// للداكتور — ملفات متعددة
export const doctorUpload = multer({
  storage: makeStorage("doctors"),
  fileFilter, limits,
}).fields([
  { name: "medical_license",  maxCount: 1 },
  { name: "medical_documents", maxCount: 10 },
]);

export const recordUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/records/"),
    filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png|doc|docx/;
    cb(null, allowed.test(file.mimetype) || allowed.test(file.originalname));
  },
});

// default (للـ backward compatibility)
export default patientUpload;