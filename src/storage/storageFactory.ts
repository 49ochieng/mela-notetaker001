import { ILogger } from "@microsoft/teams.common";
import { DATABASE_CONFIG, DatabaseConfig } from "../utils/config";
import { IDatabase } from "./database";
import { MssqlKVStore } from "./mssqlStorage";
import { SqlJsKVStore } from "./sqljsStorage";

export class StorageFactory {
  static async createStorage(logger: ILogger, config?: DatabaseConfig): Promise<IDatabase> {
    const dbConfig = config || DATABASE_CONFIG;
    let storage: IDatabase;

    if (dbConfig.type === "mssql") {
      try {
        logger.debug("🔧 Initializing MSSQL storage...");
        storage = new MssqlKVStore(logger.child("mssql"), dbConfig);
        await storage.initialize();
        logger.debug("✅ MSSQL storage initialized successfully");
        return storage;
      } catch (error) {
        logger.warn("⚠️ Failed to initialize MSSQL storage, falling back to SQLite:", error);
        // Fall back to SQLite
      }
    }

    // Use SQLite via sql.js (default or fallback)
    logger.debug("🔧 Initializing SQLite storage (sql.js)...");
    storage = new SqlJsKVStore(logger.child("sqlite"), dbConfig.sqlitePath);
    await storage.initialize();
    logger.debug("✅ SQLite storage initialized successfully");
    return storage;
  }
}
