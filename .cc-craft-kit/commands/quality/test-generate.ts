/**
 * テスト生成コマンド
 *
 * このコマンドは test-generator サブエージェントの実行をトリガーします。
 * 実際のテスト生成処理は Claude Code がスラッシュコマンドの指示に従って実行します。
 */

export async function testGenerate(filePattern: string): Promise<void> {
  if (!filePattern) {
    console.error('Error: File pattern is required');
    console.error('Usage: /cft:test-generate "<file-pattern>"');
    process.exit(1);
  }

  console.log('🧪 Test Generation Started');
  console.log('');
  console.log(`Target: ${filePattern}`);
  console.log('');
  console.log('Running test-generator subagent...');
  console.log('');
  console.log('The test-generator will create:');
  console.log('  • Normal test cases');
  console.log('  • Edge cases (boundary values, null, undefined)');
  console.log('  • Error cases (exception handling)');
  console.log('  • Mocks and stubs');
  console.log('');
  console.log('✓ Command executed successfully');
  console.log('');
  console.log('Claude Code will now proceed with test generation.');
}

// CLI エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePattern = process.argv[2];
  testGenerate(filePattern).catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
