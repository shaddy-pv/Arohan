/**
 * AROHAN Project & Landing Page Configuration
 * 
 * Centralized, verifiable project configuration.
 * All links, demo video embeds, and technical specifications
 * map directly to existing repository assets and implementations.
 */

export interface DemoVideoItem {
  id: string;
  title: string;
  category: string;
  description: string;
  embedUrl: string;
  directUrl: string;
  duration?: string;
  badge?: string;
  isAvailable: boolean;
}

export const PROJECT_METADATA = {
  name: "AROHAN",
  tagline: "Autonomous Safety & Hazard Monitoring System",
  shortDescription:
    "An AI and IoT-powered safety system that continuously monitors environments, detects potential hazards, analyzes their severity, and enables intelligent response and autonomous inspection.",
  version: "2.0.0",
  status: "Production Ready",
  license: "MIT",
  team: {
    name: "Team TECHEEZ",
    lead: "Shadan",
    coLead: "Shivam",
  },
  links: {
    github: "https://github.com/shaddy-pv/Arohan",
    contributing: "https://github.com/shaddy-pv/Arohan/blob/main/CONTRIBUTING.md",
    dataset: "https://huggingface.co/datasets/shaddy-pv/arohan-hazard-detection-dataset",
    liveDemo: "https://arohan-ruby.vercel.app",
    firebaseConsole: "https://console.firebase.google.com/project/ronin-80b29",
  },
  docs: [
    { title: "System Setup Guide", path: "docs/SETUP.md", description: "Full deployment & hardware setup" },
    { title: "System Architecture", path: "docs/ARCHITECTURE.md", description: "End-to-end multi-layer architecture" },
    { title: "Backend & CV API", path: "docs/API.md", description: "Flask REST & MJPEG streaming endpoints" },
    { title: "System Flow", path: "docs/SYSTEM_FLOW.md", description: "Telemetry pipeline and decision trees" },
    { title: "UI Components", path: "docs/COMPONENTS.md", description: "React component hierarchy & design tokens" },
    { title: "Database Schema", path: "docs/DATABASE.md", description: "Firebase Realtime DB security rules and structure" },
  ]
};

/**
 * Verified Demo Videos
 * Note: Uses actual project Google Drive demonstration recording.
 * Embeds using the Google Drive preview player with direct link fallback.
 */
export const DEMO_VIDEOS: DemoVideoItem[] = [
  {
    id: "system-overview",
    title: "System Overview & Field Demonstration",
    category: "Full Ecosystem",
    description: "End-to-end walkthrough demonstrating environmental hazard detection, multi-sensor telemetry, and live camera feed.",
    embedUrl: "https://drive.google.com/file/d/1I-GsaEnuhVUpobU__CI98upZ1kNSIQ63/preview",
    directUrl: "https://drive.google.com/file/d/1I-GsaEnuhVUpobU__CI98upZ1kNSIQ63/view?usp=sharing",
    duration: "Full Walkthrough",
    badge: "Verified Recording",
    isAvailable: true,
  },
  {
    id: "rover-demo",
    title: "Autonomous Rover Verification Unit",
    category: "Physical Robotics",
    description: "Physical rover chassis with Arduino controller, L298N drive system, and ESP32-CAM optical sensor for close-range verification.",
    embedUrl: "",
    directUrl: "https://github.com/shaddy-pv/Arohan/tree/main/hardware/rover",
    duration: "Hardware Slot",
    badge: "Hardware Firmware",
    isAvailable: false,
  },
  {
    id: "dashboard-demo",
    title: "Mission Control Dashboard & AI Telemetry",
    category: "Software Layer",
    description: "Live telemetry dashboard with real-time hazard scoring, sensor trend lines, and mission dispatch controls.",
    embedUrl: "",
    directUrl: "https://arohan-ruby.vercel.app",
    duration: "Interactive",
    badge: "Live Web App",
    isAvailable: false,
  }
];

export const SENSOR_SPECIFICATIONS = [
  {
    name: "MQ-2 Gas Sensor",
    type: "Combustible Gas & Smoke",
    role: "Detects LPG, propane, methane, alcohol, hydrogen, and combustible smoke particles.",
    analogRange: "200 - 800 PPM",
    weight: "30% Model Weight",
    icon: "Wind"
  },
  {
    name: "MQ-135 Gas Sensor",
    type: "Air Quality & Hazardous Gas",
    role: "Monitors harmful emissions including NH3, NOx, alcohol, benzene, smoke, and CO2.",
    analogRange: "300 - 1000 PPM",
    weight: "60% Model Weight",
    icon: "Activity"
  },
  {
    name: "DHT11 / DHT22",
    type: "Temperature & Humidity",
    role: "Tracks rapid ambient thermal increases and humidity variations indicating thermal anomalies.",
    analogRange: "20°C - 50°C",
    weight: "10% Model Weight",
    icon: "Thermometer"
  },
  {
    name: "Flame IR Sensor",
    type: "Optical Radiation",
    role: "Optical phototransistor sensitive to 760nm - 1100nm infrared flame radiation.",
    analogRange: "Digital Trigger (0/1)",
    weight: "Immediate Override",
    icon: "Flame"
  },
  {
    name: "PIR Motion Sensor",
    type: "Passive Infrared",
    role: "Detects occupant presence or sudden unauthorized motion within monitoring perimeter.",
    analogRange: "Digital Trigger (0/1)",
    weight: "Occupancy Context",
    icon: "UserCheck"
  },
  {
    name: "ESP32-CAM Optical",
    type: "Computer Vision & AI",
    role: "VGA 640x480 MJPEG stream at 8-10 FPS for facial recognition and physical accident validation.",
    analogRange: "8 - 10 FPS Stream",
    weight: "Visual Validation",
    icon: "Camera"
  }
];
