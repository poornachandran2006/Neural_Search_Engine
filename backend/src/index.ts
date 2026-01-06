import dotenv from "dotenv";
import app from "./app";
import { ENV } from "./config/env";

// Load environment variables
dotenv.config();

// Server start
const PORT = ENV.PORT;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
