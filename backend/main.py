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
    allow_origins=["*"],
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
            print(f"Processing {file.filename} as CSV/TXT")  # ✅ Debugging

            # Determine delimiter
            # if file.filename.endswith(".csv"): 
            #     delimiter=","
            # else: 
            #     delimiter="\t"

            # Read CSV/TXT into DataFrame
            
            data_path = os.path.join(UPLOAD_FOLDER, file.filename)
            print(data_path)
            df = pd.read_csv(data_path, sep='\t',encoding='unicode_escape')

            print(f"Parsed CSV/TXT with {df.shape[0]} rows and {df.shape[1]} columns")  # ✅ Confirm parsing success

            return {
                "filename": file.filename,
                "message": f"{file.filename} uploaded successfully!",
                "rows": df.shape[0],
                "columns": df.columns.tolist(),
                "sample_data": df.head(5).to_dict(orient="records"),
            }
        except Exception as e:
            return {"error": f"Parsing failed: {str(e)}"}
    return {"filename": file.filename, "message": "File uploaded successfully!"}

@app.get("/")
def read_root():
    return {"message": "fortnite!"}