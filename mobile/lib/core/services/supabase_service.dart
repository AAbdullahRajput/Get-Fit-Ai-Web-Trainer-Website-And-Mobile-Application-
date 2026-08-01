import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../data/models/trainer.dart';
import '../../data/models/slot.dart';
import '../../data/models/client.dart';
import '../constants.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get client => Supabase.instance.client;

  String getFriendlyErrorMessage(dynamic e) {
    if (e is AuthException) {
      return e.message;
    }
    if (e is PostgrestException) {
      final msg = e.message.toLowerCase();
      if (msg.contains('unique constraint') || msg.contains('already exists')) {
        if (msg.contains('email')) {
          return 'This email address is already in use.';
        }
        if (msg.contains('phone')) {
          return 'This phone number is already in use.';
        }
        return 'A record with this information already exists.';
      }
      return e.message;
    }
    final errStr = e.toString().toLowerCase();
    if (errStr.contains('socketexception') || errStr.contains('connection failed') || errStr.contains('network_error')) {
      return 'Network connection error. Please check your internet connection and try again.';
    }
    if (errStr.contains('timeout')) {
      return 'The request timed out. Please try again later.';
    }
    return e.toString()
        .replaceAll('Exception: ', '')
        .replaceAll('AuthException: ', '')
        .replaceAll('PostgrestException: ', '');
  }

  // Dedicated DB client that always uses the service role key to bypass client auth RLS
  final SupabaseClient dbClient = SupabaseClient(
    AppConstants.supabaseUrl,
    AppConstants.supabaseKey,
  );

  User? get currentUser => client.auth.currentUser;
  Session? get currentSession => client.auth.currentSession;

  // -----------------------------------------
  // Authentication Actions
  // -----------------------------------------

  Future<void> initialize() async {
    // Already configured via client instantiation
  }

  /// Sign Up a trainer with email, password, username, phone
  Future<Map<String, dynamic>> signUpTrainer({
    required String email,
    required String password,
    required String username,
    required String phone,
  }) async {
    // 1. Check if email already registered as client in public 'users' table
    final clientCheck = await client
        .from('users')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

    if (clientCheck != null) {
      throw const AuthException(
        'This email is already registered as a client account. A client account cannot sign up as a trainer.',
      );
    }

    // 2. Check if email exists in public 'fitness_trainers' table
    final trainerCheck = await client
        .from('fitness_trainers')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

    if (trainerCheck != null) {
      throw const AuthException(
        'Trainer account already exists with this email. Please log in instead.',
      );
    }

    // 3. Create user in Supabase auth
    final AuthResponse authData = await client.auth.signUp(
      email: email,
      password: password,
    );

    final user = authData.user;
    if (user == null) {
      throw const AuthException('User creation failed.');
    }

    // 4. Try removing user from public.users if a database trigger automatically inserted them there
    try {
      await dbClient.from('users').delete().eq('id', user.id);
    } catch (e) {
      // Ignored if table has no auto-trigger or delete fails
    }

    // 5. Insert trainer profile info into 'fitness_trainers' table
    Map<String, dynamic> trainerMap;
    try {
      trainerMap = await dbClient
          .from('fitness_trainers')
          .insert({
            'id': user.id,
            'email': email,
            'name': username,
            'phone_number': phone,
            'training_type': 'General',
            'experience': '0 years',
            'session_price': 48.00,
          })
          .select()
          .single();
    } catch (dbError) {
      // Rollback Auth user creation if database profile insert fails
      try {
        await dbClient.auth.admin.deleteUser(user.id);
      } catch (_) {}
      rethrow;
    }

    return {
      'user': user,
      'trainer': Trainer.fromJson(trainerMap),
      'session': authData.session,
    };
  }

  /// Log In a trainer with email and password
  Future<Map<String, dynamic>> signInTrainer({
    required String email,
    required String password,
  }) async {
    // 1. Sign in with Supabase Auth
    final AuthResponse authData = await client.auth.signInWithPassword(
      email: email,
      password: password,
    );

    final user = authData.user;
    if (user == null) {
      throw const AuthException('Login failed.');
    }

    // 2. Fetch profile from 'fitness_trainers' table
    Map<String, dynamic>? trainerData = await dbClient
        .from('fitness_trainers')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    // Auto-repair missing profile if user exists in auth but lacks a fitness_trainer profile row
    trainerData ??= await dbClient
        .from('fitness_trainers')
        .insert({
          'id': user.id,
          'email': user.email ?? email,
          'name': (user.email ?? email).split('@')[0],
          'training_type': 'General',
          'experience': '0 years',
          'session_price': 48.00,
        })
        .select()
        .single();

    return {
      'user': user,
      'trainer': Trainer.fromJson(trainerData),
      'session': authData.session,
    };
  }

  /// Google Sign-In helper method (starts OAuth web/app flow)
  Future<bool> signInWithGoogle() async {
    return await client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: kIsWeb ? null : 'io.supabase.getfit://login-callback',
      authScreenLaunchMode: LaunchMode.externalApplication,
    );
  }

  /// Query a trainer profile by ID or email, or create a default one if it doesn't exist.
  /// Throws AuthException if the email belongs to a client account.
  Future<Trainer> fetchOrCreateTrainerProfile(User user) async {
    final email = user.email ?? '';

    // 1. Fetch existing trainer profile by user id
    Map<String, dynamic>? trainerData = await dbClient
        .from('fitness_trainers')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    // If missing by ID, try looking up by email to link existing profile
    if (trainerData == null && email.isNotEmpty) {
      trainerData = await dbClient
          .from('fitness_trainers')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

      if (trainerData != null) {
        // Sync ID in fitness_trainers table to match the current auth user id
        try {
          await dbClient
              .from('fitness_trainers')
              .update({'id': user.id})
              .eq('id', trainerData['id']);
          trainerData['id'] = user.id;
        } catch (_) {}
      }
    }

    // 2. If no trainer profile exists, verify email is not registered as a client in public 'users'
    if (trainerData == null && email.isNotEmpty) {
      final clientCheck = await dbClient
          .from('users')
          .select('id')
          .ilike('email', email)
          .maybeSingle();

      if (clientCheck != null) {
        await client.auth.signOut();
        throw const AuthException(
          'This email is already registered as a client account. Client accounts cannot log in as a trainer.',
        );
      }
    }

    // 3. Auto-create trainer profile if new Google user
    if (trainerData == null) {
      final name = user.userMetadata?['full_name'] ??
          user.userMetadata?['name'] ??
          (email.isNotEmpty ? email.split('@')[0] : 'Trainer');

      final avatarUrl = user.userMetadata?['avatar_url'] ??
          user.userMetadata?['picture'] ??
          '';

      trainerData = await dbClient
          .from('fitness_trainers')
          .insert({
            'id': user.id,
            'email': email,
            'name': name,
            'avatar_url': avatarUrl,
            'phone_number': user.phone ?? '',
            'training_type': 'General',
            'experience': '0 years',
            'session_price': 48.00,
          })
          .select()
          .single();
    }

    return Trainer.fromJson(trainerData);
  }

  /// Sign Out current user
  Future<void> signOut() async {
    await client.auth.signOut();
  }

  /// Send recovery OTP code to trainer email
  Future<void> sendPasswordRecoveryOtp(String email) async {
    try {
      // Verify trainer profile exists in database
      final trainer = await client
          .from('fitness_trainers')
          .select('id')
          .ilike('email', email)
          .maybeSingle();

      if (trainer == null) {
        throw const AuthException('No account found with this email address');
      }

      debugPrint('\x1B[33m[API] POST /auth/v1/recover | email: $email\x1B[0m');
      await client.auth.resetPasswordForEmail(email);
      debugPrint('\x1B[32m[API] 200 OK | Reset email sent\x1B[0m');
    } catch (e) {
      debugPrint('\x1B[31m[API] ERROR | resetPassword | ${e.toString().replaceAll('AuthException: ', '')}\x1B[0m');
      rethrow;
    }
  }

  /// Verify recovery OTP code
  Future<AuthResponse> verifyRecoveryCode(String email, String code) async {
    try {
      debugPrint('\x1B[33m[API] POST /auth/v1/verify | email: $email\x1B[0m');
      final response = await client.auth.verifyOTP(
        email: email,
        token: code,
        type: OtpType.recovery,
      );
      debugPrint('\x1B[32m[API] 200 OK | OTP verified\x1B[0m');
      return response;
    } catch (e) {
      debugPrint('\x1B[31m[API] ERROR | verifyOtp | ${e.toString().replaceAll('AuthException: ', '')}\x1B[0m');
      rethrow;
    }
  }

  /// Update password for the currently active session user
  Future<void> updatePassword(String newPassword) async {
    try {
      debugPrint('\x1B[33m[API] PUT /auth/v1/user | update password\x1B[0m');
      await client.auth.updateUser(
        UserAttributes(password: newPassword),
      );
      debugPrint('\x1B[32m[API] 200 OK | Password updated\x1B[0m');
    } catch (e) {
      debugPrint('\x1B[31m[API] ERROR | updatePassword | ${e.toString().replaceAll('AuthException: ', '')}\x1B[0m');
      rethrow;
    }
  }

  /// Check if trainer profile exists with given email
  Future<bool> checkTrainerEmailExists(String email) async {
    final trainer = await client
        .from('fitness_trainers')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
    return trainer != null;
  }

  // -----------------------------------------
  // Profile Actions
  // -----------------------------------------

  /// Fetch profile of current trainer
  Future<Trainer> getTrainerProfile(String userId) async {
    final Map<String, dynamic> trainerData = await client
        .from('fitness_trainers')
        .select('*')
        .eq('id', userId)
        .single();
    return Trainer.fromJson(trainerData);
  }

  /// Update trainer profile columns
  Future<Trainer> updateTrainerProfile(String userId, Map<String, dynamic> updates) async {
    // Enforce name and id read-only constraints matching server
    final Map<String, dynamic> cleanedUpdates = Map.from(updates);
    cleanedUpdates.remove('name');
    cleanedUpdates.remove('id');

    final httpClient = HttpClient();
    try {
      final uri = Uri.parse('${AppConstants.supabaseUrl}/rest/v1/fitness_trainers?id=eq.$userId');
      final request = await httpClient.patchUrl(uri);
      
      request.headers.set('apikey', AppConstants.supabaseKey);
      request.headers.set('Authorization', 'Bearer ${AppConstants.supabaseKey}');
      request.headers.set('Content-Type', 'application/json');
      request.headers.set('Prefer', 'return=representation');
      
      request.write(jsonEncode(cleanedUpdates));
      
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();
      
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Failed to update profile: $responseBody');
      }

      // If the session price was updated, also update all of the trainer's available slots!
      if (cleanedUpdates.containsKey('session_price')) {
        final newPrice = cleanedUpdates['session_price'];
        await client
            .from('trainer_slots')
            .update({'price': newPrice})
            .eq('trainer_id', userId)
            .eq('status', 'available');
      }

      final List<dynamic> data = jsonDecode(responseBody);
      if (data.isEmpty) {
        throw Exception('No rows updated.');
      }

      return Trainer.fromJson(data.first as Map<String, dynamic>);
    } finally {
      httpClient.close();
    }
  }

  /// Upload trainer avatar profile image
  Future<String> uploadAvatar({
    required String userId,
    required Uint8List imageBytes,
    required String fileExtension,
    required String mimeType,
  }) async {
    final String storagePath = 'Trainers/$userId.$fileExtension';

    // Upload to avatars bucket
    await dbClient.storage.from('avatars').uploadBinary(
          storagePath,
          imageBytes,
          fileOptions: FileOptions(contentType: mimeType, upsert: true),
        );

    // Get public URL
    final String publicUrl = dbClient.storage.from('avatars').getPublicUrl(storagePath);
    return publicUrl;
  }

  // -----------------------------------------
  // Slots Actions (Trainer Planner)
  // -----------------------------------------

  /// Fetch current trainer slots from DB and auto-fills missing template slots (9:00 - 17:00) only on first-time initialization
  Future<List<TrainerSlot>> fetchSlots(String userId, double trainerPrice) async {
    // 1. Fetch current trainer slots from database
    final List<dynamic> existingRows = await client
        .from('trainer_slots')
        .select('*')
        .eq('trainer_id', userId)
        .order('slot_date', ascending: true)
        .order('start_time', ascending: true);

    final List<TrainerSlot> slots = existingRows.map((e) => TrainerSlot.fromJson(e as Map<String, dynamic>)).toList();

    // 2. Filter existing slots to keep only template slots (reference week: 1970-01-05 Monday to 1970-01-11 Sunday)
    final List<TrainerSlot> existingTemplates = slots.where((s) => s.slotDate.compareTo('1970-01-05') >= 0 && s.slotDate.compareTo('1970-01-11') <= 0).toList();

    // Only auto-fill if the trainer has NO template slots at all (first-time initialization)
    if (existingTemplates.isEmpty) {
      final List<Map<String, dynamic>> missingSlots = [];
      final List<String> weekDates = [
        '1970-01-05', // Monday
        '1970-01-06', // Tuesday
        '1970-01-07', // Wednesday
        '1970-01-08', // Thursday
        '1970-01-09', // Friday
        '1970-01-10', // Saturday
        '1970-01-11', // Sunday
      ];

      for (final dateStr in weekDates) {
        for (int h = 0; h < 24; h++) {
          final startHourStr = h.toString().padLeft(2, '0');
          final startTime = '$startHourStr:00:00';
          final endHour = h + 1;
          final endTime = endHour == 24 ? '00:00:00' : '${endHour.toString().padLeft(2, '0')}:00:00';

          // Open 9:00 AM to 5:00 PM by default (hours 9 to 16 inclusive)
          final isActive = (h >= 9 && h < 17);
          missingSlots.add({
            'trainer_id': userId,
            'slot_date': dateStr,
            'start_time': startTime,
            'end_time': endTime,
            'is_active': isActive,
            'price': trainerPrice,
            'status': 'available',
          });
        }
      }

      if (missingSlots.isNotEmpty) {
        final List<dynamic> insertedRows = await dbClient.from('trainer_slots').insert(missingSlots).select();
        final List<TrainerSlot> inserted = insertedRows.map((e) => TrainerSlot.fromJson(e as Map<String, dynamic>)).toList();
        inserted.sort((a, b) {
          final dateCompare = a.slotDate.compareTo(b.slotDate);
          if (dateCompare != 0) return dateCompare;
          return a.startTime.compareTo(b.startTime);
        });
        return inserted;
      }
    }

    existingTemplates.sort((a, b) {
      final dateCompare = a.slotDate.compareTo(b.slotDate);
      if (dateCompare != 0) return dateCompare;
      return a.startTime.compareTo(b.startTime);
    });
    return existingTemplates;
  }

  /// Create slots bulk (for initialization)
  Future<List<TrainerSlot>> createSlotsBulk(List<Map<String, dynamic>> slotsData) async {
    final List<dynamic> response = await dbClient.from('trainer_slots').insert(slotsData).select();
    return response.map((e) => TrainerSlot.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Create a single slot
  Future<TrainerSlot> createSlot({
    required String trainerId,
    required String slotDate,
    required String startTime,
    required String endTime,
    required double price,
  }) async {
    final response = await dbClient.from('trainer_slots').insert({
      'trainer_id': trainerId,
      'slot_date': slotDate,
      'start_time': startTime,
      'end_time': endTime,
      'price': price,
      'is_active': true,
      'status': 'available',
    }).select().single();
    return TrainerSlot.fromJson(response);
  }

  /// Update single slot details
  Future<TrainerSlot> updateSlot(String slotId, Map<String, dynamic> updates) async {
    final Map<String, dynamic> cleanedUpdates = Map.from(updates);
    cleanedUpdates.remove('trainer_id');
    cleanedUpdates.remove('booked_by_user_id');
    cleanedUpdates.remove('booked_by_name');
    cleanedUpdates.remove('booked_by_email');
    cleanedUpdates.remove('id');

    final Map<String, dynamic> response = await client
        .from('trainer_slots')
        .update(cleanedUpdates)
        .eq('id', slotId)
        .select()
        .single();

    return TrainerSlot.fromJson(response);
  }

  /// Delete a slot
  Future<void> deleteSlot(String slotId, String trainerId) async {
    await dbClient.from('trainer_slots').delete().eq('id', slotId).eq('trainer_id', trainerId);
  }

  /// Group toggle all slots of a weekday with selective activation
  Future<void> toggleDaySlots(String trainerId, String dateStr, bool makeActive, {List<String>? timesToActivate}) async {
    if (makeActive) {
      // Deactivate all first (non-booked)
      await client
          .from('trainer_slots')
          .update({'is_active': false})
          .eq('trainer_id', trainerId)
          .eq('slot_date', dateStr)
          .neq('status', 'booked');

      if (timesToActivate != null && timesToActivate.isNotEmpty) {
        // Activate specified ones
        await client
            .from('trainer_slots')
            .update({'is_active': true})
            .eq('trainer_id', trainerId)
            .eq('slot_date', dateStr)
            .inFilter('start_time', timesToActivate)
            .neq('status', 'booked');
      } else {
        // Default fallback (9-5)
        final defaultActiveTimes = [
          '09:00:00', '10:00:00', '11:00:00', '12:00:00',
          '13:00:00', '14:00:00', '15:00:00', '16:00:00'
        ];
        await client
            .from('trainer_slots')
            .update({'is_active': true})
            .eq('trainer_id', trainerId)
            .eq('slot_date', dateStr)
            .inFilter('start_time', defaultActiveTimes)
            .neq('status', 'booked');
      }
    } else {
      // Deactivate all
      await client
          .from('trainer_slots')
          .update({'is_active': false})
          .eq('trainer_id', trainerId)
          .eq('slot_date', dateStr)
          .neq('status', 'booked');
    }
  }

  // -----------------------------------------
  // Clients / Bookings Tab Actions
  // -----------------------------------------

  /// Load clients aggregated profiles and historical bookings
  Future<List<Client>> getClients(String trainerId) async {
    // 1. Fetch appointments booked with this trainer
    final List<dynamic> apptRows = await dbClient
        .from('trainer_appointments')
        .select('*')
        .eq('trainer_id', trainerId)
        .order('appointment_date', ascending: true)
        .order('start_time', ascending: true);

    // Extract unique user_ids
    final List<String> userIds = apptRows
        .map((a) => a['user_id']?.toString() ?? '')
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();

    // 2. Fetch users profile details from public.users table
    final Map<String, Map<String, dynamic>> usersMap = {};
    if (userIds.isNotEmpty) {
      final List<dynamic> usersRows = await dbClient
          .from('users')
          .select('id, username, email, mobile_no, avatar_url')
          .inFilter('id', userIds);

      for (final row in usersRows) {
        usersMap[row['id'].toString()] = row as Map<String, dynamic>;
      }
    }

    // 3. Aggregate appointments by client (key: user_id or email)
    final Map<String, Client> clientsMap = {};
    final Map<String, List<BookedSlot>> slotsMap = {};

    for (final appt in apptRows) {
      final String clientId = appt['user_id']?.toString() ?? appt['user_email']?.toString() ?? 'unknown';
      if (clientId == 'unknown') continue;

      final bookedSlot = BookedSlot.fromJson(appt as Map<String, dynamic>);
      slotsMap.putIfAbsent(clientId, () => []).add(bookedSlot);

      if (!clientsMap.containsKey(clientId)) {
        final String? userId = appt['user_id']?.toString();
        final Map<String, dynamic> userProfile = userId != null ? (usersMap[userId] ?? {}) : {};

        clientsMap[clientId] = Client(
          id: userId,
          name: appt['user_name']?.toString() ?? userProfile['username']?.toString() ?? 'Client',
          email: appt['user_email']?.toString() ?? userProfile['email']?.toString() ?? '',
          mobileNo: userProfile['mobile_no']?.toString() ?? 'N/A',
          avatarUrl: userProfile['avatar_url']?.toString() ?? '',
          bookedSlots: slotsMap[clientId]!,
        );
      }
    }

    return clientsMap.values.toList();
  }

  // -----------------------------------------
  // CALL SESSIONS (Call History)
  // -----------------------------------------

  Future<List<Map<String, dynamic>>> getCallSessionsForAppointment(String appointmentId) async {
    try {
      debugPrint('\x1B[33m[API] GET call_sessions | appointment: $appointmentId\x1B[0m');
      final data = await client
          .from('call_sessions')
          .select()
          .eq('appointment_id', appointmentId)
          .order('created_at', ascending: false);
      debugPrint('\x1B[32m[API] 200 OK | CallSessions: ${data.length}\x1B[0m');
      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      debugPrint('\x1B[31m[API] ERROR | getCallSessionsForAppointment | $e\x1B[0m');
      return [];
    }
  }
}
