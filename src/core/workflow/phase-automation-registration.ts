import { EventBus } from './event-bus.js';
import { PhaseAutomationHandler } from './phase-automation.js';

/**
 * フェーズ自動処理のイベントハンドラーを登録
 */
export function registerPhaseAutomationHandlers(bus: EventBus): void {
  // PhaseAutomationHandler を作成
  const handler = new PhaseAutomationHandler();

  // spec.phase_changed イベントハンドラーを登録
  bus.on('spec.phase_changed', async (event) => {
    // イベントデータの型を検証
    if (
      typeof event.data === 'object' &&
      event.data !== null &&
      'specId' in event.data &&
      'oldPhase' in event.data &&
      'newPhase' in event.data
    ) {
      await handler.handlePhaseChange(event as import('./event-bus.js').PhaseChangedEvent);
    }
  });
}
