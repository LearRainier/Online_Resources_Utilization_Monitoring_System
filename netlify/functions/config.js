/**
 * Netlify Function: Returns Supabase config from environment variables
 * Called by frontend to get credentials securely
 * 
 * Environment variables set in Netlify dashboard:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 */

exports.handler = async (event, context) => {
  // Allow CORS for your domain
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Return 200 for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: 'ok'
    };
  }

  try {
    // Get credentials from Netlify environment variables
    const config = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_KEY: process.env.SUPABASE_KEY
    };

    // Verify both are set
    if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Supabase credentials not configured in Netlify environment variables'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(config)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to load config: ' + error.message
      })
    };
  }
};
