const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" }); // Temporary upload directory
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname + "/public"));

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "/index.html"));
});

app.use(cors());
app.use(express.json());

// Endpoint to upload chunks
app.post("/upload", upload.single("fileChunk"), (req, res) => {
  console.log("req.body", req.body);

  const { chunkIndex, fileName } = req.body;
  const tempPath = req.file.path;
  const targetPath = path.join(
    __dirname,
    "uploads",
    fileName + "." + chunkIndex
  );

  // Move and rename the chunk for easier reassembly
  fs.rename(tempPath, targetPath, (err) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.send("Chunk uploaded successfully");
  });
});

// Endpoint to finalize the upload and reassemble the file
app.post("/finalize", (req, res) => {
  const { fileName, totalChunks } = req.body;

  const targetPath = path.join(__dirname, "uploads", fileName);

  // Create a write stream to assemble the file
  const fileWriteStream = fs.createWriteStream(targetPath);

  (async () => {
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(__dirname, "uploads", fileName + "." + i);

      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(fileWriteStream, { end: false });
        readStream.on("end", () => {
          fs.unlink(chunkPath, (err) => {
            // Delete chunk after merging
            if (err) reject(err);
            else resolve();
          });
        });
        readStream.on("error", (err) => reject(err));
      });
    }
    fileWriteStream.end();
  })()
    .then(() => {
      res.send("File reassembled successfully");
    })
    .catch((err) => {
      res.status(500).send(err.message);
    });
});

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

module.exports = app;
