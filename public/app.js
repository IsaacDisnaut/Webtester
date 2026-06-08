'use strict';

// ── Mobile / platform detection ──────────────────
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+
const IS_MOBILE = IS_IOS || /Android/i.test(navigator.userAgent);

// iOS blocks speechSynthesis.speak() unless it was triggered inside a user-gesture handler.
// We unlock it on the first meaningful button tap by speaking a silent utterance.
let ttsUnlocked = false;
function unlockTTS() {
  if (ttsUnlocked || !window.speechSynthesis) return;
  ttsUnlocked = true;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

// ════════════════════════════════════════════════
//  SESSION (login + usage tracking)
// ════════════════════════════════════════════════
let sessionId        = null;
let sessionStartTime = null;
let sessionTimerTick = null;
let currentUserName  = 'You';

function usageSeconds() {
  return sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
}

async function doLogin(name) {
  const res  = await fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  sessionId        = data.sessionId;
  sessionStartTime = Date.now();
  currentUserName  = name;
  startSessionTimer();
}

async function endSession() {
  if (!sessionId) return;
  clearInterval(sessionTimerTick);
  try {
    await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, usageSeconds: usageSeconds() }),
    });
  } catch {}
}

function startSessionTimer() {
  const chip      = $('session-chip');
  const timerEl   = $('session-timer');
  const nameEl    = $('session-name');
  nameEl.textContent = currentUserName;
  chip.style.display = 'flex';

  function tick() {
    const s = usageSeconds();
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${sec}`;
  }
  tick();
  sessionTimerTick = setInterval(tick, 1000);
}

// Flush session to DB — idempotent UPDATE so firing multiple times is safe
function flushSession() {
  if (!sessionId) return;
  const payload = JSON.stringify({ sessionId, usageSeconds: usageSeconds() });
  navigator.sendBeacon('/api/session/end-beacon', new Blob([payload], { type: 'application/json' }));
}

// Three events cover all major tab-close paths:
// beforeunload — desktop close/refresh
// pagehide     — more reliable on mobile and Chrome bfcache
// visibilitychange → hidden — catches backgrounding before a kill
window.addEventListener('beforeunload', flushSession);
window.addEventListener('pagehide', flushSession);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSession();
});

// ════════════════════════════════════════════════
//  LOGIN SCREEN
// ════════════════════════════════════════════════
function initLoginScreen() {
  const screen  = $('login-screen');
  const form    = $('login-form');
  const input   = $('name-input');
  const errorEl = $('login-error');
  const btnText = $('login-btn-text');
  const btn     = $('login-btn');

  input.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();

    // Validate
    errorEl.textContent = '';
    input.classList.remove('error');
    if (!name) {
      errorEl.textContent = 'Please enter your name.';
      input.classList.add('error');
      input.focus();
      return;
    }

    // Show loading state
    btn.disabled = true;
    btnText.textContent = 'Starting…';

    try {
      await doLogin(name);
      // Animate out login screen
      screen.classList.add('exit');
      screen.addEventListener('transitionend', () => {
        screen.style.display = 'none';
        // Boot the main app now that we have a session
        initApp();
      }, { once: true });
    } catch (err) {
      errorEl.textContent = err.message || 'Could not connect. Try again.';
      btn.disabled = false;
      btnText.textContent = 'Get Started';
    }
  });
}

// ════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════
const state = {
  mode: 'ai',
  micOn: true,
  camOn: true,
  speechOn: false,
  localStream: null,
  aiTyping: false,
};

const aiHistory = [];
const peers = {};        // peerId → { pc, dc }
let socket = null;
let iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // fallback
let recognition = null;
let interimMsgEl = null;
let currentRoomId = null;

// ════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════
const DEFAULT_SETTINGS = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful, friendly assistant. Keep responses concise and conversational.',
  ttsEnabled: false,
  ttsRate: 1.0,
  turnUrl: '',
  turnUser: '',
  turnPass: '',
};

function loadSettings() {
  try {
    const s = localStorage.getItem('vc_settings');
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
function persistSettings(s) { localStorage.setItem('vc_settings', JSON.stringify(s)); }
let settings = loadSettings();

// ════════════════════════════════════════════════
//  DOM
// ════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const localVideo       = $('local-video');
const remoteVideo      = $('remote-video');
const aiAvatar         = $('ai-avatar');
const aiSpeaking       = $('ai-speaking');
const remoteName       = $('remote-name');
const camPlaceholder   = $('cam-placeholder');
const chatMessages     = $('chat-messages');
const chatInput        = $('chat-input');
const sendBtn          = $('send-btn');
const micBtn           = $('mic-btn');
const videoBtn         = $('video-btn');
const speechBtn        = $('speech-btn');
const endBtn           = $('end-btn');
const roomBar          = $('room-bar');
const roomCodeDisplay  = $('room-code-display');
const roomStatus       = $('room-status');
const joinInput        = $('join-input');
const joinBtn          = $('join-btn');
const copyCodeBtn      = $('copy-code-btn');
const speechIndicator  = $('speech-indicator');
const settingsOverlay  = $('settings-overlay');

// ════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════
// Called after successful login
async function initApp() {
  populateSettingsForm();
  bindEventListeners();
  initSocket();
  initSpeechRecognition();
  await Promise.all([fetchIceConfig(), startLocalMedia()]);
  applyMode('ai');
  // Greet the user in chat
  showSystemMsg(`Welcome, ${currentUserName}!`);
}

// ════════════════════════════════════════════════
//  ICE / TURN CONFIG
// ════════════════════════════════════════════════
async function fetchIceConfig() {
  try {
    const res = await fetch('/api/ice-config');
    const data = await res.json();
    iceConfig = buildIceConfig(data.iceServers);
    console.log('ICE config loaded:', iceConfig.iceServers.length, 'servers');
  } catch (e) {
    console.warn('Could not fetch ICE config, using fallback STUN only.');
  }
}

function buildIceConfig(baseServers = []) {
  const servers = [...baseServers];
  // Append user's custom TURN server if set
  if (settings.turnUrl) {
    servers.push({
      urls: settings.turnUrl,
      username: settings.turnUser || '',
      credential: settings.turnPass || '',
    });
  }
  return { iceServers: servers };
}

// ════════════════════════════════════════════════
//  LOCAL MEDIA
// ════════════════════════════════════════════════
async function startLocalMedia() {
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = state.localStream;
  } catch (e) {
    console.warn('Media error:', e);
    camPlaceholder.classList.add('visible');
    showSystemMsg('Camera/mic not available — chat still works.');
  }
}

function toggleMic() {
  if (!state.localStream) return;
  state.micOn = !state.micOn;
  state.localStream.getAudioTracks().forEach(t => (t.enabled = state.micOn));
  micBtn.classList.toggle('off', !state.micOn);
  micBtn.title = state.micOn ? 'Mute microphone' : 'Unmute microphone';
}

function toggleCam() {
  if (!state.localStream) return;
  state.camOn = !state.camOn;
  state.localStream.getVideoTracks().forEach(t => (t.enabled = state.camOn));
  localVideo.classList.toggle('hidden', !state.camOn);
  camPlaceholder.classList.toggle('visible', !state.camOn);
  videoBtn.classList.toggle('off', !state.camOn);
  videoBtn.title = state.camOn ? 'Disable camera' : 'Enable camera';
}

// ════════════════════════════════════════════════
//  MODE
// ════════════════════════════════════════════════
function applyMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );

  if (mode === 'ai') {
    roomBar.style.display = 'none';
    aiAvatar.style.display = 'flex';
    remoteVideo.classList.remove('active');
    remoteName.textContent = 'AI Assistant';
    if (recognition) recognition.lang = 'en-US';
  } else {
    roomBar.style.display = 'block';
    if (!currentRoomId) generateRoomCode();
    else aiAvatar.style.display = 'none';
    // Thai is priority language for person mode
    if (recognition) recognition.lang = 'th-TH';
  }

  // Restart recognition with the new language if it's active
  if (state.speechOn && recognition) {
    try { recognition.stop(); } catch {}
  }
}

// ════════════════════════════════════════════════
//  SPEECH RECOGNITION
// ════════════════════════════════════════════════
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    speechBtn.style.display = 'none';
    if (IS_IOS) {
      // Delay so it appears after the welcome message
      setTimeout(() => showSystemMsg(
        'Speech recognition is not available on iOS Safari. Please type your messages.'
      ), 1200);
    }
    return;
  }

  recognition = new SR();
  recognition.continuous     = true;  // keep continuous on all platforms; onend handles mobile restarts
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = 'en-US'; // updated to th-TH in person mode

  recognition.onresult = (e) => {
    let interim = '';
    let finalChunk = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalChunk += t;
      else interim += t;
    }

    if (interim) {
      if (!interimMsgEl) {
        interimMsgEl = appendMessage(currentUserName, interim, 'you', true);
      } else {
        interimMsgEl.querySelector('.msg-bubble').textContent = interim;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }

    if (finalChunk) {
      if (interimMsgEl) { interimMsgEl.remove(); interimMsgEl = null; }

      if (state.mode === 'person') {
        // Auto-send immediately in person mode (no manual Enter needed)
        const trimmed = finalChunk.trim();
        if (trimmed) {
          appendMessage(currentUserName, trimmed, 'you');
          sendToPeer(trimmed);
        }
      } else {
        // AI mode: put in input box so user can review before sending
        const sep = chatInput.value.trim() ? ' ' : '';
        chatInput.value = chatInput.value.trim() + sep + finalChunk.trim();
        autoResizeInput();
      }
    }
  };

  recognition.onerror = (e) => {
    if (['not-allowed', 'service-not-allowed'].includes(e.error)) {
      showSystemMsg('Microphone access denied. Allow microphone in browser settings.');
      disableSpeech();
    } else if (e.error === 'audio-capture') {
      showSystemMsg('Cannot access microphone — it may be blocked by another app.');
      disableSpeech();
    } else if (e.error === 'network') {
      // Very common on Android (transient Google service hiccup). onend fires
      // right after this and handles the restart — no user action needed.
    }
    // no-speech / aborted — non-fatal, onend handles restart
  };

  // Auto-restart to keep listening. On mobile add a short delay to prevent
  // rapid restart loops when the browser kills continuous sessions early.
  recognition.onend = () => {
    if (state.speechOn) {
      setTimeout(() => {
        try { recognition.start(); } catch {}
      }, IS_MOBILE ? 350 : 0);
    }
  };
}

function enableSpeech() {
  if (!recognition) return;
  // Set language based on current mode
  recognition.lang = state.mode === 'person' ? 'th-TH' : 'en-US';
  state.speechOn = true;
  try { recognition.start(); } catch {}
  speechBtn.classList.add('active-speech');
  speechIndicator.style.display = 'flex';
  const hint = state.mode === 'person'
    ? 'Speech ON (ภาษาไทย) — พูดได้เลย ส่งอัตโนมัติ'
    : 'Speech ON — speak now, then press Enter to send.';
  showSystemMsg(hint);
}

function disableSpeech() {
  state.speechOn = false;
  if (recognition) try { recognition.stop(); } catch {}
  if (interimMsgEl) { interimMsgEl.remove(); interimMsgEl = null; }
  speechBtn.classList.remove('active-speech');
  speechIndicator.style.display = 'none';
}

function toggleSpeech() {
  state.speechOn ? disableSpeech() : enableSpeech();
}

// ════════════════════════════════════════════════
//  TTS (AI → voice)
// ════════════════════════════════════════════════
function speak(text) {
  if (!settings.ttsEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = settings.ttsRate || 1;
  utt.onstart = () => { aiAvatar.classList.add('speaking'); aiSpeaking.style.display = 'block'; };
  utt.onend = utt.onerror = () => { aiAvatar.classList.remove('speaking'); aiSpeaking.style.display = 'none'; };
  window.speechSynthesis.speak(utt);
}

function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  aiAvatar.classList.remove('speaking');
  aiSpeaking.style.display = 'none';
}

// ════════════════════════════════════════════════
//  PEER TTS
//  Two independent flags — they do not mirror each other:
//  myTTSEnabled   = I want MY messages spoken aloud on my peer's device.
//                   Toggled by the button; emits a signal to the peer.
//  peerTTSEnabled = My peer requested that THEIR messages be spoken on MY device.
//                   Set only when the peer sends a 'peer-tts' socket event.
// ════════════════════════════════════════════════
let myTTSEnabled   = false;
let peerTTSEnabled = false;

// Pick a Thai voice if available, else use the system default
function getThaiVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  return voices.find(v => v.lang.startsWith('th')) || null;
}

// Called when an incoming peer message arrives — speak it if the peer has
// enabled voicing for their messages (peerTTSEnabled), not our own toggle.
function speakPeerMessage(text) {
  if (!peerTTSEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const thai = getThaiVoice();
  if (thai) utt.voice = thai;
  utt.rate = 1.0;
  window.speechSynthesis.speak(utt);
}

// On-demand speaker button on each message bubble (this IS a user gesture → unlocks TTS on iOS)
function speakOnDemand(text) {
  if (!window.speechSynthesis) return;
  unlockTTS();
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const thai = getThaiVoice();
  if (thai) utt.voice = thai;
  utt.rate = 1.0;
  window.speechSynthesis.speak(utt);
}

function togglePeerTTS() {
  unlockTTS(); // button click = user gesture, satisfies iOS audio unlock
  myTTSEnabled = !myTTSEnabled;
  const btn = $('peer-tts-btn');
  btn.classList.toggle('active-speech', myTTSEnabled);
  btn.title = myTTSEnabled
    ? 'Voicing my messages ON — peer will hear what I type'
    : 'Voice my messages to peer';
  showSystemMsg(myTTSEnabled
    ? 'Your messages will be read aloud to your peer.'
    : 'Stopped voicing your messages to peer.');
  // Tell the peer to start/stop reading our messages
  if (currentRoomId && socket) {
    socket.emit('peer-tts', { roomId: currentRoomId, enabled: myTTSEnabled });
  }
}

// ════════════════════════════════════════════════
//  CHAT UI
// ════════════════════════════════════════════════
function clearWelcome() {
  const w = chatMessages.querySelector('.chat-welcome');
  if (w) w.remove();
}

function appendMessage(sender, text, side, interim = false) {
  clearWelcome();
  const wrap = document.createElement('div');
  wrap.className = `msg ${side}${interim ? ' interim' : ''}`;

  const senderEl = document.createElement('div');
  senderEl.className = 'msg-sender';
  senderEl.textContent = sender;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  wrap.appendChild(senderEl);
  wrap.appendChild(bubble);

  if (!interim) {
    const footer = document.createElement('div');
    footer.className = 'msg-footer';

    const t = document.createElement('span');
    t.className = 'msg-time';
    t.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    footer.appendChild(t);

    // Speaker button on every peer message (for deaf↔blind accessibility)
    if (side === 'peer') {
      const speakBtn = document.createElement('button');
      speakBtn.className = 'msg-speak-btn';
      speakBtn.title = 'Read aloud / อ่านออกเสียง';
      speakBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>`;
      speakBtn.addEventListener('click', () => speakOnDemand(text));
      footer.appendChild(speakBtn);
    }

    wrap.appendChild(footer);
  }

  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function showTypingIndicator() {
  const wrap = document.createElement('div');
  wrap.id = 'typing-indicator';
  wrap.className = 'msg ai';
  wrap.innerHTML = '<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}
function removeTypingIndicator() { const el = $('typing-indicator'); if (el) el.remove(); }

function showSystemMsg(text) {
  clearWelcome();
  const el = document.createElement('div');
  el.className = 'system-msg';
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Mobile browsers (especially iOS) block TTS until a user gesture occurs.
// This shows a tappable banner that unlocks the audio context on tap.
function showTapToUnlockAudio() {
  if (ttsUnlocked) return;
  // Remove any existing banner
  document.querySelectorAll('.tap-unlock-btn').forEach(e => e.remove());
  const el = document.createElement('button');
  el.className = 'tap-unlock-btn';
  el.textContent = 'Tap to enable audio for auto-read';
  el.addEventListener('click', () => {
    unlockTTS();
    el.textContent = 'Audio enabled';
    el.disabled = true;
    setTimeout(() => el.remove(), 1500);
  }, { once: true });
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ════════════════════════════════════════════════
//  SEND
// ════════════════════════════════════════════════
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  autoResizeInput();

  appendMessage(currentUserName, text, 'you');

  if (state.mode === 'ai') {
    await sendToAI(text);
  } else {
    sendToPeer(text);
  }
}

// ════════════════════════════════════════════════
//  AI API
// ════════════════════════════════════════════════
async function sendToAI(text) {
  if (state.aiTyping) return;
  state.aiTyping = true;
  aiHistory.push({ role: 'user', content: text });
  const typing = showTypingIndicator();

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        systemPrompt: settings.systemPrompt,
        messages: aiHistory,
      }),
    });
    const data = await res.json();
    typing.remove();

    if (data.error) {
      showSystemMsg(`API error: ${data.error}`);
      aiHistory.pop();
    } else {
      aiHistory.push({ role: 'assistant', content: data.content });
      appendMessage('AI', data.content, 'ai');
      speak(data.content);
    }
  } catch (err) {
    typing.remove();
    showSystemMsg(`Network error: ${err.message}`);
    aiHistory.pop();
  } finally {
    state.aiTyping = false;
  }
}

