import React, { useState, useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
  metadata?: {
    evaluation_id?: number;
    self_evaluation_id?: number;
    matrix_id?: number;
  };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/evaluation/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark notification as read
      await fetch('/api/evaluation/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: notification.id }),
      });

      // Navigate to the appropriate page based on notification type
      if (notification.metadata) {
        if (notification.metadata.evaluation_id) {
          router.push(`/evaluation/evaluations/${notification.metadata.evaluation_id}`);
        } else if (notification.metadata.self_evaluation_id) {
          router.push(`/evaluation/self-evaluations/${notification.metadata.self_evaluation_id}`);
        } else if (notification.metadata.matrix_id) {
          router.push(`/evaluation/matrices/${notification.metadata.matrix_id}`);
        }
      }

      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notification.id ? { ...n, status: 'read' } : n
      ));
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'pending').length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-4 text-left border-b hover:bg-gray-50 ${
                    notification.status === 'pending' ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900">{notification.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{notification.message}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(notification.created_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 