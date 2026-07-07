const state = {
  language: "ar",
  audioContext: null,
  musicNodes: [],
  musicStarted: false,
  muted: false
};

const placeholders = {
  embed: "PASTE_GOOGLE_MAPS_EMBED_URL_HERE",
  open: "PASTE_GOOGLE_MAPS_LINK_HERE"
};

const introScreen = document.querySelector(".intro-screen");
const envelopeButton = document.querySelector(".envelope-button");
const siteShell = document.querySelector(".site-shell");
const languageToggle = document.querySelector(".language-toggle");
const musicToggle = document.querySelector(".music-toggle");
const mapBox = document.querySelector("#mapBox");
const mapsButton = document.querySelector("#mapsButton");

function getEventDateTime() {
  const [timePart, period = "AM"] = invitationConfig.eventTime.trim().split(/\s+/);
  const [rawHours, rawMinutes = 0] = timePart.split(":").map(Number);
  const hours =
    period.toUpperCase() === "PM" && rawHours < 12
      ? rawHours + 12
      : period.toUpperCase() === "AM" && rawHours === 12
        ? 0
        : rawHours;
  const targetTime = `${String(hours).padStart(2, "0")}:${String(rawMinutes).padStart(2, "0")}:00`;

  return new Date(`${invitationConfig.eventDate}T${targetTime}${invitationConfig.eventUtcOffset}`);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(state.language === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: invitationConfig.eventTimeZone
  }).format(date);
}

function formatTime() {
  if (state.language === "ar") {
    return invitationConfig.eventTime.replace("PM", "مساء").replace("AM", "صباحا");
  }

  return invitationConfig.eventTime;
}

function getValue(key) {
  const lang = state.language;
  const eventDate = getEventDateTime();
  const values = {
    coupleNames: invitationConfig.coupleNames[lang],
    initials: invitationConfig.initials[lang],
    eventType: invitationConfig.eventType[lang],
    venueName: invitationConfig.venueName[lang],
    address: invitationConfig.address[lang],
    formattedDate: formatDate(eventDate),
    eventTime: formatTime()
  };

  return values[key] || "";
}

function renderLanguage() {
  const lang = state.language;
  const copy = invitationConfig.translations[lang];

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.body.dataset.lang = lang;
  languageToggle.textContent = lang === "ar" ? "EN" : "AR";

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = copy[node.dataset.i18n] || "";
  });

  document.querySelectorAll("[data-bind]").forEach((node) => {
    node.textContent = getValue(node.dataset.bind);
  });

  renderMap();
}

function renderMap() {
  const copy = invitationConfig.translations[state.language];
  const hasEmbed = invitationConfig.mapEmbedUrl !== placeholders.embed;
  const hasOpen = invitationConfig.mapOpenUrl !== placeholders.open;

  if (hasEmbed) {
    mapBox.innerHTML = `<iframe title="${copy.location}" src="${invitationConfig.mapEmbedUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
  } else {
    mapBox.innerHTML = `<p>${copy.mapUnavailable}</p>`;
  }

  mapsButton.href = hasOpen ? invitationConfig.mapOpenUrl : "#";
  mapsButton.classList.toggle("is-disabled", !hasOpen);
}

function updateCountdown() {
  const target = getEventDateTime().getTime();
  const distance = Math.max(target - Date.now(), 0);
  const values = {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((distance / (1000 * 60)) % 60),
    seconds: Math.floor((distance / 1000) % 60)
  };

  Object.entries(values).forEach(([key, value]) => {
    const node = document.querySelector(`[data-countdown="${key}"]`);
    if (!node) return;
    const nextValue = String(value).padStart(2, "0");
    if (node.textContent !== nextValue) {
      node.textContent = nextValue;
    }
  });
}

function startMusic() {
  if (state.musicStarted) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const master = context.createGain();
  const delay = context.createDelay();
  const feedback = context.createGain();
  const filter = context.createBiquadFilter();

  master.gain.value = 0.13;
  delay.delayTime.value = 0.34;
  feedback.gain.value = 0.22;
  filter.type = "lowpass";
  filter.frequency.value = 950;

  master.connect(filter);
  filter.connect(context.destination);
  master.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(filter);

  const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
  let step = 0;

  function playNote() {
    if (state.muted) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const noteGain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(notes[step % notes.length], now);
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(0.72, now + 0.08);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

    oscillator.connect(noteGain);
    noteGain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 1.8);

    step += 1;
  }

  playNote();
  const interval = window.setInterval(playNote, 760);

  state.audioContext = context;
  state.musicNodes = [master, interval];
  state.musicStarted = true;
  musicToggle.classList.remove("is-muted");
}

function toggleMusic() {
  state.muted = !state.muted;
  musicToggle.classList.toggle("is-muted", state.muted);

  if (!state.musicStarted && !state.muted) {
    startMusic();
    return;
  }

  const master = state.musicNodes[0];
  if (master) {
    master.gain.value = state.muted ? 0 : 0.13;
  }
}

envelopeButton.addEventListener("click", () => {
  introScreen.classList.add("is-open");
  siteShell.classList.add("is-visible");
  siteShell.removeAttribute("aria-hidden");
  startMusic();
});

languageToggle.addEventListener("click", () => {
  state.language = state.language === "ar" ? "en" : "ar";
  renderLanguage();
});

musicToggle.addEventListener("click", toggleMusic);

renderLanguage();
updateCountdown();
window.setInterval(updateCountdown, 1000);
