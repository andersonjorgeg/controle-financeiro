const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.exec(`
  ALTER TABLE transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'outros';
`, (err) => {
  if (err) {
    console.error('Erro na migração:', err);
  } else {
    console.log('Migração concluída com sucesso!');
  }
  db.close();
});