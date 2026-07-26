import { asyncHandler } from "../../utils/async-handler.js";
import * as authService from "./auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.validated.body);
  await regenerateSession(req);
  req.session.user = user;
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const user = await authService.login(req.validated.body);
  await regenerateSession(req);
  req.session.user = user;
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  await destroySession(req);
  res.clearCookie("sid");
  res.status(204).send();
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.session?.user || null });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(
    req.session.user.id,
    req.validated.body,
  );

  req.session.user = user;
  res.json({ user });
});

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
