const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    punchIn: {
      type: Date,
      required: true,
    },

    punchOut: {
      type: Date,
      default: null,
    },

    selfie: {
      type: String,
      required: true,
    },
    punchOutSelfie: {
      type: String,
      default: "",
    },

    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      source: {
        type: String,
        enum: ["device", "network"],
        default: "device",
      },
    },
    punchOutLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      source: { type: String, enum: ["device", "network"], default: "device" },
    },

    totalWorkingHours: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["incomplete", "completed"],
      default: "incomplete",
    },

    validationStatus: {
      type: String,
      enum: ["pending", "valid", "invalid"],
      default: "pending",
    },

    overtimeHours: {
  type: Number,
  default: 0,
},

overtimeStatus: {
  type: String,
  enum: ["none", "pending", "approved", "rejected"],
  default: "none",
},

    remarks: {
      type: String,
      default: "",
    },
    
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Attendance", attendanceSchema);
