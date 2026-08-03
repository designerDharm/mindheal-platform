import { createServer } from "node:http";
import { appConfig } from "./config/app.js";
import { createApp } from "./app.js";
import { initializeSockets } from "./socket.js";

const app = createApp();

const server = createServer((req, res) => {
  app.handle(req, res).catch((error) => {
    console.error(error);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }));
  });
});

const io = initializeSockets(server);

server.listen(appConfig.port, () => {
  console.log(`MindHeal API listening on http://localhost:${appConfig.port}`);
  console.log(`WebSocket server running.`);
});
