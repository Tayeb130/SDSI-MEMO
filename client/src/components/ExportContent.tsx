import { useState, useEffect } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import EventPDF from "./EventPDF";
import type { Event } from "./types";

function ExportContent() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/events`);
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const data = await response.json();
        setEvents(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const exportToCSV = (event: Event) => {
    // Create headers for basic info and prediction details
    const headers = [
      'Date',
      'Nom',
      'Type',
      'Sévérité',
      'Classe Prédite',
      'Confiance',
      'Score F1',
      'Description'
    ];

    // Format the basic data
    const basicData = [
      new Date(event.time).toLocaleString(),
      event.fileName,
      event.type,
      event.severity,
      event.predictionDetails.predictedClass,
      `${(event.predictionDetails.confidence * 100).toFixed(2)}%`,
      event.predictionDetails.metrics?.f1Score?.toFixed(4) || 'N/A',
      event.description.map(desc => `${desc.key}: ${desc.value}`).join('; ')
    ];

    // Create the CSV content
    const csvContent = [
      headers.join(','),
      basicData.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-${event.fileName}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Erreur!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Données des Événements</h2>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sévérité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event) => (
                <tr key={event._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.time).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.fileName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      event.severity === "ÉLEVÉ" ? "bg-red-100 text-red-800" :
                      event.severity === "MOYEN" ? "bg-orange-100 text-orange-800" :
                      event.severity === "NORMAL" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => exportToCSV(event)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      CSV
                    </button>
                    <PDFDownloadLink
                      document={<EventPDF event={event} />}
                      fileName={`event-${event.fileName}-${new Date().toISOString().split('T')[0]}.pdf`}
                      className="text-blue-600 hover:text-blue-800 font-medium ml-2"
                    >
                      {({ loading }) => (loading ? '...' : 'PDF')}
                    </PDFDownloadLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ExportContent;
