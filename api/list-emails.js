const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const ADMIN_KEY = process.env.ADMIN_KEY;

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { admin_key, limit = 100, offset = 0 } = event.queryStringParameters;
    
    if (!admin_key || admin_key !== ADMIN_KEY) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Unauthorized'
        })
      };
    }
    
    const { data: emails, error, count } = await supabase
      .from('temp_emails')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: count,
        emails: emails.map(email => ({
          email_address: email.email_address,
          created_at: email.created_at,
          expires_at: email.expires_at,
          is_active: email.is_active,
          email_count: email.email_count,
          last_checked: email.last_checked
        }))
      })
    };
    
  } catch (error) {
    console.error('Error listing emails:', error);
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
