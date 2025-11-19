import { getDatabase } from '../.cc-craft-kit/core/database/connection.js';
import { execSync } from 'child_process';

(async () => {
  const db = getDatabase();

  console.log('=== Checking GitHub Projects Status ===\n');

  // implementation フェーズの仕様書を取得
  const implementationSpecs = await db
    .selectFrom('specs')
    .selectAll()
    .where('phase', '=', 'implementation')
    .where('github_issue_id', 'is not', null)
    .execute();

  console.log(`Found ${implementationSpecs.length} implementation specs\n`);

  for (const spec of implementationSpecs) {
    const issueId = spec.github_issue_id;

    if (!issueId) {
      continue;
    }

    console.log(`Spec: ${spec.name}`);
    console.log(`  Issue #${issueId}`);
    console.log(`  Phase: ${spec.phase}`);

    // GitHub Issue の Project item を確認
    if (spec.github_project_item_id) {
      console.log(`  Project Item ID: ${spec.github_project_item_id}`);

      // GraphQL API でステータスを取得
      const query = `
        query {
          node(id: "${spec.github_project_item_id}") {
            ... on ProjectV2Item {
              id
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
            }
          }
        }
      `;

      try {
        const result = execSync(`gh api graphql -f query='${query}'`, {
          encoding: 'utf-8',
        });

        const data = JSON.parse(result);
        const status = data?.data?.node?.fieldValueByName?.name;

        console.log(`  Current Project Status: ${status || '(none)'}`);

        if (status === 'Todo') {
          console.log(`  ⚠️  MISMATCH: Should be "In Progress" for implementation phase`);
        } else if (status === 'In Progress') {
          console.log(`  ✅ Correct status`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to get project status:`, error);
      }
    } else {
      console.log(`  ⚠️  No Project Item ID (not added to project)`);
    }

    console.log('');
  }
})();
