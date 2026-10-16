/**
 * Netlify Function: Checks the admin password on the server
 * so it never appears in the public page code
 *
 * Environment variable set in Netlify dashboard:
 * - ADMIN_PASSWORD
 */

const crypto = require('crypto');

// Hash both sides so they are the same length for a constant-time compare
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest();

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const expected = (process.env.ADMIN_PASSWORD || '').trim();
  if (!expected) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Admin password is not set up yet (ADMIN_PASSWORD in Netlify environment variables).' })
    };
  }

  let password = '';
  try {
    password = String(JSON.parse(event.body || '{}').password || '').trim();
  } catch (e) {
    // Malformed body counts as a wrong password
  }

  const ok = crypto.timingSafeEqual(sha256(password), sha256(expected));
  // Slow down repeated guessing
  if (!ok) await new Promise(r => setTimeout(r, 800));

  return { statusCode: ok ? 200 : 401, headers, body: JSON.stringify({ ok }) };
};
