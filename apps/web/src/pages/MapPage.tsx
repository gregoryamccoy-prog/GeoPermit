import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { usePermits, type PermitFilters } from '../hooks/usePermits';
import FilterSidebar from '../components/FilterSidebar';
import LayerToggle from '../components/LayerToggle';
import ConstructionPopup from '../components/ConstructionPopup';
import RowPopup from '../components/RowPopup';
import SaveLocationModal from '../components/SaveLocationModal';
import SavedLocationsList from '../components/SavedLocationsList';
import type { PermitFeature } from '@lcm/types';

// Louisville city center
const DEFAULT_CENTER: [number, number] = [38.2527, -85.7585];
const DEFAULT_ZOOM = 12;

const CONSTRUCTION_COLOR = '#2563eb'; // blue
const ROW_COLOR = '#ea580c';          // orange

// PermitLayer must be a child of MapContainer to use react-leaflet hooks
function PermitLayer({ filters }: { filters: PermitFilters }) {
  const data = usePermits(filters);

  if (!data) return null;

  return (
    <>
      {data.features.map((feature: PermitFeature) => {
        if (!feature.geometry) return null;
        const [lng, lat] = feature.geometry.coordinates;
        const isRow = feature.properties.category_name === 'row';
        const color = isRow ? ROW_COLOR : CONSTRUCTION_COLOR;

        if (isRow && !filters.showRow) return null;
        if (!isRow && !filters.showConstruction) return null;

        return (
          <CircleMarker
            key={feature.properties.id}
            center={[lat, lng]}
            radius={7}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 1.5 }}
          >
            <Popup maxWidth={320}>
              {isRow ? (
                <RowPopup permit={feature.properties} />
              ) : (
                <ConstructionPopup permit={feature.properties} />
              )}
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

// Handles flying to a geocoded address
function FlyToHandler({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15);
  }, [target, map]);
  return null;
}

export default function MapPage() {
  const mapRef = useRef<LeafletMap | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);

  const [filters, setFilters] = useState<PermitFilters>({
    radiusMeters: 1609,
    permitType: '',
    workType: '',
    categoryName: '',
    activeOnly: true,
    fromDate: '',
    toDate: '',
    showConstruction: true,
    showRow: true,
  });

  function handleAddressSelect(lat: number, lng: number) {
    setFlyTarget({ lat, lng });
    setTimeout(() => setFlyTarget(null), 1000);
  }

  function handleLayerToggle(layer: 'construction' | 'row', value: boolean) {
    setFilters((f) => ({
      ...f,
      showConstruction: layer === 'construction' ? value : f.showConstruction,
      showRow: layer === 'row' ? value : f.showRow,
    }));
  }

  const mapCenter = mapRef.current?.getCenter();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRight: '1px solid #e2e8f0', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px', background: '#1e3a5f', color: '#fff' }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Local Change Monitor</h1>
          <p style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Louisville Permits & ROW Activity</p>
        </div>

        <FilterSidebar filters={filters} onChange={setFilters} onAddressSelect={handleAddressSelect} />

        <div style={{ padding: '8px 16px', borderTop: '1px solid #e2e8f0' }}>
          <LayerToggle
            showConstruction={filters.showConstruction}
            showRow={filters.showRow}
            onToggle={handleLayerToggle}
          />
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setShowSaveModal(true)}
            style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            + Save This Location
          </button>
          <button
            onClick={() => setShowSavedList((v) => !v)}
            style={{ padding: '8px 12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            {showSavedList ? 'Hide' : 'Show'} Saved Locations
          </button>
        </div>

        {showSavedList && <SavedLocationsList onFlyTo={handleAddressSelect} />}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PermitLayer filters={filters} />
          {flyTarget && <FlyToHandler target={flyTarget} />}
        </MapContainer>
      </div>

      {showSaveModal && (
        <SaveLocationModal
          defaultLat={mapRef.current?.getCenter().lat ?? DEFAULT_CENTER[0]}
          defaultLng={mapRef.current?.getCenter().lng ?? DEFAULT_CENTER[1]}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
