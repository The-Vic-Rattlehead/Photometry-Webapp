import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [tableData, setTableData] = useState([]);
  const [message, setMessage] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const imageRef = useRef(null);
  const [clickCoordinates, setClickCoordinates] = useState(null);

  const tableWrapperRef = useRef(null);

  useEffect(() => {
    const table = tableWrapperRef.current;
    if (!table) return;

    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;

    const mouseDownHandler = (e) => {
      isDragging = true;
      startX = e.pageX - table.offsetLeft;
      startY = e.pageY - table.offsetTop;
      scrollLeft = table.scrollLeft;
      scrollTop = table.scrollTop;
      table.style.cursor = "grabbing";
      table.style.userSelect = "none";
    };

    const mouseLeaveHandler = () => {
      isDragging = false;
      table.style.cursor = "grab";
    };

    const mouseUpHandler = () => {
      isDragging = false;
      table.style.cursor = "grab";
    };

    const mouseMoveHandler = (e) => {
      if (!isDragging) return;
      e.preventDefault(); // Prevent text selection
      const x = e.pageX - table.offsetLeft;
      const y = e.pageY - table.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      table.scrollLeft = scrollLeft - walkX;
      table.scrollTop = scrollTop - walkY;
    };

    table.addEventListener("mousedown", mouseDownHandler);
    table.addEventListener("mouseleave", mouseLeaveHandler);
    table.addEventListener("mouseup", mouseUpHandler);
    table.addEventListener("mousemove", mouseMoveHandler);

    return () => {
      table.removeEventListener("mousedown", mouseDownHandler);
      table.removeEventListener("mouseleave", mouseLeaveHandler);
      table.removeEventListener("mouseup", mouseUpHandler);
      table.removeEventListener("mousemove", mouseMoveHandler);
    };
  }, []);

  const handleImageClick = (event) => {
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = imageRef.current.naturalWidth / rect.width;
    const scaleY = imageRef.current.naturalHeight / rect.height;

    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);

    console.log("Clicked coordinates:", x, y);

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
      if (response.data.image_url) setImageUrl(response.data.image_url);
      if (response.data.table_data) setTableData(response.data.table_data);
      if (response.data.file_url) setFileUrl(response.data.file_url);
    } catch (error) {
      setMessage("Upload failed.");
      console.error(error);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">[Logo]</div>
        <div className="upload-section">
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleUpload}>Upload File</button>
        </div>
      </header>

      <main className="main-body">
        <div className="left-pane">
          {imageUrl && (
            <>
              <h2>Processed Image:</h2>
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Converted FITS"
                onClick={handleImageClick}
                style={{ maxWidth: "100%", border: "1px solid #ccc", cursor: "crosshair" }}
              />
              {clickCoordinates && (
                <p>
                  Clicked Coordinates: (x: {clickCoordinates[0]}, y: {clickCoordinates[1]})
                </p>
              )}
            </>
          )}
        </div>

        <div className="right-pane">
          {tableData.length > 0 && (
            <>
              <h2>CSV/TXT Data:</h2>
              <div className="table-wrapper" ref={tableWrapperRef}>
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
            </>
          )}
        </div>
      </main>

      {message && <p className="status-msg">{message}</p>}
      {fileUrl && (
        <p className="download-link">
          <a href={fileUrl} download>Download Uploaded File</a>
        </p>
      )}
    </div>
  );
}

export default App;
