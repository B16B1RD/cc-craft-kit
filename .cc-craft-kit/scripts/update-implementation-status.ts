#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { getDatabase } from '../core/database/connection.js';

/**
 * implementation フェーズのIssueをGitHub Projectsで "In Progress" に更新
 */
async function updateImplementationStatus() {
  const db = getDatabase();

  console.log('🔍 Finding implementation specs...\n');

  // implementation フェーズの仕様書を取得
  const implementationSpecs = await db
    .selectFrom('specs')
    .selectAll()
    .where('phase', '=', 'implementation')
    .where('github_issue_id', 'is not', null)
    .where('github_project_item_id', 'is not', null)
    .execute();

  console.log(`Found ${implementationSpecs.length} implementation specs with Project items\n`);

  // まずProject IDとStatus fieldを取得
  const projectQuery = `
    query {
      user(login: "B16B1RD") {
        projectV2(number: 1) {
          id
          field(name: "Status") {
            ... on ProjectV2SingleSelectField {
              id
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  `;

  const projectResult = execSync(`gh api graphql -f query='${projectQuery}'`, {
    encoding: 'utf-8',
  });

  const projectData = JSON.parse(projectResult);
  const project = projectData?.data?.user?.projectV2;

  if (!project) {
    console.error('❌ Project not found');
    return;
  }

  const projectId = project.id;
  const statusField = project.field;
  const statusFieldId = statusField.id;

  // "In Progress" オプションのIDを取得
  const inProgressOption = statusField.options.find(
    (opt: { name: string; id: string }) => opt.name === 'In Progress'
  );

  if (!inProgressOption) {
    console.error('❌ "In Progress" status option not found');
    return;
  }

  const inProgressOptionId = inProgressOption.id;

  console.log(`Project ID: ${projectId}`);
  console.log(`Status Field ID: ${statusFieldId}`);
  console.log(`In Progress Option ID: ${inProgressOptionId}\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const spec of implementationSpecs) {
    const issueId = spec.github_issue_id;
    const itemId = spec.github_project_item_id;

    console.log(`📝 Processing: ${spec.name.substring(0, 60)}...`);
    console.log(`   Issue #${issueId}`);
    console.log(`   Item ID: ${itemId}`);

    try {
      // ステータスを "In Progress" に更新
      const updateMutation = `
        mutation {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: "${projectId}"
              itemId: "${itemId}"
              fieldId: "${statusFieldId}"
              value: {
                singleSelectOptionId: "${inProgressOptionId}"
              }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `;

      execSync(`gh api graphql -f query='${updateMutation}'`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      console.log(`   ✅ Updated to "In Progress"`);
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Failed to update: ${errorMessage}`);
      failureCount++;
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Failed to update: ${failureCount}`);
  console.log('='.repeat(60));
}

// スクリプト実行
updateImplementationStatus()
  .then(() => {
    console.log('\n✅ Status update completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  });
