export const DEMO_CAMPUS = {
  name: 'TechPark North Campus',
  lat: 12.9716,
  lng: 77.5946,
};

export const WEATHER_OPTIONS = [
  { value: 'clear', label: 'Clear skies (1.00x)' },
  { value: 'cloudy', label: 'Cloudy / Overcast (1.03x)' },
  { value: 'rain', label: 'Moderate rain (1.20x)' },
  { value: 'heavy_rain', label: 'Heavy rain / Storm (1.45x)' },
  { value: 'fog', label: 'Dense morning fog (1.25x)' },
];

export const INCIDENT_OPTIONS = [
  { value: 'none', label: 'No incidents (1.00x)' },
  { value: 'minor_accident', label: 'Minor arterial accident (1.15x)' },
  { value: 'road_closure', label: 'Major road closure / detour (1.35x)' },
];

export const ROUTE_COLORS = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#EF4444', // red
  '#84CC16', // lime
];

export function riskBadgeClasses(level) {
  if (level === 'high') {
    return 'bg-rose-100 text-rose-800 border-rose-300';
  }
  if (level === 'medium') {
    return 'bg-amber-100 text-amber-800 border-amber-300';
  }
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
}
