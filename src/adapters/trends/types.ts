import { TrendSnapshot } from '../../types/trend';

export interface TrendsSource {
  id: string;
  fetch(region: 'SE' | 'US' | 'GLOBAL'): Promise<TrendSnapshot>;
}
