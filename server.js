// server.js
require("dotenv").config();
console.log("SERVER FILE:", __filename);
console.log("SERVER PID:", process.pid);
console.log("APP RESOLVE:", require.resolve("./app"));

const app = require("./app");
const PORT = process.env.PORT || 5200;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on http://127.0.0.1:${PORT}`);
  console.log("LISTEN ADDRESS:", server.address());
});
