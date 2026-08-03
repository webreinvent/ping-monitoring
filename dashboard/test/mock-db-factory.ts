/**
 * Factory that creates a mock Database class usable in place of better-sqlite3.
 * Exposes a function that returns a class, so vi.mock can use it:
 *
 *   vi.mock("better-sqlite3", () => {
 *     const { createMockDb } = require("~/test/mock-db-factory");
 *     return { default: createMockDb };
 *   });
 */

// ============================================================================
// Types
// ============================================================================

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
}

interface Table {
  columns: Column[];
  rows: Record<string, any>[];
  autoInc: Map<string, number>;
  indexes: { name: string; unique: boolean; columns: string[] }[];
}

// ============================================================================
// Parameter binding
// ============================================================================

type Params = Record<string, any> | any[] | any;

// ============================================================================
// Simple SQL parser
// ============================================================================

function parseCreateTable(sql: string): { tableName: string; columns: Column[]; constraints: string[] } | null {
  const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*)\)/is);
  if (!match) return null;

  const tableName = match[1];
  const body = match[2];

  // Split column definitions by comma, but respect parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  const columns: Column[] = [];
  const constraints: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith("PRIMARY KEY") || trimmed.startsWith("UNIQUE") || trimmed.startsWith("CHECK") || trimmed.startsWith("FOREIGN KEY")) {
      constraints.push(trimmed);
      continue;
    }
    if (!trimmed) continue;

    // Parse column definition
    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 2) continue;

    const name = tokens[0].replace(/["']/g, "");
    const type = tokens[1].toUpperCase();
    let nullable = true;
    let defaultValue: any = null;

    const rest = tokens.slice(2).join(" ").toUpperCase();
    if (rest.includes("NOT NULL")) nullable = false;
    if (rest.includes("DEFAULT")) {
      const defMatch = rest.match(/DEFAULT\s+(.+)/);
      if (defMatch) {
        const raw = defMatch[1].trim();
        if (raw === "NULL") defaultValue = null;
        else if (raw === "TRUE") defaultValue = 1;
        else if (raw === "FALSE") defaultValue = 0;
        else if (!isNaN(Number(raw))) defaultValue = Number(raw);
        else defaultValue = raw.replace(/["']/g, "");
      }
    }

    columns.push({ name, type, nullable, defaultValue });
  }

  return { tableName, columns, constraints };
}

function parseInsert(sql: string): { tableName: string; columns: string[]; orIgnore: boolean } | null {
  const match = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)/is);
  if (!match) return null;
  return {
    tableName: match[1],
    columns: match[2].split(",").map(c => c.trim()),
    orIgnore: sql.includes("OR IGNORE"),
  };
}

function parseSelect(sql: string): { table: string; where: string; groupBy: string; orderBy: string; selectCols: string[] } | null {
  const match = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)/is);
  if (!match) return null;

  let remaining = sql.substring(match.index! + match[0].length);
  const whereMatch = remaining.match(/\bWHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|$)/is);
  const groupByMatch = remaining.match(/\bGROUP\s+BY\s+(.+?)(?:\s+ORDER\s+BY|$)/is);
  const orderByMatch = remaining.match(/\bORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/is);

  return {
    table: match[2],
    selectCols: match[1].trim() === "*" ? [] : match[1].split(",").map(c => c.trim()),
    where: whereMatch ? whereMatch[1].trim() : "",
    groupBy: groupByMatch ? groupByMatch[1].trim() : "",
    orderBy: orderByMatch ? orderByMatch[1].trim() : "",
  };
}

function parseUpdate(sql: string): { table: string; setClause: string; where: string } | null {
  const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is);
  if (!match) return null;
  return {
    table: match[1],
    setClause: match[2].trim(),
    where: match[3] ? match[3].trim() : "",
  };
}

function parseDelete(sql: string): { table: string; where: string } | null {
  const match = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/is);
  if (!match) return null;
  return { table: match[1], where: match[2] ? match[2].trim() : "" };
}

// ============================================================================
// Eval helpers for WHERE clauses
// ============================================================================

/**
 * Replace :paramName references in a SQL WHERE clause with their actual values.
 */
function bindNamedParams(sql: string, params: Record<string, any>): string {
  return sql.replace(/:(\w+)/g, (_match, key) => {
    const val = params[key];
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "string") return `'${val}'`;
    return String(val);
  });
}

function evalCondition(where: string, row: Record<string, any>): boolean {
  if (!where || !where.trim()) return true;

  let condition = where;

  // Replace column = :param patterns (already bound in SQL)
  const parts = condition.split(/\s+AND\s+/i);
  for (const part of parts) {
    const trimmed = part.trim();

    // Handle > < >= <=
    const cmpMatch = trimmed.match(/(\w+)\s*(>=|<=|>|<)\s*(.+)/);
    if (cmpMatch) {
      const col = cmpMatch[1];
      const op = cmpMatch[2];
      const val = evalValue(cmpMatch[3], row);
      const rowVal = row[col];
      if (op === ">") if (rowVal <= val) return false;
      if (op === "<") if (rowVal >= val) return false;
      if (op === ">=") if (rowVal < val) return false;
      if (op === "<=") if (rowVal > val) return false;
      continue;
    }

    // Handle =
    const eqMatch = trimmed.match(/(\w+)\s*=\s*(.+)/);
    if (eqMatch) {
      const col = eqMatch[1];
      const val = evalValue(eqMatch[2], row);
      if (row[col] !== val) return false;
      continue;
    }

    // Handle != or <>
    const neMatch = trimmed.match(/(\w+)\s*(?:!=|<>)\s*(.+)/);
    if (neMatch) {
      const col = neMatch[1];
      const val = evalValue(neMatch[2], row);
      if (row[col] === val) return false;
      continue;
    }

    // Handle IS NULL / IS NOT NULL
    if (trimmed.includes("IS NULL")) {
      const col = trimmed.replace(/\s*IS\s+NULL$/i, "").trim();
      if (row[col] !== null && row[col] !== undefined) return false;
      continue;
    }
    if (trimmed.includes("IS NOT NULL")) {
      const col = trimmed.replace(/\s*IS\s+NOT\s+NULL$/i, "").trim();
      if (row[col] === null || row[col] === undefined) return false;
      continue;
    }
  }

  return true;
}

