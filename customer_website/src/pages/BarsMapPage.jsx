import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { barService } from '../services/barService';
import { imageUrl } from '../utils/imageUrl';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function RoutingControl({ userLocation, destination, onRouteFound }) {
  const map = useMap();

  useEffect(() => {
    if (!userLocation || !destination || !map) return;
    
    let routingControl = null;
    let mounted = true;
    
    // Wait for map to be ready
    const timer = setTimeout(() => {
      if (!mounted) return;
      
      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(userLocation.lat, userLocation.lng),
          L.latLng(destination.lat, destination.lng)
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving',
        }),
        silent: true,
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        lineOptions: {
          styles: [{ color: '#ed1c24', weight: 6, opacity: 0.9 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        createMarker: () => null,
        show: true,
      });

      routingControl.on('routesfound', (e) => {
        if (!mounted) return;
        const route = e.routes[0];
        const distance = (route.summary.totalDistance / 1000).toFixed(2);
        const time = Math.round(route.summary.totalTime / 60);
        onRouteFound({ distance, time });
        
        // Announce first instruction
        if ('speechSynthesis' in window && route.instructions && route.instructions.length > 0) {
          setTimeout(() => {
            const firstInstruction = route.instructions[0];
            if (firstInstruction && firstInstruction.text) {
              const utterance = new SpeechSynthesisUtterance(firstInstruction.text);
              utterance.lang = 'en-US';
              window.speechSynthesis.speak(utterance);
            }
          }, 2000);
        }
      });

      routingControl.on('routingerror', (e) => {
        if (!mounted) return;
        console.error('Routing error:', e);
      });

      if (mounted) {
        routingControl.addTo(map);
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (routingControl && map) {
        try {
          map.removeControl(routingControl);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [map, userLocation, destination, onRouteFound]);

  return null;
}

function MapCenter({ center }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], center.zoom);
    }
  }, [map, center]);

  return null;
}

