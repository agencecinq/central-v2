import { readFileSync, writeFileSync } from 'fs';

const dumpFile = process.argv[2];
if (!dumpFile) { console.error('Usage: node convert-dump.mjs <dump.sql>'); process.exit(1); }

const dump = readFileSync(dumpFile, 'utf-8');
const lines = dump.split('\n');

// Collect INSERT statements per table
let currentInsert = '';
const inserts = {};
for (const line of lines) {
  if (line.startsWith('INSERT INTO')) {
    currentInsert = line;
    if (line.endsWith(';')) {
      const m = line.match(/INSERT INTO `([^`]+)`/);
      if (m) { (inserts[m[1]] ??= []).push(currentInsert); }
      currentInsert = '';
    }
  } else if (currentInsert) {
    currentInsert += '\n' + line;
    if (line.endsWith(';')) {
      const m = currentInsert.match(/INSERT INTO `([^`]+)`/);
      if (m) { (inserts[m[1]] ??= []).push(currentInsert); }
      currentInsert = '';
    }
  }
}

console.log('Tables in dump:', Object.keys(inserts).join(', '));

// Parse a MySQL VALUES string into an array of tuples, each tuple being an array of field strings
function parseValues(sql) {
  const valuesIdx = sql.indexOf('VALUES');
  if (valuesIdx === -1) return [];
  let str = sql.substring(valuesIdx + 6).trim();
  if (str.endsWith(';')) str = str.slice(0, -1);

  const tuples = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '(') {
      i++;
      const fields = [];
      let field = '';
      let inStr = false;
      while (i < str.length) {
        const ch = str[i];
        if (ch === '\\' && inStr) { field += ch + str[i + 1]; i += 2; continue; }
        if (ch === "'" && !inStr) { inStr = true; field += ch; i++; continue; }
        if (ch === "'" && inStr) { inStr = false; field += ch; i++; continue; }
        if (inStr) { field += ch; i++; continue; }
        if (ch === ',') { fields.push(field.trim()); field = ''; i++; continue; }
        if (ch === ')') { fields.push(field.trim()); i++; break; }
        field += ch;
        i++;
      }
      tuples.push(fields);
    } else {
      i++;
    }
  }
  return tuples;
}

// Parse column names from INSERT INTO
function parseColumns(sql) {
  const m = sql.match(/INSERT INTO `[^`]+` \(([^)]+)\)/);
  if (!m) return [];
  return m[1].split(',').map(c => c.trim().replace(/`/g, ''));
}

