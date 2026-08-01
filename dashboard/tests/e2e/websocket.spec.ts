import { test, expect } from "@playwright/test";

/**
 * E2E tests for the WebSocket ping endpoint.
 *
 * Nitro serves WebSocket handlers from server/ws/ at /ws/{name}.
 * The server/ws/ping.ts handler is available at /ws/ping.
 *
 * Covers acceptance criteria:
 * - WebSocket connection test: verify WS connection is established at /ws/ping
 */

const WS_URL = "ws://localhost:3000/ws/ping";

test.describe("WebSocket Connection", () => {
  test("should establish a WebSocket connection and receive messages", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ connected: boolean; msgCount: number }>((resolve) => {
        const ws = new WebSocket(url);
        let msgs = 0;
        let opened = false;

        ws.onopen = () => {
          opened = true;
          // Wait to collect messages, then resolve
          setTimeout(() => {
            resolve({ connected: true, msgCount: msgs });
            ws.close();
          }, 1500);
        };

        ws.onmessage = () => {
          msgs++;
        };

        ws.onerror = () => {
          resolve({ connected: false, msgCount: 0 });
        };

        // Safety timeout
        setTimeout(() => {
          resolve({ connected: opened, msgCount: msgs });
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        }, 5000);
      });
    }, WS_URL);

    expect(result.connected).toBe(true);
    expect(result.msgCount).toBeGreaterThanOrEqual(1);
  });

  test("should receive a connected message with correct shape", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; timestamp?: string }>((resolve) => {
        const ws = new WebSocket(url);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            resolve(data);
          } catch {
            resolve({});
          }
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        };
        ws.onerror = () => {
          resolve({});
        };
        setTimeout(() => {
          resolve({});
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        }, 5000);
      });
    }, WS_URL);

    expect(result.type).toBe("connected");
    expect(typeof result.timestamp).toBe("string");
  });

  test("should echo a valid JSON message", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; data?: Record<string, unknown> }>(
        (resolve) => {
          const ws = new WebSocket(url);
          ws.onopen = () => {
            ws.send(JSON.stringify({ test: "hello" }));
          };
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "echo") {
                resolve(data);
                ws.close();
              }
            } catch {
              /* skip */
            }
          };
          ws.onerror = () => {
            resolve({});
          };
          setTimeout(() => {
            resolve({});
            try {
              ws.close();
            } catch {
              /* ignore */
            }
          }, 5000);
        },
      );
    }, WS_URL);

    expect(result.type).toBe("echo");
    expect(result.data?.test).toBe("hello");
  });

  test("should return error for invalid JSON", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; message?: string }>((resolve) => {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.send("not-json-at-all");
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "error") {
              resolve(data);
              ws.close();
            }
          } catch {
            /* skip */
          }
        };
        ws.onerror = () => {
          resolve({});
        };
        setTimeout(() => {
          resolve({});
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        }, 5000);
      });
    }, WS_URL);

    expect(result.type).toBe("error");
    expect(result.message).toBe("Invalid JSON");
  });
});
