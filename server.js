require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "local-demo-secret-change-me";
const demoFile = path.join(__dirname, "data.json");

app.use(express.json());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

function readDemoUsers() {
  return JSON.parse(fs.readFileSync(demoFile, "utf8"));
}

function writeDemoUsers(users) {
  fs.writeFileSync(demoFile, JSON.stringify(users, null, 2));
}

async function findUserByEmail(email) {
  if (mongoose.connection.readyState === 1) return User.findOne({ email });
  return readDemoUsers().find((user) => user.email === email) || null;
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized - Token missing" });
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
}

app.get("/", (req, res) => {
  res.json({ message: "User Registration and JWT Authentication API", endpoints: ["POST /register", "POST /login", "GET /profile"] });
});

app.get("/demo", (req, res) => {
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>JWT Auth Test Console</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#f4f7fb;color:#172033}h1{margin-bottom:6px}.sub{color:#5c6b80}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:24px}.panel{background:#fff;border:1px solid #d8e0eb;border-radius:12px;padding:18px;box-shadow:0 4px 16px #17203312}.panel h2{font-size:16px;margin-top:0}.status{font-weight:700;color:#286749}.response{background:#101827;color:#d9e5f2;border-radius:8px;padding:12px;min-height:64px;white-space:pre-wrap;word-break:break-word;font:12px ui-monospace,monospace}button{background:#1c5fd4;border:0;border-radius:7px;color:#fff;padding:9px 12px;cursor:pointer;margin:4px 4px 10px 0}button.alt{background:#68758a}@media(max-width:650px){.grid{grid-template-columns:1fr}}</style></head><body><h1>JWT Authentication Test Console</h1><p class="sub">Live responses from the local Express API</p><div class="panel"><b>Test user:</b> Rahul &lt;rahul@example.com&gt; <span id="status" class="status">Ready</span></div><div class="grid"><section class="panel"><h2>1. Register</h2><button onclick="register()">POST /register</button><div id="register" class="response">Click to run</div></section><section class="panel"><h2>2. Login</h2><button onclick="login()">POST /login</button><div id="login" class="response">Click to run</div></section><section class="panel"><h2>3. No token</h2><button class="alt" onclick="profile()">GET /profile</button><div id="noToken" class="response">Click to run</div></section><section class="panel"><h2>4. Invalid token</h2><button class="alt" onclick="invalid()">GET /profile</button><div id="invalid" class="response">Click to run</div></section><section class="panel"><h2>5. Valid token</h2><button onclick="valid()">GET /profile</button><div id="valid" class="response">Click to run</div></section></div><script>let token="";const body={name:"Rahul",email:"rahul@example.com",password:"Rahul@123"};async function call(path,options){const r=await fetch(path,options);return {status:r.status,body:await r.json()}}function show(id,v){document.getElementById(id).textContent=JSON.stringify(v,null,2)}async function register(){show("register",await call("/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}))}async function login(){const v=await call("/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:body.email,password:body.password})});token=v.body.token||"";show("login",v)}async function profile(){show("noToken",await call("/profile"))}async function invalid(){show("invalid",await call("/profile",{headers:{Authorization:"Bearer invalid.token.here"}}))}async function valid(){if(!token)await login();show("valid",await call("/profile",{headers:{Authorization:"Bearer "+token}}))}</script></body></html>`);
});

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    const normalizedEmail = email.toLowerCase().trim();
    if (await findUserByEmail(normalizedEmail)) return res.status(409).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    if (mongoose.connection.readyState === 1) {
      await User.create({ name, email: normalizedEmail, password: hashedPassword });
    } else {
      const users = readDemoUsers();
      users.push({ _id: `demo-${Date.now()}`, name, email: normalizedEmail, password: hashedPassword });
      writeDemoUsers(users);
    }
    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail((email || "").toLowerCase().trim());
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({ message: "Login successful", token });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
});

app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Welcome to your private profile", user: { id: req.user.id, email: req.user.email } });
});

async function start() {
  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas");
  } else {
    console.log("MONGO_URI not set: running in local demo mode");
  }
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start().catch((error) => {
  console.error("Unable to start server:", error.message);
  process.exit(1);
});