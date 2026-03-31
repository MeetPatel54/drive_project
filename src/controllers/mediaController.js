const fs = require("fs");
const path = require("path");
const { drive } = require("../config/google");

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// ─── Helper: delete local temp file ────────────────────────────────────────
const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// ─── Helper: build URLs from file ID ───────────────────────────────────────
const buildUrls = (fileId) => ({
  view: `https://drive.google.com/file/d/${fileId}/view`,
  thumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
  directEmbed: `https://drive.google.com/uc?export=view&id=${fileId}`,
  download: `https://drive.google.com/uc?export=download&id=${fileId}`,
});

// ─── Helper: get current hour folder name ──────────────────────────────────
// Format: "2024-01-15 14:00" — one folder per hour
const getHourFolderName = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const dd   = String(now.getDate()).padStart(2, "0");
  const hh   = String(now.getHours()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:00`;
};

// ─── Helper: find existing hour folder inside parent ───────────────────────
const findHourFolder = async (folderName, parentId) => {
  const response = await drive.files.list({
    q: `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
  });
  return response.data.files[0] || null;
};

// ─── Helper: create hour folder inside parent ──────────────────────────────
const createHourFolder = async (folderName, parentId) => {
  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, name",
  });
  return response.data;
};

// ─── Helper: get or create the current hour folder ─────────────────────────
const getOrCreateHourFolder = async () => {
  const folderName = getHourFolderName();
  const existing = await findHourFolder(folderName, FOLDER_ID);
  if (existing) {
    console.log(`Using existing hour folder: ${folderName} (${existing.id})`);
    return existing;
  }
  const created = await createHourFolder(folderName, FOLDER_ID);
  console.log(`Created new hour folder: ${folderName} (${created.id})`);
  return created;
};

// ─── Helper: get ALL hour subfolder IDs inside root folder ─────────────────
const getAllSubfolderIds = async () => {
  const folders = [];
  let pageToken = null;
  do {
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      pageToken: pageToken || undefined,
      orderBy: "name desc",
    });
    folders.push(...response.data.files);
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return folders;
};

// ─── Helper: build file object from Drive response ─────────────────────────
const buildFileObject = (f, folderName = null) => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  type: f.mimeType.startsWith("image/") ? "image" : "video",
  size: f.size ? parseInt(f.size) : null,
  description: f.description || "",
  folder: folderName || null,
  createdAt: f.createdTime,
  updatedAt: f.modifiedTime,
  urls: buildUrls(f.id),
});

