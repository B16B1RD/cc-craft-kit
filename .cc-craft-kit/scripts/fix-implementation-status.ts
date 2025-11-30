#!/usr/bin/env npx tsx

import { execSync } from 'child_process';

/**
 * Issue #111とIssue #137のステータスを "In Progress" に更新
 */
async function fixImplementationStatus() {
  console.log('🔍 Updating implementation issues to "In Progress"...\n');

  // Project情報とアイテムを取得
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
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                }
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

  // Issue #111とIssue #137のItem IDを検索
  const targetIssues = [111, 137];
  const items = project.items.nodes;

  let successCount = 0;
  let failureCount = 0;

  for (const issueNumber of targetIssues) {
    const item = items.find(
      (i: { content: { number: number } }) => i.content.number === issueNumber
    );

    if (!item) {
      console.log(`⚠️  Issue #${issueNumber} not found in project`);
      continue;
    }

    const itemId = item.id;

    console.log(`📝 Updating Issue #${issueNumber}`);
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
fixImplementationStatus()
  .then(() => {
    console.log('\n✅ Status update completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  });
