<template>
<div class="dashboard-card weather-info">
  <h2>Weather & Local Info</h2>

  <div class="weather-controls">
    <div class="input-wrapper">
      <input
        v-model="searchTerm"
        @input="onSearchInput"
        class="dest-input"
        type="text"
        placeholder="Enter city, country, ZIP, lat,lng, iata:XXX, etc."
        aria-label="Search for a destination"
      />
      <ul v-if="suggestions.length" class="suggestions-list" role="listbox">
        <li
          v-for="item in suggestions"
          :key="item.id"
          @click="selectSuggestion(item)"
          class="suggestion-item"
          role="option"
          tabindex="0"
          @keydown.enter="selectSuggestion(item)"
          @keydown.space="selectSuggestion(item)"
        >
          {{ item.full }}
        </li>
      </ul>
    </div>
    
    <div class="control-buttons">
      <button @click="go" :disabled="!searchTerm" class="btn btn-positive go-button" aria-label="Search weather">
        Go
      </button>
      <button
        @click="saveFavorite"
        :disabled="!searchTerm || favorites.includes(searchTerm)"
        class="save-button"
        aria-label="Save as favorite"
      >
        <span class="star-icon">★</span>
        <span class="button-text">Save</span>
      </button>
    </div>
    
    <div class="favorites-section">
      <select
        v-model="selectedFavorite"
        @change="onFavoriteSelect"
        class="favorites-select"
        aria-label="Select favorite destination"
      >
        <option value="" disabled>Select favorite</option>
        <option v-for="f in favorites" :key="f">{{ f }}</option>
      </select>
      
      <div class="unit-tabs">
        <button
          :class="{ active: tempUnit === 'C' }"
          @click="tempUnit = 'C'"
          aria-label="Switch to Celsius"
        >
          °C
        </button>
        <button
          :class="{ active: tempUnit === 'F' }"
          @click="tempUnit = 'F'"
          aria-label="Switch to Fahrenheit"
        >
          °F
        </button>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-if="!locationQuery" class="empty-state">
    <div class="empty-icon">🌤️</div>
    <h3>No destination selected</h3>
    <p>Search for a destination to see weather information</p>
  </div>

  <!-- Loading State -->
  <div v-else-if="loading" class="loading-state">
    <div class="skeleton-loader">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  </div>

  <!-- Weather Content -->
  <div v-else-if="weather && forecast.length" class="weather-container">
    <div class="current-weather">
      <div class="weather-location">{{ weather.location }}</div>
      <div class="weather-main">
        <div class="weather-temp">
          {{ Math.round(tempUnit === 'C' ? weather.temp_c : weather.temp_f) }}°{{ tempUnit }}
        </div>
        <div class="weather-icon">
          <img :src="weather.icon" :alt="weather.description" />
        </div>
      </div>
      <div class="weather-description">{{ weather.description }}</div>
      <div class="weather-details">
        <div class="weather-detail-item">
          <span class="label">Humidity:</span>
          <span>{{ weather.humidity }}%</span>
        </div>
        <div class="weather-detail-item">
          <span class="label">Wind:</span>
          <span>{{ weather.wind_kph }} km/h</span>
        </div>
      </div>
    </div>

    <div class="local-time">
      <div class="time-label">Local Time:</div>
      <div class="time-value">{{ localTime }}</div>
    </div>

    <div class="forecast-grid">
      <div class="forecast-day" v-for="day in forecast" :key="day.date">
        <div class="date">{{ day.label }}</div>
        <img :src="`https:${day.condition.icon}`" :alt="day.condition.text" />
        <div class="cond">{{ day.condition.text }}</div>
        <div class="temp">
          {{ Math.round(tempUnit === 'C' ? day.day.avgtemp_c : day.day.avgtemp_f) }}°{{ tempUnit }}
        </div>
      </div>
    </div>
  </div>

  <!-- Error State -->
  <div v-else-if="error" class="error-state">
    <div class="error-icon">⚠️</div>
    <h3>Unable to load weather</h3>
    <p>{{ error }}</p>
    <button @click="retryWeather" class="btn btn-warning retry-button">Try Again</button>
  </div>
</div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const API_KEY     = process.env.VUE_APP_WEATHERAPI_KEY
const BASE_URL    = 'https://api.weatherapi.com/v1'
const STORAGE_KEY = 'weather_favorites'

if (!API_KEY) {
console.error(
  '🚨 WeatherAPI key missing! Add VUE_APP_WEATHERAPI_KEY to your .env file and restart.'
)
}

const searchTerm       = ref('')
const suggestions      = ref([])
let   suggestTimer     = null
const locationQuery    = ref('')
const loading          = ref(false)
const weather          = ref(null)
const forecast         = ref([])
const localTime        = ref('')
const tempUnit         = ref('C')
const favorites        = ref(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
const selectedFavorite = ref('')

watch(favorites, () => {
localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value))
})

