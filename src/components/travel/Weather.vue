<template>
<div class="dashboard-card weather-info">
  <h2>Weather & Local Info For You</h2>

  <div class="weather-controls">
    <div class="input-wrapper">
      <input
        v-model="searchTerm"
        @input="onSearchInput"
        class="dest-input"
        type="text"
        placeholder="Enter city, country, ZIP, lat,lng, iata:XXX, etc."
      />
      <ul v-if="suggestions.length" class="suggestions-list">
        <li
          v-for="item in suggestions"
          :key="item.id"
          @click="selectSuggestion(item)"
        >
          {{ item.full }}
        </li>
      </ul>
    </div>
    <button @click="go" :disabled="!searchTerm" class="go-button">
      Go
    </button>
    <button
      @click="saveFavorite"
      :disabled="!searchTerm || favorites.includes(searchTerm)"
      class="save-button"
    >
      ★ Save
    </button>
    <select
      v-model="selectedFavorite"
      @change="onFavoriteSelect"
      class="favorites-select"
    >
      <option value="" disabled>Select favorite</option>
      <option v-for="f in favorites" :key="f">{{ f }}</option>
    </select>
    <div class="unit-tabs">
      <button
        :class="{ active: tempUnit === 'C' }"
        @click="tempUnit = 'C'"
      >
        °C
      </button>
      <button
        :class="{ active: tempUnit === 'F' }"
        @click="tempUnit = 'F'"
      >
        °F
      </button>
    </div>
  </div>

  <div v-if="!locationQuery" class="empty-state">
    <p>No destination selected.</p>
  </div>

  <div v-else-if="loading" class="loading-spinner">
    <div class="spinner"></div>
    <p>Loading weather data…</p>
  </div>

  <div v-else-if="weather && forecast.length" class="weather-container">
    <div class="current-weather">
      <div class="weather-location">{{ weather.location }}</div>
      <div class="weather-main">
        <div class="weather-temp">
          {{ Math.round(tempUnit === 'C' ? weather.temp_c : weather.temp_f) }}°{{ tempUnit }}
        </div>
        <div class="weather-icon">
          <img :src="weather.icon" alt="Icon" />
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
        <div class="temps">
          <span>
            {{ Math.round(tempUnit === 'C' ? day.max_c : day.max_f) }}°{{ tempUnit }}
          </span>
          /
          <span>
            {{ Math.round(tempUnit === 'C' ? day.min_c : day.min_f) }}°{{ tempUnit }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="empty-state">
    <p>Unable to load weather.</p>
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
.dashboard-card.weather-info {
padding: 1rem;
}

.weather-controls {
display: flex;
flex-wrap: wrap;
gap: 1rem;
margin-bottom: 1.5rem;
}
.input-wrapper {
position: relative;
flex: 1 1 auto;
min-width: 180px;
}
.dest-input {
width: 100%;
padding: 0.5rem;
border: 1px solid #ccc;
border-radius: 4px;
}
.suggestions-list {
position: absolute;
top: 100%;
left: 0;
right: 0;
background: #fff;
border: 1px solid #ccc;
max-height: 150px;
overflow-y: auto;
list-style: none;
margin: 0;
padding: 0;
z-index: 10;
}
.suggestions-list li {
padding: 0.5rem;
cursor: pointer;
}
.suggestions-list li:hover {
background: #f0f0f0;
}

.go-button,
.save-button {
padding: 0.5rem 1rem;
border: none;
border-radius: 4px;
color: #fff;
cursor: pointer;
flex: 0 0 auto;
white-space: nowrap;
}
.go-button {
background: #3498db;
}
.go-button:disabled {
background: #a0cfee;
cursor: not-allowed;
}
.save-button {
background: #f1c40f;
}
.save-button:disabled {
background: #f9e79f;
cursor: not-allowed;
}

.favorites-select {
flex: 0 0 160px;
padding: 0.5rem;
border: 1px solid #ccc;
border-radius: 4px;
}

.unit-tabs {
display: flex;
flex: 0 0 auto;
}
.unit-tabs button {
padding: 0.5rem 1rem;
border: 1px solid #ccc;
border-bottom: none;
background: #f9f9f9;
cursor: pointer;
border-top-left-radius: 4px;
border-top-right-radius: 4px;
margin-right: -1px;
}
.unit-tabs button.active {
background: #fff;
border-bottom: 1px solid #fff;
font-weight: bold;
}

.loading-spinner {
text-align: center;
padding: 1rem;
}
.spinner {
border: 4px solid #f3f3f3;
border-top: 4px solid #3498db;
border-radius: 50%;
width: 28px;
height: 28px;
animation: spin 1s linear infinite;
margin: 0 auto 0.75rem;
}
@keyframes spin {
to {
  transform: rotate(360deg);
}
}

.empty-state {
text-align: center;
padding: 1rem;
font-style: italic;
}

.weather-container {
display: flex;
flex-direction: column;
align-items: center;
gap: 1rem;
}
.current-weather {
text-align: center;
}
.weather-location {
font-weight: bold;
margin-bottom: 0.5rem;
}
.weather-main {
display: flex;
align-items: center;
gap: 0.75rem;
}
.weather-temp {
font-size: 2rem;
font-weight: bold;
}
.weather-icon img {
width: 50px;
height: 50px;
}
.weather-description {
text-transform: capitalize;
color: #555;
}
.weather-details {
display: flex;
gap: 1rem;
}
.weather-detail-item {
font-size: 0.9rem;
}
.local-time {
text-align: center;
}
.time-label {
font-size: 0.8rem;
color: #555;
}
.time-value {
font-size: 1.2rem;
font-weight: bold;
}

.forecast-grid {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
gap: 1rem;
width: 100%;
margin-top: 1rem;
}
.forecast-day {
background: #fff;
border-radius: 6px;
padding: 0.5rem;
text-align: center;
box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
.forecast-day .date {
font-size: 0.85rem;
margin-bottom: 0.25rem;
}
.forecast-day .cond {
font-size: 0.75rem;
margin: 0.25rem 0;
}
.forecast-day .temps {
font-size: 0.85rem;
}
</style>