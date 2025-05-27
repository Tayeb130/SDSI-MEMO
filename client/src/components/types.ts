export interface Description {
  key: string;
  value: string;
}

export interface PredictionDetails {
  predictedClass: string;
  confidence: number;
  metrics: {
    f1Score: number;
    confusionMatrix: number[][];
    rocCurve: { x: number; y: number }[];
    classMetrics: Array<{ class: string; precision: number; recall: number }>;
  };
}

export interface Event {
  _id: string;
  fileName: string;
  time: string;
  type: string;
  severity: "FAIBLE" | "NORMAL" | "MOYEN" | "ÉLEVÉ";
  description: Description[];
  predictionDetails: PredictionDetails;
} 