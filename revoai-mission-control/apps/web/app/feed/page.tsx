'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function FeedPage() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'change-me';
    fetch(`${base}/api/events/feed`, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setEvents(d));

    const socket = io(base);
    socket.on('activity', (evt) => {
      setEvents((prev) => [evt, ...prev].slice(0, 200));
    });
    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <h1>Live Activity Feed</h1>
      <ul>
        {events.map((e, idx) => (
          <li key={e.id ?? idx}>
            <code>{e.eventType ?? e.type}</code> — {new Date(e.createdAt ?? e.timestamp).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
