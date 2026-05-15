import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Car, MapPin, Home, Route, Clock, Filter } from 'lucide-react';
import { useCity } from '../../contexts/CityContext';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { getVehicleDetailsByName, getVehicleNamesByClass } from '../../utils/vehicleDataLoader';
import config from '../../config';
import { useGoogleMaps } from '../../context/GoogleMapsProvider';
import CompleteRouteDetails from '../../components/VehicleDetails/CompleteRouteDetails';
import DriverPayTab from '../vehicles/list/DriverPayTab';
import PlacesAutocompleteInput from '../../components/PlacesAutocompleteInput';
import './VehicleDetails.css';

// ─── Single document card used inside the Vehicle Docs modal ─────────────────
function DriverDocCard({ docType, doc, vehicleId, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadErr('');
    try {
      const token = localStorage.getItem('token');
      const base = config.opsApiBase.replace('/ops', '');
      const form = new FormData();
      form.append('document_type', docType.key);
      form.append('file', file);
      const res = await fetch(
        `${base}/ops/onboarding/driver-documents/${vehicleId}/upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
      );
      const data = await res.json();
      if (!data.success) {
        setUploadErr(data.message || 'Upload failed');
      } else {
        onRefresh();
      }
    } catch (err) {
      setUploadErr(err.message || 'Upload error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      {/* Card header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: doc.present ? '#f0fdf4' : '#fff7f7',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{docType.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{docType.label}</span>
          <span style={{
            background: doc.present ? '#d1fae5' : '#fee2e2',
            color: doc.present ? '#065f46' : '#b91c1c',
            borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600,
          }}>
            {doc.present ? 'Present' : 'Missing'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            disabled={uploading}
            style={{
              background: doc.present ? '#6b7280' : '#f59e0b',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '5px 12px', fontSize: 12, cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? '⏳ Uploading…' : doc.present ? '🔄 Update' : '⬆️ Upload'}
          </button>
          <span style={{ color: '#9ca3af', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {uploadErr && (
        <div style={{ background: '#fee2e2', padding: '6px 14px', fontSize: 12, color: '#b91c1c' }}>
          ⚠️ {uploadErr}
        </div>
      )}

      {expanded && (
        <div style={{ padding: '12px 14px', background: '#fff' }}>
          {doc.url && doc.url !== 'manual-entry' && (
            <div style={{ marginBottom: 12 }}>
              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={doc.url}
                  alt={docType.label}
                  style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, border: '1px solid #e5e7eb', objectFit: 'contain' }}
                />
              </a>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer">Open full image ↗</a>
              </div>
            </div>
          )}
          {doc.data && Object.keys(doc.data).length > 0 ? (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                {Object.entries(doc.data).map(([k, v]) =>
                  v !== null && v !== undefined && typeof v !== 'object' ? (
                    <tr key={k} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: '#374151', width: '42%', textTransform: 'capitalize' }}>
                        {k.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '4px 8px', color: '#111827' }}>{String(v)}</td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
              {doc.present ? 'No extracted data available.' : 'No document uploaded yet. Click Upload above.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const DRIVER_DOC_TYPES = [
  { key: 'dl',        label: 'Driving License',          icon: '🪪' },
  { key: 'rc',        label: 'Registration Certificate', icon: '📄' },
  { key: 'insurance', label: 'Insurance',                icon: '🛡️' },
  { key: 'emission',  label: 'Emission / PUC',           icon: '🌿' },
  { key: 'vehicle',   label: 'Vehicle Photo',            icon: '🚛' },
];

// ─── Bank Details section inside the Vehicle Docs modal ──────────────────────
function BankDetailsSection({ vehicleId }) {
  const [form, setForm] = useState({ bank: '', ifsc_code: '', acc_no: '', branch_name: '', upi_id: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'success'|'error', text }

  useEffect(() => {
    const fetchBank = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const base = config.opsApiBase.replace('/ops', '');
        const res = await fetch(`${base}/ops/onboarding/driver-bank/${vehicleId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setForm({
            bank: data.bank || '',
            ifsc_code: data.ifsc_code || '',
            acc_no: data.acc_no || '',
            branch_name: data.branch_name || '',
            upi_id: data.upi_id || '',
          });
        }
      } catch (_) {}
      setLoading(false);
    };
    if (vehicleId) fetchBank();
  }, [vehicleId]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const token = localStorage.getItem('token');
      const base = config.opsApiBase.replace('/ops', '');
      const res = await fetch(`${base}/ops/onboarding/driver-bank/${vehicleId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: 'Bank details saved' });
      } else {
        setMsg({ type: 'error', text: data.message || 'Save failed' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Save error' });
    }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>⏳ Loading bank details…</div>;

  const field = (key, label, placeholder) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      <input
        type="text"
        value={form[key]}
        placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{
          width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
          padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginTop: 16 }}>
      {/* Header */}
      <div style={{ background: '#f0f9ff', padding: '10px 14px', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🏦 Bank Details</span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div>{field('bank', 'Bank Name', 'e.g. State Bank of India')}</div>
          <div>{field('ifsc_code', 'IFSC Code', 'e.g. SBIN0001234')}</div>
          <div>{field('acc_no', 'Account Number', 'e.g. 123456789012')}</div>
          <div>{field('branch_name', 'Branch Name', 'e.g. Manipal Main Branch')}</div>
        </div>
        {field('upi_id', 'UPI ID', 'e.g. driver@upi')}
        {msg && (
          <div style={{
            background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: msg.type === 'success' ? '#065f46' : '#b91c1c',
            borderRadius: 6, padding: '7px 12px', fontSize: 13, marginBottom: 10,
          }}>
            {msg.type === 'success' ? '✅' : '⚠️'} {msg.text}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '⏳ Saving…' : '💾 Save Bank Details'}
        </button>
      </div>
    </div>
  );
}

const VehicleDetails = () => {
  const location = useLocation();
  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useGoogleMaps();
  const { selectedCities } = useCity();
  const { isDateInRange, dateRange } = useDateFilter();
  const [vehicles, setVehicles] = useState([]);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [cityCache, setCityCache] = useState({}); // vehicle_id -> current location address (on-demand only)
  const [baseLocationCache, setBaseLocationCache] = useState({}); // vehicle_id -> base location address (localStorage-backed)
  const [locationLoadingVehicles, setLocationLoadingVehicles] = useState(new Set()); // vehicle_id set of loading current location
  const [templateSentVehicles, setTemplateSentVehicles] = useState(new Set()); // Track vehicles where template was sent
  const [sendingTemplate, setSendingTemplate] = useState(new Set()); // Track vehicles currently sending template
  const [bonusSentVehicles, setBonusSentVehicles] = useState(new Set()); // Track vehicles where bonus was sent
  const [sendingBonus, setSendingBonus] = useState(new Set()); // Track vehicles currently sending bonus

  // Tab state
  const [activeTab, setActiveTab] = useState('vehicles'); // 'vehicles' | 'driver-pay' | 'register-vehicle'
  const [registrationRecords, setRegistrationRecords] = useState([]);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerVehicle, setRegisterVehicle] = useState('');
  const [registerPlaceAddress, setRegisterPlaceAddress] = useState('');
  const [registerBaseLat, setRegisterBaseLat] = useState('');
  const [registerBaseLng, setRegisterBaseLng] = useState('');
  const [registerResolvedAddress, setRegisterResolvedAddress] = useState('');
  const [isRegisterGeocoding, setIsRegisterGeocoding] = useState(false);
  
  // Edit Registration Modal State
  const [showEditRegModal, setShowEditRegModal] = useState(false);
  const [editRegRow, setEditRegRow] = useState(null);
  const [editRegName, setEditRegName] = useState('');
  const [editRegPhone, setEditRegPhone] = useState('');
  const [editRegVehicle, setEditRegVehicle] = useState('');
  const [editRegClass, setEditRegClass] = useState('');
  const [editRegAddress, setEditRegAddress] = useState('');
  const [editRegBaseLat, setEditRegBaseLat] = useState('');
  const [editRegBaseLng, setEditRegBaseLng] = useState('');
  const [editRegSaving, setEditRegSaving] = useState(false);
  const [editRegError, setEditRegError] = useState('');
  const [isEditRegGeocoding, setIsEditRegGeocoding] = useState(false);

  // Registration Messages Modal State
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [selectedDriverForMessages, setSelectedDriverForMessages] = useState(null);
  const [driverMessages, setDriverMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [isRegistrationBotPaused, setIsRegistrationBotPaused] = useState(false);
  const [isRegistrationBotStatusLoading, setIsRegistrationBotStatusLoading] = useState(false);
  const [isRegistrationBotToggling, setIsRegistrationBotToggling] = useState(false);
  const [registrationManualMessage, setRegistrationManualMessage] = useState('');
  const [isSendingRegistrationManualMessage, setIsSendingRegistrationManualMessage] = useState(false);

  const [visibleMessageCount, setVisibleMessageCount] = useState(20);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [prevMessagesCount, setPrevMessagesCount] = useState(0);



  useEffect(() => {
    const tabFromState = location?.state?.activeTab;
    const query = new URLSearchParams(location?.search || '');
    const tabFromQuery = query.get('tab');
    const incomingTab = tabFromState || tabFromQuery;

    if (!incomingTab) return;

    const normalized = String(incomingTab).toLowerCase();
    if (normalized === 'register' || normalized === 'register-vehicle') {
      setActiveTab('register-vehicle');
      return;
    }
    if (normalized === 'driver-pay') {
      setActiveTab('driver-pay');
      return;
    }
    if (normalized === 'vehicles') {
      setActiveTab('vehicles');
    }
  }, [location]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  };

  useEffect(() => {
    if (driverMessages.length > prevMessagesCount) {
      scrollToBottom();
      setTimeout(scrollToBottom, 150); // Backup timeout in case images are fast but not instant
      setPrevMessagesCount(driverMessages.length);
    }
  }, [driverMessages.length, prevMessagesCount]);

  const handleScrollMessages = () => {
    if (messagesContainerRef.current) {
      // Allow a small threshold (e.g. 5px) for detection
      if (messagesContainerRef.current.scrollTop <= 5) {
        if (visibleMessageCount < driverMessages.length) {
          setVisibleMessageCount(prev => prev + 20);
        }
      }
    }
  };

  // Vehicle chat state
  const [selectedVehicleForChat, setSelectedVehicleForChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [isChatBotPaused, setIsChatBotPaused] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [driverHasApp, setDriverHasApp] = useState(false); // true if driver uses the app

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const chatMessagesEndRef = useRef(null);


  // Unassigned bookings state
  const [unassignedBookings, setUnassignedBookings] = useState([]);
  const [bookingSearchTerm, setBookingSearchTerm] = useState('');
  const [selectedVehicleForAssignment, setSelectedVehicleForAssignment] = useState(null);

  // NEW: Validation state for two-step manual assignment flow
  const [selectedBookingForValidation, setSelectedBookingForValidation] = useState(null);
  const [validationStep, setValidationStep] = useState('select'); // 'select' | 'warnings' | 'confirmed'
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);

  // Bonus Payment state
  const [showBonusPayModal, setShowBonusPayModal] = useState(false);
  const [showBonusHistoryModal, setShowBonusHistoryModal] = useState(false);
  const [selectedVehicleForBonus, setSelectedVehicleForBonus] = useState(null);
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().split('T')[0]);
  const [bonusTrips, setBonusTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [showBonusConfirmation, setShowBonusConfirmation] = useState(false);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [isSubmittingBonus, setIsSubmittingBonus] = useState(false);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [bonusHistoryDateFilter, setBonusHistoryDateFilter] = useState({ startDate: '', endDate: '' });
  const [bonusHistoryCurrentPage, setBonusHistoryCurrentPage] = useState(1);
  const BONUS_HISTORY_PAGE_SIZE = 5;
  const [editingBonusId, setEditingBonusId] = useState(null);
  const [editBonusData, setEditBonusData] = useState({ date: '', trip_id: '', amount: '', reason: '' });
  const [isUpdatingBonus, setIsUpdatingBonus] = useState(false);

  // Vehicle edit state
  const [isEditing, setIsEditing] = useState(false);
  const [isGeocodingBase, setIsGeocodingBase] = useState(false);

  // Vehicle Docs modal
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [driverDocs, setDriverDocs] = useState(null);
  const [availableVehicleNames, setAvailableVehicleNames] = useState([]);
  const [isLoadingVehicleNames, setIsLoadingVehicleNames] = useState(false);
  /** From GET /vehicles/:id when owner user differs from driver */
  const [registeredOwner, setRegisteredOwner] = useState(null);

  const [editFormData, setEditFormData] = useState({
    // Vehicle fields
    registration_no: '',
    vehicle_name: '',
    make: '',
    model: '',
    class: '',
    status: '',
    is_active: true,
    capacity: '',
    capacity_uom: 'ton',
    body_type: '',
    specialization: '',
    insurance_number: '',
    insurance_expiry: '',
    base_lat: '',
    base_lng: '',
    // Driver fields (editable)
    driver_name: '',
    driver_language_preference: '',
    driver_active_km_rate: '',
    driver_dead_km_rate: '',
    driver_verification_status: '',
    // Driver fields (read-only)
    driver_phone: '',
    driver_license_number: '',
    driver_license_expiry: '',
    driver_rating: '',
    driver_total_trips: '',
    joining_bonus: false,
  });

  const openVehicleModal = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setIsEditing(false); // Start in view mode
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    try {
      // Fetch complete vehicle details from the API with date filter
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';

      // Build URL with date filter if available
      let apiUrl = `${config.opsApiBase}/vehicles/${vehicle.vehicle_id}`;
      if (dateRange.startDate && dateRange.endDate) {
        apiUrl += `?from_date=${dateRange.startDate}&to_date=${dateRange.endDate}`;
      }

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const completeVehicleData = await response.json();
        const driver = completeVehicleData.driver || {};
        setRegisteredOwner(
          completeVehicleData.owner && completeVehicleData.owner.user_id
            ? completeVehicleData.owner
            : null
        );

        // Update selectedVehicle with km stats (filtered by date if date filter applied)
        setSelectedVehicle({
          ...vehicle,
          total_active_km: completeVehicleData.total_active_km || 0,
          total_dead_km: completeVehicleData.total_dead_km || 0,
          total_km: completeVehicleData.total_km || 0,
          total_pay: completeVehicleData.total_pay || 0,
          linked_driver_id: driver.driver_id || null,
          linked_driver_name: driver.name || '',
          linked_driver_phone: driver.phone || ''
        });

        // Load vehicle names for the current class
        const vehicleClass = completeVehicleData.class_ || 1;
        await loadVehicleNamesForClass(vehicleClass);

        // Create display name from make and model
        const currentVehicleName = completeVehicleData.make && completeVehicleData.model
          ? `${completeVehicleData.make} ${completeVehicleData.model}`
          : '';

        // Initialize edit form with complete vehicle data from API
        setEditFormData({
          // Vehicle fields - using complete API data
          registration_no: completeVehicleData.registration_no || `REG-${vehicle.vehicle_id}`,
          vehicle_name: currentVehicleName, // Show current vehicle name for display
          make: completeVehicleData.make || '',
          model: completeVehicleData.model || '',
          class: completeVehicleData.class_ ? String(completeVehicleData.class_) : '1',
          status: completeVehicleData.status || 'idle',
          is_active: completeVehicleData.is_active !== undefined ? completeVehicleData.is_active : true,
          capacity: completeVehicleData.capacity ? String(completeVehicleData.capacity) : '',
          capacity_uom: completeVehicleData.capacity_uom || 'ton',
          body_type: completeVehicleData.body_type || '',
          specialization: completeVehicleData.specialization || '',
          insurance_number: completeVehicleData.insurance_number || '',
          insurance_expiry: completeVehicleData.insurance_expiry || '',
          base_lat: completeVehicleData.base_lat ? String(completeVehicleData.base_lat) : '',
          base_lat: completeVehicleData.base_lat ? String(completeVehicleData.base_lat) : '',
          base_lng: completeVehicleData.base_lng ? String(completeVehicleData.base_lng) : '',
          base_location: completeVehicleData.base_location || '',

          // Driver fields (editable) - using complete API data
          driver_name: driver.name || '',
          driver_phone: driver.phone || '',
          driver_language_preference: driver.language_preference || '',
          driver_active_km_rate: driver.active_km_rate ? String(driver.active_km_rate) : '',
          driver_dead_km_rate: driver.dead_km_rate ? String(driver.dead_km_rate) : '',
          driver_verification_status: driver.verification_status || 'pending',

          // Driver fields (read-only) - using complete API data
          driver_license_number: driver.license_number || '',
          driver_license_expiry: driver.license_expiry ? new Date(driver.license_expiry).toISOString().split('T')[0] : '',
          driver_rating: driver.rating ? String(driver.rating) : '',
          driver_total_trips: driver.total_trips_completed ? String(driver.total_trips_completed) : '0',
          joining_bonus: !!completeVehicleData.joining_bonus,
        });
      } else {
        setRegisteredOwner(null);
        // Fallback to original data if API call fails
        const originalData = vehicle.originalData || {};
        const driver = originalData.driver || {};

        setEditFormData({
          // Vehicle fields - using fallback data
          registration_no: originalData.registration_no || vehicle.registration_no || `REG-${vehicle.vehicle_id}`,
          vehicle_name: '',
          make: originalData.make || '',
          model: originalData.model || '',
          class: originalData.class_ ? String(originalData.class_) : (originalData.class ? String(originalData.class) : '1'),
          status: originalData.status || vehicle.current_status || 'idle',
          is_active: originalData.is_active !== undefined ? originalData.is_active : (vehicle.is_active !== undefined ? vehicle.is_active : true),
          capacity: originalData.capacity ? String(originalData.capacity) : '',
          capacity_uom: originalData.capacity_uom || 'ton',
          body_type: originalData.body_type || '',
          specialization: originalData.specialization || '',
          insurance_number: originalData.insurance_number || '',
          insurance_expiry: originalData.insurance_expiry || '',
          base_lat: originalData.base_lat ? String(originalData.base_lat) : '',
          base_lat: originalData.base_lat ? String(originalData.base_lat) : '',
          base_lng: originalData.base_lng ? String(originalData.base_lng) : '',
          base_location: originalData.base_location || vehicle.base_location || '',

          // Driver fields (editable) - using fallback data
          driver_name: driver.name || '',
          driver_phone: driver.phone || '',
          driver_language_preference: driver.language_preference || '',
          driver_active_km_rate: driver.active_km_rate ? String(driver.active_km_rate) : '',
          driver_dead_km_rate: driver.dead_km_rate ? String(driver.dead_km_rate) : '',
          driver_verification_status: driver.verification_status || 'pending',

          // Driver fields (read-only) - using fallback data
          driver_license_number: driver.license_number || '',
          driver_license_expiry: driver.license_expiry ? new Date(driver.license_expiry).toISOString().split('T')[0] : '',
          driver_rating: driver.rating ? String(driver.rating) : '',
          driver_total_trips: driver.total_trips_completed ? String(driver.total_trips_completed) : '0',
          joining_bonus: !!originalData.joining_bonus,
        });
      }
    } catch (error) {
      console.error('Error fetching complete vehicle details:', error);
      setRegisteredOwner(null);
      // Fallback to original implementation on error
      const originalData = vehicle.originalData || {};
      const driver = originalData.driver || {};

      setEditFormData({
        // Use original fallback logic
        registration_no: originalData.registration_no || vehicle.registration_no || `REG-${vehicle.vehicle_id}`,
        vehicle_name: '',
        make: originalData.make || '',
        model: originalData.model || '',
        class: originalData.class_ ? String(originalData.class_) : (originalData.class ? String(originalData.class) : '1'),
        is_active: originalData.is_active !== undefined ? originalData.is_active : (vehicle.is_active !== undefined ? vehicle.is_active : true),
        status: originalData.status || vehicle.current_status || 'idle',
        capacity: originalData.capacity ? String(originalData.capacity) : '',
        capacity_uom: originalData.capacity_uom || 'ton',
        body_type: originalData.body_type || '',
        specialization: originalData.specialization || '',
        insurance_number: originalData.insurance_number || '',
        insurance_expiry: originalData.insurance_expiry || '',
        base_lat: originalData.base_lat ? String(originalData.base_lat) : '',
        base_lng: originalData.base_lng ? String(originalData.base_lng) : '',

        driver_name: driver.name || '',
        driver_phone: driver.phone || '',
        driver_language_preference: driver.language_preference || '',
        driver_active_km_rate: driver.active_km_rate ? String(driver.active_km_rate) : '',
        driver_dead_km_rate: driver.dead_km_rate ? String(driver.dead_km_rate) : '',
        driver_verification_status: driver.verification_status || 'pending',

        driver_license_number: driver.license_number || '',
        driver_license_expiry: driver.license_expiry ? new Date(driver.license_expiry).toISOString().split('T')[0] : '',
        driver_rating: driver.rating ? String(driver.rating) : '',
        driver_total_trips: driver.total_trips_completed ? String(driver.total_trips_completed) : '0',
        joining_bonus: !!originalData.joining_bonus,
      });
    }
  };
  const closeVehicleModal = () => {
    setSelectedVehicle(null);
    setIsEditing(false);
    setRegisteredOwner(null);
    document.body.style.overflow = 'unset'; // Restore scrolling
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleToggleActiveState = async () => {
    if (!selectedVehicle) return;

    const newActiveState = !editFormData.is_active;
    const confirmMessage = newActiveState
      ? 'Are you sure you want to ACTIVATE this vehicle?'
      : 'Are you sure you want to DEACTIVATE this vehicle?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.opsApiBase}/vehicles/${selectedVehicle.vehicle_id}/active?active=${newActiveState}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setEditFormData(prev => ({ ...prev, is_active: newActiveState }));
        setSelectedVehicle(prev => ({ ...prev, is_active: newActiveState }));
        alert(`Vehicle ${newActiveState ? 'activated' : 'deactivated'} successfully!`);
      } else {
        const data = await response.json();
        alert(`Failed to update state: ${data.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error toggling vehicle state:', error);
      alert('Error updating vehicle state');
    }
  };

  // Keep handleGeocodeBasePlace as a fallback (used if Google Maps not available)
  const handleGeocodeBasePlace = async () => {
    const placeValue = document.getElementById('base-location-search')?.value?.trim();

    if (!placeValue) {
      alert('Please enter a place or address');
      return;
    }

    setIsGeocodingBase(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.opsApiBase}/onboarding/resolve-location`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address_text: placeValue }),
      });
      const data = await response.json();
      if (response.ok && data.latitude && data.longitude) {
        setEditFormData(prev => ({
          ...prev,
          base_lat: data.latitude.toString(),
          base_lng: data.longitude.toString(),
          resolved_address: data.resolved_address || data.formatted_address || placeValue
        }));
      } else {
        alert(data.message || `Could not find coordinates for "${placeValue}". Please try a different search term.`);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Error getting coordinates. Please try again.');
    } finally {
      setIsGeocodingBase(false);
    }
  };

  const loadVehicleNamesForClass = async (classNumber) => {
    setIsLoadingVehicleNames(true);
    try {
      const vehicles = await getVehicleNamesByClass(classNumber);
      setAvailableVehicleNames(vehicles);
    } catch (error) {
      console.error('Error loading vehicle names:', error);
      setAvailableVehicleNames([]);
    } finally {
      setIsLoadingVehicleNames(false);
    }
  };

  const handleVehicleNameChange = async (e) => {
    const selectedName = e.target.value;

    // If using dropdown (file 2 approach)
    const vehicle = availableVehicleNames.find(v => v.vehicle_name === selectedName);

    if (vehicle) {
      setEditFormData(prev => ({
        ...prev,
        vehicle_name: vehicle.vehicle_name,
        make: vehicle.make,
        model: vehicle.model
      }));
    } else {
      // If using text input with autocomplete (file 1 approach)
      setEditFormData(prev => ({
        ...prev,
        vehicle_name: selectedName
      }));

      // Only search if user has typed something
      if (selectedName && selectedName.trim()) {
        const vehicleDetails = await getVehicleDetailsByName(selectedName);
        if (vehicleDetails) {
          setEditFormData(prev => ({
            ...prev,
            vehicle_name: selectedName,
            make: vehicleDetails.make,
            model: vehicleDetails.model,
            class: vehicleDetails.class.toString()
          }));
        }
      }
    }
  };

  const handleEditFormChange = async (e) => {
    const { name, value } = e.target;

    // If vehicle_name changes (file 1 approach - text input)
    if (name === 'vehicle_name') {
      setEditFormData(prev => ({
        ...prev,
        vehicle_name: value
      }));

      // Only search if user has typed something
      if (value && value.trim()) {
        const vehicleDetails = await getVehicleDetailsByName(value);
        if (vehicleDetails) {
          setEditFormData(prev => ({
            ...prev,
            vehicle_name: value,
            make: vehicleDetails.make,
            model: vehicleDetails.model,
            class: vehicleDetails.class.toString()
          }));
        }
      }
      return;
    }

    // If class changes (file 2 approach - reload dropdown)
    if (name === 'class') {
      const classNum = parseInt(value);
      if (classNum >= 1 && classNum <= 12) {
        loadVehicleNamesForClass(classNum);
        // Reset vehicle name, make, and model when class changes
        setEditFormData(prev => ({
          ...prev,
          class: value,
          vehicle_name: '',
          make: '',
          model: ''
        }));
        return;
      }
    }

    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchDriverDocs = async (vehicleId) => {
    setDocsLoading(true);
    setDocsError('');
    setDriverDocs(null);
    try {
      const token = localStorage.getItem('token');
      const base = config.opsApiBase.replace('/ops', '');
      const res = await fetch(`${base}/ops/onboarding/driver-documents/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDriverDocs(data.documents);
      } else {
        setDocsError(data.message || 'Failed to load documents');
      }
    } catch (err) {
      setDocsError(err.message || 'Error loading documents');
    } finally {
      setDocsLoading(false);
    }
  };

  const openDocsModal = () => {
    setShowDocsModal(true);
    if (selectedVehicle?.vehicle_id) fetchDriverDocs(selectedVehicle.vehicle_id);
  };

  const handleDeleteDriver = async () => {
    if (!selectedVehicle?.linked_driver_id) {
      alert('No driver is linked to this vehicle.');
      return;
    }
    const driverLabel = selectedVehicle.linked_driver_name
      ? `"${selectedVehicle.linked_driver_name}" (${selectedVehicle.linked_driver_phone})`
      : `ID ${selectedVehicle.linked_driver_id}`;
    const confirmed = window.confirm(
      `⚠️ PERMANENT DELETE\n\nThis will completely and permanently delete driver ${driverLabel} and ALL related records (trips, payments, locations, sessions).\n\nThis action CANNOT be undone.\n\nClick OK to confirm.`
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      const response = await fetch(`${config.opsApiBase}/drivers/${selectedVehicle.linked_driver_id}/hard`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('✅ Driver permanently deleted successfully.');
        closeVehicleModal();
      } else {
        const data = await response.json();
        alert(`Failed to delete driver: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error deleting driver:', err);
      alert('Error deleting driver. Please try again.');
    }
  };

  const handleSaveVehicle = async () => {
    try {
      // Get token for authentication
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';

      // Use your FastAPI backend endpoint
      const response = await fetch(`${config.opsApiBase}/vehicles/${selectedVehicle.vehicle_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Vehicle fields (make and model can be updated via vehicle name dropdown)
          registration_no: editFormData.registration_no,
          make: editFormData.make || null,
          model: editFormData.model || null,
          class_: parseInt(editFormData.class) || 1,
          status: editFormData.status,
          capacity: parseFloat(editFormData.capacity) || null,
          capacity_uom: editFormData.capacity_uom,
          body_type: editFormData.body_type,
          specialization: editFormData.specialization,
          insurance_number: editFormData.insurance_number || null,
          insurance_expiry: editFormData.insurance_expiry || null,
          base_lat: parseFloat(editFormData.base_lat) || null,
          base_lat: parseFloat(editFormData.base_lat) || null,
          base_lng: parseFloat(editFormData.base_lng) || null,
          base_location: editFormData.base_location,
          // Driver fields (editable, excluding read-only: license_number)
          driver: {
            name: editFormData.driver_name,
            phone: editFormData.driver_phone,
            language_preference: editFormData.driver_language_preference,
            active_km_rate: parseFloat(editFormData.driver_active_km_rate) || null,
            dead_km_rate: parseFloat(editFormData.driver_dead_km_rate) || null,
            verification_status: editFormData.driver_verification_status,
          }
        }),
      });

      if (response.ok) {
        alert('Vehicle and driver information updated successfully!');
        setIsEditing(false);
        // Refresh vehicles list
        window.location.reload();
      } else {
        const data = await response.json();
        alert(`Failed to update vehicle: ${data.detail || data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating vehicle:', error);
      alert('Error updating vehicle. Please try again.');
    }
  };

  const openAssignBookingModal = (vehicle) => {
    setSelectedVehicleForAssignment(vehicle);
    setBookingSearchTerm(''); // Reset search
    // Reset validation state
    setSelectedBookingForValidation(null);
    setValidationStep('select');
    setValidationResult(null);
    setWarningsAcknowledged(false);
    document.body.style.overflow = 'hidden';
  };

  const closeAssignBookingModal = () => {
    setSelectedVehicleForAssignment(null);
    setBookingSearchTerm('');
    // Reset validation state
    setSelectedBookingForValidation(null);
    setValidationStep('select');
    setValidationResult(null);
    setWarningsAcknowledged(false);
    document.body.style.overflow = 'unset';
  };

  // ==================== BONUS PAYMENT FUNCTIONS ====================

  const openBonusPayModal = (vehicle) => {
    // Check if driver is assigned
    if (!vehicle.driver_id) {
      alert('❌ No driver assigned to this vehicle. Please assign a driver first.');
      return;
    }

    setSelectedVehicleForBonus(vehicle);
    setShowBonusPayModal(true);
    setBonusDate(new Date().toISOString().split('T')[0]); // Default to today
    setSelectedTripId('');
    setBonusReason('');
    setBonusAmount('');
    setShowBonusConfirmation(false);
    document.body.style.overflow = 'hidden';
    // Fetch trips for today
    fetchTripsForDate(vehicle.vehicle_id, new Date().toISOString().split('T')[0]);
  };

  const closeBonusPayModal = () => {
    setShowBonusPayModal(false);
    setSelectedVehicleForBonus(null);
    setBonusTrips([]);
    setShowBonusConfirmation(false);
    document.body.style.overflow = 'unset';
  };

  const openBonusHistoryModal = async (vehicle) => {
    setSelectedVehicleForBonus(vehicle);
    setShowBonusHistoryModal(true);
    setBonusHistoryDateFilter({ startDate: '', endDate: '' });
    setBonusHistoryCurrentPage(1);
    document.body.style.overflow = 'hidden';
    await fetchBonusHistory(vehicle.vehicle_id);
  };

  const closeBonusHistoryModal = () => {
    setShowBonusHistoryModal(false);
    setSelectedVehicleForBonus(null);
    setBonusHistory([]);
    setBonusHistoryDateFilter({ startDate: '', endDate: '' });
    setBonusHistoryCurrentPage(1);
    document.body.style.overflow = 'unset';
  };

  const fetchTripsForDate = async (vehicleId, date) => {
    setIsLoadingTrips(true);
    try {
      const response = await fetch(
        `${config.dispatchApiBase}/vehicle/${vehicleId}/trips-by-date?date=${date}`
      );

      if (response.ok) {
        const data = await response.json();
        setBonusTrips(data.trips || []);
      } else {
        console.error('Failed to fetch trips');
        setBonusTrips([]);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
      setBonusTrips([]);
    } finally {
      setIsLoadingTrips(false);
    }
  };

  const fetchBonusHistory = async (vehicleId) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `${config.dispatchApiBase}/vehicle/${vehicleId}/bonus-payments?limit=100`
      );

      if (response.ok) {
        const data = await response.json();
        setBonusHistory(data.payments || []);
      } else {
        console.error('Failed to fetch bonus history');
        setBonusHistory([]);
      }
    } catch (error) {
      console.error('Error fetching bonus history:', error);
      setBonusHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleEditBonus = (bonus) => {
    setEditingBonusId(bonus.id);
    setEditBonusData({
      date: bonus.date,
      trip_id: bonus.trip_id || '',
      amount: bonus.amount.toString(),
      reason: bonus.reason
    });
    // Fetch trips for the selected date
    fetchTripsForDate(selectedVehicleForBonus.vehicle_id, bonus.date);
  };

  const handleCancelEditBonus = () => {
    setEditingBonusId(null);
    setEditBonusData({ date: '', trip_id: '', amount: '', reason: '' });
  };

  const handleSaveEditBonus = async () => {
    // Validation
    if (!editBonusData.date) {
      alert('Date is required');
      return;
    }
    if (!editBonusData.amount || parseFloat(editBonusData.amount) <= 0) {
      alert('Valid amount is required');
      return;
    }
    if (!editBonusData.reason || editBonusData.reason.trim().length < 10) {
      alert('Reason must be at least 10 characters');
      return;
    }

    setIsUpdatingBonus(true);
    try {
      const payload = {
        date: editBonusData.date,
        trip_id: editBonusData.trip_id ? parseInt(editBonusData.trip_id) : 0,
        amount: parseFloat(editBonusData.amount),
        reason: editBonusData.reason.trim()
      };

      const response = await fetch(`${config.dispatchApiBase}/bonus-payment/${editingBonusId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('✅ Bonus payment updated successfully!');
        setEditingBonusId(null);
        setEditBonusData({ date: '', trip_id: '', amount: '', reason: '' });
        // Refresh history
        await fetchBonusHistory(selectedVehicleForBonus.vehicle_id);
      } else {
        const errorData = await response.json();
        alert(`Failed to update bonus payment: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating bonus payment:', error);
      alert('Error updating bonus payment. Please try again.');
    } finally {
      setIsUpdatingBonus(false);
    }
  };

  const handleBonusDateChange = (newDate) => {
    setBonusDate(newDate);
    setSelectedTripId(''); // Reset trip selection
    if (selectedVehicleForBonus) {
      fetchTripsForDate(selectedVehicleForBonus.vehicle_id, newDate);
    }
  };

  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    handleBonusDateChange(today);
  };

  const validateBonusForm = () => {
    if (!bonusDate) {
      alert('Please select a date');
      return false;
    }

    // Check if date is in the future
    if (new Date(bonusDate) > new Date()) {
      alert('Date cannot be in the future');
      return false;
    }

    if (!bonusReason.trim() || bonusReason.trim().length < 10) {
      alert('Please provide a reason (minimum 10 characters)');
      return false;
    }

    if (!bonusAmount || parseFloat(bonusAmount) <= 0) {
      alert('Please enter a valid amount greater than 0');
      return false;
    }

    return true;
  };

  const handleBonusSubmit = () => {
    if (!validateBonusForm()) {
      return;
    }
    setShowBonusConfirmation(true);
  };

  const handleBonusConfirm = async () => {
    setIsSubmittingBonus(true);

    try {
      const operatorName = localStorage.getItem('user_name') ||
        localStorage.getItem('username') ||
        'Unknown Operator';

      // Ensure driver_id exists
      if (!selectedVehicleForBonus.driver_id) {
        alert('❌ No driver assigned to this vehicle. Cannot create bonus payment.');
        setIsSubmittingBonus(false);
        setShowBonusConfirmation(false);
        return;
      }

      const payload = {
        vehicle_id: selectedVehicleForBonus.vehicle_id,
        driver_id: selectedVehicleForBonus.driver_id,
        date: bonusDate,
        trip_id: selectedTripId ? parseInt(selectedTripId) : null,
        amount: parseFloat(bonusAmount),
        reason: bonusReason.trim(),
        created_by: operatorName
      };

      const response = await fetch(`${config.dispatchApiBase}/bonus-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Bonus payment of ₹${bonusAmount} added successfully!\nIt will be marked as paid when added to driver's daily payment.`);
        closeBonusPayModal();
      } else {
        const errorData = await response.json();
        alert(`Failed to create bonus payment: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating bonus payment:', error);
      alert('Error creating bonus payment. Please try again.');
    } finally {
      setIsSubmittingBonus(false);
      setShowBonusConfirmation(false);
    }
  };

  // ==================== END BONUS PAYMENT FUNCTIONS ====================
  // Vehicle Chat Modal Functions
  const openVehicleChatModal = async (vehicle) => {
    setSelectedVehicleForChat(vehicle);
    document.body.style.overflow = 'hidden';

    // Fetch chat history
    try {
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      const response = await fetch(`${config.opsApiBase}/vehicles/${vehicle.vehicle_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });


      if (response.ok) {
        const data = await response.json();
        setChatHistory(Array.isArray(data.chat_history) ? data.chat_history : []);
        setIsChatBotPaused(data.bot_paused || false);
        // Read has_app from driver info
        setDriverHasApp(data.driver?.has_app || false);
      } else {
        setChatHistory([]);
        setDriverHasApp(false);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setChatHistory([]);
    }
  };

  const closeVehicleChatModal = () => {
    setSelectedVehicleForChat(null);
    setChatHistory([]);
    setChatMessage('');
    setDriverHasApp(false);
    document.body.style.overflow = 'unset';
  };

  const handleSendChatMessage = async () => {
    if (!chatMessage.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      const operatorName = localStorage.getItem('user_name') || localStorage.getItem('username') || 'Operator';

      // Optimistically add message to UI
      const optimisticMessage = {
        sender: operatorName,
        message: chatMessage,
        timestamp: new Date().toISOString(),
        role: 'operator',
        status: 'pending'
      };

      setChatHistory(prev => [...prev, optimisticMessage]);
      const payloadToSend = chatMessage;
      setChatMessage(''); // Clear input immediately

      // Send via WebSocket-enabled endpoint
      const response = await fetch(
        `${config.opsApiBase}/vehicles/${selectedVehicleForChat.vehicle_id}/chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: payloadToSend,
            sender: operatorName
          })
        }
      );

      if (!response.ok) {
        // If failed, mark message as failed
        console.error('[Vehicle Chat] Failed to send message');
        setChatHistory(prev => prev.map(msg =>
          msg === optimisticMessage ? { ...msg, status: 'failed' } : msg
        ));
      }
      // WebSocket will handle updating the message with server confirmation

    } catch (error) {
      console.error('[Vehicle Chat] Error sending message:', error);
      alert('Error sending message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleToggleChatBot = async () => {
    try {
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      const operatorId = localStorage.getItem('user_id') || 1;

      const response = await fetch(`${config.opsApiBase}/vehicles/${selectedVehicleForChat.vehicle_id}/toggle-bot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paused: !isChatBotPaused,
          operator_id: operatorId
        })
      });

      if (response.ok) {
        setIsChatBotPaused(!isChatBotPaused);
      } else {
        const data = await response.json().catch(() => ({}));
        if (data.detail && data.detail.includes('No active trip')) {
          alert('⚠️ No active trip found for this driver. The driver needs an active trip to toggle bot mode.');
        } else {
          alert('Failed to toggle bot: ' + (data.detail || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Error toggling bot:', error);
      alert('Error toggling bot');
    }
  };

  // Auto-scroll to bottom when chat messages change
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // WebSocket connection management for vehicle chat
  useEffect(() => {
    if (!selectedVehicleForChat) {
      // Close WebSocket when modal closes
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWsConnected(false);
      }
      return;
    }

    // Establish WebSocket connection
    const wsProtocol = config.opsApiBase.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = config.opsApiBase.replace(/^https?:\/\//, '');
    // Note: opsApiBase includes /api/v1/ops, so WebSocket URL will be ws://host/api/v1/ops/ws/vehicles/{id}
    const wsUrl = `${wsProtocol}://${wsBaseUrl}/ws/vehicles/${selectedVehicleForChat.vehicle_id}`;

    console.log('[Vehicle Chat] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log('[Vehicle Chat] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'new_message') {
          console.log('[Vehicle Chat] Received new message:', data.message);

          setChatHistory(prev => {
            // Check if we have a local pending message (no ID) that matches content
            const pendingIndex = prev.findIndex(msg =>
              !msg.id &&
              msg.role === data.message.role &&
              msg.message === data.message.message
            );

            if (pendingIndex !== -1) {
              // Replace pending message with confirmed server message
              const newMessages = [...prev];
              newMessages[pendingIndex] = data.message;
              return newMessages;
            }

            // Check if message already exists (by ID or exact content match)
            const messageExists = prev.some(
              msg => (data.message.id && msg.id === data.message.id) ||
                (msg.message === data.message.message && msg.timestamp === data.message.timestamp)
            );

            if (messageExists) return prev;

            return [...prev, data.message];
          });
        }
        else if (data.type === 'message_status') {
          console.log('[Vehicle Chat] Received status update:', data);

          setChatHistory(prev => {
            return prev.map(msg => {
              if (msg.id === data.message_id) {
                return { ...msg, status: data.status, note: data.note };
              }
              return msg;
            });
          });
        }
        else if (data.type === 'bot_status_changed') {
          console.log('[Vehicle Chat] Bot status changed:', data.bot_paused);
          setIsChatBotPaused(data.bot_paused);
        }
      } catch (err) {
        console.error('[Vehicle Chat] Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[Vehicle Chat] WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('[Vehicle Chat] WebSocket closed');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedVehicleForChat]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeVehicleModal();
        closeAssignBookingModal();
        closeVehicleChatModal();
      }
    };

    if (selectedVehicle || selectedVehicleForAssignment || selectedVehicleForChat) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [selectedVehicle, selectedVehicleForAssignment, selectedVehicleForChat]);

  // Check if driver is within 24-hour messaging window
  const isDriverInActiveWindow = (lastMessageAt) => {
    if (!lastMessageAt) return false; // Never messaged = OUT

    const lastMessage = new Date(lastMessageAt);
    const now = new Date();
    const hoursSinceLastMessage = (now - lastMessage) / (1000 * 60 * 60);

    return hoursSinceLastMessage < 24; // IN if within 24 hours
  };

  // Fetch vehicles data from API
  useEffect(() => {
    const fetchVehicles = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) setLoading(true);

        // Fetch from both backends with fallback for drivers
        const vehiclesResponse = await fetch(`${config.dispatchApiBase}/vehicles`);
        if (!vehiclesResponse.ok) {
          throw new Error(`Dispatch vehicles failed: ${vehiclesResponse.status}`);
        }

        // Try primary drivers endpoint, fallback to localhost if it fails
        let driversResponse;
        try {
          driversResponse = await fetch(`${config.opsApiUrl}/vehicle-drivers`);
          if (!driversResponse.ok) {
            throw new Error('Primary drivers endpoint failed');
          }
        } catch (error) {
          console.warn('Primary drivers endpoint failed, using fallback:', error);
          driversResponse = await fetch(`http://localhost:8000/api/vehicle-drivers`);
        }

        const vehiclesData = await vehiclesResponse.json();
        const driversData = await driversResponse.json();

        if (vehiclesData.success) {
          // Create a map of vehicle_id to driver info for quick lookup
          const driverMap = {};
          if (driversData.success && driversData.data) {
            driversData.data.forEach(item => {
              driverMap[item.vehicle_id] = {
                registration_no: item.registration_no,
                driver_name: item.driver_name,
                current_location_lat: item.current_location_lat || 0,
                current_location_long: item.current_location_long || 0,
                bot_paused: item.bot_paused || false,
                is_active: item.is_active !== false, // false only if explicitly false
                last_driver_message_at: item.last_driver_message_at || null,
                trip_count: item.trip_count || 0,
                total_pay: item.total_pay || 0,
                has_app: item.has_app || false,
                is_new: item.is_new || false
              };
            });
          }

          // Transform the data to match our component structure
          const transformedVehicles = vehiclesData.data.map(vehicle => {
            // Transform assignments into route format for UI display
            let route = Array.isArray(vehicle.route) && vehicle.route.length > 0 ? vehicle.route : [];
            if (route.length === 0 && vehicle.assignments && vehicle.assignments.length > 0) {
              vehicle.assignments.forEach(assignment => {
                // Add pickup point
                route.push({
                  booking_id: assignment.booking_id,
                  type: 'pickup',
                  location: assignment.pickup_location,
                  lat: assignment.pickup_lat,
                  lng: assignment.pickup_lng,
                  time: assignment.pickup_time ? new Date(assignment.pickup_time).toLocaleTimeString() : '',
                  completed: assignment.state === 'passenger_picked_up' || assignment.state === 'en_route_to_drop' || assignment.state === 'completed'
                });
                // Add drop point
                route.push({
                  booking_id: assignment.booking_id,
                  type: 'drop',
                  location: assignment.drop_location,
                  lat: assignment.drop_lat,
                  lng: assignment.drop_lng,
                  time: '', // We don't have drop time in the data
                  completed: assignment.state === 'completed'
                });
              });
            }

            // Get driver info from port 8000 data
            const driverInfo = driverMap[vehicle.vehicle_id] || {};

            return {
              vehicle_id: vehicle.vehicle_id,
              driver_id: vehicle.driver_id,
              vehicle_type: vehicle.vehicle_type || 'class2',
              // Keep empty string when API has no city — do NOT use 'Unknown Base' here or city filter hides the row
              base_location:
                vehicle.base_location != null && String(vehicle.base_location).trim() !== ''
                  ? vehicle.base_location
                  : '',
              base_lat: vehicle.base_lat || 0,
              base_lng: vehicle.base_lng || 0,
              current_location_lat: driverInfo.current_location_lat || 0,
              current_location_long: driverInfo.current_location_long || 0,
              current_status: vehicle.current_status || 'idle',
              route: route,
              trip_count: driverInfo.trip_count || 0,
              total_pay: driverInfo.total_pay || 0,
              total_distance: vehicle.total_distance || 0,
              estimated_completion: vehicle.estimated_completion || '',
              registration_no: driverInfo.registration_no || `REG-${vehicle.vehicle_id}`,
              driver_name: driverInfo.driver_name || 'No Driver Assigned',
              bot_paused: driverInfo.bot_paused || false,
              last_driver_message_at: driverInfo.last_driver_message_at || null,
              is_active: driverInfo.is_active !== false, // false only if explicitly false
              has_app: driverInfo.has_app || false,
              is_new: driverInfo.is_new || false
            };
          });

          // Sort: OUT vehicles first, then paused bots, then by vehicle_id
          const sortedVehicles = transformedVehicles.sort((a, b) => {
            const aIsOut = !isDriverInActiveWindow(a.last_driver_message_at);
            const bIsOut = !isDriverInActiveWindow(b.last_driver_message_at);

            // OUT vehicles first
            if (aIsOut && !bIsOut) return -1;
            if (!aIsOut && bIsOut) return 1;

            // Then paused bots
            if (a.bot_paused && !b.bot_paused) return -1;
            if (!a.bot_paused && b.bot_paused) return 1;

            // Finally by vehicle_id
            return a.vehicle_id - b.vehicle_id;
          });

          setVehicles(sortedVehicles);
          setFilteredVehicles(sortedVehicles);
        } else {
          console.error('Failed to fetch vehicles:', vehiclesData.error);
          setVehicles([]);
          setFilteredVehicles([]);
        }
      } catch (error) {
        console.error('Error fetching vehicles:', error);
        setVehicles([]);
        setFilteredVehicles([]);
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    };

    fetchVehicles(true); // Initial load

    // Set up polling for real-time updates every 5 seconds
    const interval = setInterval(fetchVehicles, 5000);

    return () => clearInterval(interval);
  }, []);

  // On-demand current location resolver — called only when user clicks "Get Location"
  const handleGetCurrentLocation = async (vehicle) => {
    if (!vehicle.current_location_lat || !vehicle.current_location_long) return;
    setLocationLoadingVehicles(prev => new Set([...prev, vehicle.vehicle_id]));
    try {
      const resp = await fetch(`${config.opsApiBase}/resolve-city?lat=${vehicle.current_location_lat}&lng=${vehicle.current_location_long}`);
      const data = await resp.json();
      if (data && data.success !== false) {
        setCityCache(prev => ({ ...prev, [vehicle.vehicle_id]: data.address || 'Unknown' }));
      }
    } catch (e) {
      // ignore error, button will just re-appear
    } finally {
      setLocationLoadingVehicles(prev => { const s = new Set(prev); s.delete(vehicle.vehicle_id); return s; });
    }
  };

  const fetchRegistrationRecords = async () => {
    try {
      setRegistrationLoading(true);
      setRegistrationError('');
      const response = await fetch(`${config.opsApiBase}/driver-registration/list?status=all`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to load registrations');
      }

      setRegistrationRecords(data.records || []);
    } catch (error) {
      console.error('Error fetching registration records:', error);
      setRegistrationError(error.message || 'Failed to load registration records');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleRegisterGeocodePlace = async () => {
    const placeValue = (registerPlaceAddress || '').trim();
    if (!placeValue) {
      setRegistrationError('Enter a place or address, then tap Get Coordinates');
      return;
    }
    setIsRegisterGeocoding(true);
    setRegistrationError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.opsApiBase}/onboarding/resolve-location`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address_text: placeValue }),
      });
      const data = await response.json();
      if (response.ok && data.latitude != null && data.longitude != null) {
        setRegisterBaseLat(String(data.latitude));
        setRegisterBaseLng(String(data.longitude));
        setRegisterResolvedAddress(data.resolved_address || data.formatted_address || placeValue);
      } else {
        setRegistrationError(data.message || `Could not find coordinates for "${placeValue}".`);
      }
    } catch (err) {
      console.error('Register geocode error:', err);
      setRegistrationError('Error getting coordinates. Please try again.');
    } finally {
      setIsRegisterGeocoding(false);
    }
  };

  const handleManualRegister = async () => {
    try {
      setRegistrationError('');
      setRegistrationSuccess('');

      if (!registerName.trim()) {
        setRegistrationError('Name is required');
        return;
      }

      if (!registerPhone.trim()) {
        setRegistrationError('Phone number is required');
        return;
      }

      if (!registerBaseLat || !registerBaseLng || !registerResolvedAddress.trim()) {
        setRegistrationError('Choose a stand location from the address search (or use Look up coordinates if maps are unavailable).');
        return;
      }

      const response = await fetch(`${config.opsApiBase}/driver-registration/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerName.trim(),
          phone_number: registerPhone.trim(),
          vehicle_name: registerVehicle.trim() || null,
          is_registered: true,
          base_lat: Number(registerBaseLat),
          base_lng: Number(registerBaseLng),
          address: registerResolvedAddress.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to register driver');
      }

      setRegistrationSuccess('Driver registered successfully');
      setRegisterName('');
      setRegisterPhone('');
      setRegisterVehicle('');
      setRegisterPlaceAddress('');
      setRegisterBaseLat('');
      setRegisterBaseLng('');
      setRegisterResolvedAddress('');
      await fetchRegistrationRecords();
    } catch (error) {
      console.error('Error registering driver:', error);
      setRegistrationError(error.message || 'Failed to register driver');
    }
  };

  const handleApproveRegistration = async (registrationId) => {
    try {
      setRegistrationError('');
      setRegistrationSuccess('');

      const response = await fetch(`${config.opsApiBase}/driver-registration/${registrationId}/register`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to approve registration');
      }

      setRegistrationSuccess('Pending number approved successfully');
      await fetchRegistrationRecords();
    } catch (error) {
      console.error('Error approving registration:', error);
      setRegistrationError(error.message || 'Failed to approve registration');
    }
  };

  const handleRemovePendingRegistration = async (registrationId) => {
    try {
      if (!window.confirm('Are you sure you want to remove this pending registration row?')) {
        return;
      }
      setRegistrationError('');
      setRegistrationSuccess('');

      const response = await fetch(`${config.opsApiBase}/driver-registration/${registrationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to remove pending registration');
      }

      setRegistrationSuccess('Pending row removed successfully');
      await fetchRegistrationRecords();
    } catch (error) {
      console.error('Error removing pending registration:', error);
      setRegistrationError(error.message || 'Failed to remove pending registration');
    }
  };

  const handleSendTemplate = async (registrationId) => {
    try {
      setRegistrationError('');
      setRegistrationSuccess('');
      setSendingTemplate(prev => new Set(prev).add(registrationId));

      const response = await fetch(`${config.opsApiBase}/driver-registration/${registrationId}/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to send template');
      }

      setRegistrationSuccess('Onboarding template sent successfully');
      setTemplateSentVehicles(prev => new Set(prev).add(registrationId));
    } catch (error) {
      console.error('Error sending template:', error);
      setRegistrationError(error.message || 'Failed to send template');
    } finally {
      setSendingTemplate(prev => {
        const next = new Set(prev);
        next.delete(registrationId);
        return next;
      });
    }
  };

  useEffect(() => {
    let intervalId;
    if (showMessagesModal && selectedDriverForMessages) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`${config.opsApiBase}/driver-registration/${selectedDriverForMessages}/messages`);
          const data = await response.json();
          if (data.success) {
            setDriverMessages(data.messages || []);
          }

          const botStatusResponse = await fetch(`${config.opsApiBase}/driver-registration/${selectedDriverForMessages}/bot-status`);
          const botStatusData = await botStatusResponse.json();
          if (botStatusResponse.ok && botStatusData.success) {
            setIsRegistrationBotPaused(Boolean(botStatusData.bot_paused));
          }
        } catch (err) {
          console.error('Error polling messages:', err);
        }
      }, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showMessagesModal, selectedDriverForMessages]);

  const fetchRegistrationBotStatus = async (phone) => {
    if (!phone) return;
    setIsRegistrationBotStatusLoading(true);
    try {
      const response = await fetch(`${config.opsApiBase}/driver-registration/${phone}/bot-status`);
      const data = await response.json();
      if (response.ok && data.success) {
        setIsRegistrationBotPaused(Boolean(data.bot_paused));
      }
    } catch (error) {
      console.error('Error loading registration bot status:', error);
    } finally {
      setIsRegistrationBotStatusLoading(false);
    }
  };

  const handleToggleRegistrationBot = async () => {
    if (!selectedDriverForMessages || isRegistrationBotToggling) return;

    setIsRegistrationBotToggling(true);
    try {
      const action = isRegistrationBotPaused ? 'resume' : 'pause';
      const response = await fetch(`${config.opsApiBase}/driver-registration/${selectedDriverForMessages}/bot-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to toggle bot mode');
      }
      setIsRegistrationBotPaused(Boolean(data.bot_paused));
    } catch (error) {
      setMessagesError(error.message || 'Failed to toggle bot mode');
    } finally {
      setIsRegistrationBotToggling(false);
    }
  };

  const handleSendRegistrationManualMessage = async () => {
    if (!selectedDriverForMessages || !registrationManualMessage.trim() || isSendingRegistrationManualMessage) {
      return;
    }

    setIsSendingRegistrationManualMessage(true);
    setMessagesError('');
    try {
      const response = await fetch(`${config.opsApiBase}/driver-registration/${selectedDriverForMessages}/manual-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: registrationManualMessage.trim(), sender: 'ops' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to send message');
      }

      setRegistrationManualMessage('');

      const messagesResponse = await fetch(`${config.opsApiBase}/driver-registration/${selectedDriverForMessages}/messages`);
      const messagesData = await messagesResponse.json();
      if (messagesResponse.ok && messagesData.success) {
        setDriverMessages(messagesData.messages || []);
      }
    } catch (error) {
      setMessagesError(error.message || 'Failed to send message');
    } finally {
      setIsSendingRegistrationManualMessage(false);
    }
  };

  const handleViewMessages = async (phone) => {
    setSelectedDriverForMessages(phone);
    setShowMessagesModal(true);
    setLoadingMessages(true);
    setMessagesError('');
    setVisibleMessageCount(20);
    setPrevMessagesCount(0);
    setRegistrationManualMessage('');
    try {
      const [messagesResponse, botStatusResponse] = await Promise.all([
        fetch(`${config.opsApiBase}/driver-registration/${phone}/messages`),
        fetch(`${config.opsApiBase}/driver-registration/${phone}/bot-status`),
      ]);

      const data = await messagesResponse.json();
      if (messagesResponse.ok && data.success) {
        setDriverMessages(data.messages || []);
      } else {
        setMessagesError(data.detail || data.message || 'Failed to load messages');
      }

      const botData = await botStatusResponse.json();
      if (botStatusResponse.ok && botData.success) {
        setIsRegistrationBotPaused(Boolean(botData.bot_paused));
      }
    } catch (err) {
      setMessagesError(err.message || 'Error loading messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const closeMessagesModal = () => {
    setShowMessagesModal(false);
    setSelectedDriverForMessages(null);
    setDriverMessages([]);
    setIsRegistrationBotPaused(false);
    setRegistrationManualMessage('');
    setIsRegistrationBotStatusLoading(false);
    setIsRegistrationBotToggling(false);
    setIsSendingRegistrationManualMessage(false);
  };

  const handleRemoveRegisteredRegistration = async (registrationId) => {
    try {
      if (!window.confirm('Are you sure you want to remove this registered driver entry?')) {
        return;
      }
      setRegistrationError('');
      setRegistrationSuccess('');

      const response = await fetch(`${config.opsApiBase}/driver-registration/${registrationId}/registered`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to remove registered driver');
      }

      setRegistrationSuccess('Registered driver removed successfully');
      await fetchRegistrationRecords();
    } catch (error) {
      console.error('Error removing registered driver:', error);
      setRegistrationError(error.message || 'Failed to remove registered driver');
    }
  };

  const handleEditRegistration = (row) => {
    setEditRegRow(row);
    setEditRegName(row.name || '');
    setEditRegPhone(row.phone_number || '');
    setEditRegVehicle(row.vehicle_name || '');
    setEditRegClass(row.vehicle_class != null ? String(row.vehicle_class) : '');
    setEditRegAddress(row.address || '');
    setEditRegBaseLat(row.base_lat != null ? String(row.base_lat) : '');
    setEditRegBaseLng(row.base_lng != null ? String(row.base_lng) : '');
    setEditRegError('');
    setShowEditRegModal(true);
  };

  const handleUpdateRegistration = async () => {
    if (!editRegRow) return;
    if (!editRegName.trim()) { setEditRegError('Name is required'); return; }
    if (!editRegPhone.trim()) { setEditRegError('Phone is required'); return; }
    setEditRegSaving(true);
    setEditRegError('');
    try {
      const body = {
        name: editRegName.trim(),
        phone_number: editRegPhone.trim(),
        vehicle_name: editRegVehicle.trim() || null,
        vehicle_class: editRegClass !== '' ? Number(editRegClass) : null,
        address: editRegAddress.trim() || null,
        base_lat: editRegBaseLat !== '' ? Number(editRegBaseLat) : null,
        base_lng: editRegBaseLng !== '' ? Number(editRegBaseLng) : null,
      };
      const response = await fetch(`${config.opsApiBase}/driver-registration/${editRegRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to update registration');
      }
      setShowEditRegModal(false);
      setRegistrationSuccess('Registration updated successfully');
      await fetchRegistrationRecords();
    } catch (err) {
      setEditRegError(err.message || 'Failed to update');
    } finally {
      setEditRegSaving(false);
    }
  };

  const handleEditRegGeocodePlace = async () => {
    const placeValue = (editRegAddress || '').trim();
    if (!placeValue) {
      setEditRegError('Enter a place or address, then tap Get Coordinates');
      return;
    }

    setIsEditRegGeocoding(true);
    setEditRegError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.opsApiBase}/onboarding/resolve-location`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address_text: placeValue }),
      });
      const data = await response.json();

      if (response.ok && data.latitude != null && data.longitude != null) {
        const resolved = data.resolved_address || data.formatted_address || placeValue;
        setEditRegAddress(resolved);
        setEditRegBaseLat(String(data.latitude));
        setEditRegBaseLng(String(data.longitude));
      } else {
        setEditRegError(data.message || `Could not find coordinates for "${placeValue}".`);
      }
    } catch (err) {
      console.error('Edit registration geocode error:', err);
      setEditRegError('Error getting coordinates. Please try again.');
    } finally {
      setIsEditRegGeocoding(false);
    }
  };


  const handleRemoveSession = async (phoneNumber) => {
    try {
      if (!window.confirm('Are you sure you want to delete this onboarding session? This will force the driver to start over.')) {
        return;
      }
      setRegistrationError('');
      setRegistrationSuccess('');

      const response = await fetch(`${config.opsApiBase}/driver-registration/${phoneNumber}/session`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Failed to remove onboarding session');
      }

      setRegistrationSuccess('Onboarding session removed successfully');
      await fetchRegistrationRecords();
    } catch (error) {
      console.error('Error removing onboarding session:', error);
      setRegistrationError(error.message || 'Failed to remove onboarding session');
    }
  };

  useEffect(() => {
    if (activeTab !== 'register-vehicle') return;
    fetchRegistrationRecords();
  }, [activeTab]);



  // Resolve base location addresses from base_lat/base_lng
  // Uses localStorage to persist across page reloads.
  // Cache key includes lat+lng so it auto-invalidates if the DB value changes.
  useEffect(() => {
    const resolveBaseLocations = async () => {
      const toResolve = filteredVehicles.filter(v => {
        if (!v.base_lat || !v.base_lng) return false;
        // Already resolved in this session
        if (baseLocationCache[v.vehicle_id] !== undefined) return false;
        // Check localStorage
        const lsKey = `base_loc_${v.vehicle_id}_${v.base_lat}_${v.base_lng}`;
        const cached = localStorage.getItem(lsKey);
        if (cached !== null) {
          // Pre-populate in-memory cache from localStorage (no API call)
          setBaseLocationCache(prev => ({ ...prev, [v.vehicle_id]: cached }));
          return false;
        }
        return true;
      });
      if (toResolve.length === 0) return;
      try {
        const updates = {};
        await Promise.all(toResolve.map(async (v) => {
          try {
            const resp = await fetch(`${config.opsApiBase}/resolve-city?lat=${v.base_lat}&lng=${v.base_lng}`);
            const data = await resp.json();
            if (data && data.success !== false) {
              const address = data.address || '';
              updates[v.vehicle_id] = address;
              // Persist to localStorage keyed by vehicle + coordinates
              const lsKey = `base_loc_${v.vehicle_id}_${v.base_lat}_${v.base_lng}`;
              localStorage.setItem(lsKey, address);
            }
          } catch (e) {
            // ignore per-vehicle errors
          }
        }));
        if (Object.keys(updates).length > 0) {
          setBaseLocationCache(prev => ({ ...prev, ...updates }));
        }
      } catch (e) {
        // ignore batch error
      }
    };
    resolveBaseLocations();
  }, [filteredVehicles, config.opsApiBase]);

  // Fetch unassigned bookings
  useEffect(() => {
    let websocket = null;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      console.log('🔌 Connecting to escalation WebSocket for unassigned bookings');
      websocket = new WebSocket(config.escalationWebsocket);

      websocket.onopen = () => {
        if (!isComponentMounted) return;
        console.log('✅ Connected to WebSocket for unassigned bookings');
      };

      websocket.onmessage = (event) => {
        if (!isComponentMounted) return;
        try {
          const data = JSON.parse(event.data);
          console.log('📥 Received data in VehicleDetails:', data);

          if (data.type === 'escalation' && data.unassigned && data.unassigned.length > 0) {
            console.log('📊 Setting unassigned bookings:', data.unassigned.length);
            setUnassignedBookings(data.unassigned);
          } else if (data.type === 'clear_all') {
            console.log('🧹 Clearing unassigned bookings');
            setUnassignedBookings([]);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      websocket.onclose = (event) => {
        console.log('❌ WebSocket connection closed', event.code);
        if (isComponentMounted && event.code !== 1000) {
          // Attempt to reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (websocket) {
        websocket.close();
      }
    };
  }, []);

  useEffect(() => {
    let filtered = vehicles;

    // Filter by city first if cities are selected.
    // No real base (empty or legacy placeholder) always passes — still shown.
    if (selectedCities && selectedCities.length > 0) {
      filtered = filtered.filter(vehicle => {
        const baseLocation = (vehicle.base_location || '').toLowerCase().trim();
        if (!baseLocation || baseLocation === 'unknown base') return true;
        return selectedCities.some(city =>
          baseLocation.includes(city.toLowerCase())
        );
      });
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(vehicle =>
        vehicle.vehicle_id.toString().includes(searchTerm) ||
        (vehicle.base_location || '').toLowerCase().includes(q) ||
        (vehicle.registration_no || '').toLowerCase().includes(q) ||
        (vehicle.driver_name || '').toLowerCase().includes(q) ||
        vehicle.route.some(stop =>
          (stop.location || '').toLowerCase().includes(q) ||
          stop.booking_id.toString().includes(searchTerm)
        )
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(vehicle => vehicle.vehicle_type === filterType);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(vehicle =>
        statusFilter === 'active' ? vehicle.is_active === true : vehicle.is_active === false
      );
    }

    // Apply date filter on vehicle route bookings
    filtered = filtered.map(vehicle => {
      if (!vehicle.route || vehicle.route.length === 0) return vehicle;

      const filteredRoute = vehicle.route.filter(stop => {
        const stopDate = stop.pickup_time || stop.dropoff_time || stop.timestamp;
        return !stopDate || isDateInRange(stopDate);
      });

      // Return vehicle with filtered route
      return { ...vehicle, route: filteredRoute };
    }).filter(vehicle => {
      // Keep vehicles that still have stops after date filtering, or have no stops originally
      return !vehicle.route || vehicle.route.length > 0 || vehicles.find(v => v.vehicle_id === vehicle.vehicle_id)?.route.length === 0;
    });

    setFilteredVehicles(filtered);
  }, [vehicles, searchTerm, filterType, statusFilter, selectedCities, isDateInRange]);

  const getVehicleColor = (vehicleType) => {
    const colors = {
      'class1': '#ef4444',
      'class2': '#3b82f6',
      'class3': '#10b981',
      'class4': '#f59e0b',
      'class5': '#8b5cf6',
      'class6': '#06b6d4',
      'class7': '#f97316',
      'class8': '#84cc16',
      'class9': '#ec4899'
    };
    return colors[vehicleType] || '#6b7280';
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': '#10b981',
      'en_route': '#f59e0b',
      'idle': '#6b7280',
      'maintenance': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'active': 'Active',
      'en_route': 'En Route',
      'idle': 'Idle',
      'maintenance': 'Maintenance'
    };
    return labels[status] || status;
  };

  // Send reengagement template to driver
  const handleSendReengagementTemplate = async (vehicleId) => {
    setSendingTemplate(prev => new Set(prev).add(vehicleId));

    try {
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      const response = await fetch(`${config.opsApiBase}/vehicles/${vehicleId}/send-reengagement-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Mark as sent
        setTemplateSentVehicles(prev => new Set(prev).add(vehicleId));
        alert(`Template sent successfully to driver!`);
      } else {
        alert(`Failed to send template: ${data.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending template:', error);
      alert(`Error sending template: ${error.message}`);
    } finally {
      setSendingTemplate(prev => {
        const newSet = new Set(prev);
        newSet.delete(vehicleId);
        return newSet;
      });
    }
  };

  // NEW: Step 1 - Validate assignment before proceeding
  const handleValidateAssignment = async (vehicleId, bookingId) => {
    setSelectedBookingForValidation(bookingId);
    setIsValidating(true);

    try {
      const response = await fetch(`${config.dispatchApiBase}/manual-assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: bookingId,
          vehicle_id: vehicleId,
          check_only: true  // Step 1: Validation only
        }),
      });

      const result = await response.json();
      console.log('Validation result:', result);

      setValidationResult(result);

      if (!result.can_proceed) {
        // Hard block - show error, don't allow proceeding
        setValidationStep('warnings');
      } else if (result.warnings && result.warnings.length > 0) {
        // Has warnings - show them for acknowledgment
        setValidationStep('warnings');
      } else {
        // No issues - proceed directly
        await handleConfirmAssignment(vehicleId, bookingId, result.validation_token);
      }
    } catch (error) {
      console.error('Error during validation:', error);
      alert(`Error during validation: ${error.message}`);
      setSelectedBookingForValidation(null);
    } finally {
      setIsValidating(false);
    }
  };

  // NEW: Step 2 - Confirm assignment after warnings acknowledged
  const handleConfirmAssignment = async (vehicleId, bookingId, validationToken = null) => {
    setIsAssigning(true);

    try {
      const operatorName = localStorage.getItem('user_name') || localStorage.getItem('username') || 'Unknown Operator';

      const response = await fetch(`${config.dispatchApiBase}/manual-assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          booking_id: bookingId,
          assigned_by: operatorName,
          source: 'vehicle_page',
          confirmed: true,  // Step 2: Confirmed assignment
          validation_token: validationToken || validationResult?.validation_token,
          warnings_acknowledged: warningsAcknowledged
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Assignment successful:', data);

        alert(`Booking ${bookingId} successfully assigned to Vehicle V-${vehicleId}`);
        // Close modal and refresh
        closeAssignBookingModal();
      } else if (response.status === 409) {
        // Race condition - state changed
        const error = await response.json();
        alert(`⚠️ State changed: ${error.detail}\n\nPlease close and try again.`);
        // Reset to select step
        setValidationStep('select');
        setValidationResult(null);
        setSelectedBookingForValidation(null);
      } else {
        const data = await response.json();
        alert(`Failed to assign booking: ${data.error || data.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error assigning booking:', error);
      alert('Error assigning booking. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Helper function to handle back button in warnings step
  const handleBackToSelect = () => {
    setValidationStep('select');
    setValidationResult(null);
    setSelectedBookingForValidation(null);
    setWarningsAcknowledged(false);
  };

  // Helper function to get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545'; // red
      case 'high': return '#fd7e14'; // orange
      case 'medium': return '#ffc107'; // yellow
      case 'low': return '#6c757d'; // gray
      default: return '#6c757d';
    }
  };

  // Helper function to get severity background color
  const getSeverityBgColor = (severity) => {
    switch (severity) {
      case 'critical': return '#f8d7da'; // light red
      case 'high': return '#fff3cd'; // light orange
      case 'medium': return '#fff9e6'; // light yellow
      case 'low': return '#e9ecef'; // light gray
      default: return '#e9ecef';
    }
  };

  // Legacy function - now redirects to validation flow
  const handleAssignBooking = async (vehicleId, bookingId) => {
    await handleValidateAssignment(vehicleId, bookingId);
  };

  const getFilteredBookings = () => {
    if (!bookingSearchTerm) return unassignedBookings;

    return unassignedBookings.filter(booking =>
      booking.booking_id.toString().includes(bookingSearchTerm) ||
      booking.pickup_location.toLowerCase().includes(bookingSearchTerm.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading vehicle details...</p>
      </div>
    );
  }
  return (
    <div className="vehicle-details">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Vehicle Details</h1>
          <p>Complete journey paths and route visualization for all vehicles</p>
        </div>
        <div className="page-header-right">
          <Link
            to="/app/drivers/new"
            className="btn-add-vehicle"
            title="Vehicles must be created with a driver. Click to create driver + vehicle."
          >
            <span className="btn-icon">+</span>
            Add New Vehicle
          </Link>
        </div>
      </div>

      <div className="controls-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by vehicle ID, location, or booking ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-box">
          <Filter size={20} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="class1">Class 1</option>
            <option value="class2">Class 2</option>
            <option value="class3">Class 3</option>
            <option value="class4">Class 4</option>
            <option value="class5">Class 5</option>
            <option value="class6">Class 6</option>
            <option value="class7">Class 7</option>
          </select>
        </div>

        <div className="filter-box">
          <Filter size={20} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '0', gap: '0' }}>
        <button
          onClick={() => setActiveTab('vehicles')}
          style={{
            padding: '10px 24px',
            border: 'none',
            borderBottom: activeTab === 'vehicles' ? '2px solid #3b82f6' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'vehicles' ? '600' : '400',
            color: activeTab === 'vehicles' ? '#3b82f6' : '#6b7280',
            marginBottom: '-2px',
            fontSize: '14px',
          }}
        >
          🚛 Vehicles
        </button>
        <button
          onClick={() => setActiveTab('driver-pay')}
          style={{
            padding: '10px 24px',
            border: 'none',
            borderBottom: activeTab === 'driver-pay' ? '2px solid #3b82f6' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'driver-pay' ? '600' : '400',
            color: activeTab === 'driver-pay' ? '#3b82f6' : '#6b7280',
            marginBottom: '-2px',
            fontSize: '14px',
          }}
        >
          💰 Driver Pay
        </button>
        <button
          onClick={() => setActiveTab('register-vehicle')}
          style={{
            padding: '10px 24px',
            border: 'none',
            borderBottom: activeTab === 'register-vehicle' ? '2px solid #3b82f6' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'register-vehicle' ? '600' : '400',
            color: activeTab === 'register-vehicle' ? '#3b82f6' : '#6b7280',
            marginBottom: '-2px',
            fontSize: '14px',
          }}
        >
          📝 Register Vehicle
        </button>
      </div>

      {/* ── Driver Pay Tab ── */}
      {activeTab === 'driver-pay' && (
        <div style={{ padding: '24px', background: '#fff', borderRadius: '0 0 8px 8px', border: '1px solid #e5e7eb', borderTop: 'none' }}>
          <DriverPayTab />
        </div>
      )}

      {activeTab === 'register-vehicle' && (
        <div style={{ padding: '24px', background: '#fff', borderRadius: '0 0 8px 8px', border: '1px solid #e5e7eb', borderTop: 'none' }}>
          <h3 style={{ marginBottom: '16px' }}>Register Driver</h3>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Driver Name"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              style={{ padding: '10px', minWidth: '220px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={registerPhone}
              onChange={(e) => setRegisterPhone(e.target.value)}
              style={{ padding: '10px', minWidth: '220px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
            <input
              type="text"
              placeholder="Vehicle (optional)"
              value={registerVehicle}
              onChange={(e) => setRegisterVehicle(e.target.value)}
              style={{ padding: '10px', minWidth: '220px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
            <button
              onClick={handleManualRegister}
              style={{ padding: '10px 16px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
            >
              Register
            </button>
          </div>

          <div style={{ marginBottom: '16px', maxWidth: '720px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Stand / base location</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
              {mapsLoaded
                ? <>Type to search — <strong>select from the dropdown</strong> to auto-fill coordinates.</>
                : <>Type an address and click <strong>Get Coordinates</strong> — coordinates update automatically.</>}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <PlacesAutocompleteInput
                value={registerPlaceAddress}
                onChange={setRegisterPlaceAddress}
                onPlaceSelect={(place) => {
                  setRegisterPlaceAddress(place.address);
                  setRegisterBaseLat(place.lat);
                  setRegisterBaseLng(place.lng);
                  setRegisterResolvedAddress(place.address);
                }}
                placeholder="Type to search — select from dropdown..."
                inputStyle={{ padding: '10px', minWidth: '200px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
              {!mapsLoaded && (
                <button
                  type="button"
                  onClick={handleRegisterGeocodePlace}
                  disabled={isRegisterGeocoding}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    background: '#4F46E5',
                    color: '#fff',
                    borderRadius: '6px',
                    cursor: isRegisterGeocoding ? 'not-allowed' : 'pointer',
                    opacity: isRegisterGeocoding ? 0.6 : 1,
                  }}
                >
                  {isRegisterGeocoding ? 'Loading...' : 'Get Coordinates'}
                </button>
              )}
            </div>
            {registerResolvedAddress && registerBaseLat && registerBaseLng && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  background: '#ecfdf3',
                  color: '#065f46',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Using address: {registerResolvedAddress}
                <span style={{ fontWeight: 400, color: '#047857', marginLeft: '8px' }}>
                  ({registerBaseLat}, {registerBaseLng})
                </span>
              </div>
            )}
          </div>

          {registrationError && <div style={{ color: '#dc2626', marginBottom: '10px' }}>{registrationError}</div>}
          {registrationSuccess && <div style={{ color: '#16a34a', marginBottom: '10px' }}>{registrationSuccess}</div>}

          {registrationLoading ? (
            <div style={{ color: '#6b7280' }}>Loading registration records...</div>
          ) : (
            <>
              <h4 style={{ marginTop: '20px', marginBottom: '8px', color: '#b91c1c' }}>Pending Requests (Texted but not registered)</h4>
              <table className="vehicles-table" style={{ marginBottom: '24px' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Vehicle</th>
                    <th>Class</th>
                    <th>Base location</th>
                    <th>Last Texted</th>
                    <th>Current Step</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationRecords
                    .filter(r => !r.is_registered && r.has_texted)
                    .map((row) => (
                      <tr key={row.id} style={{ background: '#fef2f2' }}>
                        <td>{row.id}</td>
                        <td>{row.name || '-'}</td>
                        <td>{row.phone_number}</td>
                        <td>{row.vehicle_name || '-'}</td>
                        <td>{row.vehicle_class ?? '-'}</td>
                        <td style={{ maxWidth: '200px', fontSize: '12px' }} title={row.address || ''}>
                          {row.address ? (row.address.length > 48 ? `${row.address.slice(0, 48)}…` : row.address) : '-'}
                        </td>
                        <td>{row.last_texted_at ? new Date(row.last_texted_at).toLocaleString() : '-'}</td>
                        <td>{row.current_step || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleViewMessages(row.phone_number)}
                              style={{ padding: '6px 10px', border: 'none', background: '#3b82f6', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              View Messages
                            </button>
                            <button
                              onClick={() => handleApproveRegistration(row.id)}
                              style={{ padding: '6px 10px', border: 'none', background: '#16a34a', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              Register
                            </button>
                            <button
                              onClick={() => handleRemoveSession(row.phone_number)}
                              style={{ padding: '6px 10px', border: 'none', background: '#eab308', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                              title="Delete row from onboarding_sessions"
                            >
                              Remove Session
                            </button>
                            <button
                              onClick={() => handleRemovePendingRegistration(row.id)}
                              style={{ padding: '6px 10px', border: 'none', background: '#dc2626', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {registrationRecords.filter(r => !r.is_registered && r.has_texted).length === 0 && (
                    <tr><td colSpan="9" style={{ textAlign: 'center', color: '#6b7280' }}>No pending requests</td></tr>
                  )}
                </tbody>
              </table>

              <h4 style={{ marginTop: '10px', marginBottom: '8px' }}>Registered Drivers</h4>
              <table className="vehicles-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Vehicle</th>
                    <th>Class</th>
                    <th>Source</th>
                    <th>Base location</th>
                    <th>Current Step</th>
                    <th>Updated At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationRecords
                    .filter(r => r.is_registered)
                    .map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.name || '-'}</td>
                        <td>{row.phone_number}</td>
                        <td>{row.vehicle_name || '-'}</td>
                        <td>{row.vehicle_class ?? '-'}</td>
                        <td>{row.source || '-'}</td>
                        <td style={{ maxWidth: '200px', fontSize: '12px' }} title={row.address || ''}>
                          {row.address ? (row.address.length > 48 ? `${row.address.slice(0, 48)}…` : row.address) : '-'}
                        </td>
                        <td>
                          {row.current_step ? (
                            <span style={{
                              background: row.current_step === 'completion' ? '#dcfce7' : '#fef08a',
                              color: row.current_step === 'completion' ? '#166534' : '#854d0e',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'capitalize'
                            }}>
                              {row.current_step}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleEditRegistration(row)}
                              style={{ padding: '6px 10px', border: 'none', background: '#0ea5e9', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleViewMessages(row.phone_number)}
                              style={{ padding: '6px 10px', border: 'none', background: '#3b82f6', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              View Messages
                            </button>
                            {row.source === 'ops_manual' && (
                              <button
                                onClick={() => handleSendTemplate(row.id)}
                                disabled={sendingTemplate.has(row.id)}
                                style={{ 
                                  padding: '6px 10px', 
                                  border: 'none', 
                                  background: sendingTemplate.has(row.id) ? '#a78bfa' : '#7c3aed', 
                                  color: '#fff', 
                                  borderRadius: '6px', 
                                  cursor: sendingTemplate.has(row.id) ? 'not-allowed' : 'pointer' 
                                }}
                              >
                                {sendingTemplate.has(row.id)
                                  ? 'Sending...'
                                  : templateSentVehicles.has(row.id)
                                    ? 'Send Again'
                                    : 'Send Template'}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveSession(row.phone_number)}
                              style={{ padding: '6px 10px', border: 'none', background: '#eab308', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                              title="Delete row from onboarding_sessions"
                            >
                              Remove Session
                            </button>
                            <button
                              onClick={() => handleRemoveRegisteredRegistration(row.id)}
                              style={{ padding: '6px 10px', border: 'none', background: '#dc2626', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {registrationRecords.filter(r => r.is_registered).length === 0 && (
                    <tr><td colSpan="10" style={{ textAlign: 'center', color: '#6b7280' }}>No registered drivers yet</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── Vehicles Tab ── */}
      <div className="vehicles-table-container" style={{ display: activeTab === 'vehicles' ? '' : 'none' }}>
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Vehicle ID</th>
              <th>Driver Name</th>
              <th>Type</th>
              <th>Active Window</th>
              <th>Base Location</th>
              <th>Current Location</th>
              <th>App Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map(vehicle => (
              <React.Fragment key={vehicle.vehicle_id}>
                <tr
                  className={`vehicle-row ${vehicle.current_status.toLowerCase()} ${vehicle.bot_paused ? 'bot-paused' : ''} ${!vehicle.is_active ? 'inactive-vehicle' : ''}`}
                  style={!vehicle.is_active ? { backgroundColor: 'rgba(239, 68, 68, 0.07)', borderLeft: '3px solid #ef4444' } : {}}
                >
                  <td className="vehicle-id-cell">
                    <div className="vehicle-id-with-icon">
                      <Car size={18} style={{ color: getVehicleColor(vehicle.vehicle_type) }} />
                      <span>V-{vehicle.vehicle_id}</span>
                      {vehicle.is_new && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          backgroundColor: '#fbbf24',
                          color: '#78350f',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>NEW</span>
                      )}
                    </div>
                  </td>
                  <td className="driver-cell">
                    <span className="driver-name">{vehicle.driver_name}</span>
                  </td>
                  <td>
                    <span
                      className="vehicle-type-badge"
                      style={{ color: getVehicleColor(vehicle.vehicle_type) }}
                    >
                      {vehicle.vehicle_type}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const isInWindow = isDriverInActiveWindow(vehicle.last_driver_message_at);
                      const hasSentTemplate = templateSentVehicles.has(vehicle.vehicle_id);
                      const isSending = sendingTemplate.has(vehicle.vehicle_id);

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className={`active-window-badge ${isInWindow ? 'in' : 'out'}`}
                          >
                            {isInWindow ? 'IN' : 'OUT'}
                          </span>
                          {!isInWindow && (
                            <button
                              className="btn-send-template"
                              onClick={() => handleSendReengagementTemplate(vehicle.vehicle_id)}
                              disabled={isSending}
                              style={{
                                fontSize: '11px',
                                padding: '4px 10px',
                                backgroundColor: hasSentTemplate ? '#3b82f6' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isSending ? 'not-allowed' : 'pointer',
                                opacity: isSending ? 0.6 : 1
                              }}
                            >
                              {isSending ? 'Sending...' : (hasSentTemplate ? 'Send Again' : 'Send Template')}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="location-cell" style={{ maxWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div className="base-location">
                      <Home size={16} />
                      <span title={baseLocationCache[vehicle.vehicle_id] || vehicle.base_location || ''}>
                        {baseLocationCache[vehicle.vehicle_id]
                          ? baseLocationCache[vehicle.vehicle_id]
                          : (vehicle.base_lat && vehicle.base_lng
                            ? `${vehicle.base_lat.toFixed(4)}, ${vehicle.base_lng.toFixed(4)}`
                            : vehicle.base_location || 'No data')}
                      </span>
                    </div>
                  </td>
                  <td className="location-cell" style={{ maxWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div className="current-location">
                      <MapPin size={16} />
                      {cityCache[vehicle.vehicle_id] ? (
                        <span title={cityCache[vehicle.vehicle_id]}>{cityCache[vehicle.vehicle_id]}</span>
                      ) : vehicle.current_location_lat && vehicle.current_location_long ? (
                        <button
                          onClick={() => handleGetCurrentLocation(vehicle)}
                          disabled={locationLoadingVehicles.has(vehicle.vehicle_id)}
                          style={{
                            background: 'none',
                            border: '1px solid #6366f1',
                            borderRadius: '6px',
                            color: '#6366f1',
                            cursor: locationLoadingVehicles.has(vehicle.vehicle_id) ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            opacity: locationLoadingVehicles.has(vehicle.vehicle_id) ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {locationLoadingVehicles.has(vehicle.vehicle_id) ? '⏳ Loading...' : '📍 Get Location'}
                        </button>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>No data</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {vehicle.has_app
                      ? (
                        <span style={{
                          backgroundColor: '#dcfce7',
                          color: '#16a34a',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}>📱 Has App</span>
                      ) : (
                        <span style={{
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}>📵 No App</span>
                      )
                    }
                  </td>
                  <td className="actions-cell">
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="btn-view-details"
                        onClick={() => openVehicleModal(vehicle)}
                        style={{ fontSize: '13px', padding: '6px 12px' }}
                      >
                        View Details
                      </button>
                      <button
                        className={`btn-view-details ${vehicle.bot_paused ? 'chat-paused' : 'chat-active'}`}
                        onClick={() => openVehicleChatModal(vehicle)}
                        style={{ fontSize: '13px', padding: '6px 12px' }}
                      >
                        💬 Start
                      </button>

                    </div>
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredVehicles.length === 0 && (
        <div className="no-results">
          <Car size={48} />
          <h3>No vehicles found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Vehicle Details Modal */}
      {selectedVehicle && (
        <div className="modal-overlay" onClick={closeVehicleModal}>
          <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Car size={24} style={{ color: getVehicleColor(selectedVehicle.vehicle_type) }} />
                <h2>Vehicle #{selectedVehicle.vehicle_id} - Complete Details</h2>
              </div>
              <div className="modal-header-actions">
                <button
                  className="btn-assign-booking-header"
                  onClick={() => openAssignBookingModal(selectedVehicle)}
                >
                  Assign Booking
                </button>
                <button
                  className="btn-bonus-pay-header"
                  onClick={() => openBonusPayModal(selectedVehicle)}
                  title="Add bonus payment for driver"
                >
                  Bonus Pay
                </button>
                <button
                  className="btn-bonus-history-header"
                  onClick={() => openBonusHistoryModal(selectedVehicle)}
                >
                  Bonus History
                </button>
                <button className="modal-close-btn" onClick={closeVehicleModal}>
                  ×
                </button>
              </div>
            </div>

            <div className="modal-body-split">
              {/* Left Half - Vehicle Information & Edit Form */}
              <div className="modal-left-half">
                <div className="vehicle-info-header">
                  <h3>Vehicle Information</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      className={`btn-state-toggle ${editFormData.is_active ? 'active' : 'inactive'}`}
                      onClick={handleToggleActiveState}
                      title={editFormData.is_active ? 'Click to deactivate vehicle' : 'Click to activate vehicle'}
                    >
                      {editFormData.is_active ? '🟢 Active' : '🔴 Inactive'}
                    </button>
                    <button
                      className={`btn-edit-toggle ${isEditing ? 'editing' : ''}`}
                      onClick={handleEditToggle}
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      onClick={openDocsModal}
                      title="View and update driver documents"
                      style={{
                        backgroundColor: '#17a2b8',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      📁 Vehicle Docs
                    </button>
                    {selectedVehicle?.linked_driver_id && (
                      <button
                        onClick={handleDeleteDriver}
                        title="Permanently delete this driver and all related records"
                        style={{
                          backgroundColor: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        🗑️ Delete Driver
                      </button>
                    )}
                  </div>
                </div>

                <div className="vehicle-info-form">
                  {/* Registration Number */}
                  <div className="form-group">
                    <label>
                      <span className="required">Registration Number *</span>
                    </label>
                    <input
                      type="text"
                      name="registration_no"
                      value={editFormData.registration_no}
                      onChange={handleEditFormChange}
                      disabled={!isEditing}
                      className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      placeholder={isEditing ? "Enter registration number" : ""}
                    />
                  </div>

                  {registeredOwner && (
                    <div
                      className="form-group"
                      style={{
                        padding: '12px 14px',
                        background: '#e7f5ff',
                        borderRadius: '8px',
                        border: '1px solid #a5d8ff',
                        marginBottom: '12px',
                      }}
                    >
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Registered owner
                      </label>
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#495057' }}>
                        RC is under this person; driver may be different.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#666' }}>Name</span>
                          <input
                            type="text"
                            value={registeredOwner.name || '—'}
                            disabled
                            className="form-input readonly"
                            readOnly
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#666' }}>Phone</span>
                          <input
                            type="text"
                            value={registeredOwner.phone || '—'}
                            disabled
                            className="form-input readonly"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vehicle Class */}
                  <div className="form-group">
                    <label>Vehicle Class</label>
                    <input
                      type="number"
                      name="class"
                      value={editFormData.class}
                      onChange={handleEditFormChange}
                      disabled={!isEditing}
                      className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      min="1"
                      max="12"
                    />
                    {isEditing && (
                      <small className="form-hint" style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                        Class is auto-filled based on Make and Model
                      </small>
                    )}
                  </div>

                  {/* Vehicle Name - Dual Approach: Text Input (File 1) OR Dropdown (File 2) */}
                  {isEditing ? (
                    <>
                      {/* APPROACH 1: Text input with autocomplete (from File 1) */}
                      <div className="form-group">
                        <label>Vehicle Name *</label>
                        <input
                          type="text"
                          name="vehicle_name"
                          value={editFormData.vehicle_name}
                          onChange={handleEditFormChange}
                          className="form-input"
                          placeholder="e.g., Piaggio Ape City, Tata Ace Gold, Ashok Leyland DOST"
                          required
                        />
                        <small className="form-hint" style={{ color: '#4F46E5', fontSize: '12px', marginTop: '4px' }}>
                          💡 Enter vehicle name to auto-fill Make, Model, and Class from database
                        </small>
                      </div>

                      {/* APPROACH 2: Dropdown (from File 2) - Shown if vehicle names loaded */}
                      {availableVehicleNames.length > 0 && (
                        <div className="form-group">
                          <label>Or Select from Dropdown</label>
                          {isLoadingVehicleNames ? (
                            <div className="form-input readonly">Loading vehicle names...</div>
                          ) : (
                            <select
                              name="vehicle_name"
                              value={editFormData.vehicle_name}
                              onChange={handleVehicleNameChange}
                              className="form-input"
                            >
                              <option value="">-- Select Vehicle Name --</option>
                              {availableVehicleNames.map((vehicle, index) => (
                                <option key={index} value={vehicle.vehicle_name}>
                                  {vehicle.vehicle_name}
                                </option>
                              ))}
                            </select>
                          )}
                          <small className="form-hint">
                            Selecting a vehicle name will auto-fill make and model
                          </small>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="form-group">
                      <label>Current Vehicle</label>
                      <input
                        type="text"
                        value={editFormData.vehicle_name || `${editFormData.make} ${editFormData.model}`.trim()}
                        disabled
                        className="form-input readonly"
                      />
                    </div>
                  )}

                  {/* Make & Model - Auto-filled */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Make</label>
                      <input
                        type="text"
                        name="make"
                        value={editFormData.make}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                        placeholder={isEditing ? "Auto-filled or enter manually" : ""}
                        style={isEditing ? { backgroundColor: '#f9fafb' } : {}}
                      />
                    </div>
                    <div className="form-group">
                      <label>Model</label>
                      <input
                        type="text"
                        name="model"
                        value={editFormData.model}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                        placeholder={isEditing ? "Auto-filled or enter manually" : ""}
                        style={isEditing ? { backgroundColor: '#f9fafb' } : {}}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        name="status"
                        value={editFormData.status}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      >
                        <option value="idle">Idle</option>
                        <option value="active">Active</option>
                        <option value="en_route">En Route</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>

                  {/* Capacity with UOM & Body Type */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Capacity</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          step="0.01"
                          name="capacity"
                          value={editFormData.capacity}
                          onChange={handleEditFormChange}
                          disabled={!isEditing}
                          className={`form-input ${!isEditing ? 'readonly' : ''}`}
                          placeholder="e.g., 7.5"
                          style={{ width: '60%' }}
                        />
                        <select
                          name="capacity_uom"
                          value={editFormData.capacity_uom}
                          onChange={handleEditFormChange}
                          disabled={!isEditing}
                          className={`form-input ${!isEditing ? 'readonly' : ''}`}
                          style={{ width: '38%', marginLeft: '2%' }}
                        >
                          <option value="ton">ton</option>
                          <option value="kg">kg</option>
                          <option value="ft">ft</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Body Type</label>
                      <select
                        name="body_type"
                        value={editFormData.body_type}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      >
                        <option value="">Select Type</option>
                        <option value="Open">Open</option>
                        <option value="Sheeted">Sheeted</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  {/* Specialization */}
                  <div className="form-group">
                    <label>Specialization</label>
                    <select
                      name="specialization"
                      value={editFormData.specialization}
                      onChange={handleEditFormChange}
                      disabled={!isEditing}
                      className={`form-input ${!isEditing ? 'readonly' : ''}`}
                    >
                      <option value="">None</option>
                      <option value="Tipper">Tipper</option>
                      <option value="Refrigerated">Refrigerated</option>
                    </select>
                  </div>

                  {/* Insurance */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Insurance Number</label>
                      <input
                        type="text"
                        name="insurance_number"
                        value={editFormData.insurance_number}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      />
                    </div>
                    <div className="form-group">
                      <label>Insurance Expiry</label>
                      <input
                        type="date"
                        name="insurance_expiry"
                        value={editFormData.insurance_expiry}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Base Location with Geocoding (from File 1) */}
                  <div className="form-section-title">Base Location</div>
                  {isEditing && (
                    <div className="form-row">
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Place / Address *</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <PlacesAutocompleteInput
                            value={editFormData.base_location}
                            onChange={(text) => handleEditFormChange({ target: { name: 'base_location', value: text } })}
                            onPlaceSelect={(place) => {
                              setEditFormData(prev => ({
                                ...prev,
                                base_location: place.address,
                                base_lat: place.lat,
                                base_lng: place.lng,
                                resolved_address: place.address,
                              }));
                            }}
                            placeholder="Type to search — select from dropdown..."
                            inputStyle={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                          />
                          {/* Fallback button shown only if Google Maps isn't available */}
                          {!window.google?.maps?.places && (
                            <button
                              type="button"
                              onClick={handleGeocodeBasePlace}
                              disabled={isGeocodingBase}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#4F46E5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isGeocodingBase ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                opacity: isGeocodingBase ? 0.5 : 1,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isGeocodingBase ? '⏳ Loading...' : '📍 Get Coordinates'}
                            </button>
                          )}
                        </div>
                        {editFormData.base_lat && editFormData.base_lng && editFormData.resolved_address && (
                          <div className="mt-3" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: '#ecfdf3',
                            color: '#065f46',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '13px',
                            marginTop: '12px'
                          }}>
                            <span style={{ fontSize: '14px' }}>✓</span>
                            Using address: {editFormData.resolved_address}
                          </div>
                        )}
                        {editFormData.base_lat && editFormData.base_lng && !editFormData.resolved_address && (
                          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '12px' }}>
                            ✓ Coordinates auto-filled from address
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Base Location Latitude *</label>
                      <input
                        type="number"
                        step="0.00000001"
                        name="base_lat"
                        value={editFormData.base_lat}
                        onChange={handleEditFormChange}
                        placeholder="Auto-filled or enter manually"
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      />
                      {isEditing && (
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                          Auto-filled or enter manually
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Base Location Longitude *</label>
                      <input
                        type="number"
                        step="0.00000001"
                        name="base_lng"
                        value={editFormData.base_lng}
                        onChange={handleEditFormChange}
                        placeholder="Auto-filled or enter manually"
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      />
                      {isEditing && (
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                          Auto-filled or enter manually
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Driver Information Section */}
                  <div className="form-section-title driver-section">
                    <span>Driver Information</span>
                    <span className="driver-section-badge">Editable</span>
                  </div>

                  {/* Driver Name & Phone */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Driver Name</label>
                      <input
                        type="text"
                        name="driver_name"
                        value={editFormData.driver_name}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                        placeholder="Driver name"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        Phone Number
                        <span className="readonly-badge">Read-Only</span>
                      </label>
                      <input
                        type="tel"
                        name="driver_phone"
                        value={editFormData.driver_phone}
                        disabled
                        className="form-input readonly"
                      />
                    </div>
                  </div>

                  {/* Language & Verification Status */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Language Preference</label>
                      <select
                        name="driver_language_preference"
                        value={editFormData.driver_language_preference}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      >
                        <option value="">Select Language</option>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Tamil">Tamil</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Kannada">Kannada</option>
                        <option value="Malayalam">Malayalam</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Verification Status</label>
                      <select
                        name="driver_verification_status"
                        value={editFormData.driver_verification_status}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="manual_review_required">Manual Review Required</option>
                      </select>
                    </div>
                  </div>

                  {/* Driver Pay Rates */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Active KM Rate (₹/km)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="driver_active_km_rate"
                        value={editFormData.driver_active_km_rate}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                        placeholder="e.g., 20.00"
                      />
                    </div>
                    <div className="form-group">
                      <label>Dead KM Rate (₹/km)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="driver_dead_km_rate"
                        value={editFormData.driver_dead_km_rate}
                        onChange={handleEditFormChange}
                        disabled={!isEditing}
                        className={`form-input ${!isEditing ? 'readonly' : ''}`}
                        placeholder="e.g., 10.00"
                      />
                    </div>
                  </div>

                  {/* Read-Only Driver Performance Fields */}
                  <div className="driver-readonly-section">
                    <div className="readonly-info-header">
                      <span className="readonly-badge">Read-Only Performance Data</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>License Number</label>
                        <input
                          type="text"
                          value={editFormData.driver_license_number || 'Not available'}
                          disabled
                          className="form-input readonly"
                        />
                      </div>
                      <div className="form-group">
                        <label>License Expiry</label>
                        <input
                          type="text"
                          value={editFormData.driver_license_expiry || 'Not available'}
                          disabled
                          className="form-input readonly"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Total Trips Completed</label>
                        <input
                          type="text"
                          value={editFormData.driver_total_trips}
                          disabled
                          className="form-input readonly"
                        />
                      </div>
                      <div className="form-group">
                        <label>Driver Rating</label>
                        <input
                          type="text"
                          value={editFormData.driver_rating ? `${editFormData.driver_rating} ⭐` : 'Not rated'}
                          disabled
                          className="form-input readonly"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Joining Bonus</label>
                        <input
                          type="text"
                          value={editFormData.joining_bonus ? 'Paid' : 'Not Paid'}
                          disabled
                          className="form-input readonly"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  {isEditing && (
                    <div className="form-actions">
                      <button className="btn-save-vehicle" onClick={handleSaveVehicle}>
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Half - Complete Route Details */}
              <div className="modal-right-half">
                {/* KM Statistics Section - Enhanced with Total Pay */}
                {selectedVehicle.total_km !== undefined && (
                  <div className="km-stats-section" style={{
                    backgroundColor: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <h4 style={{
                      margin: '0 0 12px 0',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#333'
                    }}>📊 Total Distance Statistics</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div style={{
                        backgroundColor: '#e3f2fd',
                        padding: '12px',
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Active KM</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
                          {selectedVehicle.total_active_km?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div style={{
                        backgroundColor: '#fff3e0',
                        padding: '12px',
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Dead KM</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f57c00' }}>
                          {selectedVehicle.total_dead_km?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div style={{
                        backgroundColor: '#e8f5e9',
                        padding: '12px',
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Total Pay</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#388e3c' }}>
                          ₹{selectedVehicle.total_pay?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <CompleteRouteDetails vehicleId={selectedVehicle.vehicle_id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Booking Modal - Separate overlay with Two-Step Validation */}
      {selectedVehicleForAssignment && (
        <div className="modal-overlay" onClick={closeAssignBookingModal} style={{ zIndex: 2000 }}>
          <div className="modal-content assign-booking-modal-full" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h2>Assign Booking to Vehicle V-{selectedVehicleForAssignment.vehicle_id}</h2>
                <p className="modal-subtitle">
                  {selectedVehicleForAssignment.vehicle_type} • {selectedVehicleForAssignment.base_location}
                </p>
              </div>
              <button className="modal-close-btn" onClick={closeAssignBookingModal}>×</button>
            </div>

            <div className="modal-body">
              {/* Step 1: Select Booking */}
              {validationStep === 'select' && (
                <>
                  {/* Search Box */}
                  <div className="booking-search-section">
                    <div className="booking-search-box">
                      <Search size={20} />
                      <input
                        type="text"
                        placeholder="Search by Booking ID or Pickup Location..."
                        value={bookingSearchTerm}
                        onChange={(e) => setBookingSearchTerm(e.target.value)}
                        disabled={isValidating}
                      />
                    </div>
                  </div>

                  {/* Bookings List */}
                  <div className="modal-bookings-section">
                    <h3>Available Unassigned Bookings ({getFilteredBookings().length})</h3>

                    {getFilteredBookings().length > 0 ? (
                      <div className="modal-bookings-list">
                        {getFilteredBookings().map(booking => (
                          <div key={booking.booking_id} className="booking-card">
                            <div className="booking-header">
                              <div className="booking-id-badge">
                                <span className="booking-label">Booking ID</span>
                                <span className="booking-number">B-{booking.booking_id}</span>
                              </div>
                              <button
                                className="btn-assign-booking"
                                onClick={() => handleAssignBooking(selectedVehicleForAssignment.vehicle_id, booking.booking_id)}
                                disabled={isValidating && selectedBookingForValidation === booking.booking_id}
                              >
                                {isValidating && selectedBookingForValidation === booking.booking_id ? 'Validating...' : 'Assign'}
                              </button>
                            </div>

                            <div className="booking-details">
                              <div className="booking-location">
                                <MapPin size={16} />
                                <div>
                                  <label>Pickup Location</label>
                                  <p>{booking.pickup_location}</p>
                                </div>
                              </div>
                              {booking.dropoff_location && (
                                <div className="booking-location">
                                  <MapPin size={16} />
                                  <div>
                                    <label>Dropoff Location</label>
                                    <p>{booking.dropoff_location}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="modal-no-bookings">
                        <MapPin size={48} />
                        <h4>{bookingSearchTerm ? 'No bookings match your search' : 'No unassigned bookings available'}</h4>
                        <p>{bookingSearchTerm ? 'Try different search terms' : 'All bookings are currently assigned'}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Step 2: Show Warnings */}
              {validationStep === 'warnings' && validationResult && (
                <div style={{ padding: '20px' }}>
                  <h3 style={{ marginBottom: '16px', color: '#333' }}>
                    Assignment Validation - Booking #{selectedBookingForValidation}
                  </h3>

                  {/* Hard Block - Cannot Proceed */}
                  {!validationResult.can_proceed && (
                    <div style={{
                      backgroundColor: '#f8d7da',
                      border: '1px solid #f5c6cb',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ color: '#721c24', margin: '0 0 8px 0' }}>
                        ❌ Assignment Blocked
                      </h4>
                      <p style={{ color: '#721c24', margin: 0 }}>
                        {validationResult.hard_block}
                      </p>
                    </div>
                  )}

                  {/* Warnings List */}
                  {validationResult.warnings && validationResult.warnings.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ marginBottom: '12px', color: '#333' }}>
                        ⚠️ Warnings ({validationResult.warnings.length})
                      </h4>
                      {validationResult.warnings.map((warning, index) => (
                        <div
                          key={index}
                          style={{
                            backgroundColor: getSeverityBgColor(warning.severity),
                            borderLeft: `4px solid ${getSeverityColor(warning.severity)}`,
                            padding: '12px',
                            marginBottom: '8px',
                            borderRadius: '4px'
                          }}
                        >
                          <div style={{
                            fontWeight: 'bold',
                            color: getSeverityColor(warning.severity),
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            fontSize: '12px'
                          }}>
                            {warning.severity}
                          </div>
                          <div style={{ color: '#333' }}>
                            {warning.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Booking & Vehicle Info */}
                  {validationResult.booking_info && (
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      padding: '12px',
                      borderRadius: '4px',
                      marginBottom: '20px',
                      fontSize: '14px'
                    }}>
                      <div><strong>Booking:</strong> #{validationResult.booking_info.booking_id}</div>
                      <div><strong>Vehicle Type Required:</strong> {validationResult.booking_info.vehicle_type || 'N/A'}</div>
                      <div><strong>Target Vehicle:</strong> #{validationResult.vehicle_info?.vehicle_id} ({validationResult.vehicle_info?.vehicle_type || 'N/A'})</div>
                    </div>
                  )}

                  {/* Acknowledgment Checkbox (only if can proceed with warnings) */}
                  {validationResult.can_proceed && validationResult.warnings?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={warningsAcknowledged}
                          onChange={(e) => setWarningsAcknowledged(e.target.checked)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span style={{ color: '#333' }}>
                          I acknowledge the warnings and want to proceed with this assignment
                        </span>
                      </label>
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                  }}>
                    <button
                      onClick={handleBackToSelect}
                      disabled={isAssigning}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        color: '#333',
                        cursor: isAssigning ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ← Back to Bookings
                    </button>
                    <button
                      onClick={closeAssignBookingModal}
                      disabled={isAssigning}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        color: '#333',
                        cursor: isAssigning ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    {validationResult.can_proceed && (
                      <button
                        onClick={() => handleConfirmAssignment(
                          selectedVehicleForAssignment.vehicle_id,
                          selectedBookingForValidation
                        )}
                        disabled={isAssigning || (validationResult.warnings?.length > 0 && !warningsAcknowledged)}
                        style={{
                          padding: '8px 16px',
                          border: 'none',
                          borderRadius: '4px',
                          backgroundColor: (isAssigning || (validationResult.warnings?.length > 0 && !warningsAcknowledged))
                            ? '#ccc'
                            : (validationResult.warnings?.some(w => w.severity === 'critical') ? '#dc3545' : '#28a745'),
                          color: 'white',
                          cursor: (isAssigning || (validationResult.warnings?.length > 0 && !warningsAcknowledged))
                            ? 'not-allowed'
                            : 'pointer'
                        }}
                      >
                        {isAssigning ? 'Assigning...' :
                          validationResult.warnings?.some(w => w.severity === 'critical')
                            ? '⚠️ Confirm Despite Warnings'
                            : '✓ Confirm Assignment'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Chat Modal */}
      {selectedVehicleForChat && (
        <div className="modal-overlay" onClick={closeVehicleChatModal} style={{ zIndex: 2100 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '800px',
              maxWidth: '90vw',
              height: '700px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden'
            }}
          >
            {/* Chat Header */}
            <div style={{
              backgroundColor: '#4F46E5',
              color: 'white',
              padding: '20px',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    💬
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                      Driver Conversation
                    </h2>
                    <p style={{
                      margin: '4px 0 0 0',
                      fontSize: '14px',
                      opacity: 0.9,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        🚗 V-{selectedVehicleForChat.vehicle_id}
                      </span>
                      <span>{selectedVehicleForChat.driver_name}</span>

                      {/* WebSocket connection status indicator */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: wsConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: wsConnected ? '#10b981' : '#ef4444',
                        fontWeight: '500'
                      }}>
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: wsConnected ? '#10b981' : '#ef4444',
                          boxShadow: wsConnected ? '0 0 4px #10b981' : 'none'
                        }}></span>
                        {wsConnected ? 'Live' : 'Offline'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={handleToggleChatBot}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isChatBotPaused ? '#10b981' : '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  {isChatBotPaused ? '▶️ Resume Bot' : '⏸️ Manual Mode'}
                </button>
                <button
                  onClick={closeVehicleChatModal}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Bot Status Banner */}
            {isChatBotPaused && (
              <div style={{
                backgroundColor: '#fef3c7',
                borderLeft: '4px solid #f59e0b',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '14px',
                color: '#92400e'
              }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div>
                  <strong>Manual Mode Active</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px' }}>
                    {driverHasApp
                      ? '📱 Bot is paused. Messages will be sent via push notification to the driver app.'
                      : '💬 Bot is paused. Messages will be sent via WhatsApp to the driver.'}
                  </p>
                </div>
              </div>
            )}

            {/* Chat Messages Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              backgroundColor: '#f9fafb',
              backgroundImage: 'radial-gradient(circle at 20px 20px, #e5e7eb 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}>
              {chatHistory.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#9ca3af',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '48px' }}>💬</div>
                  <p style={{ fontSize: '16px', fontWeight: '500' }}>No messages yet</p>
                  <p style={{ fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
                    {driverHasApp
                      ? 'Messages will be sent via push notification to the driver app. Start a conversation by typing below.'
                      : "Messages will be sent via WhatsApp to the driver's phone. Start a conversation by typing below."}
                  </p>
                </div>
              ) : (
                // Remove duplicates and map unique messages
                (Array.isArray(chatHistory) ? chatHistory : [])
                  .filter((msg, index, self) => {
                    // Remove duplicates by stringifying and comparing
                    const msgStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
                    return index === self.findIndex(m => {
                      const mStr = typeof m === 'string' ? m : JSON.stringify(m);
                      return msgStr === mStr;
                    });
                  })
                  .map((msg, index) => {
                    // Parse message if it's a JSON string
                    let parsedMsg = msg;
                    if (typeof msg === 'string') {
                      try {
                        parsedMsg = JSON.parse(msg);
                      } catch (e) {
                        parsedMsg = { role: 'system', message: msg };
                      }
                    }

                    // Determine message sender type
                    // Driver messages: role='driver' or sender='driver'
                    // Bot messages: role='bot'
                    // Operator messages: role='operator' or anything else that's not driver/bot/system
                    const isDriver = parsedMsg.role === 'driver' || parsedMsg.sender === 'driver' || parsedMsg.from === 'driver';
                    const isBot = parsedMsg.role === 'bot';
                    const isSystem = parsedMsg.role === 'system' || parsedMsg.sender === 'system';
                    // If not driver, bot, or system, it's an operator message
                    const isOperator = !isDriver && !isBot && !isSystem;

                    // Parse special message types
                    const messageText = parsedMsg.message || parsedMsg.content || '';
                    const isPhoto = messageText.startsWith('photo:');
                    const isLocation = messageText.startsWith('location ');

                    let displayContent = messageText;
                    if (isPhoto) {
                      const photoUrl = messageText.replace('photo:', '').trim();
                      const linkColor = isDriver ? '#1d4ed8' : (isBot ? '#6d28d9' : '#047857');
                      if (/^https?:\/\//i.test(photoUrl)) {
                        displayContent = (
                          <div>
                            <img
                              src={photoUrl}
                              alt="Driver photo"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '240px',
                                borderRadius: '8px',
                                display: 'block',
                                objectFit: 'contain',
                                backgroundColor: 'rgba(255,255,255,0.5)',
                              }}
                            />
                            <a
                              href={photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: linkColor, textDecoration: 'none', fontSize: '12px', marginTop: '8px', display: 'inline-block', fontWeight: 600 }}
                            >
                              Open full image
                            </a>
                          </div>
                        );
                      } else {
                        displayContent = (
                          <a href={photoUrl} target="_blank" rel="noopener noreferrer"
                            style={{ color: linkColor, textDecoration: 'underline' }}>
                            View Photo
                          </a>
                        );
                      }
                    } else if (isLocation) {
                      const coords = messageText.replace('location ', '').trim().split(' ');
                      if (coords.length === 2) {
                        const [lat, lng] = coords;
                        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                        displayContent = (
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'white', textDecoration: 'underline' }}>
                            📍 View Location on Map
                          </a>
                        );
                      }
                    }

                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          // Operator/Bot messages on RIGHT (outgoing), Driver messages on LEFT (incoming)
                          justifyContent: isDriver ? 'flex-start' : isSystem ? 'center' : 'flex-end',
                          marginBottom: '16px',
                          animation: 'slideIn 0.3s ease-out'
                        }}
                      >
                        {isSystem ? (
                          <div style={{
                            backgroundColor: '#e0e7ff',
                            color: '#4338ca',
                            padding: '8px 16px',
                            borderRadius: '16px',
                            fontSize: '13px',
                            maxWidth: '80%',
                            textAlign: 'center',
                            fontStyle: 'italic'
                          }}>
                            {parsedMsg.message || parsedMsg.content}
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            // Driver avatar on left, Operator/Bot avatar on right
                            flexDirection: isDriver ? 'row' : 'row-reverse',
                            gap: '12px',
                            maxWidth: '75%',
                            alignItems: 'flex-end'
                          }}>
                            {/* Avatar */}
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: isDriver ? '#3b82f6' : (isBot ? '#8b5cf6' : '#10b981'),
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              flexShrink: 0,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                              {isDriver ? '🚗' : (isBot ? '🤖' : '👤')}
                            </div>

                            {/* Message Bubble */}
                            <div style={{
                              // Driver (incoming) = light blue on left, Bot = purple, Operator = green on right
                              backgroundColor: isDriver ? '#dbeafe' : (isBot ? '#ede9fe' : '#d1fae5'),
                              color: isDriver ? '#1e40af' : (isBot ? '#5b21b6' : '#065f46'),
                              padding: '12px 16px',
                              // Driver on left: tail on left side, Operator/Bot on right: tail on right side
                              borderRadius: isDriver ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                              wordWrap: 'break-word'
                            }}>
                              {isDriver && (
                                <div style={{
                                  fontSize: '11px',
                                  opacity: 0.7,
                                  marginBottom: '4px',
                                  fontWeight: '500'
                                }}>
                                  Driver
                                </div>
                              )}
                              {!isDriver && (
                                <div style={{
                                  fontSize: '11px',
                                  opacity: 0.8,
                                  marginBottom: '4px',
                                  fontWeight: '500'
                                }}>
                                  {isBot ? 'Bot' : (parsedMsg.sender || 'Ops')}
                                </div>
                              )}
                              <div style={{
                                fontSize: '14px',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {displayContent}
                              </div>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '6px',
                                gap: '8px'
                              }}>
                                {parsedMsg.timestamp && (
                                  <span style={{
                                    fontSize: '11px',
                                    opacity: 0.7
                                  }}>
                                    {new Date(parsedMsg.timestamp).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                )}
                                {/* Message status indicator for operator messages */}
                                {!isDriver && parsedMsg.status && (
                                  <span style={{
                                    fontSize: '12px',
                                    opacity: 0.9
                                  }}>
                                    {parsedMsg.status === 'pending' && '⏳'}
                                    {parsedMsg.status === 'sent' && '✓'}
                                    {parsedMsg.status === 'saved' && '💾'}
                                    {parsedMsg.status === 'failed' && '❌'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
              {/* Scroll anchor */}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Message Input Area */}
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              borderTop: '1px solid #e5e7eb',
              borderRadius: '0 0 12px 12px'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder="Type your message to the driver..."
                  disabled={isSendingMessage}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '14px',
                    resize: 'none',
                    minHeight: '50px',
                    maxHeight: '120px',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                <button
                  onClick={handleSendChatMessage}
                  disabled={!chatMessage.trim() || isSendingMessage}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: chatMessage.trim() && !isSendingMessage ? '#4F46E5' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: chatMessage.trim() && !isSendingMessage ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    minHeight: '50px'
                  }}
                  onMouseEnter={(e) => {
                    if (chatMessage.trim() && !isSendingMessage) {
                      e.target.style.backgroundColor = '#4338ca';
                      e.target.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (chatMessage.trim() && !isSendingMessage) {
                      e.target.style.backgroundColor = '#4F46E5';
                      e.target.style.transform = 'scale(1)';
                    }
                  }}
                >
                  {isSendingMessage ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite'
                      }} />
                      Sending...
                    </>
                  ) : (
                    <>
                      ✉️ Send Message
                    </>
                  )}
                </button>
              </div>
              <p style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '8px 0 0 0',
                fontStyle: 'italic'
              }}>
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BONUS PAY MODAL ==================== */}
      {showBonusPayModal && selectedVehicleForBonus && (
        <div className="modal-overlay" onClick={closeBonusPayModal} style={{ zIndex: 2100 }}>
          <div className="modal-content bonus-pay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h2>Add Bonus Payment - Vehicle V-{selectedVehicleForBonus.vehicle_id}</h2>
              </div>
              <button className="modal-close-btn" onClick={closeBonusPayModal}>×</button>
            </div>

            <div className="modal-body">
              {!showBonusConfirmation ? (
                <div className="bonus-pay-form">
                  {/* Date Field */}
                  <div className="form-group-bonus">
                    <label>
                      Date <span className="required">*</span>
                    </label>
                    <div className="date-selector-with-today">
                      <input
                        type="date"
                        value={bonusDate}
                        onChange={(e) => handleBonusDateChange(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                      <button
                        className="btn-today"
                        onClick={handleSetToday}
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  {/* Trip Dropdown */}
                  <div className="form-group-bonus">
                    <label>Trip (Optional)</label>
                    {isLoadingTrips ? (
                      <div style={{ padding: '10px', color: '#6b7280' }}>Loading trips...</div>
                    ) : bonusTrips.length > 0 ? (
                      <select
                        value={selectedTripId}
                        onChange={(e) => setSelectedTripId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="">-- Select Trip (Optional) --</option>
                        {bonusTrips.map(trip => (
                          <option key={trip.trip_id} value={trip.trip_id}>
                            Trip #{trip.trip_id} - {trip.pickup_location} → {trip.dropoff_location}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{
                        padding: '10px',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #fbbf24',
                        borderRadius: '6px',
                        color: '#92400e',
                        fontSize: '14px'
                      }}>
                        No trips found for this date
                      </div>
                    )}
                  </div>

                  {/* Reason Field */}
                  <div className="form-group-bonus">
                    <label>
                      Reason <span className="required">*</span>
                    </label>
                    <textarea
                      value={bonusReason}
                      onChange={(e) => setBonusReason(e.target.value)}
                      placeholder="e.g., Toll reimbursement, Customer inconvenience compensation, Extra effort, etc."
                      rows="3"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                    <small style={{ color: '#6b7280', fontSize: '12px' }}>
                      Minimum 10 characters ({bonusReason.length}/10)
                    </small>
                  </div>

                  {/* Amount Field */}
                  <div className="form-group-bonus">
                    <label>
                      Amount <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '16px',
                        color: '#374151',
                        fontWeight: '600'
                      }}>₹</span>
                      <input
                        type="number"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        placeholder="0.00"
                        min="1"
                        step="0.01"
                        style={{
                          width: '100%',
                          padding: '10px 10px 10px 30px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '24px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={closeBonusPayModal}
                      style={{
                        padding: '10px 20px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        color: '#374151',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBonusSubmit}
                      disabled={isSubmittingBonus}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: isSubmittingBonus ? '#9ca3af' : '#10b981',
                        color: 'white',
                        cursor: isSubmittingBonus ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      {isSubmittingBonus ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Confirmation Dialog */
                <div className="confirmation-dialog">
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ color: '#856404', marginBottom: '12px', fontSize: '18px' }}>
                      ⚠️ Confirm Bonus Payment
                    </h3>
                    <div className="confirmation-text" style={{ fontSize: '16px', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '8px' }}>
                        <strong>Amount:</strong> ₹{bonusAmount}
                      </p>
                      <p style={{ marginBottom: '8px' }}>
                        <strong>Date:</strong> {bonusDate}
                      </p>
                      {selectedTripId && (
                        <p style={{ marginBottom: '8px' }}>
                          <strong>Trip:</strong> #{selectedTripId}
                        </p>
                      )}
                      <p style={{ marginBottom: '8px' }}>
                        <strong>Reason:</strong> {bonusReason}
                      </p>
                      <p style={{ marginTop: '16px', fontWeight: '600' }}>
                        This bonus will be added to the driver's payment calculation.
                        The status will remain as "Pending" until it's included in the daily payment.
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => setShowBonusConfirmation(false)}
                      disabled={isSubmittingBonus}
                      style={{
                        padding: '10px 20px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        color: '#374151',
                        cursor: isSubmittingBonus ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleBonusConfirm}
                      disabled={isSubmittingBonus}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: isSubmittingBonus ? '#9ca3af' : '#059669',
                        color: 'white',
                        cursor: isSubmittingBonus ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      {isSubmittingBonus ? 'Processing...' : 'Yes, Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== BONUS HISTORY MODAL ==================== */}
      {showBonusHistoryModal && selectedVehicleForBonus && (
        <div className="modal-overlay" onClick={closeBonusHistoryModal} style={{ zIndex: 2100 }}>
          <div className="modal-content bonus-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h2>Bonus Payment History - Vehicle V-{selectedVehicleForBonus.vehicle_id}</h2>
              </div>
              <button className="modal-close-btn" onClick={closeBonusHistoryModal}>×</button>
            </div>

            {/* Date Filter */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Filter by Date:</label>
              <input
                type="date"
                value={bonusHistoryDateFilter.startDate}
                onChange={(e) => {
                  setBonusHistoryDateFilter({ ...bonusHistoryDateFilter, startDate: e.target.value });
                  setBonusHistoryCurrentPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Start Date"
              />
              <span style={{ color: '#6b7280' }}>to</span>
              <input
                type="date"
                value={bonusHistoryDateFilter.endDate}
                onChange={(e) => {
                  setBonusHistoryDateFilter({ ...bonusHistoryDateFilter, endDate: e.target.value });
                  setBonusHistoryCurrentPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="End Date"
              />
              {(bonusHistoryDateFilter.startDate || bonusHistoryDateFilter.endDate) && (
                <button
                  onClick={() => {
                    setBonusHistoryDateFilter({ startDate: '', endDate: '' });
                    setBonusHistoryCurrentPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Clear Filter
                </button>
              )}
            </div>

            <div className="modal-body">
              {isLoadingHistory ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="loading-spinner"></div>
                    <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading bonus history...</p>
                  </div>
                </div>
              ) : bonusHistory.length > 0 ? (
                <>
                  {/* Summary Cards - Filtered Stats */}
                  {(() => {
                    // Apply date filter to get filtered data
                    let filtered = bonusHistory;
                    if (bonusHistoryDateFilter.startDate) {
                      filtered = filtered.filter(b => new Date(b.date) >= new Date(bonusHistoryDateFilter.startDate));
                    }
                    if (bonusHistoryDateFilter.endDate) {
                      filtered = filtered.filter(b => new Date(b.date) <= new Date(bonusHistoryDateFilter.endDate));
                    }

                    return (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        marginBottom: '24px'
                      }}>
                        <div style={{
                          backgroundColor: '#fef3c7',
                          padding: '16px',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
                            Total Pending
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#b45309' }}>
                            ₹{filtered
                              .filter(b => !b.paid)
                              .reduce((sum, b) => sum + b.amount, 0)
                              .toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                            {filtered.filter(b => !b.paid).length} records
                          </div>
                        </div>
                        <div style={{
                          backgroundColor: '#d1fae5',
                          padding: '16px',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '12px', color: '#065f46', marginBottom: '4px' }}>
                            Total Paid
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>
                            ₹{filtered
                              .filter(b => b.paid)
                              .reduce((sum, b) => sum + b.amount, 0)
                              .toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px' }}>
                            {filtered.filter(b => b.paid).length} records
                          </div>
                        </div>
                        <div style={{
                          backgroundColor: '#e0e7ff',
                          padding: '16px',
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '12px', color: '#3730a3', marginBottom: '4px' }}>
                            Total Records
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f46e5' }}>
                            {filtered.length}
                          </div>
                          <div style={{ fontSize: '11px', color: '#3730a3', marginTop: '4px' }}>
                            {(bonusHistoryDateFilter.startDate || bonusHistoryDateFilter.endDate) ? 'Filtered' : 'All payments'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* History Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="bonus-history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Trip ID</th>
                          <th>Amount</th>
                          <th>Reason</th>
                          <th>Status</th>
                          <th>Created By</th>
                          <th>Created At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Filter by date
                          let filtered = bonusHistory;
                          if (bonusHistoryDateFilter.startDate) {
                            filtered = filtered.filter(b => new Date(b.date) >= new Date(bonusHistoryDateFilter.startDate));
                          }
                          if (bonusHistoryDateFilter.endDate) {
                            filtered = filtered.filter(b => new Date(b.date) <= new Date(bonusHistoryDateFilter.endDate));
                          }

                          // Pagination
                          const startIdx = (bonusHistoryCurrentPage - 1) * BONUS_HISTORY_PAGE_SIZE;
                          const endIdx = startIdx + BONUS_HISTORY_PAGE_SIZE;
                          const paginatedData = filtered.slice(startIdx, endIdx);

                          return paginatedData.length > 0 ? paginatedData.map(bonus => (
                            <tr key={bonus.id}>
                              <td>
                                {editingBonusId === bonus.id ? (
                                  <input
                                    type="date"
                                    value={editBonusData.date}
                                    onChange={(e) => {
                                      setEditBonusData({ ...editBonusData, date: e.target.value });
                                      fetchTripsForDate(selectedVehicleForBonus.vehicle_id, e.target.value);
                                    }}
                                    max={new Date().toISOString().split('T')[0]}
                                    style={{
                                      padding: '4px 8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      width: '130px'
                                    }}
                                    disabled={isUpdatingBonus}
                                  />
                                ) : (
                                  new Date(bonus.date).toLocaleDateString()
                                )}
                              </td>
                              <td>
                                {editingBonusId === bonus.id ? (
                                  isLoadingTrips ? (
                                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Loading...</span>
                                  ) : (
                                    <select
                                      value={editBonusData.trip_id}
                                      onChange={(e) => setEditBonusData({ ...editBonusData, trip_id: e.target.value })}
                                      style={{
                                        padding: '4px 8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        width: '120px'
                                      }}
                                      disabled={isUpdatingBonus}
                                    >
                                      <option value="">None</option>
                                      {bonusTrips.map(trip => (
                                        <option key={trip.trip_id} value={trip.trip_id}>
                                          Trip #{trip.trip_id}
                                        </option>
                                      ))}
                                    </select>
                                  )
                                ) : bonus.trip_id ? (
                                  <span style={{
                                    backgroundColor: '#dbeafe',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#1e40af'
                                  }}>
                                    #{bonus.trip_id}
                                  </span>
                                ) : (
                                  <span style={{ color: '#9ca3af', fontSize: '13px' }}>N/A</span>
                                )}
                              </td>
                              <td style={{ fontWeight: '600', color: '#059669' }}>
                                {editingBonusId === bonus.id ? (
                                  <input
                                    type="number"
                                    value={editBonusData.amount}
                                    onChange={(e) => setEditBonusData({ ...editBonusData, amount: e.target.value })}
                                    min="1"
                                    step="0.01"
                                    style={{
                                      padding: '4px 8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      width: '90px'
                                    }}
                                    disabled={isUpdatingBonus}
                                  />
                                ) : (
                                  `₹${bonus.amount.toFixed(2)}`
                                )}
                              </td>
                              <td style={{ maxWidth: '200px', fontSize: '13px' }}>
                                {editingBonusId === bonus.id ? (
                                  <textarea
                                    value={editBonusData.reason}
                                    onChange={(e) => setEditBonusData({ ...editBonusData, reason: e.target.value })}
                                    rows="2"
                                    style={{
                                      padding: '4px 8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      width: '180px',
                                      resize: 'vertical'
                                    }}
                                    disabled={isUpdatingBonus}
                                  />
                                ) : (
                                  bonus.reason
                                )}
                              </td>
                              <td>
                                <span className={`status-badge ${bonus.paid ? 'paid' : 'pending'}`}>
                                  {bonus.paid ? '✓ Paid' : '⏳ Pending'}
                                </span>
                              </td>
                              <td style={{ fontSize: '13px' }}>{bonus.created_by}</td>
                              <td style={{ fontSize: '13px', color: '#6b7280' }}>
                                {new Date(bonus.created_at).toLocaleString()}
                              </td>
                              <td>
                                {!bonus.paid && (
                                  editingBonusId === bonus.id ? (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button
                                        onClick={handleSaveEditBonus}
                                        disabled={isUpdatingBonus}
                                        style={{
                                          padding: '4px 8px',
                                          backgroundColor: isUpdatingBonus ? '#9ca3af' : '#059669',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          cursor: isUpdatingBonus ? 'not-allowed' : 'pointer',
                                          fontWeight: '600'
                                        }}
                                      >
                                        {isUpdatingBonus ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={handleCancelEditBonus}
                                        disabled={isUpdatingBonus}
                                        style={{
                                          padding: '4px 8px',
                                          backgroundColor: '#6b7280',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          cursor: isUpdatingBonus ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleEditBonus(bonus)}
                                      style={{
                                        padding: '4px 12px',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Modify
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                                No records found for the selected date range.
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {(() => {
                    let filtered = bonusHistory;
                    if (bonusHistoryDateFilter.startDate) {
                      filtered = filtered.filter(b => new Date(b.date) >= new Date(bonusHistoryDateFilter.startDate));
                    }
                    if (bonusHistoryDateFilter.endDate) {
                      filtered = filtered.filter(b => new Date(b.date) <= new Date(bonusHistoryDateFilter.endDate));
                    }
                    const totalPages = Math.ceil(filtered.length / BONUS_HISTORY_PAGE_SIZE);

                    if (totalPages <= 1) return null;

                    return (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '24px',
                        padding: '16px'
                      }}>
                        <button
                          onClick={() => setBonusHistoryCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={bonusHistoryCurrentPage === 1}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            backgroundColor: bonusHistoryCurrentPage === 1 ? '#f3f4f6' : 'white',
                            cursor: bonusHistoryCurrentPage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          Previous
                        </button>
                        <span style={{ fontSize: '14px', color: '#374151' }}>
                          Page {bonusHistoryCurrentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setBonusHistoryCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={bonusHistoryCurrentPage === totalPages}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            backgroundColor: bonusHistoryCurrentPage === totalPages ? '#f3f4f6' : 'white',
                            cursor: bonusHistoryCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          Next
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                  <h3 style={{ marginBottom: '8px', color: '#374151' }}>No Bonus Payments Yet</h3>
                  <p>No bonus payments have been added for this vehicle.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Vehicle Docs Modal ──────────────────────────────────────────── */}
      {showDocsModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDocsModal(false)}
          style={{ zIndex: 3000 }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="modal-title">
                <span style={{ fontSize: 18 }}>📁</span>
                <span style={{ marginLeft: 8 }}>Vehicle Documents — #{selectedVehicle?.vehicle_id}</span>
              </div>
              <button
                onClick={() => setShowDocsModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
              {docsLoading && (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                  Loading documents…
                </div>
              )}
              {docsError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', marginBottom: 12 }}>
                  ⚠️ {docsError}
                </div>
              )}
              {!docsLoading && !docsError && driverDocs && (() => {
                const missingCount = DRIVER_DOC_TYPES.filter(d => !driverDocs[d.key]?.present).length;
                return (
                  <>
                    {/* Summary */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                      {missingCount > 0 ? (
                        <span style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 600 }}>
                          ⚠️ {missingCount} missing
                        </span>
                      ) : (
                        <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 600 }}>
                          ✅ All documents present
                        </span>
                      )}
                      {DRIVER_DOC_TYPES.map(dt => (
                        <span
                          key={dt.key}
                          style={{
                            background: driverDocs[dt.key]?.present ? '#d1fae5' : '#fee2e2',
                            color: driverDocs[dt.key]?.present ? '#065f46' : '#b91c1c',
                            borderRadius: 20, padding: '3px 10px', fontSize: 12,
                          }}
                        >
                          {dt.icon} {dt.label} {driverDocs[dt.key]?.present ? '✓' : '✗'}
                        </span>
                      ))}
                    </div>

                    {/* Document cards */}
                    {DRIVER_DOC_TYPES.map(dt => (
                      <DriverDocCard
                        key={dt.key}
                        docType={dt}
                        doc={driverDocs[dt.key] || {}}
                        vehicleId={selectedVehicle?.vehicle_id}
                        onRefresh={() => fetchDriverDocs(selectedVehicle?.vehicle_id)}
                      />
                    ))}
                  </>
                );
              })()}

              {/* Bank details always shown (independent of docs load) */}
              {!docsLoading && showDocsModal && (
                <BankDetailsSection vehicleId={selectedVehicle?.vehicle_id} />
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* ── Driver Messages Modal ──────────────────────────────────────────── */}
      {showMessagesModal && (
        <div className="modal-overlay" onClick={closeMessagesModal} style={{ zIndex: 3000 }}>
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 600, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>💬</span>
                <h3 style={{ margin: 0 }}>Messages for {selectedDriverForMessages}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={handleToggleRegistrationBot}
                  disabled={isRegistrationBotStatusLoading || isRegistrationBotToggling}
                  style={{
                    padding: '7px 12px',
                    border: 'none',
                    borderRadius: '7px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (isRegistrationBotStatusLoading || isRegistrationBotToggling) ? 'not-allowed' : 'pointer',
                    background: isRegistrationBotPaused ? '#16a34a' : '#ef4444',
                    opacity: (isRegistrationBotStatusLoading || isRegistrationBotToggling) ? 0.65 : 1,
                    fontSize: '12px'
                  }}
                >
                  {isRegistrationBotToggling
                    ? 'Updating...'
                    : isRegistrationBotPaused
                      ? '▶ Resume Bot'
                      : '⏸ Manual Mode'}
                </button>
                <button onClick={closeMessagesModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
              </div>
            </div>

            {isRegistrationBotPaused && (
              <div style={{
                backgroundColor: '#fef3c7',
                borderLeft: '4px solid #f59e0b',
                padding: '10px 14px',
                color: '#92400e',
                fontSize: '13px'
              }}>
                <strong>Manual Mode Active</strong>
                <div style={{ marginTop: '3px' }}>
                  Bot replies are paused. Ops messages are sent manually to driver WhatsApp.
                </div>
              </div>
            )}
            
            <div 
              ref={messagesContainerRef}
              onScroll={handleScrollMessages}
              style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#f9fafb' }}
            >
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading messages...</div>
              ) : messagesError ? (
                <div style={{ color: '#dc2626', background: '#fee2e2', padding: '12px', borderRadius: '6px' }}>{messagesError}</div>
              ) : driverMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No messages found for this driver.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {visibleMessageCount < driverMessages.length && (
                    <div style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                      Scroll up to load older messages
                    </div>
                  )}
                  {driverMessages.slice(-visibleMessageCount).map((msg, idx) => {
                    const isDriver = msg.sender === 'driver' || msg.sender === 'user';
                    return (
                      <div key={idx} style={{
                        alignSelf: isDriver ? 'flex-start' : 'flex-end',
                        maxWidth: '80%',
                        backgroundColor: isDriver ? '#ffffff' : '#d1fae5',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>
                          {isDriver ? 'Driver' : 'Bot/Ops'}
                        </div>
                        <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {msg.type === 'image' && msg.content.startsWith('http') ? (
                            <div>
                                <img 
                                  src={msg.content} 
                                  alt="Uploaded document" 
                                  style={{ maxWidth: '100%', borderRadius: '4px', marginTop: '4px', maxHeight: '200px', objectFit: 'contain' }} 
                                  onLoad={scrollToBottom}
                                />
                                <div style={{ marginTop: '4px' }}>
                                    <a href={msg.content} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '12px' }}>
                                        Open full image ↗
                                    </a>
                                </div>
                            </div>
                          ) : msg.type === 'location' ? (
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: '6px' }}>📍 Shared location</div>
                              {(msg.latitude != null && msg.longitude != null) ? (
                                <div style={{ fontFamily: 'monospace', fontSize: '13px', marginBottom: '6px' }}>
                                  {Number(msg.latitude).toFixed(6)}, {Number(msg.longitude).toFixed(6)}
                                </div>
                              ) : null}
                              {(msg.location_name || msg.location_address) ? (
                                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
                                  {[msg.location_name, msg.location_address].filter(Boolean).join(' — ')}
                                </div>
                              ) : null}
                              {msg.maps_url ? (
                                <a href={msg.maps_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px' }}>
                                  Open in Google Maps ↗
                                </a>
                              ) : (
                                <span>{msg.content}</span>
                              )}
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                        {msg.timestamp && (
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '6px', textAlign: 'right' }}>
                            {new Date(msg.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={registrationManualMessage}
                  onChange={(e) => setRegistrationManualMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendRegistrationManualMessage();
                    }
                  }}
                  disabled={!isRegistrationBotPaused || isSendingRegistrationManualMessage}
                  placeholder={isRegistrationBotPaused ? 'Type manual message to driver...' : 'Enable Manual Mode to send messages'}
                  style={{
                    flex: 1,
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    opacity: (!isRegistrationBotPaused || isSendingRegistrationManualMessage) ? 0.7 : 1
                  }}
                />
                <button
                  onClick={handleSendRegistrationManualMessage}
                  disabled={!isRegistrationBotPaused || !registrationManualMessage.trim() || isSendingRegistrationManualMessage}
                  style={{
                    padding: '10px 14px',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    color: '#fff',
                    background: (!isRegistrationBotPaused || !registrationManualMessage.trim() || isSendingRegistrationManualMessage) ? '#9ca3af' : '#2563eb',
                    cursor: (!isRegistrationBotPaused || !registrationManualMessage.trim() || isSendingRegistrationManualMessage) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSendingRegistrationManualMessage ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditRegModal && editRegRow && (
        <div
          className="modal-overlay"
          onClick={() => setShowEditRegModal(false)}
          style={{ zIndex: 3100 }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520, width: '90%' }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Edit Registration #{editRegRow.id}</h3>
              <button onClick={() => setShowEditRegModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {editRegError && (
                <div style={{ color: '#dc2626', background: '#fee2e2', padding: '10px 14px', borderRadius: '6px', fontSize: '14px' }}>{editRegError}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Name *</label>
                  <input
                    value={editRegName}
                    onChange={e => setEditRegName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Phone *</label>
                  <input
                    value={editRegPhone}
                    onChange={e => setEditRegPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Vehicle Name</label>
                  <input
                    value={editRegVehicle}
                    onChange={e => setEditRegVehicle(e.target.value)}
                    placeholder="e.g. Mahindra Bolero"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Vehicle Class</label>
                  <input
                    type="number"
                    value={editRegClass}
                    onChange={e => setEditRegClass(e.target.value)}
                    placeholder="Leave blank to auto-detect"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Base address</label>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                  {mapsLoaded
                    ? 'Type to search — select from the dropdown to auto-fill coordinates.'
                    : mapsLoadError
                      ? 'Maps unavailable; tap Get Coordinates to resolve from text.'
                      : 'Loading maps… You can still tap Get Coordinates.'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: mapsLoaded ? '1fr' : '1fr auto', gap: '10px', alignItems: 'center' }}>
                  <PlacesAutocompleteInput
                    value={editRegAddress}
                    onChange={setEditRegAddress}
                    onPlaceSelect={(place) => {
                      setEditRegAddress(place.address);
                      setEditRegBaseLat(place.lat);
                      setEditRegBaseLng(place.lng);
                    }}
                    placeholder="Type to search — select from dropdown..."
                    inputStyle={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%' }}
                  />
                  {!mapsLoaded && (
                    <button
                      type="button"
                      onClick={handleEditRegGeocodePlace}
                      disabled={isEditRegGeocoding}
                      style={{
                        whiteSpace: 'nowrap',
                        padding: '8px 14px',
                        border: 'none',
                        background: isEditRegGeocoding ? '#93c5fd' : '#4F46E5',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: isEditRegGeocoding ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      {isEditRegGeocoding ? '⏳ Resolving...' : 'Get Coordinates'}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Base lat</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editRegBaseLat}
                    onChange={e => setEditRegBaseLat(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Base lng</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editRegBaseLng}
                    onChange={e => setEditRegBaseLng(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button
                  onClick={() => setShowEditRegModal(false)}
                  style={{ padding: '8px 18px', border: '1px solid #d1d5db', background: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRegistration}
                  disabled={editRegSaving}
                  style={{ padding: '8px 18px', border: 'none', background: editRegSaving ? '#93c5fd' : '#2563eb', color: '#fff', borderRadius: '6px', cursor: editRegSaving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600' }}
                >
                  {editRegSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleDetails;