require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

async function seedAdmin() {
  try {
    if (!process.env.MONGO_URI) throw new Error("Add MONGO_URI to backend/.env first.");
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "DemoPass123!";
    const demoPassword = process.env.DEMO_PASSWORD || "DemoPass123!";
    await mongoose.connect(process.env.MONGO_URI);
    const findOrCreate = async ({ name, email, password, role, manager = null }) => {
      let user = await User.findOne({ email });
      if (user && user.role !== role) throw new Error(`${email} already exists with role ${user.role}; change the demo email in backend/.env.`);
      if (!user) {
        user = await User.create({ name, email, password: await bcrypt.hash(password, 10), role, manager });
        console.log(`Created ${role} account: ${email}`);
      } else {
        console.log(`${role} account already exists: ${email}`);
      }
      return user;
    };

    const admin = await findOrCreate({ name: "System Admin", email: adminEmail, password: adminPassword, role: "admin" });
    const manager = await findOrCreate({ name: "Demo Manager", email: "manager@example.com", password: demoPassword, role: "manager" });
    const employee = await findOrCreate({ name: "Demo Employee", email: "employee@example.com", password: demoPassword, role: "employee", manager: manager._id });
    if (!employee.manager) {
      employee.manager = manager._id;
      await employee.save();
    }
    console.log(`Demo accounts ready. Admin: ${admin.email}; Manager: ${manager.email}; Employee: ${employee.email}`);
  } catch (error) {
    console.error("Could not create admin account:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin();
