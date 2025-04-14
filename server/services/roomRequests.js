import { sendEmail } from './mailgunService.js';

export async function handleRoomRequest(req, res) {
  const { roomName, roomTopic, roomDescription } = req.body;

  if (!roomName || !roomDescription) {
    return res.status(400).send('Room name and description are required.');
  }
  
  try {
    const emailBody = `
        <ul>
          <li>Room Name: ${roomName}</li>
          <li>Topic: ${roomTopic || 'No topic provided'}</li>
          <li>Description: ${roomDescription}</li>
        </ul>
      `
  
    await sendEmail({
      to: 'ask@dailypage.org',
      subject: `New Room Request: ${roomName}`,
      html: emailBody,
    });
    res.status(200).send('Your room request has been submitted successfully!');
  } catch (error) {
    console.error('Error sending room request email:', error);
    res.status(500).send('An error occurred while processing your request. Please try again later.');
  }
}
