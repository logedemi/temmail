const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Configure nodemailer dengan SendGrid atau SMTP lain
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASSWORD
  }
});

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { from_email, to, subject, body, api_key } = data;
    
    if (!from_email || !to || !subject || !body || !api_key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields'
        })
      };
    }
    
    // Verify the from email belongs to the API key
    const { data: emailData, error } = await supabase
      .from('temp_emails')
      .select('*')
      .eq('email_address', from_email)
      .eq('api_key', api_key)
      .eq('is_active', true)
      .single();
    
    if (error || !emailData) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or API key'
        })
      };
    }
    
    // Send email
    const mailOptions = {
      from: `"Temporary Email" <${from_email}>`,
      to: to,
      subject: subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
              <p>${body.replace(/\n/g, '<br>')}</p>
              <hr>
              <small>Sent from temporary email service</small>
            </div>`
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    // Log sent email
    await supabase
      .from('sent_emails')
      .insert({
        from_email: from_email,
        to_email: to,
        subject: subject,
        body: body,
        sent_at: new Date().toISOString(),
        message_id: info.messageId
      });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        message_id: info.messageId
      })
    };
    
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to send email'
      })
    };
  }
};