// Escape a field value for PostgreSQL
function pgEscape(val) {
  if (val === 'NULL') return 'NULL';
  // Replace MySQL escapes with PG escapes
  return val
    .replace(/\\'/g, "''")
    .replace(/\\0/g, '')
    .replace(/\\\\/g, '\\');
}

// Build a PG INSERT statement
function buildInsert(pgTable, pgCols, rows) {
  if (rows.length === 0) return '';
  const colStr = pgCols.map(c => `"${c}"`).join(', ');
  const valueStrs = rows.map(row => '(' + row.join(', ') + ')');
  // Split into batches of 100 to avoid too-long statements
  const batches = [];
  for (let i = 0; i < valueStrs.length; i += 100) {
    batches.push(`INSERT INTO "${pgTable}" (${colStr}) VALUES\n${valueStrs.slice(i, i + 100).join(',\n')};`);
  }
  return batches.join('\n');
}

// Boolean columns per table
const booleanCols = {
  projects: ['is_personnel', 'is_agence'],
  tasks: ['est_terminee', 'is_out_of_scope', 'requires_new_quote', 'is_backlog'],
  proposition_commerciale_sections: ['est_option'],
};

// Role mapping
const roleMap = { pm: 'equipe', commercial: 'equipe' };

const output = [];
output.push('BEGIN;');
output.push('');

// Migration order (respects FK dependencies)
const migrations = [
  { from: 'clients', to: 'clients' },
  { from: 'users', to: 'users', transforms: {
    role: v => { const clean = v.replace(/'/g, ''); return roleMap[clean] ? `'${roleMap[clean]}'` : v; }
  }},
  { from: 'deals', to: 'deals' },
  { from: 'proposition_commerciales', to: 'proposition_commerciales' },
  { from: 'proposition_commerciale_sections', to: 'proposition_commerciale_sections' },
  { from: 'proposition_commerciale_sous_sections', to: 'proposition_commerciale_sous_sections' },
  { from: 'proposition_commerciale_planning_etapes', to: 'proposition_commerciale_planning_etapes' },
  { from: 'projects', to: 'projects' },
  { from: 'tasks', to: 'tasks' },
  { from: 'transactions', to: 'transactions' },
  // tickets needs special handling
  // ticket_files needs special handling
];

for (const mig of migrations) {
  const tableInserts = inserts[mig.from];
  if (!tableInserts) { output.push(`-- No data: ${mig.from}`); continue; }

  output.push(`-- ${mig.from} -> ${mig.to}`);

  for (const sql of tableInserts) {
    const mysqlCols = parseColumns(sql);
    const tuples = parseValues(sql);
    const bools = booleanCols[mig.from] || [];

    const pgCols = mysqlCols; // same column names (mapped via Prisma @map)
    const rows = tuples.map(fields => {
      return fields.map((val, i) => {
        const col = mysqlCols[i];
        let v = pgEscape(val);
        // Boolean conversion
        if (bools.includes(col)) {
          if (v === '0') v = 'false';
          else if (v === '1') v = 'true';
        }
        // Role transform
        if (mig.transforms?.[col]) {
          v = mig.transforms[col](v);
        }
        return v;
      });
    });

    output.push(buildInsert(mig.to, pgCols, rows));
  }
  output.push('');
}

// Tickets - column remapping
const ticketInserts = inserts['tickets'];
if (ticketInserts) {
  output.push('-- tickets (remapped columns)');
  // MySQL cols: id, project_id, user_id, titre, description, lien, position_x, position_y, type, est_resolu, date_resolution, created_at, updated_at
  const pgTicketCols = ['id', 'project_id', 'createur_id', 'titre', 'description', 'statut', 'created_at', 'updated_at'];

  for (const sql of ticketInserts) {
    const mysqlCols = parseColumns(sql);
    const tuples = parseValues(sql);

    const idIdx = mysqlCols.indexOf('id');
    const projIdx = mysqlCols.indexOf('project_id');
    const userIdx = mysqlCols.indexOf('user_id');
    const titreIdx = mysqlCols.indexOf('titre');
    const descIdx = mysqlCols.indexOf('description');
    const createdIdx = mysqlCols.indexOf('created_at');
    const updatedIdx = mysqlCols.indexOf('updated_at');

    const rows = tuples.map(fields => [
      pgEscape(fields[idIdx]),
      pgEscape(fields[projIdx]),
      pgEscape(fields[userIdx]),
      pgEscape(fields[titreIdx]),
      pgEscape(fields[descIdx]),
      "'ouvert'",
      pgEscape(fields[createdIdx]),
      pgEscape(fields[updatedIdx]),
    ]);

    output.push(buildInsert('tickets', pgTicketCols, rows));
  }
  output.push('');
}

// ticket_files -> ticket_attachments
const ticketFileInserts = inserts['ticket_files'];
if (ticketFileInserts) {
  output.push('-- ticket_files -> ticket_attachments');
  const pgCols = ['id', 'ticket_id', 'filename', 'filepath', 'mimetype', 'size', 'created_at'];

  for (const sql of ticketFileInserts) {
    const mysqlCols = parseColumns(sql);
    const tuples = parseValues(sql);

    const idIdx = mysqlCols.indexOf('id');
    const ticketIdx = mysqlCols.indexOf('ticket_id');
    const nameIdx = mysqlCols.indexOf('name');
    const pathIdx = mysqlCols.indexOf('path');
    const mimeIdx = mysqlCols.indexOf('mime_type');
    const sizeIdx = mysqlCols.indexOf('size');
    const createdIdx = mysqlCols.indexOf('created_at');

    const rows = tuples.map(fields => [
      pgEscape(fields[idIdx]),
      pgEscape(fields[ticketIdx]),
      pgEscape(fields[nameIdx]),
      pgEscape(fields[pathIdx]),
      pgEscape(fields[mimeIdx]),
      pgEscape(fields[sizeIdx]),
      pgEscape(fields[createdIdx]),
    ]);

    output.push(buildInsert('ticket_attachments', pgCols, rows));
  }
  output.push('');
}

// Reset sequences
output.push('-- Reset sequences');
const allTables = ['clients', 'users', 'deals', 'projects', 'tasks', 'tickets',
  'ticket_attachments', 'transactions', 'proposition_commerciales',
  'proposition_commerciale_sections', 'proposition_commerciale_sous_sections',
  'proposition_commerciale_planning_etapes'];
for (const t of allTables) {
  output.push(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM "${t}";`);
}

output.push('');
output.push('COMMIT;');

writeFileSync('/tmp/cinqcentral_pg_final.sql', output.join('\n'));
console.log(`Done. ${output.join('\n').length / 1024 | 0} KB, ${allTables.length} tables`);
