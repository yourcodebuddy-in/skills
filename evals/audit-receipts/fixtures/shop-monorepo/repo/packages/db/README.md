# @kettle/db

SQLite through `node:sqlite` ([ADR 0003](../../docs/adr/0003-sqlite-through-node-sqlite.md)).

```js
import { createStore, openDatabase } from "../../packages/db/src/index.js";

const store = createStore(openDatabase("data/shop.db")); // or ":memory:" in tests
store.transaction(() => {
  store.products.takeStock(productId, 2);
});
```

`openDatabase` applies any migrations that haven't run. Repositories return plain objects with
camelCase fields and never expose a password hash, except `users.credentialsFor`, which exists for
signing in.
