import { useState, useEffect, useCallback, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import type { LatLng } from 'leaflet';
import type { PermitFeatureCollection } from '@lcm/types';

export interface PermitFilters {
  radiusMeters: number;
  permitType: string;
  workType: string;
  categoryName: string;
  activeOnly: boolean;
  fromDate: string;
  toDate: string;
  showConstruction: boolean;
  showRow: boolean;
}

export function usePermits(filters: PermitFilters): PermitFeatureCollection | null {
  const [data, setData] = useState<PermitFeatureCollection | null>(null);
  const [center, setCenter] = useState<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const map = useMapEvents({
    moveend() {
      setCenter(map.getCenter());
    },
    zoomend() {
      setCenter(map.getCenter());
    },
  });

  useEffect(() => {
    setCenter(map.getCenter());
  }, [map]);

  const fetchPermits = useCallback(
    async (c: LatLng) => {
      const params = new URLSearchParams({
        lat: String(c.lat),
        lng: String(c.lng),
        radiusMeters: String(filters.radiusMeters),
        activeOnly: String(filters.activeOnly),
      });

      if (filters.permitType) params.set('permitType', filters.permitType);
      if (filters.workType) params.set('workType', filters.workType);
      if (filters.categoryName) params.set('categoryName', filters.categoryName);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);

      // Filter by category on the server side if only one layer is toggled
      if (filters.showConstruction && !filters.showRow) {
        params.set('categoryName', 'construction');
      } else if (filters.showRow && !filters.showConstruction) {
        params.set('categoryName', 'row');
      }

      try {
        const res = await fetch(`/api/permits?${params.toString()}`);
        if (!res.ok) return;
        const json = (await res.json()) as PermitFeatureCollection;
        setData(json);
      } catch (err) {
        console.error('[usePermits] fetch failed:', err);
      }
    },
    [
      filters.radiusMeters,
      filters.activeOnly,
      filters.permitType,
      filters.workType,
      filters.categoryName,
      filters.fromDate,
      filters.toDate,
      filters.showConstruction,
      filters.showRow,
    ],
  );

  useEffect(() => {
    if (!center) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPermits(center);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [center, fetchPermits]);

  return data;
}
