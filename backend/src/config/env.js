import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const sessionSecret = process.env.SESSION_SECRET || "";
const port = Number(process.env.PORT || 5000);
const aiProvider = process.env.AI_PROVIDER || "gemini";
const allowedProviders = new Set(["gemini", "groq", "openai"]);

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

if (!allowedProviders.has(aiProvider)) {
  throw new Error("AI_PROVIDER must be gemini, groq, or openai");
}

if (process.env.CLIENT_ORIGIN) {
  try {
    new URL(process.env.CLIENT_ORIGIN);
  } catch {
    throw new Error("CLIENT_ORIGIN must be a valid URL");
  }
}

if (nodeEnv === "production") {
  const required = {
    DATABASE_URL: process.env.DATABASE_URL,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
    SESSION_SECRET: sessionSecret,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `Missing production environment variables: ${missing.join(", ")}`,
    );
  }

  if (sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET must contain at least 32 characters in production",
    );
  }

  const providerKeys = {
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };

  if (!providerKeys[aiProvider]) {
    throw new Error(
      `The API key for AI_PROVIDER=${aiProvider} is required in production`,
    );
  }
}

export const env = {
  nodeEnv,
  port,
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL === "true",
  databasePoolMax: positiveInteger("DATABASE_POOL_MAX", 10),
  sessionSecret: sessionSecret || "development-only-session-secret",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL || (
    nodeEnv === "production" ? "info" : "debug"
  ),
  apiRateLimit: positiveInteger("API_RATE_LIMIT", 300),
  authRateLimit: positiveInteger("AUTH_RATE_LIMIT", 10),
  aiRateLimit: positiveInteger("AI_RATE_LIMIT", 30),
  aiProvider,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
};
