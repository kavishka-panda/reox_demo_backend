// utils/validators.js

const isValidDate = (dateStr) => {
    if (!dateStr) return true; // null/undefined allowed
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date) && date.toISOString().startsWith(dateStr);
};

const isValidPositiveInt = (val) => {
    if (val === undefined || val === null || val === '') return true;
    const num = Number(val);
    return Number.isInteger(num) && num > 0;
};

const isValidLimit = (val, max = 100) => {
    if (val === undefined || val === null || val === '') return true;
    const num = Number(val);
    return Number.isInteger(num) && num >= 1 && num <= max;
};

module.exports = {
  isValidDate,
  isValidPositiveInt,
  isValidLimit
};