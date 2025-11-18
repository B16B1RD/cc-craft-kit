/**
 * 共通型定義
 * プロジェクト全体で使用する汎用的な型定義
 */

/**
 * JSON安全な値の型
 * JSON.stringify/parseで安全に扱える値
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * 不明なプロパティを持つオブジェクト型
 * Record<string, any> の代替として使用
 */
export type UnknownRecord = Record<string, unknown>;

/**
 * メタデータ型
 * JSON安全なメタデータを表現
 */
export type Metadata = Record<string, JSONValue>;

/**
 * エラーメタデータ型
 * エラー情報に付加するメタデータ
 */
export interface ErrorMetadata {
  originalName?: string;
  originalError?: string;
  stack?: string;
  resource?: string;
  id?: string;
  service?: string;
  code?: string;
  category?: string;
  statusCode?: number;
  [key: string]: JSONValue | undefined;
}

/**
 * エラーコンテキスト型
 * エラー発生時のコンテキスト情報
 */
export interface ErrorContext {
  taskId?: string;
  specId?: string;
  userId?: string;
  action?: string;
  timestamp?: string;
  [key: string]: JSONValue | undefined;
}

/**
 * JSON Schema型定義
 */
export type JSONSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface JSONSchemaProperty {
  type: JSONSchemaType | JSONSchemaType[];
  description?: string;
  enum?: JSONValue[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: JSONValue;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

export interface JSONSchema {
  $schema?: string;
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}
