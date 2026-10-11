const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const makeToken = (user) => jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "7d" },
);

const signup = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (!name || !email || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Enter your name, email and a password of at least 8 characters." });
    }
    if (await User.findOne({ email })) return res.status(409).json({ message: "An account with this email already exists." });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: "employee" });
    return res.status(201).json({ token: makeToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ message: "Could not create your account." });
  }
};

const login = async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    return res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Could not sign in." });
  }
};

const getUsers = async (_req, res) => {
  try {
    const users = await User.find().select("name email role manager").populate("manager", "name").sort({ name: 1 });
    return res.json({ users });
  } catch (error) {
    console.error("User list error:", error.message);
    return res.status(500).json({ message: "Could not load users." });
  }
};

const addUser = async (req, res) => {
  try {
    const { name, email, password, role, manager } = req.body;
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!cleanName || !cleanEmail || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Enter a name, email and password of at least 8 characters." });
    }
    if (!["employee", "manager", "admin"].includes(role)) return res.status(400).json({ message: "Choose a valid role." });
    if (await User.findOne({ email: cleanEmail })) return res.status(409).json({ message: "An account with this email already exists." });
    let managerId = null;
    if (manager) {
      const managerUser = await User.findOne({ _id: manager, role: "manager" });
      if (!managerUser || role !== "employee") return res.status(400).json({ message: "Choose a valid manager for an employee." });
      managerId = managerUser._id;
    }
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: await bcrypt.hash(password, 10),
      role,
      manager: managerId,
    });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    console.error("Add user error:", error.message);
    return res.status(500).json({ message: "Could not create the account." });
  }
};

module.exports = { signup, login, getUsers, addUser };
