type AudioSystem = typeof import("./audio");

const MUTE_STORAGE_KEY = "aperture_world_sound_muted";

let audioSystem: AudioSystem | null = null;
let audioSystemPromise: Promise<AudioSystem> | null = null;
let unlockedAudioContext: AudioContext | null = null;

/**
 * The audio implementation is intentionally absent from the launch-screen
 * dependency graph. Every camera-entry and audio-control path shares this one
 * promise, so simultaneous pointer, keyboard, and React-effect calls cannot
 * construct competing SoundEngine instances.
 */
export function loadAudioSystem(): Promise<AudioSystem> {
  if (audioSystem) return Promise.resolve(audioSystem);
  if (!audioSystemPromise) {
    audioSystemPromise = import("./audio").then(
      module => {
        if (unlockedAudioContext) module.initializeAudioContext(unlockedAudioContext);
        audioSystem = module;
        return module;
      },
      error => {
        audioSystemPromise = null;
        console.warn("Audio system failed to load; a later user action will retry.", error);
        throw error;
      },
    );
  }
  return audioSystemPromise;
}

function runAudio(effect: (system: AudioSystem) => void): void {
  if (audioSystem) {
    effect(audioSystem);
    return;
  }
  void loadAudioSystem().then(effect).catch(() => undefined);
}

// Lifecycle cleanup must follow an entry already in flight, but it must not
// become the reason an untouched launch screen downloads the audio system.
function runStartedAudio(effect: (system: AudioSystem) => void): void {
  if (audioSystem) {
    effect(audioSystem);
  } else if (audioSystemPromise) {
    void audioSystemPromise.then(effect, () => undefined);
  }
}

function storedMutePreference(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export const playShutter = (shutterSec?: number) => runAudio(system => system.playShutter(shutterSec));
export const playShutterOpen = () => runAudio(system => system.playShutterOpen());
export const playShutterClose = () => runAudio(system => system.playShutterClose());
export const playBurstClick = () => runAudio(system => system.playBurstClick());
export const playAfLock = () => runAudio(system => system.playAfLock());
export const playDialClick = (type?: "fine" | "coarse") => runAudio(system => system.playDialClick(type));
export const playZoomTick = () => runAudio(system => system.playZoomTick());
export const playModeDial = () => runAudio(system => system.playModeDial());
export const playPowerOn = () => runAudio(system => system.playPowerOn());
export const playWarning = () => runAudio(system => system.playWarning());
export const playDelete = () => runAudio(system => system.playDelete());
export const playPhotoSlide = () => runAudio(system => system.playPhotoSlide());

export const startSceneAmbience = (sceneKey: string) => runAudio(system => system.startSceneAmbience(sceneKey));
export const stopSceneAmbience = () => runStartedAudio(system => system.stopSceneAmbience());
export const pauseSceneAmbience = () => runStartedAudio(system => system.pauseSceneAmbience());
export const resumeSceneAmbience = () => runStartedAudio(system => system.resumeSceneAmbience());

export const isSoundMuted = () => audioSystem?.isSoundMuted() ?? storedMutePreference();

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    // Keep the in-memory engine usable when storage is unavailable.
  }
  runAudio(system => system.setSoundMuted(muted));
}

export function toggleSoundMuted(): boolean {
  const muted = !isSoundMuted();
  setSoundMuted(muted);
  return muted;
}

export function unlockAudio(): void {
  if (!unlockedAudioContext && typeof window !== "undefined") {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      try {
        unlockedAudioContext = new AudioCtx();
        if (unlockedAudioContext.state === "suspended") void unlockedAudioContext.resume();
      } catch {
        unlockedAudioContext = null;
      }
    }
  }
  runAudio(system => {
    if (unlockedAudioContext) system.initializeAudioContext(unlockedAudioContext);
    system.unlockAudio();
  });
}
