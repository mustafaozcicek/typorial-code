// Exhibition playback. Visitor events always take priority over the timer.
window.createTyporialIdle = function ({ setText, onStateChange, onPhrase = () => {}, onIdleReset = () => {}, config }) {
  function validate(value) {
    const timing = {
      idleAfterSeconds: [1, 3600], typeIntervalMs: [20, 5000],
      eraseIntervalMs: [10, 5000], holdSeconds: [0, 300],
      betweenPhrasesSeconds: [0, 60],
    };
    if (!value || !Array.isArray(value.phrases) || !value.phrases.length) {
      throw new Error('Include a nonempty phrases array.');
    }
    const phrases = value.phrases.map(entry => {
      const phrase = typeof entry === 'string' ? { text: entry } : entry;
      if (!phrase || typeof phrase.text !== 'string' || !phrase.text.trim() || phrase.text.length > 2000) {
        throw new Error('Each phrase needs text (1–2,000 characters).');
      }
      if (phrase.scale !== undefined &&
          (!Number.isInteger(phrase.scale) || phrase.scale < 2 || phrase.scale > 48)) {
        throw new Error('Phrase scale must be a whole number from 2 to 48.');
      }
      if (phrase.glyphStyle !== undefined && phrase.glyphStyle !== 1 && phrase.glyphStyle !== 2) {
        throw new Error('Phrase glyphStyle must be 1 (rounded serif) or 2 (geometric).');
      }
      return { text: phrase.text, scale: phrase.scale, glyphStyle: phrase.glyphStyle };
    });
    for (const [key, [min, max]] of Object.entries(timing)) {
      if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) {
        throw new Error(`${key} must be a number between ${min} and ${max}.`);
      }
    }
    return { ...value, phrases };
  }

  let settings = validate(config);
  let timer;
  let resetTimer;
  let active = false;
  let hasInteracted = false;
  let composing = false;
  let suspended = document.hidden;
  let phraseIndex = 0;
  let characters = [];
  let length = 0;

  function schedule(callback, delay) {
    clearTimeout(timer);
    timer = setTimeout(callback, delay);
  }
  function arm() {
    clearTimeout(timer);
    if (!suspended && !composing) schedule(start, settings.idleAfterSeconds * 1000);
  }
  function stop() {
    clearTimeout(timer);
    if (active) {
      active = false;
      onStateChange(false);
      setText('');
    }
  }
  function armReset() {
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      if (composing) { armReset(); return; }
      onIdleReset();
    }, 5 * 60 * 1000);
  }
  function activity() { hasInteracted = true; armReset(); stop(); arm(); }
  function start() {
    if (suspended || composing) return;
    active = true;
    onStateChange(true);
    nextPhrase();
  }
  function nextPhrase() {
    const phrase = settings.phrases[phraseIndex];
    onPhrase(phrase);
    characters = [...phrase.text];
    phraseIndex = (phraseIndex + 1) % settings.phrases.length;
    length = 0;
    setText('');
    type();
  }
  function type() {
    if (!active) return;
    setText(characters.slice(0, ++length).join(''));
    if (length < characters.length) schedule(type, settings.typeIntervalMs);
    else schedule(erase, settings.holdSeconds * 1000);
  }
  function erase() {
    if (!active) return;
    setText(characters.slice(0, --length).join(''));
    if (length > 0) schedule(erase, settings.eraseIntervalMs);
    else schedule(nextPhrase, settings.betweenPhrasesSeconds * 1000);
  }

  // Capture runs before the canvas's typing and paste handlers.
  for (const event of ['pointerdown', 'keydown', 'input', 'paste', 'wheel', 'change']) {
    document.addEventListener(event, activity, { capture: true, passive: true });
  }
  document.addEventListener('pointermove', armReset, { passive: true });
  document.addEventListener('compositionstart', () => {
    composing = true;
    armReset();
    hasInteracted = true;
    stop();
  }, true);
  document.addEventListener('compositionend', () => {
    composing = false;
    armReset();
    arm();
  }, true);
  document.addEventListener('visibilitychange', () => {
    suspended = document.hidden;
    if (suspended) stop();
    else if (!hasInteracted) start();
    else arm();
  });

  // Start the exhibition on arrival; only visitor activity starts the delay.
  // Page visibility, rather than window focus, controls suspension.
  armReset();
  start();
  return {
    configure(value) {
      const next = validate(value);
      const resumePlayback = active || !hasInteracted;
      stop();
      settings = next;
      phraseIndex = 0;
      if (resumePlayback) start();
      else arm();
    },
  };
};
