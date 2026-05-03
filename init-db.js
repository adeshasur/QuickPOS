// Initialize database with default data
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/pos_database.sqlite');

console.log('Initializing database...');

// Insert default users
db.run(`INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)`, 
    ['admin', '123', 'Admin User', 'owner'], 
    function(err) {
        if (err) console.error('Error inserting admin:', err.message);
        else console.log('Admin user ready');
    }
);

db.run(`INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)`, 
    ['staff', '456', 'Cashier User', 'cashier'], 
    function(err) {
        if (err) console.error('Error inserting staff:', err.message);
        else console.log('Staff user ready');
    }
);

// Verify users
db.all('SELECT username, name, role FROM users', [], (err, rows) => {
    if (err) {
        console.error('Error reading users:', err.message);
    } else {
        console.log('\nUsers in database:');
        rows.forEach(u => console.log(`  - ${u.username} (${u.role}): ${u.name}`));
    }
    
    db.close((err) => {
        if (err) console.error('Error closing database:', err.message);
        else console.log('\nDatabase initialized successfully!');
    });
});
