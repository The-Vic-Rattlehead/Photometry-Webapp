import React, { useState, useRef } from "react";
import axios from "axios";


function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [tableData, setTableData] = useState([]);
  const [message, setMessage] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const imageRef = useRef(null);
  const [clickCoordinates, setClickCoordinates] = useState(null);
  
  const handleImageClick = (event) => {
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = imageRef.current.naturalWidth / rect.width;
    const scaleY = imageRef.current.naturalHeight / rect.height;

    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);

    console.log("Clicked coordinates:", x, y);

    // Optional: send to backendc
    axios.post("http://127.0.0.1:8000/click", { x, y })
    .then(res => {
      console.log("Backend received:", res.data);
      setClickCoordinates(res.data.received);
    })
    .catch(err => console.error("Error sending click data", err));
    };
  
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

      if (response.data.table_data) {
        setTableData(response.data.table_data);
      }

      if (response.data.file_url) {
        setFileUrl(response.data.file_url);
      }
      
    } catch (error) {
      setMessage("Upload failed.");
      console.error(error);
    }
  };

  return (
    <div className="App">
      <h1>Photometry Web App</h1>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload File</button>
      <p>{message}</p>

      {/* Show Image if FITS was uploaded */}
      {imageUrl && (
        <div>
          <h2>Processed Image:</h2>
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Converted FITS"
            onClick={handleImageClick}
            style={{ maxWidth: "600px", border: "1px solid #ccc", cursor: "crosshair" }}
          />
          {clickCoordinates && (
            <p>
              Clicked Coordinates: (x: {clickCoordinates[0]}, y: {clickCoordinates[1]})
            </p>
          )}
        </div>
      )}

      {/* Show Table if CSV/TXT was uploaded */}
      {tableData.length > 0 && (
        <div>
          <h2>CSV/TXT Data:</h2>
          <table border="1">
            <thead>
              <tr>
                {Object.keys(tableData[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Object.values(row).map((val, colIndex) => (
                    <td key={colIndex}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Show Download Link if CSV/TXT uploaded */}
      {fileUrl && (
        <p>
          <a href={fileUrl} download>Download Uploaded File</a>
        </p>
      )}
    </div>
  );
}

export default App;