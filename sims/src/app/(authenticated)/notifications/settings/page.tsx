import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";

export default function NotificationSettings() {
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const prefs = useQuery(
    api.functions.notifications.getNotificationPreferences,
    sessionToken ? { token: sessionToken } : 'skip'
  ) || { email: true, frequency: "immediate" };
  
  const [local, setLocal] = useState<Record<string, unknown>>({});
  const save = useMutation(api.functions.notifications.saveNotificationPreferences);

  // Use prefs as the source of truth, merged with any local changes
  const currentValues = { ...prefs, ...local };

  return (
    <form onSubmit={async (e) => { 
      e.preventDefault();
      if (!sessionToken) {
        console.error("No session token");
        return;
      }
      await save({ 
        preferences: {
          email: currentValues.email as boolean | undefined,
          frequency: currentValues.frequency as string | undefined,
        },
        token: sessionToken 
      });
      setLocal({}); // Clear local changes after save
    }}>
      <label>
        <input 
          type="checkbox" 
          checked={!!currentValues.email} 
          onChange={e => setLocal({...local, email: e.target.checked})} 
        />
        Email notifications
      </label>
      <label>
        Frequency:
        <select 
          value={currentValues.frequency as string || "immediate"} 
          onChange={e => setLocal({...local, frequency: e.target.value})}
        >
          <option value="immediate">Immediate</option>
          <option value="daily">Daily digest</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>
      <button type="submit">Save</button>
    </form>
  );
}