/**
 * プレースホルダー検出器
 *
 * 仕様書ファイルからプレースホルダーを検出し、
 * 自動補完が必要な箇所を特定する
 */

/**
 * プレースホルダー検出結果
 */
export interface PlaceholderDetectionResult {
  hasPlaceholders: boolean;
  placeholders: {
    section: string;
    placeholder: string;
    lineNumber: number;
  }[];
}

/**
 * 仕様書のフェーズ
 */
export type Phase =
  | 'requirements'
  | 'design'
  | 'tasks'
  | 'implementation'
  | 'testing'
  | 'completed';

/**
 * プレースホルダーパターンの定義
 *
 * 仕様書テンプレート内で使用される典型的なプレースホルダーを検出
 */
const PLACEHOLDER_PATTERNS = [
  // 一般的なプレースホルダー
  /\(背景を記述してください\)/gi,
  /\(目的を記述してください\)/gi,
  /\(必須要件\d*\)/gi,
  /\(機能要件\d*\)/gi,
  /\(非機能要件\d*\)/gi,
  /\(制約条件\d*\)/gi,
  /\(依存関係\d*\)/gi,
  /\(セキュリティ考慮事項\d*\)/gi,
  /\(テスト戦略\d*\)/gi,

  // アーキテクチャ設計関連
  /\(アーキテクチャ設計を記述してください\)/gi,
  /\(API の仕様を記述してください\)/gi,
  /\(データモデルを記述してください\)/gi,

  // 一般的なTODO/FIXME
  /TODO:/gi,
  /FIXME:/gi,
  /XXX:/gi,

  // プレースホルダーテキストのパターン（括弧で囲まれている場合のみ）
  /\([^)]*記述してください[^)]*\)/gi,
  /\([^)]*書いてください[^)]*\)/gi,
  /\([^)]*入力してください[^)]*\)/gi,
  /\([^)]*追加してください[^)]*\)/gi,
];

/**
 * 各フェーズで必須となるセクション定義
 */
const REQUIRED_SECTIONS: Record<Phase, string[]> = {
  requirements: [
    '## 1. 背景と目的',
    '## 2. 対象ユーザー',
    '## 3. 受け入れ基準',
    '## 4. 制約条件',
    '## 5. 依存関係',
  ],
  design: [
    '## 1. 背景と目的',
    '## 2. 対象ユーザー',
    '## 3. 受け入れ基準',
    '## 4. 制約条件',
    '## 5. 依存関係',
    '## 7. 設計詳細',
  ],
  tasks: [
    '## 1. 背景と目的',
    '## 2. 対象ユーザー',
    '## 3. 受け入れ基準',
    '## 4. 制約条件',
    '## 5. 依存関係',
    '## 7. 設計詳細',
    '## 8. 実装タスクリスト',
  ],
  implementation: [
    '## 1. 背景と目的',
    '## 2. 対象ユーザー',
    '## 3. 受け入れ基準',
    '## 4. 制約条件',
    '## 5. 依存関係',
    '## 7. 設計詳細',
    '## 8. 実装タスクリスト',
  ],
  testing: [
    '## 1. 背景と目的',
    '## 2. 対象ユーザー',
    '## 3. 受け入れ基準',
    '## 4. 制約条件',
    '## 5. 依存関係',
    '## 7. 設計詳細',
    '## 8. 実装タスクリスト',
  ],
  completed: [
    '## 1. 背景と目的',
    '## 2. 対象ユーザー',
    '## 3. 受け入れ基準',
    '## 4. 制約条件',
    '## 5. 依存関係',
    '## 7. 設計詳細',
    '## 8. 実装タスクリスト',
  ],
};

/**
 * 仕様書ファイルからプレースホルダーを検出
 *
 * @param content 仕様書ファイルの内容
 * @param phase 現在のフェーズ
 * @returns プレースホルダー検出結果
 */
