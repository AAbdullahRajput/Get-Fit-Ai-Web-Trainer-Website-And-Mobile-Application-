const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase Admin client with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/generate-token', async (req, res) => {
  try {
    const { channelName } = req.body;

    if (!channelName) {
      return res.status(400).json({ error: 'channelName is required' });
    }

    console.log(`📞 [AGORA] Generating token for channel: ${channelName}`);

    // Call Supabase Edge Function using service role (server-side)
    const { data, error } = await supabaseAdmin.functions.invoke(
      'generate-agora-token',
      {
        body: { channelName },
        headers: {
          'x-internal-secret': process.env.INTERNAL_API_SECRET
        }
      }
    );

    if (error) {
      console.error('❌ [AGORA] Token generation error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data?.token) {
      console.error('❌ [AGORA] Invalid token response:', data);
      return res.status(500).json({ error: 'Invalid token response' });
    }

    console.log(`✅ [AGORA] Token generated | uid=${data.uid}`);
    res.json(data);
  } catch (err) {
    console.error('❌ [AGORA] ERROR generating token:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;