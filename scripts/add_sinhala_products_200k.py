import argparse
import os
import random
import sqlite3
import sys
from datetime import datetime, timedelta


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


SINHALA_CATEGORIES = [
    ("Rice & Grains", "Rice, grains and dry staples"),
    ("Beverages", "Beverages and bottled drinks"),
    ("Dairy Products", "Dairy products"),
    ("Bakery", "Bread and bakery items"),
    ("Snacks", "Biscuits, chips and snacks"),
    ("Spices & Condiments", "Spices and condiments"),
    ("Packaged Foods", "Packaged foods"),
    ("Fruits", "Fresh fruits"),
    ("Vegetables", "Fresh vegetables"),
    ("Meat & Seafood", "Meat and seafood"),
    ("Personal Care", "Personal care"),
    ("Home Cleaning", "Home cleaning"),
    ("Baby Care", "Baby care"),
    ("Pet Supplies", "Pet supplies"),
    ("Breakfast Foods", "Breakfast products"),
    ("Health & Wellness", "Health and wellness"),
]

BRANDS = [
    "ලක්", "සිලෝන්", "ගෝල්ඩන්", "සුපර්", "නිව්", "හෙලා", "සෙරන්ඩිබ්", "ප්‍රයිම්",
    "ෆ්‍රෙෂ්", "සෙත්", "සන්", "බ්ලූ", "ගෝල්ඩ්", "පියෝ", "ඩේලි", "ට්‍රස්ට්"
]

ITEMS_BY_CATEGORY = {
    "Rice & Grains": ["සුදු සහල්", "රතු සහල්", "සම්බා සහල්", "නාඩු සහල්", "බාස්මතී සහල්", "පරිප්පු", "කව්පි", "මුං ඇට", "කඩල", "කුරක්කන් පිටි"],
    "Beverages": ["තේ කොළ", "කෝපි", "පලතුරු බීම", "තැඹිලි බීම", "සෝඩා බෝතලය", "ජල බෝතලය", "අයිස් කෝපි", "කිරි තේ මිශ්‍රණය", "නෙක්ටර් බීම", "ශක්ති බීම"],
    "Dairy Products": ["කිරිපිටි", "නැවුම් කිරි", "යෝගට්", "බටර්", "චීස්", "මාගරින්", "කිරි පැකට්", "අයිස් ක්‍රීම්", "දහිය", "කිරි ක්‍රීම්"],
    "Bakery": ["පාන්", "බනිස්", "කේක්", "රෝල්ස්", "පේස්ට්‍රි", "බිස්කට් කේක්", "බටර් කේක්", "කප් කේක්", "ඩෝනට්", "කුකීස්"],
    "Snacks": ["බිස්කට්", "චිප්ස්", "චොකලට්", "වේෆර්", "කජු මිශ්‍රණය", "මුරුක්කු", "පොප්කෝන්", "නූඩ්ල්ස්", "කැන්ඩි", "ක්‍රැකර්"],
    "Spices & Condiments": ["මිරිස් කුඩු", "කහ කුඩු", "ගම්මිරිස්", "කරි කුඩු", "අබ", "කුරුඳු", "එනසාල්", "ලුණු", "සුදුළූණු පේස්ට්", "ඉඟුරු පේස්ට්"],
    "Packaged Foods": ["ටින් මාළු", "සෝස්", "ජෑම්", "නූඩ්ල්ස් පැකට්", "සුප් පැකට්", "පැස්ටා", "කෝන්ෆ්ලේක්ස්", "ඔට්ස්", "සිරප්", "චට්නි"],
    "Fruits": ["කෙසෙල්", "ඇපල්", "දොඩම්", "අඹ", "අන්නාසි", "පැපොල්", "මිදි", "කොමඩු", "පේර", "රඹුටන්"],
    "Vegetables": ["අල", "ලූණු", "තක්කාලි", "කැරට්", "බෝංචි", "ගෝවා", "වම්බටු", "බණ්ඩක්කා", "මිරිස්", "ලීක්ස්"],
    "Meat & Seafood": ["කුකුල් මස්", "ගව මස්", "මාළු", "ඉස්සෝ", "කරවල", "බිත්තර", "සැමන්", "කකුළු මස්", "මස් බෝල", "මාළු පෙති"],
    "Personal Care": ["සබන්", "ෂැම්පු", "දත් බුරුසුව", "දත් මැදීමේ ක්‍රීම්", "බොඩි වොෂ්", "ලෝෂන්", "හෙයාර් ඔයිල්", "ඩියෝඩරන්ට්", "රේසර්", "ටැල්කම්"],
    "Home Cleaning": ["සෝදන කුඩු", "ඩිෂ් වොෂ්", "ෆ්ලෝර් ක්ලීනර්", "බ්ලීච්", "සැනිටයිසර්", "සබන් දියර", "ස්පොන්ජ්", "කසළ බෑග්", "ටොයිලට් ක්ලීනර්", "ග්ලාස් ක්ලීනර්"],
    "Baby Care": ["ළදරු ඩයපර්", "ළදරු කිරි", "බේබි සබන්", "බේබි ෂැම්පු", "බේබි ලෝෂන්", "බේබි වයිප්ස්", "ළදරු පවුඩර්", "බෝතලය", "පැසිෆයර්", "ළදරු තෙල්"],
    "Pet Supplies": ["සුනඛ ආහාර", "බළල් ආහාර", "පෙට් ෂැම්පු", "පෙට් බිස්කට්", "මාළු ආහාර", "පක්ෂි ආහාර", "පෙට් විටමින්", "පෙට් බෝල්", "ලීෂ්", "කැට් ලිටර්"],
    "Breakfast Foods": ["සීරියල්", "ඔට්ස්", "කිරි මිශ්‍රණය", "පැන්කේක් මිශ්‍රණය", "කෝන්ෆ්ලේක්ස්", "මියුස්ලි", "බ්‍රෙඩ් ස්ප්‍රෙඩ්", "මී පැණි", "පීනට් බටර්", "ග්‍රැනෝලා"],
    "Health & Wellness": ["විටමින්", "ප්‍රෝටීන් පවුඩර්", "හර්බල් තේ", "සැනිටරි පෑඩ්", "මුව ආවරණ", "හෑන්ඩ් වොෂ්", "ග්ලූකෝස්", "ආයුර්වේද තෙල්", "බාම්", "ප්ලාස්ටර්"],
}

