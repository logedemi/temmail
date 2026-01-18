const { createClient } = require('@supabase/supabase-js');
const MailParser = require('mailparser').MailParser;
const cheerio = require('cheerio');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Webhook secret untuk verifikasi
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

exports.handler = async function(event, context) {
  try {
    // Verify webhook secret
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const rawEmail = event.body;
    
    // Parse email dengan mailparser
    const mailparser = new MailParser();
    
    return new Promise((resolve, reject) => {
      mailparser.on('headers', headers => {
        console.log('Email headers:', headers.get('subject'));
      });
      
      mailparser.on('data', async data => {
        if (data.type === 'text') {
          const emailData = {
            from: data.from?.value[0]?.address || data.from?.text || 'unknown',
            to: data.to?.value[0]?.address || data.to?.text || 'unknown',
            subject: data.subject || 'No Subject',
            body_text: data.text || '',
            body_html: data.html || '',
            headers: data.headers,
            received_at: new Date().toISOString(),
            attachments: data.attachments || []
          };
          
          // Cek apakah email tujuan ada di database
          const { data: tempEmail, error } = await supabase
            .from('temp_emails')
            .select('*')
            .eq('email_address', emailData.to)
            .eq('is_active', true)
            .single();
          
          if (tempEmail && !error) {
            // Simpan email ke database
            const { error: insertError } = await supabase
              .from('incoming_emails')
              .insert({
                to_email: emailData.to,
                from_email: emailData.from,
                subject: emailData.subject,
                body_text: emailData.body_text,
                body_html: emailData.body_html,
                headers: JSON.stringify(emailData.headers),
                received_at: emailData.received_at,
                is_read: false
              });
            
            if (!insertError) {
              // Update email count
              await supabase
                .from('temp_emails')
                .update({ 
                  email_count: tempEmail.email_count + 1,
                  last_received: new Date().toISOString()
                })
                .eq('id', tempEmail.id);
            }
          }
        }
      });
      
      mailparser.on('end', () => {
        resolve({
          statusCode: 200,
          body: JSON.stringify({ success: true, message: 'Email processed' })
        });
      });
      
      mailparser.on('error', reject);
      
      // Write email to parser
      mailparser.write(rawEmail);
      mailparser.end();
    });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
