import bcrypt from "bcryptjs";
import { AppError } from "../../utils/app-error.js";
import * as authRepository from "./auth.repository.js";

export async function register(payload) {
  const existingUser = await authRepository.findByEmail(payload.email);

  if (existingUser) {
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  let user;

  try {
    user = await authRepository.create({
      name: payload.name,
      email: payload.email,
      passwordHash,
    });
  } catch (error) {
    throwDuplicateEmailError(error);
  }

  return toSessionUser(user);
}

export async function login(payload) {
  const user = await authRepository.findByEmail(payload.email);

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isValidPassword = await bcrypt.compare(payload.password, user.password_hash);

  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  return toSessionUser(user);
}

export async function updateProfile(userId, payload) {
  if (payload.email !== undefined) {
    const existingUser = await authRepository.findByEmail(payload.email);

    if (existingUser && existingUser.id !== userId) {
      throw new AppError("Email is already registered", 409);
    }
  }

  let user;

  try {
    user = await authRepository.updateProfile(userId, payload);
  } catch (error) {
    throwDuplicateEmailError(error);
  }

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return toSessionUser(user);
}

function toSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function throwDuplicateEmailError(error) {
  if (error.code === "23505") {
    throw new AppError("Email is already registered", 409);
  }

  throw error;
}
