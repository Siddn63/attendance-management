const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/authMiddleware");

const {
  requestOvertime,
  getMyOvertime,
  getAllOvertime,
  updateOvertime,
} = require("../controllers/overtimeController");

const router = express.Router();

router.post(
  "/request",
  protect,
  allowRoles("employee"),
  requestOvertime
);

router.get(
  "/my",
  protect,
  getMyOvertime
);

router.get(
  "/all",
  protect,
  allowRoles("manager", "admin"),
  getAllOvertime
);

router.put(
  "/:overtimeId",
  protect,
  allowRoles("manager", "admin"),
  updateOvertime
);

module.exports = router;
