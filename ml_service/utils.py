import numpy as np
import scipy.io
import os

REQUIRED_SIGNALS = ['i1', 'i2', 'i3', 'v1', 'v2', 'v3', 'vn', 'w_m', 'vibrad']

def convert_mat_to_npz(mat_file_path):
    """Convert .mat file to preprocessed numpy array"""
    try:
        print("\nStarting conversion process...")
        # Load .mat file
        mat_data = scipy.io.loadmat(mat_file_path, struct_as_record=False, squeeze_me=True)
        print("Loaded .mat file successfully")
        print(f"Available keys: {[k for k in mat_data.keys() if not k.startswith('__')]}")
        
        # Extract signals
        signals = {}
        
        # Find any essaisX key
        essais_key = None
        for key in mat_data.keys():
            if key.startswith('essais') and not key.startswith('__'):
                essais_key = key
                print(f"Found essais key: {essais_key}")
                break
        
        # Try dSPACE format with found essaisX key
        if essais_key:
            print(f"Processing {essais_key} structure")
            essais = mat_data[essais_key]
            
            # Try to get signals from Y structure
            if hasattr(essais, 'Y'):
                Y = essais.Y
                print(f"Found Y structure with {len(Y) if isinstance(Y, (list, np.ndarray)) else 'unknown'} entries")
                
                # Handle different Y structure formats
                if isinstance(Y, np.ndarray) and Y.dtype.names is not None:
                    # Handle structured array format
                    print("Y is a structured array")
                    if 'Data' in Y.dtype.names:
                        for i, signal_data in enumerate(Y['Data']):
                            if i < len(REQUIRED_SIGNALS):
                                signals[REQUIRED_SIGNALS[i]] = signal_data
                                print(f"Added signal {REQUIRED_SIGNALS[i]} from structured array")
                else:
                    # Handle object array format
                    for entry in Y:
                        if hasattr(entry, 'Data'):
                            data = entry.Data
                            # Try to determine signal name from position
                            idx = list(Y).index(entry)
                            if idx < len(REQUIRED_SIGNALS):
                                signal_name = REQUIRED_SIGNALS[idx]
                                signals[signal_name] = data
                                print(f"Added signal {signal_name} from position {idx}")
            
            # If no signals found yet, try direct attributes
            if not signals:
                print("Trying direct attributes in essais structure")
                for signal_name in REQUIRED_SIGNALS:
                    if hasattr(essais, signal_name):
                        signals[signal_name] = getattr(essais, signal_name)
                        print(f"Added signal {signal_name} from direct attribute")
        
        # If still no signals, try direct format
        if not signals:
            print("Trying direct format...")
            for signal_name in REQUIRED_SIGNALS:
                if signal_name in mat_data:
                    data = mat_data[signal_name]
                    if isinstance(data, np.ndarray):
                        data = data.squeeze()
                        signals[signal_name] = data
                        print(f"Added signal {signal_name} with shape {data.shape}")

        # Debug print
        print(f"\nFound signals: {list(signals.keys())}")

        # Verify all required signals are present
        missing = [sig for sig in REQUIRED_SIGNALS if sig not in signals]
        if missing:
            raise ValueError(f"Missing signals: {missing}")

        # Verify signal length
        for name, signal in signals.items():
            if len(signal) != 50001:
                raise ValueError(f"Signal {name} has length {len(signal)}, expected 50001")
            
        # Stack and preprocess signals
        stacked_signals = np.stack([signals[key] for key in REQUIRED_SIGNALS], axis=0)
        print(f"Stacked signals shape: {stacked_signals.shape}")
        
        # Normalize
        stacked_signals = (stacked_signals - np.mean(stacked_signals, axis=1, keepdims=True)) / \
                         (np.std(stacked_signals, axis=1, keepdims=True) + 1e-8)
        print("Normalization complete")
        
        return stacked_signals

    except Exception as e:
        print(f"\nDetailed error information:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        print("Traceback:")
        print(traceback.format_exc())
        raise Exception(f"Error converting mat file: {str(e)}")
