import { EmailParams } from '@/types/email.types';
import FormData from 'form-data';
// const FormData = require('form-data');
import Mailgun from 'mailgun.js';

export async function sendEmail({ to, subject, text }: EmailParams) {
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const mailgunApiKey = process.env.MAILGUN_API_KEY;

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: 'api',
    key: mailgunApiKey!,
  });

  const messageData = {
    from: `Idea Vault <noreply@${mailgunDomain}>`,
    to,
    subject,
    text,
  };

  try {
    const data = await mg.messages.create(mailgunDomain!, messageData);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}