function BarsMapPage() {
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBar, setSelectedBar] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [navigatingTo, setNavigatingTo] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [centerLocation, setCenterLocation] = useState(null);

  const defaultCenter = [14.5995, 120.9842];

  useEffect(() => {
    loadBars();
    // Automatically request user location on page load
    handleGetUserLocation();
  }, []);

  const loadBars = async () => {
    try {
      setLoading(true);
      const data = await barService.list({ has_coords: 1 });
      setBars(data);
    } catch (error) {
      console.error('Failed to load bars:', error);
      setBars([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGetUserLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError('');
      },
      (error) => {
        setLocationError('Unable to retrieve your location. Please enable location access.');
        console.error('Geolocation error:', error);
      }
    );
  };

  const handleNavigate = useCallback((bar) => {
    const barLat = parseFloat(bar.latitude);
    const barLng = parseFloat(bar.longitude);
    
    if (!barLat || !barLng || isNaN(barLat) || isNaN(barLng)) {
      alert('This bar does not have valid coordinates for navigation.');
      return;
    }
    
    if (!userLocation) {
      handleGetUserLocation();
      setTimeout(() => {
        if (userLocation) {
          const destination = { lat: barLat, lng: barLng };
          setNavigatingTo(destination);
          setSelectedBar(bar);
        }
      }, 1000);
    } else {
      const destination = { lat: barLat, lng: barLng };
      setNavigatingTo(destination);
      setSelectedBar(bar);
    }
  }, [userLocation]);

  const handleCancelNavigation = () => {
    setNavigatingTo(null);
    setRouteInfo(null);
  };

  const handleRouteFound = useCallback((info) => {
    setRouteInfo(info);
    
    // Voice announcement
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Navigation started to ${selectedBar?.name}. Distance: ${info.distance} kilometers. Estimated time: ${info.time} minutes.`
      );
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [selectedBar]);

  const handleCenterOnBar = useCallback((bar) => {
    const lat = parseFloat(bar.latitude);
    const lng = parseFloat(bar.longitude);
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      // This will be handled by the MapCenter component
      setCenterLocation({ lat, lng, zoom: 16 });
    }
  }, []);

  return (
    <div className="map-page">
      <div className="map-header">
        <div className="container">
          <h1 className="section-title">Bars Map</h1>
          <p className="section-subtitle">Explore bars near you and get directions</p>
        </div>
      </div>

      <div className="map-controls">
        <div className="container">
          <button className="button" onClick={handleGetUserLocation} type="button">
            📍 Get My Location
          </button>
          {userLocation && (
            <span className="location-status">Location detected ✓</span>
          )}
          {locationError && <span className="error">{locationError}</span>}
        </div>
      </div>

      {navigatingTo && routeInfo && (
        <div className="route-info">
          <div className="container">
            <div className="route-card">
              <h3>Navigating to {selectedBar?.name}</h3>
              <div className="route-details">
                <span>📏 Distance: {routeInfo.distance} km</span>
                <span>⏱️ Estimated time: {routeInfo.time} min</span>
              </div>
              <button className="button ghost" onClick={handleCancelNavigation} type="button">
                Cancel Navigation
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="map-container-wrapper">
        {loading ? (
          <div className="map-loading">Loading bars map...</div>
        ) : (
          <div style={{ height: '600px', width: '100%', position: 'relative' }}>
            <MapContainer
              center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter}
              zoom={userLocation ? 14 : 13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {userLocation && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={blueIcon}>
                  <Popup>
                    <strong>Your Location</strong>
                  </Popup>
                </Marker>
              )}

              {bars.map((bar) => {
                if (!bar.latitude || !bar.longitude) return null;
                
                const lat = parseFloat(bar.latitude);
                const lng = parseFloat(bar.longitude);
                
                // Create custom icon with bar name label
                const barIconWithLabel = L.divIcon({
                  html: `
                    <div style="position: relative;">
                      <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" 
                           style="width: 25px; height: 41px;" />
                      <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); 
                                  background: rgba(237, 28, 36, 0.95); color: white; padding: 4px 8px; 
                                  border-radius: 4px; white-space: nowrap; font-weight: 600; font-size: 12px;
                                  box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        ${bar.name}
                      </div>
                    </div>
                  `,
                  className: 'custom-bar-marker',
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                });
                
                return (
                  <Marker
                    key={bar.id}
                    position={[lat, lng]}
                    icon={barIconWithLabel}
                  >
                    <Popup>
                      <div className="map-popup">
                        {bar.image_path && (
                          <img
                            src={imageUrl(bar.image_path)}
                            alt={bar.name}
                            className="popup-image"
                          />
                        )}
                        <h3>{bar.name}</h3>
                        <p className="popup-rating">⭐ {bar.rating || '0.0'} ({bar.review_count || 0} reviews)</p>
                        <p className="popup-address">{bar.address}, {bar.city}</p>
                        <div className="popup-actions">
                          <button className="button" onClick={() => handleCenterOnBar(bar)} type="button">
                            View on Map
                          </button>
                          <button className="button" onClick={() => handleNavigate(bar)} type="button">
                            Go to Location
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {userLocation && !centerLocation && (
                <MapCenter center={{ lat: userLocation.lat, lng: userLocation.lng, zoom: 14 }} />
              )}
              {centerLocation && (
                <MapCenter center={centerLocation} />
              )}
              {navigatingTo && userLocation && (
                <RoutingControl
                  key={`${userLocation.lat}-${userLocation.lng}-${navigatingTo.lat}-${navigatingTo.lng}`}
                  userLocation={userLocation}
                  destination={navigatingTo}
                  onRouteFound={handleRouteFound}
                />
              )}
            </MapContainer>
          </div>
        )}
      </div>

      <div className="map-footer">
        <div className="container">
          <p className="section-subtitle">
            Click on any red marker to view bar details and get directions. Blue marker shows your current location.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BarsMapPage;
