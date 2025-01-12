import nodemailer from 'nodemailer';

import { config } from '../../config/config.js';

export async function handleRoomRequest(req, res) {
  const { roomName, roomTopic, roomDescription } = req.body;

  if (!roomName || !roomDescription) {
    return res.status(400).send('Room name and description are required.');
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: config.emailUser,
        pass: config.emailPass,
      },
    });
  
    const mailOptions = {
      from: config.emailUser,
      to: 'ask@dailypage.org',
      subject: `New Room Request: ${roomName}`,
      text: `
        Room Name: ${roomName}
        Topic: ${roomTopic || 'No topic provided'}
        Description: ${roomDescription}
      `,
    };
  
    await transporter.sendMail(mailOptions);
    res.status(200).send('Your room request has been submitted successfully!');
  } catch (error) {
    console.error('Error sending room request email:', error);
    res.status(500).send('An error occurred while processing your request. Please try again later.');
  }
}
