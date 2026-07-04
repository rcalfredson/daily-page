import formData from 'form-data';
import Mailgun from 'mailgun.js';



const MAILGUN_DOMAIN = 'dailypage.org'; // como lo configuraste en Mailgun

let client;

function getClient() {
  if (client) return client;
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey) throw new Error('MAILGUN_API_KEY is not configured.');
  const mailgun = new Mailgun(formData);
  client = mailgun.client({ username: 'api', key: apiKey });
  return client;
}

export async function sendEmail({ to, subject, html }) {
  try {
    await getClient().messages.create(MAILGUN_DOMAIN, {
      from: `Daily Page <noreply@${MAILGUN_DOMAIN}>`,
      to,
      subject,
      html,
    });
    console.log(`Correo enviado a ${to}`);
  } catch (error) {
    console.error('Error al enviar correo:', error);
    throw error;
  }
}
