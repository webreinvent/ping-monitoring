# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: websocket.spec.ts >> WebSocket Connection >> should establish a WebSocket connection and receive messages
- Location: tests/e2e/websocket.spec.ts:16:3

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1
Received:    0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - status [ref=e3]: LNPM Cloud Dashboard
    - generic [ref=e5]:
      - heading "Monitors" [level=2] [ref=e6]
      - paragraph [ref=e8]: Monitors will appear here once data is ingested.
  - generic [ref=e9]:
    - button "Toggle Nuxt DevTools" [ref=e10] [cursor=pointer]
    - generic "Page load time" [ref=e14]:
      - generic [ref=e15]: "8"
      - generic [ref=e16]: ms
    - button "Toggle Component Inspector" [ref=e18] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * E2E tests for the WebSocket ping endpoint.
  5   |  *
  6   |  * Nitro serves WebSocket handlers from server/ws/ at /ws/{name}.
  7   |  * The server/ws/ping.ts handler is available at /ws/ping.
  8   |  *
  9   |  * Covers acceptance criteria:
  10  |  * - WebSocket connection test: verify WS connection is established at /ws/ping
  11  |  */
  12  | 
  13  | const WS_URL = "ws://localhost:3000/ws/ping";
  14  | 
  15  | test.describe("WebSocket Connection", () => {
  16  |   test("should establish a WebSocket connection and receive messages", async ({
  17  |     page,
  18  |   }) => {
  19  |     await page.goto("/");
  20  | 
  21  |     const result = await page.evaluate((url) => {
  22  |       return new Promise<{ connected: boolean; msgCount: number }>((resolve) => {
  23  |         const ws = new WebSocket(url);
  24  |         let msgs = 0;
  25  |         let opened = false;
  26  | 
  27  |         ws.onopen = () => {
  28  |           opened = true;
  29  |           // Wait to collect messages, then resolve
  30  |           setTimeout(() => {
  31  |             resolve({ connected: true, msgCount: msgs });
  32  |             ws.close();
  33  |           }, 1500);
  34  |         };
  35  | 
  36  |         ws.onmessage = () => {
  37  |           msgs++;
  38  |         };
  39  | 
  40  |         ws.onerror = () => {
  41  |           resolve({ connected: false, msgCount: 0 });
  42  |         };
  43  | 
  44  |         // Safety timeout
  45  |         setTimeout(() => {
  46  |           resolve({ connected: opened, msgCount: msgs });
  47  |           try {
  48  |             ws.close();
  49  |           } catch {
  50  |             /* ignore */
  51  |           }
  52  |         }, 5000);
  53  |       });
  54  |     }, WS_URL);
  55  | 
  56  |     expect(result.connected).toBe(true);
> 57  |     expect(result.msgCount).toBeGreaterThanOrEqual(1);
      |                             ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  58  |   });
  59  | 
  60  |   test("should receive a connected message with correct shape", async ({
  61  |     page,
  62  |   }) => {
  63  |     await page.goto("/");
  64  | 
  65  |     const result = await page.evaluate((url) => {
  66  |       return new Promise<{ type?: string; timestamp?: string }>((resolve) => {
  67  |         const ws = new WebSocket(url);
  68  |         ws.onmessage = (event) => {
  69  |           try {
  70  |             const data = JSON.parse(event.data);
  71  |             resolve(data);
  72  |           } catch {
  73  |             resolve({});
  74  |           }
  75  |           try {
  76  |             ws.close();
  77  |           } catch {
  78  |             /* ignore */
  79  |           }
  80  |         };
  81  |         ws.onerror = () => {
  82  |           resolve({});
  83  |         };
  84  |         setTimeout(() => {
  85  |           resolve({});
  86  |           try {
  87  |             ws.close();
  88  |           } catch {
  89  |             /* ignore */
  90  |           }
  91  |         }, 5000);
  92  |       });
  93  |     }, WS_URL);
  94  | 
  95  |     expect(result.type).toBe("connected");
  96  |     expect(typeof result.timestamp).toBe("string");
  97  |   });
  98  | 
  99  |   test("should echo a valid JSON message", async ({ page }) => {
  100 |     await page.goto("/");
  101 | 
  102 |     const result = await page.evaluate((url) => {
  103 |       return new Promise<{ type?: string; data?: Record<string, unknown> }>(
  104 |         (resolve) => {
  105 |           const ws = new WebSocket(url);
  106 |           ws.onopen = () => {
  107 |             ws.send(JSON.stringify({ test: "hello" }));
  108 |           };
  109 |           ws.onmessage = (event) => {
  110 |             try {
  111 |               const data = JSON.parse(event.data);
  112 |               if (data.type === "echo") {
  113 |                 resolve(data);
  114 |                 ws.close();
  115 |               }
  116 |             } catch {
  117 |               /* skip */
  118 |             }
  119 |           };
  120 |           ws.onerror = () => {
  121 |             resolve({});
  122 |           };
  123 |           setTimeout(() => {
  124 |             resolve({});
  125 |             try {
  126 |               ws.close();
  127 |             } catch {
  128 |               /* ignore */
  129 |             }
  130 |           }, 5000);
  131 |         },
  132 |       );
  133 |     }, WS_URL);
  134 | 
  135 |     expect(result.type).toBe("echo");
  136 |     expect(result.data?.test).toBe("hello");
  137 |   });
  138 | 
  139 |   test("should return error for invalid JSON", async ({ page }) => {
  140 |     await page.goto("/");
  141 | 
  142 |     const result = await page.evaluate((url) => {
  143 |       return new Promise<{ type?: string; message?: string }>((resolve) => {
  144 |         const ws = new WebSocket(url);
  145 |         ws.onopen = () => {
  146 |           ws.send("not-json-at-all");
  147 |         };
  148 |         ws.onmessage = (event) => {
  149 |           try {
  150 |             const data = JSON.parse(event.data);
  151 |             if (data.type === "error") {
  152 |               resolve(data);
  153 |               ws.close();
  154 |             }
  155 |           } catch {
  156 |             /* skip */
  157 |           }
```