import React, { useState } from "react";
import axios from "axios";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
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
      if (response.data.image_url) {
        setImageUrl(response.data.image_url);
      }
    } catch (error) {
      setMessage("Upload failed.");
      console.error(error);
    }
  };

  return (
    <div className="App">
      <h1>Photometry Web App</h1>
      <input type="file" accept=".fits" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload FITS File</button>
      <p>{message}</p>
      {imageUrl && (
        <div>
          <h2>Processed Image:</h2>
          <img src={imageUrl} alt="Converted FITS" style={{ maxWidth: "600px", border: "1px solid #ccc" }} />
        </div>
      )}
    </div>
  );
}

export default App;


