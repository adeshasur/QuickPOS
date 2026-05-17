const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', 'quickpos.db');

const db = new sqlite3.Database(dbPath);

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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `pbkdf2$120000$${salt}$${hash}`;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function ymdFromOffset(daysBackMax) {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysBackMax));
  return d.toISOString().slice(0, 10);
}

function ymdFuture(daysAheadMin, daysAheadMax) {
  const d = new Date();
  d.setDate(d.getDate() + randInt(daysAheadMin, daysAheadMax));
  return d.toISOString().slice(0, 10);
}

async function resetData() {
  await run('PRAGMA foreign_keys = OFF');
  await run('BEGIN IMMEDIATE TRANSACTION');
  await run('DELETE FROM sale_items');
  await run('DELETE FROM sales');
  await run('DELETE FROM products');
  await run('DELETE FROM customers');
  await run('DELETE FROM categories');
  await run('DELETE FROM users');
  await run("DELETE FROM settings WHERE key NOT LIKE 'bill_counter_%'");
  await run('COMMIT');
  await run('PRAGMA foreign_keys = ON');
}

async function ensureSchema() {
  const salesCols = await all('PRAGMA table_info(sales)');
  const hasRefNo = salesCols.some((c) => c.name === 'ref_no');
  if (!hasRefNo) {
    await run('ALTER TABLE sales ADD COLUMN ref_no TEXT');
  }

  const saleItemCols = await all('PRAGMA table_info(sale_items)');
  const hasProductName = saleItemCols.some((c) => c.name === 'product_name');
  if (!hasProductName) {
    await run('ALTER TABLE sale_items ADD COLUMN product_name TEXT');
  }

  const userCols = await all('PRAGMA table_info(users)');
  const hasCanViewReports = userCols.some((c) => c.name === 'can_view_reports');
  if (!hasCanViewReports) {
    await run('ALTER TABLE users ADD COLUMN can_view_reports INTEGER DEFAULT 1');
  }
}

async function seedUsers() {
  const users = [
    ['Nadeesha Perera', 'owner', hashPassword('owner@123'), 'owner', 1],
    ['Kasun Fernando', 'cashier1', hashPassword('cashier@123'), 'cashier', 0],
    ['Ishani Silva', 'cashier2', hashPassword('cashier@123'), 'cashier', 1],
    ['Ruwan Jayasuriya', 'cashier3', hashPassword('cashier@123'), 'cashier', 0],
    ['Tharindu Rajapaksha', 'cashier4', hashPassword('cashier@123'), 'cashier', 1]
  ];

  for (const u of users) {
    await run(
      'INSERT INTO users (name, username, password, role, can_view_reports) VALUES (?, ?, ?, ?, ?)',
      u
    );
  }
}

async function seedCategories() {
  const categories = [
    ['Rice & Grains', 'Rice, lentils, flour and dry staples'],
    ['Beverages', 'Soft drinks, juices, tea and bottled water'],
    ['Dairy & Eggs', 'Milk, yogurt, butter and eggs'],
    ['Bakery', 'Bread, buns and baking ingredients'],
    ['Snacks', 'Biscuits, chips and confectionery'],
    ['Frozen Foods', 'Frozen meats, fish and ready meals'],
    ['Spices & Condiments', 'Spices, sauces and cooking pastes'],
    ['Canned & Packaged', 'Cans, jars and preserved foods'],
    ['Personal Care', 'Soap, shampoo and hygiene products'],
    ['Home Cleaning', 'Detergents and cleaning liquids'],
    ['Baby Care', 'Diapers, formula and baby accessories'],
    ['Pet Supplies', 'Pet food and pet care products'],
    ['Fruits', 'Fresh fruits'],
    ['Vegetables', 'Fresh vegetables'],
    ['Meat & Seafood', 'Fresh and chilled meat and seafood'],
    ['Breakfast', 'Cereals, oats and breakfast items'],
    ['Health & Wellness', 'Supplements and health products'],
    ['Household', 'Batteries, disposables and household goods']
  ];

  for (const c of categories) {
    await run('INSERT INTO categories (name, description) VALUES (?, ?)', c);
  }
}

