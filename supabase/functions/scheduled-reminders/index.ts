import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TrainerAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  user_id: string;
  trainer_id: string;
  user_name: string;
  users: { id: string; name: string };
  fitness_trainers: { id: string; name: string };
}

async function getGoogleAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedToken = `${encode(header)}.${encode(claimSet)}`;

  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) =>
    c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${encodedSignature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(
      `Failed to get Google access token: ${JSON.stringify(tokenData)}`
    );
  }
  return tokenData.access_token;
}

async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  accessToken: string,
  projectId: string
): Promise<boolean> {
  if (!fcmToken) {
    console.log("No FCM token available");
    return false;
  }

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          android: { priority: "high" },
          notification: { title, body },
          data: { type: "appointment_reminder" },
        },
      }),
    }
  );

  return response.ok;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const serviceAccount = JSON.parse(
      Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!
    );
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const now = Date.now();

    // Calculate appointment dates for 1-day and 2-hour windows
    const oneDayFromNow = new Date(now + 24 * 60 * 60 * 1000);
    const twoHoursFromNow = new Date(now + 2 * 60 * 60 * 1000);

    const oneDayDateStr = oneDayFromNow.toISOString().split("T")[0];
    const twoHourDateStr = twoHoursFromNow.toISOString().split("T")[0];

    // 1-day before: appointments tomorrow
    const { data: oneDayAppts } = await supabase
      .from("trainer_appointments")
      .select(
        `
        id,
        appointment_date,
        start_time,
        user_id,
        trainer_id,
        user_name,
        users(id, name),
        fitness_trainers(id, name)
      `
      )
      .eq("appointment_date", oneDayDateStr);

    // 2-hours before: appointments today in ~2 hours
    const { data: twoHourAppts } = await supabase
      .from("trainer_appointments")
      .select(
        `
        id,
        appointment_date,
        start_time,
        user_id,
        trainer_id,
        user_name,
        users(id, name),
        fitness_trainers(id, name)
      `
      )
      .eq("appointment_date", twoHourDateStr);

    let sentCount = 0;

    // Process 1-day reminders
    for (const appt of oneDayAppts || []) {
      const apptTime = `${appt.appointment_date} ${appt.start_time}`;

      // Trainer notification
      const trainerAlreadySent = await supabase
        .from("appointment_notifications")
        .select("id")
        .eq("appointment_id", appt.id)
        .eq("notification_type", "1_day_before")
        .eq("recipient_type", "trainer")
        .maybeSingle();

      if (!trainerAlreadySent.data) {
        const { data: trainerToken } = await supabase
          .from("device_tokens")
          .select("fcm_token")
          .eq("trainer_id", appt.trainer_id)
          .maybeSingle();

        if (trainerToken?.fcm_token) {
          await sendFCMNotification(
            trainerToken.fcm_token,
            "Appointment Reminder",
            `You have a session with ${appt.users.name} in 1 day at ${appt.start_time}`,
            accessToken,
            projectId
          );
        }

        await supabase.from("appointment_notifications").insert({
          appointment_id: appt.id,
          notification_type: "1_day_before",
          recipient_type: "trainer",
        });
        sentCount++;
      }

      // User notification
      const userAlreadySent = await supabase
        .from("appointment_notifications")
        .select("id")
        .eq("appointment_id", appt.id)
        .eq("notification_type", "1_day_before")
        .eq("recipient_type", "user")
        .maybeSingle();

      if (!userAlreadySent.data) {
        const { data: userToken } = await supabase
          .from("device_tokens")
          .select("fcm_token")
          .eq("user_id", appt.user_id)
          .maybeSingle();

        if (userToken?.fcm_token) {
          await sendFCMNotification(
            userToken.fcm_token,
            "Appointment Reminder",
            `Your training session is in 1 day at ${appt.start_time}`,
            accessToken,
            projectId
          );
        }

        await supabase.from("appointment_notifications").insert({
          appointment_id: appt.id,
          notification_type: "1_day_before",
          recipient_type: "user",
        });
        sentCount++;
      }
    }

    // Process 2-hour reminders
    for (const appt of twoHourAppts || []) {
      // Trainer notification
      const trainerAlreadySent = await supabase
        .from("appointment_notifications")
        .select("id")
        .eq("appointment_id", appt.id)
        .eq("notification_type", "2_hours_before")
        .eq("recipient_type", "trainer")
        .maybeSingle();

      if (!trainerAlreadySent.data) {
        const { data: trainerToken } = await supabase
          .from("device_tokens")
          .select("fcm_token")
          .eq("trainer_id", appt.trainer_id)
          .maybeSingle();

        if (trainerToken?.fcm_token) {
          await sendFCMNotification(
            trainerToken.fcm_token,
            "Upcoming Session",
            `Your session with ${appt.users.name} starts in 2 hours`,
            accessToken,
            projectId
          );
        }

        await supabase.from("appointment_notifications").insert({
          appointment_id: appt.id,
          notification_type: "2_hours_before",
          recipient_type: "trainer",
        });
        sentCount++;
      }

      // User notification
      const userAlreadySent = await supabase
        .from("appointment_notifications")
        .select("id")
        .eq("appointment_id", appt.id)
        .eq("notification_type", "2_hours_before")
        .eq("recipient_type", "user")
        .maybeSingle();

      if (!userAlreadySent.data) {
        const { data: userToken } = await supabase
          .from("device_tokens")
          .select("fcm_token")
          .eq("user_id", appt.user_id)
          .maybeSingle();

        if (userToken?.fcm_token) {
          await sendFCMNotification(
            userToken.fcm_token,
            "Upcoming Session",
            `Your training session starts in 2 hours`,
            accessToken,
            projectId
          );
        }

        await supabase.from("appointment_notifications").insert({
          appointment_id: appt.id,
          notification_type: "2_hours_before",
          recipient_type: "user",
        });
        sentCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        oneDayCount: oneDayAppts?.length || 0,
        twoHourCount: twoHourAppts?.length || 0,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Scheduled reminders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});