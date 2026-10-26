import 'dotenv/config';
import app from './app.js';
import connectDB from './utils/connectDB.js';

const port = process.env.PORT || 5000;
try {
  await connectDB();
  app.listen(port, () => console.log(`TaskMate API listening on ${port}`));
} catch (error) {
  console.error(`TaskMate API was not started because PostgreSQL could not connect: ${error.message}`);
  process.exit(1);
}
