import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../../core/database/connection.js';

/**
 * 仕様書一覧ツール
 */
const ListSpecsSchema = z.object({
  phase: z.enum(['requirements', 'design', 'tasks', 'implementation', 'completed']).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

type ListSpecsParams = z.infer<typeof ListSpecsSchema>;

export const listSpecsTool: Tool & { handler: (params: ListSpecsParams) => Promise<any> } = {
  name: 'takumi:list_specs',
  description: '仕様書の一覧を取得します。フェーズでフィルタリング可能です。',
  inputSchema: {
    type: 'object',
    properties: {
      phase: {
        type: 'string',
        enum: ['requirements', 'design', 'tasks', 'implementation', 'completed'],
        description: 'フィルタリングするフェーズ',
      },
      limit: {
        type: 'number',
        description: '取得件数 (デフォルト: 20)',
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'オフセット (デフォルト: 0)',
        minimum: 0,
      },
    },
  },

  async handler(params: ListSpecsParams) {
    const validated = ListSpecsSchema.parse(params);
    const db = getDatabase();

    let query = db
      .selectFrom('specs')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(validated.limit)
      .offset(validated.offset);

    if (validated.phase) {
      query = query.where('phase', '=', validated.phase);
    }

    const specs = await query.execute();

    // 総数取得
    let countQuery = db.selectFrom('specs').select((eb) => eb.fn.countAll().as('count'));

    if (validated.phase) {
      countQuery = countQuery.where('phase', '=', validated.phase);
    }

    const { count } = (await countQuery.executeTakeFirst()) as { count: number };

    return {
      success: true,
      specs: specs.map((spec) => ({
        id: spec.id,
        name: spec.name,
        description: spec.description,
        phase: spec.phase,
        githubIssueId: spec.github_issue_id,
        githubProjectId: spec.github_project_id,
        createdAt: spec.created_at,
        updatedAt: spec.updated_at,
      })),
      pagination: {
        total: count,
        limit: validated.limit,
        offset: validated.offset,
        hasMore: validated.offset + validated.limit < count,
      },
    };
  },
};
