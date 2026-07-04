import { TrendSnapshot } from '../../types/trend.js';

export interface TrendsSource {
  id: string;
  fetch(region: 'SE' | 'US' | 'GLOBAL'): Promise<TrendSnapshot>;
}
