const crypto = require('crypto');

/**
 * Generates a random password.
 * @param {number} length - The desired length of the password.
 * @returns {string} The generated password.
 */
const generatePassword = (length = 12) => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex') // convert to hexadecimal format
    .slice(0, length); // return required number of characters
};

module.exports = generatePassword;