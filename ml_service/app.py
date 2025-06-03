from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import scipy.io as sio
from predictClass import predict_from_file
import time
import numpy as np

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure upload folder
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['GENERATED_SIGNALS_DIR'] = 'generated_signals'

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['GENERATED_SIGNALS_DIR'], exist_ok=True)

# Global variables to track state
is_monitoring = False
last_processed_file = None

def convert_numpy_types(obj):
    """Convert numpy types to Python types for JSON serialization"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    return obj

@app.route("/predict", methods=["POST"])
def predict():
    """Handle file upload and prediction"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not file.filename.endswith('.mat'):
            return jsonify({"error": "Only .mat files are supported"}), 400

        # Save the uploaded file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(file_path)
        print(f"\nReceived and saved file: {file.filename}")
        
        try:
            # First, let's examine the contents of the .mat file
            try:
                mat_data = sio.loadmat(file_path, struct_as_record=False, squeeze_me=True)
                print("\nMAT file contents:")
                keys = [k for k in mat_data.keys() if not k.startswith('__')]
                print("Available keys:", keys)
                
                # Find essaisX key
                essais_key = None
                for key in keys:
                    if key.startswith('essais'):
                        essais_key = key
                        print(f"Found essais key: {essais_key}")
                        break

                # Check structure
                if essais_key:
                    print(f"\nExamining {essais_key} structure")
                    essais = mat_data[essais_key]
                    if hasattr(essais, 'Y'):
                        print("Found Y attribute")
                        Y = essais.Y
                        if isinstance(Y, (list, np.ndarray)):
                            print(f"Y contains {len(Y)} entries")
                            if isinstance(Y, np.ndarray) and Y.dtype.names is not None:
                                print("Y is a structured array with fields:", Y.dtype.names)
                            else:
                                for i, entry in enumerate(Y):
                                    print(f"Entry {i} attributes:", [attr for attr in dir(entry) if not attr.startswith('__')])
                    
                    # Check for direct attributes
                    attrs = [attr for attr in dir(essais) if not attr.startswith('__')]
                    print(f"\nDirect attributes in {essais_key}:", attrs)
                
            except Exception as e:
                print(f"Error examining .mat file: {str(e)}")

            # Read the file data for prediction
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # Make prediction
            result = predict_from_file(file_data)
            
            # Convert numpy types to Python types
            result = convert_numpy_types(result)
            
            return jsonify(result)
            
        except Exception as e:
            return jsonify({
                "status": "error",
                "error": f"Prediction failed: {str(e)}"
            }), 500
            
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@app.route("/start-monitoring", methods=["POST"])
def start_monitoring():
    global is_monitoring
    try:
        if is_monitoring:
            return jsonify({"status": "already_running"}), 400

        is_monitoring = True
        print("Monitoring started")
        return jsonify({"status": "started"})
    except Exception as e:
        print(f"Error starting monitoring: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/stop-monitoring", methods=["POST"])
def stop_monitoring():
    global is_monitoring, last_processed_file
    try:
        is_monitoring = False
        last_processed_file = None
        print("Monitoring stopped")
        return jsonify({"status": "stopped"})
    except Exception as e:
        print(f"Error stopping monitoring: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/get-monitoring-status", methods=["GET"])
def get_monitoring_status():
    global is_monitoring, last_processed_file
    try:
        if not is_monitoring:
            return jsonify({
                "status": "stopped",
                "prediction": None,
                "timestamp": None
            })

        # Get the latest file from the generated_signals directory
        files = [f for f in os.listdir(app.config['GENERATED_SIGNALS_DIR']) if f.endswith('.mat')]
        print(f"Found {len(files)} .mat files in directory")
        
        if not files:
            return jsonify({
                "status": "waiting",
                "prediction": None,
                "timestamp": None,
                "message": "Waiting for signal files..."
            })

        # Get latest file
        latest_file = max(files, key=lambda x: os.path.getctime(os.path.join(app.config['GENERATED_SIGNALS_DIR'], x)))
        file_path = os.path.join(app.config['GENERATED_SIGNALS_DIR'], latest_file)
        current_timestamp = os.path.getctime(file_path)

        # Always process the latest file
        print(f"Processing file: {latest_file}")
        
        # Read the file and make prediction
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        result = predict_from_file(file_data)
        last_processed_file = file_path
        
        # Convert numpy types to Python types
        result = convert_numpy_types(result)
        
        # Create monitoring response with all necessary information
        monitoring_response = {
            "status": "running",
            "timestamp": current_timestamp,
            "prediction": {
                "state": result["prediction"],
                "confidence": result["confidence"],
                "details": {
                    "class_probabilities": result["class_probabilities"],
                    "validation_patterns": result["validation_patterns"]
                }
            },
            "signals": result.get("signals", {}),
            "metrics": result.get("metrics", {})
        }
        
        print("\nMonitoring Response:")
        print(f"State: {monitoring_response['prediction']['state']}")
        print(f"Confidence: {monitoring_response['prediction']['confidence']:.2f}")
        print("Class Probabilities:", result["class_probabilities"])
        
        return jsonify(monitoring_response)
        
    except Exception as e:
        print(f"Error in get_monitoring_status: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "error": str(e),
            "prediction": None,
            "timestamp": None
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5600)
