import { useState, useEffect } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import EventPDF from "./EventPDF";
import type { Event } from "./types";

interface PaginationInfo {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface ModalProps {
  event: Event | null;
  onClose: () => void;
}

function Modal({ event, onClose }: ModalProps) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-white/95 backdrop-blur-sm rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-xl animate-slideIn" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Détails de l'Événement - {event.fileName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-lg mb-2">Informations de Base</h4>
              <p><span className="font-medium">Date:</span> {new Date(event.time).toLocaleString()}</p>
              <p><span className="font-medium">Type:</span> {event.type}</p>
              <p><span className="font-medium">Sévérité:</span> {event.severity}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-lg mb-2">Prédiction</h4>
              <p><span className="font-medium">Classe:</span> {event.predictionDetails.predictedClass}</p>
              <p><span className="font-medium">Confiance:</span> {(event.predictionDetails.confidence * 100).toFixed(2)}%</p>
            </div>
          </div>

          {/* Signal Statistics */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-lg mb-2">Statistiques des Signaux</h4>
            <div className="grid grid-cols-2 gap-4">
              {event.description
                .filter(desc => desc.key.includes('signal_') && desc.key.includes('_stats'))
                .map(desc => (
                  <div key={desc.key}>
                    <p className="font-medium">{desc.key.replace('signal_', '').replace('_stats', '')}</p>
                    <p className="text-gray-600">{desc.value}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* Class Probabilities */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-lg mb-2">Probabilités par Classe</h4>
            <div className="grid grid-cols-3 gap-4">
              {event.description
                .filter(desc => desc.key.includes('probability_'))
                .map(desc => (
                  <div key={desc.key} className="text-center">
                    <p className="font-medium">{desc.key.replace('probability_', '')}</p>
                    <p className="text-lg">{desc.value}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventHistoryContent() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pages: 1,
    limit: 10
  });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const fetchEvents = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/events?page=${page}&limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Historique des Événements</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchEvents(pagination.page - 1)}
            disabled={pagination.page === 1}
            className={`px-4 py-2 rounded ${
              pagination.page === 1
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-700 text-white'
            }`}
          >
            Précédent
          </button>
          <span className="px-4 py-2">
            Page {pagination.page} sur {pagination.pages}
          </span>
          <button
            onClick={() => fetchEvents(pagination.page + 1)}
            disabled={pagination.page === pagination.pages}
            className={`px-4 py-2 rounded ${
              pagination.page === pagination.pages
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-700 text-white'
            }`}
          >
            Suivant
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nom du Fichier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Prédiction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Confiance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sévérité
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {event.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {event.predictionDetails.predictedClass}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {(event.predictionDetails.confidence * 100).toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      event.severity === "ÉLEVÉ"
                        ? "bg-red-100 text-red-800"
                        : event.severity === "MOYEN"
                        ? "bg-orange-100 text-orange-800"
                        : event.severity === "NORMAL"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {event.severity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => setSelectedEvent(event)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Voir Détails
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selectedEvent && (
        <Modal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

export default EventHistoryContent;