const props = defineProps({ destination: String })
watch(
() => props.destination,
(d) => {
  if (d) {
    searchTerm.value = d
    setLocationQuery(d)
  }
},
{ immediate: true }
)

function onSearchInput() {
clearTimeout(suggestTimer)
suggestTimer = setTimeout(fetchSuggestions, 300)
}

async function fetchSuggestions() {
if (!searchTerm.value) {
  suggestions.value = []
  return
}
try {
  const q   = encodeURIComponent(searchTerm.value)
  const res = await fetch(`${BASE_URL}/search.json?key=${API_KEY}&q=${q}`)
  if (!res.ok) throw new Error()
  const list = await res.json()
  suggestions.value = list.map((c, i) => ({
    id:   i,
    full: `${c.name}${c.region ? ', '+c.region : ''}, ${c.country}`,
    lat:  c.lat,
    lon:  c.lon
  }))
} catch {
  suggestions.value = []
}
}

function selectSuggestion(item) {
searchTerm.value  = item.full
suggestions.value = []
setLocationQuery(`${item.lat},${item.lon}`)
}

function go() {
setLocationQuery(searchTerm.value.trim())
}

function saveFavorite() {
const v = searchTerm.value.trim()
if (v && !favorites.value.includes(v)) favorites.value.push(v)
}

function onFavoriteSelect() {
if (selectedFavorite.value) {
  searchTerm.value     = selectedFavorite.value
  setLocationQuery(selectedFavorite.value)
}
}

function setLocationQuery(q) {
locationQuery.value = q
}

let clockTimer = null

async function fetchWeatherAll() {
if (!locationQuery.value) return
loading.value = true
clearInterval(clockTimer)
try {
  const q = encodeURIComponent(locationQuery.value)
  const [curRes, fRes] = await Promise.all([
    fetch(`${BASE_URL}/current.json?key=${API_KEY}&q=${q}`),
    fetch(`${BASE_URL}/forecast.json?key=${API_KEY}&q=${q}&days=7&alerts=no`)
  ])
  if (!curRes.ok || !fRes.ok) throw new Error()

  const cur = await curRes.json()
  const f   = await fRes.json()

  weather.value = {
    location:    `${cur.location.name}, ${cur.location.country}`,
    temp_c:      cur.current.temp_c,
    temp_f:      cur.current.temp_f,
    description: cur.current.condition.text,
    icon:        `https:${cur.current.condition.icon}`,
    humidity:    cur.current.humidity,
    wind_kph:    cur.current.wind_kph,
    wind_mph:    cur.current.wind_mph,
    localtime:   cur.location.localtime
  }

  forecast.value = f.forecast.forecastday.map((d) => ({
    date:      d.date,
    label:     new Date(d.date).toLocaleDateString('en-US', {
      weekday: 'short',
      month:   'short',
      day:     'numeric'
    }),
    max_c:     d.day.maxtemp_c,
    min_c:     d.day.mintemp_c,
    max_f:     d.day.maxtemp_f,
    min_f:     d.day.mintemp_f,
    condition: d.day.condition
  }))

  localTime.value = weather.value.localtime
} catch (err) {
  console.error(err)
  weather.value  = null
  forecast.value = []
} finally {
  loading.value = false
}
}

watch(locationQuery, () => fetchWeatherAll(), { immediate: true })

onUnmounted(() => {
clearTimeout(suggestTimer)
clearInterval(clockTimer)
})
</script>

<style scoped>
/* Mobile-first base styles */
.weather-info {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.weather-info:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.weather-info h2 {
  font-size: 20px;
  margin: 0 0 20px 0;
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
}

/* Weather Controls */
.weather-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.dest-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  background: #ffffff;
  color: #111827;
  transition: all 0.2s ease;
  min-height: 48px;
  box-sizing: border-box;
}

.dest-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dest-input::placeholder {
  color: #9ca3af;
}

/* Suggestions List */
.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  margin: 4px 0 0 0;
  padding: 0;
  list-style: none;
}

.suggestion-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-bottom: 1px solid #f3f4f6;
  font-size: 16px;
  line-height: 1.4;
  color: #374151;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item:focus {
  background: #f3f4f6;
  outline: none;
}

.suggestion-item:focus {
  box-shadow: inset 0 0 0 2px #3b82f6;
}

/* Control Buttons */
.control-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.go-button,
.save-button {
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.go-button {
  background: #3b82f6;
  color: #ffffff;
  flex: 1;
}

.go-button:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.go-button:active:not(:disabled) {
  transform: translateY(0);
}

.go-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.go-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.save-button {
  background: #f59e0b;
  color: #ffffff;
  flex: 1;
}

.save-button:hover:not(:disabled) {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.save-button:active:not(:disabled) {
  transform: translateY(0);
}

.save-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3);
}

.save-button:disabled {
  background: #fbbf24;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.star-icon {
  font-size: 16px;
}

