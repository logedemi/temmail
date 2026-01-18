const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Domain temporary email (gunakan domain Netlify Anda)
const TEMP_DOMAIN = process.env.TEMP_DOMAIN || "your-temp-email.netlify.app";
const SITE_URL = process.env.URL || "https://your-site.netlify.app";

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { username, password, expiresIn = 24 } = data;
    
    // Generate random username jika tidak disediakan
    const emailUsername = username || generateRandomUsername();
    const emailAddress = `${emailUsername}@${TEMP_DOMAIN}`;
    
    // Hash password jika ada
    let passwordHash = null;
    if (password) {
      passwordHash = crypto.createHash('sha256').update(password).update(process.env.SECRET_SALT || 'default-salt').digest('hex');
    }
    
    // Calculate expiration time (default 24 jam)
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
    
    // Generate API key untuk email ini
    const apiKey = uuidv4();
    
    // Save to database
    const { data: emailData, error } = await supabase
      .from('temp_emails')
      .insert({
        email_address: emailAddress,
        username: emailUsername,
        password_hash: passwordHash,
        api_key: apiKey,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        email_count: 0,
        last_checked: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Generate access links
    const dashboardLink = `${SITE_URL}/dashboard.html?email=${encodeURIComponent(emailAddress)}&key=${apiKey}`;
    const apiEndpoint = `${SITE_URL}/api/check-email?email=${encodeURIComponent(emailAddress)}&key=${apiKey}`;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        email: emailAddress,
        api_key: apiKey,
        dashboard_link: dashboardLink,
        api_endpoint: apiEndpoint,
        expires_at: expiresAt.toISOString(),
        qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(dashboardLink)}`,
        instructions: {
          check_email: `GET ${apiEndpoint}`,
          delete_email: `DELETE ${SITE_URL}/api/delete-email?email=${encodeURIComponent(emailAddress)}&key=${apiKey}`,
          send_email: `POST ${SITE_URL}/api/send-email dengan body {to: "${emailAddress}", subject: "...", body: "..."}`
        }
      })
    };
    
  } catch (error) {
    console.error('Error creating email:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

function generateRandomUsername() {
  const adjectives = ['quick', 'lazy', 'happy', 'sleepy', 'noisy', 'hungry', 'brave', 'calm'];
  const nouns = ['fox', 'dog', 'cat', 'bird', 'fish', 'lion', 'tiger', 'bear'];
  const randomNum = Math.floor(Math.random() * 1000);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}_${noun}_${randomNum}`;
}
