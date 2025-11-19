import { getDatabase } from '../.cc-craft-kit/core/database/connection.js';

(async () => {
  const db = getDatabase();

  const implementationSpecs = await db
    .selectFrom('specs')
    .selectAll()
    .where('phase', '=', 'implementation')
    .execute();

  console.log('=== Implementation Specs ===\n');

  implementationSpecs.forEach((spec) => {
    console.log(`Spec: ${spec.name}`);
    console.log(`  ID: ${spec.id}`);
    console.log(`  Issue: #${spec.github_issue_id || 'none'}`);
    console.log(`  Project ID: ${spec.github_project_id || 'none'}`);
    console.log(`  Project Item ID: ${spec.github_project_item_id || 'none'}`);
    console.log('');
  });
})();
