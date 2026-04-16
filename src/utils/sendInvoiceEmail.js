// utils/sendInvoiceEmail.js
const { EmailClient } = require('@azure/communication-email');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.AZURE_EMAIL_CONNECTION_STRING;
const senderEmail = process.env.SENDER_EMAIL;

const sendInvoiceEmail = async (toEmail, customerName, orderId, invoicePath) => {
  const emailClient = new EmailClient(connectionString);

  const fileBuffer = fs.readFileSync(invoicePath);
  const fileName = path.basename(invoicePath);

  const emailMessage = {
    senderAddress: senderEmail,
    recipients: {
      to: [{ address: toEmail }],
    },
    content: {
      subject: `Invoice for your order #${orderId}`,
      plainText: `Hello ${customerName},\n\nThank you for your purchase! Please find your invoice attached.`,
      html: `<p>Hello ${customerName},</p><p>Thank you for your purchase! Please find your invoice attached.</p>`,
    },
    attachments: [
      {
        name: fileName,
        contentBytesBase64: fileBuffer.toString('base64'),
        contentType: 'application/pdf',
      },
    ],
  };

  const poller = await emailClient.beginSend(emailMessage);
  const result = await poller.pollUntilDone();

  return result.status;
};

module.exports = sendInvoiceEmail;
