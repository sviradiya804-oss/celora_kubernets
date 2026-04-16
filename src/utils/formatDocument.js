const formatDocument = (doc) => {
  const formatted = { ...doc };

  // Convert _id to string
  if (formatted._id) {
    formatted._id = formatted._id.toString();
  }

  // Format date fields
  ["createdOn", "updatedOn", "subscribedAt"].forEach((field) => {
    if (formatted[field] instanceof Date) {
      formatted[field] = formatted[field].toISOString().replace("T", " ").split(".")[0];
    }
  });

  // Remove __v
  delete formatted.__v;

  return formatted;
};

module.exports = formatDocument;
