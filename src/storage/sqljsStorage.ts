import { ILogger } from "@microsoft/teams.common";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { IDatabase } from "./database";
import { MessageRecord } from "./types";

export class SqlJsKVStore implements IDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private SQL: initSqlJs.SqlJsStatic | null = null;

  constructor(private logger: ILogger, dbPath?: string) {
    // Use environment variable if set, otherwise use provided dbPath, otherwise use default relative to project root
    this.dbPath = process.env.CONVERSATIONS_DB_PATH
      ? path.resolve(process.env.CONVERSATIONS_DB_PATH)
      : dbPath
        ? dbPath
        : path.resolve(__dirname, "../../src/storage/conversations.db");
  }

  async initialize(): Promise<void> {
    this.SQL = await initSqlJs();
    
    // Try to load existing database file
    if (fs.existsSync(this.dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(fileBuffer);
        this.logger.debug(`📂 Loaded existing database from ${this.dbPath}`);
      } catch (error) {
        this.logger.warn(`⚠️ Failed to load existing database, creating new one:`, error);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
      this.logger.debug(`📂 Created new in-memory database (will save to ${this.dbPath})`);
    }
    
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    if (!this.db) throw new Error("Database not initialized");
    
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        blob TEXT NOT NULL
      )
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_conversation_id ON conversations(conversation_id);
    `);
    this.db.run(`
    CREATE TABLE IF NOT EXISTS feedback (
    reply_to_id  TEXT    NOT NULL,
    reaction     TEXT    NOT NULL CHECK (reaction IN ('like','dislike')),
    feedback     TEXT,
    created_at   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );
    `);
    
    this.saveToFile();
  }

  private saveToFile(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to save database to file:`, error);
    }
  }

  clearAll(): void {
    if (!this.db) throw new Error("Database not initialized");
    this.db.run("DELETE FROM conversations");
    this.saveToFile();
    this.logger.debug("🧹 Cleared all conversations from SQLite store.");
  }

  get(conversationId: string): MessageRecord[] {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "SELECT blob FROM conversations WHERE conversation_id = ? ORDER BY timestamp ASC"
    );
    stmt.bind([conversationId]);
    
    const results: MessageRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { blob: string };
      results.push(JSON.parse(row.blob) as MessageRecord);
    }
    stmt.free();
    return results;
  }

  getMessagesByTimeRange(
    conversationId: string,
    startTime: string,
    endTime: string
  ): MessageRecord[] {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "SELECT blob FROM conversations WHERE conversation_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC"
    );
    stmt.bind([conversationId, startTime, endTime]);
    
    const results: MessageRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { blob: string };
      results.push(JSON.parse(row.blob) as MessageRecord);
    }
    stmt.free();
    return results;
  }

  getRecentMessages(conversationId: string, limit = 10): MessageRecord[] {
    const messages = this.get(conversationId);
    return messages.slice(-limit);
  }

  clearConversation(conversationId: string): void {
    if (!this.db) throw new Error("Database not initialized");
    this.db.run("DELETE FROM conversations WHERE conversation_id = ?", [conversationId]);
    this.saveToFile();
  }

  addMessages(messages: MessageRecord[]): void {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "INSERT INTO conversations (conversation_id, role, name, content, activity_id, timestamp, blob) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    
    for (const message of messages) {
      stmt.bind([
        message.conversation_id || "",
        message.role || "",
        message.name,
        message.content,
        message.activity_id || "",
        message.timestamp,
        JSON.stringify(message)
      ]);
      stmt.step();
      stmt.reset();
    }
    stmt.free();
    this.saveToFile();
  }

  countMessages(conversationId: string): number {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE conversation_id = ?"
    );
    stmt.bind([conversationId]);
    stmt.step();
    const result = stmt.getAsObject() as { count: number };
    stmt.free();
    return result.count;
  }

  clearAllMessages(): void {
    if (!this.db) throw new Error("Database not initialized");
    try {
      this.db.run("DELETE FROM conversations");
      this.saveToFile();
      this.logger.debug(`🧹 Cleared all conversations from database.`);
    } catch (error) {
      this.logger.error("❌ Error clearing all conversations:", error);
    }
  }

  getFilteredMessages(
    conversationId: string,
    keywords: string[],
    startTime: string,
    endTime: string,
    participants?: string[],
    maxResults?: number
  ): MessageRecord[] {
    if (!this.db) throw new Error("Database not initialized");
    
    const keywordClauses = keywords.map(() => `content LIKE ?`).join(" OR ");
    const participantClauses = participants?.map(() => `name LIKE ?`).join(" OR ");

    const whereClauses = [
      `conversation_id = ?`,
      `timestamp >= ?`,
      `timestamp <= ?`,
      `(${keywordClauses})`,
    ];

    const values: (string | number)[] = [
      conversationId,
      startTime,
      endTime,
      ...keywords.map((k) => `%${k.toLowerCase()}%`),
    ];

    if (participants && participants.length > 0) {
      whereClauses.push(`(${participantClauses})`);
      values.push(...participants.map((p) => `%${p.toLowerCase()}%`));
    }

    const limit = maxResults && typeof maxResults === "number" ? maxResults : 5;
    values.push(limit);

    const query = `
  SELECT blob FROM conversations
  WHERE ${whereClauses.join(" AND ")}
  ORDER BY timestamp DESC
  LIMIT ?
`;

    const stmt = this.db.prepare(query);
    stmt.bind(values);
    
    const results: MessageRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { blob: string };
      results.push(JSON.parse(row.blob) as MessageRecord);
    }
    stmt.free();
    return results;
  }

  recordFeedback(
    replyToId: string,
    reaction: "like" | "dislike" | string,
    feedbackJson?: unknown
  ): boolean {
    if (!this.db) throw new Error("Database not initialized");
    try {
      this.db.run(
        `INSERT INTO feedback (reply_to_id, reaction, feedback) VALUES (?, ?, ?)`,
        [replyToId, reaction, feedbackJson ? JSON.stringify(feedbackJson) : null]
      );
      this.saveToFile();
      return true;
    } catch (err) {
      this.logger.error(`❌ recordFeedback error:`, err);
      return false;
    }
  }

  close(): void {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
      this.logger.debug("🔌 Closed SQLite database connection");
    }
  }
}
