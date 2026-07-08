const { supabaseAuth, supabaseDb } = require('../config/supabase');
const { sendRecoveryEmail } = require('../utils/emailService');

const validateEmail = (email) => {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};

const validatePassword = (password) => {
  if (!password || password.length < 8 || password.length > 16) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
};

const validateMobile = (mobile) => {
  return /^\+923\d{9}$/.test(mobile);
};

const signup = async (req, res) => {
  try {
    const { email, password, username, mobile } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }

    if (/\d/.test(username)) {
      return res.status(400).json({ error: 'Username must not contain numbers' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be between 8 and 16 characters and contain at least one uppercase letter, one number, and one special character' });
    }

    if (!mobile || !validateMobile(mobile)) {
      return res.status(400).json({ error: 'Please enter a valid Pakistani mobile number starting with +923 (e.g. +923001234567)' });
    }

    if (!supabaseAuth || !supabaseDb) {
      return res.status(500).json({ error: 'Supabase client not initialized' });
    }

    // A. Check if email exists in public 'users' (clients) table
    const { data: clientExists, error: clientCheckError } = await supabaseDb
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (clientCheckError) {
      console.error('Client email check error:', clientCheckError);
      return res.status(500).json({ error: 'Database check failed' });
    }

    if (clientExists) {
      return res.status(400).json({ error: 'This email is already registered as a client account. A client account cannot sign up as a trainer.' });
    }

    // B. Check if email exists in public 'fitness_trainers' (trainers) table
    const { data: trainerExists, error: trainerCheckError } = await supabaseDb
      .from('fitness_trainers')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (trainerCheckError) {
      console.error('Trainer email check error:', trainerCheckError);
      return res.status(500).json({ error: 'Database check failed' });
    }

    if (trainerExists) {
      return res.status(400).json({ error: 'Trainer account already exists with this email. Please log in instead.' });
    }

    // 1. Create user with Admin API (marked as confirmed automatically)
    const { data: authData, error: signUpError } = await supabaseAuth.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message });
    }

    // Delete from public 'users' table if the auto-trigger inserted them there
    try {
      await supabaseDb.from('users').delete().eq('id', authData.user.id);
    } catch (deleteErr) {
      console.error('Failed to remove trainer from public.users table:', deleteErr);
    }

    // 2. Insert user info into 'fitness_trainers' table (uses supabaseDb client)
    // Map 'username' from frontend to 'name' column in database
    const { data: trainerData, error: dbError } = await supabaseDb
      .from('fitness_trainers')
      .insert([
        {
          id: authData.user.id,
          email,
          name: username,
          phone_number: mobile || null,
          training_type: 'General',
          experience: '0 years'
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Rollback auth user creation if database insert fails
      try {
        await supabaseAuth.auth.admin.deleteUser(authData.user.id);
      } catch (rollbackErr) {
        console.error('Failed to rollback auth user creation:', rollbackErr);
      }
      return res.status(500).json({ error: 'Failed to create trainer profile: ' + dbError.message });
    }

    // 3. Obtain a session for auto-login
    let session = authData.session;
    if (!session) {
      try {
        const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
          email,
          password,
        });
        if (!signInError && signInData) {
          session = signInData.session;
        }
      } catch (signInErr) {
        console.error('Auto-login error after signup:', signInErr);
      }
    }

    res.status(201).json({
      message: 'Signup successful',
      user: authData.user,
      trainer: trainerData,
      session
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (!supabaseAuth || !supabaseDb) {
      return res.status(500).json({ error: 'Supabase client not initialized' });
    }

    // 1. Sign in with Supabase Auth (uses supabaseAuth client)
    const { data: authData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return res.status(401).json({ error: signInError.message });
    }

    // 2. Retrieve custom columns from 'fitness_trainers' table (uses supabaseDb client)
    let { data: trainer, error: dbError } = await supabaseDb
      .from('fitness_trainers')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        trainer = null;
      } else {
        console.error('Database fetch error:', dbError);
        return res.status(500).json({ error: 'Failed to retrieve trainer details: ' + dbError.message });
      }
    }

    // Auto-repair: If user exists in Auth but is missing from fitness_trainers, create the profile
    if (!trainer) {
      console.log(`Auto-repairing missing profile in fitness_trainers for user: ${authData.user.email}`);
      const { data: newTrainer, error: createError } = await supabaseDb
        .from('fitness_trainers')
        .insert([
          {
            id: authData.user.id,
            email: authData.user.email,
            name: authData.user.email.split('@')[0], // Fallback name
            training_type: 'General',
            experience: '0 years'
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error('Failed to auto-repair missing trainer profile:', createError);
        return res.status(500).json({ error: 'Trainer profile does not exist and could not be created.' });
      }
      trainer = newTrainer;
    }

    res.status(200).json({
      message: 'Login successful',
      user: authData.user,
      trainer,
      session: authData.session
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // 1. Check if the trainer profile exists in the database
    const { data: trainer, error: dbError } = await supabaseDb
      .from('fitness_trainers')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (dbError) {
      console.error('ForgotPassword DB check error:', dbError);
      return res.status(500).json({ error: 'Verification failed' });
    }

    if (!trainer) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    // 2. Verify the email exists in Supabase Auth
    const { data: listData, error: authListError } = await supabaseAuth.auth.admin.listUsers();
    if (authListError) {
      console.error('Auth check error:', authListError);
      return res.status(500).json({ error: 'Auth server verification failed' });
    }

    const authUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) {
      return res.status(400).json({ error: 'This account does not have login credentials yet. Please sign up first!' });
    }

    // 3. Generate a 6-digit OTP via Supabase Admin (does not send email itself)
    const { data: linkData, error: linkError } = await supabaseAuth.auth.admin.generateLink({
      type: 'recovery',
      email
    });

    if (linkError) {
      console.error('GenerateLink error:', linkError);
      return res.status(400).json({ error: 'Failed to generate recovery code.' });
    }

    const otpCode = linkData?.properties?.email_otp;
    if (!otpCode) {
      return res.status(500).json({ error: 'Could not retrieve recovery code.' });
    }

    // 4. Send the OTP to the trainer's email via nodemailer (reliable delivery)
    try {
      await sendRecoveryEmail(email, otpCode);
    } catch (mailErr) {
      console.error('Email send failed:', mailErr.message);
      return res.status(500).json({ error: 'Email delivery failed: ' + mailErr.message });
    }

    return res.status(200).json({ message: 'Recovery code sent to your email.' });

  } catch (err) {
    console.error('ForgotPassword error:', err.message);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};


const verifyRecoveryCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    const { data, error } = await supabaseAuth.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery'
    });
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({
      message: 'Code verified successfully',
      session: data.session,
      user: data.user
    });
  } catch (err) {
    console.error('VerifyRecoveryCode error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || !validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be between 8 and 16 characters and contain at least one uppercase letter, one number, and one special character' });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { error: updateError } = await supabaseAuth.auth.admin.updateUserById(user.id, {
      password
    });
    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('UpdatePassword error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const checkTrainerEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the trainer profile exists in the database
    const { data: trainer, error: dbError } = await supabaseDb
      .from('fitness_trainers')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (dbError) {
      console.error('CheckTrainerEmail DB error:', dbError);
      return res.status(500).json({ error: 'Database check failed' });
    }

    if (!trainer) {
      return res.status(404).json({ error: 'Trainer account does not exist. Please sign up first.' });
    }

    return res.status(200).json({ exists: true });
  } catch (err) {
    console.error('CheckTrainerEmail error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
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

    const { data: trainer, error: dbError } = await supabaseDb
      .from('fitness_trainers')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (dbError) {
      console.error('getProfile DB error:', dbError);
      return res.status(500).json({ error: 'Failed to retrieve profile: ' + dbError.message });
    }

    if (!trainer) {
      return res.status(404).json({ error: 'Trainer profile not found' });
    }

    return res.status(200).json({ trainer });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
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

    const updates = { ...req.body };

    // Enforce name column read-only constraint
    delete updates.name;
    delete updates.id;

    if (updates.email !== undefined && !validateEmail(updates.email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (updates.phone_number !== undefined && !validateMobile(updates.phone_number)) {
      return res.status(400).json({ error: 'Please enter a valid Pakistani mobile number starting with +923 (e.g. +923001234567)' });
    }

    // Handle base64 image upload if provided
    if (updates.image_base64 && updates.image_name) {
      const base64Data = updates.image_base64;
      const fileName = updates.image_name;
      
      // Clean up base64 fields so they don't get saved to database columns
      delete updates.image_base64;
      delete updates.image_name;

      const matches = base64Data.match(/^data:([^;]+);base64,([\s\S]+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Content = matches[2];
        const buffer = Buffer.from(base64Content, 'base64');
        
        const ext = fileName.split('.').pop() || 'jpg';
        const storagePath = `Trainers/${user.id}.${ext}`;
        
        // Upload file to Supabase storage bucket 'avatars' inside 'Trainers' folder
        const { error: uploadError } = await supabaseDb.storage
          .from('avatars')
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true
          });
          
        if (uploadError) {
          console.error('[updateProfile] Avatar upload error:', uploadError);
          return res.status(500).json({ error: 'Failed to upload profile picture: ' + uploadError.message });
        }
        
        // Get public URL of the uploaded image
        const { data: urlData } = supabaseDb.storage
          .from('avatars')
          .getPublicUrl(storagePath);
          
        if (urlData && urlData.publicUrl) {
          updates.image_url = urlData.publicUrl;
        }
      }
    } else {
      // Just in case these properties are sent without values, clean them up
      delete updates.image_base64;
      delete updates.image_name;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const { data: trainer, error: dbError } = await supabaseDb
      .from('fitness_trainers')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (dbError) {
      console.error('[updateProfile] updateProfile DB error:', dbError);
      return res.status(500).json({ error: 'Failed to update profile: ' + dbError.message });
    }

    return res.status(200).json({ trainer });
  } catch (err) {
    console.error('[updateProfile] updateProfile unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/google-oauth
// Called after Clerk verifies Google identity on the frontend.
// Receives { email, name, clerkUserId } and returns { trainer, session }
// in the same shape as login so the rest of the app is unchanged.
const googleOAuth = async (req, res) => {
  try {
    const { email, name, clerkUserId, action } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!supabaseAuth || !supabaseDb) {
      return res.status(500).json({ error: 'Supabase client not initialized' });
    }

    // Block if this email belongs to a regular client account
    const { data: clientExists } = await supabaseDb
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (clientExists) {
      const { data: trainerExists } = await supabaseDb
        .from('fitness_trainers')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (!trainerExists) {
        return res.status(400).json({ error: 'This email is already registered as a client account.' });
      }
    }

    // --- Find or create the trainer in Supabase ---
    let { data: trainer } = await supabaseDb
      .from('fitness_trainers')
      .select('*')
      .ilike('email', email)
      .maybeSingle();


    let supabaseUserId;

    if (!trainer) {
      // New trainer: create a Supabase auth user with a random secure password.
      // They will always sign in via Google OAuth going forward.
      const randomPassword = Math.random().toString(36).slice(-8) + 'A1!';
      const displayName = name || email.split('@')[0];

      const { data: authData, error: signUpError } = await supabaseAuth.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true
      });

      if (signUpError) {
        if (signUpError.status === 422 || signUpError.message.includes('already') || signUpError.code === 'email_exists') {
          const { data: usersData, error: listError } = await supabaseAuth.auth.admin.listUsers();
          const existingUser = usersData?.users?.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (existingUser) {
            supabaseUserId = existingUser.id;
          } else {
            console.error('[googleOAuth] listUsers failed or not found:', listError);
            return res.status(400).json({ error: signUpError.message });
          }
        } else {
          console.error('[googleOAuth] createUser error:', signUpError);
          return res.status(400).json({ error: signUpError.message });
        }
      } else {
        supabaseUserId = authData.user.id;
      }

      // Remove from public.users if auto-trigger inserted them
      try {
        await supabaseDb.from('users').delete().eq('id', supabaseUserId);
      } catch (_) {}

      // Insert into fitness_trainers
      const { data: newTrainer, error: dbError } = await supabaseDb
        .from('fitness_trainers')
        .insert([{
          id: supabaseUserId,
          email,
          name: displayName,
          training_type: 'General',
          experience: '0 years'
        }])
        .select()
        .single();

      if (dbError) {
        console.error('[googleOAuth] insert trainer error:', dbError);
        // Rollback Supabase auth user
        try { await supabaseAuth.auth.admin.deleteUser(supabaseUserId); } catch (_) {}
        return res.status(500).json({ error: 'Failed to create trainer profile: ' + dbError.message });
      }

      trainer = newTrainer;
    } else {
      supabaseUserId = trainer.id;
      try {
        const { data: usersData } = await supabaseAuth.auth.admin.listUsers();
        const authUser = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (authUser) {
          if (authUser.id !== trainer.id) {
            console.warn(`[googleOAuth] Mismatched Auth ID (${authUser.id}) and Trainer ID (${trainer.id}). Re-creating Auth user...`);
            await supabaseAuth.auth.admin.deleteUser(authUser.id);
            const randomPassword = Math.random().toString(36).slice(-8) + 'A1!';
            await supabaseAuth.auth.admin.createUser({
              id: trainer.id,
              email,
              password: randomPassword,
              email_confirm: true
            });
          }
        } else {
          console.log(`[googleOAuth] Auth user missing for existing trainer. Creating...`);
          const randomPassword = Math.random().toString(36).slice(-8) + 'A1!';
          await supabaseAuth.auth.admin.createUser({
            id: trainer.id,
            email,
            password: randomPassword,
            email_confirm: true
          });
        }
      } catch (repairErr) {
        console.error('[googleOAuth] Auth auto-repair error:', repairErr);
      }
    }

    // Generate a session using admin.createSession (impersonation)
    // Supabase doesn't support createSession for arbitrary users in all plans,
    // so we use generateLink + exchange pattern: generate a magic link and
    // sign in with it server-side to get a real session token.
    // Fallback: use a short-lived JWT via admin.generateLink of type "magiclink"
    const { data: linkData, error: linkError } = await supabaseAuth.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError) {
      console.error('[googleOAuth] generateLink error:', linkError);
      return res.status(500).json({ error: 'Failed to generate session: ' + linkError.message });
    }

    // Extract the token from the magic link URL and exchange it for a session
    const linkUrl = linkData?.properties?.action_link || '';
    const tokenMatch = linkUrl.match(/token=([^&]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    let session = null;
    if (token) {
      const { data: sessionData, error: sessionError } = await supabaseAuth.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      });
      if (!sessionError && sessionData?.session) {
        session = sessionData.session;
      } else {
        console.warn('[googleOAuth] verifyOtp failed:', sessionError?.message);
      }
    }

    // If we could not get a real Supabase session (e.g. token expired immediately),
    // return the trainer data with a null session so the frontend can still
    // store the trainer profile (limited functionality until re-login).
    return res.status(200).json({
      message: 'Google OAuth successful',
      trainer,
      session
    });

  } catch (err) {
    console.error('[googleOAuth] unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  signup,
  login,
  forgotPassword,
  verifyRecoveryCode,
  updatePassword,
  checkTrainerEmail,
  getProfile,
  updateProfile,
  googleOAuth
};