// ─── LIST all media files across all hour subfolders ───────────────────────
const listMedia = async (req, res) => {
  try {
    const { pageSize = 24, mimeType } = req.query;
    const limit = parseInt(pageSize);

    const subfolders = await getAllSubfolderIds();

    if (subfolders.length === 0) {
      return res.json({ success: true, data: [], total: 0, nextPageToken: null });
    }

    const parentConditions = subfolders.map((f) => `'${f.id}' in parents`).join(" or ");
    let q = `(${parentConditions}) and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
    if (mimeType === "image") q += ` and mimeType contains 'image/'`;
    if (mimeType === "video") q += ` and mimeType contains 'video/'`;

    const folderMap = {};
    subfolders.forEach((f) => { folderMap[f.id] = f.name; });

    const allFiles = [];
    let drivePageToken = null;
    do {
      const response = await drive.files.list({
        q,
        pageSize: 100,
        pageToken: drivePageToken || undefined,
        fields: "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, description, parents)",
        orderBy: "createdTime desc",
      });
      allFiles.push(...response.data.files);
      drivePageToken = response.data.nextPageToken;
      if (allFiles.length >= limit * 3) break;
    } while (drivePageToken);

    allFiles.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    const filesWithFolder = allFiles.map((f) => {
      const parentId = f.parents?.[0];
      return buildFileObject(f, folderMap[parentId] || null);
    });

    res.json({
      success: true,
      data: filesWithFolder.slice(0, limit),
      total: filesWithFolder.length,
      nextPageToken: null,
    });
  } catch (err) {
    console.error("listMedia error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── LIST files grouped by hour folder ─────────────────────────────────────
const listMediaGrouped = async (req, res) => {
  try {
    const { mimeType } = req.query;
    const subfolders = await getAllSubfolderIds();

    if (subfolders.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const groups = [];
    for (const folder of subfolders) {
      let q = `'${folder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
      if (mimeType === "image") q += ` and mimeType contains 'image/'`;
      if (mimeType === "video") q += ` and mimeType contains 'video/'`;

      const response = await drive.files.list({
        q,
        pageSize: 100,
        fields: "files(id, name, mimeType, size, createdTime, modifiedTime, description)",
        orderBy: "createdTime desc",
      });

      if (response.data.files.length > 0) {
        groups.push({
          folder: folder.name,
          folderId: folder.id,
          count: response.data.files.length,
          files: response.data.files.map((f) => buildFileObject(f, folder.name)),
        });
      }
    }

    res.json({ success: true, data: groups });
  } catch (err) {
    console.error("listMediaGrouped error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET single file metadata ───────────────────────────────────────────────
const getMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await drive.files.get({
      fileId: id,
      fields: "id, name, mimeType, size, createdTime, modifiedTime, description, parents",
    });

    const f = response.data;
    let folderName = null;
    if (f.parents?.[0]) {
      try {
        const parentRes = await drive.files.get({ fileId: f.parents[0], fields: "id, name" });
        folderName = parentRes.data.name;
      } catch (_) {}
    }

    res.json({ success: true, data: buildFileObject(f, folderName) });
  } catch (err) {
    console.error("getMedia error:", err.message);
    const status = err.code === 404 ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
};

// ─── UPLOAD new file → current hour subfolder ──────────────────────────────
const uploadMedia = async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file provided" });
    }

    const { name, description } = req.body;
    const fileName = name || req.file.originalname;

    // Get or create hour folder for right now
    const hourFolder = await getOrCreateHourFolder();

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        description: description || "",
        parents: [hourFolder.id],
      },
      media: {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(tempPath),
      },
      fields: "id, name, mimeType, size, createdTime, description",
    });

    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    cleanupTempFile(tempPath);

    const f = response.data;
    res.status(201).json({
      success: true,
      data: {
        ...buildFileObject(f, hourFolder.name),
        folderId: hourFolder.id,
      },
    });
  } catch (err) {
    cleanupTempFile(tempPath);
    console.error("uploadMedia error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── UPDATE file metadata — file stays in its original hour folder ──────────
const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name && description === undefined) {
      return res.status(400).json({ success: false, error: "Provide at least name or description to update" });
    }

    const updateBody = {};
    if (name) updateBody.name = name;
    if (description !== undefined) updateBody.description = description;

    const response = await drive.files.update({
      fileId: id,
      requestBody: updateBody,
      fields: "id, name, mimeType, size, createdTime, modifiedTime, description, parents",
    });

    const f = response.data;
    let folderName = null;
    if (f.parents?.[0]) {
      try {
        const parentRes = await drive.files.get({ fileId: f.parents[0], fields: "name" });
        folderName = parentRes.data.name;
      } catch (_) {}
    }

    res.json({ success: true, data: buildFileObject(f, folderName) });
  } catch (err) {
    console.error("updateMedia error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── DELETE file — hour folder is kept even if it becomes empty ─────────────
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    await drive.files.delete({ fileId: id });
    res.json({ success: true, message: "File deleted successfully", id });
  } catch (err) {
    console.error("deleteMedia error:", err.message);
    const status = err.code === 404 ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
};

// ─── STREAM / proxy file content ───────────────────────────────────────────
const streamMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const meta = await drive.files.get({ fileId: id, fields: "mimeType, name, size" });
    const { mimeType, name, size } = meta.data;
    const response = await drive.files.get(
      { fileId: id, alt: "media" },
      { responseType: "stream" }
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);
    if (size) res.setHeader("Content-Length", size);
    response.data.pipe(res);
  } catch (err) {
    console.error("streamMedia error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  listMedia,
  listMediaGrouped,
  getMedia,
  uploadMedia,
  updateMedia,
  deleteMedia,
  streamMedia,
};