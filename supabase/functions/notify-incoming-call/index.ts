import { createClient } from 'jsr:@supabase/supabase-js@2'

interface CallSessionRecord {
  id: string
  trainer_id: string
  user_id: string
  caller_user_id: string
  channel_name: string
  initiated_by: string
  status: string
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: CallSessionRecord
  old_record: CallSessionRecord | null
}

async function getGoogleAccessToken(serviceAccount: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const unsignedToken = `${encode(header)}.${encode(claimSet)}`

  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  )

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const jwt = `${unsignedToken}.${encodedSignature}`

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const tokenData = await tokenResponse.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()
    const record = payload.record

    if (record.status !== 'ringing' || record.initiated_by !== 'user') {
      return new Response(JSON.stringify({ skipped: true, reason: 'not a ringing user-initiated call' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: tokenRow } = await supabase
      .from('device_tokens')
      .select('fcm_token')
      .eq('trainer_id', record.trainer_id)
      .maybeSingle()

    if (!tokenRow) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no device token for trainer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: caller } = await supabase
      .from('users')
      .select('username')
      .eq('id', record.caller_user_id)
      .maybeSingle()

    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
    const accessToken = await getGoogleAccessToken(serviceAccount)

    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: tokenRow.fcm_token,
            android: { priority: 'high' },
            data: {
              type: 'incoming_call',
              call_id: record.id,
              channel_name: record.channel_name,
              caller_name: caller?.username ?? 'Someone',
            },
          },
        }),
      }
    )

    const fcmResult = await fcmResponse.json()

    return new Response(JSON.stringify({ sent: true, fcmResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-incoming-call error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})