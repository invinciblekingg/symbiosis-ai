// Map initialization and logic
let map;
let marker;

// Default center (India)
const DEFAULT_LAT = 20.5937;
const DEFAULT_LNG = 78.9629;
const DEFAULT_ZOOM = 5;

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return; // Only run on pages with a map container

    // Initialize map
    map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Click handler to set location
    map.on('click', function(e) {
        setMarker(e.latlng.lat, e.latlng.lng);
        updateInputFields(e.latlng.lat, e.latlng.lng);
    });

    // Check if we have existing coordinates in inputs (e.g. if editing)
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    
    if (latInput && lngInput && latInput.value && lngInput.value) {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        setMarker(lat, lng);
        map.setView([lat, lng], 13);
    }
}

function setMarker(lat, lng) {
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        
        // Update inputs when marker is dragged
        marker.on('dragend', function(e) {
            const position = marker.getLatLng();
            updateInputFields(position.lat, position.lng);
        });
    }
}

function updateInputFields(lat, lng) {
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    
    if (latInput && lngInput) {
        latInput.value = lat.toFixed(6);
        lngInput.value = lng.toFixed(6);
    }
}

// Geolocation
function getUserLocation() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    const btn = document.getElementById('useLocationBtn');
    const originalText = btn ? btn.innerText : '';
    if (btn) btn.innerText = "Locating...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            if (map) {
                map.setView([lat, lng], 15);
                setMarker(lat, lng);
                updateInputFields(lat, lng);
            }
            
            if (btn) btn.innerText = originalText;
        },
        (error) => {
            console.error("Error getting location:", error);
            alert("Unable to retrieve your location. Please enter manually or click on the map.");
            if (btn) btn.innerText = originalText;
        }
    );
}

// Haversine Formula for distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    const locationBtn = document.getElementById('useLocationBtn');
    if (locationBtn) {
        locationBtn.addEventListener('click', getUserLocation);
    }
});
