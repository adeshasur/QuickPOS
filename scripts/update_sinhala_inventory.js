const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', 'quickpos.db');

const db = new sqlite3.Database(dbPath);

const products = [
  { id: 1, name: 'කීරි සම්බා සහල් පැකට් 5kg', expiry: '2027-02-28' },
  { id: 2, name: 'නැවුම් කිරි බෝතලය 1L', expiry: '2026-05-27' },
  { id: 3, name: 'මන්චි ක්‍රීම් ක්‍රැකර් 190g', expiry: '2026-11-15' },
  { id: 4, name: 'කොකා-කෝලා බෝතලය 1.5L', expiry: '2026-09-30' },
  { id: 5, name: 'රතු ලූනු 1kg', expiry: '2026-06-05' },
  { id: 6, name: 'ඇන්කර් කිරිපිටි පැකට් 400g', expiry: '2027-01-20' },
  { id: 7, name: 'ඇස්ට්‍රා මාගරින් ටබ් 250g', expiry: '2026-08-18' },
  { id: 8, name: 'ලයිෆ්බෝයි සබන් කැටය 100g', expiry: '2028-03-31' },
  { id: 9, name: 'සන්සිල්ක් ෂැම්පු බෝතලය 180ml', expiry: '2028-12-31' },
  { id: 10, name: 'සිලෝන් තේ කොළ 200g', expiry: '2027-04-30' }
];

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function main() {
  await run('BEGIN IMMEDIATE TRANSACTION');

  for (const product of products) {
    await run(
      'UPDATE products SET name = ?, expiry_date = ? WHERE id = ?',
      [product.name, product.expiry, product.id]
    );
    await run(
      'UPDATE sale_items SET product_name = ? WHERE product_id = ?',
      [product.name, product.id]
    );
  }

  await run('COMMIT');

  const rows = await all('SELECT id, barcode, name, expiry_date, current_stock FROM products ORDER BY id');
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch(async (err) => {
    console.error(err);
    try {
      await run('ROLLBACK');
    } catch (_rollbackErr) {
      // Ignore rollback failures after a failed transaction.
    }
    process.exitCode = 1;
  })
  .finally(() => db.close());