// ════════════════════════════════════════════════
//  SOCKET.IO SIGNALING
// ════════════════════════════════════════════════
function initSocket() {
  socket = io();   // connects to same origin (HTTPS)

  socket.on('room-joined', ({ roomId, peers: existingPeers }) => {
    currentRoomId = roomId;
    if (existingPeers.length) {
      setRoomStatus(`Connecting to peer(s)…`, false);
      existingPeers.forEach((pid) => startCall(pid, true));
    } else {
      setRoomStatus('Waiting for someone to join…', false);
    }
  });

  socket.on('peer-joined', (peerId) => {
    showSystemMsg('Peer joined — establishing connection…');
    startCall(peerId, false);
  });

  socket.on('signal', async ({ from, signal }) => {
    if (!peers[from]) createPeerConnection(from);
    const pc = peers[from].pc;

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, signal: pc.localDescription });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    } catch (e) {
      console.warn('Signal handling error:', e);
    }
  });

  socket.on('peer-left', (peerId) => {
    cleanupPeer(peerId);
    peerTTSEnabled = false; // reset when peer leaves; new peer starts fresh
    setRoomStatus('Peer disconnected — waiting…', false);
    showSystemMsg('Peer left the room.');
  });

  socket.on('chat-message', ({ from, message }) => {
    appendMessage('Peer', message, 'peer');
    speakPeerMessage(message);
  });

  // Peer requested that their messages be spoken on our device (or cancelled that request).
  // This sets peerTTSEnabled — it does NOT change our own toggle (myTTSEnabled).
  socket.on('peer-tts', ({ enabled }) => {
    peerTTSEnabled = enabled;
    showSystemMsg(enabled
      ? "Peer enabled voice for their messages — they'll be read aloud here."
      : 'Peer stopped voicing their messages.');
    // On mobile, speechSynthesis is blocked until a user gesture. Prompt the user
    // to tap so audio works before the first message arrives.
    if (enabled && IS_MOBILE && !ttsUnlocked) showTapToUnlockAudio();
  });

  socket.on('connect_error', (e) => {
    showSystemMsg(`Connection error: ${e.message}`);
  });
}

