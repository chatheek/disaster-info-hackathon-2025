// src/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './AdminDashboard.css';

// --- IMPORTS FOR MAP ---
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- FIX LEAFLET DEFAULT ICON ISSUE ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function AdminDashboard({ session, onBack }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering State
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    setLoading(true);
    // Select * will automatically include contact_name and phone_number if they exist in DB
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .neq('status', 'Ignored') 
      .order('timestamp', { ascending: false });
    
    if (error) console.error('Error fetching reports:', error);
    else setReports(data);
    setLoading(false);
  };

  // --- ACTIONS ---

  const markActionTaken = async (id) => {
    if (!confirm('Mark this incident as resolved?')) return;
    const { error } = await supabase.from('reports').update({ status: 'Action Taken' }).eq('id', id);
    if (error) alert('Error updating status');
    else setReports(reports.map(r => r.id === id ? { ...r, status: 'Action Taken' } : r));
  };

  const markIgnored = async (id) => {
    if (!confirm('Hide this report?')) return;
    const { error } = await supabase.from('reports').update({ status: 'Ignored' }).eq('id', id);
    if (error) alert('Error updating status');
    else setReports(reports.filter(r => r.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onBack();
  };

  // --- EXPORT LOGIC (UPDATED) ---
  const handleExportCSV = () => {
    if (reports.length === 0) return alert("No data to export.");

    // Added Contact Name and Phone Number to headers
    const headers = ["ID", "Status", "Type", "Severity", "Contact Name", "Phone Number", "Comments", "Latitude", "Longitude", "Date", "Image URL"];
    
    const rows = reports.map(r => [
      r.id,
      r.status,
      r.disaster_type,
      r.severity,
      `"${(r.contact_name || 'N/A').replace(/"/g, '""')}"`, // Escape quotes
      `"${(r.phone_number || 'N/A').replace(/"/g, '""')}"`,
      `"${(r.comments || '').replace(/"/g, '""')}"`,
      r.latitude,
      r.longitude,
      new Date(r.timestamp).toLocaleString(),
      r.image_url || "N/A"
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `disaster_reports_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FILTER LOGIC ---
  const getFilteredReports = () => {
    if (severityFilter === 'all') return reports;
    return reports.filter(r => r.severity.toString() === severityFilter);
  };

  const displayedReports = getFilteredReports();

  // --- MAP REPORTS LOGIC ---
  const mapReports = reports.filter(r => r.status === 'Submitted');
  const sriLankaCenter = [7.8731, 80.7718]; 
  const sriLankaBounds = [[5.8, 79.5], [10.0, 82.0]];

  return (
    <div className="dashboard-container">
      
      {/* Header */}
      <div className="dashboard-header">
        <h2>🛡️ Admin Dashboard</h2>
        <button onClick={handleLogout} className="sign-out-btn">
          Sign Out
        </button>
      </div>

      {/* --- MAP SECTION --- */}
      {!loading && (
        <div className="map-preview-section">
          <h3>📍 Live Incident Map (Sri Lanka Only)</h3>
          <div className="map-container-wrapper">
             <MapContainer 
               center={sriLankaCenter} 
               zoom={8} 
               minZoom={7}
               maxBounds={sriLankaBounds}
               maxBoundsViscosity={1.0}
               scrollWheelZoom={true}
               style={{ height: "350px", width: "100%", borderRadius: "12px" }}
             >
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapReports.map((report) => (
                <Marker 
                  key={report.id} 
                  position={[report.latitude, report.longitude]}
                >
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
            <select 
              className="severity-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">Show All Levels</option>
              <option value="5">🔴 Level 5 (Critical)</option>
              <option value="4">🟠 Level 4 (High)</option>
              <option value="3">🟡 Level 3 (Medium)</option>
              <option value="2">🟢 Level 2 (Low)</option>
              <option value="1">🔵 Level 1 (Minor)</option>
            </select>
          </div>

          <button className="btn-export" onClick={handleExportCSV}>
            📥 Export to CSV
          </button>
        </div>
      )}

      {/* Table Area */}
      {loading ? (
        <div className="loading-state">
           <p>Loading global reports...</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>Type / Severity</th>
                  <th>Contact Name</th> {/* NEW HEADER */}
                  <th>Phone</th>        {/* NEW HEADER */}
                  <th>Location</th>
                  <th>Evidence</th>
                  <th>Comments</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {displayedReports.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      {reports.length === 0 ? "No active reports found." : "No reports match this severity filter."}
                    </td>
                  </tr>
                ) : (
                  displayedReports.map((report) => (
                    <tr key={report.id}>
                      
                      {/* Status */}
                      <td>
                        <span className={`status-badge ${report.status === 'Action Taken' ? 'action-taken' : 'submitted'}`}>
                          {report.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        {report.status !== 'Action Taken' && (
                          <div className="action-buttons">
                            <button className="btn-action btn-done" onClick={() => markActionTaken(report.id)}>
                              ✅ Done
                            </button>
                            <button className="btn-action btn-ignore" onClick={() => markIgnored(report.id)}>
                              🚫 Ignore
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="type-cell">
                        <strong>{report.disaster_type}</strong>
                        <span className="severity-meter">Severity: {report.severity}/5</span>
                      </td>

                      {/* --- NEW COLUMNS --- */}
                      
                      {/* Contact Name */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                         {report.contact_name || <span className="text-muted">-</span>}
                      </td>

                      {/* Phone Number */}
                      <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                         {report.phone_number ? (
                            <a href={`tel:${report.phone_number}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                               {report.phone_number}
                            </a>
                         ) : <span className="text-muted">-</span>}
                      </td>

                      {/* Location */}
                      <td>
                        <a 
                          href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="map-link"
                        >
                          📍 View Map
                        </a>
                        <span className="coord-text">{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</span>
                      </td>

                      {/* Image */}
                      <td>
                        {report.image_url ? (
                          <a href={report.image_url} target="_blank" rel="noreferrer">
                            <img src={report.image_url} alt="Evidence" className="report-thumb" />
                          </a>
                        ) : <span className="no-image">No Image</span>}
                      </td>

                      {/* Comments */}
                      <td style={{ maxWidth: '280px', lineHeight: '1.4' }}>
                        {report.comments}
                      </td>

                      {/* Date */}
                      <td>
                        <div className="date-text">{new Date(report.timestamp).toLocaleDateString()}</div>
                        <span className="time-text">
                          {new Date(report.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
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