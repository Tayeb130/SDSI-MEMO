import sys
import json
import numpy as np
from scipy.io import savemat
import os
from scipy.io.matlab.mio5_params import mat_struct
import scipy.io as sio

def generate_base_signal(size=50001, frequency=50):
    """Generate a base signal with given frequency"""
    t = np.linspace(0, 1, size)
    return t, np.sin(2 * np.pi * frequency * t)

def add_noise(signal, noise_level):
    """Add Gaussian noise to a signal"""
    return signal + noise_level * np.random.randn(len(signal))

def generate_signal_data(signal_type, size=50001):
    t, base_signal = generate_base_signal(size)
    
    if signal_type in ['i1', 'i2', 'i3']:
        # Three-phase currents (120° phase shift)
        if signal_type == 'i1':
            phase_shift = 0
        elif signal_type == 'i2':
            phase_shift = 2 * np.pi / 3
        else:
            phase_shift = 4 * np.pi / 3
            
        signal = 10 * np.sin(2 * np.pi * 50 * t + phase_shift)
        return add_noise(signal, 0.5)  # Current: ~10A amplitude with noise
        
    elif signal_type in ['v1', 'v2', 'v3']:
        # Three-phase voltages (120° phase shift)
        if signal_type == 'v1':
            phase_shift = 0
        elif signal_type == 'v2':
            phase_shift = 2 * np.pi / 3
        else:
            phase_shift = 4 * np.pi / 3
            
        signal = 220 * np.sin(2 * np.pi * 50 * t + phase_shift)
        return add_noise(signal, 2.0)  # Voltage: ~220V amplitude with noise
        
    elif signal_type == 'vn':
        # Neutral voltage (should be close to 0 in balanced system)
        return add_noise(np.zeros(size), 0.1)
        
    elif signal_type == 'w_m':
        # Motor speed with slight variations
        base_speed = 1450
        speed_variation = 10 * np.sin(2 * np.pi * 1 * t)  # 1 Hz variation
        return base_speed + speed_variation + add_noise(np.zeros(size), 2.0)
        
    elif signal_type == 'vibrad':
        # Vibration signal (combination of fundamental and harmonic frequencies)
        fundamental = 0.5 * np.sin(2 * np.pi * 25 * t)  # 25 Hz fundamental
        harmonic1 = 0.3 * np.sin(2 * np.pi * 50 * t)    # 50 Hz harmonic
        harmonic2 = 0.2 * np.sin(2 * np.pi * 100 * t)   # 100 Hz harmonic
        return add_noise(fundamental + harmonic1 + harmonic2, 0.1)
        
    return np.random.rand(size)  # Default case

def create_dspace_struct(signals):
    """Create a dSPACE compatible structure that matches the exact format"""
    # Create structured arrays for Y data
    Y_dtype = [('Name', 'O'), ('Type', 'O'), ('Data', 'O'), ('Unit', 'O'), ('XIndex', 'O')]
    Y = np.zeros((1, len(signals)), dtype=Y_dtype)
    
    # Fill in the Y array with signal data
    for idx, (signal_name, signal_data) in enumerate(signals.items()):
        Y[0, idx] = (
            f'"Model Root"/"{signal_name}"/"Out1"',  # Name with quotes as in original file
            'double',                                # Type
            signal_data.reshape(1, -1),             # Data as 1xN array
            '',                                     # Unit
            0                                       # XIndex
        )
    
    # Create the essais1 structure with the correct dtype
    essais1_dtype = [('X', 'O'), ('Y', 'O'), ('Description', 'O'), ('RTProgram', 'O'), ('Capture', 'O')]
    essais1 = np.zeros((1, 1), dtype=essais1_dtype)
    
    # Fill in the essais1 structure
    essais1[0, 0] = (
        np.array([]),  # X
        Y,            # Y
        '',          # Description
        '',          # RTProgram
        ''           # Capture
    )
    
    return {'essais1': essais1}

def main():
    try:
        signals = json.loads(sys.argv[1])
        output_path = sys.argv[2]  # Get output path from command line args
        
        # Ensure parent directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Generate all signals
        data = {signal: generate_signal_data(signal) for signal in signals}
        
        # Verify shapes before saving
        for signal_name, signal_data in data.items():
            if signal_data.shape != (50001,):
                raise ValueError(f"Signal {signal_name} has wrong shape: {signal_data.shape}, expected (50001,)")
        
        # Create dSPACE structure and save to .mat file
        mat_data = create_dspace_struct(data)
        
        # Debug: Print structure before saving
        print("\nDEBUG: Structure being saved:")
        essais1 = mat_data['essais1']
        print(f"essais1 shape: {essais1.shape}, dtype: {essais1.dtype}")
        Y = essais1[0, 0]['Y']
        print(f"Y shape: {Y.shape}, dtype: {Y.dtype}")
        print("First signal name:", Y[0, 0]['Name'])
        print("First signal data shape:", Y[0, 0]['Data'].shape)
        
        # Save with v7 format for compatibility
        savemat(output_path, mat_data, format='7')
        print("SUCCESS: Generated signals in dSPACE format")
        
        # Debug: Read back and verify
        print("\nDEBUG: Verifying saved file:")
        verify = sio.loadmat(output_path)
        print("File keys:", verify.keys())
        if 'essais1' in verify:
            e1 = verify['essais1']
            print(f"Read essais1 shape: {e1.shape}, dtype: {e1.dtype}")
            if 'Y' in e1[0, 0].dtype.names:
                y = e1[0, 0]['Y']
                print(f"Read Y shape: {y.shape}, dtype: {y.dtype}")
                print("Read first signal name:", y[0, 0]['Name'])
                print("Read first signal data shape:", y[0, 0]['Data'].shape)
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
