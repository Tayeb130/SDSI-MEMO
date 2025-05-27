import numpy as np
import scipy.io
import os

REQUIRED_SIGNALS = ['i1', 'i2', 'i3', 'v1', 'v2', 'v3', 'vn', 'w_m', 'vibrad']

def convert_mat_to_npz(mat_file_path):
    """Convert .mat file to preprocessed numpy array"""
    try:
        # Load .mat file
        mat_data = scipy.io.loadmat(mat_file_path, struct_as_record=False, squeeze_me=True)
        main_key = next(k for k in mat_data if not k.startswith("__"))
        
        # Extract signals
        signals = {}
        for entry in mat_data[main_key].Y:
            signal_name = entry.Name.split('/')[-2].replace('"', '')
            if signal_name in REQUIRED_SIGNALS:
                signals[signal_name] = entry.Data

        # Verify all required signals are present
        if not all(sig in signals for sig in REQUIRED_SIGNALS):
            missing = [sig for sig in REQUIRED_SIGNALS if sig not in signals]
            raise ValueError(f"Missing signals: {missing}")

        # Verify signal length
        if any(len(signal) != 50001 for signal in signals.values()):
            raise ValueError("All signals must have length 50001")
            
        # Stack and preprocess signals
        stacked_signals = np.stack([signals[key] for key in sorted(REQUIRED_SIGNALS)], axis=0)
        # Normalize
        stacked_signals = (stacked_signals - np.mean(stacked_signals, axis=1, keepdims=True)) / \
                         (np.std(stacked_signals, axis=1, keepdims=True) + 1e-8)
        return stacked_signals

    except Exception as e:
        raise Exception(f"Error converting mat file: {str(e)}")
