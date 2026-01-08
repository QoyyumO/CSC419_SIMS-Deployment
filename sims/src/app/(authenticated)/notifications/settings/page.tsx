import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";

export default function NotificationSettings() {
  const prefs = useQuery("getNotificationPreferences") || {};
  const [local, setLocal] = useState(prefs);
  const save = useMutation("saveNotificationPreferences");

  useEffect(() => setLocal(prefs), [prefs]);

  return (
    <form onSubmit={async (e) => { e.preventDefault(); await save(local); }}>
      <label>
        <input type="checkbox" checked={!!local.email} onChange={e => setLocal({...local,email: e.target.checked})} />
        Email notifications
      </label>
      <label>
        Frequency:
        <select value={local.frequency || "immediate"} onChange={e => setLocal({...local,frequency: e.target.value})}>
          <option value="immediate">Immediate</option>
          <option value="daily">Daily digest</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>
      <button type="submit">Save</button>
    </form>
  );
}