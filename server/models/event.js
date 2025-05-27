const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  time: {
    type: Date,
    default: Date.now,
    required: true,
  },
  type: {
    type: String,
    enum: ['FILE_UPLOAD', 'PREDICTION', 'ERROR'],
    required: true,
  },
  description: [{
    key: {
      type: String,
      required: true
    },
    value: mongoose.Schema.Types.Mixed
  }],
  severity: {
    type: String,
    enum: ['FAIBLE', 'NORMAL', 'MOYEN', 'ÉLEVÉ'],
    required: true
  },
  // Additional fields to store prediction results
  predictionDetails: {
    predictedClass: String,
    confidence: Number,
    classConfidences: Map,
    metrics: {
      f1Score: Number,
      confusionMatrix: [[Number]],
      classMetrics: [{
        class: String,
        precision: Number,
        recall: Number
      }]
    },
    dominantFrequencies: [{
      signalName: String,
      frequencies: [{
        freq: Number,
        magnitude: Number,
        interpretation: String
      }]
    }],
    signalStats: [{
      signalName: String,
      mean: Number,
      std: Number,
      min: Number,
      max: Number
    }]
  }
}, {
  timestamps: true
});

// Example of how description array will be populated:
// description: [
//   { key: 'fileName', value: 'signal_20240318.mat' },
//   { key: 'fileSize', value: '2.5MB' },
//   { key: 'prediction', value: 'cassure' },
//   { key: 'confidence', value: 99.91 },
//   { key: 'dominantFreq_i1', value: '99.5Hz' },
//   { key: 'interpretation_i1', value: 'défaut rotorique suspecté' },
//   ...
// ]

// Indexes for efficient querying
eventSchema.index({ time: -1 });
eventSchema.index({ type: 1 });
eventSchema.index({ severity: 1 });
eventSchema.index({ 'predictionDetails.predictedClass': 1 });

// Method to determine severity based on prediction confidence and fault type
eventSchema.methods.calculateSeverity = function() {
  if (!this.predictionDetails?.predictedClass) return 'FAIBLE';

  const confidence = this.predictionDetails.confidence;
  const predictedClass = this.predictionDetails.predictedClass;

  if (predictedClass === 'cassure' && confidence > 0.9) return 'ÉLEVÉ';
  if (predictedClass === 'desiquilibre' && confidence > 0.9) return 'MOYEN';
  if (confidence > 0.9) return 'NORMAL';
  return 'FAIBLE';
};

// Pre-save middleware to ensure severity is set
eventSchema.pre('save', function(next) {
  if (!this.severity) {
    this.severity = this.calculateSeverity();
  }
  next();
});

// Static method to create an event from HomeContent upload results
eventSchema.statics.createFromUpload = async function(fileName, predictionResult) {
  const description = [
    { key: 'fileName', value: fileName },
    { key: 'prediction', value: predictionResult.prediction },
    { key: 'confidence', value: predictionResult.confidence }
  ];

  // Add class probabilities to description
  if (predictionResult.class_probabilities) {
    Object.entries(predictionResult.class_probabilities).forEach(([className, prob]) => {
      description.push({
        key: `probability_${className}`,
        value: `${(Number(prob) * 100).toFixed(2)}%`
      });
    });
  }

  // Add signal statistics if available
  if (predictionResult.signals) {
    Object.entries(predictionResult.signals).forEach(([signalName, data]) => {
      const stats = {
        mean: data.reduce((a, b) => a + b, 0) / data.length,
        std: Math.sqrt(data.reduce((a, b) => a + Math.pow(b - data.reduce((a, b) => a + b, 0) / data.length, 2), 0) / data.length)
      };
      description.push({
        key: `stats_${signalName}`,
        value: `mean: ${stats.mean.toFixed(2)}, std: ${stats.std.toFixed(2)}`
      });
    });
  }

  const event = new this({
    fileName,
    type: 'PREDICTION',
    description,
    predictionDetails: {
      predictedClass: predictionResult.prediction,
      confidence: predictionResult.confidence,
      classConfidences: new Map(Object.entries(predictionResult.class_probabilities || {})),
      metrics: predictionResult.metrics
    }
  });

  return event.save();
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
