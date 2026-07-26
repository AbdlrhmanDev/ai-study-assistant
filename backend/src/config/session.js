import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import { env } from "./env.js";
import { pool } from "../db/pool.js";

const PostgresSessionStore = connectPgSimple(session);

export const sessionMiddleware = session({
  name: env.nodeEnv === "production" ? "__Host-sid" : "sid",
  secret: env.sessionSecret,
  store: new PostgresSessionStore({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true,
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
