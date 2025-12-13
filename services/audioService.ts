// Helper to generate a pleasant chime sound using Web Audio API
// This avoids needing external MP3 files and works offline.
const playChime = async (ctx: AudioContext) => {
  const t = ctx.currentTime;
  
  const oscillator1 = ctx.createOscillator();
  const oscillator2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator1.connect(gainNode);
  oscillator2.connect(gainNode);
  gainNode.connect(ctx.destination);

  // First Note (Higher) - "Ting"
  oscillator1.frequency.setValueAtTime(660, t); // E5
  oscillator2.frequency.setValueAtTime(660, t); 
  
  // Second Note (Lower) - "Nung"
  oscillator1.frequency.setValueAtTime(554.37, t + 0.6); // C#5
  oscillator2.frequency.setValueAtTime(554.37, t + 0.6);

  // Envelope (Fade out)
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(0.3, t + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.6); // End of first note
  gainNode.gain.linearRampToValueAtTime(0.3, t + 0.7); // Start of second note
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + 2.0); // Fade out

  oscillator1.start(t);
  oscillator2.start(t);
  
  oscillator1.stop(t + 2.5);
  oscillator2.stop(t + 2.5);

  // Return promise that resolves when chime finishes
  return new Promise<void>(resolve => setTimeout(resolve, 1500));
};

export const announceQueue = async (queueNumber: string) => {
  try {
    // 1. Initialize Audio Context for Chime
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      await playChime(ctx);
    }

    // 2. Prepare Text to Speech
    // Format: "A-005" -> "A... Lima"
    const parts = queueNumber.split('-');
    const letter = parts[0] || '';
    const numberStr = parts[1] || '';
    const number = parseInt(numberStr, 10); // Remove leading zeros for natural speech

    const textToSpeak = `Nomor Antrian... ${letter}... ${number}... Silakan menuju loket satu`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'id-ID'; // Indonesian
    utterance.rate = 0.9; // Slightly slower
    utterance.pitch = 1;
    utterance.volume = 1;

    // Use a female voice if available (usually sounds clearer for announcements)
    const voices = window.speechSynthesis.getVoices();
    const indoVoice = voices.find(v => v.lang.includes('id'));
    if (indoVoice) utterance.voice = indoVoice;

    window.speechSynthesis.speak(utterance);

  } catch (e) {
    console.error("Audio playback failed", e);
  }
};