.button-text {
  display: none;
}

/* Favorites Section */
.favorites-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.favorites-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  background: #ffffff;
  color: #111827;
  transition: all 0.2s ease;
  min-height: 48px;
  box-sizing: border-box;
}

.favorites-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.unit-tabs {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 4px;
}

.unit-tabs button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  color: #6b7280;
  min-height: 36px;
}

.unit-tabs button:hover {
  background: #e5e7eb;
  color: #374151;
}

.unit-tabs button.active {
  background: #3b82f6;
  color: #ffffff;
}

.unit-tabs button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: #374151;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

/* Loading State */
.loading-state {
  padding: 24px 0;
}

.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-item {
  height: 60px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Error State */
.error-state {
  text-align: center;
  padding: 32px 16px;
  color: #dc2626;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-state h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: #dc2626;
  font-weight: 600;
}

.error-state p {
  margin: 0 0 20px 0;
  font-size: 16px;
  line-height: 1.5;
  color: #6b7280;
}

.retry-button {
  background: #dc2626;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.retry-button:hover {
  background: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.retry-button:active {
  transform: translateY(0);
}

.retry-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.3);
}

/* Weather Container */
.weather-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.current-weather {
  text-align: center;
  padding: 24px 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.weather-location {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16px;
  line-height: 1.4;
}

.weather-main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.weather-temp {
  font-size: 48px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.weather-icon img {
  width: 64px;
  height: 64px;
}

.weather-description {
  font-size: 16px;
  color: #6b7280;
  margin-bottom: 16px;
  line-height: 1.4;
}

.weather-details {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.weather-detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.weather-detail-item .label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.weather-detail-item span:last-child {
  font-size: 16px;
  color: #374151;
  font-weight: 600;
}

.local-time {
  text-align: center;
  padding: 16px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.time-label {
  font-size: 14px;
  color: #0369a1;
  font-weight: 500;
  margin-bottom: 4px;
}

.time-value {
  font-size: 18px;
  color: #0c4a6e;
  font-weight: 600;
}

.forecast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.forecast-day {
  text-align: center;
  padding: 16px 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.forecast-day:hover {
  background: #f3f4f6;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.forecast-day .date {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  line-height: 1.4;
}

.forecast-day img {
  width: 48px;
  height: 48px;
  margin: 0 auto 8px;
}

.forecast-day .cond {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
  line-height: 1.4;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.forecast-day .temp {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .weather-info {
    padding: 24px 20px;
  }
  
  .weather-info h2 {
    font-size: 22px;
    margin-bottom: 24px;
  }
  
  .weather-controls {
    gap: 20px;
    margin-bottom: 32px;
  }
  
  .control-buttons {
    flex-direction: row;
    justify-content: stretch;
  }
  
  .go-button,
  .save-button {
    flex: 1;
  }
  
  .favorites-section {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }
  
  .favorites-select {
    flex: 1;
  }
  
  .unit-tabs {
    flex-shrink: 0;
  }
  
  .weather-main {
    gap: 24px;
  }
  
  .weather-temp {
    font-size: 56px;
  }
  
  .weather-icon img {
    width: 80px;
    height: 80px;
  }
  
  .forecast-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 20px;
  }
  
  .forecast-day {
    padding: 20px 16px;
  }
  
  .button-text {
    display: inline;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .weather-info {
    padding: 32px 28px;
  }
  
  .weather-info h2 {
    font-size: 24px;
    margin-bottom: 32px;
  }
  
  .weather-controls {
    gap: 24px;
    margin-bottom: 40px;
  }
  
  .weather-main {
    gap: 32px;
  }
  
  .weather-temp {
    font-size: 64px;
  }
  
  .weather-icon img {
    width: 96px;
    height: 96px;
  }
  
  .forecast-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 24px;
  }
  
  .forecast-day {
    padding: 24px 20px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .weather-info {
    padding: 16px 12px;
  }
  
  .weather-info h2 {
    font-size: 18px;
    margin-bottom: 16px;
  }
  
  .weather-controls {
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .control-buttons {
    flex-direction: column;
  }
  
  .go-button,
  .save-button {
    width: 100%;
  }
  
  .favorites-section {
    gap: 8px;
  }
  
  .weather-main {
    flex-direction: column;
    gap: 12px;
  }
  
  .weather-temp {
    font-size: 40px;
  }
  
  .weather-icon img {
    width: 56px;
    height: 56px;
  }
  
  .weather-details {
    gap: 16px;
  }
  
  .forecast-grid {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
  }
  
  .forecast-day {
    padding: 12px 8px;
  }
  
  .forecast-day .date {
    font-size: 12px;
  }
  
  .forecast-day img {
    width: 40px;
    height: 40px;
  }
  
  .forecast-day .cond {
    font-size: 11px;
    min-height: 28px;
  }
  
  .forecast-day .temp {
    font-size: 14px;
  }
}
</style>