function evalValue(expr: string, _row: Record<string, any>): any {
  const trimmed = expr.trim();
  if (trimmed === "NULL") return null;
  if (trimmed === "TRUE") return 1;
  if (trimmed === "FALSE") return 0;
  if (!isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed.replace(/["']/g, "");
}

// ============================================================================
// Database Class
// ============================================================================

class MockDatabase {
  private tables: Map<string, Table> = new Map();
  private closed = false;

  constructor(_path: string) {
    // ":memory:" or file path — we only support in-memory
  }

  close() {
    this.closed = true;
  }

  exec(sql: string) {
    const statements = sql.split(";").filter(s => s.trim());
    for (const stmt of statements) {
      this.execute(stmt.trim());
    }
  }

  private execute(sql: string) {
    if (sql.startsWith("CREATE")) {
      const parsed = parseCreateTable(sql);
      if (parsed) {
        if (!this.tables.has(parsed.tableName)) {
          this.tables.set(parsed.tableName, {
            columns: parsed.columns,
            rows: [],
            autoInc: new Map(),
            indexes: [],
          });

          // Parse table-level UNIQUE constraints
          const uniqueMatches = parsed.constraints.filter(c => c.startsWith("UNIQUE"));
          for (const uc of uniqueMatches) {
            const colMatch = uc.match(/UNIQUE\(([^)]+)\)/);
            if (colMatch) {
              const cols = colMatch[1].split(",").map(c => c.trim());
              const table = this.tables.get(parsed.tableName)!;
              table.indexes.push({ name: `uq_${cols.join("_")}`, unique: true, columns: cols });
            }
          }
        }
      }
    }
  }

  prepare(sql: string) {
    return new MockStatement(this, sql);
  }

  transaction(fn: () => void | any) {
    return () => fn();
  }
}

// ============================================================================
// Statement Class
// ============================================================================

class MockStatement {
  private db: MockDatabase;
  private sql: string;

  constructor(db: MockDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  all(...params: Params[]): Record<string, any>[] {
    const trimmed = this.sql.trim().toUpperCase();

    if (trimmed.startsWith("SELECT")) {
      return this.executeSelect(params);
    }
    return [];
  }

  get(...params: Params[]): Record<string, any> | undefined {
    const rows = this.all(...params);
    return rows.length > 0 ? rows[0] : undefined;
  }

  run(...params: Params[]): { changes: number; lastInsertRowid: number } {
    const trimmed = this.sql.trim().toUpperCase();

    if (trimmed.startsWith("INSERT")) {
      return this.executeInsert(params);
    }
    if (trimmed.startsWith("UPDATE")) {
      return this.executeUpdate(params);
    }
    if (trimmed.startsWith("DELETE")) {
      return this.executeDelete(params);
    }
    if (trimmed.startsWith("CREATE")) {
      this.db.execute(this.sql);
      return { changes: 0, lastInsertRowid: 0 };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  private executeSelect(params: Params[]): Record<string, any>[] {
    const parsed = parseSelect(this.sql);
    if (!parsed) return [];

    const table = this.db.tables.get(parsed.table);
    if (!table) return [];

    // Bind named parameters in WHERE clause
    let where = parsed.where;
    if (params.length === 1 && typeof params[0] === "object" && !Array.isArray(params[0])) {
      where = bindNamedParams(where, params[0] as Record<string, any>);
    } else if (params.length > 0) {
      // Bind positional ? parameters
      let posIdx = 0;
      where = where.replace(/\?/g, () => {
        const val = params[posIdx++];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "string") return `'${val}'`;
        return String(val);
      });
    }

    let rows = table.rows.filter(row => {
      if (!where) return true;
      return evalCondition(where, row);
    });

    // Handle GROUP BY with aggregation
    if (parsed.groupBy) {
      return this.executeGroupBy(table, rows, parsed, params);
    }

    // Apply ORDER BY
    if (parsed.orderBy) {
      const [col, dir] = parsed.orderBy.split(/\s+/);
      rows = [...rows].sort((a, b) => {
        const aVal = a[col.trim()];
        const bVal = b[col.trim()];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return dir.toUpperCase().includes("DESC") ? bVal - aVal : aVal - bVal;
        }
        return String(aVal).localeCompare(String(bVal));
      });
    }

    // Project columns (for non-* selects)
    if (parsed.selectCols.length > 0) {
      return rows.map(row => {
        const result: Record<string, any> = {};
        for (const col of parsed.selectCols) {
          const alias = col.match(/AS\s+(\w+)$/i);
          const key = alias ? alias[1] : col.trim();
          result[key] = row[key] ?? null;
        }
        return result;
      });
    }

    return rows;
  }

  private executeGroupBy(
    _table: Table,
    rows: Record<string, any>[],
    parsed: { table: string; where: string; groupBy: string; orderBy: string; selectCols: string[] },
    params?: Params,
  ): Record<string, any>[] {
    const selectCols = parsed.selectCols;

    // Detect aggregation functions
    const aggCols: { expr: string; alias: string; fn: string; col: string }[] = [];

    for (const col of selectCols) {
      const trimmed = col.trim();
      const alias = trimmed.match(/AS\s+(\w+)$/i);
      const aliasName = alias ? alias[1] : trimmed;

      if (trimmed.match(/^COUNT\(/i)) {
        const inner = trimmed.match(/COUNT\((.+)\)/i);
        aggCols.push({ expr: trimmed, alias: aliasName, fn: "count", col: inner ? inner[1].trim() : "*" });
      } else if (trimmed.match(/^SUM\(/i)) {
        const inner = trimmed.match(/SUM\((.+?)\)/i);
        aggCols.push({ expr: trimmed, alias: aliasName, fn: "sum", col: inner ? inner[1].trim() : "" });
      } else if (trimmed.match(/^AVG\(/i)) {
        const inner = trimmed.match(/AVG\((.+?)\)/i);
        aggCols.push({ expr: trimmed, alias: aliasName, fn: "avg", col: inner ? inner[1].trim() : "" });
      } else if (trimmed.match(/^MIN\(/i)) {
        const inner = trimmed.match(/MIN\((.+?)\)/i);
        aggCols.push({ expr: trimmed, alias: aliasName, fn: "min", col: inner ? inner[1].trim() : "" });
      } else if (trimmed.match(/^MAX\(/i)) {
        const inner = trimmed.match(/MAX\((.+?)\)/i);
        aggCols.push({ expr: trimmed, alias: aliasName, fn: "max", col: inner ? inner[1].trim() : "" });
      } else if (trimmed.match(/^CAST\(/i)) {
        // Group-by column (e.g. CAST(floor(timestamp_ms / ...) ...))
        // Extract the alias
        const aliasFromCast = aliasName;
        aggCols.push({ expr: trimmed, alias: aliasFromCast, fn: "groupby", col: aliasFromCast });
      }
    }

    // Group rows by the GROUP BY column
    const groups: Map<string, Record<string, any>[]> = new Map();

    // Bind named parameters in GROUP BY clause
    let groupBy = parsed.groupBy;
    if (params.length === 1 && typeof params[0] === "object" && !Array.isArray(params[0])) {
      groupBy = bindNamedParams(groupBy, params[0] as Record<string, any>);
    }

    // Extract bucketMs from GROUP BY clause: CAST(floor(timestamp_ms / <number>) * <number> AS INTEGER)
    const bucketMatch = groupBy.match(/timestamp_ms\s*\/\s*(\d+)/);
    const bucketMs = bucketMatch ? Number(bucketMatch[1]) : 0;

    for (const row of rows) {
      // Group by timestamp_ms bucket value
      let groupKey: string;
      if (bucketMs > 0) {
        // Compute floor(timestamp_ms / bucketMs) * bucketMs
        groupKey = String(Math.floor(row.timestamp_ms / bucketMs) * bucketMs);
      } else {
        groupKey = String(row.timestamp_ms);
      }

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(row);
    }

    // Compute aggregates
    const result: Record<string, any>[] = [];
    for (const [key, groupRows] of groups) {
      const row: Record<string, any> = {};
      row.timestamp_ms = Number(key);

      for (const agg of aggCols) {
        let value: any;
        switch (agg.fn) {
          case "groupby":
            // The group key itself
            value = Number(key);
            break;
          case "count":
            value = agg.col === "*" ? groupRows.length : groupRows.filter(r => {
              if (agg.col.includes("CASE")) {
                if (agg.col.includes("status = 'success'")) return r.status === "success";
                if (agg.col.includes("status != 'success'")) return r.status !== "success";
                if (agg.col.includes("latency_ms IS NOT NULL")) return r.latency_ms !== null;
              }
              return true;
            }).length;
            break;
          case "sum": {
            value = groupRows.reduce((s, r) => {
              if (agg.col.includes("CASE")) {
                if (agg.col.includes("status = 'success'")) return s + (r.status === "success" ? 1 : 0);
                if (agg.col.includes("status != 'success'")) return s + (r.status !== "success" ? 1 : 0);
              }
              return s + (r[agg.col] ?? 0);
            }, 0);
            break;
          }
          case "avg": {
            const vals: number[] = [];
            for (const r of groupRows) {
              if (agg.col.includes("CASE")) {
                if (agg.col.includes("latency_ms IS NOT NULL") && r.latency_ms !== null) {
                  vals.push(r.latency_ms);
                }
              } else {
                if (r[agg.col] !== null) vals.push(r[agg.col]);
              }
            }
            value = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
            break;
          }
          case "min": {
            const vals = groupRows.map(r => r[agg.col]).filter(v => v !== null);
            value = vals.length > 0 ? Math.min(...vals) : null;
            break;
          }
          case "max": {
            const vals = groupRows.map(r => r[agg.col]).filter(v => v !== null);
            value = vals.length > 0 ? Math.max(...vals) : null;
            break;
          }
        }
        row[agg.alias] = value;
      }

      result.push(row);
    }

    // ORDER BY timestamp_ms ASC
    result.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    return result;
  }

  private executeInsert(params: Params[]): { changes: number; lastInsertRowid: number } {
    const parsed = parseInsert(this.sql);
    if (!parsed) return { changes: 0, lastInsertRowid: 0 };

    const table = this.db.tables.get(parsed.tableName);
    if (!table) return { changes: 0, lastInsertRowid: 0 };

    // Extract values from SQL
    const valMatch = this.sql.match(/VALUES\s*\((.+?)\)\s*$/is);
    if (!valMatch) return { changes: 0, lastInsertRowid: 0 };

    const rawValues = valMatch[1];
    const values = this.extractValues(rawValues, params);

    if (values.length < parsed.columns.length) {
      return { changes: 0, lastInsertRowid: 0 };
    }

    // Build row
    const row: Record<string, any> = {};
    for (let i = 0; i < parsed.columns.length; i++) {
      const col = parsed.columns[i];
      const val = values[i];
      const colDef = table.columns.find(c => c.name === col);

      if (colDef) {
        if (val === "?" || val === undefined) {
          row[col] = colDef.defaultValue ?? null;
        } else {
          row[col] = val;
        }
      } else {
        row[col] = val;
      }
    }

    // Handle AUTOINCREMENT for id column
    if (table.autoInc.has("id") || (table.columns[0]?.name === "id" && table.columns[0]?.type === "INTEGER")) {
      if (row.id === undefined || row.id === null) {
        const current = table.autoInc.get("id") ?? 0;
        row.id = current + 1;
        table.autoInc.set("id", row.id);
      }
    }

    // Check UNIQUE constraints
    for (const idx of table.indexes) {
      if (idx.unique) {
        const existing = table.rows.find(r => {
          return idx.columns.every(col => r[col] === row[col]);
        });
        if (existing) {
          if (parsed.orIgnore) {
            return { changes: 0, lastInsertRowid: row.id ?? 0 };
          }
          throw new Error(`UNIQUE constraint failed on ${idx.columns.join(", ")}`);
        }
      }
    }

    table.rows.push(row);
    return { changes: 1, lastInsertRowid: row.id ?? 0 };
  }

  private extractValues(raw: string, params: Params[]): any[] {
    // Split by comma, but handle nested parentheses
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of raw) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());

    // Positional parameter index
    let posIdx = 0;

    return parts.map(p => {
      const trimmed = p.trim();
      if (trimmed === "?") {
        // Positional parameter: use next value from params array
        if (params.length > posIdx) {
          const val = params[posIdx++];
          return val;
        }
        return null;
      }
      if (trimmed === "NULL") return null;
      if (trimmed === "TRUE") return 1;
      if (trimmed === "FALSE") return 0;
      if (!isNaN(Number(trimmed))) return Number(trimmed);
      return trimmed.replace(/["']/g, "");
    });
  }

  private executeUpdate(params: Params[]): { changes: number; lastInsertRowid: number } {
    const parsed = parseUpdate(this.sql);
    if (!parsed) return { changes: 0, lastInsertRowid: 0 };

    const table = this.db.tables.get(parsed.table);
    if (!table) return { changes: 0, lastInsertRowid: 0 };

    // Bind named parameters in WHERE clause (same as SELECT)
    let where = parsed.where;
    if (params.length === 1 && typeof params[0] === "object" && !Array.isArray(params[0])) {
      where = bindNamedParams(where, params[0] as Record<string, any>);
    } else if (params.length > 0) {
      // For positional params in UPDATE: first params bind the SET values, last param(s) bind WHERE
      // We need to figure out which params are SET values and which are WHERE params
      // Count ? in SET clause and WHERE clause separately
      const setClause = parsed.setClause;
      const setParamCount = (setClause.match(/\?/g) || []).length;
      const whereParamCount = (parsed.where.match(/\?/g) || []).length;

      // SET params are the first setParamCount positional params
      // WHERE params are the remaining
      const setParams = params.slice(0, setParamCount);
      const whereParams = params.slice(setParamCount);

      // Bind ? in SET clause with positional params
      let posIdx = 0;
      let setClauseBound = setClause.replace(/\?/g, () => {
        const val = setParams[posIdx++];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "string") return `'${val}'`;
        return String(val);
      });

      // Bind ? in WHERE clause with remaining positional params
      posIdx = 0;
      where = where.replace(/\?/g, () => {
        const val = whereParams[posIdx++];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "string") return `'${val}'`;
        return String(val);
      });

      // Now parse the bound SET clause
      const setParts = setClauseBound.split(",").map(p => p.trim());
      const updates: Record<string, any> = {};
      for (const part of setParts) {
        const eqIdx = part.indexOf("=");
        if (eqIdx === -1) continue;
        const col = part.substring(0, eqIdx).trim();
        const val = part.substring(eqIdx + 1).trim();
        if (col) {
          updates[col] = evalValue(val, {});
        }
      }

      let changes = 0;
      for (const row of table.rows) {
        if (evalCondition(where, row)) {
          for (const [col, val] of Object.entries(updates)) {
            row[col] = val;
          }
          changes++;
        }
      }

      return { changes, lastInsertRowid: 0 };
    }

    // Fallback: no params (original behavior)
    const setParts = parsed.setClause.split(",").map(p => p.trim());
    const updates: Record<string, any> = {};
    for (const part of setParts) {
      const [col, val] = part.split("=").map(s => s.trim());
      if (col) {
        updates[col] = evalValue(val, {});
      }
    }

    let changes = 0;
    for (const row of table.rows) {
      if (evalCondition(where, row)) {
        for (const [col, val] of Object.entries(updates)) {
          row[col] = val;
        }
        changes++;
      }
    }

    return { changes, lastInsertRowid: 0 };
  }

  private executeDelete(params: Params[]): { changes: number; lastInsertRowid: number } {
    const parsed = parseDelete(this.sql);
    if (!parsed) return { changes: 0, lastInsertRowid: 0 };

    const table = this.db.tables.get(parsed.table);
    if (!table) return { changes: 0, lastInsertRowid: 0 };

    const before = table.rows.length;
    table.rows = table.rows.filter(row => !evalCondition(parsed.where, row));
    return { changes: before - table.rows.length, lastInsertRowid: 0 };
  }
}

// ============================================================================
// Export
// ============================================================================

export function createMockDb() {
  return MockDatabase;
}

export default MockDatabase;
