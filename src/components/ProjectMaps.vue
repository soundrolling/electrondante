<!-- src/components/ProjectMaps.vue -->
<template>
  <div class="maps-container">
    <nav class="breadcrumb">
      <button class="breadcrumb-item" @click="goBack">← Back</button>
      <span class="breadcrumb-separator">/</span>
      <span class="breadcrumb-text">Maps</span>
    </nav>

    <header class="page-header">
      <div>
        <h1 class="page-title">Maps</h1>
        <p class="page-subtitle">{{ currentProject?.project_name || 'Project' }}</p>
      </div>
      <div class="tab-switcher">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'floorplans' }"
          @click="activeTab = 'floorplans'"
        >Floorplans</button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'locations' }"
          @click="activeTab = 'locations'"
        >Locations</button>
      </div>
    </header>

    <!-- ─────────── Floorplans tab ─────────── -->
    <section v-if="activeTab === 'floorplans'" class="tab-pane">
      <aside class="side-panel">
        <div class="side-header">
          <h3>Floorplans</h3>
          <label class="btn btn-positive btn-small">
            <input
              type="file"
              accept="image/*"
              class="file-hidden"
              @change="onFloorplanFile"
              :disabled="isUploading"
            />
            {{ isUploading ? 'Uploading…' : '+ Upload' }}
          </label>
        </div>
        <div v-if="!floorplans.length" class="empty-side">
          No floorplans yet. Upload an image to start pinning.
        </div>
        <ul v-else class="side-list">
          <li
            v-for="fp in floorplans"
            :key="fp.id"
            :class="['side-item', { active: selectedFloorplanId === fp.id }]"
            @click="selectFloorplan(fp.id)"
          >
            <span class="side-item-label">{{ fp.name }}</span>
            <button class="icon-btn danger" @click.stop="deleteFloorplan(fp)" title="Delete">×</button>
          </li>
        </ul>

        <div v-if="selectedFloorplan" class="pin-list-wrap">
          <h4>Pins on this floorplan</h4>
          <ul v-if="floorplanPins.length" class="pin-list">
            <li
              v-for="pin in floorplanPins"
              :key="pin.id"
              class="pin-row"
            >
              <span class="pin-swatch" :style="{ background: pin.color || '#ef4444' }"></span>
              <span class="pin-label">{{ pin.label }}</span>
              <button class="icon-btn" @click="editFloorplanPin(pin)" title="Edit">✎</button>
              <button class="icon-btn danger" @click="deleteFloorplanPin(pin)" title="Delete">×</button>
            </li>
          </ul>
          <p v-else class="empty-side">Click on the floorplan to drop a pin.</p>
        </div>
      </aside>

      <div class="map-stage">
        <div v-if="!selectedFloorplan" class="map-empty">
          <p>Select or upload a floorplan to start pinning.</p>
        </div>
        <div v-show="selectedFloorplan" ref="floorplanMapEl" class="leaflet-host"></div>
      </div>
    </section>

    <!-- ─────────── Locations tab ─────────── -->
    <section v-else class="tab-pane">
      <aside class="side-panel">
        <div class="side-header">
          <h3>Locations</h3>
          <button class="btn btn-positive btn-small" @click="addLocationFromSearch" :disabled="!searchResult">
            + Add pinned spot
          </button>
        </div>

        <div class="search-row">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search address or place…"
            class="search-input"
            @keydown.enter.prevent="runGeocode"
          />
          <button class="btn btn-primary btn-small" @click="runGeocode" :disabled="isSearching">
            {{ isSearching ? '…' : 'Find' }}
          </button>
        </div>
        <div v-if="searchResult" class="search-result">
          Found: {{ searchResult.display_name }}
        </div>

        <p class="hint">Or click anywhere on the map to drop a pin.</p>

        <ul v-if="geoLocations.length" class="pin-list">
          <li
            v-for="pin in geoLocations"
            :key="pin.id"
            class="pin-row"
            @click="flyToGeo(pin)"
          >
            <span class="pin-swatch" :style="{ background: pin.color || '#3b82f6' }"></span>
            <span class="pin-label">{{ pin.label }}</span>
            <button class="icon-btn" @click.stop="editGeoPin(pin)" title="Edit">✎</button>
            <button class="icon-btn danger" @click.stop="deleteGeoPin(pin)" title="Delete">×</button>
          </li>
        </ul>
        <p v-else class="empty-side">No location pins yet.</p>
      </aside>

      <div class="map-stage">
        <div ref="geoMapEl" class="leaflet-host"></div>
      </div>
    </section>

    <!-- ─────────── Pin edit modal ─────────── -->
    <div v-if="showPinModal" class="modal-overlay" @click.self="closePinModal">
      <div class="modal-content">
        <div class="modal-header">
          <h4>{{ pinModalMode === 'new' ? 'New pin' : 'Edit pin' }}</h4>
          <button class="modal-close" @click="closePinModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>Label*</label>
            <input v-model="pinDraft.label" type="text" placeholder="e.g. Generator, Front of House, Catering" />
          </div>
          <div class="form-field">
            <label>Description</label>
            <textarea v-model="pinDraft.description" rows="2" placeholder="Optional notes"></textarea>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Category</label>
              <input v-model="pinDraft.category" type="text" placeholder="e.g. power, access" />
            </div>
            <div class="form-field color-field">
              <label>Color</label>
              <div class="color-swatches">
                <button
                  v-for="c in colorOptions"
                  :key="c"
                  type="button"
                  class="color-swatch"
                  :class="{ active: pinDraft.color === c }"
                  :style="{ background: c }"
                  @click="pinDraft.color = c"
                ></button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-warning" @click="closePinModal">Cancel</button>
          <button class="btn btn-positive" @click="savePin" :disabled="!pinDraft.label">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/supabase'
