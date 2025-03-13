import sgMail from '@sendgrid/mail';

// Email structure interface
export interface EmailOptions {
  html: string;
  text: string;
  subject: string;
  from: {
    name: string;
    email: string;
  };
  to: Array<{
    name: string;
    email: string;
  }>;
  bcc?: Array<{
    name: string;
    email: string;
  }>;
}

// Response type
export interface SendGridResponse {
  is_error?: boolean;
  message?: string;
}

/**
 * Send an email using SendGrid
 * 
 * @param apiKey SendGrid API key
 * @param email Email options to send
 * @returns Promise that resolves with response
 */
export function sendEmail(
  apiKey: string,
  email: EmailOptions
): Promise<SendGridResponse> {
  return new Promise((resolve, reject) => {
    try {
      // Set the API key
      sgMail.setApiKey(apiKey);
      
      // Convert our email format to SendGrid format
      const msg = {
        to: email.to.map(recipient => ({
          email: recipient.email,
          name: recipient.name
        })),
        from: {
          email: email.from.email,
          name: email.from.name
        },
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.bcc ? {
          bcc: email.bcc.map(recipient => ({
            email: recipient.email,
            name: recipient.name
          }))
        } : {})
      };
      
      // Send the email
      sgMail.send(msg)
        .then(() => {
          console.log('Email sent successfully via SendGrid');
          resolve({
            is_error: false,
            message: 'Email sent successfully'
          });
        })
        .catch((error) => {
          console.error('Error sending email via SendGrid:', error);
          reject({
            is_error: true,
            message: error.message || 'Failed to send email via SendGrid'
          });
        });
    } catch (error) {
      console.error('Error initializing SendGrid:', error);
      reject({
        is_error: true,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
} 