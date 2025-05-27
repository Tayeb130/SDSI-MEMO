import tensorflow as tf
import numpy as np

# Load the model
print("Loading model...")
model = tf.keras.models.load_model('cnn_lstm_motor_model_fixed.h5')

print("\nModel Summary:")
model.summary()

print("\nModel Input Shape:", model.input_shape)
print("Model Output Shape:", model.output_shape)

# Create a sample input to test
sample_input = np.random.randn(1, 50001, 9)
print("\nTesting prediction with random input...")
pred = model.predict(sample_input, verbose=0)
print("Prediction shape:", pred.shape)
print("Raw prediction:", pred[0])
print("Predicted class:", np.argmax(pred[0])) 