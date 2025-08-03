from fastapi import FastAPI, File, UploadFile, HTTPException # type: ignore
from fastapi.staticfiles import StaticFiles # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
import os
import shutil
from astropy.io import fits
from astropy.wcs import WCS
import numpy as np
from astropy.visualization import ImageNormalize, LogStretch
from PIL import Image
from threading import Lock
from astropy.coordinates import Angle
import astropy.units as u
import pandas as pd

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory to save uploads and PNGs
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOAD_FOLDER), name="static")

# Thread-safe dictionaries to store WCS and image height per filename
fits_wcs_map = {}      # maps FITS‐filename → WCS object
fits_height_map = {}   # maps FITS‐filename → image height (pixels)
fits_map_lock = Lock()

# Constants for FITS header binary reading
BLOCK_SIZE = 2880  # FITS header block size
CARD_SIZE = 80     # Each header “card” is 80 bytes

def read_raw_header_lines(fits_path: str):
    """
    Open the FITS file in binary mode and read 2880-byte blocks until
    an 'END' card is encountered. Return a list of raw 80-byte header lines.
    """
    raw_lines = []
    with open(fits_path, "rb") as f:
        while True:
            block = f.read(BLOCK_SIZE)
            if not block:
                break
            for i in range(0, BLOCK_SIZE, CARD_SIZE):
                card_bytes = block[i : i + CARD_SIZE]
                try:
                    line = card_bytes.decode("ascii", errors="ignore")
                except Exception:
                    # Fallback to Latin-1 to ensure we get 80 characters
                    line = card_bytes.decode("latin-1", errors="ignore")
                raw_lines.append(line)
                if line.startswith("END"):
                    return raw_lines
    return raw_lines

def sanitize_raw_lines(raw_lines):
    """
    Given a list of raw 80-character header lines, return one ASCII-only
    multi-line string by dropping any character whose codepoint is not 32–126.
    """
    cleaned = []
    for line in raw_lines:
        # Keep only ASCII printable (decimal 32–126), which excludes tabs and non-ASCII
        filtered = "".join(ch for ch in line if 32 <= ord(ch) <= 126)
        cleaned.append(filtered)
    return "\n".join(cleaned) + "\n"


@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    # 1) Save the uploaded file to disk
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    response_data = {"filename": file.filename, "message": "File uploaded successfully!"}

    lower = file.filename.lower()
    if lower.endswith(".fits") or lower.endswith(".fts"):
        png_filename = file.filename.rsplit(".", 1)[0] + ".png"
        png_path = os.path.join(UPLOAD_FOLDER, png_filename)

        try:
            # ─────────────────────────────────────────────────
            # (A) Open with verify="fix" to truncate/rename illegal keywords (e.g. WCS-FWHM)
            # ─────────────────────────────────────────────────
            hdul = fits.open(file_path, verify="fix")
            raw_header = hdul[0].header
            data = hdul[0].data

            # ─────────────────────────────────────────────────
            # (B) Read the raw header lines from disk (80 bytes each) to bypass parsing
            # ─────────────────────────────────────────────────
            raw_lines = read_raw_header_lines(file_path)

            # ─────────────────────────────────────────────────
            # (C) Sanitize those raw lines (drop any char outside ASCII 32–126)
            # ─────────────────────────────────────────────────
            clean_header_str = sanitize_raw_lines(raw_lines)

            # ─────────────────────────────────────────────────
            # (D) Rebuild a new Header from the sanitized ASCII‐only string
            # ─────────────────────────────────────────────────
            clean_header = fits.Header.fromstring(clean_header_str, sep="\n")

            # ─────────────────────────────────────────────────
            # (E) Build WCS from the clean header
            # ─────────────────────────────────────────────────
            wcs = WCS(clean_header)

            # ─────────────────────────────────────────────────
            # (F) Store WCS and image height (for pixel→sky later)
            # ─────────────────────────────────────────────────
            with fits_map_lock:
                fits_wcs_map[file.filename] = wcs
                fits_height_map[file.filename] = data.shape[0]

            # ─────────────────────────────────────────────────
            # (G) Now perform your existing normalization → PNG conversion
            # ─────────────────────────────────────────────────
            arr = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)
            if np.ptp(arr) == 0:
                raise ValueError("FITS image has no variation in pixel values.")
            arr = arr.astype(np.float64)
            vmin, vmax = np.min(arr), np.max(arr)
            norm = ImageNormalize(arr, stretch=LogStretch(), clip=True, vmin=vmin, vmax=vmax)
            norm_data = norm(arr)
            img_data = (norm_data * 255).astype(np.uint8)
            flipped = np.flipud(img_data)
            img = Image.fromarray(flipped)
            img.save(png_path)

            hdul.close()

            return {
                "fits_filename": file.filename,      # original FITS
                "filename": png_filename,
                "message": f"{png_filename} converted to PNG successfully!",
                "image_url": f"http://127.0.0.1:8000/static/{png_filename}"
            }

        except Exception as e:
            # Cleanup if needed
            if "hdul" in locals():
                hdul.close()
            return {"error": f"Conversion or WCS build failed: {str(e)}"}

    # CSV/TXT handling (unchanged)
    if lower.endswith(".csv") or lower.endswith(".txt"):
        try:
            # Your existing CSV/TXT parsing code here …
            with open(file_path, "r", encoding="unicode_escape") as f:
                contents = f.read()
            first_line = contents.splitlines()[0]
            if first_line.count(",") > first_line.count("\t"):
                print('poop!')
                delimiter = ","
            else:
                print('pee!')
                delimiter = "\t"
            df = pd.read_csv(file_path, sep=delimiter, encoding="unicode_escape", engine="c")
            df.fillna(" ", inplace=True)
            response_data["table_data"] = df.to_dict(orient="records")
            response_data["file_url"] = f"http://127.0.0.1:8000/static/{file.filename}"
        except Exception as e:
            response_data["error"] = f"CSV/TXT parsing failed: {str(e)}"

    return response_data


