const express = require("express");
const router = express.Router();
const {
  uploadResult,
  getMyResults,
  getAllResults,
  updateStatus,
  getTopStudents,
  getStats,
  deleteResult,
  streamResult,
} = require("../controllers/resultController");
const { protect, restrictTo } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { validate, uploadResultSchema, updateStatusSchema } = require("../validators");

// Public — top students leaderboard
router.get("/top", getTopStudents);

// Protected — all authenticated users
router.use(protect);

// Student routes
router.post(
  "/upload",
  restrictTo("student"),
  upload.single("file"),
  validate(uploadResultSchema),
  uploadResult
);
router.get("/my",  restrictTo("student"), getMyResults);

// Teacher routes
router.get("/all",   restrictTo("teacher"), getAllResults);
router.get("/stats", restrictTo("teacher"), getStats);
router.patch("/:id/status", restrictTo("teacher"), validate(updateStatusSchema), updateStatus);

// Shared — stream result file (student: own only, teacher: any)
router.get("/:id/stream", streamResult);

// Delete — student (own pending) or teacher (any)
router.delete("/:id", deleteResult);

module.exports = router;
