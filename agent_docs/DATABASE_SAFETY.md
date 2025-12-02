# データベース接続の安全性

データベース破損を防ぐための厳格なルール。

## `getDatabase()` の使用

- データベース接続は **必ず** `getDatabase()` を使用すること
- `config` パラメータは指定しないこと（デフォルトパスを使用）
- 異なるパスが必要な場合は、必ず `closeDatabase()` を先に呼び出すこと

## 禁止事項

- `createDatabase()` を直接呼び出さないこと
- `getDatabase({ databasePath: ... })` のように明示的なパス指定をしないこと
- 複数のデータベースインスタンスを同時に作成しないこと

## トランザクション管理

```typescript
import { getDatabase } from '../../core/database/connection.js';

const db = getDatabase();

await db.transaction().execute(async (trx) => {
  // トランザクション内の処理
  await trx.insertInto('table').values({ ... }).execute();
});
```

## 参照

- `src/core/database/connection.ts` - 接続管理
- `src/core/database/schema.ts` - スキーマ定義
