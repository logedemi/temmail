const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const { email, key } = event.queryStringParameters;
    
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
    
    // Verify and delete
    const { data, error } = await supabase
      .from('temp_emails')
      .update({ 
        is_active: false,
        deleted_at: new Date().toISOString()
      })
      .eq('email_address', email)
      .eq('api_key', key)
      .select();
    
    if (error || data.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or API key'
        })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email address deleted successfully'
      })
    };
    
  } catch (error) {
    console.error('Error deleting email:', error);
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