// ════════════════════════════════════════════════
//  WEBRTC
// ════════════════════════════════════════════════
function createPeerConnection(peerId) {
  // Use the fetched ICE config (includes TURN servers for cross-network)
  const currentIceConfig = buildIceConfig(iceConfig.iceServers);
  const pc = new RTCPeerConnection(currentIceConfig);
  peers[peerId] = { pc, dc: null };

  if (state.localStream) {
    state.localStream.getTracks().forEach((t) => pc.addTrack(t, state.localStream));
  }

  // Remote stream display
  const remoteStream = new MediaStream();
  pc.ontrack = (e) => {
    remoteStream.addTrack(e.track);
    remoteVideo.srcObject = remoteStream;
    remoteVideo.classList.add('active');
    aiAvatar.style.display = 'none';
    remoteName.textContent = 'Peer';
    setRoomStatus('Connected ●', true);
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('signal', { to: peerId, signal: candidate });
  };

  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    console.log('ICE state:', s);
    if (s === 'failed') {
      showSystemMsg('WebRTC connection failed. If peers are on different networks, check that TURN servers are reachable.');
      pc.restartIce();
    }
    if (s === 'disconnected') {
      setRoomStatus('Connection interrupted…', false);
    }
  };

  // Data channel receives (for the non-initiator side)
  pc.ondatachannel = (e) => setupDataChannel(peerId, e.channel);

  return pc;
}

