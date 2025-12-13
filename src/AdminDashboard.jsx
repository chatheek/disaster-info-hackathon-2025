// src/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './AdminDashboard.css';

// --- IMPORTS FOR MAP ---
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- FIX LEAFLET DEFAULT ICON ISSUE ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- HELPER: HAVERSINE DISTANCE (Meters) ---
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const q1 = lat1 * Math.PI / 180;
  const q2 = lat2 * Math.PI / 180;
  const dq = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dq/2) * Math.sin(dq/2) +
            Math.cos(q1) * Math.cos(q2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

export default function AdminDashboard({ session, onBack }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highAlertSpots, setHighAlertSpots] = useState([]);
  
  // Filtering State
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .neq('status', 'Ignored') 
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports(data);
      detectHighAlerts(data);
    }
    setLoading(false);
  };

  // --- LOGIC: DETECT CLUSTERS (500m Radius) ---
  const detectHighAlerts = (allReports) => {
    const active = allReports.filter(r => r.status === 'Submitted');
    const clusters = [];
    const visited = new Set();

    for (let i = 0; i < active.length; i++) {
      if (visited.has(active[i].id)) continue;

      let cluster = [active[i]];
      visited.add(active[i].id);

      for (let j = i + 1; j < active.length; j++) {
        if (visited.has(active[j].id)) continue;

        const dist = getDistance(
          active[i].latitude, active[i].longitude,
          active[j].latitude, active[j].longitude
        );

        if (dist <= 500) { // 500 meters radius
          cluster.push(active[j]);
          visited.add(active[j].id);
        }
      }

      if (cluster.length >= 2) {
        clusters.push({
          id: `cluster-${i}`,
          mainReport: cluster[0],
          count: cluster.length,
          reports: cluster
        });
      }
    }
    setHighAlertSpots(clusters);
  };

  // --- ACTIONS ---
  const markActionTaken = async (id) => {
    if (!confirm('Mark this incident as resolved?')) return;
    const { error } = await supabase.from('reports').update({ status: 'Action Taken' }).eq('id', id);
    if (error) alert('Error updating status');
    else {
      const updated = reports.map(r => r.id === id ? { ...r, status: 'Action Taken' } : r);
      setReports(updated);
      detectHighAlerts(updated); // Re-calc alerts
    }
  };

  const markIgnored = async (id) => {
    if (!confirm('Hide this report?')) return;
    const { error } = await supabase.from('reports').update({ status: 'Ignored' }).eq('id', id);
    if (error) alert('Error updating status');
    else {
      const updated = reports.filter(r => r.id !== id);
      setReports(updated);
      detectHighAlerts(updated); // Re-calc alerts
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onBack();
  };

  // --- EXPORT LOGIC ---
  const handleExportCSV = () => {
    if (reports.length === 0) return alert("No data to export.");
    const headers = ["ID", "Status", "Type", "Severity", "Contact Name", "Phone Number", "Comments", "Latitude", "Longitude", "Date", "Image URL"];
    const rows = reports.map(r => [
      r.id, r.status, r.disaster_type, r.severity,
      `"${(r.contact_name || 'N/A').replace(/"/g, '""')}"`,
      `"${(r.phone_number || 'N/A').replace(/"/g, '""')}"`,
      `"${(r.comments || '').replace(/"/g, '""')}"`,
      r.latitude, r.longitude,
      new Date(r.timestamp).toLocaleString(), r.image_url || "N/A"
    ]);
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `disaster_reports_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click(); document.body.removeChild(link);
  };

  // --- FILTER & MAP DATA ---
  const getFilteredReports = () => {
    if (severityFilter === 'all') return reports;
    return reports.filter(r => r.severity.toString() === severityFilter);
  };
  const displayedReports = getFilteredReports();
  const mapReports = reports.filter(r => r.status === 'Submitted');
  const sriLankaCenter = [7.8731, 80.7718]; 
  const sriLankaBounds = [[5.8, 79.5], [10.0, 82.0]];

  return (
    <div className="dashboard-container">
      
      {/* Header */}
      <div className="dashboard-header">
        <h2>🛡️ Admin Dashboard</h2>
        <button onClick={handleLogout} className="sign-out-btn">Sign Out</button>
      </div>

      {/* --- 🚨 HIGH ALERT BANNER --- */}
      {highAlertSpots.length > 0 && (
        <div className="high-alert-banner">
          <h3>⚠️ HIGH ALERT: Duplicated Incidents Detected</h3>
          <p>The following locations have received multiple reports within a 500m radius. Please prioritize.</p>
          <div className="alert-cards">
            {highAlertSpots.map(cluster => (
              <div key={cluster.id} className="alert-card">
                <span className="alert-count">{cluster.count} Reports </span>
                
                <span className="alert-loc">
                  Near {cluster.mainReport.latitude.toFixed(3)},  {cluster.mainReport.longitude.toFixed(3)}
                </span>
                <a href={`https://www.google.com/maps?q=${cluster.mainReport.latitude},${cluster.mainReport.longitude}`} target="_blank" rel="noreferrer">
                    <span>   </span>View Cluster
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MAP SECTION --- */}
      {!loading && (
        <div className="map-preview-section">
          <h3>📍 Live Incident Map</h3>
          <div className="map-container-wrapper">
             <MapContainer 
               center={sriLankaCenter} zoom={8} minZoom={7}
               maxBounds={sriLankaBounds} maxBoundsViscosity={1.0}
               scrollWheelZoom={true}
               style={{ height: "350px", width: "100%", borderRadius: "12px" }}
             >
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Draw Red Circles around Clusters */}
              {highAlertSpots.map(cluster => (
                <Circle 
                  key={cluster.id}
                  center={[cluster.mainReport.latitude, cluster.mainReport.longitude]}
                  pathOptions={{ color: 'red', fillColor: '#f03', fillOpacity: 0.3 }}
                  radius={500} 
                />
              ))}

              {mapReports.map((report) => (
                <Marker key={report.id} position={[report.latitude, report.longitude]}>
                  <Popup>
                    <strong>{report.disaster_type}</strong> <br />
                    Severity: {report.severity} <br />
                    {new Date(report.timestamp).toLocaleDateString()}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!loading && (
        <div className="dashboard-toolbar">
          <div className="filter-group">
            <label>Filter by Severity:</label>
            <select className="severity-select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="all">Show All Levels</option>
              <option value="5">🔴 Level 5 (Critical)</option>
              <option value="4">🟠 Level 4 (High)</option>
              <option value="3">🟡 Level 3 (Medium)</option>
              <option value="2">🟢 Level 2 (Low)</option>
              <option value="1">🔵 Level 1 (Minor)</option>
            </select>
          </div>
          <button className="btn-export" onClick={handleExportCSV}>📥 Export to CSV</button>
        </div>
      )}

      {/* Table Area */}
      {loading ? (
        <div className="loading-state"><p>Loading global reports...</p></div>
      ) : (
        <div className="table-card">
          <div className="table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>Type / Severity</th>
                  <th>Contact Name</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Evidence</th>
                  <th>Comments</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {displayedReports.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state">{reports.length === 0 ? "No active reports found." : "No reports match this severity filter."}</td></tr>
                ) : (
                  displayedReports.map((report) => (
                    <tr key={report.id}>
                      {/* Status */}
                      <td><span className={`status-badge ${report.status === 'Action Taken' ? 'action-taken' : 'submitted'}`}>{report.status}</span></td>
                      {/* Actions */}
                      <td>
                        {report.status !== 'Action Taken' && (
                          <div className="action-buttons">
                            <button className="btn-action btn-done" onClick={() => markActionTaken(report.id)}>✅ Done</button>
                            <button className="btn-action btn-ignore" onClick={() => markIgnored(report.id)}>🚫 Ignore</button>
                          </div>
                        )}
                      </td>
                      {/* Data Columns */}
                      <td className="type-cell"><strong>{report.disaster_type}</strong><span className="severity-meter">Severity: {report.severity}/5</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{report.contact_name || <span className="text-muted">-</span>}</td>
                      <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                         {report.phone_number ? (<a href={`tel:${report.phone_number}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{report.phone_number}</a>) : <span className="text-muted">-</span>}
                      </td>
                      <td>
                        <a href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`} target="_blank" rel="noreferrer" className="map-link">📍 View Map</a>
                        <span className="coord-text">{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</span>
                      </td>
                      <td>{report.image_url ? (<a href={report.image_url} target="_blank" rel="noreferrer"><img src={report.image_url} alt="Evidence" className="report-thumb" /></a>) : <span className="no-image">No Image</span>}</td>
                      <td style={{ maxWidth: '280px', lineHeight: '1.4' }}>{report.comments}</td>
                      <td>
                        <div className="date-text">{new Date(report.timestamp).toLocaleDateString()}</div>
                        <span className="time-text">{new Date(report.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}