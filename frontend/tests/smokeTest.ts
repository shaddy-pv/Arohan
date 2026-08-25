/**
 * ⚠️ DEVELOPMENT ONLY - Smoke Test Utilities for IoT Integration
 * 
 * These utilities help verify the IoT data flow and UI behavior
 * Run in browser console for manual testing
 * 
 * ⚠️ This file should NEVER be loaded in production builds
 */

// Prevent loading in production
if (import.meta.env.PROD) {
  throw new Error('❌ Smoke test utilities should not be loaded in production!');
}

import { ref, set } from 'firebase/database';
import { database } from '@/lib/firebase';

export interface TestPayload {
    mq2: number;
    mq135: number;
    mq135_raw: 0 | 1;
    mq135_digital: 0 | 1;
    temperature: number;
    humidity: number;
    flame: boolean;
    motion: boolean;
    hazardScore: number;
    riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
    status: {
        online: boolean;
        lastHeartbeat: number;
    };
    emergency: {
        active: boolean;
        timestamp: number;
    };
}

/**
 * Test Scenarios
 */
export const TEST_SCENARIOS = {
    SAFE: {
        mq2: 250,
        mq135: 450,
        mq135_raw: 0,
        mq135_digital: 0,
        temperature: 24.5,
        humidity: 55,
        flame: false,
        motion: false,
        hazardScore: 15,
        riskLevel: 'SAFE' as const,
        status: { online: true, lastHeartbeat: Date.now() },
        emergency: { active: false, timestamp: 0 }
    },

    WARNING: {
        mq2: 500,
        mq135: 700,
        mq135_raw: 1,
        mq135_digital: 0,
        temperature: 32.0,
        humidity: 45,
        flame: false,
        motion: true,
        hazardScore: 45,
        riskLevel: 'WARNING' as const,
        status: { online: true, lastHeartbeat: Date.now() },
        emergency: { active: false, timestamp: 0 }
    },

    DANGER: {
        mq2: 800,
        mq135: 950,
        mq135_raw: 1,
        mq135_digital: 1,
        temperature: 45.2,
        humidity: 30,
        flame: true,
        motion: true,
        hazardScore: 85,
        riskLevel: 'DANGER' as const,
        status: { online: true, lastHeartbeat: Date.now() },
        emergency: { active: false, timestamp: 0 }
    },

    OFFLINE: {
        mq2: 0,
        mq135: 0,
        mq135_raw: 0,
        mq135_digital: 0,
        temperature: 0,
        humidity: 0,
        flame: false,
        motion: false,
        hazardScore: 0,
        riskLevel: 'SAFE' as const,
        status: { online: false, lastHeartbeat: Date.now() - 300000 }, // 5 min ago
        emergency: { active: false, timestamp: 0 }
    }
};

/**
 * Push test payload to Firebase
 */
export async function pushTestPayload(scenario: keyof typeof TEST_SCENARIOS): Promise<void> {
    const payload = TEST_SCENARIOS[scenario];
    const iotRef = ref(database, 'arohan/iot');

    console.log(`[SmokeTest] Pushing ${scenario} scenario:`, payload);

    try {
        await set(iotRef, payload);
        console.log(`[SmokeTest] ✓ ${scenario} payload sent successfully`);
    } catch (error) {
        console.error(`[SmokeTest] ✗ Failed to send ${scenario} payload:`, error);
        throw error;
    }
}

/**
 * Run automated smoke test sequence
 */
export async function runSmokeTestSequence(delayMs: number = 5000): Promise<void> {
    console.log('[SmokeTest] Starting automated test sequence...');

    const scenarios: Array<keyof typeof TEST_SCENARIOS> = ['SAFE', 'WARNING', 'DANGER', 'SAFE'];

    for (const scenario of scenarios) {
        await pushTestPayload(scenario);
        console.log(`[SmokeTest] Waiting ${delayMs}ms before next scenario...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.log('[SmokeTest] ✓ Test sequence complete');
}

/**
 * Verify data normalization
 */
export function verifyNormalization(data: any): boolean {
    const checks = [
        { name: 'mq2 is number', pass: typeof data.mq2 === 'number' },
        { name: 'mq135 is number', pass: typeof data.mq135 === 'number' },
        { name: 'mq135_raw is 0 or 1', pass: data.mq135_raw === 0 || data.mq135_raw === 1 },
        { name: 'temperature is number', pass: typeof data.temperature === 'number' },
        { name: 'humidity is number', pass: typeof data.humidity === 'number' },
        { name: 'flame is boolean', pass: typeof data.flame === 'boolean' },
        { name: 'motion is boolean', pass: typeof data.motion === 'boolean' },
        { name: 'hazardScore in range', pass: data.hazardScore >= 0 && data.hazardScore <= 100 },
        { name: 'riskLevel valid', pass: ['SAFE', 'WARNING', 'DANGER'].includes(data.riskLevel) },
        { name: 'status.online is boolean', pass: typeof data.status?.online === 'boolean' },
        { name: 'status.lastHeartbeat is number', pass: typeof data.status?.lastHeartbeat === 'number' }
    ];

    console.log('[SmokeTest] Data Normalization Checks:');
    checks.forEach(check => {
        console.log(`  ${check.pass ? '✓' : '✗'} ${check.name}`);
    });

    const allPassed = checks.every(check => check.pass);
    console.log(`[SmokeTest] Overall: ${allPassed ? '✓ PASS' : '✗ FAIL'}`);

    return allPassed;
}

/**
 * Check UI color mapping
 */
export function checkColorMapping(hazardScore: number, expectedColor: string): void {
    const riskLevel = hazardScore < 30 ? 'SAFE' : hazardScore < 60 ? 'WARNING' : 'DANGER';
    const colorMap = {
        SAFE: '#16a34a',    // green
        WARNING: '#f59e0b', // orange
        DANGER: '#dc2626'   // red
    };

    const actualColor = colorMap[riskLevel];
    const matches = actualColor === expectedColor;

    console.log(`[SmokeTest] Color Mapping Check:`);
    console.log(`  Hazard Score: ${hazardScore}`);
    console.log(`  Risk Level: ${riskLevel}`);
    console.log(`  Expected Color: ${expectedColor}`);
    console.log(`  Actual Color: ${actualColor}`);
    console.log(`  ${matches ? '✓ PASS' : '✗ FAIL'}`);
}

// Export for browser console usage (DEV ONLY)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as any).arohanSmokeTest = {
        pushTestPayload,
        runSmokeTestSequence,
        verifyNormalization,
        checkColorMapping,
        TEST_SCENARIOS
    };

    console.log('[SmokeTest] 🧪 DEV MODE: Utilities loaded. Access via window.arohanSmokeTest');
    console.log('Example: window.arohanSmokeTest.pushTestPayload("DANGER")');
}
