import numpy as np
import scipy.io as sio
import time
import os
from datetime import datetime

class SignalGenerator:
    def __init__(self, sample_rate=50001, duration=1.0):
        self.sample_rate = sample_rate
        self.duration = duration
        self.t = np.linspace(0, duration, sample_rate)
        self.base_freq = 50  # Base frequency for electrical signals (50 Hz)
        self.output_dir = "generated_signals"
        
        # Create output directory if it doesn't exist
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def generate_current_signal(self, amplitude=1.0, noise_level=0.05, fault_type=None):
        """Generate a current signal with optional fault injection"""
        base_signal = amplitude * np.sin(2 * np.pi * self.base_freq * self.t)
        
        if fault_type == "cassure":
            # Simulate rotor bar breakage with more distinct sidebands
            fault_freq = self.base_freq * 2
            sideband_amp = 0.4  # Increased from 0.3
            base_signal += sideband_amp * np.sin(2 * np.pi * (self.base_freq + fault_freq) * self.t)
            base_signal += sideband_amp * np.sin(2 * np.pi * (self.base_freq - fault_freq) * self.t)
        elif fault_type == "desiquilibre":
            # Simulate unbalance with clearer amplitude modulation
            mod_freq = 25  # Characteristic frequency for unbalance
            mod_depth = 0.6  # Increased modulation depth for more distinct pattern
            # Add phase-specific modulation for unbalance
            phase_mod = mod_depth * np.sin(2 * np.pi * mod_freq * self.t)
            base_signal *= (1 + phase_mod)
            # Add characteristic harmonics for unbalance
            base_signal += 0.2 * np.sin(2 * np.pi * 2 * mod_freq * self.t)  # 50 Hz component
            base_signal += 0.1 * np.sin(2 * np.pi * 3 * mod_freq * self.t)  # 75 Hz component

        # Reduce noise level for cleaner signals
        noise = noise_level * np.random.randn(len(self.t))
        return base_signal + noise

    def generate_voltage_signal(self, amplitude=220.0, noise_level=0.1):
        """Generate a voltage signal"""
        base_signal = amplitude * np.sin(2 * np.pi * self.base_freq * self.t)
        noise = noise_level * np.random.randn(len(self.t))
        return base_signal + noise

    def generate_speed_signal(self, nominal_speed=1500, noise_level=0.05, fault_type=None):
        """Generate motor speed signal"""
        base_signal = nominal_speed * np.ones_like(self.t)
        
        if fault_type == "desiquilibre":
            # Add more pronounced speed fluctuation for unbalance
            fluctuation_freq = 25  # Match with current modulation
            fluctuation_amp = 150  # Increased amplitude for more distinct pattern
            base_signal += fluctuation_amp * np.sin(2 * np.pi * fluctuation_freq * self.t)
            # Add second harmonic for unbalance
            base_signal += 50 * np.sin(2 * np.pi * 2 * fluctuation_freq * self.t)
        elif fault_type == "cassure":
            # Add slight speed variation for rotor bar breakage
            variation_freq = self.base_freq * 2
            base_signal += 20 * np.sin(2 * np.pi * variation_freq * self.t)

        noise = noise_level * np.random.randn(len(self.t))
        return base_signal + noise

    def generate_vibration_signal(self, amplitude=1.0, noise_level=0.05, fault_type=None):
        """Generate vibration signal"""
        base_signal = amplitude * np.sin(2 * np.pi * self.base_freq * self.t)
        
        if fault_type == "cassure":
            # Add stronger high-frequency components for rotor fault
            fault_freq = self.base_freq * 2
            base_signal += 0.7 * np.sin(2 * np.pi * fault_freq * self.t)
            # Add harmonics
            base_signal += 0.3 * np.sin(2 * np.pi * fault_freq * 1.5 * self.t)
        elif fault_type == "desiquilibre":
            # Add stronger low-frequency component for unbalance
            unbalance_freq = 25
            base_signal += 1.2 * amplitude * np.sin(2 * np.pi * unbalance_freq * self.t)  # Increased amplitude
            # Add second and third harmonics
            base_signal += 0.4 * amplitude * np.sin(2 * np.pi * unbalance_freq * 2 * self.t)
            base_signal += 0.2 * amplitude * np.sin(2 * np.pi * unbalance_freq * 3 * self.t)

        noise = noise_level * np.random.randn(len(self.t))
        return base_signal + noise

    def verify_signal_characteristics(self, signals, fault_type):
        """Verify that generated signals have the expected characteristics"""
        try:
            # Perform FFT on current signals
            fft = np.fft.fft(signals['i1'])
            freqs = np.fft.fftfreq(len(self.t), 1/self.sample_rate)
            magnitudes = np.abs(fft)

            # Get dominant frequencies (excluding DC)
            dominant_freqs = []
            for i in range(1, len(freqs)//2):
                if magnitudes[i] > np.mean(magnitudes) + 2*np.std(magnitudes):
                    dominant_freqs.append(abs(freqs[i]))

            print(f"\nSignal verification for {fault_type if fault_type else 'sain'} state:")
            print(f"Dominant frequencies found: {[f'{f:.1f}Hz' for f in sorted(dominant_freqs)]}")

            if fault_type == "sain":
                # Should mainly see base frequency (50 Hz)
                main_freq_found = any(abs(f - self.base_freq) < 2 for f in dominant_freqs)
                if not main_freq_found:
                    print("Warning: Base frequency not dominant in healthy state")
                    return False

            elif fault_type == "cassure":
                # Should see sidebands around base frequency
                sideband_found = any(abs(f - self.base_freq*2) < 2 for f in dominant_freqs)
                if not sideband_found:
                    print("Warning: Characteristic sidebands not found in cassure state")
                    return False

            elif fault_type == "desiquilibre":
                # Should see modulation frequency (25 Hz)
                mod_freq_found = any(abs(f - 25) < 2 for f in dominant_freqs)
                if not mod_freq_found:
                    print("Warning: Modulation frequency not found in desiquilibre state")
                    return False

            print("Signal characteristics verified successfully")
            return True

        except Exception as e:
            print(f"Error in signal verification: {str(e)}")
            return True  # Continue despite verification error

    def generate_signals(self, fault_type=None):
        """Generate all required signals"""
        max_attempts = 3
        for attempt in range(max_attempts):
            # Generate three-phase currents
            i1 = self.generate_current_signal(amplitude=1.0, fault_type=fault_type)
            i2 = self.generate_current_signal(amplitude=1.0, fault_type=fault_type)
            i3 = self.generate_current_signal(amplitude=1.0, fault_type=fault_type)

            # Generate three-phase voltages
            v1 = self.generate_voltage_signal(amplitude=220.0)
            v2 = self.generate_voltage_signal(amplitude=220.0)
            v3 = self.generate_voltage_signal(amplitude=220.0)

            # Generate neutral voltage
            vn = self.generate_voltage_signal(amplitude=0.1)  # Small neutral voltage

            # Generate speed signal
            w_m = self.generate_speed_signal(fault_type=fault_type)

            # Generate vibration signal
            vibrad = self.generate_vibration_signal(fault_type=fault_type)

            signals = {
                'i1': i1, 'i2': i2, 'i3': i3,
                'v1': v1, 'v2': v2, 'v3': v3,
                'vn': vn, 'w_m': w_m, 'vibrad': vibrad
            }

            # Verify signal characteristics
            if self.verify_signal_characteristics(signals, fault_type):
                return signals
            else:
                print(f"Attempt {attempt + 1}: Generated signals did not match expected characteristics, retrying...")

        print("Warning: Could not generate ideal signals, using last attempt")
        return signals

    def save_signals(self, signals, fault_type=None):
        """Save signals to .mat file in dSPACE format"""
        # Delete all existing .mat files in the output directory
        for file in os.listdir(self.output_dir):
            if file.endswith('.mat'):
                file_path = os.path.join(self.output_dir, file)
                try:
                    os.remove(file_path)
                    print(f"Deleted old file: {file}")
                except Exception as e:
                    print(f"Error deleting file {file}: {str(e)}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"motor_signals_{timestamp}.mat"
        filepath = os.path.join(self.output_dir, filename)

        # Verify all required signals are present
        required_signals = ['i1', 'i2', 'i3', 'v1', 'v2', 'v3', 'vn', 'w_m', 'vibrad']
        missing_signals = set(required_signals) - set(signals.keys())
        if missing_signals:
            raise ValueError(f"Missing required signals: {missing_signals}")

        try:
            # Create the signal entries
            Y = []
            for name in required_signals:  # Use required_signals to ensure correct order
                data = signals[name]
                # Ensure the signal is a numpy array with correct shape
                data = np.array(data)
                if data.shape != (self.sample_rate,):
                    raise ValueError(f"Signal {name} has wrong shape: {data.shape}, expected ({self.sample_rate},)")
                
                # Create a structured array for each signal
                dt = np.dtype([
                    ('Name', 'O'),
                    ('Data', 'O'),
                    ('Plot', 'O'),
                    ('Capture', 'O')
                ])
                signal_struct = np.zeros(1, dtype=dt)[0]
                # Store just the signal name without any path
                signal_struct['Name'] = name
                signal_struct['Data'] = data
                signal_struct['Plot'] = True
                signal_struct['Capture'] = True
                Y.append(signal_struct)

            # Convert Y to a numpy array
            Y = np.array(Y, dtype=object)

            # Create the essais1 dictionary
            essais1 = {
                'Y': Y,
                'X': np.arange(self.sample_rate),
                'Time': self.t
            }

            # Save to .mat file
            sio.savemat(filepath, {'essais1': essais1}, do_compression=False)
            print(f"Saved signals to {filepath}")
            
            # Verify the saved file
            try:
                # Try to load and process the file using the same function as utils.py
                loaded = sio.loadmat(filepath, struct_as_record=False, squeeze_me=True)
                if 'essais1' not in loaded:
                    print("Warning: essais1 not found in saved file")
                else:
                    essais = loaded['essais1']
                    if not hasattr(essais, 'Y'):
                        print("Warning: Y attribute not found in essais1")
                    else:
                        # Verify signal names
                        saved_signals = [str(y.Name) for y in essais.Y]
                        print(f"Saved signals: {saved_signals}")
                        if all(sig in saved_signals for sig in required_signals):
                            print("File verification successful - all signals present and correctly named")
                        else:
                            print(f"Warning: Some signals are missing or incorrectly named. Found: {saved_signals}")
            except Exception as e:
                print(f"Warning: File verification failed: {str(e)}")
                
            return filepath
        except Exception as e:
            print(f"Error saving signals: {str(e)}")
            raise

def run_signal_generator():
    """Main function to run the signal generator"""
    generator = SignalGenerator()
    fault_types = [None, "cassure", "desiquilibre"]  # None represents 'sain' (healthy) state
    fault_index = 0
    
    print("Starting signal generation...")
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            # Rotate through fault types
            current_fault = fault_types[fault_index]
            fault_index = (fault_index + 1) % len(fault_types)
            
            # Generate and save signals
            signals = generator.generate_signals(fault_type=current_fault)
            filepath = generator.save_signals(signals, fault_type=current_fault)
            
            print(f"\nGenerated signals with state: {current_fault if current_fault else 'sain'}")
            print(f"Saved to: {filepath}")
            
            # Wait before generating next signals
            # This delay should match the frontend polling interval
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\nSignal generation stopped by user")
    except Exception as e:
        print(f"Error during signal generation: {str(e)}")
        raise  # Re-raise the exception for proper error handling

if __name__ == "__main__":
    run_signal_generator()
