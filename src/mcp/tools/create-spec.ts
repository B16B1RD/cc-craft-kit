import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../../core/database/connection.js';
import { randomUUID } from 'crypto';

/**
 * 仕様書作成ツール
 */
const CreateSpecSchema = z.object({
  name: z.string().describe('仕様書名'),
  description: z.string().optional().describe('仕様書の説明'),
});

type CreateSpecParams = z.infer<typeof CreateSpecSchema>;

interface CreateSpecResult {
  success: boolean;
  message: string;
  spec: {
    id: string;
    name: string;
    description: string | null;
    phase: string;
    createdAt: string;
  };
}

export const createSpecTool: Tool & {
  handler: (params: CreateSpecParams) => Promise<CreateSpecResult>;
} = {
  name: 'takumi:create_spec',
  description: '新しい仕様書を作成します。Requirements フェーズから開始されます。',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '仕様書名',
      },
      description: {
        type: 'string',
        description: '仕様書の説明',
      },
    },
    required: ['name'],
  },

  async handler(params: CreateSpecParams): Promise<CreateSpecResult> {
    const validated = CreateSpecSchema.parse(params);
    const db = getDatabase();

    const spec = {
      id: randomUUID(),
      name: validated.name,
      description: validated.description || null,
      phase: 'requirements' as const,
      github_issue_id: null,
      github_project_id: null,
      github_milestone_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insertInto('specs').values(spec).execute();

    return {
      success: true,
      message: `仕様書 "${validated.name}" を作成しました`,
      spec: {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        phase: spec.phase,
        createdAt: spec.created_at,
      },
    };
  },
};
