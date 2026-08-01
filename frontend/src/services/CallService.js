import AgoraRTC from 'agora-rtc-sdk-ng';

class CallService {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.remoteUsers = new Map();
    this.isJoined = false;
    this.channelName = '';
    this.uid = null;
    this.onRemoteUserLeft = null; // set by the page to react to remote hangup
  }

  // Initialize Agora client
  async initialize(agoraAppId) {
    try {
      if (this.client) {
        return this.client;
      }
      this.appId = agoraAppId;
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Event: User joined
      this.client.on('user-joined', async (user) => {
        console.log('📱 Remote user joined:', user.uid);
        this.remoteUsers.set(user.uid, user);
        await this.client.subscribe(user, 'video');
        await this.client.subscribe(user, 'audio');
        user.audioTrack?.play();
      });

      // Event: User left
      this.client.on('user-left', (user) => {
        console.log('❌ Remote user left:', user.uid);
        this.remoteUsers.delete(user.uid);
        this.onRemoteUserLeft?.(user.uid);
      });

      // Event: User published stream
      this.client.on('user-published', async (user, mediaType) => {
        console.log(`📡 User ${user.uid} published ${mediaType}`);
        if (mediaType === 'video') {
          await this.client.subscribe(user, 'video');
        }
        if (mediaType === 'audio') {
          await this.client.subscribe(user, 'audio');
          user.audioTrack?.play();
        }
      });

      // Event: User unpublished
      this.client.on('user-unpublished', (user, mediaType) => {
        console.log(`🔇 User ${user.uid} unpublished ${mediaType}`);
      });

      return this.client;
    } catch (error) {
      console.error('❌ Agora initialization failed:', error);
      throw error;
    }
  }

  // Join channel
  async joinChannel(channelName, token = null, uid = 0) {
    try {
      if (!this.client) {
        throw new Error('Agora client not initialized');
      }

      this.channelName = channelName;
      this.uid = uid;

      const actualUid = await this.client.join(
        this.appId,
        channelName,
        token,
        uid
      );
      console.log(`✅ Joined channel: ${channelName} with UID: ${actualUid}`);

      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      await this.client.publish([this.localAudioTrack, this.localVideoTrack]);
      console.log('📤 Published local tracks');

      this.isJoined = true;
      return actualUid;
    } catch (error) {
      console.error('❌ Failed to join channel:', error);
      throw error;
    }
  }

  // Leave channel & cleanup
  async leaveChannel() {
    try {
      if (!this.client) return;

      if (this.isJoined) {
        await this.client.unpublish([this.localAudioTrack, this.localVideoTrack]);
        this.localAudioTrack?.close();
        this.localVideoTrack?.close();
        await this.client.leave();
        console.log('🚪 Left channel');
      }

      this.isJoined = false;
      this.remoteUsers.clear();
      this.localAudioTrack = null;
      this.localVideoTrack = null;
    } catch (error) {
      console.error('❌ Error leaving channel:', error);
    }
  }

  async toggleAudio(enabled) {
    try {
      if (this.localAudioTrack) {
        await this.localAudioTrack.setEnabled(enabled);
        console.log(`🔊 Audio: ${enabled ? 'ON' : 'OFF'}`);
      }
    } catch (error) {
      console.error('❌ Failed to toggle audio:', error);
    }
  }

  async toggleVideo(enabled) {
    try {
      if (this.localVideoTrack) {
        await this.localVideoTrack.setEnabled(enabled);
        console.log(`📹 Video: ${enabled ? 'ON' : 'OFF'}`);
      }
    } catch (error) {
      console.error('❌ Failed to toggle video:', error);
    }
  }

  async switchCamera() {
    try {
      if (this.localVideoTrack) {
        await this.localVideoTrack.switchDevice('videoinput');
        console.log('🔄 Camera switched');
      }
    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
    }
  }

  getLocalVideoTrack() {
    return this.localVideoTrack;
  }

  getRemoteUsers() {
    return Array.from(this.remoteUsers.values());
  }

  getRemoteUser(uid) {
    return this.remoteUsers.get(uid);
  }

  async destroy() {
    await this.leaveChannel();
    this.client?.removeAllListeners();
    this.client = null;
  }
}

export default new CallService();