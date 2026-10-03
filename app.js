// 1. Initialize Leaflet Map centered globally
const map = L.map('map').setView([23.6850, 90.3563], 5); // Default center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors | NASA Earthdata'
}).addTo(map);

// 2. Setup Tone.js Synthesizers
const synthMelody = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 1 }
}).toDestination();

const synthBass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.1, decay: 0.4, sustain: 0.5, release: 1.2 }
}).toDestination();

const noiseSynth = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
}).toDestination();

let currentData = null;
let activeMarker = null;

// 3. Generate Earth Observation Data based on Coordinates
function getSimulatedNasaData(lat, lng) {
  // Derive climatic values using latitude-based mathematical models
  const temp = (35 - Math.abs(lat) * 0.4 + (Math.random() * 4 - 2)).toFixed(1);
  const ndvi = Math.max(0.05, (0.75 - Math.abs(lat) * 0.008 + (Math.random() * 0.15 - 0.075))).toFixed(2);
  const rain = Math.floor(Math.max(0, 150 - Math.abs(lat) * 1.5 + (Math.random() * 80 - 40)));

  return { lat, lng, temp: parseFloat(temp), ndvi: parseFloat(ndvi), rain };
}

// 4. Sonify Earth Data into Polyphonic Audio
function playPolyphonicAudio(data) {
  Tone.start(); // Enable Web Audio context

  // A. Temperature -> Melody Pitch (C Major Pentatonic Scale)
  const melodyScale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'];
  const melodyIndex = Math.floor((Math.min(Math.max(data.temp, 0), 40) / 40) * (melodyScale.length - 1));
  const melodyNote = melodyScale[melodyIndex];

  // B. Vegetation Index (NDVI) -> Sub-Bass Pitch
  const bassScale = ['C2', 'D2', 'E2', 'G2', 'A2'];
  const bassIndex = Math.floor(data.ndvi * (bassScale.length - 1));
  const bassNote = bassScale[bassIndex];

  // Trigger Melody & Bass Synthesizers
  synthMelody.triggerAttackRelease(melodyNote, "8n");
  synthBass.triggerAttackRelease(bassNote, "4n", "+0.05");

  // C. Precipitation -> Percussion Noise Burst (if rain level > 30mm)
  if (data.rain > 30) {
    noiseSynth.triggerAttackRelease("16n", "+0.1");
  }
}

// 5. Leaflet Map Click Event Listener
map.on('click', function(e) {
  const { lat, lng } = e.latlng;

  // Update Map Marker
  if (activeMarker) map.removeLayer(activeMarker);
  activeMarker = L.marker([lat, lng]).addTo(map);

  // Retrieve environmental data
  currentData = getSimulatedNasaData(lat, lng);

  // Update UI Elements
  document.getElementById('location-name').innerText = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
  document.getElementById('temp-val').innerText = currentData.temp;
  document.getElementById('ndvi-val').innerText = currentData.ndvi;
  document.getElementById('rain-val').innerText = currentData.rain;

  // Enable Controls
  document.getElementById('play-btn').disabled = false;
  document.getElementById('stop-btn').disabled = false;

  // Immediate Audio Feedback
  playPolyphonicAudio(currentData);
});

// 6. Audio Controls Event Listeners
document.getElementById('play-btn').addEventListener('click', () => {
  if (currentData) playPolyphonicAudio(currentData);
});

document.getElementById('stop-btn').addEventListener('click', () => {
  Tone.Transport.stop();
});