from fastapi import HTTPException # type: ignore

@app.post("/click")
async def receive_click(data: dict):
    # 1) Extract and validate inputs
    filename = data.get("filename")
    x = data.get("x")
    y = data.get("y")

    if filename is None or x is None or y is None:
        raise HTTPException(status_code=400, detail="Missing filename, x or y.")

    # 2) Look up the stored WCS and image height
    with fits_map_lock:
        wcs = fits_wcs_map.get(filename)
        height = fits_height_map.get(filename)
        

    if wcs is None or height is None:
        raise HTTPException(status_code=404, detail="No WCS data found for this filename.")

    # 3) Flip Y coordinate (image origin vs. FITS origin)
    corrected_y = height - y

    # 4) Compute RA/Dec (this may return numpy types)
    try:
        ra_arr, dec_arr = wcs.all_pix2world(x, corrected_y, 0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WCS conversion failed: {e}")

    # 5) Cast RA/Dec to plain Python floats
    try:
        ra_py = float(ra_arr)
        dec_py = float(dec_arr)
    except Exception:
        # If they’re already Python floats, this still works; if not, this forces conversion.
        raise HTTPException(status_code=500, detail="Unable to cast RA/Dec to float.")

    # 6) Convert to H M S and D M S strings using Astropy.Angle
    #    - RA is an angle in degrees, but we want to represent it in hours:minutes:seconds
    ra_angle = Angle(ra_py * u.deg)
    #    "hms" produces a string like "06h08m03.43s"
    ra_hms = ra_angle.to_string(unit=u.hour, sep="hms", precision=2, pad=True)

    #    Dec is an angle in degrees, displayed as "+DDdMMmSS.ss"
    dec_angle = Angle(dec_py * u.deg)
    #    "dms" produces a string like "+24d05m00.00s"
    dec_dms = dec_angle.to_string(
        unit=u.deg,
        sep="dms",
        precision=2,
        pad=True,
        alwayssign=True
    )
     # 7) Return everything as native Python types
    return {
        "status":    "ok",
        "received":  [float(x), float(corrected_y)],
        "ra_hms":    ra_hms,     # e.g. "06h08m03.43s"
        "dec_dms":   dec_dms,    # e.g. "+24d05m00.00s"
    }

