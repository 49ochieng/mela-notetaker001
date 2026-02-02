import { ILogger } from "@microsoft/teams.common";
import * as mssql from "mssql";
import { DatabaseConfig } from "../utils/config";
import { IDatabase } from "./database";
import { MessageRecord } from "./types";

export class MssqlKVStore implements IDatabase {
  private pool: mssql.ConnectionPool | null = null;
  private isInitialized = false;

  constructor(private logger: ILogger, private config: DatabaseConfig) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Use connection string directly or individual config properties
      let sqlConfig: mssql.config;

      if (this.config.connectionString) {
        // When using connection string, pass it directly to ConnectionPool
        this.pool = new mssql.ConnectionPool(this.config.connectionString);
      } else {
        // Use individual config properties
        sqlConfig = {
          server: this.config.server!,
          database: this.config.database!,
          user: this.config.username!,
          password: this.config.password!,
          options: {
            encrypt: true,
            trustServerCertificate: false,
          },
        };
        this.pool = new mssql.ConnectionPool(sqlConfig);
      }
      await this.pool.connect();
      await this.initializeDatabase();
      this.isInitialized = true;
      this.logger.debug("✅ Connected to MSSQL database");
    } catch (error) {
      this.logger.error("❌ Error connecting to MSSQL database:", error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      // Create conversations table
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='conversations' AND xtype='U')
        BEGIN
          CREATE TABLE conversations (
            id INT IDENTITY(1,1) PRIMARY KEY,
            conversation_id NVARCHAR(255) NOT NULL,
            role NVARCHAR(50) NOT NULL,
            name NVARCHAR(255) NOT NULL,
            content NVARCHAR(MAX) NOT NULL,
            activity_id NVARCHAR(255) NOT NULL,
            timestamp NVARCHAR(50) NOT NULL,
            blob NVARCHAR(MAX) NOT NULL
          )
        END
      `);

      // Create index on conversation_id
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_conversation_id' AND object_id = OBJECT_ID('conversations'))
        BEGIN
          CREATE INDEX idx_conversation_id ON conversations(conversation_id)
        END
      `);

      // Create feedback table
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='feedback' AND xtype='U')
        BEGIN
          CREATE TABLE feedback (
            id INT IDENTITY(1,1) PRIMARY KEY,
            reply_to_id NVARCHAR(255) NOT NULL,
            reaction NVARCHAR(50) NOT NULL CHECK (reaction IN ('like','dislike')),
            feedback NVARCHAR(MAX),
            created_at DATETIME NOT NULL DEFAULT GETDATE()
          )
        END
      `);

      // Create meetings table for meeting intelligence
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='meetings' AND xtype='U')
        BEGIN
          CREATE TABLE meetings (
            id INT IDENTITY(1,1) PRIMARY KEY,
            meeting_id NVARCHAR(255) NOT NULL UNIQUE,
            conversation_id NVARCHAR(255),
            subject NVARCHAR(500),
            organizer_email NVARCHAR(255),
            organizer_name NVARCHAR(255),
            start_time DATETIME,
            end_time DATETIME,
            join_url NVARCHAR(MAX),
            has_transcript BIT DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT GETDATE(),
            updated_at DATETIME NOT NULL DEFAULT GETDATE()
          )
        END
      `);

      // Create meeting_transcripts table
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='meeting_transcripts' AND xtype='U')
        BEGIN
          CREATE TABLE meeting_transcripts (
            id INT IDENTITY(1,1) PRIMARY KEY,
            meeting_id NVARCHAR(255) NOT NULL,
            transcript_id NVARCHAR(255) NOT NULL,
            speaker_name NVARCHAR(255),
            content NVARCHAR(MAX),
            timestamp_start NVARCHAR(50),
            timestamp_end NVARCHAR(50),
            sequence_number INT,
            created_at DATETIME NOT NULL DEFAULT GETDATE()
          )
        END
      `);

      // Create meeting_notes table
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='meeting_notes' AND xtype='U')
        BEGIN
          CREATE TABLE meeting_notes (
            id INT IDENTITY(1,1) PRIMARY KEY,
            meeting_id NVARCHAR(255) NOT NULL,
            note_type NVARCHAR(50) NOT NULL,
            content NVARCHAR(MAX) NOT NULL,
            created_by NVARCHAR(255),
            created_at DATETIME NOT NULL DEFAULT GETDATE()
          )
        END
      `);

      // Create action_items table for tracking tasks
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='action_items' AND xtype='U')
        BEGIN
          CREATE TABLE action_items (
            id INT IDENTITY(1,1) PRIMARY KEY,
            meeting_id NVARCHAR(255),
            conversation_id NVARCHAR(255),
            title NVARCHAR(500) NOT NULL,
            description NVARCHAR(MAX),
            assignee_email NVARCHAR(255),
            assignee_name NVARCHAR(255),
            due_date DATETIME,
            status NVARCHAR(50) DEFAULT 'pending',
            planner_task_id NVARCHAR(255),
            created_at DATETIME NOT NULL DEFAULT GETDATE(),
            updated_at DATETIME NOT NULL DEFAULT GETDATE()
          )
        END
      `);

      // Create index on meeting_id for transcripts
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_transcript_meeting_id' AND object_id = OBJECT_ID('meeting_transcripts'))
        BEGIN
          CREATE INDEX idx_transcript_meeting_id ON meeting_transcripts(meeting_id)
        END
      `);

      this.logger.debug("✅ Database tables initialized");
    } catch (error) {
      this.logger.error("❌ Error initializing database tables:", error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      await this.pool.request().query("DELETE FROM conversations");
      this.logger.debug("🧹 Cleared all conversations from MSSQL store.");
    } catch (error) {
      this.logger.error("❌ Error clearing all conversations:", error);
      throw error;
    }
  }

  async get(conversationId: string): Promise<MessageRecord[]> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      const result = await this.pool
        .request()
        .input("conversationId", mssql.NVarChar, conversationId)
        .query(
          "SELECT blob FROM conversations WHERE conversation_id = @conversationId ORDER BY timestamp ASC"
        );

      return result.recordset.map((row) => JSON.parse(row.blob) as MessageRecord);
    } catch (error) {
      this.logger.error("❌ Error getting messages:", error);
      return [];
    }
  }

  async getMessagesByTimeRange(
    conversationId: string,
    startTime: string,
    endTime: string
  ): Promise<MessageRecord[]> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      const result = await this.pool
        .request()
        .input("conversationId", mssql.NVarChar, conversationId)
        .input("startTime", mssql.NVarChar, startTime)
        .input("endTime", mssql.NVarChar, endTime).query(`
          SELECT blob FROM conversations 
          WHERE conversation_id = @conversationId 
            AND timestamp >= @startTime 
            AND timestamp <= @endTime 
          ORDER BY timestamp ASC
        `);

      return result.recordset.map((row) => JSON.parse(row.blob) as MessageRecord);
    } catch (error) {
      this.logger.error("❌ Error getting messages by time range:", error);
      return [];
    }
  }

  async getRecentMessages(conversationId: string, limit = 10): Promise<MessageRecord[]> {
    const messages = await this.get(conversationId);
    return messages.slice(-limit);
  }

  async clearConversation(conversationId: string): Promise<void> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      await this.pool
        .request()
        .input("conversationId", mssql.NVarChar, conversationId)
        .query("DELETE FROM conversations WHERE conversation_id = @conversationId");
    } catch (error) {
      this.logger.error("❌ Error clearing conversation:", error);
      throw error;
    }
  }

  async addMessages(messages: MessageRecord[]): Promise<void> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      const transaction = new mssql.Transaction(this.pool);
      await transaction.begin();

      try {
        for (const message of messages) {
          await transaction
            .request()
            .input("conversationId", mssql.NVarChar, message.conversation_id)
            .input("role", mssql.NVarChar, message.role)
            .input("name", mssql.NVarChar, message.name)
            .input("content", mssql.NVarChar, message.content)
            .input("activityId", mssql.NVarChar, message.activity_id)
            .input("timestamp", mssql.NVarChar, message.timestamp)
            .input("blob", mssql.NVarChar, JSON.stringify(message)).query(`
              INSERT INTO conversations (conversation_id, role, name, content, activity_id, timestamp, blob)
              VALUES (@conversationId, @role, @name, @content, @activityId, @timestamp, @blob)
            `);
        }

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error("❌ Error adding messages:", error);
      throw error;
    }
  }

  async countMessages(conversationId: string): Promise<number> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      const result = await this.pool
        .request()
        .input("conversationId", mssql.NVarChar, conversationId)
        .query(
          "SELECT COUNT(*) as count FROM conversations WHERE conversation_id = @conversationId"
        );

      return result.recordset[0].count;
    } catch (error) {
      this.logger.error("❌ Error counting messages:", error);
      return 0;
    }
  }

  async clearAllMessages(): Promise<void> {
    await this.clearAll();
  }

  async getFilteredMessages(
    conversationId: string,
    keywords: string[],
    startTime: string,
    endTime: string,
    participants?: string[],
    maxResults = 5
  ): Promise<MessageRecord[]> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      const request = this.pool.request();

      // Build dynamic query
      let whereClause =
        "conversation_id = @conversationId AND timestamp >= @startTime AND timestamp <= @endTime";
      request.input("conversationId", mssql.NVarChar, conversationId);
      request.input("startTime", mssql.NVarChar, startTime);
      request.input("endTime", mssql.NVarChar, endTime);
      request.input("maxResults", mssql.Int, maxResults);

      // Add keyword filters
      if (keywords.length > 0) {
        const keywordConditions = keywords
          .map((_, index) => {
            request.input(`keyword${index}`, mssql.NVarChar, `%${keywords[index].toLowerCase()}%`);
            return `content LIKE @keyword${index}`;
          })
          .join(" OR ");
        whereClause += ` AND (${keywordConditions})`;
      }

      // Add participant filters
      if (participants && participants.length > 0) {
        const participantConditions = participants
          .map((_, index) => {
            request.input(
              `participant${index}`,
              mssql.NVarChar,
              `%${participants[index].toLowerCase()}%`
            );
            return `name LIKE @participant${index}`;
          })
          .join(" OR ");
        whereClause += ` AND (${participantConditions})`;
      }

      const query = `
        SELECT TOP (@maxResults) blob FROM conversations
        WHERE ${whereClause}
        ORDER BY timestamp DESC
      `;

      const result = await request.query(query);
      return result.recordset.map((row) => JSON.parse(row.blob) as MessageRecord);
    } catch (error) {
      this.logger.error("❌ Error getting filtered messages:", error);
      return [];
    }
  }

  async recordFeedback(
    replyToId: string,
    reaction: "like" | "dislike" | string,
    feedbackJson?: unknown
  ): Promise<boolean> {
    if (!this.pool) throw new Error("Database not connected");

    try {
      await this.pool
        .request()
        .input("replyToId", mssql.NVarChar, replyToId)
        .input("reaction", mssql.NVarChar, reaction)
        .input("feedback", mssql.NVarChar, feedbackJson ? JSON.stringify(feedbackJson) : null)
        .query(`
          INSERT INTO feedback (reply_to_id, reaction, feedback)
          VALUES (@replyToId, @reaction, @feedback)
        `);

      return true;
    } catch (error) {
      this.logger.error("❌ Error recording feedback:", error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      this.isInitialized = false;
      this.logger.debug("🔌 Closed MSSQL database connection");
    }
  }
}
