export interface Permit {
  id: number;
  source_system_id: number;
  source_dataset: string;
  source_record_id: string;
  permit_number: string | null;
  permit_type: string | null;
  permit_status: string | null;
  category_name: string | null;
  work_type: string | null;
  contractor: string | null;
  applicant_name: string | null;
  work_description: string | null;
  zoning: string | null;
  sqft: number | null;
  permit_fee: number | null;
  project_costs: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  district: string | null;
  neighborhood: string | null;
  start_date: string | null;
  end_date: string | null;
  issue_date: string | null;
  latitude: number | null;
  longitude: number | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

export interface PermitFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  properties: Permit;
}

export interface PermitFeatureCollection {
  type: 'FeatureCollection';
  features: PermitFeature[];
}

export interface WatchLocation {
  id: number;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface AlertRule {
  id: number;
  user_id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  include_permit_types: string[] | null;
  include_work_types: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
}

export type PermitCategory = 'construction' | 'row' | 'state_closure';
