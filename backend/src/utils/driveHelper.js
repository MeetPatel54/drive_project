const fs = require("fs");
const { drive } = require("../config/google");

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Generate hour-based folder name: "2024-01-15 14:00"
const getHourFolderName = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:00`;
};

const findHourFolder = async (folderName, parentId) => {
  const res = await drive.files.list({
    q: `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
  });
  return res.data.files[0] || null;
};

const createHourFolder = async (folderName, parentId) => {
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id, name",
  });
  return res.data;
};

const getOrCreateHourFolder = async () => {
  const folderName = getHourFolderName();
  const existing = await findHourFolder(folderName, FOLDER_ID);
  if (existing) return { ...existing, folderName };
  const created = await createHourFolder(folderName, FOLDER_ID);
  console.log(`📁 Created hour folder: ${folderName}`);
  return { ...created, folderName };
};

// Upload file to Drive and return file metadata
const uploadToDrive = async ({ filePath, fileName, mimeType, description = "" }) => {
  const hourFolder = await getOrCreateHourFolder();

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      description,
      parents: [hourFolder.id],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: "id, name, mimeType, size, createdTime",
  });

  // Keep file private — served via stream proxy, not public URL
  // (No permissions.create call — file stays private)

  // Cleanup temp file
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  return {
    fileId: response.data.id,
    fileName: response.data.name,
    mimeType: response.data.mimeType,
    size: response.data.size,
    driveLink: `https://drive.google.com/file/d/${response.data.id}/view`,
    folderName: hourFolder.folderName,
  };
};

// Delete file from Drive
const deleteFromDrive = async (fileId) => {
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    console.error(`Failed to delete Drive file ${fileId}:`, err.message);
  }
};

// Stream file from Drive to response
const streamFromDrive = async (fileId, res) => {
  const meta = await drive.files.get({ fileId, fields: "mimeType, name, size" });
  const { mimeType, name, size } = meta.data;

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${name}"`);
  if (size) res.setHeader("Content-Length", size);

  response.data.pipe(res);
};

module.exports = { uploadToDrive, deleteFromDrive, streamFromDrive };