import { useUserStore } from '@/stores/userStore'

const COLOR_OPTIONS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#111827']

export default {
  name: 'ProjectMaps',
  props: {
    id: { type: String, required: true } // route param
  },
  setup(props) {
    const router = useRouter()
    const toast = useToast()
    const store = useUserStore()
    const currentProject = computed(() => store.getCurrentProject)
    const projectId = computed(() => props.id || currentProject.value?.id)

    const activeTab = ref('floorplans')

    // ─────────── Floorplans state ───────────
    const floorplans = ref([])
    const selectedFloorplanId = ref(null)
    const selectedFloorplan = computed(() => floorplans.value.find(f => f.id === selectedFloorplanId.value) || null)
    const floorplanPins = ref([])
    const floorplanMapEl = ref(null)
    let fpMap = null
    let fpImageLayer = null
    let fpPinLayer = null
    const isUploading = ref(false)

    // ─────────── Locations state ───────────
    const geoLocations = ref([])
    const geoMapEl = ref(null)
    let geoMap = null
    let geoPinLayer = null
    let searchResultMarker = null
    const searchQuery = ref('')
    const isSearching = ref(false)
    const searchResult = ref(null)

    // ─────────── Pin modal ───────────
    const showPinModal = ref(false)
    const pinModalMode = ref('new') // 'new' | 'edit'
    const pinModalKind = ref('floorplan') // 'floorplan' | 'geo'
    const pinDraft = ref({ id: null, label: '', description: '', category: '', color: '#ef4444', x: 0, y: 0, lat: 0, lng: 0 })
    const colorOptions = COLOR_OPTIONS

    function goBack() {
      router.push({ name: 'ProjectDetail', params: { id: projectId.value } })
    }

    // ─────────── Floorplans CRUD ───────────
    async function loadFloorplans() {
      if (!projectId.value) return
      const { data, error } = await supabase
        .from('map_floorplans')
        .select('*')
        .eq('project_id', projectId.value)
        .order('created_at', { ascending: true })
      if (error) {
        toast.error('Could not load floorplans')
        return
      }
      floorplans.value = data || []
      if (!selectedFloorplanId.value && floorplans.value.length) {
        selectedFloorplanId.value = floorplans.value[0].id
      }
    }

    async function loadFloorplanPins(floorplanId) {
      const { data, error } = await supabase
        .from('floorplan_pins')
        .select('*')
        .eq('floorplan_id', floorplanId)
      if (error) {
        toast.error('Could not load pins')
        return
      }
      floorplanPins.value = data || []
    }

    async function getSignedUrl(filePath) {
      const { data, error } = await supabase.storage
        .from('floorplans')
        .createSignedUrl(filePath, 3600)
      if (error) {
        toast.error('Could not load floorplan image')
        return null
      }
      return data?.signedUrl || null
    }

    function readImageSize(file) {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve({ width: 0, height: 0 })
        img.src = URL.createObjectURL(file)
      })
    }

    async function onFloorplanFile(e) {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !projectId.value) return
      isUploading.value = true
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `projects/${projectId.value}/${Date.now()}_${safeName}`
        const { error: upErr } = await supabase.storage
          .from('floorplans')
          .upload(path, file, { contentType: file.type })
        if (upErr) {
          toast.error(`Upload failed: ${upErr.message}`)
          return
        }
        const { width, height } = await readImageSize(file)
        const uploader = store.user?.name || store.user?.email || 'Unknown'
        const baseName = file.name.replace(/\.[^/.]+$/, '')
        const { data: row, error: insErr } = await supabase
          .from('map_floorplans')
          .insert([{
            project_id: projectId.value,
            name: baseName,
            file_path: path,
            width,
            height,
            uploaded_by: uploader
          }])
          .select()
          .single()
        if (insErr) {
          toast.error(`Save failed: ${insErr.message}`)
          await supabase.storage.from('floorplans').remove([path])
          return
        }
        floorplans.value.push(row)
        selectedFloorplanId.value = row.id
        toast.success('Floorplan uploaded')
      } finally {
        isUploading.value = false
      }
    }

    async function deleteFloorplan(fp) {
      if (!confirm(`Delete "${fp.name}" and all its pins?`)) return
      const { error: delErr } = await supabase
        .from('map_floorplans')
        .delete()
        .eq('id', fp.id)
      if (delErr) {
        toast.error(`Delete failed: ${delErr.message}`)
        return
      }
      await supabase.storage.from('floorplans').remove([fp.file_path])
      floorplans.value = floorplans.value.filter(f => f.id !== fp.id)
      if (selectedFloorplanId.value === fp.id) {
        selectedFloorplanId.value = floorplans.value[0]?.id || null
      }
      toast.success('Floorplan deleted')
    }

    function selectFloorplan(id) {
      selectedFloorplanId.value = id
    }

    // ─────────── Floorplan map rendering ───────────
    async function renderFloorplanMap() {
      if (!selectedFloorplan.value || !floorplanMapEl.value) return
      const fp = selectedFloorplan.value

      if (!fpMap) {
        fpMap = L.map(floorplanMapEl.value, {
          crs: L.CRS.Simple,
          minZoom: -3,
          maxZoom: 3,
          attributionControl: false,
          zoomControl: true
        })
        fpMap.on('click', onFloorplanMapClick)
        fpPinLayer = L.layerGroup().addTo(fpMap)
      }

      // Clear previous image
      if (fpImageLayer) {
        fpMap.removeLayer(fpImageLayer)
        fpImageLayer = null
      }

      const url = await getSignedUrl(fp.file_path)
      if (!url) return

      // Use stored width/height, or detect from URL
      let { width, height } = fp
      if (!width || !height) {
        const dims = await new Promise((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
          img.onerror = () => resolve({ width: 1000, height: 700 })
          img.src = url
        })
        width = dims.width
        height = dims.height
      }

      // Leaflet CRS.Simple: use unprojected coords, [y, x] = [0,0] to [height, width]
      const bounds = [[0, 0], [height, width]]
      fpImageLayer = L.imageOverlay(url, bounds).addTo(fpMap)
      fpMap.fitBounds(bounds)

      await loadFloorplanPins(fp.id)
      drawFloorplanPins()
    }

    function drawFloorplanPins() {
      if (!fpPinLayer || !selectedFloorplan.value) return
      fpPinLayer.clearLayers()
      const fp = selectedFloorplan.value
      const w = fp.width || 1000
      const h = fp.height || 700
      floorplanPins.value.forEach(pin => {
        const lat = pin.y_norm * h     // y in image space (top = 0)
        const lng = pin.x_norm * w
        const marker = L.marker([h - lat, lng], { icon: buildPinIcon(pin.color) })
          .bindTooltip(pin.label, { permanent: false, direction: 'top' })
          .on('click', () => editFloorplanPin(pin))
        fpPinLayer.addLayer(marker)
      })
    }

    function onFloorplanMapClick(e) {
      const fp = selectedFloorplan.value
      if (!fp) return
      const w = fp.width || 1000
      const h = fp.height || 700
      const x = e.latlng.lng
      const yFromTop = h - e.latlng.lat
      if (x < 0 || x > w || yFromTop < 0 || yFromTop > h) return
      pinModalMode.value = 'new'
      pinModalKind.value = 'floorplan'
      pinDraft.value = {
        id: null,
        label: '',
        description: '',
        category: '',
        color: '#ef4444',
        x: x / w,
        y: yFromTop / h
      }
      showPinModal.value = true
    }

    function editFloorplanPin(pin) {
      pinModalMode.value = 'edit'
      pinModalKind.value = 'floorplan'
      pinDraft.value = {
        id: pin.id,
        label: pin.label,
        description: pin.description || '',
        category: pin.category || '',
        color: pin.color || '#ef4444',
        x: pin.x_norm,
        y: pin.y_norm
      }
      showPinModal.value = true
    }

    async function deleteFloorplanPin(pin) {
      if (!confirm(`Delete pin "${pin.label}"?`)) return
      const { error } = await supabase.from('floorplan_pins').delete().eq('id', pin.id)
      if (error) {
        toast.error('Delete failed')
        return
      }
      floorplanPins.value = floorplanPins.value.filter(p => p.id !== pin.id)
      drawFloorplanPins()
    }

    // ─────────── Geo locations ───────────
    async function loadGeoLocations() {
      if (!projectId.value) return
      const { data, error } = await supabase
        .from('map_locations')
        .select('*')
        .eq('project_id', projectId.value)
        .order('created_at', { ascending: true })
      if (error) {
        toast.error('Could not load location pins')
        return
      }
      geoLocations.value = data || []
    }

    function renderGeoMap() {
      if (!geoMapEl.value || geoMap) return
      geoMap = L.map(geoMapEl.value, {
        center: [54.5973, -5.9301], // Belfast default
        zoom: 13,
        attributionControl: true
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(geoMap)
      geoMap.on('click', onGeoMapClick)
      geoPinLayer = L.layerGroup().addTo(geoMap)
      drawGeoPins()
    }

    function drawGeoPins() {
      if (!geoPinLayer) return
      geoPinLayer.clearLayers()
      const bounds = []
      geoLocations.value.forEach(pin => {
        const marker = L.marker([pin.lat, pin.lng], { icon: buildPinIcon(pin.color) })
          .bindTooltip(pin.label, { permanent: false, direction: 'top' })
          .on('click', () => editGeoPin(pin))
        geoPinLayer.addLayer(marker)
        bounds.push([pin.lat, pin.lng])
      })
      if (bounds.length && geoMap) {
        geoMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
      }
    }

    function flyToGeo(pin) {
      if (geoMap) geoMap.flyTo([pin.lat, pin.lng], 17, { duration: 0.7 })
    }

    function onGeoMapClick(e) {
      pinModalMode.value = 'new'
      pinModalKind.value = 'geo'
      pinDraft.value = {
        id: null,
        label: '',
        description: '',
        category: '',
        color: '#3b82f6',
        lat: e.latlng.lat,
        lng: e.latlng.lng
      }
      showPinModal.value = true
    }

    function editGeoPin(pin) {
      pinModalMode.value = 'edit'
      pinModalKind.value = 'geo'
      pinDraft.value = {
        id: pin.id,
        label: pin.label,
        description: pin.description || '',
        category: pin.category || '',
        color: pin.color || '#3b82f6',
        lat: pin.lat,
        lng: pin.lng
      }
      showPinModal.value = true
    }

    async function deleteGeoPin(pin) {
      if (!confirm(`Delete pin "${pin.label}"?`)) return
      const { error } = await supabase.from('map_locations').delete().eq('id', pin.id)
      if (error) {
        toast.error('Delete failed')
        return
      }
      geoLocations.value = geoLocations.value.filter(p => p.id !== pin.id)
      drawGeoPins()
    }

    async function runGeocode() {
      const q = searchQuery.value.trim()
      if (!q) return
      isSearching.value = true
      searchResult.value = null
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
          headers: { 'Accept': 'application/json' }
        })
        const arr = await res.json()
        if (!arr || !arr.length) {
          toast.error('No results found')
          return
        }
        const r = arr[0]
        searchResult.value = r
        const lat = parseFloat(r.lat)
        const lng = parseFloat(r.lon)
        if (geoMap) {
          geoMap.flyTo([lat, lng], 16, { duration: 0.7 })
          if (searchResultMarker) geoMap.removeLayer(searchResultMarker)
          searchResultMarker = L.marker([lat, lng], { icon: buildPinIcon('#10b981') })
            .bindTooltip(r.display_name, { permanent: false, direction: 'top' })
            .addTo(geoMap)
        }
      } catch (err) {
        toast.error('Search failed')
      } finally {
        isSearching.value = false
      }
    }

    function addLocationFromSearch() {
      if (!searchResult.value) return
      pinModalMode.value = 'new'
      pinModalKind.value = 'geo'
      pinDraft.value = {
        id: null,
        label: searchResult.value.display_name.split(',')[0] || '',
        description: searchResult.value.display_name,
        category: searchResult.value.type || '',
        color: '#3b82f6',
        lat: parseFloat(searchResult.value.lat),
        lng: parseFloat(searchResult.value.lon)
      }
      showPinModal.value = true
    }

    // ─────────── Pin save (shared modal) ───────────
    async function savePin() {
      const draft = pinDraft.value
      if (!draft.label || !draft.label.trim()) return
      if (pinModalKind.value === 'floorplan') {
        if (!selectedFloorplan.value) return
        const payload = {
          project_id: projectId.value,
          floorplan_id: selectedFloorplan.value.id,
          label: draft.label.trim(),
          description: draft.description || null,
          category: draft.category || null,
          color: draft.color || null,
          x_norm: draft.x,
          y_norm: draft.y
        }
        if (pinModalMode.value === 'new') {
          const { data, error } = await supabase.from('floorplan_pins').insert([payload]).select().single()
          if (error) { toast.error(error.message); return }
          floorplanPins.value.push(data)
        } else {
          const { data, error } = await supabase
            .from('floorplan_pins')
            .update(payload)
            .eq('id', draft.id)
            .select()
            .single()
          if (error) { toast.error(error.message); return }
          const idx = floorplanPins.value.findIndex(p => p.id === draft.id)
          if (idx >= 0) floorplanPins.value[idx] = data
        }
        drawFloorplanPins()
      } else {
        const payload = {
          project_id: projectId.value,
          label: draft.label.trim(),
          description: draft.description || null,
          category: draft.category || null,
          color: draft.color || null,
          lat: draft.lat,
          lng: draft.lng
        }
        if (pinModalMode.value === 'new') {
          const { data, error } = await supabase.from('map_locations').insert([payload]).select().single()
          if (error) { toast.error(error.message); return }
          geoLocations.value.push(data)
        } else {
          const { data, error } = await supabase
            .from('map_locations')
            .update(payload)
            .eq('id', draft.id)
            .select()
            .single()
          if (error) { toast.error(error.message); return }
          const idx = geoLocations.value.findIndex(p => p.id === draft.id)
          if (idx >= 0) geoLocations.value[idx] = data
        }
        drawGeoPins()
      }
      closePinModal()
    }

    function closePinModal() {
      showPinModal.value = false
    }

    function buildPinIcon(color) {
      const c = color || '#ef4444'
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
          <path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 26 14 26s14-16 14-26C28 6.3 21.7 0 14 0z" fill="${c}" stroke="#111827" stroke-width="1.5"/>
          <circle cx="14" cy="14" r="5" fill="#ffffff"/>
        </svg>`
      return L.divIcon({
        className: 'map-pin-icon',
        html: svg,
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        tooltipAnchor: [0, -36]
      })
    }

    // ─────────── Lifecycle / watchers ───────────
    onMounted(async () => {
      await loadFloorplans()
      await loadGeoLocations()
      await nextTick()
      if (activeTab.value === 'floorplans' && selectedFloorplan.value) {
        await renderFloorplanMap()
      } else if (activeTab.value === 'locations') {
        renderGeoMap()
      }
    })

    onUnmounted(() => {
      if (fpMap) { fpMap.remove(); fpMap = null }
      if (geoMap) { geoMap.remove(); geoMap = null }
    })

    watch(activeTab, async (newTab) => {
      await nextTick()
      if (newTab === 'floorplans' && selectedFloorplan.value) {
        await renderFloorplanMap()
        if (fpMap) fpMap.invalidateSize()
      } else if (newTab === 'locations') {
        renderGeoMap()
        if (geoMap) geoMap.invalidateSize()
      }
    })

    watch(selectedFloorplanId, async (id) => {
      if (!id || activeTab.value !== 'floorplans') return
      await nextTick()
      await renderFloorplanMap()
    })

    return {
      currentProject,
      activeTab,
      goBack,
      // floorplans
      floorplans,
      selectedFloorplanId,
      selectedFloorplan,
      selectFloorplan,
      onFloorplanFile,
      isUploading,
      deleteFloorplan,
      floorplanPins,
      floorplanMapEl,
      editFloorplanPin,
      deleteFloorplanPin,
      // geo
      geoLocations,
      geoMapEl,
      searchQuery,
      isSearching,
      searchResult,
      runGeocode,
      addLocationFromSearch,
      flyToGeo,
      editGeoPin,
      deleteGeoPin,
      // modal
      showPinModal,
      pinModalMode,
      pinDraft,
      colorOptions,
      savePin,
      closePinModal
    }
  }
}
</script>

<style scoped>
.maps-container {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-secondary, #6b7280);
}
.breadcrumb-item {
  background: none;
  border: none;
  color: var(--color-primary-600);
  cursor: pointer;
  padding: 0;
  font-size: 0.9rem;
}
.breadcrumb-separator { opacity: 0.5; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}
.page-title { margin: 0; font-size: 1.5rem; }
.page-subtitle { margin: 0.25rem 0 0; color: var(--text-secondary, #6b7280); font-size: 0.875rem; }

.tab-switcher {
  display: inline-flex;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-card);
}
.tab-btn {
  background: transparent;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
}
.tab-btn.active {
  background: var(--color-primary-600);
  color: #fff;
}

.tab-pane {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  min-height: 600px;
}
@media (max-width: 768px) {
  .tab-pane { grid-template-columns: 1fr; }
}

.side-panel {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 700px;
  overflow-y: auto;
}
.side-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.side-header h3 { margin: 0; font-size: 1rem; }

.btn {
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn-small { padding: 0.35rem 0.6rem; font-size: 0.8rem; }
.btn-positive { background: #22c55e; color: #fff; }
.btn-positive:hover:not(:disabled) { background: #16a34a; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-warning { background: #f97316; color: #fff; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.file-hidden { display: none; }

.empty-side {
  color: var(--text-secondary, #6b7280);
  font-size: 0.85rem;
  padding: 0.5rem 0;
}
.hint {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin: 0.25rem 0;
}

.side-list, .pin-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.side-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
}
.side-item:hover { background: var(--surface-hover, #f9fafb); }
.side-item.active { background: var(--chip-bg-active); border-color: #3b82f6; }
.side-item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.pin-list-wrap { margin-top: 0.5rem; }
.pin-list-wrap h4 { margin: 0.5rem 0 0.25rem; font-size: 0.85rem; color: var(--text-secondary, #6b7280); text-transform: uppercase; letter-spacing: 0.04em; }

.pin-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--surface-border);
  font-size: 0.875rem;
  background: var(--surface-card);
  cursor: pointer;
}
.pin-row:hover { background: var(--surface-hover, #f9fafb); }
.pin-swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.2);
  flex-shrink: 0;
}
.pin-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.15rem 0.4rem;
  font-size: 0.95rem;
  color: var(--text-secondary, #6b7280);
  border-radius: 4px;
}
.icon-btn:hover { background: rgba(0,0,0,0.05); color: var(--text-primary); }
.icon-btn.danger:hover { background: #fee2e2; color: #b91c1c; }

.search-row {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.25rem;
}
.search-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--surface-card);
  color: var(--text-primary);
}
.search-result {
  font-size: 0.78rem;
  color: var(--text-secondary, #6b7280);
  padding: 0.4rem 0.5rem;
  background: var(--surface-card-muted);
  border-radius: 6px;
  border: 1px dashed var(--surface-border);
}

.map-stage {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  min-height: 600px;
}
.map-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary, #6b7280);
  text-align: center;
  padding: 2rem;
}
.leaflet-host {
  width: 100%;
  height: 100%;
  min-height: 600px;
}

/* ─────────── Modal ─────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-content {
  background: var(--surface-card);
  color: var(--text-primary);
  border-radius: 10px;
  min-width: 360px;
  max-width: 460px;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  overflow: hidden;
}
.modal-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h4 { margin: 0; font-size: 1rem; }
.modal-close {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  line-height: 1;
}
.modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-field label { font-size: 0.8rem; color: var(--text-secondary, #6b7280); font-weight: 500; }
.form-field input, .form-field textarea {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  background: var(--surface-card);
  color: var(--text-primary);
}
.color-field { gap: 0.35rem; }
.color-swatches { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.color-swatch.active { border-color: #111827; }
.modal-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--surface-border);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>

<style>
.map-pin-icon { background: none !important; border: none !important; }
.map-pin-icon svg { display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
</style>