function setupDataChannel(peerId, dc) {
  peers[peerId].dc = dc;
  dc.onopen = () => console.log('Data channel open with', peerId);
  dc.onmessage = (e) => { appendMessage('Peer', e.data, 'peer'); speakPeerMessage(e.data); };
  dc.onerror = (e) => console.warn('DC error:', e);
}

async function startCall(peerId, isInitiator) {
  const pc = createPeerConnection(peerId);
  if (isInitiator) {
    const dc = pc.createDataChannel('chat', { ordered: true });
    setupDataChannel(peerId, dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { to: peerId, signal: pc.localDescription });
  }
}

function cleanupPeer(peerId) {
  if (!peers[peerId]) return;
  peers[peerId].pc.close();
  delete peers[peerId];
  remoteVideo.srcObject = null;
  remoteVideo.classList.remove('active');
  if (state.mode === 'person') {
    aiAvatar.style.display = 'none';
    remoteName.textContent = 'Waiting for peer…';
  }
}

// Send via data channel (prefer) or socket relay (fallback)
function sendToPeer(text) {
  let dcSent = false;
  Object.values(peers).forEach(({ dc }) => {
    if (dc && dc.readyState === 'open') { dc.send(text); dcSent = true; }
  });
  // Socket relay as fallback (server echoes to room)
  if (currentRoomId) {
    socket.emit('chat-message', { roomId: currentRoomId, message: text });
  }
}

