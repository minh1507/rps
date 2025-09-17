import { useState } from 'react';
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

interface ChunkUploadProps {
  chunkSizeMB?: number;
}

const App: React.FC<ChunkUploadProps> = ({ chunkSizeMB = 5 }) => {
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>("");

  // Hàm upload 1 chunk
  const uploadChunk = async (
    fileId: string,
    file: File,
    chunkIndex: number,
    chunkSize: number,
    totalChunks: number
  ) => {
    const start = chunkIndex * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const blob = file.slice(start, end);

    const formData = new FormData();
    formData.append("file", blob, file.name);
    formData.append("fileId", fileId);
    formData.append("chunkIndex", chunkIndex.toString());
    formData.append("totalChunks", totalChunks.toString());

    let success = false;
    let retries = 0;

    while (!success && retries < 3) {
      try {
        await axios.post("http://localhost:8080/v1/file/upload/chunk", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            const total = event.total ?? blob.size;
            const chunkProgress = (event.loaded / total) / totalChunks;
            setProgress(((chunkIndex / totalChunks) + chunkProgress) * 100);
          },
        });
        success = true;
      } catch (err) {
        retries++;
        console.warn(`Retry chunk ${chunkIndex}, attempt ${retries}`);
        if (retries >= 3) throw new Error(`Failed to upload chunk ${chunkIndex}`);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const chunkSize = chunkSizeMB * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileId = uuidv4();

    setProgress(0);
    setStatus("Uploading...");

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        await uploadChunk(fileId, file, chunkIndex, chunkSize, totalChunks);
      }

      // Gọi API BE merge khi upload xong tất cả chunk
      await axios.post("http://localhost:8080/v1/file/upload/chunk/complete", {
        fileId,
        fileName: file.name,
        totalChunks,
      });

      setProgress(100);
      setStatus("Upload completed!");
    } catch (err) {
      console.error(err);
      setStatus("Error uploading file");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px" }}>
      <input type="file" onChange={handleFileChange} />
      <div style={{ marginTop: "10px" }}>
        <strong>Progress:</strong> {progress.toFixed(2)}%
      </div>
      <div style={{ marginTop: "5px" }}>
        <strong>Status:</strong> {status}
      </div>
    </div>
  );
};

export default App;
