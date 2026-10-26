import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_SECRET', 'CLIENT_URL'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  process.exit(1);
}

const port = process.env.PORT || 5000;
try {
  const [{ default: app }, { default: connectDB }] = await Promise.all([
    import('./app.js'),
    import('./utils/connectDB.js')
  ]);
  await connectDB();
  app.listen(port, () => console.log(`TaskMate API listening on ${port}`));
} catch (error) {
  console.error(`TaskMate API was not started because PostgreSQL could not connect: ${error.message}`);
  process.exit(1);
}