// ════════════════════════════════════════════════
//  ROOM
// ════════════════════════════════════════════════
function generateRoomCode() {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomCodeDisplay.textContent = code;
  currentRoomId = code;
  socket.emit('join-room', code);
  setRoomStatus('Waiting for someone to join…', false);
  aiAvatar.style.display = 'none';
  remoteName.textContent = 'Waiting for peer…';
}

function joinRoom(code) {
  const c = code.trim().toUpperCase();
  if (!c) return;
  // Clean up any existing peers before joining new room
  Object.keys(peers).forEach(cleanupPeer);
  currentRoomId = c;
  roomCodeDisplay.textContent = c;
  joinInput.value = '';
  socket.emit('join-room', c);
  setRoomStatus(`Joining room ${c}…`, false);
  aiAvatar.style.display = 'none';
  remoteName.textContent = 'Connecting…';
}

function setRoomStatus(text, connected) {
  roomStatus.textContent = text;
  roomStatus.className = 'room-status' + (connected ? ' connected' : '');
}

function endCall() {
  stopSpeaking();
  Object.keys(peers).forEach(cleanupPeer);

  if (state.mode === 'ai') {
    aiAvatar.style.display = 'flex';
    remoteName.textContent = 'AI Assistant';
    aiHistory.length = 0;
    showSystemMsg('Conversation reset.');
  } else {
    generateRoomCode();
    showSystemMsg('Call ended. New room code generated.');
  }
}

