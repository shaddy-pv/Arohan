/**
 * Rover Mission Service
 * 
 * Handles rover dispatch, mission tracking, and status updates
 */

import { ref, set, update, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

export type RoverMissionState = 'IDLE' | 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED' | 'INVESTIGATING' | 'RETURNING' | 'COMPLETED' | 'OFFLINE';

export interface RoverMission {
  state: RoverMissionState;
  target: string;
  reason?: string;
  dispatchedAt?: number;
  enRouteAt?: number;
  arrivedAt?: number;
  completedAt?: number;
  updatedAt: number;
  progress?: number; // 0-100
}

/**
 * Dispatch rover to a target location
 */
export async function dispatchRover(target: string, reason: string): Promise<void> {
  const now = Date.now();
  
  // Update mission status
  const missionRef = ref(database, 'ronin/rover/mission');
  await set(missionRef, {
    state: 'DISPATCHED',
    target,
    reason,
    dispatchedAt: now,
    updatedAt: now,
    progress: 0
  });

  // Set rover control to auto mode
  const controlRef = ref(database, 'ronin/rover/control');
  await update(controlRef, {
    mode: 'auto',
    direction: 'forward',
    speed: 50
  });
}

/**
 * Update mission state to EN_ROUTE
 */
export async function setRoverEnRoute(): Promise<void> {
  const now = Date.now();
  
  const missionRef = ref(database, 'ronin/rover/mission');
  await update(missionRef, {
    state: 'EN_ROUTE',
    enRouteAt: now,
    updatedAt: now,
    progress: 50
  });
}

/**
 * Mark rover as arrived at target
 */
export async function markRoverArrived(): Promise<void> {
  const now = Date.now();
  
  const missionRef = ref(database, 'ronin/rover/mission');
  await update(missionRef, {
    state: 'ARRIVED',
    arrivedAt: now,
    updatedAt: now,
    progress: 100
  });

  // Stop rover movement
  const controlRef = ref(database, 'ronin/rover/control');
  await update(controlRef, {
    direction: 'stop',
    speed: 0
  });
}

/**
 * Start investigation phase
 */
export async function startInvestigation(): Promise<void> {
  const now = Date.now();
  
  const missionRef = ref(database, 'ronin/rover/mission');
  await update(missionRef, {
    state: 'INVESTIGATING',
    updatedAt: now
  });
}

/**
 * Complete mission and return to base
 */
export async function completeMission(): Promise<void> {
  const now = Date.now();
  
  const missionRef = ref(database, 'ronin/rover/mission');
  await update(missionRef, {
    state: 'RETURNING',
    updatedAt: now
  });

  // Set rover to return
  const controlRef = ref(database, 'ronin/rover/control');
  await update(controlRef, {
    direction: 'back',
    speed: 40
  });
}

/**
 * Reset mission to IDLE
 */
export async function resetMission(): Promise<void> {
  const now = Date.now();
  
  const missionRef = ref(database, 'ronin/rover/mission');
  await set(missionRef, {
    state: 'IDLE',
    target: '',
    updatedAt: now,
    progress: 0
  });

  // Set rover control to manual and stop
  const controlRef = ref(database, 'ronin/rover/control');
  await update(controlRef, {
    mode: 'manual',
    direction: 'stop',
    speed: 0,
    emergency: false
  });
}

/**
 * Subscribe to mission updates
 */
export function subscribeToMission(callback: (mission: RoverMission | null) => void): () => void {
  const missionRef = ref(database, 'ronin/rover/mission');
  
  const unsubscribe = onValue(missionRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });

  return () => off(missionRef);
}

/**
 * Update mission progress (0-100)
 */
export async function updateMissionProgress(progress: number): Promise<void> {
  const missionRef = ref(database, 'ronin/rover/mission');
  await update(missionRef, {
    progress: Math.max(0, Math.min(100, progress)),
    updatedAt: Date.now()
  });
}
