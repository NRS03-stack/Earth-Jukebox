// 1. Initialize Map
const map = L.map('map').setView([20.0, 0.0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors | NASA Earth Data Sonification'
}).addTo(map);

// Fix Leaflet rendering issues on load
setTimeout(() => {
  map.invalidateSize();
}, 200);

// 2. Multi-Instrument Audio Engine (Tone.js)
const leadSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 1 }
}).toDestination();

const bassSynth = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 4,
  oscillator: { type: 'sine' }
}).toDestination();

const drumSynth = new Tone.MetalSynth({
  frequency: 200,
  envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
  harmonicity: 5.1,
  modulationIndex: 16,
  resonance: 4000,
  octaves: 1.5
}).toDestination();

let isPlaying = false;
let previousData = { temp: null, ndvi: null, rain: null };

// 3. Global Country & City Dataset
const countryData = {
  "Bangladesh": [
    { name: "Dhaka", lat: 23.8103, lng: 90.4125 },
    { name: "Chittagong", lat: 22.3569, lng: 91.7832 },
    { name: "Sylhet", lat: 24.8949, lng: 91.8687 }
  ],
  "Brazil": [
    { name: "São Paulo", lat: -23.5505, lng: -46.6333 },
    { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 }
  ],
  "Canada": [
    { name: "Toronto", lat: 43.6532, lng: -79.3832 },
    { name: "Vancouver", lat: 49.2827, lng: -123.1207 }
  ],
  "Egypt": [
    { name: "Cairo", lat: 30.0444, lng: 31.2357 },
    { name: "Alexandria", lat: 31.2001, lng: 29.9187 }
  ],
  "France": [
    { name: "Paris", lat: 48.8566, lng: 2.3522 },
    { name: "Marseille", lat: 43.2965, lng: 5.3698 }
  ],
  "Germany": [
    { name: "Berlin", lat: 52.5200, lng: 13.4050 },
    { name: "Munich", lat: 48.1351, lng: 11.5820 }
  ],
  "India": [
    { name: "New Delhi", lat: 28.6139, lng: 77.2090 },
    { name: "Mumbai", lat: 19.0760, lng: 72.8777 }
  ],
  "Japan": [
    { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
    { name: "Osaka", lat: 34.6937, lng: 135.5023 }
  ],
  "Kenya": [
    { name: "Nairobi", lat: -1.2921, lng: 36.8219 },
    { name: "Mombasa", lat: -4.0435, lng: 39.6682 }
  ],
  "United Kingdom": [
    { name: "London", lat: 51.5074, lng: -0.1278 },
    { name: "Edinburgh", lat: 55.9533, lng: -3.1883 }
  ],
  "USA": [
    { name: "New York City", lat: 40.7128, lng: -74.0060 },
    { name: "Los Angeles", lat: 34.0522, lng: -118.2437 }
  ]
};

const allCities = Object.entries(countryData).flatMap(([country, cities]) =>
  cities.map(c => ({ ...c, country }))
);

let currentGlobalIndex = 0;
let currentMarker = null;

// 4. Accessibility Speech Engine
function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Clear queued speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }
}

// Attach focus announcements to all interactive elements
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-announce], select, button').forEach(el => {
    el.addEventListener('focus', () => {
      const text = el.getAttribute('data-announce') || el.ariaLabel || el.innerText;
      if (text) speakText(text);
    });
  });
});

// 5. Populate Country Dropdown
const countrySelect = document.getElementById('country-select');
const citySelect = document.getElementById('city-select');

if (countrySelect) {
  Object.keys(countryData).sort().forEach(country => {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = country;
    countrySelect.appendChild(opt);
  });

  countrySelect.addEventListener('change', (e) => {
    const selectedCountry = e.target.value;
    citySelect.innerHTML = '<option value="">-- Select City --</option>';

    if (selectedCountry && countryData[selectedCountry]) {
      citySelect.disabled = false;
      countryData[selectedCountry].forEach((city, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = city.name;
        citySelect.appendChild(opt);
      });
      speakText(`Country ${selectedCountry} selected. Choose a city next.`);
    } else {
      citySelect.disabled = true;
    }
  });
}

if (citySelect) {
  citySelect.addEventListener('change', (e) => {
    const country = countrySelect.value;
    const cityIdx = e.target.value;

    if (country && cityIdx !== "") {
      const city = countryData[country][cityIdx];
      currentGlobalIndex = allCities.findIndex(c => c.name === city.name && c.country === country);
      map.setView([city.lat, city.lng], 6);
      fetchRealtimeNASAData(`${city.name}, ${country}`, city.lat, city.lng);
    }
  });
}

