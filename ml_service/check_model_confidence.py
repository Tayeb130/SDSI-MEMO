import tensorflow as tf
import numpy as np
from utils import convert_mat_to_npz
import os

# Load the model
print("Loading model...")
model = tf.keras.models.load_model('cnn_lstm_motor_model_fixed.h5')

def softmax(x):
    """Apply softmax function to get probabilities"""
    exp_x = np.exp(x - np.max(x))  # Subtract max for numerical stability
    return exp_x / exp_x.sum()

def analyze_prediction(signals):
    """Analyze model prediction and confidence"""
    # Reshape for model input: (9, 50001) -> (1, 50001, 9)
    processed = np.transpose(signals, (1, 0))  # shape: (50001, 9)
    processed = np.expand_dims(processed, axis=0)  # shape: (1, 50001, 9)
    
    # Get raw predictions
    raw_predictions = model.predict(processed, verbose=0)
    print("\nRaw model output:", raw_predictions[0])
    
    # Try different temperature scaling for softmax
    temperatures = [1.0, 0.5, 0.2]
    for temp in temperatures:
        scaled_predictions = raw_predictions[0] / temp
        probs = softmax(scaled_predictions)
        print(f"\nProbabilities with temperature {temp}:")
        print(f"cassure: {probs[0]:.4f}")
        print(f"sain: {probs[1]:.4f}")
        print(f"desiquilibre: {probs[2]:.4f}")

# Test with a sample file if available
test_files = [f for f in os.listdir('uploads') if f.endswith('.mat')]
if test_files:
    print(f"\nFound test files: {test_files}")
    for test_file in test_files[:3]:  # Test up to 3 files
        print(f"\nAnalyzing {test_file}...")
        try:
            signals = convert_mat_to_npz(os.path.join('uploads', test_file))
            analyze_prediction(signals)
        except Exception as e:
            print(f"Error analyzing {test_file}: {str(e)}")
else:
    print("\nNo test files found in uploads directory") 