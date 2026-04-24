/**
 * Pincode Service — Hyperlocal geolocation for Indian pincodes
 *
 * Maps Indian pincodes to lat/lon coordinates for hyperlocal weather queries.
 * Falls back to city centroid when an exact pincode mapping is unavailable.
 */

export interface PincodeLocation {
  lat: number;
  lon: number;
  locality: string;
  city: string;
  pincode: string;
}

// ---------------------------------------------------------------------------
// Pincode → coordinates mapping (major Indian localities)
// ---------------------------------------------------------------------------
const PINCODE_DB: Record<string, { lat: number; lon: number; locality: string; city: string }> = {
  // Mumbai
  "400001": { lat: 18.9398, lon: 72.8354, locality: "Fort", city: "Mumbai" },
  "400002": { lat: 18.9543, lon: 72.8331, locality: "Kalbadevi", city: "Mumbai" },
  "400003": { lat: 18.9619, lon: 72.8311, locality: "Mandvi", city: "Mumbai" },
  "400007": { lat: 18.9717, lon: 72.8204, locality: "Grant Road", city: "Mumbai" },
  "400011": { lat: 19.0219, lon: 72.8456, locality: "Matunga", city: "Mumbai" },
  "400012": { lat: 19.0190, lon: 72.8570, locality: "Parel", city: "Mumbai" },
  "400014": { lat: 19.0174, lon: 72.8411, locality: "Dadar", city: "Mumbai" },
  "400016": { lat: 18.9893, lon: 72.8263, locality: "Mahim", city: "Mumbai" },
  "400017": { lat: 19.0231, lon: 72.8418, locality: "Dharavi", city: "Mumbai" },
  "400020": { lat: 19.0055, lon: 72.8244, locality: "Churchgate", city: "Mumbai" },
  "400028": { lat: 19.0544, lon: 72.8379, locality: "Bandra West", city: "Mumbai" },
  "400049": { lat: 19.0607, lon: 72.8362, locality: "Bandra East", city: "Mumbai" },
  "400050": { lat: 19.0596, lon: 72.8295, locality: "Khar", city: "Mumbai" },
  "400051": { lat: 19.0707, lon: 72.8334, locality: "Santacruz", city: "Mumbai" },
  "400053": { lat: 19.0780, lon: 72.8456, locality: "Vile Parle", city: "Mumbai" },
  "400058": { lat: 19.0990, lon: 72.8530, locality: "Andheri East", city: "Mumbai" },
  "400069": { lat: 19.1136, lon: 72.8697, locality: "Andheri East", city: "Mumbai" },
  "400070": { lat: 19.0760, lon: 72.8860, locality: "Kurla", city: "Mumbai" },
  "400072": { lat: 19.0910, lon: 72.8880, locality: "Ghatkopar", city: "Mumbai" },
  "400076": { lat: 19.1100, lon: 72.9070, locality: "Powai", city: "Mumbai" },
  "400080": { lat: 19.0560, lon: 72.9100, locality: "Chembur", city: "Mumbai" },
  "400086": { lat: 19.1760, lon: 72.8477, locality: "Goregaon", city: "Mumbai" },
  "400092": { lat: 19.1560, lon: 72.8520, locality: "Borivali", city: "Mumbai" },
  "400097": { lat: 19.2200, lon: 72.8570, locality: "Malad", city: "Mumbai" },
  "400601": { lat: 19.1860, lon: 72.9740, locality: "Thane", city: "Thane" },
  "400703": { lat: 19.0330, lon: 73.0297, locality: "Navi Mumbai", city: "Navi Mumbai" },

  // Delhi
  "110001": { lat: 28.6353, lon: 77.2250, locality: "Connaught Place", city: "Delhi" },
  "110003": { lat: 28.6100, lon: 77.2300, locality: "Lodhi Road", city: "Delhi" },
  "110005": { lat: 28.6400, lon: 77.1980, locality: "Karol Bagh", city: "Delhi" },
  "110017": { lat: 28.5689, lon: 77.2330, locality: "Hauz Khas", city: "Delhi" },
  "110020": { lat: 28.5500, lon: 77.2600, locality: "Nehru Place", city: "Delhi" },
  "110025": { lat: 28.5650, lon: 77.2500, locality: "Okhla", city: "Delhi" },
  "110030": { lat: 28.5270, lon: 77.2190, locality: "Mehrauli", city: "Delhi" },
  "110034": { lat: 28.6800, lon: 77.2100, locality: "Pitampura", city: "Delhi" },
  "110044": { lat: 28.6500, lon: 77.3100, locality: "Laxmi Nagar", city: "Delhi" },
  "110085": { lat: 28.6970, lon: 77.2850, locality: "Shahdara", city: "Delhi" },
  "110092": { lat: 28.5700, lon: 77.3270, locality: "Noida Border", city: "Delhi" },
  "122001": { lat: 28.4595, lon: 77.0266, locality: "Gurugram", city: "Gurugram" },
  "201301": { lat: 28.5355, lon: 77.3910, locality: "Noida", city: "Noida" },

  // Bangalore
  "560001": { lat: 12.9716, lon: 77.5946, locality: "MG Road", city: "Bangalore" },
  "560008": { lat: 12.9352, lon: 77.6245, locality: "Koramangala", city: "Bangalore" },
  "560011": { lat: 12.9957, lon: 77.5562, locality: "Malleshwaram", city: "Bangalore" },
  "560034": { lat: 12.9698, lon: 77.7500, locality: "Whitefield", city: "Bangalore" },
  "560037": { lat: 12.9165, lon: 77.6101, locality: "BTM Layout", city: "Bangalore" },
  "560066": { lat: 12.9080, lon: 77.6470, locality: "HSR Layout", city: "Bangalore" },
  "560068": { lat: 12.8450, lon: 77.6630, locality: "Electronic City", city: "Bangalore" },
  "560100": { lat: 12.9063, lon: 77.5857, locality: "JP Nagar", city: "Bangalore" },

  // Chennai
  "600001": { lat: 13.0878, lon: 80.2785, locality: "George Town", city: "Chennai" },
  "600017": { lat: 13.0569, lon: 80.2425, locality: "T Nagar", city: "Chennai" },
  "600040": { lat: 13.0109, lon: 80.2216, locality: "Adyar", city: "Chennai" },
  "600096": { lat: 12.9516, lon: 80.2327, locality: "OMR", city: "Chennai" },

  // Pune
  "411001": { lat: 18.5196, lon: 73.8553, locality: "Shivaji Nagar", city: "Pune" },
  "411006": { lat: 18.5590, lon: 73.7869, locality: "Deccan", city: "Pune" },
  "411014": { lat: 18.5600, lon: 73.9180, locality: "Hadapsar", city: "Pune" },
  "411038": { lat: 18.5912, lon: 73.7389, locality: "Hinjawadi", city: "Pune" },
  "411057": { lat: 18.4575, lon: 73.8675, locality: "Undri", city: "Pune" },

  // Hyderabad
  "500001": { lat: 17.3850, lon: 78.4867, locality: "Abids", city: "Hyderabad" },
  "500032": { lat: 17.4400, lon: 78.3489, locality: "HITEC City", city: "Hyderabad" },
  "500081": { lat: 17.4486, lon: 78.3908, locality: "Madhapur", city: "Hyderabad" },
  "500084": { lat: 17.4260, lon: 78.4410, locality: "Banjara Hills", city: "Hyderabad" },

  // Kolkata
  "700001": { lat: 22.5726, lon: 88.3639, locality: "BBD Bagh", city: "Kolkata" },
  "700019": { lat: 22.5180, lon: 88.3630, locality: "Ballygunge", city: "Kolkata" },
  "700091": { lat: 22.5738, lon: 88.4319, locality: "Salt Lake", city: "Kolkata" },
  "700156": { lat: 22.5958, lon: 88.4840, locality: "New Town", city: "Kolkata" },

  // Jaipur
  "302001": { lat: 26.9124, lon: 75.7873, locality: "Pink City", city: "Jaipur" },
  "302017": { lat: 26.9100, lon: 75.7400, locality: "Mansarovar", city: "Jaipur" },
};

