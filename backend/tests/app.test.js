import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { app } from "../src/app.js";

test("health endpoint returns ok", async () => {
  const response = await request(app, {
    method: "GET",
    path: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: "ok" });
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.ok(response.headers["x-request-id"]);
});

test("protected topic, note, and AI endpoints require authentication", async () => {
  const topicResponse = await request(app, {
    method: "GET",
    path: "/api/v1/topics",
  });
  const noteResponse = await request(app, {
    method: "GET",
    path: "/api/v1/topics/1/notes",
  });
  const aiResponse = await request(app, {
    method: "POST",
    path: "/api/v1/topics/1/ai/chat",
  });
  const historyResponse = await request(app, {
    method: "GET",
    path: "/api/v1/study-history",
  });

  assert.equal(topicResponse.statusCode, 401);
  assert.equal(topicResponse.body.message, "Authentication required");
  assert.equal(noteResponse.statusCode, 401);
  assert.equal(noteResponse.body.message, "Authentication required");
  assert.equal(aiResponse.statusCode, 401);
  assert.equal(aiResponse.body.message, "Authentication required");
  assert.equal(historyResponse.statusCode, 401);
  assert.equal(historyResponse.body.message, "Authentication required");
});

function request(expressApp, options) {
  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          method: options.method,
          path: options.path,
        },
        (res) => {
          let rawBody = "";

          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            rawBody += chunk;
          });
          res.on("end", () => {
            server.close(() => {
              resolve({
                statusCode: res.statusCode,
                body: rawBody ? JSON.parse(rawBody) : null,
                headers: res.headers,
              });
            });
          });
        },
      );

      req.on("error", (error) => {
        server.close(() => reject(error));
      });
      req.end();
    });
  });
}
