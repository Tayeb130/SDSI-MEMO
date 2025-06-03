import { useState, useEffect } from "react";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import FFT from 'fft.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useNotifications } from '../contexts/NotificationContext';
import type { Event, Description, PredictionDetails } from '../components/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  annotationPlugin
);

// Define fault frequency ranges
const FAULT_FREQUENCIES = {
  "Défaut rotorique": { min: 95, max: 105 },
  "Défaut statorique": { min: 45, max: 55 },
  "Défaut roulement": { min: 85, max: 95 },
};

interface PredictionResult {
  prediction: string;
  confidence: number;
  status: string;
  metrics: {
    f1Score: number;
    confusionMatrix: number[][];
    rocCurve: { x: number; y: number }[];
    classMetrics: Array<{ class: string; precision: number; recall: number }>;
  };
  class_probabilities?: Record<string, number>;
  formatted_signals?: Record<string, string>;
}

interface MonitoringResponse {
  status: string;
  error?: string;
  timestamp: number | null;
  prediction: {
    state: string;
    confidence: number;
    details: {
      class_probabilities: Record<string, number>;
      validation_patterns: Record<string, boolean>;
    };
  } | null;
  signals: Record<string, number[]>;
  metrics: {
    f1Score: number;
    confusionMatrix: number[][];
    rocCurve: Array<{ x: number; y: number }>;
    classMetrics: Array<{ class: string; precision: number; recall: number }>;
  };
}

function findDominantFrequencies(frequencies: number[], magnitudes: number[], threshold = 0.3): Array<{ freq: number, magnitude: number }> {
  const peaks = [];
  for (let i = 1; i < magnitudes.length - 1; i++) {
    if (magnitudes[i] > threshold && 
        magnitudes[i] > magnitudes[i - 1] && 
        magnitudes[i] > magnitudes[i + 1]) {
      peaks.push({
        freq: frequencies[i],
        magnitude: magnitudes[i]
      });
    }
  }
  return peaks.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
}

function interpretFrequencies(dominantFreqs: Array<{ freq: number, magnitude: number }>): string[] {
  const interpretations = [];
  for (const { freq } of dominantFreqs) {
    for (const [faultType, range] of Object.entries(FAULT_FREQUENCIES)) {
      if (freq >= range.min && freq <= range.max) {
        interpretations.push(`${freq.toFixed(2)} Hz → ${faultType} suspecté`);
      }
    }
  }
  return interpretations;
}

function calculateFFT(signal: number[]): { frequencies: number[]; magnitudes: number[] } {
  // Find the next power of 2
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(signal.length)));
  
  // Create FFT instance
  const fft = new FFT(nextPow2);
  
  // Pad signal with zeros to reach next power of 2
  const paddedSignal = [...signal];
  while (paddedSignal.length < nextPow2) {
    paddedSignal.push(0);
  }
  
  // Prepare input and output arrays
  const out = fft.createComplexArray();
  const data = fft.createComplexArray();
  
  // Copy input data to complex array (real part only)
  for (let i = 0; i < paddedSignal.length; i++) {
    data[2 * i] = paddedSignal[i];
    data[2 * i + 1] = 0;
  }
  
  // Perform FFT
  fft.transform(out, data);
  
  // Calculate magnitudes and frequencies
  const magnitudes: number[] = [];
  const frequencies: number[] = [];
  const samplingRate = 50001; // Based on your signal length
  
  for (let i = 0; i < nextPow2 / 2; i++) {
    const real = out[2 * i];
    const imag = out[2 * i + 1];
    const magnitude = Math.sqrt(real * real + imag * imag);
    magnitudes.push(magnitude);
    frequencies.push((i * samplingRate) / nextPow2);
  }
  
  // Normalize magnitudes
  const maxMagnitude = Math.max(...magnitudes);
  const normalizedMagnitudes = magnitudes.map(m => m / maxMagnitude);
  
  return {
    frequencies: frequencies,
    magnitudes: normalizedMagnitudes
  };
}

