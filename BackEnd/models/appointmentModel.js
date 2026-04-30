import db from "../config/db";

const createAppointment = async(data)=>{

 const query = `
 INSERT INTO appointments
 (patient_id,doctor_id,appointment_date,appointment_time,reason_for_visit,status)
 VALUES (?,?,?,?,?,?)
 `;

 const [result] = await db.query(query,[
  data.patient_id,
  data.doctor_id,
  data.appointment_date,
  data.appointment_time,
  data.reason_for_visit,
  "scheduled"
 ]);

 return result.insertId;
};

export default {createAppointment};