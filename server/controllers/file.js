const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const generateMatFile = async (req, res) => {
  try {
    const { signals } = req.body;
    const mlServiceDir = path.join(__dirname, "../../ml_service");
    const pythonScript = path.join(mlServiceDir, "saveMat.py");
    const filePath = path.join(mlServiceDir, "temp_signals.mat");

    // Ensure ml_service directory exists
    if (!fs.existsSync(mlServiceDir)) {
      fs.mkdirSync(mlServiceDir, { recursive: true });
    }

    const python = spawn("python", [
      pythonScript,
      JSON.stringify(signals),
      filePath, // Pass the file path to Python script
    ]);

    python.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (output === "SUCCESS") {
        res.download(filePath, "signals.mat", (err) => {
          if (err) {
            console.error("Error sending file:", err);
            res.status(500).json({ message: "Error sending file" });
          }
          // Clean up
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
        });
      }
    });

    python.stderr.on("data", (data) => {
      console.error(`Python Error: ${data}`);
      res.status(500).json({ message: "Error generating MAT file" });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error generating MAT file" });
  }
};

module.exports = { generateMatFile };
