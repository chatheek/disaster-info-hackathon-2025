// src/App.jsx
import { useState, useEffect } from 'react';
import { db } from './db';
import { supabase } from './supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import Auth from './Auth';
import AdminDashboard from './AdminDashboard';
import './App.css'; // <--- Import the new stylesheet

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('home'); // 'home' or 'admin'
  
  // App States
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [coords, setCoords] = useState(null);

  // Table Data State
  const [myReports, setMyReports] = useState([]);

  // Helper to check if current user is admin
  const isAdmin = session?.user?.email === 'admin@gmail.com';

  // 1. INITIALIZE
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      handleSessionRouting(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      handleSessionRouting(session);
    });

    updatePendingCount();
    window.addEventListener('online', handleSync);
    
    // Auto-location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationPermission('granted');
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => { if (error.code === 1) setLocationPermission('denied'); }
    );

    return () => {
      window.removeEventListener('online', handleSync);
      subscription.unsubscribe();
    };
  }, []);

  // --- ROUTING ---
  const handleSessionRouting = (currentSession) => {
    if (currentSession) {
      fetchReports(currentSession.user.id);
      if (currentSession.user.email === 'admin@gmail.com') {
        setView('admin');
      } else {
        setView('home');
      }
    }
  };

  // --- FETCH DATA ---
  const fetchReports = async (userId) => {
    const localData = await db.pendingReports.toArray();
    const formattedLocal = localData.map(item => ({
      ...item,
      disaster_type: item.disasterType,
      status: '⚠️ Pending Upload',
      isLocal: true
    }));

    const { data: remoteData } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    const combined = [...formattedLocal, ...(remoteData || [])];
    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setMyReports(combined);
  };

  // --- SYNC & UPLOAD ---
  const requestLocation = () => {
    if (!navigator.geolocation) return alert("Browser not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationPermission('granted');
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => { if (err.code === 1) setLocationPermission('denied'); }
    );
  };

  const updatePendingCount = async () => {
    const count = await db.pendingReports.count();
    setPendingCount(count);
  };

  const handleSync = async () => {
    if (!navigator.onLine) return;
    setStatus('Syncing...');
    const pending = await db.pendingReports.toArray();
    
    if (pending.length === 0) {
      setStatus('All synced');
      return;
    }

    for (const report of pending) {
      try {
        await uploadToSupabase(report);
        await db.pendingReports.delete(report.id);
      } catch (e) { console.error("Sync error", e); }
    }
    await updatePendingCount();
    setStatus('Sync Complete');
    if (session) fetchReports(session.user.id);
  };

  const uploadToSupabase = async (data) => {
    let imageUrl = null;

    if (data.imageBlob) {
      const fileName = `${uuidv4()}.jpg`;
      const { error: upErr } = await supabase.storage.from('reports').upload(fileName, data.imageBlob);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('reports').getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    const { error } = await supabase.from('reports').insert({
      user_id: data.userId, 
      disaster_type: data.disasterType,
      comments: data.comments,
      latitude: data.latitude,
      longitude: data.longitude,
      severity: data.severity,
      timestamp: data.timestamp,
      image_url: imageUrl,
      status: 'Submitted'
    });
    if (error) throw error;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coords) return alert("Please enable location first.");

    setLoading(true);
    setStatus('Processing...');
    const formData = new FormData(e.target);
    const imageFile = formData.get('image');

    const payload = {
      userId: session.user.id, 
      disasterType: formData.get('disasterType'),
      comments: formData.get('comments'),
      severity: formData.get('severity'),
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: new Date().toISOString(),
      imageBlob: imageFile.size > 0 ? imageFile : null,
    };

    if (navigator.onLine) {
      try {
        await uploadToSupabase(payload);
        setStatus('Submitted Successfully!');
      } catch (err) {
        console.error(err);
        await db.pendingReports.add(payload);
        setStatus('Upload failed. Saved locally.');
      }
    } else {
      await db.pendingReports.add(payload);
      setStatus('Offline. Saved to Pending.');
    }
    e.target.reset();
    updatePendingCount();
    fetchReports(session.user.id);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView('home');
  };

  // --- RENDER ---
  if (!session) return <Auth />;

  if (view === 'admin' && isAdmin) {
    return <AdminDashboard session={session} onBack={() => setView('home')} />;
  }

  return (
    <div className="app-container">
      
      {/* Header */}
      <header className="app-header">
        <h2>Disaster Reporter</h2>
        <div className="header-actions">
          {isAdmin && (
            <button onClick={() => setView('admin')} className="btn-admin">
              🛡️ Admin
            </button>
          )}
          <button onClick={handleLogout} className="btn-signout">Sign Out</button>
        </div>
      </header>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-info">
          <strong>System:</strong> {status} 
          {pendingCount > 0 && <span> | <strong>Pending:</strong> {pendingCount}</span>}
        </div>
        {pendingCount > 0 && navigator.onLine && (
          <button onClick={handleSync} className="btn-sync">
            Force Sync Now
          </button>
        )}
      </div>

      {/* Location Gate & Form */}
      {locationPermission !== 'granted' ? (
        <div className="location-gate">
          <h3>📍 Location Access Required</h3>
          <p>Please enable GPS to verify coordinates for your report.</p>
          <button onClick={requestLocation} className="btn-enable-loc">Enable Location Services</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="report-form">
          <h3 className="form-title">New Report</h3>
          
          <div className="location-badge">
             ✅ GPS Locked: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
          </div>

          <div className="form-row">
            <div className="form-group">
                <label>Disaster Type</label>
                <select name="disasterType" required>
                    <option value="flood">Flood</option>
                    <option value="fire">Fire</option>
                    <option value="earthquake">Earthquake</option>
                    <option value="landslide">Landslide</option>
                </select>
            </div>
            <div className="form-group">
                <label>Severity (1-5)</label>
                <input type="number" name="severity" min="1" max="5" defaultValue="3" />
            </div>
          </div>

          <div className="form-group">
            <label>Comments</label>
            <textarea name="comments" rows="3" required placeholder="Describe the situation..."></textarea>
          </div>

          <div className="form-group">
             <label>Photo Evidence</label>
             <div className="file-input-wrapper">
                <input type="file" name="image" accept="image/*" />
             </div>
          </div>

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Sending Report...' : 'SUBMIT REPORT'}
          </button>
        </form>
      )}

      {/* History Table */}
      <div className="history-section">
        <h3>Submission History</h3>
        <div className="table-responsive">
          <table className="history-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Comment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {myReports.length === 0 ? (
                <tr><td colSpan="4" style={{padding: '20px', textAlign: 'center', color: '#777'}}>No reports yet.</td></tr>
              ) : (
                myReports.map((item, idx) => (
                  <tr key={idx} className={item.isLocal ? 'row-local' : 'row-remote'}>
                    
                    {/* Status */}
                    <td>
                      {item.isLocal ? (
                          <span className="status-pending">⚠️ {item.status}</span>
                      ) : (
                          <span className={item.status === 'Submitted' ? 'status-submitted' : 'status-resolved'}>
                              {item.status === 'Submitted' ? '✅ Submitted' : item.status}
                          </span>
                      )}
                    </td>

                    {/* Type */}
                    <td>
                      <strong style={{textTransform:'capitalize'}}>{item.disaster_type}</strong>
                      <span className="meta-info">Sev: {item.severity}</span>
                    </td>

                    {/* Comment */}
                    <td style={{maxWidth:'200px'}}>
                      {item.comments}
                    </td>

                    {/* Date */}
                    <td>
                      {new Date(item.timestamp).toLocaleDateString()}
                      <span className="meta-info">
                        {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}