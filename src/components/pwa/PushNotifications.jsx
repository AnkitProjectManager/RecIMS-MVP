import React, { useState, useEffect } from "react";
import { recims } from "@/api/recimsClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PushNotifications({ user }) {
  const [permission, setPermission] = useState(Notification.permission);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        setSubscription(existingSubscription);
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        await subscribeToPush();
      }
    } catch (err) {
      console.error('Permission request error:', err);
      setError('Failed to request notification permission');
    }
  };

  const subscribeToPush = async () => {
    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Public VAPID key - in production, use environment variable
      const vapidPublicKey = 'BMxYN7MZbhEKjgKuU4QmVh0JxXF0mKIq_0Gv5Z5cBxjLr8Y7GnRQU5wVv_qZ0Ix3Jz9L3bCdF5vGhKmNpQrStWs';
      
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Save subscription to backend
      await saveSubscription(pushSubscription);
      
      setSubscription(pushSubscription);
      
      // Test notification
      await sendTestNotification();
    } catch (err) {
      console.error('Push subscription error:', err);
      setError('Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const saveSubscription = async (subscription) => {
    try {
      // Save to AppSettings for this user
      await recims.entities.AppSettings.create({
        setting_key: `push_subscription_${user.email}`,
        setting_value: JSON.stringify(subscription),
        setting_category: 'notifications',
        description: `Push notification subscription for ${user.email}`
      });
    } catch (err) {
      console.error('Error saving subscription:', err);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      if (subscription) {
        await subscription.unsubscribe();
        setSubscription(null);
        
        // Remove from backend
        await removeSubscription();
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError('Failed to unsubscribe from notifications');
    } finally {
      setLoading(false);
    }
  };

  const removeSubscription = async () => {
    try {
      const settings = await recims.entities.AppSettings.filter({
        setting_key: `push_subscription_${user.email}`
      });
      
      if (settings.length > 0) {
        await recims.entities.AppSettings.delete(settings[0].id);
      }
    } catch (err) {
      console.error('Error removing subscription:', err);
    }
  };

  const sendTestNotification = async () => {
    try {
      // Create a test notification
      if (Notification.permission === 'granted') {
        new Notification('RecIMS Notifications Enabled', {
          body: 'You will now receive alerts for shipments, inventory, and quality control.',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          vibrate: [200, 100, 200],
          tag: 'test-notification'
        });
      }
    } catch (err) {
      console.error('Test notification error:', err);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return (
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="w-5 h-5" />
            Push Notifications Not Supported
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {`Your browser doesn't support push notifications. Please use a modern browser.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Push Notifications
            {subscription && (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          {subscription ? (
            <p>{`✓ You're receiving notifications for:`}</p>
          ) : (
            <p>Enable notifications to receive alerts for:</p>
          )}
          <ul className="mt-2 ml-4 space-y-1">
            <li>• Inbound shipment arrivals</li>
            <li>• Low inventory warnings</li>
            <li>• Quality control failures</li>
            <li>• Purchase order updates</li>
            <li>• Sales order status changes</li>
          </ul>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {permission === 'denied' && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">
              Notifications are blocked. Please enable them in your browser settings.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          {!subscription ? (
            <Button
              onClick={requestPermission}
              disabled={loading || permission === 'denied'}
              className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Bell className="w-4 h-4" />
              {loading ? 'Enabling...' : 'Enable Notifications'}
            </Button>
          ) : (
            <Button
              onClick={unsubscribe}
              disabled={loading}
              variant="outline"
              className="flex-1 gap-2"
            >
              <BellOff className="w-4 h-4" />
              {loading ? 'Disabling...' : 'Disable Notifications'}
            </Button>
          )}
          
          {subscription && (
            <Button
              onClick={sendTestNotification}
              variant="outline"
              className="gap-2"
            >
              Test
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t">
          <p>💡 Notifications work even when the app is closed</p>
          <p className="mt-1">{`📱 Make sure "Background App Refresh" is enabled on your device`}</p>
        </div>
      </CardContent>
    </Card>
  );
}