SIZES = ["50g", "100g", "200g", "250g", "400g", "500g", "750g", "1kg", "2kg", "5kg", "250ml", "500ml", "1L", "1.5L", "2L", "10pcs", "20pcs"]
UNITS = ["pcs", "pkt", "bottle", "kg", "g", "L", "ml", "box", "can"]


def appdata_db_path():
    return os.path.join(os.environ["APPDATA"], "quickpos", "quickpos.db")


def ensure_categories(con):
    category_ids = {}
    for name, desc in SINHALA_CATEGORIES:
        con.execute("INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)", (name, desc))
        category_ids[name] = con.execute("SELECT id FROM categories WHERE name = ?", (name,)).fetchone()[0]
    return category_ids


def next_barcode_start(con):
    row = con.execute(
        "SELECT barcode FROM products WHERE barcode LIKE 'SIN%' ORDER BY barcode DESC LIMIT 1"
    ).fetchone()
    if not row:
        return 1
    try:
        return int(row[0][3:]) + 1
    except ValueError:
        return 1


def make_product(index, barcode_no, category_name, category_id):
    brand = BRANDS[index % len(BRANDS)]
    item = ITEMS_BY_CATEGORY[category_name][index % len(ITEMS_BY_CATEGORY[category_name])]
    size = SIZES[(index * 7) % len(SIZES)]
    barcode = f"SIN{barcode_no:09d}"
    name = f"{brand} {item} {size}"
    cost = round(45 + ((index * 37) % 4950) + ((index % 19) * 0.25), 2)
    margin = 1.12 + ((index % 17) * 0.015)
    selling = round(cost * margin, 2)
    stock = round(90000 + (index % 1000), 2)
    alert = 100
    unit = UNITS[index % len(UNITS)]
    weighted = 1 if unit in ("kg", "g", "L", "ml") else 0
    expiry = (datetime.now() + timedelta(days=30 + (index % 900))).strftime("%Y-%m-%d")
    return (barcode, name, category_id, cost, selling, stock, alert, unit, weighted, expiry)


def main():
    parser = argparse.ArgumentParser(description="Add Sinhala sample products to QuickPOS.")
    parser.add_argument("--db", default=appdata_db_path(), help="SQLite DB path")
    parser.add_argument("--count", type=int, default=200000, help="Number of products to add")
    parser.add_argument("--batch-size", type=int, default=5000, help="Rows per insert batch")
    args = parser.parse_args()

    random.seed(20260520)
    con = sqlite3.connect(args.db)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.execute("PRAGMA foreign_keys=ON")

    category_ids = ensure_categories(con)
    con.commit()

    insert_product_sql = """
        INSERT INTO products (
            barcode, name, category_id, cost_price, selling_price, current_stock,
            alert_level, unit_type, is_weighted, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    insert_batch_sql = """
        INSERT INTO inventory_batches (
            product_id, batch_code, received_qty, remaining_qty,
            cost_price, selling_price, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """

    barcode_start = next_barcode_start(con)
    categories = list(category_ids.items())
    inserted = 0

    while inserted < args.count:
        take = min(args.batch_size, args.count - inserted)
        con.execute("BEGIN IMMEDIATE TRANSACTION")
        for offset in range(take):
            index = inserted + offset
            category_name, category_id = categories[index % len(categories)]
            product = make_product(index, barcode_start + index, category_name, category_id)
            cur = con.execute(insert_product_sql, product)
            product_id = cur.lastrowid
            barcode, _name, _cat, cost, selling, stock, _alert, _unit, _weighted, expiry = product
            con.execute(
                insert_batch_sql,
                (product_id, f"OPEN-{barcode}", stock, stock, cost, selling, expiry),
            )
        con.commit()
        inserted += take
        print(f"Inserted {inserted}/{args.count}")

    total = con.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    sample = con.execute(
        "SELECT barcode, name FROM products WHERE barcode LIKE 'SIN%' ORDER BY id LIMIT 5"
    ).fetchall()
    con.close()
    print(f"Done. Total products: {total}")
    for row in sample:
        print(f"{row[0]} | {row[1]}")


if __name__ == "__main__":
    main()
