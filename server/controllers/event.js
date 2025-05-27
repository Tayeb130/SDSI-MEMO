const Event = require('../models/event');

/**
 * Create a new event
 * @route POST /api/events
 */
const createEvent = async (req, res) => {
    try {
        const {
            fileName,
            fileSize,
            fileType,
            predictionResult,
            signals,
            dominantFrequencies,
            interpretations,
            severity,
            type
        } = req.body;

        if (!fileName || !predictionResult) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: fileName or predictionResult'
            });
        }

        // Create description array with all available information
        const description = [
            { key: 'fileName', value: fileName },
            { key: 'fileSize', value: fileSize || 'N/A' },
            { key: 'fileType', value: fileType || 'N/A' },
            { key: 'uploadTime', value: new Date().toISOString() },
            { key: 'prediction', value: predictionResult.prediction },
            { key: 'confidence', value: predictionResult.confidence }
        ];

        // Add signal information if available
        if (signals) {
            Object.entries(signals).forEach(([signalName, data]) => {
                const stats = {
                    mean: data.reduce((a, b) => a + b, 0) / data.length,
                    std: Math.sqrt(data.reduce((a, b) => a + Math.pow(b - data.reduce((a, b) => a + b, 0) / data.length, 2), 0) / data.length),
                    min: Math.min(...data),
                    max: Math.max(...data)
                };
                description.push({
                    key: `signal_${signalName}_stats`,
                    value: `mean: ${stats.mean.toFixed(2)}, std: ${stats.std.toFixed(2)}, min: ${stats.min.toFixed(2)}, max: ${stats.max.toFixed(2)}`
                });
            });
        }

        // Add dominant frequencies if available
        if (dominantFrequencies) {
            Object.entries(dominantFrequencies).forEach(([signalName, freqs]) => {
                description.push({
                    key: `dominantFreq_${signalName}`,
                    value: freqs.map(f => `${f.freq.toFixed(2)}Hz (${f.magnitude.toFixed(2)})`).join(', ')
                });
            });
        }

        // Add interpretations if available
        if (interpretations) {
            Object.entries(interpretations).forEach(([signalName, interps]) => {
                description.push({
                    key: `interpretation_${signalName}`,
                    value: interps.join('; ')
                });
            });
        }

        // Add class probabilities
        if (predictionResult.class_probabilities) {
            Object.entries(predictionResult.class_probabilities).forEach(([className, prob]) => {
                description.push({
                    key: `probability_${className}`,
                    value: `${(Number(prob) * 100).toFixed(2)}%`
                });
            });
        }

        // Create event with all available information
        const eventData = {
            fileName,
            type: type || 'PREDICTION',
            severity: severity || 'LOW', // Ensure severity has a default value
            description,
            predictionDetails: {
                predictedClass: predictionResult.prediction,
                confidence: predictionResult.confidence,
                classConfidences: new Map(Object.entries(predictionResult.class_probabilities || {})),
                metrics: predictionResult.metrics,
                dominantFrequencies: dominantFrequencies ? Object.entries(dominantFrequencies).map(([signalName, freqs]) => ({
                    signalName,
                    frequencies: freqs.map(f => ({
                        freq: f.freq,
                        magnitude: f.magnitude,
                        interpretation: interpretations?.[signalName]?.find(i => i.includes(`${f.freq.toFixed(2)} Hz`)) || null
                    }))
                })) : [],
                signalStats: signals ? Object.entries(signals).map(([signalName, data]) => ({
                    signalName,
                    mean: data.reduce((a, b) => a + b, 0) / data.length,
                    std: Math.sqrt(data.reduce((a, b) => a + Math.pow(b - data.reduce((a, b) => a + b, 0) / data.length, 2), 0) / data.length),
                    min: Math.min(...data),
                    max: Math.max(...data)
                })) : []
            }
        };

        const event = await Event.create(eventData);

        res.status(201).json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating event',
            error: error.message
        });
    }
};

/**
 * Get all events with filtering and pagination
 * @route GET /api/events
 */
const getEvents = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            type,
            severity,
            startDate,
            endDate,
            predictedClass,
            minConfidence
        } = req.query;

        // Build query
        const query = {};

        // Add filters if provided
        if (type) query.type = type;
        if (severity) query.severity = severity;
        if (predictedClass) query['predictionDetails.predictedClass'] = predictedClass;
        if (minConfidence) query['predictionDetails.confidence'] = { $gte: parseFloat(minConfidence) };

        // Date range filter
        if (startDate || endDate) {
            query.time = {};
            if (startDate) query.time.$gte = new Date(startDate);
            if (endDate) query.time.$lte = new Date(endDate);
        }

        // Execute query with pagination
        const events = await Event.find(query)
            .sort({ time: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await Event.countDocuments(query);

        res.status(200).json({
            success: true,
            data: events,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching events',
            error: error.message
        });
    }
};

/**
 * Get event by ID
 * @route GET /api/events/:id
 */
const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Calculate additional statistics if needed
        const enrichedEvent = {
            ...event.toObject(),
            statistics: {
                timeSinceCreation: new Date() - event.time,
                // Add any other derived statistics here
            }
        };

        res.status(200).json({
            success: true,
            data: enrichedEvent
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching event',
            error: error.message
        });
    }
};

/**
 * Get event statistics
 * @route GET /api/events/stats
 */
const getEventStats = async (req, res) => {
    try {
        const stats = await Event.aggregate([
            {
                $group: {
                    _id: null,
                    totalEvents: { $sum: 1 },
                    avgConfidence: { $avg: '$predictionDetails.confidence' },
                    severityCounts: { $addToSet: '$severity' },
                    typeCounts: { $addToSet: '$type' },
                    predictionCounts: { $addToSet: '$predictionDetails.predictedClass' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalEvents: 1,
                    avgConfidence: 1,
                    severityCounts: {
                        $arrayToObject: {
                            $map: {
                                input: '$severityCounts',
                                as: 'severity',
                                in: {
                                    k: '$$severity',
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: '$severityCounts',
                                                as: 'item',
                                                cond: { $eq: ['$$item', '$$severity'] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    typeCounts: {
                        $arrayToObject: {
                            $map: {
                                input: '$typeCounts',
                                as: 'type',
                                in: {
                                    k: '$$type',
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: '$typeCounts',
                                                as: 'item',
                                                cond: { $eq: ['$$item', '$$type'] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    predictionCounts: {
                        $arrayToObject: {
                            $map: {
                                input: '$predictionCounts',
                                as: 'prediction',
                                in: {
                                    k: '$$prediction',
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: '$predictionCounts',
                                                as: 'item',
                                                cond: { $eq: ['$$item', '$$prediction'] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: stats[0] || {
                totalEvents: 0,
                avgConfidence: 0,
                severityCounts: {},
                typeCounts: {},
                predictionCounts: {}
            }
        });
    } catch (error) {
        console.error('Error fetching event statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching event statistics',
            error: error.message
        });
    }
};

module.exports = {
    createEvent,
    getEvents,
    getEventById,
    getEventStats
};
