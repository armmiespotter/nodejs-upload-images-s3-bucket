const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const app = express();
const port = 3000;

// Serve the HTML file
app.use(express.static(path.join(__dirname, "public")));

// Configure AWS SDK
const s3 = new AWS.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_CONFIG_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_CONFIG_SECRET_ACCESS_KEY,
  endpoint: process.env.S3_CONFIG_END_POINT,
  s3ForcePathStyle: true, // Required for local S3 endpoints
  signatureVersion: "v4", // Use AWS Signature Version 4
});

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.array("files"), async (req, res) => {
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }
  const pathFolder = Date.now();
  try {
    // Process files in the order they appear in req.files
    const uploadPromises = files.map((file, index) => {
      const fileStream = fs.createReadStream(file.path);
      const uploadParams = {
        Bucket: process.env.BUCKET_NAME, // Replace with your bucket name
        Key: `${pathFolder}/${file.originalname}`,
        Body: fileStream,
        ACL: "public-read", // Adjust the ACL as needed
      };

      return s3
        .upload(uploadParams)
        .promise()
        .then((result) => {
          // Ensure the result maintains the original file order
          return {
            index,
            location: result.Location,
            key: result.Key,
          };
        });
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Clean up the uploaded files from the local filesystem
    files.forEach((file) => fs.unlinkSync(file.path));

    // Sort results by original index to maintain order
    uploadResults.sort((a, b) => a.index - b.index);
    const imageLinks = uploadResults.map((result) => {
      return {
        imageUrl: `<img src="${process.env.IMAGE_BASE_PATH}/${result.key}"/>`,
      };
    });

    res.json({
      message: "Files uploaded successfully",
      files: imageLinks,
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).send("Error uploading files.");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
