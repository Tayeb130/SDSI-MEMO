import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Event } from '../components/types';

interface Notification {
  _id: string;
  eventId: Event;
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (event: Event) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch existing notifications on component mount
    const fetchNotifications = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/notifications');
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.data);
          setUnreadCount(data.data.filter((n: Notification) => !n.read).length);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
  }, []);

  const addNotification = async (event: Event) => {
    try {
      // Only create notification for NORMAL, MOYEN, or ÉLEVÉ severity
      if (event.severity !== 'FAIBLE') {
        const response = await fetch('http://localhost:5000/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eventId: event._id }),
        });

        if (response.ok) {
          const newNotification = await response.json();
          setNotifications(prev => [newNotification.data, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show browser notification if permission is granted
          if (Notification.permission === 'granted') {
            const severityText = {
              'ÉLEVÉ': '⚠️ Critique',
              'MOYEN': '⚠️ Moyen',
              'NORMAL': 'ℹ️ Normal'
            }[event.severity] || '';
            
            new Notification(`Nouvel événement détecté - ${severityText}`, {
              body: `Fichier: ${event.fileName}\nSévérité: ${event.severity}`,
              icon: '/gear.svg'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read: true }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notification =>
            notification._id === id ? { ...notification, read: true } : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/notifications/mark-all-read', {
        method: 'PATCH',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notification => ({ ...notification, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 