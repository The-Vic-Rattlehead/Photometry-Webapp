import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);

  // We only need these two for our main workflow:
  // - fitsFilename: string that we send to /click (e.g. "…_stack_wcs.fits")
  // - imageUrl:     string URL for <img> (e.g. "http://127.0.0.1:8000/static/…png")
  const [fitsFilename, setFitsFilename] = useState("");
  const [imageUrl,     setImageUrl]     = useState("");

  const [tableData,       setTableData]       = useState([]);
  const [message,         setMessage]         = useState("");
  const [fileUrl,         setFileUrl]         = useState("");
  const [clickCoordinates, setClickCoordinates] = useState(null);
  const [raHms, setRaHms]   = useState("");
  const [decDms, setDecDms] = useState("");

  const imageRef        = useRef(null);
  const tableWrapperRef = useRef(null);

  // This effect just makes your right‐pane table scrollable by dragging.
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
      e.preventDefault();
      const x = e.pageX - table.offsetLeft;
      const y = e.pageY - table.offsetTop;
      table.scrollLeft = scrollLeft - (x - startX) * 1.5;
      table.scrollTop  = scrollTop - (y - startY) * 1.5;
    };

    table.addEventListener("mousedown",  mouseDownHandler);
    table.addEventListener("mouseleave", mouseLeaveHandler);
    table.addEventListener("mouseup",    mouseUpHandler);
    table.addEventListener("mousemove",  mouseMoveHandler);

    return () => {
      table.removeEventListener("mousedown",  mouseDownHandler);
      table.removeEventListener("mouseleave", mouseLeaveHandler);
      table.removeEventListener("mouseup",    mouseUpHandler);
      table.removeEventListener("mousemove",  mouseMoveHandler);
    };
  }, []);

  // Called when the user clicks on the displayed PNG.
  // It computes (x, y) in FITS‐pixel coords, then sends { filename: fitsFilename, x, y } to /click.
  const handleImageClick = (event) => {
    if (!fitsFilename) {
      console.error("No FITS filename defined—cannot request RA/Dec.");
      return;
    }

    const rect   = imageRef.current.getBoundingClientRect();
    const scaleX = imageRef.current.naturalWidth / rect.width;
    const scaleY = imageRef.current.naturalHeight / rect.height;

    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top)  * scaleY);

    axios
      .post("http://127.0.0.1:8000/click", {
        filename: fitsFilename,  // matches the key stored in fits_wcs_map
        x: x,
        y: y,
      })
      .then((res) => {
        if (res.data.status === "ok") {
          setClickCoordinates(res.data.received);
          setRaHms(res.data.ra_hms);
          setDecDms(res.data.dec_dms);
        } else {
          console.error("Backend responded with an error:", res.data);
        }
      })
      .catch((err) => {
        console.error("Error sending click data:", err);
      });
  };

  // Called when the user selects a file from <input type="file" />.
  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  // Called when the user clicks “Upload File.”
  // Uploads the FITS to /upload/, then reads fits_filename + filename + image_url from the response.
  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/upload/",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      console.log("upload response.data:", response.data);
      setMessage(response.data.message);

      // 1) Save the FITS filename (for future /click calls).
      if (response.data.fits_filename) {
        setFitsFilename(response.data.fits_filename);
        // e.g. "ngc2158_30_hi_i-0001_stack_wcs.fits"
      }

      // 2) Save the image URL so React can display the PNG.
      if (response.data.image_url) {
        setImageUrl(response.data.image_url);
        // e.g. "http://127.0.0.1:8000/static/ngc2158_30_hi_i-0001_stack_wcs.png"
      }

      // 3) If CSV/TXT parsing yielded table_data, store that, too.
      if (response.data.table_data) {
        setTableData(response.data.table_data);
      }

      // 4) If there’s a file URL for downloading the original FITS/CSV, store that.
      if (response.data.file_url) {
        setFileUrl(response.data.file_url);
      }
    } catch (error) {
      setMessage("Upload failed.");
      console.error("Upload error:", error);
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
        {/* Left pane: show the converted image (if imageUrl is set) */}
        <div className="left-pane">
          {imageUrl && (
            <>
              <h2>Processed Image:</h2>
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Converted FITS"
                onClick={handleImageClick}
                style={{
                  maxWidth: "100%",
                  border: "1px solid #ccc",
                  cursor: "crosshair",
                }}
              />

              {clickCoordinates && (
                <div style={{ marginTop: "1em" }}>
                  <p>
                    Clicked FITS‐pixel: (x: {clickCoordinates[0]}, y:{clickCoordinates[1]})
                  </p>
                  {raHms && decDms ? (
                    <p>
                      RA: {raHms.replace(/h/, " h ").replace(/m/, " m ")} , 
                      Dec: {decDms.replace(/d/, " ° ").replace(/m/, " ′ ")}″
                    </p>
                  ) : (
                    <p>Click on the image to get RA/Dec…</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right pane: show CSV/TXT table data (if any) */}
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

      {/* Status messages and download link (if any) */}
      {message && <p className="status-msg">{message}</p>}
      {fileUrl && (
        <p className="download-link">
          <a href={fileUrl} download>
            Download Uploaded File
          </a>
        </p>
      )}
    </div>
  );
}

export default App;
