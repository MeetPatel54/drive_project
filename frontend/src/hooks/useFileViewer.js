import { useCallback, useState } from "react";

const buildResultFileName = (result) => {
  const parts = [
    result.studentName,
    result.category || result.subject,
    result.examYear,
  ].filter(Boolean);

  return parts.length ? `${parts.join(" - ")} result` : "Result file";
};

export const useFileViewer = () => {
  const [fileViewer, setFileViewer] = useState({ open: false, file: null });

  const openFileViewer = useCallback((result) => {
    setFileViewer({
      open: true,
      file: {
        id: result._id,
        name: buildResultFileName(result),
      },
    });
  }, []);

  const closeFileViewer = useCallback(() => {
    setFileViewer({ open: false, file: null });
  }, []);

  return {
    fileViewer,
    openFileViewer,
    closeFileViewer,
  };
};
