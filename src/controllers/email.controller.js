const fs = require('fs');
const path = require('path');
const { EmailClient } = require('@azure/communication-email');

// Load template and replace placeholders
const loadTemplate = (templateName) => {
  const filePath = path.join(__dirname, '../templates', `${templateName}.html`);
  return fs.readFileSync(filePath, 'utf8');
};

const renderTemplate = (template, data) => {
  return Object.keys(data).reduce((html, key) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    return html.replace(placeholder, data[key]);
  }, template);
};

// Initialize Email Client
const connectionString = process.env.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING;
const client = new EmailClient(connectionString);

// Send Email Function

const sendEmail = async (to, subject, templateName, data) => {
  try {
    const template = loadTemplate(templateName);
    const htmlContent = renderTemplate(template, data);

    const emailMessage = {
      senderAddress: process.env.EMAIL_FROM,
      content: {
        subject: subject,
        plainText: 'Your email client does not support HTML messages.',
        html: htmlContent
      },
      recipients: {
        to: [
          {
            address: to
          }
        ]
      }
    };

    const poller = await client.beginSend(emailMessage);
    const result = await poller.pollUntilDone();

    console.log(' Email sent:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw error;
  }
};

module.exports = {
  sendEmail
};
