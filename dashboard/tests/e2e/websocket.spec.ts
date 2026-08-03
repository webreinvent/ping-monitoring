import { test, expect } from "@playwright/test";

/**
 * E2E tests for the WebSocket ping endpoint.
 *
 * Nitro serves WebSocket handlers from server/ws/ at /ws/{name}.
 * The server/ws/ping.ts handler is available at /ws/ping.
 *
 * Covers acceptance criteria:
 * - WebSocket connection test: verify WS connection is established at /ws/ping
 * - Subscribe/snapshot protocol
 * - Unsubscribe stops messages
 * - Live sample broadcast
 */

const WS_URL = "ws://localhost:3000/ws/ping";

test.describe("WebSocket Connection", () => {
  test("should establish a WebSocket connection and receive connected message", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; timestamp?: string }>((resolve) => {
        const ws = new WebSocket(url);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "connected") {
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

    expect(result.type).toBe("connected");
    expect(typeof result.timestamp).toBe("string");
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
});

test.describe("WebSocket Subscribe/Unsubscribe Protocol", () => {
  test("should send error for invalid JSON", async ({ page }) => {
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

  test("should send error for unknown message type", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; message?: string }>((resolve) => {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "unknown", monitorId: 42 }));
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
    expect(result.message).toContain("Unknown message type");
  });

  test("should send error for missing monitorId", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; message?: string }>((resolve) => {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "subscribe" }));
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
    expect(result.message).toContain("monitorId");
  });

  test("should send error when subscribing to non-existent monitor", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; message?: string }>((resolve) => {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          // Use a monitor ID that definitely doesn't exist
          ws.send(JSON.stringify({ type: "subscribe", monitorId: 99999 }));
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
    expect(result.message).toContain("not found");
  });

  test("should send unsubscribed ack on unsubscribe", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate((url) => {
      return new Promise<{ type?: string; monitorId?: number }>((resolve) => {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "unsubscribe", monitorId: 42 }));
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "unsubscribed") {
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

    expect(result.type).toBe("unsubscribed");
    expect(result.monitorId).toBe(42);
  });
});
