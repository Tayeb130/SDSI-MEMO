import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Event } from './types';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 10,
    marginTop: 15,
    color: '#2563eb',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 150,
  },
  value: {
    fontSize: 12,
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    margin: 'auto',
    marginTop: 5,
    marginBottom: 5,
    fontSize: 10,
  },
});

interface EventPDFProps {
  event: Event;
}

const EventPDF: React.FC<EventPDFProps> = ({ event }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.title}>Event Details Report</Text>
        
        {/* Basic Information */}
        <Text style={styles.subtitle}>Basic Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>File Name:</Text>
          <Text style={styles.value}>{event.fileName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Time:</Text>
          <Text style={styles.value}>{new Date(event.time).toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{event.type}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Severity:</Text>
          <Text style={styles.value}>{event.severity}</Text>
        </View>

        {/* Prediction Details */}
        <Text style={styles.subtitle}>Prediction Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Predicted Class:</Text>
          <Text style={styles.value}>{event.predictionDetails.predictedClass}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Confidence:</Text>
          <Text style={styles.value}>{(event.predictionDetails.confidence * 100).toFixed(2)}%</Text>
        </View>

        {/* Signal Statistics */}
        <Text style={styles.subtitle}>Signal Statistics</Text>
        {event.description
          .filter((desc: any) => desc.key.includes('signal_') && desc.key.includes('_stats'))
          .map((desc: any) => (
            <View key={desc.key} style={styles.row}>
              <Text style={styles.label}>
                {desc.key.replace('signal_', '').replace('_stats', '')}:
              </Text>
              <Text style={styles.value}>{desc.value}</Text>
            </View>
          ))}

        {/* Dominant Frequencies */}
        <Text style={styles.subtitle}>Dominant Frequencies</Text>
        {event.description
          .filter((desc: any) => desc.key.includes('dominantFreq_'))
          .map((desc: any) => (
            <View key={desc.key} style={styles.row}>
              <Text style={styles.label}>
                {desc.key.replace('dominantFreq_', '')}:
              </Text>
              <Text style={styles.value}>{desc.value}</Text>
            </View>
          ))}

        {/* Class Probabilities */}
        <Text style={styles.subtitle}>Class Probabilities</Text>
        {event.description
          .filter((desc: any) => desc.key.includes('probability_'))
          .map((desc: any) => (
            <View key={desc.key} style={styles.row}>
              <Text style={styles.label}>
                {desc.key.replace('probability_', '')}:
              </Text>
              <Text style={styles.value}>{desc.value}</Text>
            </View>
          ))}
      </View>
    </Page>
  </Document>
);

export default EventPDF; 