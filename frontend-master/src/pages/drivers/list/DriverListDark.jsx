import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, MoreVertical, Edit, CheckCircle, Clock, Trash2, X } from 'lucide-react';
import config from '../../../config';

const DriverListDark = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openDropdown, setOpenDropdown] = useState(null);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${config.opsApiBase}/drivers/`);
      const data = await res.json();
      if (data.drivers) setDrivers(data.drivers);
    } catch (e) { console.error('Error fetching drivers:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const handleUpdateState = async (driverId, state) => {
    try {
      await fetch(`${config.opsApiBase}/drivers/${driverId}/state?state=${state}`, { method: 'PUT' });
      fetchDrivers();
    } catch (e) { console.error(e); }
    setOpenDropdown(null);
  };

  const handleDelete = async (driverId) => {
    if (!window.confirm('Are you sure you want to delete this driver?')) return;
    try {
      await fetch(`${config.opsApiBase}/drivers/${driverId}`, { method: 'DELETE' });
      fetchDrivers();
    } catch (e) { console.error(e); }
    setOpenDropdown(null);
  };

  const filtered = drivers.filter(d => {
    const matchSearch = (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (d.phone || '').includes(searchTerm);
    const matchStatus = statusFilter === 'all' || d.verification_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const verificationPill = (status) => {
    const map = {
      verified: 'ap-pill-green',
      pending: 'ap-pill-amber',
      rejected: 'ap-pill-red',
    };
    return map[status] || 'ap-pill-gray';
  };

  return (
    <>
      <div className="ap-topbar">
        <div className="ap-topbar-left">
          <div className="ap-topbar-title">Drivers</div>
        </div>
        <div className="ap-topbar-right">
          <Link to="/app/drivers/new" className="ap-btn ap-btn-primary" style={{ textDecoration: 'none' }}>
            <Plus size={16} /> Add new driver
          </Link>
        </div>
      </div>

      <div className="ap-content">
        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="ap-search" style={{ flex: 1, minWidth: 200, maxWidth: 400 }}>
            <Search size={16} />
            <input
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <X size={14} style={{ cursor: 'pointer', color: 'var(--ap-text-muted)' }}
                onClick={() => setSearchTerm('')} />
            )}
          </div>
          <select
            className="ap-btn ap-btn-ghost"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Table */}
        <div className="ap-card">
          <div className="ap-card-body" style={{ padding: 0, overflowX: 'auto' }}>
            {loading ? (
              <div className="ap-empty"><p>Loading drivers...</p></div>
            ) : filtered.length === 0 ? (
              <div className="ap-empty">
                <div className="ap-empty-icon">👤</div>
                <h3>No drivers found</h3>
                <p>{searchTerm ? `No results for "${searchTerm}"` : 'No drivers registered yet'}</p>
              </div>
            ) : (
              <table className="ap-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>ID</th><th>Name</th><th>Phone</th><th>License</th>
                    <th>Vehicle</th><th>Status</th><th>Verification</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.driver_id}>
                      <td style={{ fontWeight: 600, color: 'var(--ap-accent)' }}>{d.driver_id}</td>
                      <td style={{ fontWeight: 500 }}>{d.name}</td>
                      <td style={{ color: 'var(--ap-text-muted)' }}>{d.phone}</td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{d.license_number || '—'}</td>
                      <td style={{ fontSize: 12 }}>{d.vehicle_registration || '—'}</td>
                      <td>
                        <span className={d.is_online ? 'ap-pill ap-pill-green' : 'ap-pill ap-pill-gray'}>
                          {d.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td>
                        <span className={`ap-pill ${verificationPill(d.verification_status)}`}>
                          {d.verification_status}
                        </span>
                      </td>
                      <td>
                        <div className="ap-dropdown">
                          <button
                            className="ap-btn ap-btn-ghost"
                            style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: '#6b7280' }}
                            onClick={() => setOpenDropdown(openDropdown === d.driver_id ? null : d.driver_id)}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openDropdown === d.driver_id && (
                            <div className="ap-dropdown-menu">
                              <Link to={`/app/drivers/${d.driver_id}/edit`}
                                className="ap-dropdown-item" style={{ textDecoration: 'none' }}>
                                <Edit size={14} /> Edit
                              </Link>
                              <button className="ap-dropdown-item"
                                onClick={() => handleUpdateState(d.driver_id, 'verified')}>
                                <CheckCircle size={14} /> Mark verified
                              </button>
                              <button className="ap-dropdown-item"
                                onClick={() => handleUpdateState(d.driver_id, 'pending')}>
                                <Clock size={14} /> Mark pending
                              </button>
                              <button className="ap-dropdown-item danger"
                                onClick={() => handleDelete(d.driver_id)}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DriverListDark;
