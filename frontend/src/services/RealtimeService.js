import { createClient } from '@supabase/supabase-js';

class RealtimeService {
  constructor() {
    this.supabase = null;
    this.callSubscription = null;
    this.onIncomingCall = null;
    this.onCallStatusChange = null;
  }

  // Initialize Supabase client
  initialize(supabaseUrl, supabaseKey) {
    try {
      if (!this.supabase) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase Realtime initialized');
      }

      // Restore the trainer's auth session so RLS (auth.uid()) works on inserts
      const sessionString = localStorage.getItem('session');
      const session = sessionString ? JSON.parse(sessionString) : null;
      if (session?.access_token && session?.refresh_token) {
        this.supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        }).catch((err) => console.error('❌ Failed to restore session:', err));
      }

      return this.supabase;
    } catch (error) {
      console.error('❌ Supabase initialization failed:', error);
      throw error;
    }
  }

  // Listen for incoming calls (trainer receives calls with status='ringing')
  startListeningForCalls(trainerId, callbacks = {}) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase not initialized');
      }

      const { onIncomingCall, onCallStatusChange } = callbacks;

      this.onIncomingCall = onIncomingCall;
      this.onCallStatusChange = onCallStatusChange;

      // Subscribe to call_sessions table
      this.callSubscription = this.supabase
        .channel(`call_sessions:trainer_${trainerId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'call_sessions',
            filter: `trainer_id=eq.${trainerId}`
          },
          (payload) => {
            console.log('📞 Call event received:', payload);

            if (payload.eventType === 'INSERT') {
              const call = payload.new;
              if (call.status === 'ringing' || call.status === 'calling') {
                console.log('📱 Incoming call from:', call.caller_user_id);
                this.onIncomingCall?.(call);
              }
            }

            if (payload.eventType === 'UPDATE') {
              const call = payload.new;
              console.log('🔄 Call status changed to:', call.status);
              this.onCallStatusChange?.(call);
            }

            if (payload.eventType === 'DELETE') {
              console.log('❌ Call cancelled');
            }
          }
        )
        .subscribe();

      console.log(`✅ Listening for calls for trainer: ${trainerId}`);
    } catch (error) {
      console.error('❌ Failed to start listening for calls:', error);
      throw error;
    }
  }

  // Stop listening for calls
  stopListeningForCalls() {
    try {
      if (this.callSubscription) {
        this.supabase.removeChannel(this.callSubscription);
        this.callSubscription = null;
        console.log('🔕 Stopped listening for calls');
      }
    } catch (error) {
      console.error('❌ Failed to stop listening:', error);
    }
  }

  // Fetch Agora token + uid from Supabase Edge Function
  async fetchAgoraToken(channelName) {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    console.log(`🔗 [REALTIME] Calling backend: ${apiUrl}/api/agora/generate-token`);
    
    const res = await fetch(`${apiUrl}/api/agora/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName })
    });

    if (!res.ok) {
      console.error(`❌ [REALTIME] Token fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    if (!data?.token) {
      console.error('❌ [REALTIME] Invalid token response:', data);
      return null;
    }

    console.log('✅ [REALTIME] Token fetched from backend | uid=', data.uid);
    return data;
  } catch (err) {
    console.error('❌ [REALTIME] ERROR fetching Agora token:', err);
    return null;
  }
}

// Trainer initiates a call to a client (web dashboard)
  async startCall(trainerId, calleeUserId, appointmentId, channelName) {
  try {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .insert({
        appointment_id: appointmentId,
        trainer_id: trainerId,
        user_id: calleeUserId,
        caller_user_id: calleeUserId,
        channel_name: channelName,
        status: 'ringing',
        initiated_by: 'trainer'
      })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Call session created:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Failed to start call:', error);
      throw error;
    }
  }

  // Listen for status changes on a single call (used by the outgoing-call screen)
  listenToCallStatus(callId, onStatusChange) {
    return this.supabase
      .channel(`call_status:${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${callId}` },
        (payload) => onStatusChange?.(payload.new)
      )
      .subscribe();
  }

  stopListeningToCallStatus(channel) {
    if (channel) this.supabase.removeChannel(channel);
  }

  // Fetch call details
  async getCallDetails(callId) {
    try {
      const { data, error } = await this.supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch call details:', error);
      throw error;
    }
  }

  // Fetch caller details
  async getCallerDetails(userId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, email, username, avatar_url')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch caller details:', error);
      throw error;
    }
  }

  // Update call status
  async updateCallStatus(callId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        ...additionalData
      };

      if (status === 'accepted') {
        updateData.connected_at = new Date().toISOString();
      } else if (status === 'ended') {
        updateData.ended_at = new Date().toISOString();
      }

      const { data, error } = await this.supabase
        .from('call_sessions')
        .update(updateData)
        .eq('id', callId)
        .select()
        .single();

      if (error) throw error;
      console.log(`✅ Call status updated to: ${status}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to update call status:', error);
      throw error;
    }
  }

  async declineCall(callId) {
    try {
      return await this.updateCallStatus(callId, 'declined', {
        ended_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to decline call:', error);
      throw error;
    }
  }

  async acceptCall(callId) {
    try {
      return await this.updateCallStatus(callId, 'accepted');
    } catch (error) {
      console.error('❌ Failed to accept call:', error);
      throw error;
    }
  }

  async endCall(callId, durationSeconds = 0) {
    try {
      return await this.updateCallStatus(callId, 'ended', {
        duration_seconds: durationSeconds
      });
    } catch (error) {
      console.error('❌ Failed to end call:', error);
      throw error;
    }
  }

  destroy() {
    this.stopListeningForCalls();
    this.supabase = null;
    this.onIncomingCall = null;
    this.onCallStatusChange = null;
  }
}

export default new RealtimeService();