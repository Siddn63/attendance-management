const Attendance = require("../models/Attendance");
const User = require("../models/User");

/* =========================================================
   PUNCH IN
========================================================= */

const punchIn = async (req, res) => {
  try {
    const {
      selfie,
      latitude,
      longitude,
      source,
    } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      typeof selfie !== "string" || !selfie.startsWith("data:image/") || selfie.length > 7_000_000 ||
      latitude === undefined || longitude === undefined ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
    ) {
      return res.status(400).json({
        message:
          "Valid selfie and location are required",
      });
    }

    /*
     * Check if employee is already punched in.
     */

    const existingAttendance =
      await Attendance.findOne({
        employee: req.user.id,
        punchOut: null,
      });

    if (existingAttendance) {
      return res.status(400).json({
        message: "Already punched in",
      });
    }

    /*
     * Create attendance record.
     */

    const attendance =
      await Attendance.create({
        employee: req.user.id,

        punchIn: new Date(),

        punchOut: null,

        selfie,

        location: {
          latitude: lat,
          longitude: lng,
          source: source === "network" ? "network" : "device",
        },

        totalWorkingHours: 0,

        status: "incomplete",

        validationStatus: "pending",

        overtimeHours: 0,

        overtimeStatus: "none",

        remarks: "",
      });

    res.status(201).json({
      message: "Punch in successful",
      attendance,
    });
  } catch (error) {
    console.error(
      "Punch in error:",
      error
    );

    res.status(500).json({
      message: "Something went wrong",
    });
  }
};

/* =========================================================
   PUNCH OUT
========================================================= */

const punchOut = async (req, res) => {
  try {
    const { selfie, latitude, longitude, source } = req.body;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      typeof selfie !== "string" || !selfie.startsWith("data:image/") || selfie.length > 7_000_000 ||
      latitude === undefined || longitude === undefined ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
    ) {
      return res.status(400).json({ message: "A live selfie and valid location are required to punch out." });
    }
    /*
     * Find employee's active attendance.
     */

    const attendance =
      await Attendance.findOne({
        employee: req.user.id,
        punchOut: null,
      }).sort({
        punchIn: -1,
      });

    if (!attendance) {
      return res.status(400).json({
        message:
          "No active punch-in found",
      });
    }

    /*
     * Current punch-out time.
     */

    const punchOutTime = new Date();

    /*
     * Difference in milliseconds.
     */

    const difference =
      punchOutTime.getTime() -
      attendance.punchIn.getTime();

    /*
     * Convert milliseconds to hours.
     */

    const workingHours =
      difference /
      (1000 * 60 * 60);

    /*
     * Store punch-out.
     */

    attendance.punchOut =
      punchOutTime;
    attendance.punchOutSelfie = selfie;
    attendance.punchOutLocation = { latitude: lat, longitude: lng, source: source === "network" ? "network" : "device" };

    /*
     * Store hours rounded to 2 decimals.
     */

    attendance.totalWorkingHours =
      Number(
        workingHours.toFixed(2)
      );

    /*
     * IMPORTANT:
     *
     * 8 hours or more = completed
     * Less than 8 hours = incomplete
     */

    if (workingHours >= 8) {
      attendance.status =
        "completed";
    } else {
      attendance.status =
        "incomplete";
    }

    await attendance.save();

    console.log(
      "Working hours:",
      workingHours
    );

    console.log(
      "Attendance status:",
      attendance.status
    );

    res.json({
      message:
        "Punch out successful",

      attendance,
    });
  } catch (error) {
    console.error(
      "Punch out error:",
      error
    );

    res.status(500).json({
      message:
        "Something went wrong",
    });
  }
};

/* =========================================================
   GET MY ATTENDANCE
========================================================= */

const getMyAttendance = async (
  req,
  res
) => {
  try {
    const attendance =
      await Attendance.find({
        employee: req.user.id,
      }).sort({
        punchIn: -1,
      });

    res.json({
      attendance,
    });
  } catch (error) {
    console.error(
      "Get my attendance error:",
      error
    );

    res.status(500).json({
      message:
        "Could not fetch attendance",
    });
  }
};

/* =========================================================
   GET ALL ATTENDANCE
   MANAGER / ADMIN
========================================================= */

const getAllAttendance = async (
  req,
  res
) => {
  try {
    const filter = {};
    if (req.user.role === "manager") {
      const employees = await User.find({ manager: req.user.id, role: "employee" }).select("_id");
      filter.employee = { $in: employees.map((user) => user._id) };
    }
    if (req.query.date) {
      const start = new Date(`${req.query.date}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) return res.status(400).json({ message: "Choose a valid date." });
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.punchIn = { $gte: start, $lt: end };
    }
    const attendance =
      await Attendance.find(filter)
        .populate(
          "employee",
          "name email role"
        )
        .sort({
          punchIn: -1,
        });

    res.json({
      attendance,
    });
  } catch (error) {
    console.error(
      "Get all attendance error:",
      error
    );

    res.status(500).json({
      message:
        "Could not fetch attendance",
    });
  }
};

/* =========================================================
   VALIDATE ATTENDANCE
   MANAGER / ADMIN
========================================================= */

const validateAttendance = async (
  req,
  res
) => {
  try {
    const {
      attendanceId,
    } = req.params;

    const {
      validationStatus,
      remarks,
    } = req.body;

    if (
      ![
        "valid",
        "invalid",
      ].includes(
        validationStatus
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid validation status",
      });
    }
    if (typeof remarks !== "string" || remarks.length > 500) {
      return res.status(400).json({ message: "Keep review notes under 500 characters." });
    }

    const attendance =
      await Attendance.findById(
        attendanceId
      );

    if (!attendance) {
      return res.status(404).json({
        message:
          "Attendance not found",
      });
    }

    if (req.user.role === "manager") {
      const employee = await User.findById(attendance.employee).select("manager");
      if (!employee || String(employee.manager) !== String(req.user.id)) {
        return res.status(403).json({ message: "You can only review employees on your team." });
      }
    }

    attendance.validationStatus =
      validationStatus;

    attendance.remarks = remarks.trim();

    await attendance.save();

    res.json({
      message:
        "Attendance validation updated",

      attendance,
    });
  } catch (error) {
    console.error(
      "Validate attendance error:",
      error
    );

    res.status(500).json({
      message:
        "Could not validate attendance",
    });
  }
};

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  punchIn,
  punchOut,
  getMyAttendance,
  getAllAttendance,
  validateAttendance,
};
