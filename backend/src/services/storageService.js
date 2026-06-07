const Result = require("../models/Result");
const { drive } = require("../config/google");

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

/** List sub-folders (hour-based batches) inside the root folder */
const listSubFolders = async (folderId) => {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
    fields: "files(id, name, createdTime)",
    pageSize: 100,
    orderBy: "createdTime desc",
  });
  return res.data.files || [];
};

/** Count files + total size for a single folder (no recursion into sub-folders) */
const getFolderStats = async (folderId) => {
  let fileCount = 0;
  let totalSize = 0;
  let pageToken = null;

  do {
    const params = {
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id, size)",
      pageSize: 1000,
    };
    if (pageToken) params.pageToken = pageToken;

    const res = await drive.files.list(params);
    const files = res.data.files || [];
    fileCount += files.length;
    totalSize += files.reduce((sum, f) => sum + Number(f.size || 0), 0);
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);

  return { fileCount, totalSize };
};

const getStorageSummary = async () => {
  // ── 1. DB-side stats (always available as fallback) ──────────────────────
  const [resultStats, largestFiles, recentUploads] = await Promise.all([
    Result.aggregate([
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          storageUsed: { $sum: { $ifNull: ["$fileSize", 0] } },
        },
      },
    ]),
    Result.find({})
      .sort({ fileSize: -1 })
      .limit(10)
      .select("studentName category fileSize originalFileName driveFileId driveLink createdAt")
      .lean(),
    Result.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select("studentName category fileSize originalFileName driveFileId driveLink createdAt")
      .lean(),
  ]);

  const dbTotalFiles = resultStats[0]?.totalFiles || 0;
  const dbStorageUsed = resultStats[0]?.storageUsed || 0;

  // ── 2. Root folder data only ─────────────────────────────────────────────
  let driveConnected = false;
  let driveError = null;
  let rootFolderName = null;
  let rootTotalFiles = null;
  let rootTotalSize = null;
  let folderBreakdown = [];

  try {
    if (!FOLDER_ID) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set in .env");

    // Root folder name + sub-folders in parallel
    const [rootMeta, subFolders] = await Promise.all([
      drive.files.get({ fileId: FOLDER_ID, fields: "id, name" }),
      listSubFolders(FOLDER_ID),
    ]);

    rootFolderName = rootMeta.data.name;
    driveConnected = true;

    // Per-subfolder breakdown (all of them, they're already scoped to root)
    const breakdownResults = await Promise.all(
      subFolders.map(async (folder) => {
        try {
          const stats = await getFolderStats(folder.id);
          return {
            folderName: folder.name,
            folderId: folder.id,
            fileCount: stats.fileCount,
            totalSize: stats.totalSize,
            createdTime: folder.createdTime,
          };
        } catch {
          return {
            folderName: folder.name,
            folderId: folder.id,
            fileCount: 0,
            totalSize: 0,
            createdTime: folder.createdTime,
          };
        }
      })
    );

    folderBreakdown = breakdownResults.sort(
      (a, b) => new Date(b.createdTime) - new Date(a.createdTime)
    );

    // Totals = sum across all sub-folders (= everything inside root folder)
    rootTotalFiles = folderBreakdown.reduce((s, f) => s + f.fileCount, 0);
    rootTotalSize = folderBreakdown.reduce((s, f) => s + f.totalSize, 0);
  } catch (err) {
    driveError = err.message || "Google Drive unavailable";
    console.error("Drive storage fetch error:", driveError);
  }

  // ── 3. Response — Drive numbers preferred, DB as fallback ────────────────
  return {
    totalFiles: rootTotalFiles !== null ? rootTotalFiles : dbTotalFiles,
    storageUsed: rootTotalSize !== null ? rootTotalSize : dbStorageUsed,
    remainingStorage: null, // not fetching whole-drive quota
    failedUploads: 0,

    largestFiles,
    recentUploads,

    drive: {
      connected: driveConnected,
      error: driveError,
      rootFolderId: FOLDER_ID || null,
      rootFolderName,
      totalFiles: rootTotalFiles,
      totalSize: rootTotalSize,
      folderBreakdown,
    },
  };
};

module.exports = { getStorageSummary };