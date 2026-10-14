import app from './app.js';
import { closeConnections } from './db.js';

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => console.log(`BiteStream API listening on http://localhost:${port}`));

process.on('SIGINT', async () => {
  server.close();
  await closeConnections();
  process.exit(0);
});
