require('dotenv').config();
const path = require('path');

// Import the sendEmail function
const { sendEmail } = require(path.join(__dirname, '../controllers/email.controller'));

// Email details
const to = "vatsalmangukiya9003@gmail.com";
const subject = "Welcome to Azure Email Service!";
const templateName = "otp"; // corresponds to welcome.html inside templates folder
const data = {
  name: "Vatsal",
  appname: "Your App Name",
  otp : "12015",
  year : "2012"
};

// Call the function
sendEmail(to, subject, templateName, data)
  .then(() => console.log("Email sent successfully!"))
  .catch((err) => console.error("Error:", err.message));
