import { execSync } from 'child_process';

(async () => {
  console.log('=== Listing GitHub Projects Items ===\n');

  // まずProject IDを取得
  const projectQuery = `
    query {
      user(login: "B16B1RD") {
        projectV2(number: 1) {
          id
          title
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                }
              }
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = execSync(`gh api graphql -f query='${projectQuery}'`, {
      encoding: 'utf-8',
    });

    const data = JSON.parse(result);
    const project = data?.data?.user?.projectV2;

    if (!project) {
      console.log('❌ Project not found');
      return;
    }

    console.log(`Project: ${project.title}`);
    console.log(`Project ID: ${project.id}\n`);

    const items = project.items.nodes;
    console.log(`Total items: ${items.length}\n`);

    // Todo/In Progress のものだけ表示
    const activeItems = items.filter(
      (item: any) =>
        item.fieldValueByName?.name === 'Todo' ||
        item.fieldValueByName?.name === 'In Progress'
    );

    console.log(`Active items (Todo/In Progress): ${activeItems.length}\n`);

    activeItems.forEach((item: any) => {
      const issue = item.content;
      const status = item.fieldValueByName?.name || '(none)';

      console.log(`Issue #${issue.number}: ${issue.title}`);
      console.log(`  Status: ${status}`);
      console.log(`  Item ID: ${item.id}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to list project items:', error);
  }
})();