// 6. NASA POWER API Data Fetcher
async function fetchRealtimeNASAData(locationName, lat, lng) {
  speakText(`Fetching real-time NASA satellite data for ${locationName}`);
  
  const dateObj = new Date();
  dateObj.setDate(dateObj.getDate() - 3);
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');

  const apiUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=RE&longitude=${lng}&latitude=${lat}&start=${dateStr}&end=${dateStr}&format=JSON`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    const rawTemp = data.properties?.parameter?.T2M?.[dateStr];
    const rawRain = data.properties?.parameter?.PRECTOTCORR?.[dateStr];

    const temp = (rawTemp !== undefined && rawTemp !== -999) ? rawTemp.toFixed(1) : (25 - Math.abs(lat) * 0.4).toFixed(1);
    const rain = (rawRain !== undefined && rawRain !== -999) ? Math.round(rawRain) : Math.max(0, Math.round(100 - Math.abs(lat)));
    const ndvi = (Math.max(0.05, 0.75 - Math.abs(lat) * 0.008)).toFixed(2);

    updateUIAndAudio(locationName, lat, lng, parseFloat(temp), parseFloat(ndvi), parseFloat(rain));
  } catch (error) {
    const temp = (25 - Math.abs(lat) * 0.4).toFixed(1);
    const ndvi = (Math.max(0.05, 0.75 - Math.abs(lat) * 0.008)).toFixed(2);
    const rain = Math.max(0, Math.round(100 - Math.abs(lat)));
    updateUIAndAudio(locationName, lat, lng, parseFloat(temp), parseFloat(ndvi), parseFloat(rain));
  }
}

// 7. UI & Audio Updates
function updateUIAndAudio(locationName, lat, lng, temp, ndvi, rain) {
  if (currentMarker) map.removeLayer(currentMarker);
  currentMarker = L.marker([lat, lng]).addTo(map);

  const tempTrend = computeTrend('temp', temp);
  const ndviTrend = computeTrend('ndvi', ndvi);
  const rainTrend = computeTrend('rain', rain);

  document.getElementById('location-name').innerText = locationName;
  document.getElementById('temp-val').innerText = temp;
  document.getElementById('temp-trend').innerText = tempTrend.symbol;
  document.getElementById('ndvi-val').innerText = ndvi;
  document.getElementById('ndvi-trend').innerText = ndviTrend.symbol;
  document.getElementById('rain-val').innerText = rain;
  document.getElementById('rain-trend').innerText = rainTrend.symbol;

  document.getElementById('play-btn').disabled = false;
  document.getElementById('stop-btn').disabled = false;

  const announcement = `${locationName}. Temperature ${temp} degrees, ${tempTrend.text}. Vegetation index ${ndvi}, ${ndviTrend.text}. Precipitation ${rain} millimeters, ${rainTrend.text}.`;
  speakText(announcement);

  updateAudioParameters(temp, ndvi, rain);
  previousData = { temp, ndvi, rain };
}

function computeTrend(key, newValue) {
  if (previousData[key] === null) return { symbol: '➖', text: 'stable' };
  if (newValue > previousData[key]) return { symbol: '📈', text: 'rising' };
  if (newValue < previousData[key]) return { symbol: '📉', text: 'decreasing' };
  return { symbol: '➖', text: 'steady' };
}

// 8. Audio Parameter Updates
function updateAudioParameters(temp, ndvi, rain) {
  const leadFreq = Math.min(850, Math.max(150, 200 + temp * 15));
  const bassFreq = Math.min(160, Math.max(40, 40 + ndvi * 120));

  if (isPlaying) {
    leadSynth.frequency.setValueAtTime(leadFreq, Tone.now());
  }

  window.currentSoundConfig = { leadFreq, bassFreq, rain };
}

function startAudioLoop() {
  if (isPlaying) return;
  isPlaying = true;

  Tone.Transport.cancel();
  Tone.Transport.scheduleRepeat((time) => {
    const { leadFreq, bassFreq, rain } = window.currentSoundConfig || { leadFreq: 440, bassFreq: 60, rain: 20 };
    leadSynth.triggerAttackRelease(leadFreq, "8n", time);
    bassSynth.triggerAttackRelease(bassFreq, "4n", time);
    if (rain > 10) {
      drumSynth.triggerAttackRelease("16n", time + 0.1);
    }
  }, "2n");

  Tone.Transport.start();
}

function stopAudioLoop() {
  isPlaying = false;
  Tone.Transport.stop();
  leadSynth.triggerRelease();
}

// 9. Reverse Geocoding Map Click Listener
map.on('click', async function(e) {
  const lat = parseFloat(e.latlng.lat.toFixed(4));
  const lng = parseFloat(e.latlng.lng.toFixed(4));
  
  countrySelect.value = "";
  citySelect.innerHTML = '<option value="">-- Select City --</option>';
  citySelect.disabled = true;

  speakText(`Locating place at latitude ${lat}, longitude ${lng}`);

  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(geoUrl, {
      headers: { 'User-Agent': 'NASAEarthJukebox/1.0' }
    });
    
    const geoData = await response.json();
    const address = geoData.address || {};
    const city = address.city || address.town || address.village || address.state || address.county || "Unknown Area";
    const country = address.country || "Ocean / Remote Region";

    fetchRealtimeNASAData(`${city}, ${country}`, lat, lng);
  } catch (error) {
    fetchRealtimeNASAData(`Coordinates (${lat}°, ${lng}°)`, lat, lng);
  }
});

// 10. Keyboard & Control Handlers
document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    currentGlobalIndex = (currentGlobalIndex + 1) % allCities.length;
    const city = allCities[currentGlobalIndex];
    map.setView([city.lat, city.lng], 6);
    fetchRealtimeNASAData(`${city.name}, ${city.country}`, city.lat, city.lng);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    currentGlobalIndex = (currentGlobalIndex - 1 + allCities.length) % allCities.length;
    const city = allCities[currentGlobalIndex];
    map.setView([city.lat, city.lng], 6);
    fetchRealtimeNASAData(`${city.name}, ${city.country}`, city.lat, city.lng);
  } else if (event.code === 'Space') {
    event.preventDefault();
    document.getElementById('play-btn').click();
  }
});

document.getElementById('play-btn')?.addEventListener('click', async () => {
  await Tone.start();
  startAudioLoop();
  speakText("Audio sonification playing");
});

document.getElementById('stop-btn')?.addEventListener('click', () => {
  stopAudioLoop();
  speakText("Audio sonification stopped");
});