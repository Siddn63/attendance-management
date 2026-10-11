const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  punchIn,
  punchOut,
  getMyAttendance,
  getAllAttendance,
  validateAttendance,
} = require("../controllers/attendanceController");

const router = express.Router();

// Employee
router.post("/punch-in", protect, allowRoles("employee"), punchIn);
router.post("/punch-out", protect, allowRoles("employee"), punchOut);
router.get("/my-attendance", protect, getMyAttendance);

// Manager/Admin
router.get(
  "/all",
  protect,
  allowRoles("manager", "admin"),
  getAllAttendance
);

router.put(
  "/validate/:attendanceId",
  protect,
  allowRoles("manager", "admin"),
  validateAttendance
);

module.exports = router;
