/**
 * フェーズ→ステータスマッピング
 */

export type Phase = 'requirements' | 'design' | 'tasks' | 'implementation' | 'completed';
export type ProjectStatus = 'Todo' | 'In Progress' | 'Done';

/**
 * 仕様書のフェーズを GitHub Project のステータスにマッピング
 */
export function mapPhaseToStatus(phase: Phase): ProjectStatus {
  const mapping: Record<Phase, ProjectStatus> = {
    requirements: 'Todo',
    design: 'In Progress',
    tasks: 'In Progress',
    implementation: 'In Progress',
    completed: 'Done',
  };

  return mapping[phase];
}
