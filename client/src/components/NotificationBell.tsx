import { useState, useEffect } from 'react';
import { FaBell } from 'react-icons/fa';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Debug effect to monitor props
  useEffect(() => {
    console.log('NotificationBell - Current notifications:', notifications);
    console.log('NotificationBell - Unread count:', unreadCount);
  }, [notifications, unreadCount]);

  const handleNotificationClick = (notificationId: string) => {
    console.log('Marking notification as read:', notificationId);
    markAsRead(notificationId);
  };

  const handleBellClick = () => {
    console.log('Bell clicked, toggling dropdown');
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <FaBell className="w-6 h-6 text-gray-600 hover:text-yellow-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-50">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      console.log('Marking all notifications as read');
                      markAllAsRead();
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Tout marquer comme lu
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Aucune notification
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification._id)}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                      !notification.read ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.eventId.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          Sévérité {notification.eventId.severity} détectée
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          notification.eventId.severity === "ÉLEVÉ"
                            ? "bg-red-100 text-red-800"
                            : notification.eventId.severity === "MOYEN"
                            ? "bg-orange-100 text-orange-800"
                            : notification.eventId.severity === "NORMAL"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {notification.eventId.severity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 