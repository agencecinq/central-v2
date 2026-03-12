#!/bin/bash
# =============================================================================
# Migration MySQL (Infomaniak) -> PostgreSQL (Render)
# CinqCentral V2
# =============================================================================
#
# Usage:
#   ./scripts/migrate-mysql-to-pg.sh <mysql_dump.sql> <postgres_connection_string>
#
# Example:
#   ./scripts/migrate-mysql-to-pg.sh dump.sql "postgresql://cinq:password@host:5432/cinq_central"
#
# Prerequisites:
#   - psql (PostgreSQL client) installed
#   - Node.js installed (for prisma)
#   - The Prisma schema must be configured for PostgreSQL
# =============================================================================

set -e

DUMP_FILE="$1"
PG_URL="$2"

if [ -z "$DUMP_FILE" ] || [ -z "$PG_URL" ]; then
  echo "Usage: $0 <mysql_dump.sql> <postgres_connection_string>"
  echo "Example: $0 dump.sql \"postgresql://user:pass@host:5432/dbname\""
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: File $DUMP_FILE not found"
  exit 1
fi

echo "=== CinqCentral MySQL -> PostgreSQL Migration ==="
echo ""

# Step 1: Create PostgreSQL schema via Prisma
echo "[1/4] Creating PostgreSQL schema via Prisma..."
DATABASE_URL="$PG_URL" npx prisma db push --force-reset --accept-data-loss
echo "  ✓ Schema created"

# Step 2: Generate the SQL conversion script
echo "[2/4] Converting MySQL dump to PostgreSQL format..."

CONVERTED_FILE="/tmp/cinqcentral_pg_import.sql"

node -e "
const fs = require('fs');
const dump = fs.readFileSync('$DUMP_FILE', 'utf-8');

// Extract INSERT statements and convert them
const lines = dump.split('\n');
let output = [];

output.push('SET session_replication_role = replica;'); // Disable FK checks
output.push('');

