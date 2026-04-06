const PAGE_SIZE = 1000;

export interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number } | null;
}

export async function fetchAllFeatures(baseUrl: string): Promise<ArcGISFeature[]> {
  const features: ArcGISFeature[] = [];
  let offset = 0;

  while (true) {
    const url = new URL(`${baseUrl}/query`);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('f', 'pjson');
    url.searchParams.set('resultRecordCount', String(PAGE_SIZE));
    url.searchParams.set('resultOffset', String(offset));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`ArcGIS request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      features?: ArcGISFeature[];
      error?: unknown;
    };

    if (data.error) {
      throw new Error(`ArcGIS API error: ${JSON.stringify(data.error)}`);
    }

    const batch = data.features ?? [];
    features.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return features;
}
