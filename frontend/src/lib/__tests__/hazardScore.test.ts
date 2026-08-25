import { describe, it, expect } from 'vitest';
import { 
  computeHazardScore, 
  getRiskLevel, 
  normalize, 
  getSensorContribution,
  DEFAULT_SENSOR_RANGES 
} from '../hazardScore';