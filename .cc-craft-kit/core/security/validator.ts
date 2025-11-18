/**
 * セキュリティバリデーター
 * 入力検証とサニタイゼーション
 */

/**
 * 入力検証結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: unknown;
}

/**
 * セキュリティバリデーター
 */
export class SecurityValidator {
  /**
   * SQL injection防止: 文字列をサニタイズ
   */
  sanitizeSQL(input: string): string {
    // Kyselyはパラメータ化クエリを使用するため、基本的に安全
    // ここでは念のため危険な文字をエスケープ
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }

  /**
   * XSS防止: HTMLをサニタイズ
   */
  sanitizeHTML(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * コマンドインジェクション防止
   */
  sanitizeShellCommand(input: string): string {
    // シェルコマンドで危険な文字を削除
    return input.replace(/[;&|`$()]/g, '');
  }

  /**
   * パストラバーサル防止
   */
  sanitizePath(input: string): ValidationResult {
    const errors: string[] = [];

    // ../ や ..\ を含む場合はエラー
    if (input.includes('../') || input.includes('..\\')) {
      errors.push('Path traversal detected');
    }

    // 絶対パスの場合はエラー
    if (input.startsWith('/') || /^[A-Za-z]:\\/.test(input)) {
      errors.push('Absolute paths are not allowed');
    }

    // null byte攻撃防止
    if (input.includes('\0')) {
      errors.push('Null byte detected');
    }

    const sanitized = input
      .replace(/\.\.\//g, '')
      .replace(/\.\.\\/g, '')
      .replace(/\0/g, '');

    return {
      valid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * Email検証
   */
  validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    if (email.length > 254) {
      errors.push('Email too long (max 254 characters)');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: email.toLowerCase().trim(),
    };
  }

  /**
   * URL検証
   */
  validateURL(url: string): ValidationResult {
    const errors: string[] = [];

    try {
      const parsed = new URL(url);

      // httpsのみ許可する場合
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        errors.push('Only HTTP(S) protocols are allowed');
      }

      // ローカルアドレスをブロック
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.') ||
        parsed.hostname.startsWith('172.16.')
      ) {
        errors.push('Local/private IP addresses are not allowed');
      }
    } catch {
      errors.push('Invalid URL format');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: url.trim(),
    };
  }

  /**
   * ファイル名検証
   */
  validateFileName(fileName: string): ValidationResult {
    const errors: string[] = [];

    // 危険な文字をチェック
    // eslint-disable-next-line no-control-regex
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(fileName)) {
      errors.push('File name contains dangerous characters');
    }

    // パストラバーサル
    if (fileName.includes('../') || fileName.includes('..\\')) {
      errors.push('Path traversal in file name');
    }

    // 長さチェック
    if (fileName.length > 255) {
      errors.push('File name too long (max 255 characters)');
    }

    // 予約語チェック (Windows)
    const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (reserved.test(fileName)) {
      errors.push('File name is a reserved word');
    }

    const sanitized = fileName
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"|?*\x00-\x1f]/g, '')
      .replace(/\.\./g, '')
      .trim();

    return {
      valid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * APIトークン検証
   */
  validateAPIToken(token: string): ValidationResult {
    const errors: string[] = [];

    if (!token || token.trim().length === 0) {
      errors.push('Token is empty');
    }

    if (token.length < 32) {
      errors.push('Token too short (minimum 32 characters)');
    }

    if (token.length > 512) {
      errors.push('Token too long (maximum 512 characters)');
    }

    // 許可された文字のみ (英数字、ハイフン、アンダースコア、ドット)
    const validChars = /^[a-zA-Z0-9\-_.]+$/;
    if (!validChars.test(token)) {
      errors.push('Token contains invalid characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: token.trim(),
    };
  }

  /**
   * JSONペイロード検証
   */
  validateJSON(jsonString: string, maxSize: number = 10 * 1024 * 1024): ValidationResult {
    const errors: string[] = [];

    // サイズチェック (デフォルト10MB)
    if (jsonString.length > maxSize) {
      errors.push(`JSON payload too large (max ${maxSize} bytes)`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      errors.push('Invalid JSON format');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: parsed,
    };
  }

  /**
   * 環境変数名検証
   */
  validateEnvVarName(name: string): ValidationResult {
    const errors: string[] = [];

    // 英大文字、数字、アンダースコアのみ
    const validPattern = /^[A-Z][A-Z0-9_]*$/;
    if (!validPattern.test(name)) {
      errors.push('Invalid environment variable name (use UPPER_CASE)');
    }

    if (name.length > 128) {
      errors.push('Environment variable name too long (max 128 characters)');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: name.toUpperCase(),
    };
  }

  /**
   * レート制限チェック用のキー生成
   */
  generateRateLimitKey(identifier: string, action: string): string {
    return `ratelimit:${this.sanitizeHTML(identifier)}:${action}`;
  }

  /**
   * シークレット検出
   */
  detectSecrets(text: string): { detected: boolean; matches: string[] } {
    const patterns = [
      /api[_-]?key[_-]?=\s*['"]?([a-zA-Z0-9]{32,})['"]?/gi,
      /secret[_-]?key[_-]?=\s*['"]?([a-zA-Z0-9]{32,})['"]?/gi,
      /password[_-]?=\s*['"]?([^\s'"]{8,})['"]?/gi,
      /token[_-]?=\s*['"]?([a-zA-Z0-9\-_.]{32,})['"]?/gi,
      /ghp_[a-zA-Z0-9]{36}/g, // GitHub Personal Access Token
      /gho_[a-zA-Z0-9]{36}/g, // GitHub OAuth Token
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API Key
    ];

    const matches: string[] = [];

    for (const pattern of patterns) {
      const found = text.match(pattern);
      if (found) {
        matches.push(...found);
      }
    }

    return {
      detected: matches.length > 0,
      matches,
    };
  }
}

/**
 * グローバルバリデーター
 */
const globalValidator = new SecurityValidator();

/**
 * グローバルバリデーターを取得
 */
export function getSecurityValidator(): SecurityValidator {
  return globalValidator;
}
