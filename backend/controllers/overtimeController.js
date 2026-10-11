const mongoose = require("mongoose");
const Overtime = require("../models/Overtime");
const Attendance = require("../models/Attendance");
const User = require("../models/User");

// ==========================================
// EMPLOYEE - REQUEST OVERTIME
// ==========================================
const requestOvertime = async (req, res) => {
  try {
    console.log("===== OVERTIME REQUEST =====");
    console.log("User:", req.user);
    console.log("Body:", req.body);

    const {
      attendanceId,
      hours,
      overtimeHours,
    } = req.body;
    const reasonText = typeof req.body.reason === "string"
      ? req.body.reason.trim()
      : "";

    // Accept either hours or overtimeHours
    const requestedHours = Number(
      hours !== undefined ? hours : overtimeHours
    );

    // Validate attendance
    if (!attendanceId) {
      return res.status(400).json({
        message: "Attendance ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        message: "Invalid attendance ID",
      });
    }

    // Validate hours
    if (
      !Number.isFinite(requestedHours) ||
      requestedHours < 0.5 || requestedHours > 12
    ) {
      return res.status(400).json({
        message: "Overtime hours must be between 0.5 and 12",
      });
    }

    // Validate reason
    if (!reasonText || reasonText.length > 500) {
      return res.status(400).json({
        message: "Enter a reason under 500 characters",
      });
    }

    // Find only an attendance record owned by the signed-in employee.
    const attendance = await Attendance.findOne({
      _id: attendanceId,
      employee: req.user.id,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "Attendance record not found",
      });
    }

    console.log("Attendance found:", attendance._id);
    console.log("Attendance employee:", attendance.employee);
    console.log("Logged user:", req.user.id);

    // Employee must punch out first
    if (!attendance.punchOut) {
      return res.status(400).json({
        message:
          "Please punch out before requesting overtime",
      });
    }

    // Check existing pending request
    const existingRequest = await Overtime.findOne({
      employee: req.user.id,
      attendance: attendanceId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        message:
          "Overtime request already submitted for this attendance",
      });
    }

    // Create overtime
    const overtime = new Overtime({
      employee: req.user.id,
      attendance: attendanceId,
      hours: requestedHours,
      reason: reasonText,
      status: "pending",
    });

    await overtime.save();

    // Update attendance
    attendance.overtimeHours = requestedHours;
    attendance.overtimeStatus = "pending";

    await attendance.save();

    console.log("Overtime created:", overtime._id);

    return res.status(201).json({
      message: "Overtime request submitted successfully",
      overtime,
    });
  } catch (error) {
    console.error("===== OVERTIME ERROR =====");
    console.error(error);

    return res.status(500).json({
      message:
        error.message ||
        "Could not submit overtime request",
    });
  }
};


// ==========================================
// EMPLOYEE - MY OVERTIME
// ==========================================
const getMyOvertime = async (req, res) => {
  try {
    const overtime = await Overtime.find({
      employee: req.user.id,
    })
      .populate("attendance")
      .sort({ createdAt: -1 });

    res.json({
      overtime,
    });
  } catch (error) {
    console.error("Get overtime error:", error);

    res.status(500).json({
      message: "Could not fetch overtime requests",
    });
  }
};


// ==========================================
// MANAGER / ADMIN - ALL OVERTIME
// ==========================================
const getAllOvertime = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "manager") {
      const employees = await User.find({ manager: req.user.id, role: "employee" }).select("_id");
      filter.employee = { $in: employees.map((user) => user._id) };
    }
    const overtime = await Overtime.find(filter)
      .populate("employee", "name email role")
      .populate("attendance")
      .sort({ createdAt: -1 });

    res.json({
      overtime,
    });
  } catch (error) {
    console.error("Get all overtime error:", error);

    res.status(500).json({
      message: "Could not fetch overtime requests",
    });
  }
};


// ==========================================
// MANAGER / ADMIN - APPROVE / REJECT
// ==========================================
const updateOvertime = async (req, res) => {
  try {
    const { overtimeId } = req.params;
    const { status, remarks } = req.body;

    if (
      !["approved", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid overtime status",
      });
    }
    if (remarks !== undefined && (typeof remarks !== "string" || remarks.length > 500)) {
      return res.status(400).json({ message: "Keep review notes under 500 characters." });
    }

    const overtime = await Overtime.findById(overtimeId).populate("employee", "manager");

    if (!overtime) {
      return res.status(404).json({
        message: "Overtime request not found",
      });
    }

    if (req.user.role === "manager" && String(overtime.employee.manager) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only review requests from your team." });
    }

    overtime.status = status;
    overtime.remarks = typeof remarks === "string" ? remarks.trim() : "";

    await overtime.save();

    const attendance = await Attendance.findById(
      overtime.attendance
    );

    if (attendance) {
      attendance.overtimeStatus = status;

      if (status === "approved") {
        attendance.overtimeHours = overtime.hours;
      }

      if (status === "rejected") {
        attendance.overtimeHours = 0;
      }

      await attendance.save();
    }

    res.json({
      message:
        status === "approved"
          ? "Overtime approved successfully"
          : "Overtime rejected successfully",
      overtime,
    });
  } catch (error) {
    console.error("Update overtime error:", error);

    res.status(500).json({
      message:
        error.message ||
        "Could not update overtime",
    });
  }
};


module.exports = {
  requestOvertime,
  getMyOvertime,
  getAllOvertime,
  updateOvertime,
};
