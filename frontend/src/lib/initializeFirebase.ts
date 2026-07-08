import { ref, set } from 'firebase/database';
import { database } from './firebase';
import { generateMockIoTReadings, generateMockRoverControl, generateMockRoverStatus } from './mockData';
import { logger } from './logger';

/**
 * Initialize Firebase with default structure and mock data
 * ⚠️ DEVELOPMENT ONLY - Use this for testing when hardware is not connected
 * This function is disabled in production builds
 */
export const initializeFirebaseStructure = async () => {
  // Prevent execution in production
  if (import.meta.env.PROD) {
    console.error('❌ Mock initialization is disabled in production');
    return false;
  }

  try {
    // Initialize IoT readings
    const iotRef = ref(database, 'ronin/iot');
    await set(iotRef, generateMockIoTReadings());

    // Initialize Rover control
    const roverControlRef = ref(database, 'ronin/rover/control');
    await set(roverControlRef, {
      direction: 'stop',
      speed: 0,
      mode: 'manual',
      emergency: false
    });

    // Initialize Rover status
    const roverStatusRef = ref(database, 'ronin/rover/status');
    await set(roverStatusRef, generateMockRoverStatus());

    logger.success('Firebase structure initialized successfully');
    return true;
  } catch (error) {
    logger.error('Error initializing Firebase', error);
    return false;
  }
};

/**
 * Reset Firebase to default state
 * ⚠️ DEVELOPMENT ONLY - Disabled in production
 */
export const resetFirebase = async () => {
  // Prevent execution in production
  if (import.meta.env.PROD) {
    console.error('❌ Firebase reset is disabled in production');
    return false;
  }

  try {
    const arohanRef = ref(database, 'arohan');
    await set(arohanRef, {
      iot: generateMockIoTReadings(),
      rover: {
        control: {
          direction: 'stop',
          speed: 0,
          mode: 'manual',
          emergency: false
        },
        status: generateMockRoverStatus()
      },
      alerts: {},
      history: {}
    });

    logger.success('Firebase reset successfully');
    return true;
  } catch (error) {
    logger.error('Error resetting Firebase', error);
    return false;
  }
};