// ════════════════════════════════════════════════
//  SETTINGS MODAL
// ════════════════════════════════════════════════
function populateSettingsForm() {
  $('s-provider').value  = settings.provider;
  $('s-baseurl').value   = settings.baseUrl;
  $('s-apikey').value    = settings.apiKey;
  $('s-model').value     = settings.model;
  $('s-system').value    = settings.systemPrompt;
  $('s-tts').checked     = settings.ttsEnabled;
  $('s-rate').value      = settings.ttsRate;
  $('rate-val').textContent = settings.ttsRate;
  $('s-turn-url').value  = settings.turnUrl  || '';
  $('s-turn-user').value = settings.turnUser || '';
  $('s-turn-pass').value = settings.turnPass || '';
  toggleBaseUrlField(settings.provider);
}

function readSettingsForm() {
  return {
    provider:     $('s-provider').value,
    baseUrl:      $('s-baseurl').value || DEFAULT_SETTINGS.baseUrl,
    apiKey:       $('s-apikey').value,
    model:        $('s-model').value   || DEFAULT_SETTINGS.model,
    systemPrompt: $('s-system').value  || DEFAULT_SETTINGS.systemPrompt,
    ttsEnabled:   $('s-tts').checked,
    ttsRate:      parseFloat($('s-rate').value),
    turnUrl:      $('s-turn-url').value.trim(),
    turnUser:     $('s-turn-user').value.trim(),
    turnPass:     $('s-turn-pass').value.trim(),
  };
}

