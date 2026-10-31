import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rabbitSessions = sqliteTable(
  "rabbit_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    displayName: text("display_name").notNull(),
    variant: text("variant").notNull(),
    roomId: text("room_id").notNull().default("main"),
    x: real("x").notNull().default(0),
    z: real("z").notNull().default(10),
    rotation: real("rotation").notNull().default(0),
    state: text("state").notNull().default("walking"),
    seatId: text("seat_id"),
    tea: text("tea"),
    teaware: text("teaware"),
    ritual: text("ritual").notNull().default("idle"),
    actionStartedAt: integer("action_started_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("rabbit_sessions_room_updated_idx").on(table.roomId, table.updatedAt)],
);

export const roomSeats = sqliteTable(
  "room_seats",
  {
    seatId: text("seat_id").primaryKey(),
    roomId: text("room_id").notNull().default("main"),
    sessionId: text("session_id").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("room_seats_session_idx").on(table.sessionId)],
);
