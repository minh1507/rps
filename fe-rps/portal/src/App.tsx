import { useState } from "react";
import axios from "axios";
import "./App.css";

interface ChunkUploadProps {
  chunkSizeMB?: number;
  concurrency?: number;
}

const App: React.FC<ChunkUploadProps> = ({ chunkSizeMB = 5, concurrency = 3 }) => {
  const [chunkProgress, setChunkProgress] = useState(0);
  const [chunkStatus, setChunkStatus] = useState("");

  const [regularProgress, setRegularProgress] = useState(0);
  const [regularStatus, setRegularStatus] = useState("");

  const [downloadFileName, setDownloadFileName] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");

  // --- Upload chunk ---
  const uploadChunk = async (
    fileName: string,
    uploadId: string,
    partNumber: number,
    chunk: Blob,
    totalChunks: number
  ) => {
    const formData = new FormData();
    formData.append("file", chunk, `${fileName}.part${partNumber}`);

    await axios.post(
      `http://localhost:8080/v1/file/part?fileName=${fileName}&uploadId=${uploadId}&partNumber=${partNumber}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          const total = event.total ?? chunk.size;
          const progress = ((event.loaded / total) / totalChunks + (partNumber - 1) / totalChunks) * 100;
          setChunkProgress((prev) => Math.min(100, Math.max(prev, progress)));
        },
      }
    );
  };

  const handleChunkedUpload = async (file: File) => {
    const chunkSize = chunkSizeMB * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);

    setChunkProgress(0);
    setChunkStatus("Uploading in chunks...");

    const startTime = Date.now(); // Bắt đầu đo thời gian
    console.log(`[Chunk Upload] Start: ${new Date(startTime).toLocaleTimeString()}`);

    try {
      const initRes = await axios.post(
        `http://localhost:8080/v1/file/init?fileName=${encodeURIComponent(file.name)}`
      );
      const uploadId = initRes.data.uploadId;

      let index = 0;
      const runNextBatch = async () => {
        const promises = [];
        for (let i = 0; i < concurrency && index < totalChunks; i++, index++) {
          const start = index * chunkSize;
          const end = Math.min(file.size, start + chunkSize);
          const chunk = file.slice(start, end);
          const partNumber = index + 1;
          promises.push(uploadChunk(file.name, uploadId, partNumber, chunk, totalChunks));
        }
        await Promise.all(promises);
        if (index < totalChunks) await runNextBatch();
      };
      await runNextBatch();

      await axios.post(
        `http://localhost:8080/v1/file/complete?fileName=${encodeURIComponent(file.name)}&uploadId=${uploadId}`
      );

      const endTime = Date.now();
      console.log(`[Chunk Upload] End: ${new Date(endTime).toLocaleTimeString()}`);
      console.log(`[Chunk Upload] Total time: ${(endTime - startTime) / 1000}s`);

      setChunkProgress(100);
      setChunkStatus("Chunk upload completed!");
    } catch (error) {
      console.error(error);
      setChunkStatus("Error uploading file in chunks");
    }
  };

  // --- Regular Upload ---
  const handleRegularUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    setRegularProgress(0);
    setRegularStatus("Uploading whole file...");

    try {
      await axios.post("http://localhost:8080/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          const total = event.total ?? file.size;
          setRegularProgress((event.loaded / total) * 100);
        },
      });

      setRegularProgress(100);
      setRegularStatus("Regular upload completed!");
    } catch (error) {
      console.error(error);
      setRegularStatus("Error uploading file");
    }
  };

  // --- Download with progress ---
  const handleDownload = async () => {
  if (!downloadFileName) return setDownloadStatus("Enter file name");

  setDownloadStatus("Downloading...");
  setDownloadProgress(0);

  const startTime = Date.now();
  console.log(`[Download] Start: ${new Date(startTime).toLocaleTimeString()}`);

  try {
    const response = await axios.get(
      `http://localhost:8080/v1/file/download?fileName=${encodeURIComponent(downloadFileName)}`,
      {
        responseType: "blob",
        onDownloadProgress: (event) => {
          // Sử dụng event.total thay vì response.headers
          const total = event.total || 1; 
          const progress = (event.loaded / total) * 100;
          setDownloadProgress(progress);
        },
      }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    const endTime = Date.now();
    console.log(`[Download] End: ${new Date(endTime).toLocaleTimeString()}`);
    console.log(`[Download] Total time: ${(endTime - startTime) / 1000}s`);

    setDownloadProgress(100);
    setDownloadStatus("Download completed!");
  } catch (error) {
    console.error(error);
    setDownloadStatus("Error downloading file");
  }
};



  // --- UI render ---
  const renderUploadCard = (
    title: string,
    progress: number,
    status: string,
    onFileSelect: (file: File) => Promise<void>
  ) => (
    <div className="card">
      <h3>{title}</h3>
      <input
        type="file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await onFileSelect(file);
        }}
      />
      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="status-text">{status}</div>
      <div className="status-text">{progress.toFixed(2)}%</div>
    </div>
  );

  const renderDownloadCard = () => (
    <div className="card">
      <h3>Download File</h3>
      <div className="download-input-container">
        <input
          type="text"
          placeholder="Enter file name"
          value={downloadFileName}
          onChange={(e) => setDownloadFileName(e.target.value)}
        />
        <button onClick={handleDownload}>Download</button>
      </div>
      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${downloadProgress}%` }} />
      </div>
      <div className="status-text">{downloadStatus}</div>
      <div className="status-text">{downloadProgress.toFixed(2)}%</div>
    </div>
  );

  return (
    <div className="app-container">
      {renderUploadCard("Chunk Upload", chunkProgress, chunkStatus, handleChunkedUpload)}
      {renderUploadCard("Regular Upload", regularProgress, regularStatus, handleRegularUpload)}
      {renderDownloadCard()}
    </div>
  );
};

export default App;
