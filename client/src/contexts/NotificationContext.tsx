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
      console.log('Adding notification for event:', event);
      
      if (!event._id || !event.severity) {
        console.error('Invalid event data:', event);
        return;
      }

      // Create notification directly with the event data
      const notificationResponse = await fetch('http://localhost:5000/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event._id,
          severity: event.severity,
          message: getNotificationMessage(event.severity),
          details: event.description || [],
          read: false
        }),
      });

      if (!notificationResponse.ok) {
        throw new Error('Failed to create notification');
      }

      const newNotification = await notificationResponse.json();
      console.log('Notification created:', newNotification);

      // Update local state with the new notification
      if (newNotification.success && newNotification.data) {
        setNotifications(prev => [newNotification.data, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Handle browser notifications
        await showBrowserNotification(event);
      }

    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  // Helper function to get notification message
  const getNotificationMessage = (severity: string): string => {
    switch (severity) {
      case 'ÉLEVÉ':
        return '⚠️ Défaut critique détecté';
      case 'MOYEN':
        return '⚡ Anomalie détectée';
      case 'NORMAL':
        return 'ℹ️ État normal';
      default:
        return 'Notification';
    }
  };

  // Helper function to show browser notification
  const showBrowserNotification = async (event: Event) => {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }

    const severityEmoji = {
      'ÉLEVÉ': '🔴',
      'MOYEN': '🟡',
      'NORMAL': '🟢',
      'FAIBLE': '⚪',
    }[event.severity] || '⚪';

    // Using only valid NotificationOptions properties
    new Notification(`${severityEmoji} ${getNotificationMessage(event.severity)}`, {
      body: `Fichier: ${event.fileName}\nType: ${event.type}`,
      icon: '/gear.svg',
      tag: event._id,
      requireInteraction: true, // Use this instead of renotify
      silent: false
    });
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