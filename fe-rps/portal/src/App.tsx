import { useState } from 'react';
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import './App.css';

interface ChunkUploadProps {
  chunkSizeMB?: number;
}

const App: React.FC<ChunkUploadProps> = ({ chunkSizeMB = 5 }) => {
  // --- Chunked Upload State ---
  const [chunkProgress, setChunkProgress] = useState<number>(0);
  const [chunkStatus, setChunkStatus] = useState<string>("");

  // --- Regular Upload State ---
  const [regularProgress, setRegularProgress] = useState<number>(0);
  const [regularStatus, setRegularStatus] = useState<string>("");

  // --- Chunked upload ---
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
            const chunkProg = (event.loaded / total) / totalChunks;
            setChunkProgress(((chunkIndex / totalChunks) + chunkProg) * 100);
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

  const handleChunkedUpload = async (file: File) => {
    const chunkSize = chunkSizeMB * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileId = uuidv4();

    setChunkProgress(0);
    setChunkStatus("Uploading in chunks...");

    try {
      for (let i = 0; i < totalChunks; i++) {
        await uploadChunk(fileId, file, i, chunkSize, totalChunks);
      }

      await axios.post("http://localhost:8080/v1/file/upload/chunk/complete", {
        fileId,
        fileName: file.name,
        totalChunks,
      });

      setChunkProgress(100);
      setChunkStatus("Chunk upload completed!");
    } catch (err) {
      console.error(err);
      setChunkStatus("Error uploading file in chunks");
    }
  };

  // --- Regular upload ---
  const handleRegularUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    setRegularProgress(0);
    setRegularStatus("Uploading whole file...");

    try {
      await axios.post("http://localhost:8080/v1/file/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          const total = event.total ?? file.size;
          setRegularProgress((event.loaded / total) * 100);
        },
      });

      setRegularProgress(100);
      setRegularStatus("Regular upload completed!");
    } catch (err) {
      console.error(err);
      setRegularStatus("Error uploading file");
    }
  };

  return (
      <div className="app-container">
        {/* --- Chunk Upload Card --- */}
        <div className="card">
          <h3>Chunk Upload</h3>
          <input
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await handleChunkedUpload(file);
              }}
          />
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${chunkProgress}%` }}></div>
          </div>
          <div className="status-text">{chunkStatus}</div>
          <div className="status-text">{chunkProgress.toFixed(2)}%</div>
        </div>

        {/* --- Regular Upload Card --- */}
        <div className="card">
          <h3>Regular Upload</h3>
          <input
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await handleRegularUpload(file);
              }}
          />
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${regularProgress}%` }}></div>
          </div>
          <div className="status-text">{regularStatus}</div>
          <div className="status-text">{regularProgress.toFixed(2)}%</div>
        </div>
      </div>
  );
};

export default App;
