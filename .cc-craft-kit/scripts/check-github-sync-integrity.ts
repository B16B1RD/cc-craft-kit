#!/usr/bin/env node
/**
 * GitHub 同期整合性チェックスクリプト
 *
 * specs.github_issue_id と github_sync.github_number の整合性を確認します。
 *
 * 検出パターン:
 * 1. specs に github_issue_id があるが、github_sync にレコードがない
 * 2. specs と github_sync で Issue 番号が一致しない
 * 3. github_sync にレコードがあるが、specs に github_issue_id がない
 */

import { getDatabase, closeDatabase } from '../core/database/connection.js';

async function checkIntegrity() {
  const db = getDatabase();

  // パターン1: specs に github_issue_id があるが、github_sync にレコードがない
  const missingInSync = await db
    .selectFrom('specs')
    .leftJoin('github_sync', (join) =>
      join
        .onRef('github_sync.entity_id', '=', 'specs.id')
        .on('github_sync.entity_type', '=', 'spec')
    )
    .select([
      'specs.id',
      'specs.name',
      'specs.github_issue_id',
    ])
    .where('specs.github_issue_id', 'is not', null)
    .where('github_sync.github_number', 'is', null)
    .execute();

  // パターン2: specs と github_sync で Issue 番号が一致しない
  const mismatchedNumbers = await db
    .selectFrom('specs')
    .innerJoin('github_sync', (join) =>
      join
        .onRef('github_sync.entity_id', '=', 'specs.id')
        .on('github_sync.entity_type', '=', 'spec')
    )
    .select([
      'specs.id',
      'specs.name',
      'specs.github_issue_id',
      'github_sync.github_number',
    ])
    .where('specs.github_issue_id', 'is not', null)
    .where('github_sync.github_number', 'is not', null)
    .where((eb) =>
      eb('specs.github_issue_id', '!=', eb.ref('github_sync.github_number'))
    )
    .execute();

  // パターン3: github_sync にレコードがあるが、specs に github_issue_id がない
  const missingInSpecs = await db
    .selectFrom('specs')
    .innerJoin('github_sync', (join) =>
      join
        .onRef('github_sync.entity_id', '=', 'specs.id')
        .on('github_sync.entity_type', '=', 'spec')
    )
    .select([
      'specs.id',
      'specs.name',
      'specs.github_issue_id',
      'github_sync.github_number',
    ])
    .where('specs.github_issue_id', 'is', null)
    .where('github_sync.github_number', 'is not', null)
    .execute();

  const totalInconsistencies =
    missingInSync.length + mismatchedNumbers.length + missingInSpecs.length;

  if (totalInconsistencies > 0) {
    console.error(`\n❌ Found ${totalInconsistencies} inconsistencies:\n`);

    if (missingInSync.length > 0) {
      console.error('📋 Pattern 1: specs has github_issue_id but github_sync is missing:\n');
      missingInSync.forEach((row) => {
        console.error(
          `  • Spec ${row.id.substring(0, 8)} (${row.name}): specs.github_issue_id=${row.github_issue_id}, github_sync=MISSING`
        );
      });
      console.error('');
    }

    if (mismatchedNumbers.length > 0) {
      console.error('⚠️  Pattern 2: Issue numbers do not match:\n');
      mismatchedNumbers.forEach((row) => {
        console.error(
          `  • Spec ${row.id.substring(0, 8)} (${row.name}): specs.github_issue_id=${row.github_issue_id}, github_sync.github_number=${row.github_number}`
        );
      });
      console.error('');
    }

    if (missingInSpecs.length > 0) {
      console.error('🔍 Pattern 3: github_sync has record but specs.github_issue_id is NULL:\n');
      missingInSpecs.forEach((row) => {
        console.error(
          `  • Spec ${row.id.substring(0, 8)} (${row.name}): specs.github_issue_id=NULL, github_sync.github_number=${row.github_number}`
        );
      });
      console.error('');
    }

    console.error('💡 Please fix these inconsistencies before running the migration.\n');
    process.exit(1);
  }

  console.log('✅ No inconsistencies found - database is ready for migration\n');
}

checkIntegrity()
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  })
  .finally(() => closeDatabase());
