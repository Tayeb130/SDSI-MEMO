import numpy as np
import scipy.io as sio
from scipy.io.matlab.mio5_params import mat_struct

def create_random_signal_pattern():
    """Generate random signal characteristics"""
    # Random frequency components
    base_freq = np.random.uniform(45, 55)  # Base frequency around 50Hz
    harmonics = np.random.uniform(0, 1, 3)  # Random harmonic amplitudes
    phase_shifts = np.random.uniform(-np.pi, np.pi, 3)  # Random phase shifts
    noise_level = np.random.uniform(0.05, 0.3)  # Random noise level
    
    # Random fault characteristics
    imbalance = np.random.uniform(0, 1) > 0.7  # 30% chance of imbalance
    broken = np.random.uniform(0, 1) > 0.8  # 20% chance of broken rotor
    
    return {
        'base_freq': base_freq,
        'harmonics': harmonics,
        'phase_shifts': phase_shifts,
        'noise_level': noise_level,
        'imbalance': imbalance,
        'broken': broken
    }

def create_mat_file(output_path, essais_num=1):
    """
    Generate sample signals and save them to a .mat file in dSPACE format with random characteristics
    Args:
        output_path: Path where to save the .mat file
        essais_num: Number to use in essaisX variable name (default: 1)
    Returns True if successful, False otherwise
    """
    try:
        # Generate time vector
        t = np.linspace(0, 1, 50001)
        
        # Get random signal characteristics
        pattern = create_random_signal_pattern()
        
        # Base frequency components
        f1 = pattern['base_freq']
        harmonics = pattern['harmonics']
        phase_shifts = pattern['phase_shifts']
        noise_level = pattern['noise_level']
        
        # Generate current signals with random characteristics
        if pattern['broken']:
            # Broken rotor pattern: Add low frequency modulation and harmonics
            mod_freq = np.random.uniform(1, 5)
            i1 = np.sin(2 * np.pi * f1 * t) * (1 + 0.4 * np.sin(2 * np.pi * mod_freq * t))
            i2 = np.sin(2 * np.pi * f1 * t + 2*np.pi/3) * (1 + 0.4 * np.sin(2 * np.pi * mod_freq * t))
            i3 = np.sin(2 * np.pi * f1 * t - 2*np.pi/3) * (1 + 0.4 * np.sin(2 * np.pi * mod_freq * t))
        elif pattern['imbalance']:
            # Imbalance pattern: Amplitude variation between phases
            amp_var = np.random.uniform(0.2, 0.5)
            i1 = (1 + amp_var) * np.sin(2 * np.pi * f1 * t)
            i2 = np.sin(2 * np.pi * f1 * t + 2*np.pi/3)
            i3 = np.sin(2 * np.pi * f1 * t - 2*np.pi/3)
        else:
            # Healthy pattern: Clean signals with minimal distortion
            i1 = np.sin(2 * np.pi * f1 * t)
            i2 = np.sin(2 * np.pi * f1 * t + 2*np.pi/3)
            i3 = np.sin(2 * np.pi * f1 * t - 2*np.pi/3)
        
        # Add harmonics and noise
        for h, amp, phase in zip(range(2, 5), harmonics, phase_shifts):
            i1 += amp * 0.2 * np.sin(2 * np.pi * f1 * h * t + phase)
            i2 += amp * 0.2 * np.sin(2 * np.pi * f1 * h * t + phase + 2*np.pi/3)
            i3 += amp * 0.2 * np.sin(2 * np.pi * f1 * h * t + phase - 2*np.pi/3)
        
        # Add noise
        i1 += noise_level * np.random.randn(len(t))
        i2 += noise_level * np.random.randn(len(t))
        i3 += noise_level * np.random.randn(len(t))
        
        # Generate voltage signals with some variation
        voltage_noise = np.random.uniform(1, 3)
        v1 = 220 * np.sin(2 * np.pi * f1 * t) + voltage_noise * np.random.randn(len(t))
        v2 = 220 * np.sin(2 * np.pi * f1 * t + 2*np.pi/3) + voltage_noise * np.random.randn(len(t))
        v3 = 220 * np.sin(2 * np.pi * f1 * t - 2*np.pi/3) + voltage_noise * np.random.randn(len(t))
        
        # Neutral voltage with random spikes
        vn = noise_level * np.random.randn(len(t))
        if np.random.uniform(0, 1) > 0.7:  # 30% chance of spikes
            spike_locations = np.random.randint(0, len(t), 5)
            vn[spike_locations] = np.random.uniform(0.5, 2, 5)
        
        # Motor speed with random variations
        base_speed = np.random.uniform(1400, 1600)
        speed_var = np.random.uniform(5, 20)
        w_m = base_speed + speed_var * np.sin(2 * np.pi * np.random.uniform(0.5, 2) * t)
        w_m += np.random.uniform(2, 8) * np.random.randn(len(t))
        
        # Vibration signal with fault-specific patterns
        if pattern['broken']:
            # Higher frequency components for broken rotor
            vib_freq = np.random.uniform(20, 30)
            vibrad = np.sin(2 * np.pi * vib_freq * t) + 0.5 * np.sin(2 * np.pi * 2 * vib_freq * t)
        elif pattern['imbalance']:
            # Lower frequency for imbalance
            vib_freq = np.random.uniform(10, 15)
            vibrad = 0.7 * np.sin(2 * np.pi * vib_freq * t)
        else:
            # Normal operation
            vib_freq = np.random.uniform(15, 25)
            vibrad = 0.3 * np.sin(2 * np.pi * vib_freq * t)
        
        vibrad += noise_level * np.random.randn(len(t))
        
        # Create signals dictionary
        signals = {
            'i1': i1.reshape(1, -1),
            'i2': i2.reshape(1, -1),
            'i3': i3.reshape(1, -1),
            'v1': v1.reshape(1, -1),
            'v2': v2.reshape(1, -1),
            'v3': v3.reshape(1, -1),
            'vn': vn.reshape(1, -1),
            'w_m': w_m.reshape(1, -1),
            'vibrad': vibrad.reshape(1, -1)
        }
        
        # Create Y structure array
        Y_dtype = [('Name', 'O'), ('Type', 'O'), ('Data', 'O'), ('Unit', 'O'), ('XIndex', 'O')]
        Y = np.zeros((1, 9), dtype=Y_dtype)
        
        # Fill Y structure
        for idx, (name, data) in enumerate(signals.items()):
            Y[0, idx] = (
                f'"Model Root"/"{name}"/"Out1"',  # Name
                'double',                         # Type
                data,                            # Data
                '',                              # Unit
                0                                # XIndex
            )
        
        # Create essaisX structure
        essais_dtype = [('X', 'O'), ('Y', 'O'), ('Description', 'O'), ('RTProgram', 'O'), ('Capture', 'O')]
        essais = np.zeros((1, 1), dtype=essais_dtype)
        essais[0, 0] = (
            np.array([]),  # X
            Y,            # Y
            '',          # Description
            '',          # RTProgram
            ''           # Capture
        )
        
        # Save to .mat file with specified essaisX name
        essais_name = f'essais{essais_num}'
        sio.savemat(output_path, {essais_name: essais}, format='5')
        
        # Print the type of pattern generated
        pattern_type = "broken rotor" if pattern['broken'] else "imbalance" if pattern['imbalance'] else "healthy"
        print(f"Generated {pattern_type} pattern with base frequency {f1:.1f}Hz and noise level {noise_level:.3f}")
        
        return True
        
    except Exception as e:
        print(f"Error generating signals: {str(e)}")
        return False

if __name__ == "__main__":
    # Test the function with different essaisX numbers
    for i in range(1, 4):
        success = create_mat_file(f"test_signals_essais{i}.mat", i)
        print(f"Signal generation essais{i}:", "successful" if success else "failed") 