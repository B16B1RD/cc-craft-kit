import { describe, it, expect } from 'vitest';
import { mapPhaseToStatus, type Phase } from '../../../src/integrations/github/phase-status-mapper.js';

describe('phase-status-mapper', () => {
  describe('mapPhaseToStatus', () => {
    it('requirements フェーズは Todo にマッピングされる', () => {
      expect(mapPhaseToStatus('requirements')).toBe('Todo');
    });

    it('design フェーズは In Progress にマッピングされる', () => {
      expect(mapPhaseToStatus('design')).toBe('In Progress');
    });

    it('tasks フェーズは In Progress にマッピングされる', () => {
      expect(mapPhaseToStatus('tasks')).toBe('In Progress');
    });

    it('implementation フェーズは In Progress にマッピングされる', () => {
      expect(mapPhaseToStatus('implementation')).toBe('In Progress');
    });

    it('completed フェーズは Done にマッピングされる', () => {
      expect(mapPhaseToStatus('completed')).toBe('Done');
    });

    it('すべてのフェーズがマッピングされている', () => {
      const phases: Phase[] = ['requirements', 'design', 'tasks', 'implementation', 'completed'];

      for (const phase of phases) {
        const status = mapPhaseToStatus(phase);
        expect(status).toBeDefined();
        expect(['Todo', 'In Progress', 'Done']).toContain(status);
      }
    });
  });
});
