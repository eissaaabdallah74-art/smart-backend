const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('d:\\eissa\\eissa smart vibe\\smart-backend\\database.sqlite');

db.all("SELECT * FROM client_pricing_rules WHERE client_id = 5", (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
});
