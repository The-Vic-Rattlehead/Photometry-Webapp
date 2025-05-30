from fastapi import FastAPI, File, UploadFile
import shutil
import os
import pandas as pd
from astropy.io import fits
from astropy.visualization import  LogStretch, ImageNormalize,  SqrtStretch
from PIL import Image
import numpy as np
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import io
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Define the absolute path for the upload folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Mount the static folder so we can serve converted images
app.mount("/static", StaticFiles(directory=UPLOAD_FOLDER), name="static")

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    # Save the uploaded file
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    response_data = {"filename": file.filename, "message": "File uploaded successfully!"}
    # If it's a FITS file, convert it to PNG
    if file.filename.lower().endswith(".fits") or file.filename.lower().endswith(".fts"):
        png_filename = file.filename.rsplit(".", 1)[0] + ".png"
        png_path = os.path.join(UPLOAD_FOLDER, png_filename)
        try:
            with fits.open(file_path) as hdul:
                data = hdul[0].data
                print('sanitize')
                data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)
                print('check ptp')
                if np.ptp(data) == 0:
                    raise ValueError("FITS image has no variation in pixel values.")
                print('ptp!=0 make float64')
                data = np.array(data, dtype=np.float64)
                print(np.min(data),np.max(data))
                print('set nrom')
                vmin=np.min(data)
                vmax=np.max(data)
                try:
                    norm = ImageNormalize(data, stretch=SqrtStretch(), clip=True, vmin=vmin, vmax=vmax)
                except Exception as e:
                    print("ImageNormalize failed:", repr(e))
                    raise
                print('normmalize data')
                normalized_data = norm(data)  # values are now float32 in 0–1 range
                print('convert to 8bit')
                # Convert to grayscale image for PNG saving (still needed for display)
                image_data = (normalized_data * 255).astype(np.uint8)
                print('create image')
                img = Image.fromarray(image_data)
                print('save')
                img.save(png_path)
                print('i love undertime slopper and the Based God!')
            return {
                "filename": png_filename,
                "message": f"{png_filename} converted to PNG successfully!",
                "image_url": f"http://127.0.0.1:8000/static/{png_filename}"
            }
        except Exception as e:
            return {"error": f"Conversion failed: {str(e)}"}
    
    if file.filename.lower().endswith('.csv') or file.filename.lower().endswith(".txt"):
        try:
            if file.filename.endswith(".txt") or file.filename.endswith(".csv"): 
                with open(file_path, "r", encoding="unicode_escape") as f:
                    contents = f.read()
                first_line = contents.splitlines()[0]
                if first_line.count(",") > first_line.count("\t"):
                    delimiter = ","
                else:
                    delimiter = "\t"
           
            
            df = pd.read_csv(file_path, sep=delimiter,encoding='unicode_escape',engine='python')
            df.fillna(" ", inplace=True)
            response_data["table_data"] = df.to_dict(orient="records")  # Convert to JSON format
            response_data["file_url"] = f"http://127.0.0.1:8000/static/{file.filename}"
            
        except Exception as e:
            response_data["error"] = f"CSV/TXT parsing failed: {str(e)}"
    return response_data

@app.post("/click")
async def receive_click(data: dict):
    x = data.get("x")
    y = data.get("y")
    print(f"User clicked at (x={x}, y={y})")
    return {"status": "ok", "received": [x, y]}

@app.get("/")
def read_root():
    return {"message": "fortnite!"}