// Vercel serverless entrypoint: re-exports the Express app from server/index.js.
import { app } from '../server/index.js';

export default app;
