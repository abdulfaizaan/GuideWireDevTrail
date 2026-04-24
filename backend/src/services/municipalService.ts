export interface MunicipalDisruption {
  id: string;
  type: "outage" | "bandh";
  severity: "none" | "partial" | "full";
  source: string;
  region: string;
  date: string;
}

// In-memory store for active disruptions
let activeDisruptions: MunicipalDisruption[] = [
  {
    id: "initial_mumbai_bandh",
    type: "bandh",
    severity: "full",
    source: "State Government Gazette",
    region: "mumbai",
    date: new Date().toISOString().split("T")[0], // Today
  }
];

export const getDisruptionsByRegion = (region: string, type?: "outage" | "bandh"): MunicipalDisruption[] => {
  const today = new Date().toISOString().split("T")[0];
  return activeDisruptions.filter((d) => 
    d.date === today && 
    (d.region.toLowerCase() === region.toLowerCase() || d.region === "all") &&
    (!type || d.type === type)
  );
};

export const addDisruption = (disruption: Omit<MunicipalDisruption, "id">): MunicipalDisruption => {
  const newDisruption = { ...disruption, id: `disruption_${Date.now()}` };
  activeDisruptions.push(newDisruption);
  return newDisruption;
};

export const clearDisruptions = (region?: string) => {
  if (region) {
    activeDisruptions = activeDisruptions.filter(d => d.region.toLowerCase() !== region.toLowerCase());
  } else {
    activeDisruptions = [];
  }
};