async function seedProducts() {
  const catRows = await all('SELECT id, name FROM categories ORDER BY id');
  const units = ['pcs', 'pkt', 'bottle', 'kg', 'g', 'L', 'ml', 'box', 'tub', 'can'];
  const brandPrefixes = ['Ceylon', 'Lanka', 'Fresh', 'Prime', 'Daily', 'Golden', 'Super', 'Choice', 'Pure', 'Smart'];
  const itemBases = [
    'Rice', 'Sugar', 'Flour', 'Milk Powder', 'Butter', 'Yogurt', 'Tea', 'Coffee', 'Biscuits', 'Noodles',
    'Sardines', 'Tuna', 'Soap', 'Shampoo', 'Toothpaste', 'Dishwash', 'Detergent', 'Juice', 'Oats', 'Diapers',
    'Dog Food', 'Cat Food', 'Sauce', 'Chilli Paste', 'Vinegar', 'Chocolate', 'Chips', 'Bread', 'Buns', 'Eggs'
  ];

  let pCount = 0;
  for (const cat of catRows) {
    for (let i = 1; i <= 45; i += 1) {
      pCount += 1;
      const brand = pick(brandPrefixes);
      const base = pick(itemBases);
      const unitType = pick(units);
      const cost = Number(rand(60, 3500).toFixed(2));
      const margin = rand(0.08, 0.42);
      const sell = Number((cost * (1 + margin)).toFixed(2));
      const stock = Number(rand(8, 420).toFixed(2));
      const alertLevel = Number(rand(5, 40).toFixed(2));
      const isWeighted = unitType === 'kg' || unitType === 'g' || unitType === 'L' || unitType === 'ml' ? 1 : 0;
      const barcode = `SPM${String(pCount).padStart(7, '0')}`;
      const name = `${brand} ${base} ${i}`;
      const expiry = ymdFuture(30, 720);

      await run(
        `INSERT INTO products
          (barcode, name, category_id, cost_price, selling_price, current_stock, alert_level, unit_type, is_weighted, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [barcode, name, cat.id, cost, sell, stock, alertLevel, unitType, isWeighted, expiry]
      );
    }
  }
}

async function seedCustomers() {
  const first = ['Kamal', 'Nimal', 'Sunil', 'Saman', 'Ruwan', 'Dinesh', 'Thilini', 'Nadeesha', 'Iresha', 'Sachini', 'Hasitha', 'Lakshan'];
  const last = ['Perera', 'Silva', 'Fernando', 'Jayasinghe', 'Wijesinghe', 'Gamage', 'Fonseka', 'Weerasinghe', 'Gunawardena', 'Rathnayake'];
  const areas = ['Colombo', 'Kandy', 'Gampaha', 'Negombo', 'Matara', 'Kurunegala', 'Galle', 'Jaffna', 'Batticaloa', 'Anuradhapura'];

  for (let i = 1; i <= 320; i += 1) {
    const name = `${pick(first)} ${pick(last)}`;
    const phone = `07${randInt(0, 9)}${randInt(1000000, 9999999)}`;
    const address = `${randInt(10, 999)}, ${pick(areas)}`;
    const balance = Number(rand(0, 25000).toFixed(2));
    await run('INSERT INTO customers (name, phone, address, balance) VALUES (?, ?, ?, ?)', [name, phone, address, balance]);
  }
}

async function seedSales() {
  const products = await all('SELECT id, name, selling_price, current_stock FROM products');
  const customers = await all('SELECT id FROM customers');
  const cashiers = await all("SELECT name FROM users WHERE role = 'cashier'");
  const methods = ['Cash', 'Card', 'Credit'];

  let seq = 1;
  for (let day = 0; day < 120; day += 1) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - day);
    const dayKey = `${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, '0')}${String(dayDate.getDate()).padStart(2, '0')}`;
    const txCount = randInt(20, 55);

    for (let t = 0; t < txCount; t += 1) {
      const itemCount = randInt(1, 8);
      let total = 0;
      const chosen = [];
      for (let k = 0; k < itemCount; k += 1) {
        chosen.push(pick(products));
      }

      const timestamp = new Date(dayDate);
      timestamp.setHours(randInt(7, 21), randInt(0, 59), randInt(0, 59), 0);
      const method = pick(methods);
      const customerId = method === 'Credit' ? pick(customers).id : (Math.random() < 0.35 ? pick(customers).id : null);

      const itemRows = [];
      for (const p of chosen) {
        const qty = Number((p.current_stock > 50 ? rand(1, 6) : rand(0.5, 3)).toFixed(2));
        const unit = Number(p.selling_price);
        const subtotal = Number((qty * unit).toFixed(2));
        total += subtotal;
        itemRows.push({ p, qty, unit, subtotal });
      }
      total = Number(total.toFixed(2));

      const received = method === 'Credit' ? Number((total * rand(0.1, 0.7)).toFixed(2)) : total;
      const balance = Number((total - received).toFixed(2));
      const billId = `INV-${dayKey}-${String(seq).padStart(4, '0')}`;
      seq += 1;

      const saleResult = await run(
        `INSERT INTO sales
          (bill_id, customer_id, total_amount, payment_method, received_amount, balance_amount, ref_no, timestamp, cashier_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          billId,
          customerId,
          total,
          method,
          received,
          balance > 0 ? balance : 0,
          method === 'Card' ? `CRD${randInt(100000, 999999)}` : null,
          timestamp.toISOString().replace('T', ' ').slice(0, 19),
          pick(cashiers).name
        ]
      );

      for (const ir of itemRows) {
        await run(
          `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [saleResult.lastID, ir.p.id, ir.p.name, ir.qty, ir.unit, ir.subtotal]
        );
      }
    }
  }
}

async function main() {
  try {
    console.log(`Seeding database: ${dbPath}`);
    await ensureSchema();
    await resetData();
    await seedUsers();
    await seedCategories();
    await seedProducts();
    await seedCustomers();
    await seedSales();

    const [u] = await all('SELECT COUNT(*) AS c FROM users');
    const [c] = await all('SELECT COUNT(*) AS c FROM categories');
    const [p] = await all('SELECT COUNT(*) AS c FROM products');
    const [cu] = await all('SELECT COUNT(*) AS c FROM customers');
    const [s] = await all('SELECT COUNT(*) AS c FROM sales');
    const [si] = await all('SELECT COUNT(*) AS c FROM sale_items');

    console.log('Seed complete:');
    console.log(`users=${u.c}, categories=${c.c}, products=${p.c}, customers=${cu.c}, sales=${s.c}, sale_items=${si.c}`);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
