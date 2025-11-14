import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';

/**
 * テンプレート変数の型定義
 */
export interface RequirementsTemplateVars {
  specName: string;
  description: string;
  featureOverview: string;
  targetUsers: string[];
  acceptanceCriteria: string[];
  constraints: string[];
  dependencies: string[];
  createdAt: string;
  createdBy: string;
}

export interface DesignTemplateVars {
  specName: string;
  description: string;
  architecture: string;
  components: Array<{
    name: string;
    responsibility: string;
    interfaces: string[];
  }>;
  dataModel: string;
  apiEndpoints: Array<{
    method: string;
    path: string;
    description: string;
  }>;
  securityConsiderations: string[];
  performanceConsiderations: string[];
  createdAt: string;
}

export interface TasksTemplateVars {
  specName: string;
  description: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: number;
    estimatedHours: number;
    dependencies: string[];
  }>;
  totalEstimatedHours: number;
  createdAt: string;
}

/**
 * テンプレートエンジン
 */
export class TemplateEngine {
  private templatesDir: string;
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(templatesDir?: string) {
    // テンプレートディレクトリのデフォルトパス
    this.templatesDir =
      templatesDir || path.join(process.cwd(), 'templates');
    this.registerHelpers();
  }

  /**
   * Handlebarsヘルパー登録
   */
  private registerHelpers(): void {
    // 日付フォーマットヘルパー
    Handlebars.registerHelper('formatDate', (date: string) => {
      return new Date(date).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // インデックス+1ヘルパー (1から始まる番号)
    Handlebars.registerHelper('inc', (value: number) => {
      return value + 1;
    });

    // 配列の結合ヘルパー
    Handlebars.registerHelper('join', (array: string[], separator: string) => {
      return array.join(separator);
    });

    // 条件付きヘルパー
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // 優先度を文字列に変換
    Handlebars.registerHelper('priorityLabel', (priority: number) => {
      const labels = ['最高', '高', '中', '低', '最低'];
      return labels[priority - 1] || '中';
    });
  }

  /**
   * テンプレートをロードしてコンパイル
   */
  private async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    if (this.compiledTemplates.has(templateName)) {
      return this.compiledTemplates.get(templateName)!;
    }

    const templatePath = path.join(this.templatesDir, `${templateName}.md.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateContent);

    this.compiledTemplates.set(templateName, compiled);
    return compiled;
  }

  /**
   * Requirementsテンプレートレンダリング
   */
  async renderRequirements(vars: RequirementsTemplateVars): Promise<string> {
    const template = await this.loadTemplate('requirements');
    return template(vars);
  }

  /**
   * Designテンプレートレンダリング
   */
  async renderDesign(vars: DesignTemplateVars): Promise<string> {
    const template = await this.loadTemplate('design');
    return template(vars);
  }

  /**
   * Tasksテンプレートレンダリング
   */
  async renderTasks(vars: TasksTemplateVars): Promise<string> {
    const template = await this.loadTemplate('tasks');
    return template(vars);
  }

  /**
   * カスタムテンプレートレンダリング
   */
  async renderCustom(templateName: string, vars: any): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return template(vars);
  }

  /**
   * テンプレートキャッシュクリア
   */
  clearCache(): void {
    this.compiledTemplates.clear();
  }
}

/**
 * シングルトンインスタンス
 */
let engineInstance: TemplateEngine | null = null;

/**
 * グローバルテンプレートエンジン取得
 */
export function getTemplateEngine(templatesDir?: string): TemplateEngine {
  if (!engineInstance) {
    engineInstance = new TemplateEngine(templatesDir);
  }
  return engineInstance;
}
