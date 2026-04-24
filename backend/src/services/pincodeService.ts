/**
 * Pincode Service — Geo-routing and mapping
 */

export interface Location {
  lat: number;
  lon: number;
  city: string;
  state: string;
}

const PINCODE_DB: Record<string, Location> = {
  "400001": { lat: 18.9322, lon: 72.8264, city: "Mumbai", state: "MH" },
  "400058": { lat: 19.1235, lon: 72.8361, city: "Mumbai", state: "MH" }, // Andheri
  "400070": { lat: 19.0760, lon: 72.8777, city: "Mumbai", state: "MH" }, // Kurla
  "110001": { lat: 28.6139, lon: 77.2090, city: "Delhi", state: "DL" },
  "110017": { lat: 28.5355, lon: 77.2155, city: "Delhi", state: "DL" },
  "560001": { lat: 12.9716, lon: 77.5946, city: "Bangalore", state: "KA" },
  "560008": { lat: 12.9699, lon: 77.6499, city: "Bangalore", state: "KA" },
  "411001": { lat: 18.5204, lon: 73.8567, city: "Pune", state: "MH" },
  "600001": { lat: 13.0827, lon: 80.2707, city: "Chennai", state: "TN" },
};

export function getPincodeLocation(pincode: string): Location {
  return PINCODE_DB[pincode] || { lat: 18.9322, lon: 72.8264, city: "Mumbai", state: "MH" }; // Default Mumbai
}

export function pincodeToCityName(pincode: string): string {
  return getPincodeLocation(pincode).city;
}

export function generateZoneId(pincode: string): string {
  const loc = getPincodeLocation(pincode);
  return `${loc.city.toLowerCase()}_${pincode}`;
}
