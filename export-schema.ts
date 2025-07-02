import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function exportSchema() {
  const client = await pool.connect();
  try {
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    let output = '';

    for (const { table_name } of tables) {
      output += `\n-- ${table_name}\n`;

      const { rows: columns } = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table_name]);

      output += `CREATE TABLE ${table_name} (\n`;
      output += columns.map(col => {
        let line = `  ${col.column_name} ${col.data_type}`;
        if (col.column_default) line += ` DEFAULT ${col.column_default}`;
        if (col.is_nullable === 'NO') line += ' NOT NULL';
        return line;
      }).join(',\n');
      output += `\n);\n`;
    }

    fs.writeFileSync('schema-export.sql', output, 'utf-8');
    console.log('Esquema exportado para schema-export.sql');
  } catch (error) {
    console.error('Erro ao exportar o esquema:', error.message);
  } finally {
    client.release();
    process.exit();
  }
}

exportSchema();
