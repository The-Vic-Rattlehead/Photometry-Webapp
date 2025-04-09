from fastapi import FastAPI, File, UploadFile
import shutil
import os
import pandas as pd
from astropy.io import fits
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
    if file.filename.lower().endswith(".fits"):
        png_filename = file.filename.rsplit(".", 1)[0] + ".png"
        png_path = os.path.join(UPLOAD_FOLDER, png_filename)
        try:
            with fits.open(file_path) as hdul:
                data = hdul[0].data
                # Normalize data to 0-255 range
                norm_data = (data - np.min(data)) / np.ptp(data) * 255
                norm_data = norm_data.astype(np.uint8)
                img = Image.fromarray(norm_data)
                img.save(png_path)
            return {
                "filename": png_filename,
                "message": f"{png_filename} converted to PNG successfully!",
                "image_url": f"http://127.0.0.1:8000/static/{png_filename}"
            }
        except Exception as e:
            return {"error": f"Conversion failed: {str(e)}"}
    
    if file.filename.lower().endswith('.csv') or file.filename.lower().endswith(".txt"):
        try:
            if file.filename.endswith(".txt"): 
                delimiter="\t"
            else: 
                delimiter=" , "
            
            df = pd.read_csv(file_path, sep=delimiter,encoding='unicode_escape',engine='python')
            df.fillna(" ", inplace=True)
            response_data["table_data"] = df.to_dict(orient="records")  # Convert to JSON format
            response_data["file_url"] = f"http://127.0.0.1:8000/static/{file.filename}"
            
        except Exception as e:
            response_data["error"] = f"CSV/TXT parsing failed: {str(e)}"
    return response_data

@app.get("/")
def read_root():
    return {"message": "fortnite!"}