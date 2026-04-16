/**
 * ID Generator Utility
 * Generate short, unique IDs for orders and sub-orders
 * Format: 8 random alphanumeric + 4 timestamp digits = 12 chars total
 * Example: ABC12XYZ3456
 */

/**
 * Generate a short unique ID
 * @returns {string} 12-character unique ID (8 random chars + 4 timestamp digits)
 */
function generateShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from({ length: 8 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  const timestamp = Date.now().toString().slice(-4);
  return `${random}${timestamp}`;
}

/**
 * Generate order ID
 * @returns {string} Short unique order ID (12 chars)
 */
function generateOrderId() {
  return generateShortId();
}

/**
 * Generate sub-order ID
 * @returns {string} Short unique sub-order ID (12 chars)
 */
function generateSubOrderId() {
  return generateShortId();
}

module.exports = {
  generateShortId,
  generateOrderId,
  generateSubOrderId
};
