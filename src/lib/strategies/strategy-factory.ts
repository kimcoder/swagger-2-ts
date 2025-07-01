import { AxiosStrategy } from './axios-strategy';
import type { BaseCodeGenerationStrategy, StrategyType } from './base-strategy';
import { FetchStrategy } from './fetch-strategy';
import { KyStrategy } from './ky-strategy';
import { SuperagentStrategy } from './superagent-strategy';

export class StrategyFactory {
  private static strategies = new Map<StrategyType, () => BaseCodeGenerationStrategy>([
    ['fetch', () => new FetchStrategy()],
    ['axios', () => new AxiosStrategy()],
    ['ky', () => new KyStrategy()],
    ['superagent', () => new SuperagentStrategy()],
  ] as [StrategyType, () => BaseCodeGenerationStrategy][]);

  static createStrategy(type: StrategyType): BaseCodeGenerationStrategy {
    const strategyFactory = this.strategies.get(type);
    if (!strategyFactory) {
      throw new Error(`Unknown strategy type: ${type}`);
    }
    return strategyFactory();
  }

  static getAvailableStrategies(): StrategyType[] {
    return Array.from(this.strategies.keys());
  }

  static registerStrategy(type: StrategyType, factory: () => BaseCodeGenerationStrategy): void {
    this.strategies.set(type, factory);
  }
}

export type { StrategyType };
