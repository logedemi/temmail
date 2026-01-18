const { createClient } = require('@supabase/supabase-js');
const sanitizeHtml = require('sanitize-html');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
    const { email, key, limit = 50, offset = 0 } = event.queryStringParameters;
    
    if (!email || !key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Email and API key are required'
        })
      };
    }
    
    // Verify email exists and key is valid
    const { data: emailData, error: emailError } = await supabase
      .from('temp_emails')
      .select('*')
      .eq('email_address', email)
      .eq('api_key', key)
      .eq('is_active', true)
      .single();
    
    if (emailError || !emailData) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or API key'
        })
      };
    }
    
    // Check if email has expired
    if (new Date(emailData.expires_at) < new Date()) {
      await supabase
        .from('temp_emails')
        .update({ is_active: false })
        .eq('id', emailData.id);
      
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Email has expired'
        })
      };
    }
    
    // Get emails for this address
    const { data: emails, error: emailsError } = await supabase
      .from('incoming_emails')
      .select('*')
      .eq('to_email', email)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (emailsError) throw emailsError;
    
    // Update last checked time
    await supabase
      .from('temp_emails')
      .update({ last_checked: new Date().toISOString() })
      .eq('id', emailData.id);
    
    // Sanitize HTML content
    const sanitizedEmails = emails.map(email => ({
      ...email,
      body_text: sanitizeHtml(email.body_text || '', {
        allowedTags: [],
        allowedAttributes: {}
      }),
      body_html: sanitizeHtml(email.body_html || '', {
        allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'a'],
        allowedAttributes: {
          'a': ['href', 'target']
        },
        allowedSchemes: ['http', 'https', 'mailto']
      })
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        email: emailData.email_address,
        total: sanitizedEmails.length,
        expires_at: emailData.expires_at,
        emails: sanitizedEmails,
        stats: {
          total_received: emailData.email_count,
          unread: sanitizedEmails.filter(e => !e.is_read).length
        }
      })
    };
    
  } catch (error) {
    console.error('Error checking email:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};
