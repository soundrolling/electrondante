<template>
<div class="flight-details">
  <!-- Header Section -->
  <div class="header-section ui-page-header">
    <h1>Flights & Transportation</h1>
    <p>Manage your flight and transportation details</p>
  </div>

  <!-- Back to Dashboard Button -->
  <div class="back-button-container">
    <button class="btn btn-warning back-button" @click="goBackToDashboard" aria-label="Back to dashboard">
      <span class="back-icon">←</span>
      <span class="back-text">Back to Dashboard</span>
    </button>
  </div>

  <!-- Trip Selector -->
  <div class="trip-selector ui-filter-bar">
    <label for="trip-select">Select Trip:</label>
    <select 
      id="trip-select" 
      v-model="selectedTripId" 
      @change="loadAllTransportData"
      class="trip-select-input"
      aria-label="Select a trip to view transportation details"
    >
      <option value="">-- Select a Trip --</option>
      <option 
        v-for="trip in trips" 
        :key="trip.id" 
        :value="trip.id"
      >
        {{ trip.name }} ({{ formatDateRange(trip.start_date, trip.end_date) }})
      </option>
    </select>
  </div>

  <!-- Loading & Empty States -->
  <div v-if="isLoading" class="loading-state">
    <div class="skeleton-loader">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  </div>

  <div v-else-if="!selectedTripId" class="empty-state">
    <div class="empty-icon">✈️</div>
    <h3>Select a trip</h3>
    <p>Please select a trip to view flight/transportation details</p>
  </div>

  <div v-else class="content-container">
    <!-- Tabs Navigation -->
    <div class="tabs-nav" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`${tab.id}-panel`"
        role="tab"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Flights Section -->
    <div v-if="activeTab === 'flights'" class="section-content" role="tabpanel" id="flights-panel">
      <div class="section-header">
        <h2>Flight Information</h2>
        <button @click="openFlightModal()" class="btn btn-positive add-button" aria-label="Add new flight">
          <span class="icon">+</span>
          <span class="button-text">Add Flight</span>
        </button>
      </div>
      
      <div v-if="flights.length === 0" class="empty-section">
        <div class="empty-icon">🛫</div>
        <h3>No flights yet</h3>
        <p>Add your first flight to get started!</p>
      </div>
      
      <div v-else class="flights-list">
        <div 
          v-for="flight in sortedFlights" 
          :key="flight.id" 
          class="flight-card"
        >
          <div class="flight-card-header">
            <div class="flight-airline">
              <span class="airline-code">{{ flight.airline }}</span>
              <span class="flight-number">{{ flight.flight_number }}</span>
            </div>
            <div class="flight-date">{{ formatDate(flight.departure_date) }}</div>
          </div>
          
          <div class="flight-card-body">
            <div class="flight-route">
              <div class="flight-location">
                <div class="airport-code">{{ flight.departure_airport_code }}</div>
                <div class="airport-city">{{ flight.departure_city }}</div>
                <div class="flight-time">{{ formatTime(flight.departure_time) }}</div>
              </div>
              <div class="flight-duration">
                <div class="duration-line"></div>
                <div class="duration-time">{{ calculateDuration(flight) }}</div>
                <div class="duration-line"></div>
              </div>
              <div class="flight-location">
                <div class="airport-code">{{ flight.arrival_airport_code }}</div>
                <div class="airport-city">{{ flight.arrival_city }}</div>
                <div class="flight-time">{{ formatTime(flight.arrival_time) }}</div>
              </div>
            </div>
            <div class="flight-details">
              <div class="detail-item">
                <span class="detail-label">Terminal:</span>
                <span class="detail-value">{{ flight.departure_terminal || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Gate:</span>
                <span class="detail-value">{{ flight.departure_gate || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Seat:</span>
                <span class="detail-value">{{ flight.seat_assignment || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value" :class="getFlightStatusClass(flight)">
                  {{ getFlightStatus(flight) }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="flight-card-footer">
            <button @click="openFlightModal(flight)" class="btn btn-warning action-button edit-button" aria-label="Edit flight">
              <span class="action-icon">✏️</span>
              <span class="action-text">Edit</span>
            </button>
            <button @click="deleteFlight(flight.id)" class="btn btn-danger action-button delete-button" aria-label="Delete flight">
              <span class="action-icon">🗑️</span>
              <span class="action-text">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Rental Cars Section -->
    <div v-if="activeTab === 'rental'" class="section-content" role="tabpanel" id="rental-panel">
      <div class="section-header">
        <h2>Rental Car Information</h2>
        <button @click="openRentalModal()" class="btn btn-positive add-button" aria-label="Add new rental car">
          <span class="icon">+</span>
          <span class="button-text">Add Rental Car</span>
        </button>
      </div>
      
      <div v-if="rentalCars.length === 0" class="empty-section">
        <div class="empty-icon">🚗</div>
        <h3>No rental cars yet</h3>
        <p>Add your first rental car to get started!</p>
      </div>
      
      <div v-else class="rental-list">
        <div v-for="rental in rentalCars" :key="rental.id" class="rental-card">
          <div class="rental-card-header">
            <h3>{{ rental.company }}</h3>
            <div class="rental-dates">
              {{ formatDateRange(rental.pickup_date, rental.return_date) }}
            </div>
          </div>
          <div class="rental-card-body">
            <div class="rental-details">
              <div class="detail-item">
                <span class="detail-label">Vehicle:</span>
                <span class="detail-value">{{ rental.vehicle_type }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Reservation #:</span>
                <span class="detail-value">{{ rental.reservation_number }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Pickup:</span>
                <span class="detail-value">{{ rental.pickup_location }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Return:</span>
                <span class="detail-value">{{ rental.return_location }}</span>
              </div>
            </div>
            <div class="rental-notes" v-if="rental.notes">
              <div class="detail-label">Notes:</div>
              <p>{{ rental.notes }}</p>
            </div>
          </div>
          <div class="rental-card-footer">
            <button @click="openRentalModal(rental)" class="btn btn-warning action-button edit-button" aria-label="Edit rental car">
              <span class="action-icon">✏️</span>
              <span class="action-text">Edit</span>
            </button>
            <button @click="deleteRental(rental.id)" class="btn btn-danger action-button delete-button" aria-label="Delete rental car">
              <span class="action-icon">🗑️</span>
              <span class="action-text">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Local Transport Section -->
    <div v-if="activeTab === 'local'" class="section-content" role="tabpanel" id="local-panel">
      <div class="section-header">
        <h2>Local Transportation</h2>
        <button @click="openLocalTransportModal()" class="btn btn-positive add-button" aria-label="Add new local transport">
          <span class="icon">+</span>
          <span class="button-text">Add Local Transport</span>
        </button>
      </div>
      
      <div v-if="localTransport.length === 0" class="empty-section">
        <div class="empty-icon">🚇</div>
        <h3>No local transport yet</h3>
        <p>Add your first local transportation to get started!</p>
      </div>
      
      <div v-else class="transport-list">
        <div v-for="transport in localTransport" :key="transport.id" class="transport-card">
          <div class="transport-card-header">
            <h3>{{ transport.type }}</h3>
            <div class="transport-date">{{ formatDate(transport.date) }}</div>
          </div>
          <div class="transport-card-body">
            <div class="transport-details">
              <div class="detail-item">
                <span class="detail-label">From:</span>
                <span class="detail-value">{{ transport.from_location }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">To:</span>
                <span class="detail-value">{{ transport.to_location }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Time:</span>
                <span class="detail-value">{{ formatTime(transport.departure_time) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Confirmation:</span>
                <span class="detail-value">{{ transport.confirmation_number || 'N/A' }}</span>
              </div>
            </div>
            <div class="transport-notes" v-if="transport.notes">
              <div class="detail-label">Notes:</div>
              <p>{{ transport.notes }}</p>
            </div>
          </div>
          <div class="transport-card-footer">
            <button @click="openLocalTransportModal(transport)" class="btn btn-warning action-button edit-button" aria-label="Edit local transport">
              <span class="action-icon">✏️</span>
              <span class="action-text">Edit</span>
            </button>
            <button @click="deleteLocalTransport(transport.id)" class="btn btn-danger action-button delete-button" aria-label="Delete local transport">
              <span class="action-icon">🗑️</span>
              <span class="action-text">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Parking Section -->
    <div v-if="activeTab === 'parking'" class="section-content" role="tabpanel" id="parking-panel">
      <div class="section-header">
        <h2>Airport Car Parking</h2>
        <button @click="openNewParkingModal()" class="btn btn-positive add-button" aria-label="Add new parking">
          <span class="icon">🚗</span>
          <span class="button-text">Add Parking</span>
        </button>
      </div>
      
      <div v-if="parkingSlots.length === 0" class="empty-section">
        <div class="empty-icon">🅿️</div>
        <h3>No parking yet</h3>
        <p>Add your airport parking to get started!</p>
      </div>
      
      <div v-else class="parking-list">
        <div
          v-for="slot in parkingSlots"
          :key="slot.id"
          class="parking-card"
        >
          <div class="parking-card-header">
            <h3>{{ slot.airport }} ({{ slot.parking_provider }})</h3>
            <span class="parking-dates">
              {{ formatDateTime(slot.start_datetime) }} – {{ formatDateTime(slot.end_datetime) }}
            </span>
          </div>
          <div class="parking-card-body">
            <p class="parking-cost">Cost: £{{ parseFloat(slot.cost).toFixed(2) }}</p>
            <p v-if="slot.notes" class="parking-notes">{{ slot.notes }}</p>
          </div>
          <div class="parking-card-footer">
            <button @click="openEditParkingModal(slot)" class="btn btn-warning action-button edit-button" aria-label="Edit parking">
              <span class="action-icon">✏️</span>
              <span class="action-text">Edit</span>
            </button>
            <button @click="deleteParking(slot.id)" class="btn btn-danger action-button delete-button" aria-label="Delete parking">
              <span class="action-icon">🗑️</span>
              <span class="action-text">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Flight Modal -->
  <div v-if="showFlightModal" class="modal" role="dialog" aria-labelledby="flight-modal-title">
    <div class="modal-overlay" @click="closeFlightModal"></div>
    <div class="modal-container">
      <button class="btn btn-warning close-button" @click="closeFlightModal" aria-label="Close modal">✕</button>
      <div class="modal-header">
        <h2 id="flight-modal-title">{{ editingFlight ? 'Edit Flight' : 'Add Flight' }}</h2>
      </div>
      <div class="modal-body">
        <form @submit.prevent="saveFlight">
          <div class="form-group">
            <label for="airline">Airline</label>
            <input
              type="text"
              id="airline"
              v-model="flightForm.airline"
              required
              placeholder="e.g., British Airways"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="flightNumber">Flight Number</label>
            <input
              type="text"
              id="flightNumber"
              v-model="flightForm.flight_number"
              required
              placeholder="e.g., BA2490"
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="departureDate">Departure Date</label>
              <input
                type="date"
                id="departureDate"
                v-model="flightForm.departure_date"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="departureTime">Departure Time</label>
              <input
                type="time"
                id="departureTime"
                v-model="flightForm.departure_time"
                required
                class="form-input"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="departureCity">Departure City</label>
              <input
                type="text"
                id="departureCity"
                v-model="flightForm.departure_city"
                required
                placeholder="e.g., London"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="departureAirportCode">Departure Airport Code</label>
              <input
                type="text"
                id="departureAirportCode"
                v-model="flightForm.departure_airport_code"
                required
                placeholder="e.g., LHR"
                class="form-input"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="departureTerminal">Departure Terminal</label>
              <input
                type="text"
                id="departureTerminal"
                v-model="flightForm.departure_terminal"
                placeholder="e.g., 5"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="departureGate">Departure Gate</label>
              <input
                type="text"
                id="departureGate"
                v-model="flightForm.departure_gate"
                placeholder="e.g., A12"
                class="form-input"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="arrivalCity">Arrival City</label>
              <input
                type="text"
                id="arrivalCity"
                v-model="flightForm.arrival_city"
                required
                placeholder="e.g., New York"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="arrivalAirportCode">Arrival Airport Code</label>
              <input
                type="text"
                id="arrivalAirportCode"
                v-model="flightForm.arrival_airport_code"
                required
                placeholder="e.g., JFK"
                class="form-input"
              />
            </div>
          </div>
          <div class="form-group">
            <label for="arrivalTime">Arrival Time</label>
            <input
              type="time"
              id="arrivalTime"
              v-model="flightForm.arrival_time"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="seatAssignment">Seat Assignment (Optional)</label>
            <input
              type="text"
              id="seatAssignment"
              v-model="flightForm.seat_assignment"
              placeholder="e.g., 12A"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="flightNotes">Notes (Optional)</label>
            <textarea
              id="flightNotes"
              v-model="flightForm.notes"
              rows="3"
              placeholder="Any special instructions"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-actions">
            <button
              type="button"
              @click="closeFlightModal"
              class="secondary-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-positive primary-button"
              :disabled="isSaving"
            >
              <span v-if="isSaving" class="loading-spinner-small"></span>
              {{ isSaving ? 'Saving…' : (editingFlight ? 'Update Flight' : 'Add Flight') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Rental Car Modal -->
  <div v-if="showRentalModal" class="modal" role="dialog" aria-labelledby="rental-modal-title">
    <div class="modal-overlay" @click="closeRentalModal"></div>
    <div class="modal-container">
      <button class="btn btn-warning close-button" @click="closeRentalModal" aria-label="Close modal">✕</button>
      <div class="modal-header">
        <h2 id="rental-modal-title">{{ editingRental ? 'Edit Rental Car' : 'Add Rental Car' }}</h2>
      </div>
      <div class="modal-body">
        <form @submit.prevent="saveRentalCar">
          <div class="form-group">
            <label for="company">Company</label>
            <input
              type="text"
              id="company"
              v-model="rentalForm.company"
              required
              placeholder="e.g., Hertz"
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="pickupDate">Pickup Date</label>
              <input
                type="date"
                id="pickupDate"
                v-model="rentalForm.pickup_date"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="returnDate">Return Date</label>
              <input
                type="date"
                id="returnDate"
                v-model="rentalForm.return_date"
                required
                class="form-input"
              />
            </div>
          </div>
          <div class="form-group">
            <label for="vehicleType">Vehicle Type</label>
            <input
              type="text"
              id="vehicleType"
              v-model="rentalForm.vehicle_type"
              required
              placeholder="e.g., SUV"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="reservationNumber">Reservation #</label>
            <input
              type="text"
              id="reservationNumber"
              v-model="rentalForm.reservation_number"
              required
              placeholder="e.g., ABC123456"
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="pickupLocation">Pickup Location</label>
              <input
                type="text"
                id="pickupLocation"
                v-model="rentalForm.pickup_location"
                required
                placeholder="e.g., LHR Terminal 5"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="returnLocation">Return Location</label>
              <input
                type="text"
                id="returnLocation"
                v-model="rentalForm.return_location"
                required
                placeholder="e.g., JFK Terminal 4"
                class="form-input"
              />
            </div>
          </div>
          <div class="form-group">
            <label for="rentalNotes">Notes (Optional)</label>
            <textarea
              id="rentalNotes"
              v-model="rentalForm.notes"
              rows="3"
              placeholder="Any special instructions"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-actions">
            <button
              type="button"
              @click="closeRentalModal"
              class="secondary-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-positive primary-button"
              :disabled="isSaving"
            >
              {{ editingRental ? 'Update Rental' : 'Add Rental' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Local Transport Modal -->
  <div v-if="showLocalTransportModal" class="modal" role="dialog" aria-labelledby="transport-modal-title">
    <div class="modal-overlay" @click="closeLocalTransportModal"></div>
    <div class="modal-container">
      <button class="btn btn-warning close-button" @click="closeLocalTransportModal" aria-label="Close modal">✕</button>
      <div class="modal-header">
        <h2 id="transport-modal-title">{{ editingTransport ? 'Edit Local Transport' : 'Add Local Transport' }}</h2>
      </div>
      <div class="modal-body">
        <form @submit.prevent="saveLocalTransport">
          <div class="form-group">
            <label for="transportType">Type</label>
            <input
              type="text"
              id="transportType"
              v-model="transportForm.type"
              required
              placeholder="e.g., Taxi, Bus, Train"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="transportDate">Date</label>
            <input
              type="date"
              id="transportDate"
              v-model="transportForm.date"
              required
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="fromLocation">From</label>
              <input
                type="text"
                id="fromLocation"
                v-model="transportForm.from_location"
                required
                placeholder="e.g., Hotel"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="toLocation">To</label>
              <input
                type="text"
                id="toLocation"
                v-model="transportForm.to_location"
                required
                placeholder="e.g., Airport"
                class="form-input"
              />
            </div>
          </div>
          <div class="form-group">
            <label for="departureTime">Time</label>
            <input
              type="time"
              id="departureTime"
              v-model="transportForm.departure_time"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="confirmationNumber">Confirmation # (Optional)</label>
            <input
              type="text"
              id="confirmationNumber"
              v-model="transportForm.confirmation_number"
              placeholder="Booking reference"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="transportNotes">Notes (Optional)</label>
            <textarea
              id="transportNotes"
              v-model="transportForm.notes"
              rows="3"
              placeholder="Any special instructions"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-actions">
            <button
              type="button"
              @click="closeLocalTransportModal"
              class="secondary-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-positive primary-button"
              :disabled="isSaving"
            >
              {{ editingTransport ? 'Update Transport' : 'Add Transport' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- New Parking Modal -->
  <div v-if="showNewParkingModal" class="modal" role="dialog" aria-labelledby="parking-modal-title">
    <div class="modal-overlay" @click="showNewParkingModal = false"></div>
    <div class="modal-container">
      <button class="btn btn-warning close-button" @click="showNewParkingModal = false" aria-label="Close modal">✕</button>
      <div class="modal-header">
        <h2 id="parking-modal-title">Add Parking</h2>
      </div>
      <div class="modal-body">
        <form @submit.prevent="saveNewParking">
          <div class="form-group">
            <label for="airport">Airport</label>
            <input
              type="text"
              id="airport"
              v-model="newParking.airport"
              required
              placeholder="e.g., Heathrow"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="provider">Provider</label>
            <input
              type="text"
              id="provider"
              v-model="newParking.parking_provider"
              required
              placeholder="e.g., NCP"
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="startDateTime">Start Date & Time</label>
              <input
                type="datetime-local"
                id="startDateTime"
                v-model="newParking.start_datetime"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="endDateTime">End Date & Time</label>
              <input
                type="datetime-local"
                id="endDateTime"
                v-model="newParking.end_datetime"
                required
                class="form-input"
              />
            </div>
          </div>
          <div class="form-group">
            <label for="cost">Cost (£)</label>
            <input
              type="number"
              id="cost"
              v-model.number="newParking.cost"
              required
              min="0"
              step="0.01"
              placeholder="e.g., 45.00"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="notes">Notes (Optional)</label>
            <textarea
              id="notes"
              v-model="newParking.notes"
              rows="3"
              placeholder="Any special instructions or booking ref"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-actions">
            <button
              type="button"
              @click="showNewParkingModal = false"
              class="secondary-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-positive primary-button"
              :disabled="isSavingParking"
            >
              <span v-if="isSavingParking" class="loading-spinner-small"></span>
              {{ isSavingParking ? 'Saving…' : 'Add Parking' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Edit Parking Modal -->
  <div v-if="showEditParkingModal" class="modal" role="dialog" aria-labelledby="edit-parking-modal-title">
    <div class="modal-overlay" @click="showEditParkingModal = false"></div>
    <div class="modal-container">
      <button class="btn btn-warning close-button" @click="showEditParkingModal = false" aria-label="Close modal">✕</button>
      <div class="modal-header">
        <h2 id="edit-parking-modal-title">Edit Parking</h2>
      </div>
      <div class="modal-body">
        <form @submit.prevent="updateParking">
          <div class="form-group">
            <label for="editAirport">Airport</label>
            <input
              type="text"
              id="editAirport"
              v-model="editParking.airport"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="editProvider">Provider</label>
            <input
              type="text"
              id="editProvider"
              v-model="editParking.parking_provider"
              required
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="editStartDateTime">Start Date & Time</label>
              <input
                type="datetime-local"
                id="editStartDateTime"
                v-model="editParking.start_datetime"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="editEndDateTime">End Date & Time</label>
              <input
                type="datetime-local"
                id="editEndDateTime"
                v-model="editParking.end_datetime"
                required
                class="form-input"
              />
            </div>
          </div>
          <div class="form-group">
            <label for="editCost">Cost (£)</label>
            <input
              type="number"
              id="editCost"
              v-model.number="editParking.cost"
              required
              min="0"
              step="0.01"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="editNotes">Notes (Optional)</label>
            <textarea
              id="editNotes"
              v-model="editParking.notes"
              rows="3"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-actions">
            <button
              type="button"
              @click="showEditParkingModal = false"
              class="secondary-button"
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-positive primary-button">Update Parking</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '../../stores/userStore';
import { useToast } from 'vue-toastification';
import { supabase } from '../../supabase';
import { format, parseISO, differenceInMinutes, isAfter, isBefore } from 'date-fns';

export default {
name: 'FlightDetails',
props: ['id', 'tripId'],
setup(props) {
  const router = useRouter();
  const route = useRoute();
  const toast = useToast();
  const userStore = useUserStore();

  // If route param activeTab is set, use that; otherwise default to "flights"
  const activeTab = ref(route.params.activeTab || 'flights');

  const projectId = ref(userStore.currentProject?.id || route.params.id);
  const selectedTripId = ref(route.params.tripId || '');

  const trips = ref([]);
  const flights = ref([]);
  const rentalCars = ref([]);
  const localTransport = ref([]);
  const parkingSlots = ref([]);

  const isLoading = ref(false);
  const isSaving = ref(false);
  const isSavingParking = ref(false);

  // Flight Modal State
  const showFlightModal = ref(false);
  const editingFlight = ref(false);
  const flightForm = ref({
    airline: '',
    flight_number: '',
    departure_date: '',
    departure_time: '',
    departure_city: '',
    departure_airport_code: '',
    departure_terminal: '',
    departure_gate: '',
    arrival_city: '',
    arrival_airport_code: '',
    arrival_time: '',
    seat_assignment: '',
    notes: ''
  });

  // Rental Modal State
  const showRentalModal = ref(false);
  const editingRental = ref(false);
  const rentalForm = ref({
    company: '',
    pickup_date: '',
    return_date: '',
    vehicle_type: '',
    reservation_number: '',
    pickup_location: '',
    return_location: '',
    notes: ''
  });

  // Local Transport Modal State
  const showLocalTransportModal = ref(false);
  const editingTransport = ref(false);
  const transportForm = ref({
    type: '',
    date: '',
    from_location: '',
    to_location: '',
    departure_time: '',
    confirmation_number: '',
    notes: ''
  });

  // Parking Modal State
  const showNewParkingModal = ref(false);
  const showEditParkingModal = ref(false);
  const newParking = ref({
    airport: '',
    parking_provider: '',
    start_datetime: '',
    end_datetime: '',
    cost: 0,
    notes: '',
    trip_id: selectedTripId.value
  });
  const editParking = ref({});

  const tabs = [
    { id: 'flights', label: 'Flights' },
    { id: 'rental', label: 'Rental Cars' },
    { id: 'local', label: 'Local Transport' }
  ];

  const sortedFlights = computed(() =>
    [...flights.value].sort((a, b) => {
      const da = new Date(`${a.departure_date}T${a.departure_time}`);
      const db = new Date(`${b.departure_date}T${b.departure_time}`);
      return da - db;
    })
  );

  // Formatting helpers
  const formatDateRange = (s, e) =>
    s && e
      ? `${format(parseISO(s), 'MMM d')} - ${format(parseISO(e), 'MMM d, yyyy')}`
      : '';
  const formatDate = d => (d ? format(parseISO(d), 'EEE, MMM d, yyyy') : '');
  const formatTime = t => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h, 10);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };
  const calculateDuration = f => {
    if (!f.departure_date || !f.departure_time || !f.arrival_time) return 'N/A';
    let d = new Date(`${f.departure_date}T${f.departure_time}`);
    let a = new Date(`${f.departure_date}T${f.arrival_time}`);
    if (a < d) a.setDate(a.getDate() + 1);
    let m = differenceInMinutes(a, d);
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };
  const getFlightStatus = f => {
    const now = new Date();
    let d = new Date(`${f.departure_date}T${f.departure_time}`);
    let a = new Date(`${f.departure_date}T${f.arrival_time}`);
    if (a < d) a.setDate(a.getDate() + 1);
    if (isAfter(d, now)) return 'Upcoming';
    if (isBefore(a, now)) return 'Completed';
    return 'In Progress';
  };
  const getFlightStatusClass = f => {
    const s = getFlightStatus(f);
    if (s === 'Upcoming') return 'status-upcoming';
    if (s === 'In Progress') return 'status-in-progress';
    if (s === 'Completed') return 'status-completed';
    return '';
  };

  // Format datetime for parking cards
  const formatDateTime = dtString => {
    if (!dtString) return '';
    const dt = parseISO(dtString);
    return format(dt, 'MMM d, yyyy – HH:mm');
  };

  // Navigation
  const goBackToDashboard = () =>
    router.push({
      name: 'TravelDashboard',
      params: { id: userStore.currentProject?.id || projectId.value }
    });

  // Fetch list of trips
  const fetchTrips = async () => {
    try {
      if (!projectId.value) return;
      let { data, error } = await supabase
        .from('travel_trips')
        .select('*')
        .eq('project_id', projectId.value)
        .order('start_date', { ascending: true });
      if (error) throw error;
      trips.value = data || [];
    } catch (e) {
      console.error(e);
      toast.error('Failed to load trips');
    }
  };

  // Load all transport data for the selected trip
  const loadAllTransportData = async () => {
    if (!selectedTripId.value) return;
    isLoading.value = true;
    try {
      // Flights
      let { data: fd, error: fe } = await supabase
        .from('travel_flights')
        .select('*')
        .eq('trip_id', selectedTripId.value)
        .order('departure_date', { ascending: true });
      if (fe) throw fe;
      flights.value = fd || [];

      // Rental Cars
      let { data: rd, error: re } = await supabase
        .from('travel_rental_cars')
        .select('*')
        .eq('trip_id', selectedTripId.value)
        .order('pickup_date', { ascending: true });
      if (re) throw re;
      rentalCars.value = rd || [];

      // Local Transport
      let { data: ld, error: le } = await supabase
        .from('travel_local_transport')
        .select('*')
        .eq('trip_id', selectedTripId.value)
        .order('date', { ascending: true });
      if (le) throw le;
      localTransport.value = ld || [];

      // Parking
      let { data: pd, error: pe } = await supabase
        .from('travel_parking')
        .select('*')
        .eq('trip_id', selectedTripId.value)
        .order('start_datetime', { ascending: true });
      if (pe) throw pe;
      parkingSlots.value = pd || [];
    } catch (e) {
      console.error(e);
      toast.error('Error while loading transportation data');
    } finally {
      isLoading.value = false;
    }
  };

  // FLIGHT CRUD
  const openFlightModal = f => {
    editingFlight.value = !!f;
    flightForm.value = f
      ? { ...f }
      : {
          airline: '',
          flight_number: '',
          departure_date: '',
          departure_time: '',
          departure_city: '',
          departure_airport_code: '',
          departure_terminal: '',
          departure_gate: '',
          arrival_city: '',
          arrival_airport_code: '',
          arrival_time: '',
          seat_assignment: '',
          notes: ''
        };
    showFlightModal.value = true;
  };
  const closeFlightModal = () => (showFlightModal.value = false);
  const saveFlight = async () => {
    if (!selectedTripId.value) {
      toast.error('No trip selected');
      return;
    }
    isSaving.value = true;
    try {
      if (editingFlight.value && flightForm.value.id) {
        let { error } = await supabase
          .from('travel_flights')
          .update({ ...flightForm.value })
          .eq('id', flightForm.value.id);
        if (error) throw error;
        toast.success('Flight updated successfully');
      } else {
        let { error } = await supabase
          .from('travel_flights')
          .insert({
            ...flightForm.value,
            trip_id: selectedTripId.value,
            project_id: projectId.value
          });
        if (error) throw error;
        toast.success('Flight added successfully');
      }
      await loadAllTransportData();
      closeFlightModal();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save flight');
    } finally {
      isSaving.value = false;
    }
  };
  const deleteFlight = async id => {
    if (!confirm('Are you sure you want to delete this flight?')) return;
    try {
      let { error } = await supabase.from('travel_flights').delete().eq('id', id);
      if (error) throw error;
      toast.success('Flight deleted');
      await loadAllTransportData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete flight');
    }
  };

  // RENTAL CAR CRUD
  const openRentalModal = r => {
    editingRental.value = !!r;
    rentalForm.value = r
      ? { ...r }
      : {
          company: '',
          pickup_date: '',
          return_date: '',
          vehicle_type: '',
          reservation_number: '',
          pickup_location: '',
          return_location: '',
          notes: ''
        };
    showRentalModal.value = true;
  };
  const closeRentalModal = () => (showRentalModal.value = false);
  const saveRentalCar = async () => {
    if (!selectedTripId.value) {
      toast.error('No trip selected');
      return;
    }
    isSaving.value = true;
    try {
      if (editingRental.value && rentalForm.value.id) {
        let { error } = await supabase
          .from('travel_rental_cars')
          .update(rentalForm.value)
          .eq('id', rentalForm.value.id);
        if (error) throw error;
        toast.success('Rental car updated');
      } else {
        let { error } = await supabase
          .from('travel_rental_cars')
          .insert({
            ...rentalForm.value,
            trip_id: selectedTripId.value,
            project_id: projectId.value
          });
        if (error) throw error;
        toast.success('Rental car added');
      }
      await loadAllTransportData();
      closeRentalModal();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save rental car');
    } finally {
      isSaving.value = false;
    }
  };
  const deleteRental = async id => {
    if (!confirm('Are you sure you want to delete this rental?')) return;
    try {
      let { error } = await supabase.from('travel_rental_cars').delete().eq('id', id);
      if (error) throw error;
      toast.success('Rental car deleted');
      await loadAllTransportData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete rental car');
    }
  };

  // LOCAL TRANSPORT CRUD
  const openLocalTransportModal = t => {
    editingTransport.value = !!t;
    transportForm.value = t
      ? { ...t }
      : { type: '', date: '', from_location: '', to_location: '', departure_time: '', confirmation_number: '', notes: '' };
    showLocalTransportModal.value = true;
  };
  const closeLocalTransportModal = () => (showLocalTransportModal.value = false);
  const saveLocalTransport = async () => {
    if (!selectedTripId.value) {
      toast.error('No trip selected');
      return;
    }
    isSaving.value = true;
    try {
      if (editingTransport.value && transportForm.value.id) {
        let { error } = await supabase
          .from('travel_local_transport')
          .update(transportForm.value)
          .eq('id', transportForm.value.id);
        if (error) throw error;
        toast.success('Local transport updated');
      } else {
        let { error } = await supabase
          .from('travel_local_transport')
          .insert({
            ...transportForm.value,
            trip_id: selectedTripId.value,
            project_id: projectId.value
          });
        if (error) throw error;
        toast.success('Local transport added');
      }
      await loadAllTransportData();
      closeLocalTransportModal();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save local transport');
    } finally {
      isSaving.value = false;
    }
  };
  const deleteLocalTransport = async id => {
    if (!confirm('Are you sure you want to delete this?')) return;
    try {
      let { error } = await supabase.from('travel_local_transport').delete().eq('id', id);
      if (error) throw error;
      toast.success('Local transport deleted');
      await loadAllTransportData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete local transport');
    }
  };

  // PARKING CRUD
  const openNewParkingModal = () => {
    newParking.value = {
      airport: '',
      parking_provider: '',
      start_datetime: '',
      end_datetime: '',
      cost: 0,
      notes: '',
      trip_id: selectedTripId.value
    };
    showNewParkingModal.value = true;
  };
  const openEditParkingModal = slot => {
    editParking.value = { ...slot };
    showEditParkingModal.value = true;
  };
  const saveNewParking = async () => {
    const sd = new Date(newParking.value.start_datetime);
    const ed = new Date(newParking.value.end_datetime);
    if (ed < sd) {
      toast.error('End time cannot be before start time');
      return;
    }
    isSavingParking.value = true;
    try {
      const { error } = await supabase.from('travel_parking').insert([newParking.value]);
      if (error) throw error;
      toast.success('Parking added');
      showNewParkingModal.value = false;
      await loadAllTransportData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to add parking');
    } finally {
      isSavingParking.value = false;
    }
  };
  const updateParking = async () => {
    const sd = new Date(editParking.value.start_datetime);
    const ed = new Date(editParking.value.end_datetime);
    if (ed < sd) {
      toast.error('End time cannot be before start time');
      return;
    }
    try {
      const { error } = await supabase
        .from('travel_parking')
        .update(editParking.value)
        .eq('id', editParking.value.id);
      if (error) throw error;
      toast.success('Parking updated');
      showEditParkingModal.value = false;
      await loadAllTransportData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update parking');
    }
  };
  const deleteParking = async id => {
    if (!confirm('Are you sure you want to delete this parking entry?')) return;
    try {
      const { error } = await supabase.from('travel_parking').delete().eq('id', id);
      if (error) throw error;
      toast.success('Parking deleted');
      await loadAllTransportData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete parking');
    }
  };

  // Watch for changes to route.params.activeTab
  watch(
    () => route.params.activeTab,
    (newVal) => {
      activeTab.value = newVal || 'flights';
    }
  );

  onMounted(async () => {
    await fetchTrips();
    if (selectedTripId.value) loadAllTransportData();
  });

  return {
    trips,
    flights,
    rentalCars,
    localTransport,
    parkingSlots,
    selectedTripId,
    isLoading,
    isSaving,
    isSavingParking,
    activeTab,
    tabs,
    showFlightModal,
    editingFlight,
    flightForm,
    showRentalModal,
    editingRental,
    rentalForm,
    showLocalTransportModal,
    editingTransport,
    transportForm,
    showNewParkingModal,
    showEditParkingModal,
    newParking,
    editParking,
    sortedFlights,
    formatDateRange,
    formatDate,
    formatTime,
    calculateDuration,
    getFlightStatus,
    getFlightStatusClass,
    formatDateTime,
    openFlightModal,
    closeFlightModal,
    saveFlight,
    deleteFlight,
    openRentalModal,
    closeRentalModal,
    saveRentalCar,
    deleteRental,
    openLocalTransportModal,
    closeLocalTransportModal,
    saveLocalTransport,
    deleteLocalTransport,
    openNewParkingModal,
    openEditParkingModal,
    saveNewParking,
    updateParking,
    deleteParking,
    goBackToDashboard
  };
}
};
</script>

<style scoped>
.flight-details {
  width: 100%;
  padding: 32px;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #f8f9fa;
  color: #222;
  line-height: 1.5;
}
@media (min-width: 1024px) {
  .flight-details {
    max-width: 1200px;
    padding: 48px;
  }
}

.header-section {
  background: #fff;
  padding: 2rem 1rem 1.5rem 1rem;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
}
.header-section h1 {
  font-size: 2rem;
  color: #1f2937;
  margin-bottom: 0.25rem;
  font-weight: 700;
}
.header-section p {
  font-size: 1.1rem;
  color: #64748b;
  margin: 0;
}

.back-button-container {
  text-align: left;
  margin-bottom: 1rem;
}
.back-button {
  background: #f1f5f9;
  color: #2563eb;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s, color 0.2s, border 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.back-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
.back-icon {
  font-size: 1.2rem;
}
.back-text {
  display: none; /* Hide text on small screens */
}

@media (min-width: 576px) {
  .back-button {
    padding: 0.5rem 1.5rem;
  }
  .back-text {
    display: inline-block;
  }
}

.trip-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
  padding: 1.2rem 1rem 1rem 1rem;
}
.trip-selector label {
  font-weight: 500;
  color: #222;
}
.trip-select-input {
  padding: 0.6rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: #f8fafc;
  color: #222;
  width: 100%;
  box-sizing: border-box;
}
@media (min-width: 576px) {
  .trip-selector {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }
  .trip-select-input {
    width: auto;
  }
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 0;
  color: #64748b;
}
.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 600px;
}
.skeleton-item {
  background-color: #e5e7eb;
  border-radius: 8px;
  height: 20px;
  animation: pulse 1.5s infinite ease-in-out;
}
.skeleton-item:nth-child(1) { width: 80%; }
.skeleton-item:nth-child(2) { width: 60%; }
.skeleton-item:nth-child(3) { width: 70%; }

@keyframes pulse {
  0% {
    background-color: #e5e7eb;
  }
  50% {
    background-color: #f3f4f6;
  }
  100% {
    background-color: #e5e7eb;
  }
}

.empty-state {
  text-align: center;
  padding: 1rem;
  color: #64748b;
  background-color: #fff;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  font-style: italic;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.empty-icon {
  font-size: 3rem;
}
.empty-section {
  padding: 1rem;
  text-align: center;
  color: #64748b;
  background-color: #fff;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  font-style: italic;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.empty-section .empty-icon {
  font-size: 2.5rem;
}

.content-container {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border: 1.5px solid #e5e7eb;
  padding: 2rem 1.75rem;
  margin-top: 1.5rem;
}

.tabs-nav {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 24px;
  flex-wrap: wrap;
  background: #f1f5f9;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
  padding: 0.5rem 0.5rem 0.5rem 0.5rem;
}
.tab-btn {
  background: #f1f5f9;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px 8px 0 0;
  padding: 10px 22px;
  font-size: 1rem;
  color: #222;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border 0.2s;
  outline: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.tab-btn.active {
  background: #fff;
  color: #2563eb;
  border-bottom: 2.5px solid #2563eb;
  font-weight: 700;
  z-index: 2;
}
.tab-btn:not(.active):hover {
  background: #e0e7ef;
  color: #2563eb;
}
.tab-btn .icon {
  font-size: 1.1rem;
}
.tab-btn .button-text {
  display: none; /* Hide text on small screens */
}

@media (min-width: 576px) {
  .tab-btn {
    padding: 10px 22px;
    font-size: 1rem;
  }
  .tab-btn .button-text {
    display: inline-block;
  }
}

.section-content {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
@media (min-width: 480px) {
  .section-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
.section-header h2 {
  font-size: 1.4rem;
  color: #1f2937;
  font-weight: 600;
}
.add-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #10b981;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.add-button:hover {
  background: #059669;
}
.add-button .icon {
  font-size: 1.1rem;
}
.add-button .button-text {
  display: none; /* Hide text on small screens */
}

@media (min-width: 576px) {
  .add-button {
    padding: 0.5rem 1rem;
  }
  .add-button .button-text {
    display: inline-block;
  }
}

.flights-list,
.rental-list,
.transport-list,
.parking-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;
}
@media (min-width: 640px) {
  .flights-list,
  .rental-list,
  .transport-list,
  .parking-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

.flight-card,
.rental-card,
.transport-card,
.parking-card {
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
  transition: box-shadow 0.2s, transform 0.2s;
  display: flex;
  flex-direction: column;
}
.flight-card:hover,
.rental-card:hover,
.transport-card:hover,
.parking-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.10);
  transform: translateY(-2px);
}

.flight-card-header,
.rental-card-header,
.transport-card-header,
.parking-card-header {
  background-color: #f1f5f9;
  border-bottom: 1.5px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
}
.parking-card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #1f2937;
}
.parking-dates {
  font-size: 0.95rem;
  color: #64748b;
}

.flight-card-body,
.rental-card-body,
.transport-card-body,
.parking-card-body {
  padding: 0.75rem;
  flex-grow: 1; /* Allow body to grow and take available space */
}
.parking-card-body p {
  margin: 0.5rem 0;
  color: #1f2937;
}

.flight-route {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: nowrap;
  margin-bottom: 0.75rem;
}

.duration-line {
  width: 80px;
  height: 2px;
  background-color: #e5e7eb;
  position: relative;
}
.duration-line::before,
.duration-line::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 50%;
  top: -3px;
}
.duration-line::before { left: 0; }
.duration-line::after { right: 0; }

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
}
.detail-label {
  font-weight: 600;
  color: #64748b;
}
.detail-value {
  color: #1f2937;
}

.status-upcoming {
  color: #10b981;
  font-weight: 600;
}
.status-in-progress {
  color: #f59e42;
  font-weight: 600;
}
.status-completed {
  color: #64748b;
  font-weight: 600;
}

.flight-card-footer,
.rental-card-footer,
.transport-card-footer,
.parking-card-footer {
  padding: 0.75rem;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.flight-card-footer button,
.rental-card-footer button,
.transport-card-footer button,
.parking-card-footer button {
  margin-left: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border 0.2s;
}
.flight-card-footer button:hover,
.rental-card-footer button:hover,
.transport-card-footer button:hover,
.parking-card-footer button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
.edit-button {
  background: #f1f5f9;
  color: #2563eb;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border 0.2s;
}
.edit-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
.edit-button .action-icon {
  font-size: 1.1rem;
}
.edit-button .action-text {
  display: none; /* Hide text on small screens */
}

@media (min-width: 576px) {
  .edit-button {
    padding: 0.5rem 1rem;
  }
  .edit-button .action-text {
    display: inline-block;
  }
}

.delete-button {
  background: #ef4444;
  color: white;
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.delete-button:hover {
  background: #dc2626;
}
.delete-button .action-icon {
  font-size: 1.1rem;
}
.delete-button .action-text {
  display: none; /* Hide text on small screens */
}

@media (min-width: 576px) {
  .delete-button {
    padding: 0.5rem 1rem;
  }
  .delete-button .action-text {
    display: inline-block;
  }
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border 0.2s;
}
.action-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
.action-button .action-icon {
  font-size: 1.1rem;
}
.action-button .action-text {
  display: none; /* Hide text on small screens */
}

@media (min-width: 576px) {
  .action-button {
    padding: 0.5rem 1rem;
  }
  .action-button .action-text {
    display: inline-block;
  }
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
}
.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  z-index: -1;
}
.modal-container {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 2.25rem 1.75rem 1.75rem 1.75rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  position: relative;
}
.close-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #f1f5f9;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 1.2rem;
  color: #64748b;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  padding: 2px 8px;
}
.close-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
}
.modal-container::-webkit-scrollbar {
  width: 6px;
}
.modal-container::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.2);
  border-radius: 3px;
}
@media (max-width: 700px) {
  .flight-details {
    padding: 10px;
  }
  .modal-container {
    padding: 1.2rem 0.5rem 1rem 0.5rem;
  }
}
.form-group {
  margin-bottom: 1.5rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 0.97rem;
  color: #222;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.6rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  background: #fff;
  color: #222;
}
.modal-container input:focus,
.modal-container textarea:focus {
  outline: 2px solid #2563eb;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (min-width: 480px) {
  .form-row {
    flex-direction: row;
  }
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
}
.secondary-button {
  background-color: #6c757d;
  color: white;
  border-radius: 8px;
  padding: 0.5rem 1.25rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.secondary-button:hover {
  background-color: #5a6268;
}
.primary-button {
  background-color: #10b981;
  color: white;
  border-radius: 8px;
  padding: 0.5rem 1.25rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.primary-button:hover {
  background-color: #059669;
}
.primary-button:disabled {
  background-color: #a7f3d0;
  cursor: not-allowed;
}
.loading-spinner-small {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #10b981;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
  margin-right: 0.5rem;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>