export function detectPlaceholders(content: string, phase?: Phase): PlaceholderDetectionResult {
  const placeholders: PlaceholderDetectionResult['placeholders'] = [];
  const lines = content.split('\n');

  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // セクションヘッダーを更新
    if (line.startsWith('##')) {
      currentSection = line.trim();
    }

    // 各プレースホルダーパターンをチェック
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        placeholders.push({
          section: currentSection || 'Unknown',
          placeholder: match[0],
          lineNumber,
        });
      }
    }
  }

  // フェーズが指定されている場合、必須セクションの存在もチェック
  if (phase) {
    const requiredSections = REQUIRED_SECTIONS[phase] || [];
    for (const requiredSection of requiredSections) {
      const sectionExists = lines.some((line) => line.trim().startsWith(requiredSection));
      if (!sectionExists) {
        placeholders.push({
          section: 'Missing Section',
          placeholder: `${requiredSection} が存在しません`,
          lineNumber: 0,
        });
      }
    }
  }

  return {
    hasPlaceholders: placeholders.length > 0,
    placeholders,
  };
}

/**
 * 特定のセクションがプレースホルダーを含むかチェック
 *
 * @param content 仕様書ファイルの内容
 * @param sectionName セクション名（例: "## 1. 背景と目的"）
 * @returns プレースホルダーが含まれている場合 true
 */
export function hasPlaceholderInSection(content: string, sectionName: string): boolean {
  const lines = content.split('\n');

  // セクションの開始位置を見つける
  const sectionStartIndex = lines.findIndex((line) => line.trim().startsWith(sectionName));
  if (sectionStartIndex === -1) {
    // セクションが存在しない場合は true を返す
    return true;
  }

  // セクションレベルを判定（## の数）
  const sectionLevel = sectionName.match(/^#+/)?.[0].length || 2;

  // セクションの終了位置を見つける（同じまたはより高いレベルのヘッダーまたはファイル末尾）
  let sectionEndIndex = lines.length;
  for (let i = sectionStartIndex + 1; i < lines.length; i++) {
    const headerMatch = lines[i].match(/^(#+)\s/);
    if (headerMatch && headerMatch[1].length <= sectionLevel) {
      sectionEndIndex = i;
      break;
    }
  }

  // セクション内のコンテンツをチェック（正規表現の状態をリセットするため、新しいインスタンスを使用）
  const sectionContent = lines.slice(sectionStartIndex, sectionEndIndex).join('\n');

  for (const pattern of PLACEHOLDER_PATTERNS) {
    // 正規表現の lastIndex をリセット
    pattern.lastIndex = 0;
    if (pattern.test(sectionContent)) {
      return true;
    }
  }

  // セクションが実質的に空かどうかをチェック（ヘッダー行とサブセクション見出しを除く）
  const contentLines = lines.slice(sectionStartIndex + 1, sectionEndIndex).filter((line) => {
    const trimmed = line.trim();
    // 空行、区切り線、サブセクション見出しを除外
    return trimmed !== '' && trimmed !== '---' && !trimmed.startsWith('###');
  });

  if (contentLines.length === 0) {
    return true;
  }

  return false;
}

/**
 * Requirements フェーズで必須のセクションが十分に記述されているかチェック
 *
 * @param content 仕様書ファイルの内容
 * @returns 不足しているセクションのリスト
 */
export function checkRequirementsPhase(content: string): string[] {
  const missingSections: string[] = [];

  const sectionsToCheck = [
    '## 1. 背景と目的',
    '## 2. 対象ユーザー',
    '## 3. 受け入れ基準',
    '## 4. 制約条件',
    '## 5. 依存関係',
  ];

  for (const section of sectionsToCheck) {
    if (hasPlaceholderInSection(content, section)) {
      missingSections.push(section);
    }
  }

  return missingSections;
}

/**
 * Design フェーズで必須のセクション（設計詳細）が十分に記述されているかチェック
 *
 * @param content 仕様書ファイルの内容
 * @returns 不足しているサブセクションのリスト
 */
export function checkDesignPhase(content: string): string[] {
  const missingSections: string[] = [];
  const lines = content.split('\n');

  // まず設計詳細セクションが存在するかチェック
  const sectionIndex = lines.findIndex((line) => line.trim().startsWith('## 7. 設計詳細'));
  if (sectionIndex === -1) {
    missingSections.push('## 7. 設計詳細');
    return missingSections;
  }

  // 設計詳細のサブセクションをチェック
  const subSectionsToCheck = ['### 7.1. アーキテクチャ設計', '### 7.5. テスト戦略'];

  for (const subSection of subSectionsToCheck) {
    if (hasPlaceholderInSection(content, subSection)) {
      missingSections.push(subSection);
    }
  }

  return missingSections;
}
