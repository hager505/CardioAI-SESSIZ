function generateSerial(lastId) {

  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2,"0");

  const increment = String(lastId + 1).padStart(4,"0");

  return `#${year}${month}${increment}`;
}

export default generateSerial;