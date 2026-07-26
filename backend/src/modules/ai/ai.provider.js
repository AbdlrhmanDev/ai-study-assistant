import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import OpenAI from "openai";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";

const providers = {
  gemini: generateWithGemini,
  groq: generateWithGroq,
  openai: generateWithOpenAI,
};

function requireApiKey(apiKey, variableName) {
  if (!apiKey) {
    throw new AppError(`${variableName} is not configured`, 503);
  }
}

async function generateWithGemini(instructions, input) {
  requireApiKey(env.geminiApiKey, "GEMINI_API_KEY");
  const client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  const response = await client.models.generateContent({
    model: env.geminiModel,
    contents: input,
    config: {
      systemInstruction: instructions,
    },
  });

  return {
    text: response.text,
    model: env.geminiModel,
  };
}

async function generateWithGroq(instructions, input) {
  requireApiKey(env.groqApiKey, "GROQ_API_KEY");
  const client = new Groq({ apiKey: env.groqApiKey });
  const response = await client.chat.completions.create({
    model: env.groqModel,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
  });

  return {
    text: response.choices[0]?.message?.content,
    model: response.model || env.groqModel,
  };
}

async function generateWithOpenAI(instructions, input) {
  requireApiKey(env.openaiApiKey, "OPENAI_API_KEY");
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await client.responses.create({
    model: env.openaiModel,
    instructions,
    input,
  });

  return {
    text: response.output_text,
    model: env.openaiModel,
  };
}

export async function generateTutorAnswer(instructions, input) {
  const generate = providers[env.aiProvider];

  if (!generate) {
    throw new AppError(
      "AI_PROVIDER must be gemini, groq, or openai",
      503,
    );
  }

  const result = await generate(instructions, input);

  return {
    ...result,
    provider: env.aiProvider,
  };
}
