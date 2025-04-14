import formData from 'form-data';
import Mailgun from 'mailgun.js';



// Carga esto desde variables de entorno para seguridad.
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = 'dailypage.org'; // como lo configuraste en Mailgun

const mailgun = new Mailgun(formData);
const client = mailgun.client({ username: 'api', key: MAILGUN_API_KEY });

export async function sendEmail({ to, subject, html }) {
  try {
    await client.messages.create(MAILGUN_DOMAIN, {
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
