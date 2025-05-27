from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import scipy.io as sio
from predictClass import predict_from_file
from generate_signal_mat import create_mat_file
import h5py

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'mat', 'npz'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/predict", methods=["POST"])
def predict():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file format. Use .mat or .npz"}), 400

    try:
        # Save file temporarily for debugging
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        print(f"File saved temporarily at: {filepath}")  # Debug print
        
        # Read the file content
        with open(filepath, 'rb') as f:
            file_data = f.read()
            
        print(f"File size: {len(file_data)} bytes")  # Debug print
        
        # Try to read with scipy first for debug
        try:
            mat_contents = sio.loadmat(filepath)
            print(f"File keys using scipy: {mat_contents.keys()}")  # Debug print
        except Exception as e:
            print(f"scipy.io.loadmat failed: {str(e)}")
            
        # Try to read with h5py for debug
        try:
            with h5py.File(filepath, 'r') as f:
                print(f"File keys using h5py: {list(f.keys())}")  # Debug print
        except Exception as e:
            print(f"h5py.File failed: {str(e)}")
        
        # Make prediction with the file data
        result = predict_from_file(file_data)
        
        # Clean up
        try:
            os.remove(filepath)
        except Exception as e:
            print(f"Failed to remove temporary file: {str(e)}")
        
        return jsonify(result)
    except Exception as e:
        print(f"Error processing file: {str(e)}")  # Add debug print
        return jsonify({"error": str(e)}), 500

@app.route("/generate-signals", methods=["POST"])
def generate_signals():
    try:
        # Get essais number from request, default to 1
        data = request.get_json()
        essais_num = data.get('essais_num', 1) if data else 1
        
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], f'generated_signals_essais{essais_num}.mat')
        success = create_mat_file(output_path, essais_num)
        
        if success:
            try:
                return send_file(
                    output_path,
                    as_attachment=True,
                    download_name=f'signals_essais{essais_num}.mat',
                    mimetype='application/octet-stream'
                )
            finally:
                # Schedule the file for deletion after sending
                @after_this_request
                def remove_file(response):
                    try:
                        if os.path.exists(output_path):
                            os.remove(output_path)
                    except Exception as e:
                        app.logger.warning(f"Error removing file: {e}")
                    return response
        else:
            return jsonify({"error": "Failed to generate signals"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5600)
