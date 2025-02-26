import React, { useState } from "react";
import axios from "axios";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");
  const [fileType, setFileType] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (file.name.endsWith(".csv")) {
        setFileType("CSV");
      } else if (file.name.endsWith(".txt")) {
        setFileType("TXT");
      } else if (file.name.endsWith(".fits")) {
        setFileType("FITS");
      } else {
        setMessage("Unsupported file type.");
        return;
      }
      setMessage(`Selected file: ${file.name} (${fileType})`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post("http://127.0.0.1:8000/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage(response.data.message);
    } catch (error) {
      setMessage("Upload failed.");
      console.error(error);
    }
  };

  return (
    <div className="App">
      <h1>Photometry Web App</h1>
      <input type="file" accept=".fits,.csv,.txt" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload File</button>
      <p>{message}</p>
    </div>
  );
}

export default App;