function toggleBaseUrlField(provider) {
  $('field-baseurl').style.display = provider === 'anthropic' ? 'none' : 'flex';
}

function openSettingsModal()  { populateSettingsForm(); settingsOverlay.classList.add('open'); }
function closeSettingsModal() { settingsOverlay.classList.remove('open'); }

// ════════════════════════════════════════════════
//  INPUT HELPERS
// ════════════════════════════════════════════════
function autoResizeInput() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

// ════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════
function bindEventListeners() {
  document.querySelectorAll('.mode-btn').forEach(btn =>
    btn.addEventListener('click', () => applyMode(btn.dataset.mode))
  );

  micBtn.addEventListener('click', toggleMic);
  videoBtn.addEventListener('click', toggleCam);
  speechBtn.addEventListener('click', toggleSpeech);
  endBtn.addEventListener('click', endCall);
  $('peer-tts-btn').addEventListener('click', togglePeerTTS);

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', autoResizeInput);

  joinBtn.addEventListener('click', () => joinRoom(joinInput.value));
  joinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(joinInput.value); });

  copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCodeDisplay.textContent).then(() => {
      copyCodeBtn.textContent = 'Copied!';
      setTimeout(() => (copyCodeBtn.textContent = 'Copy'), 1500);
    });
  });

  $('settings-open-btn').addEventListener('click', openSettingsModal);
  $('settings-close-btn').addEventListener('click', closeSettingsModal);
  $('settings-cancel-btn').addEventListener('click', closeSettingsModal);
  settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettingsModal(); });

  $('settings-save-btn').addEventListener('click', () => {
    settings = readSettingsForm();
    persistSettings(settings);
    closeSettingsModal();
    showSystemMsg('Settings saved.');
  });

  $('s-provider').addEventListener('change', (e) => toggleBaseUrlField(e.target.value));
  $('s-rate').addEventListener('input', (e) => {
    $('rate-val').textContent = parseFloat(e.target.value).toFixed(1);
  });

  $('toggle-key-btn').addEventListener('click', () => {
    const inp = $('s-apikey');
    const btn = $('toggle-key-btn');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'Hide'; }
    else { inp.type = 'password'; btn.textContent = 'Show'; }
  });
}

// ════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════
// Also save session when the call is manually ended
const _origEndCall = endCall;
// endCall is defined above — wrap it to also flush session time
// (we don't overwrite endCall to avoid circular ref; handled via beforeunload too)

window.addEventListener('DOMContentLoaded', () => {
  initLoginScreen();   // show login first; it calls initApp() after success
});
