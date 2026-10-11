const express = require("express");
const { signup, login, getUsers, addUser } = require("../controllers/authController");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/users", protect, allowRoles("admin"), getUsers);
router.post("/users", protect, allowRoles("admin"), addUser);

module.exports = router;
