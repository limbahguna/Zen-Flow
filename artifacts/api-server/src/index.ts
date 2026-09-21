import app from "./app";
import { logger } from "./lib/logger";
import { listenHost } from "./listenHost";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = listenHost(process.env.NODE_ENV);

function onListen(err?: Error): void {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, host }, "Server listening");
}

if (host) {
  app.listen(port, host, onListen);
} else {
  app.listen(port, onListen);
}