function HomeContent() {
  const [monitoringData, setMonitoringData] = useState<MonitoringResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [uploadedData, setUploadedData] = useState<{[key: string]: number[]} | null>(null);
  const [dominantFreqs, setDominantFreqs] = useState<{[key: string]: Array<{ freq: number, magnitude: number }>}>({});
  const [interpretations, setInterpretations] = useState<{[key: string]: string[]}>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [monitoringInterval, setMonitoringInterval] = useState<number | null>(null);
  const { addNotification } = useNotifications();

  const fetchMonitoringStatus = async () => {
    try {
      const response = await fetch("http://localhost:5600/get-monitoring-status");
      const data: MonitoringResponse = await response.json();
      
      console.log("Monitoring status response:", data);
      
      if (data.status === "error") {
        setError(data.error || "Unknown error occurred");
        return;
      }

      if (data.status === "waiting") {
        // Still waiting for data, keep the loading state
        return;
      }

      if (data.status === "stopped") {
        setIsMonitoring(false);
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          setMonitoringInterval(null);
        }
        return;
      }

      if (data.status === "running" && data.prediction) {
        setMonitoringData(data);
        // Update prediction state with the monitoring data
        setPrediction({
          prediction: data.prediction.state,
          confidence: data.prediction.confidence,
          status: "success",
          metrics: data.metrics,
          class_probabilities: data.prediction.details.class_probabilities
        });
        setError(null);
      }
    } catch (error) {
      console.error("Error fetching monitoring status:", error);
      setError("Failed to fetch monitoring status");
    }
  };

  const startMonitoring = async () => {
    try {
      setError(null); // Clear any previous errors
      const response = await fetch("http://localhost:5600/start-monitoring", {
        method: "POST",
      });
      
      if (response.ok) {
        setIsMonitoring(true);
        setPrediction(null); // Reset prediction when starting new monitoring
        // Start polling for updates
        const interval = setInterval(fetchMonitoringStatus, 5000);
        setMonitoringInterval(interval);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to start monitoring");
      }
    } catch (error) {
      console.error("Error starting monitoring:", error);
      setError("Failed to start monitoring");
    }
  };

  const stopMonitoring = async () => {
    try {
      const response = await fetch("http://localhost:5600/stop-monitoring", {
        method: "POST",
      });
      
      if (response.ok) {
        setIsMonitoring(false);
        setPrediction(null); // Clear prediction when stopping
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          setMonitoringInterval(null);
        }
      } else {
        const data = await response.json();
        setError(data.error || "Failed to stop monitoring");
      }
    } catch (error) {
      console.error("Error stopping monitoring:", error);
      setError("Failed to stop monitoring");
    }
  };

  // Add immediate fetch when monitoring starts
  useEffect(() => {
    if (isMonitoring) {
      fetchMonitoringStatus();
    }
  }, [isMonitoring]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, []);

  const generateMatFile = async () => {
    try {
      const response = await fetch("http://localhost:5600/generate-signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signals: ["i1", "i2", "i3", "v1", "v2", "v3", "vn", "w_m", "vibrad"],
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "signals.mat";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (error) {
      console.error("Error generating .mat file:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log("Uploading file...");
      const response = await fetch("http://localhost:5600/predict", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("Received prediction response:", result);
      
      if (response.ok) {
        setPrediction(result);
        if (result.signals) {
          console.log("Setting signals data:", result.signals);
          setUploadedData(result.signals);

          // Calculate dominant frequencies and interpretations
          const newDominantFreqs: {[key: string]: Array<{ freq: number, magnitude: number }>} = {};
          const newInterpretations: {[key: string]: string[]} = {};
          
          Object.entries(result.signals).forEach(([signalName, data]) => {
            const fftData = calculateFFT(data as number[]);
            const peaks = findDominantFrequencies(fftData.frequencies, fftData.magnitudes);
            newDominantFreqs[signalName] = peaks;
            newInterpretations[signalName] = interpretFrequencies(peaks);
          });

          setDominantFreqs(newDominantFreqs);
          setInterpretations(newInterpretations);

          try {
            // Calculate severity based on prediction and confidence
            let severity = 'FAIBLE' as "FAIBLE" | "NORMAL" | "MOYEN" | "ÉLEVÉ";
            if (result.prediction === 'cassure' && result.confidence > 0.9) {
              severity = 'ÉLEVÉ';
            } else if (result.prediction === 'desiquilibre' && result.confidence > 0.9) {
              severity = 'MOYEN';
            } else if (result.confidence > 0.9) {
              severity = 'NORMAL';
            }

            // Create event data matching the Event interface
            const eventData: Event = {
              _id: Math.random().toString(36).substr(2, 9),
              fileName: file.name,
              time: new Date().toISOString(),
              type: 'PREDICTION',
              severity,
              description: [
                { key: 'fileName', value: file.name },
                { key: 'prediction', value: result.prediction },
                { key: 'confidence', value: `${(result.confidence * 100).toFixed(2)}%` },
                ...Object.entries(newDominantFreqs).map(([signalName, freqs]) => ({
                  key: `signal_${signalName}_stats`,
                  value: freqs.map(f => `${f.freq.toFixed(2)}Hz (${f.magnitude.toFixed(2)})`).join(', ')
                }))
              ],
              predictionDetails: {
                predictedClass: result.prediction,
                confidence: result.confidence,
                metrics: result.metrics
              }
            };

            // Additional data for the API but not part of the Event interface
            const apiEventData = {
              ...eventData,
              fileSize: file.size,
              fileType: file.type || '.mat',
              predictionResult: result,
              signals: result.signals,
              dominantFrequencies: newDominantFreqs,
              interpretations: newInterpretations,
            };

            const eventResponse = await fetch("http://localhost:5000/api/events", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(apiEventData),
            });

            if (eventResponse.ok) {
              const responseData = await eventResponse.json();
              if (responseData.success) {
                // Use the event data from the response which includes the proper MongoDB _id
                const savedEvent = responseData.data;
                // Always trigger notification for any severity level except FAIBLE
                console.log('Triggering notification for severity:', severity);
                if (severity !== 'FAIBLE') {
                  addNotification(savedEvent);
                }
              }
            } else {
              const errorText = await eventResponse.text();
              console.error("Failed to save event:", errorText);
            }
          } catch (eventError) {
            console.error("Error saving event:", eventError);
          }
        } else {
          console.warn("No signals data in response");
        }
      } else {
        setError(result.error || "Upload failed");
        console.error("Upload error:", result.error);
      }
    } catch (error) {
      setError("File upload failed");
      console.error("File upload error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Analyse des Signaux</h1>
        <div className="space-x-4">
          <label className={`${
            isLoading ? 'bg-gray-500' : 'bg-green-500 hover:bg-green-700'
          } text-white font-bold py-2 px-4 rounded cursor-pointer inline-flex items-center`}>
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Traitement...
              </>
            ) : (
              'Charger fichier .mat'
            )}
            <input
              type="file"
              accept=".mat,.npz"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading || isMonitoring}
            />
          </label>
          <button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className={`${
              isMonitoring ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'
            } text-white font-bold py-2 px-4 rounded`}
            disabled={isLoading}
          >
            {isMonitoring ? 'Arrêter monitoring' : 'Démarrer monitoring'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Erreur!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {!uploadedData && !isMonitoring && (
        <div className="text-center p-8 bg-gray-50 rounded-lg">
          <p className="text-xl text-gray-600">Téléchargez votre fichier de signal pour commencer l'analyse</p>
        </div>
      )}

      {/* Monitoring Mode Display */}
      {isMonitoring && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">État de la Machine en Temps Réel</h2>
          {monitoringData?.prediction ? (
            <div className="grid grid-cols-2 gap-6">
              {/* State Display */}
              <div className="p-6 border rounded-lg">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">État Actuel</h3>
                  <div className={`text-3xl font-bold mb-2 ${
                    monitoringData.prediction.details.class_probabilities['sain'] >= 0.4 ? 'text-green-600' :
                    monitoringData.prediction.details.class_probabilities['desiquilibre'] >= 0.4 ? 'text-yellow-600' :
                    monitoringData.prediction.details.class_probabilities['cassure'] >= 0.4 ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {monitoringData.prediction.details.class_probabilities['sain'] >= 0.4 ? 'NORMAL' :
                     monitoringData.prediction.details.class_probabilities['desiquilibre'] >= 0.4 ? 'ATTENTION' :
                     monitoringData.prediction.details.class_probabilities['cassure'] >= 0.4 ? 'DÉFAUT CRITIQUE' :
                     'INCONNU'}
                  </div>
                  <div className="text-sm text-gray-600">
                    État: {monitoringData.prediction.details.class_probabilities['sain'] >= 0.4 ? 'Normal' :
                          monitoringData.prediction.details.class_probabilities['desiquilibre'] >= 0.4 ? 'Déséquilibre' :
                          monitoringData.prediction.details.class_probabilities['cassure'] >= 0.4 ? 'Cassure' :
                          'Inconnu'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Confiance: {(Math.max(...Object.values(monitoringData.prediction.details.class_probabilities)) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* State Gauge Chart */}
              <div className="p-6 border rounded-lg">
                <div className="h-64">
                  <Doughnut
                    data={{
                      labels: ['Normal (Sain)', 'Attention (Déséquilibre)', 'Critique (Cassure)'],
                      datasets: [{
                        data: [
                          (monitoringData.prediction.details.class_probabilities['sain'] || 0) * 100,
                          (monitoringData.prediction.details.class_probabilities['desiquilibre'] || 0) * 100,
                          (monitoringData.prediction.details.class_probabilities['cassure'] || 0) * 100
                        ],
                        backgroundColor: [
                          'rgba(34, 197, 94, 0.8)',  // green
                          'rgba(234, 179, 8, 0.8)',   // yellow
                          'rgba(239, 68, 68, 0.8)',   // red
                        ],
                        borderColor: [
                          'rgba(34, 197, 94, 1)',
                          'rgba(234, 179, 8, 1)',
                          'rgba(239, 68, 68, 1)',
                        ],
                        borderWidth: 1,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '70%',
                      rotation: -90,
                      circumference: 180,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            padding: 20,
                            font: {
                              size: 12
                            }
                          }
                        },
                        title: {
                          display: true,
                          text: 'État de Santé',
                          font: {
                            size: 16,
                            weight: 'bold'
                          }
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return `${context.label}: ${context.parsed.toFixed(1)}%`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Class Probabilities */}
              <div className="col-span-2 p-6 border rounded-lg">
                <h3 className="text-lg font-medium mb-4">Probabilités par État</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(monitoringData.prediction.details.class_probabilities).map(([className, probability]) => (
                    <div key={className} className="text-center">
                      <div className="text-lg font-bold">{(probability * 100).toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">{className}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation Patterns */}
              <div className="col-span-2 p-6 border rounded-lg">
                <h3 className="text-lg font-medium mb-4">Caractéristiques du Signal</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(monitoringData.prediction.details.validation_patterns).map(([pattern, isPresent]) => (
                    <div key={pattern} className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${isPresent ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>{pattern}: {isPresent ? 'Présent' : 'Absent'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">En attente des données...</p>
            </div>
          )}
        </div>
      )}

      {/* Regular File Upload Display */}
      {!isMonitoring && uploadedData && (
        <div className="grid grid-cols-1 gap-6">
          {/* Signal Plots */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Signaux</h2>
            <div className="grid grid-cols-1 gap-8">
              {Object.entries(uploadedData).map(([signalName, data]) => {
                const fftData = calculateFFT(data);
                const peaks = dominantFreqs[signalName] || [];
                const signalInterpretations = interpretations[signalName] || [];
                
                return (
                  <div key={signalName} className="border rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">{signalName.toUpperCase()}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Time Domain Signal */}
                      <div className="h-64">
                        <Line
                          data={{
                            labels: Array.from({ length: data.length }, (_, i) => (i / data.length).toFixed(2)),
                            datasets: [{
                              label: 'Signal dans le domaine temporel',
                              data: data,
                              borderColor: 'rgb(255, 159, 64)',
                              borderWidth: 1,
                              pointRadius: 0
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              title: { display: true, text: 'Signal dans le domaine temporel' },
                              zoom: {
                                limits: {
                                  y: {min: -2, max: 2}
                                },
                                zoom: {
                                  wheel: {
                                    enabled: true
                                  },
                                  pinch: {
                                    enabled: true
                                  },
                                  mode: 'xy'
                                },
                                pan: {
                                  enabled: true,
                                  mode: 'xy'
                                }
                              }
                            },
                            scales: {
                              x: {
                                title: { display: true, text: 'Temps [s]' }
                              },
                              y: {
                                title: { display: true, text: 'Amplitude' }
                              }
                            }
                          }}
                        />
                      </div>

                      {/* Frequency Domain (FFT) with Annotations */}
                      <div className="h-64">
                        <Line
                          data={{
                            labels: fftData.frequencies.map(f => f.toFixed(0)),
                            datasets: [{
                              label: 'Spectre de fréquence (FFT)',
                              data: fftData.magnitudes,
                              borderColor: 'rgb(255, 159, 64)',
                              borderWidth: 1,
                              pointRadius: 0
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              title: { display: true, text: 'Spectre de fréquence (FFT)' },
                              zoom: {
                                limits: {
                                  y: {min: 0, max: 1}
                                },
                                zoom: {
                                  wheel: {
                                    enabled: true
                                  },
                                  pinch: {
                                    enabled: true
                                  },
                                  mode: 'xy'
                                },
                                pan: {
                                  enabled: true,
                                  mode: 'xy'
                                }
                              },
                              annotation: {
                                annotations: peaks.map((peak, i) => ({
                                  type: 'point',
                                  xValue: peak.freq,
                                  yValue: peak.magnitude,
                                  backgroundColor: 'red',
                                  radius: 4,
                                  label: {
                                    content: `${peak.freq.toFixed(1)} Hz`,
                                    enabled: true
                                  }
                                }))
                              }
                            },
                            scales: {
                              x: {
                                title: { display: true, text: 'Fréquence [Hz]' },
                                max: 500,
                                ticks: { maxTicksLimit: 10 }
                              },
                              y: {
                                title: { display: true, text: 'Amplitude' },
                                max: 1.0,
                                min: 0
                              }
                            }
                          }}
                        />
                      </div>

                      {/* Dominant Frequencies and Interpretations */}
                      <div className="col-span-2 mt-4">
                        <h4 className="font-medium mb-2">Fréquences dominantes et interprétation:</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <ul className="list-disc pl-5">
                            {peaks.map((peak, i) => (
                              <li key={i}>
                                {peak.freq.toFixed(2)} Hz (Amplitude: {peak.magnitude.toFixed(2)})
                              </li>
                            ))}
                          </ul>
                          <ul className="list-disc pl-5 text-blue-600">
                            {signalInterpretations.map((interp, i) => (
                              <li key={i}>{interp}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prediction Results with Enhanced Metrics */}
          {prediction && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Résultats de l'Analyse</h2>
              <div className="grid grid-cols-2 gap-6">
                {/* Prediction and Confidence */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Prédiction</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-lg font-bold text-blue-600">
                      {prediction.prediction || "Non disponible"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Confiance: {prediction.confidence ? `${(prediction.confidence * 100).toFixed(2)}%` : "N/A"}
                    </p>
                    {prediction.class_probabilities && (
                      <div className="mt-4">
                        <p className="font-medium mb-2">Probabilités par classe:</p>
                        {Object.entries(prediction.class_probabilities).map(([className, prob]) => (
                          <div key={className} className="flex justify-between items-center mb-1">
                            <span className="text-sm">{className}:</span>
                            <span className="text-sm font-medium">{(Number(prob) * 100).toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Confusion Matrix */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Matrice de Confusion</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="grid grid-cols-3 gap-1 text-center text-sm">
                      <div className="font-bold">Prédit →</div>
                      {['cassure', 'sain', 'desiquilibre'].map((label) => (
                        <div key={label} className="font-bold">{label}</div>
                      ))}
                      {prediction.metrics.confusionMatrix.map((row, i) => (
                        <>
                          <div className="font-bold">{['cassure', 'sain', 'desiquilibre'][i]}</div>
                          {row.map((value, j) => (
                            <div key={j} className={`p-2 ${i === j ? 'bg-blue-100' : 'bg-gray-100'}`}>
                              {(value * 100).toFixed(2)}%
                            </div>
                          ))}
                        </>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Classification Metrics */}
                <div className="col-span-2">
                  <h3 className="text-lg font-medium mb-2">Métriques de Classification</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Bar
                        data={{
                          labels: prediction.metrics.classMetrics.map(m => m.class),
                          datasets: [
                            {
                              label: 'Précision',
                              data: prediction.metrics.classMetrics.map(m => m.precision * 100),
                              backgroundColor: 'rgba(54, 162, 235, 0.5)'
                            },
                            {
                              label: 'Rappel',
                              data: prediction.metrics.classMetrics.map(m => m.recall * 100),
                              backgroundColor: 'rgba(255, 99, 132, 0.5)'
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 100,
                              title: { display: true, text: 'Pourcentage' }
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-medium">Indicateurs globaux:</p>
                      <p>Score F1: {prediction.metrics.f1Score.toFixed(2)}</p>
                      <div className="mt-4">
                        <p className="font-medium">Indicateurs par classe:</p>
                        {prediction.metrics.classMetrics.map((metric) => (
                          <div key={metric.class} className="mt-2">
                            <p className="font-medium">{metric.class}:</p>
                            <p className="text-sm">VP: {((metric.precision * metric.recall) * 100).toFixed(2)}%</p>
                            <p className="text-sm">FP: {((1 - metric.precision) * 100).toFixed(2)}%</p>
                            <p className="text-sm">FN: {((1 - metric.recall) * 100).toFixed(2)}%</p>
                            <p className="text-sm">VN: {(((1 - metric.precision) * (1 - metric.recall)) * 100).toFixed(2)}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROC Curve */}
                <div className="col-span-2">
                  <h3 className="text-lg font-medium mb-2">Courbe ROC</h3>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: prediction.metrics.rocCurve.map(point => point.x.toFixed(2)),
                        datasets: [{
                          label: 'Courbe ROC',
                          data: prediction.metrics.rocCurve.map(point => point.y),
                          borderColor: 'rgb(75, 192, 192)',
                          tension: 0.1
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: {
                            title: { display: true, text: 'Taux de faux positifs' }
                          },
                          y: {
                            title: { display: true, text: 'Taux de vrais positifs' }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HomeContent;