// Tables to migrate (in order of dependencies)
const tableMigrations = [
  // 1. clients (no deps)
  {
    mysqlTable: 'clients',
    pgTable: 'clients',
    columns: {
      id: 'id', nom: 'nom', email: 'email', telephone: 'telephone',
      entreprise: 'entreprise', statut: 'statut',
      created_at: 'created_at', updated_at: 'updated_at'
    }
  },
  // 2. users (depends on clients)
  {
    mysqlTable: 'users',
    pgTable: 'users',
    columns: {
      id: 'id', name: 'name', email: 'email', google_id: 'google_id',
      slack_id: 'slack_id', google_calendar_token: 'google_calendar_token',
      google_refresh_token: 'google_refresh_token',
      google_token_expires_at: 'google_token_expires_at',
      google_calendar_id: 'google_calendar_id',
      role: 'role', client_id: 'client_id', tjm: 'tjm',
      email_verified_at: 'email_verified_at', password: 'password',
      two_factor_secret: 'two_factor_secret',
      two_factor_recovery_codes: 'two_factor_recovery_codes',
      two_factor_confirmed_at: 'two_factor_confirmed_at',
      remember_token: 'remember_token',
      created_at: 'created_at', updated_at: 'updated_at'
    },
    transforms: {
      role: (v) => {
        if (v === \"'pm'\") return \"'equipe'\";
        if (v === \"'commercial'\") return \"'equipe'\";
        return v;
      }
    }
  },
  // 3. deals (depends on clients)
  {
    mysqlTable: 'deals',
    pgTable: 'deals',
    columns: {
      id: 'id', client_id: 'client_id', titre: 'titre',
      montant_estime: 'montant_estime', montant_final: 'montant_final',
      qonto_quote_id: 'qonto_quote_id',
      modalites_facturation: 'modalites_facturation',
      etape: 'etape', date_signature: 'date_signature',
      created_at: 'created_at', updated_at: 'updated_at'
    }
  },
  // 4. projects (depends on clients, deals, users)
  {
    mysqlTable: 'projects',
    pgTable: 'projects',
    columns: {
      id: 'id', client_id: 'client_id', deal_id: 'deal_id',
      titre: 'titre', description: 'description',
      github_url: 'github_url', github_repo_name: 'github_repo_name',
      figma_url: 'figma_url', slack_channel_id: 'slack_channel_id',
      userback_project_id: 'userback_project_id',
      budget_total: 'budget_total', budget_consomme: 'budget_consomme',
      deadline: 'deadline', date_debut: 'date_debut', date_fin: 'date_fin',
      statut: 'statut', is_personnel: 'is_personnel', is_agence: 'is_agence',
      widget_token: 'widget_token',
      created_at: 'created_at', updated_at: 'updated_at',
      chef_projet_id: 'chef_projet_id'
    },
    transforms: {
      is_personnel: (v) => v === '1' ? 'true' : 'false',
      is_agence: (v) => v === '1' ? 'true' : 'false'
    }
  },
  // 5. tasks (depends on projects, users)
  {
    mysqlTable: 'tasks',
    pgTable: 'tasks',
    columns: {
      id: 'id', project_id: 'project_id', titre: 'titre',
      description: 'description', date_echeance: 'date_echeance',
      date_debut: 'date_debut', estimation_heures: 'estimation_heures',
      est_terminee: 'est_terminee', statut_kanban: 'statut_kanban',
      is_out_of_scope: 'is_out_of_scope',
      requires_new_quote: 'requires_new_quote',
      priority_level: 'priority_level', is_backlog: 'is_backlog',
      priorite: 'priorite',
      created_at: 'created_at', updated_at: 'updated_at',
      user_id: 'user_id', categorie: 'categorie'
    },
    transforms: {
      est_terminee: (v) => v === '1' ? 'true' : 'false',
      is_out_of_scope: (v) => v === '1' ? 'true' : 'false',
      requires_new_quote: (v) => v === '1' ? 'true' : 'false',
      is_backlog: (v) => v === '1' ? 'true' : 'false'
    }
  },
  // 6. tickets (depends on projects, users) - schema changed
  {
    mysqlTable: 'tickets',
    pgTable: 'tickets',
    columns: {
      id: 'id', project_id: 'project_id',
      user_id: 'createur_id',  // renamed: user_id -> createur_id
      titre: 'titre', description: 'description',
      created_at: 'created_at', updated_at: 'updated_at'
    },
    transforms: {
      est_resolu: null // drop: replaced by statut
    },
    extraColumns: {
      statut: (row) => \"'ouvert'\"
    }
  },
  // 7. ticket_files -> ticket_attachments (table renamed)
  {
    mysqlTable: 'ticket_files',
    pgTable: 'ticket_attachments',
    columns: {
      id: 'id', ticket_id: 'ticket_id',
      name: 'filename',   // renamed
      path: 'filepath',   // renamed
      mime_type: 'mimetype', // renamed
      size: 'size',
      created_at: 'created_at'
    }
  },
  // 8. transactions
  {
    mysqlTable: 'transactions',
    pgTable: 'transactions',
    columns: {
      id: 'id', project_id: 'project_id', label: 'label',
      categorie: 'categorie', montant: 'montant', type: 'type',
      statut: 'statut', montant_paye: 'montant_paye',
      date_transaction: 'date_transaction', qonto_id: 'qonto_id',
      created_at: 'created_at', updated_at: 'updated_at'
    }
  },
  // 9. proposition_commerciales
  {
    mysqlTable: 'proposition_commerciales',
    pgTable: 'proposition_commerciales',
    columns: {
      id: 'id', deal_id: 'deal_id', nom: 'nom',
      qonto_quote_id: 'qonto_quote_id', public_token: 'public_token',
      montant_total: 'montant_total', remise_globale: 'remise_globale',
      introduction: 'introduction', conclusion: 'conclusion',
      benefices_cles: 'benefices_cles',
      informations_complementaires: 'informations_complementaires',
      call_to_action: 'call_to_action',
      date_debut_projet: 'date_debut_projet',
      logo_entreprise: 'logo_entreprise', logo_client: 'logo_client',
      langue: 'langue', devise: 'devise',
      taux_tva: 'taux_tva', taux_gestion_projet: 'taux_gestion_projet',
      tjm_gestion_projet: 'tjm_gestion_projet',
      references: 'references',
      created_at: 'created_at', updated_at: 'updated_at'
    }
  },
  // 10. proposition_commerciale_sections
  {
    mysqlTable: 'proposition_commerciale_sections',
    pgTable: 'proposition_commerciale_sections',
    columns: {
      id: 'id', proposition_commerciale_id: 'proposition_commerciale_id',
      titre: 'titre', description: 'description',
      ordre: 'ordre', est_option: 'est_option',
      created_at: 'created_at', updated_at: 'updated_at'
    },
    transforms: {
      est_option: (v) => v === '1' ? 'true' : 'false'
    }
  },
  // 11. proposition_commerciale_sous_sections
  {
    mysqlTable: 'proposition_commerciale_sous_sections',
    pgTable: 'proposition_commerciale_sous_sections',
    columns: {
      id: 'id', section_id: 'section_id',
      titre: 'titre', description: 'description',
      nombre_jours: 'nombre_jours', tjm: 'tjm',
      remise: 'remise', ordre: 'ordre',
      created_at: 'created_at', updated_at: 'updated_at'
    }
  },
  // 12. proposition_commerciale_planning_etapes
  {
    mysqlTable: 'proposition_commerciale_planning_etapes',
    pgTable: 'proposition_commerciale_planning_etapes',
    columns: {
      id: 'id', proposition_commerciale_id: 'proposition_commerciale_id',
      titre: 'titre', description: 'description',
      nombre_semaines: 'nombre_semaines', ordre: 'ordre',
      created_at: 'created_at', updated_at: 'updated_at'
    }
  }
];

// Simple parser: extract INSERT INTO blocks
let currentInsert = '';
let inserts = {};

for (const line of lines) {
  if (line.startsWith('INSERT INTO')) {
    currentInsert = line;
    // Check if line is complete (ends with ;)
    if (line.endsWith(';')) {
      const tableMatch = line.match(/INSERT INTO \\\`([^\\\`]+)\\\`/);
      if (tableMatch) {
        if (!inserts[tableMatch[1]]) inserts[tableMatch[1]] = [];
        inserts[tableMatch[1]].push(currentInsert);
      }
      currentInsert = '';
    }
  } else if (currentInsert) {
    currentInsert += '\n' + line;
    if (line.endsWith(';')) {
      const tableMatch = currentInsert.match(/INSERT INTO \\\`([^\\\`]+)\\\`/);
      if (tableMatch) {
        if (!inserts[tableMatch[1]]) inserts[tableMatch[1]] = [];
        inserts[tableMatch[1]].push(currentInsert);
      }
      currentInsert = '';
    }
  }
}

// For each migration mapping, convert the INSERT statements
for (const migration of tableMigrations) {
  const tableInserts = inserts[migration.mysqlTable];
  if (!tableInserts) {
    output.push('-- No data for table: ' + migration.mysqlTable);
    output.push('');
    continue;
  }

  output.push('-- Migrating: ' + migration.mysqlTable + ' -> ' + migration.pgTable);

  for (const insertSQL of tableInserts) {
    // Extract column list from INSERT INTO
    const colMatch = insertSQL.match(/INSERT INTO \\\`[^\\\`]+\\\` \\(([^)]+)\\)/);
    if (!colMatch) continue;

    const mysqlCols = colMatch[1].split(',').map(c => c.trim().replace(/\\\`/g, ''));

    // Map MySQL columns to PG columns
    const pgCols = [];
    const colIndices = [];
    for (let i = 0; i < mysqlCols.length; i++) {
      const mysqlCol = mysqlCols[i];
      if (migration.columns[mysqlCol] !== undefined) {
        pgCols.push('\"' + migration.columns[mysqlCol] + '\"');
        colIndices.push(i);
      }
    }

    // Build the PG INSERT with mapped column names
    let pgInsert = 'INSERT INTO \"' + migration.pgTable + '\" (' + pgCols.join(', ') + ') VALUES';

    // Extract VALUES - just do string replacement for the INSERT INTO part
    const valuesStart = insertSQL.indexOf('VALUES');
    if (valuesStart === -1) continue;

    let valuesStr = insertSQL.substring(valuesStart + 6).trim();
    if (valuesStr.endsWith(';')) valuesStr = valuesStr.slice(0, -1);

    // Convert MySQL-specific syntax to PostgreSQL
    valuesStr = valuesStr
      .replace(/\\\\'/g, \"''\")           // Escape single quotes
      .replace(/\\\\r\\\\n/g, '\\\\n')     // Normalize newlines
      .replace(/\\\\0/g, '');              // Remove null bytes

    output.push(pgInsert + ' ' + valuesStr + ';');
  }
  output.push('');
}

// Reset sequences to max(id) + 1
output.push('-- Reset auto-increment sequences');
const tables = ['clients', 'users', 'deals', 'projects', 'tasks', 'tickets',
  'ticket_attachments', 'transactions', 'proposition_commerciales',
  'proposition_commerciale_sections', 'proposition_commerciale_sous_sections',
  'proposition_commerciale_planning_etapes'];
for (const t of tables) {
  output.push(\\"SELECT setval(pg_get_serial_sequence('\\\" + t + \\\"', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM \\\"\\\" + t + \\\"\\\";\\"\\);
}

output.push('');
output.push('SET session_replication_role = DEFAULT;'); // Re-enable FK checks

fs.writeFileSync('$CONVERTED_FILE', output.join('\n'));
console.log('  Converted ' + Object.keys(inserts).length + ' tables');
"
echo "  ✓ Conversion done: $CONVERTED_FILE"

# Step 3: Import into PostgreSQL
echo "[3/4] Importing data into PostgreSQL..."
psql "$PG_URL" -f "$CONVERTED_FILE" 2>&1 | tail -5
echo "  ✓ Data imported"

# Step 4: Verify
echo "[4/4] Verifying migration..."
psql "$PG_URL" -c "
SELECT 'clients' as table_name, COUNT(*) as rows FROM clients
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'deals', COUNT(*) FROM deals
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'propositions', COUNT(*) FROM proposition_commerciales
ORDER BY table_name;
"

echo ""
echo "=== Migration complete ==="
echo ""
echo "IMPORTANT: Tables NOT migrated (V1-only, not in V2 schema):"
echo "  - cache, sessions (runtime data)"
echo "  - migrations (Laravel-specific)"
echo "  - sprints, sprint_task (removed in V2)"
echo "  - project_templates, project_template_tasks (removed in V2)"
echo "  - forecast_expense_entries, forecast_revenue_entries (replaced by forecast_expenses_v2)"
echo "  - calendar_event_imports (removed in V2)"
echo "  - time_entries (V1 format - V2 uses time_entries_v2 with different schema)"
echo ""
echo "NOTE: time_entries were NOT migrated because V2 uses a completely different"
echo "schema (weekly 'semaine' format vs daily 'date' format). If you need historical"
echo "time data, run the separate time_entries migration script."