// City centroid fallbacks
const CITY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  mumbai: { lat: 19.0760, lon: 72.8777 },
  delhi: { lat: 28.6139, lon: 77.2090 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  hyderabad: { lat: 17.3850, lon: 78.4867 },
  pune: { lat: 18.5204, lon: 73.8567 },
  jaipur: { lat: 26.9124, lon: 75.7873 },
  thane: { lat: 19.2183, lon: 72.9781 },
  noida: { lat: 28.5355, lon: 77.3910 },
  gurugram: { lat: 28.4595, lon: 77.0266 },
};

// ---------------------------------------------------------------------------
// Main lookup function
// ---------------------------------------------------------------------------
export function getPincodeLocation(pincode: string): PincodeLocation {
  const clean = pincode.trim();

  // Direct lookup
  if (PINCODE_DB[clean]) {
    const entry = PINCODE_DB[clean];
    return { ...entry, pincode: clean };
  }

  // Try to infer city from pincode prefix
  const prefix = clean.substring(0, 2);
  let fallbackCity = "Mumbai";
  if (prefix === "11" || prefix === "12" || prefix === "20") fallbackCity = "Delhi";
  else if (prefix === "56") fallbackCity = "Bangalore";
  else if (prefix === "60") fallbackCity = "Chennai";
  else if (prefix === "41") fallbackCity = "Pune";
  else if (prefix === "50") fallbackCity = "Hyderabad";
  else if (prefix === "70") fallbackCity = "Kolkata";
  else if (prefix === "30") fallbackCity = "Jaipur";
  else if (prefix === "40") fallbackCity = "Mumbai";

  const centroid = CITY_CENTROIDS[fallbackCity.toLowerCase()] || CITY_CENTROIDS.mumbai;

  return {
    lat: centroid.lat,
    lon: centroid.lon,
    locality: `Zone ${clean}`,
    city: fallbackCity,
    pincode: clean,
  };
}

/**
 * Returns a city name for API queries that accept city names
 */
export function pincodeToCityName(pincode: string): string {
  const loc = getPincodeLocation(pincode);
  return loc.city;
}
