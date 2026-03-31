const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  listMedia,
  listMediaGrouped,
  getMedia,
  uploadMedia,
  updateMedia,
  deleteMedia,
  streamMedia,
} = require("../controllers/mediaController");

// GET    /api/media          — list all files across all hour folders (flat)
router.get("/", listMedia);

// GET    /api/media/grouped  — list files grouped by hour folder
router.get("/grouped", listMediaGrouped);

// GET    /api/media/:id      — get single file metadata
router.get("/:id", getMedia);

// GET    /api/media/:id/stream — proxy stream the file content
router.get("/:id/stream", streamMedia);

// POST   /api/media          — upload new file (multipart/form-data, field: "file")
router.post("/", upload.single("file"), uploadMedia);

// PATCH  /api/media/:id      — update name / description
router.patch("/:id", updateMedia);

// DELETE /api/media/:id      — delete file from Drive
router.delete("/:id", deleteMedia);

module.exports = router;