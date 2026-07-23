const { supabaseAuth, supabaseDb } = require('../config/supabase');

// GET /api/slots
const getSlots = async (req, res) => {
  try {
    const { trainer_id, date } = req.query;

    if (trainer_id && date) {
      // 1. Client dynamic slot query for a specific date
      // A. Check if slots already exist for this date and trainer (e.g., booked ones)
      const { data: existingSlots, error: existError } = await supabaseDb
        .from('trainer_slots')
        .select('*')
        .eq('trainer_id', trainer_id)
        .eq('slot_date', date);

      if (existError) {
        console.error('getSlots check existing error:', existError);
        return res.status(500).json({ error: 'DB query failed' });
      }

      // B. Determine weekday of the selected date
      const targetDate = new Date(`${date}T00:00:00`);
      const dayIndex = targetDate.getDay(); // 0 is Sunday, 1 is Monday, etc.

      // Map dayIndex to reference template week date (1970-01-05 Mon to 1970-01-11 Sun)
      const WEEKDAYS_MAP = {
        1: '1970-01-05', // Mon
        2: '1970-01-06', // Tue
        3: '1970-01-07', // Wed
        4: '1970-01-08', // Thu
        5: '1970-01-09', // Fri
        6: '1970-01-10', // Sat
        0: '1970-01-11'  // Sun
      };
      const referenceDate = WEEKDAYS_MAP[dayIndex];

      // C. Load active template slots for this trainer and weekday from 1970 template
      const { data: templates, error: templateError } = await supabaseDb
        .from('trainer_slots')
        .select('*')
        .eq('trainer_id', trainer_id)
        .eq('slot_date', referenceDate)
        .eq('is_active', true)
        .eq('status', 'available');

      if (templateError) {
        console.error('getSlots load templates error:', templateError);
        return res.status(500).json({ error: 'DB query failed' });
      }

      // Filter out times that are already booked for this date in DB
      const bookedStartTimes = new Set(
        existingSlots
          .filter(s => s.status === 'booked')
          .map(s => s.start_time.substring(0, 5))
      );

      // D. Generate the available slots dynamically in memory (no DB write)
      if (templates && templates.length > 0) {
        const slots = templates
          .filter(t => !bookedStartTimes.has(t.start_time.substring(0, 5)))
          .map(t => ({
            id: `virtual_${trainer_id}_${date}_${t.start_time.replace(/:/g, '')}`,
            trainer_id,
            slot_date: date,
            start_time: t.start_time,
            end_time: t.end_time,
            price: parseFloat(t.price),
            status: 'available',
            is_active: true,
            virtual: true
          }))
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        return res.status(200).json({ slots });
      }

      return res.status(200).json({ slots: [] });
    }

    // 2. Traditional Trainer query (requires auth token)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { data: slots, error: dbError } = await supabaseDb
      .from('trainer_slots')
      .select('*')
      .eq('trainer_id', user.id)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (dbError) {
      console.error('getSlots DB error:', dbError);
      return res.status(500).json({ error: 'Failed to fetch slots: ' + dbError.message });
    }

    return res.status(200).json({ slots });
  } catch (err) {
    console.error('getSlots unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/slots
const createSlot = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    const isArray = Array.isArray(req.body);
    const slotsData = isArray ? req.body : [req.body];

    if (slotsData.length === 0) {
      return res.status(400).json({ error: 'No slot data provided' });
    }

    for (const item of slotsData) {
      if (!item.slot_date || !item.start_time || !item.end_time) {
        return res.status(400).json({ error: 'Date, start time, and end time are required' });
      }
    }

    const newSlots = slotsData.map(item => ({
      trainer_id: user.id,
      slot_date: item.slot_date,
      start_time: item.start_time,
      end_time: item.end_time,
      price: item.price ? parseFloat(item.price) : 48.00,
      status: item.status || 'available',
      is_active: item.is_active !== undefined ? item.is_active : true
    }));

    if (isArray) {
      // 1. Fetch existing slots for these dates to filter out duplicates in application code
      const dates = [...new Set(newSlots.map(s => s.slot_date))];
      const { data: existingSlots, error: fetchError } = await supabaseDb
        .from('trainer_slots')
        .select('slot_date, start_time')
        .eq('trainer_id', user.id)
        .in('slot_date', dates);

      if (fetchError) {
        console.error('createSlot DB fetch error:', fetchError);
        return res.status(500).json({ error: 'Failed to verify existing slots: ' + fetchError.message });
      }

      const existingKeys = new Set(
        existingSlots.map(s => `${s.slot_date}_${s.start_time.substring(0, 5)}`)
      );

      const slotsToInsert = newSlots.filter(s => {
        const key = `${s.slot_date}_${s.start_time.substring(0, 5)}`;
        return !existingKeys.has(key);
      });

      if (slotsToInsert.length === 0) {
        return res.status(201).json({ slots: [] });
      }

      const { data: slots, error: dbError } = await supabaseDb
        .from('trainer_slots')
        .insert(slotsToInsert)
        .select();

      if (dbError) {
        console.error('createSlot DB bulk error:', dbError);
        return res.status(500).json({ error: 'Failed to create slots: ' + dbError.message });
      }

      return res.status(201).json({ slots: slots || [] });
    } else {
      const singleSlot = newSlots[0];
      // 2. Fetch single slot to check for existing record
      const { data: existing, error: checkError } = await supabaseDb
        .from('trainer_slots')
        .select('*')
        .eq('trainer_id', user.id)
        .eq('slot_date', singleSlot.slot_date)
        .eq('start_time', singleSlot.start_time);

      if (checkError) {
        console.error('createSlot single check error:', checkError);
        return res.status(500).json({ error: 'Failed to verify slot: ' + checkError.message });
      }

      if (existing && existing.length > 0) {
        return res.status(201).json({ slot: existing[0] });
      }

      const { data: slot, error: dbError } = await supabaseDb
        .from('trainer_slots')
        .insert(singleSlot)
        .select()
        .single();

      if (dbError) {
        console.error('createSlot DB error:', dbError);
        return res.status(500).json({ error: 'Failed to create slot: ' + dbError.message });
      }

      return res.status(201).json({ slot });
    }
  } catch (err) {
    console.error('createSlot unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/slots/:id
const updateSlot = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { id } = req.params;
    const updates = { ...req.body };

    // Prevent overriding trainer_id and booked_by columns for security
    delete updates.trainer_id;
    delete updates.booked_by_user_id;
    delete updates.booked_by_name;
    delete updates.booked_by_email;
    delete updates.id;

    if (updates.price) {
      updates.price = parseFloat(updates.price);
    }

    const { data: slot, error: dbError } = await supabaseDb
      .from('trainer_slots')
      .update(updates)
      .eq('id', id)
      .eq('trainer_id', user.id)
      .select()
      .single();

    if (dbError) {
      console.error('updateSlot DB error:', dbError);
      return res.status(500).json({ error: 'Failed to update slot: ' + dbError.message });
    }

    return res.status(200).json({ slot });
  } catch (err) {
    console.error('updateSlot unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/slots/:id
const deleteSlot = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { id } = req.params;

    const { error: dbError } = await supabaseDb
      .from('trainer_slots')
      .delete()
      .eq('id', id)
      .eq('trainer_id', user.id);

    if (dbError) {
      console.error('deleteSlot DB error:', dbError);
      return res.status(500).json({ error: 'Failed to delete slot: ' + dbError.message });
    }

    return res.status(200).json({ message: 'Slot deleted successfully' });
  } catch (err) {
    console.error('deleteSlot unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/slots/clients
const getClients = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // 1. Fetch appointments that are booked/confirmed with this trainer from trainer_appointments
    const { data: appointments, error: dbError } = await supabaseDb
      .from('trainer_appointments')
      .select('*')
      .eq('trainer_id', user.id)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (dbError) {
      console.error('getClients DB error:', dbError);
      return res.status(500).json({ error: 'Failed to fetch appointments: ' + dbError.message });
    }

    // Extract unique user_id values
    const userIds = [...new Set(appointments.map(a => a.user_id).filter(Boolean))];

    // 2. Fetch user profile data from public.users table (for avatars and mobile number)
    let usersMap = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseDb
        .from('users')
        .select('id, username, email, mobile_no, avatar_url')
        .in('id', userIds);

      if (usersError) {
        console.error('getClients users DB error:', usersError);
      } else if (users) {
        users.forEach(u => {
          usersMap[u.id] = u;
        });
      }
    }

    // 3. Aggregate appointments by client
    const clientsMap = {};
    appointments.forEach(appt => {
      const clientId = appt.user_id || appt.user_email || 'unknown';
      if (clientId === 'unknown') return;

      if (!clientsMap[clientId]) {
        const userProfile = appt.user_id ? (usersMap[appt.user_id] || {}) : {};
        clientsMap[clientId] = {
          id: appt.user_id || null,
          name: appt.user_name || userProfile.username || 'Client',
          email: appt.user_email || userProfile.email || '',
          mobile_no: userProfile.mobile_no || 'N/A',
          avatar_url: userProfile.avatar_url || '',
          booked_slots: []
        };
      }

      clientsMap[clientId].booked_slots.push({
        id: appt.id,
        slot_date: appt.appointment_date,
        start_time: appt.start_time,
        end_time: appt.end_time,
        price: appt.price,
        status: appt.status
      });
    });

    const clients = Object.values(clientsMap);

    return res.status(200).json({ clients });
  } catch (err) {
    console.error('getClients unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/slots/book
// Public endpoint - books a slot for a given trainer+date+time.
// If the slot doesn't yet exist in DB (virtual), it creates it first then marks it booked.
const bookSlot = async (req, res) => {
  try {
    const { trainer_id, date, start_time, end_time, price, name, email } = req.body;

    if (!trainer_id || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'trainer_id, date, start_time, and end_time are required' });
    }

    // Step 1: Check if this slot already exists in DB for this date
    const { data: existing, error: existError } = await supabaseDb
      .from('trainer_slots')
      .select('*')
      .eq('trainer_id', trainer_id)
      .eq('slot_date', date)
      .eq('start_time', start_time)
      .single();

    if (existError && existError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('bookSlot check existing error:', existError);
      return res.status(500).json({ error: 'DB query failed' });
    }

    if (existing) {
      // Slot exists — check if already booked
      if (existing.status === 'booked') {
        return res.status(409).json({ error: 'This slot is already booked' });
      }
      if (!existing.is_active) {
        return res.status(409).json({ error: 'This slot is not available' });
      }

      // Mark existing slot as booked
      const { data: bookedSlot, error: updateError } = await supabaseDb
        .from('trainer_slots')
        .update({
          status: 'booked',
          is_active: false
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('bookSlot update error:', updateError);
        return res.status(500).json({ error: 'Failed to book slot: ' + updateError.message });
      }

      // Create appointment record in trainer_appointments
      let clientUserId = null;
      if (email) {
        const { data: userProfile } = await supabaseDb
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (userProfile) clientUserId = userProfile.id;
      }

      const { error: apptError } = await supabaseDb
        .from('trainer_appointments')
        .insert({
          slot_id: bookedSlot.id,
          trainer_id,
          user_id: clientUserId,
          appointment_date: date,
          start_time,
          end_time,
          user_name: name || 'Client',
          user_email: email || '',
          price: parseFloat(price || bookedSlot.price),
          status: 'confirmed'
        });

      if (apptError) {
        console.error('bookSlot appt insert error:', apptError);
      }

      return res.status(200).json({ slot: bookedSlot, created: false });
    }

    // Step 2: Slot doesn't exist — verify the trainer has this hour open in their template
    const parsedDate = new Date(`${date}T00:00:00`);
    const dayIndex = parsedDate.getDay();
    const WEEKDAYS_MAP = { 1: '1970-01-05', 2: '1970-01-06', 3: '1970-01-07', 4: '1970-01-08', 5: '1970-01-09', 6: '1970-01-10', 0: '1970-01-11' };
    const referenceDate = WEEKDAYS_MAP[dayIndex];

    const { data: template, error: templateError } = await supabaseDb
      .from('trainer_slots')
      .select('*')
      .eq('trainer_id', trainer_id)
      .eq('slot_date', referenceDate)
      .eq('start_time', start_time)
      .eq('is_active', true)
      .eq('status', 'available')
      .single();

    if (templateError || !template) {
      return res.status(404).json({ error: 'This time slot is not available for this trainer' });
    }

    // Step 3: Insert the slot directly as booked (atomic — no need to create then update)
    const { data: newBookedSlot, error: insertError } = await supabaseDb
      .from('trainer_slots')
      .insert({
        trainer_id,
        slot_date: date,
        start_time,
        end_time: end_time || template.end_time,
        price: price ? parseFloat(price) : parseFloat(template.price),
        status: 'booked',
        is_active: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('bookSlot insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create booking: ' + insertError.message });
    }

    // Create appointment record in trainer_appointments
    let clientUserId = null;
    if (email) {
      const { data: userProfile } = await supabaseDb
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (userProfile) clientUserId = userProfile.id;
    }

    const { error: apptError } = await supabaseDb
      .from('trainer_appointments')
      .insert({
        slot_id: newBookedSlot.id,
        trainer_id,
        user_id: clientUserId,
        appointment_date: date,
        start_time,
        end_time: end_time || template.end_time,
        user_name: name || 'Client',
        user_email: email || '',
        price: parseFloat(price || newBookedSlot.price),
        status: 'confirmed'
      });

    if (apptError) {
      console.error('bookSlot appt insert error:', apptError);
    }

    return res.status(201).json({ slot: newBookedSlot, created: true });
  } catch (err) {
    console.error('bookSlot unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/slots/available?trainer_id=X&date=YYYY-MM-DD
// Public endpoint for client apps (Flutter) - generates slots on the fly from weekly template rules
const getAvailableSlots = async (req, res) => {
  try {
    const { trainer_id, date } = req.query;

    if (!trainer_id || !date) {
      return res.status(400).json({ error: 'trainer_id and date are required query parameters' });
    }

    // Validate date format
    const parsedDate = new Date(`${date}T00:00:00`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Step 1: Check if real slots already exist for this date (already generated from a prior request)
    const { data: realDateSlots, error: realError } = await supabaseDb
      .from('trainer_slots')
      .select('*')
      .eq('trainer_id', trainer_id)
      .eq('slot_date', date);

    if (realError) {
      console.error('getAvailableSlots check error:', realError);
      return res.status(500).json({ error: 'DB query failed' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentSeconds = String(now.getSeconds()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}:${currentSeconds}`;

    // If real slots exist for this date, return only available ones
    if (realDateSlots && realDateSlots.length > 0) {
      let available = realDateSlots
        .filter(s => s.status === 'available' && s.is_active === true);

      // Filter out slots that have already passed today
      if (date === todayStr) {
        available = available.filter(s => s.start_time > currentTimeStr);
      }

      available.sort((a, b) => a.start_time.localeCompare(b.start_time));
      return res.status(200).json({ slots: available, date, generated: false });
    }

    // Step 2: Determine weekday and map to template reference date (1970-01-05 Mon to 1970-01-11 Sun)
    const dayIndex = parsedDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const WEEKDAYS_MAP = {
      1: '1970-01-05', // Mon
      2: '1970-01-06', // Tue
      3: '1970-01-07', // Wed
      4: '1970-01-08', // Thu
      5: '1970-01-09', // Fri
      6: '1970-01-10', // Sat
      0: '1970-01-11'  // Sun
    };
    const referenceDate = WEEKDAYS_MAP[dayIndex];

    // Step 3: Load active template slots for this trainer and weekday
    const { data: templates, error: templateError } = await supabaseDb
      .from('trainer_slots')
      .select('*')
      .eq('trainer_id', trainer_id)
      .eq('slot_date', referenceDate)
      .eq('is_active', true)
      .eq('status', 'available');

    if (templateError) {
      console.error('getAvailableSlots template error:', templateError);
      return res.status(500).json({ error: 'DB query failed' });
    }

    if (!templates || templates.length === 0) {
      return res.status(200).json({ slots: [], date, generated: true, message: 'No availability configured for this day' });
    }

    // Step 4: Build virtual slot objects for the requested date (DO NOT insert into DB yet)
    // Slots are only persisted when a booking is actually made
    let virtualSlots = templates.map((t, index) => ({
      id: `virtual_${trainer_id}_${date}_${t.start_time.replace(':', '')}`,
      trainer_id,
      slot_date: date,
      start_time: t.start_time,
      end_time: t.end_time,
      price: parseFloat(t.price),
      status: 'available',
      is_active: true,
      virtual: true // flag to indicate this is not yet in DB
    }));

    // Filter out slots that have already passed today
    if (date === todayStr) {
      virtualSlots = virtualSlots.filter(s => s.start_time > currentTimeStr);
    }

    virtualSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    return res.status(200).json({ slots: virtualSlots, date, generated: true });
  } catch (err) {
    console.error('getAvailableSlots unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/slots/toggle-day
const toggleDaySlots = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { slot_date, is_active, active_times } = req.body;
    if (!slot_date) {
      return res.status(400).json({ error: 'slot_date is required' });
    }

    let updatedSlots;
    if (!is_active) {
      // Deactivate all slots for this day
      const { data, error: dbError } = await supabaseDb
        .from('trainer_slots')
        .update({ is_active: false })
        .eq('slot_date', slot_date)
        .eq('trainer_id', user.id)
        .select();

      if (dbError) {
        console.error('toggleDaySlots DB error:', dbError);
        return res.status(500).json({ error: 'Failed to deactivate slots: ' + dbError.message });
      }
      updatedSlots = data;
    } else {
      if (Array.isArray(active_times)) {
        // Deactivate all slots first
        const { error: deactivateError } = await supabaseDb
          .from('trainer_slots')
          .update({ is_active: false })
          .eq('slot_date', slot_date)
          .eq('trainer_id', user.id);

        if (deactivateError) {
          console.error('toggleDaySlots DB error (deactivate phase):', deactivateError);
          return res.status(500).json({ error: 'Failed to reset slots: ' + deactivateError.message });
        }

        // Activate specified slot times
        if (active_times.length > 0) {
          const { error: activateError } = await supabaseDb
            .from('trainer_slots')
            .update({ is_active: true })
            .eq('slot_date', slot_date)
            .eq('trainer_id', user.id)
            .in('start_time', active_times);

          if (activateError) {
            console.error('toggleDaySlots DB error (activate phase):', activateError);
            return res.status(500).json({ error: 'Failed to activate selected slots: ' + activateError.message });
          }
        }

        // Re-fetch all slots for this day to return to client
        const { data: allSlots, error: fetchError } = await supabaseDb
          .from('trainer_slots')
          .select('*')
          .eq('slot_date', slot_date)
          .eq('trainer_id', user.id);

        if (fetchError) {
          console.error('toggleDaySlots DB error (fetch phase):', fetchError);
          return res.status(500).json({ error: 'Failed to retrieve updated slots: ' + fetchError.message });
        }
        updatedSlots = allSlots;
      } else {
        // Fallback: Activate only default slots (9 AM to 5 PM, hours 9 to 16 inclusive)
        const defaultTimes = [];
        for (let h = 9; h < 17; h++) {
          defaultTimes.push(`${String(h).padStart(2, '0')}:00:00`);
        }

        // Deactivate all first
        const { error: deactivateError } = await supabaseDb
          .from('trainer_slots')
          .update({ is_active: false })
          .eq('slot_date', slot_date)
          .eq('trainer_id', user.id);

        if (deactivateError) {
          console.error('toggleDaySlots DB error (fallback deactivate phase):', deactivateError);
          return res.status(500).json({ error: 'Failed to reset slots: ' + deactivateError.message });
        }

        // Activate standard active hours
        const { error: activateError } = await supabaseDb
          .from('trainer_slots')
          .update({ is_active: true })
          .eq('slot_date', slot_date)
          .eq('trainer_id', user.id)
          .in('start_time', defaultTimes);

        if (activateError) {
          console.error('toggleDaySlots DB error (fallback activate phase):', activateError);
          return res.status(500).json({ error: 'Failed to activate default slots: ' + activateError.message });
        }

        // Re-fetch all slots for this day to return to client
        const { data: allSlots, error: fetchError } = await supabaseDb
          .from('trainer_slots')
          .select('*')
          .eq('slot_date', slot_date)
          .eq('trainer_id', user.id);

        if (fetchError) {
          console.error('toggleDaySlots DB error (fallback fetch phase):', fetchError);
          return res.status(500).json({ error: 'Failed to retrieve updated slots: ' + fetchError.message });
        }
        updatedSlots = allSlots;
      }
    }

    return res.status(200).json({ slots: updatedSlots });
  } catch (err) {
    console.error('toggleDaySlots unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  getClients,
  getAvailableSlots,
  bookSlot,
  toggleDaySlots
};


