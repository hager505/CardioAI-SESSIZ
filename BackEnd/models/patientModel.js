import  db  from "../config/db.js";

export const getAllPatients = async () => {

  const [rows] = await db(
    "SELECT * FROM patients ORDER BY created_at DESC"
  );

  return rows;
};

export const getPatientById = async (id) => {

  const [rows] = await db(
    "SELECT * FROM patients WHERE id=?",
    [id]
  );

  return rows[0];
};



export const createPatientModel = async (data) => {

  const query = `
  INSERT INTO patients
  (serial,full_name,national_id,phone,email,password_hash,agreed_terms)
  VALUES (?,?,?,?,?,?,?)
  `;

  const [result] = await db(query,[
    data.serial,
    data.full_name,
    data.national_id,
    data.phone,
    data.email,
    data.password_hash,
    data.agreed_terms
  ]);

  return result.insertId;
};
