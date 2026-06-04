/**
 * Psychological Audio Engine for LocalEats Flight-Deck
 * Uses Web Audio API for offline-safe, asset-free, clean sound synthesis
 * avoids network dependency, slow loads, and CORS blockages.
 */

class PsychologicalAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    return this.ctx!;
  }

  /**
   * Resumes the AudioContext if it is suspended due to browser autoplay policies.
   */
  private async ensureResume(): Promise<void> {
    try {
      const context = this.getContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
    } catch (e) {
      console.warn('Audio Context resume failed:', e);
    }
  }

  /**
   * 1. LOW-FREQUENCY BINAURAL UPLINK (Order Assigned / Accepted)
   * High-focus, reassuring rising vector. Stimulates dopamine production and tactical focus.
   * Sine wave starting at 220Hz sweeping smoothly to 440Hz over 0.6 seconds.
   */
  public async playOrderAssigned(): Promise<void> {
    await this.ensureResume();
    try {
      const context = this.getContext();
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'triangle'; // Richer harmonics than pure sine, still warm and pleasant
      osc.frequency.setValueAtTime(220, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.5);

      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start(context.currentTime);
      osc.stop(context.currentTime + 0.6);

      // Trigger matched tactile pattern
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 100, 150]);
      }
    } catch (err) {
      console.warn('Failed to synthesize OrderAssigned audio:', err);
    }
  }

  /**
   * 2. HARMONIC ARPEGGIO (Arrived at Destination Point)
   * Inspires completion relief, accomplishment, and navigational success.
   * Sequential arpeggiated C-major warm triad: C4, E4, G4, C5 sustaining together.
   */
  public async playArrivedDestination(): Promise<void> {
    await this.ensureResume();
    try {
      const context = this.getContext();
      const notes = [
        { freq: 261.63, delay: 0 },   // C4
        { freq: 329.63, delay: 0.1 }, // E4
        { freq: 392.00, delay: 0.2 }, // G4
        { freq: 523.25, delay: 0.3 }  // C5
      ];

      notes.forEach((note) => {
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, context.currentTime + note.delay);

        gain.gain.setValueAtTime(0, context.currentTime + note.delay);
        gain.gain.linearRampToValueAtTime(0.2, context.currentTime + note.delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + note.delay + 0.8);

        osc.connect(gain);
        gain.connect(context.destination);

        osc.start(context.currentTime + note.delay);
        osc.stop(context.currentTime + note.delay + 0.9);
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 50, 150]);
      }
    } catch (err) {
      console.warn('Failed to synthesize ArrivedDestination audio:', err);
    }
  }

  /**
   * 3. DOUBLE PULSE LOW RESONANCE WARNING (Route Deviation / Wrong Road Segment / Out of Sector)
   * Deep low-band pass pulses warning the driver gracefully (140Hz) without inciting panic.
   */
  public async playWrongTurnWarning(): Promise<void> {
    await this.ensureResume();
    try {
      const context = this.getContext();
      const pulses = [0, 0.35];

      pulses.forEach((delay) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, context.currentTime + delay);
        
        // Lowpass filter sweeps high frequencies to sound deep & authoritative, not screechy
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, context.currentTime + delay);
        filter.frequency.exponentialRampToValueAtTime(100, context.currentTime + delay + 0.25);
        filter.Q.setValueAtTime(8, context.currentTime + delay);

        gain.gain.setValueAtTime(0, context.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.4, context.currentTime + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);

        osc.start(context.currentTime + delay);
        osc.stop(context.currentTime + delay + 0.32);
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([400, 100, 400]);
      }
    } catch (err) {
      console.warn('Failed to synthesize WrongTurnWarning audio:', err);
    }
  }

  /**
   * 4. CELEBRATORY EXALTATION SWEET CHORD (Mission Delivered & Cash Logged)
   * High frequency shimmer + rising victory sweep to validate rewarding efforts.
   */
  public async playOrderDelivered(): Promise<void> {
    await this.ensureResume();
    try {
      const context = this.getContext();
      const arpeggio = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];

      arpeggio.forEach((freq, idx) => {
        const osc = context.createOscillator();
        const gain = context.createGain();

        // Staggered trigger for each note
        const noteDelay = idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, context.currentTime + noteDelay);

        gain.gain.setValueAtTime(0, context.currentTime + noteDelay);
        gain.gain.linearRampToValueAtTime(0.18, context.currentTime + noteDelay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + noteDelay + 0.6);

        osc.connect(gain);
        gain.connect(context.destination);

        osc.start(context.currentTime + noteDelay);
        osc.stop(context.currentTime + noteDelay + 0.7);
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 300]);
      }
    } catch (err) {
      console.warn('Failed to synthesize OrderDelivered audio:', err);
    }
  }
}

export const audioSynth = new PsychologicalAudioEngine();
