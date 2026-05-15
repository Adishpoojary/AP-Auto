import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  Badge, Button, Spinner, Modal, ModalHeader, ModalBody, ModalFooter
} from 'reactstrap';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { fetchDriverIssues, updateIssueStatus, fetchOnboardingAlerts, fetchRejectionLogs, blockDriver, fetchReportedIssuesCount } from '../../actions/driverIssues';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { useCity } from '../../contexts/CityContext';
import config from '../../config';
import s from './NotificationsNew.module.scss';

const Notifications = () => {
  const dispatch = useDispatch();
  const { isDateInRange, dateRange } = useDateFilter();
  const { selectedCities } = useCity();
  const { issues, loading, lastUpdated, onboardingAlerts, alertsLoading, rejectionLogs, rejectionsLoading, blocking } = useSelector(state => ({
    issues: state.driverIssues.issues || [],
    loading: state.driverIssues.loading,
    lastUpdated: state.driverIssues.lastUpdated,
    onboardingAlerts: state.driverIssues.onboardingAlerts || [],
    alertsLoading: state.driverIssues.alertsLoading,
    rejectionLogs: state.driverIssues.rejectionLogs || [],
    rejectionsLoading: state.driverIssues.rejectionsLoading,
    blocking: state.driverIssues.blocking
  }));

  const [pollingActive, setPollingActive] = useState(true);
  const [activeTab, setActiveTab] = useState('new_reports');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockDuration, setBlockDuration] = useState('end_of_day');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [clearingAll, setClearingAll] = useState(false);
  const [breakdownDetails, setBreakdownDetails] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // Load all issues and onboarding alerts in parallel
  const loadAllIssues = useCallback((silent = false) => {
    Promise.all([
      dispatch(fetchDriverIssues('all', silent, selectedCities)),
      dispatch(fetchOnboardingAlerts(null, silent)),
      ...(activeTab === 'rejection_logs' ? [dispatch(fetchRejectionLogs(silent))] : [])
    ]).catch(() => {}); // individual actions already dispatch failures
  }, [dispatch, selectedCities, activeTab]);

  // Initial load and polling
  useEffect(() => {
    loadAllIssues();

    const pollTimer = setInterval(() => {
      if (pollingActive) {
        loadAllIssues(true);
      }
    }, 5000);

    return () => clearInterval(pollTimer);
  }, [loadAllIssues, pollingActive]);

  // Update backend count for sidebar badge smoothly when date filter changes
  useEffect(() => {
    dispatch(fetchReportedIssuesCount());
  }, [dateRange, dispatch]);

  // Toggle polling
  const togglePolling = () => {
    setPollingActive(prev => {
      if (!prev) {
        toast.success('Live monitoring resumed', { autoClose: 2000 });
      } else {
        toast.info('Live monitoring paused', { autoClose: 2000 });
      }
      return !prev;
    });
  };

  // Helpers
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDriverStatus = (status) => {
    if (!status) return 'Issue Reported';
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getIssueIcon = (driverStatus) => {
    if (!driverStatus) return '⚠️';
    const status = driverStatus.toLowerCase();

    if (status.includes('accident') || status.includes('major')) return '🚨';
    if (status.includes('emergency') || status.includes('medical')) return '🏥';
    if (status.includes('breakdown') || status.includes('engine') || status.includes('tire') || status.includes('puncture')) return '🔧';
    if (status.includes('traffic') || status.includes('jam')) return '🚦';
    if (status.includes('weather') || status.includes('rain') || status.includes('flood')) return '🌧️';
    if (status.includes('police') || status.includes('rto') || status.includes('checking')) return '👮';
    if (status.includes('fuel')) return '⛽';
    if (status.includes('customer') || status.includes('address')) return '📍';
    if (status.includes('location_mismatch') || status.includes('location')) return '📍';
    if (status.includes('loading') || status.includes('unloading')) return '📦';
    if (status.includes('rest') || status.includes('break')) return '☕';
    return '⚠️';
  };

  const getSeverityClass = (driverStatus) => {
    if (!driverStatus) return 'medium';
    const status = driverStatus.toLowerCase();

    if (status.includes('accident') || status.includes('emergency') || status.includes('major') || status.includes('medical')) {
      return 'critical';
    }
    if (status.includes('breakdown') || status.includes('engine') || status.includes('blocked')) {
      return 'high';
    }
    return 'medium';
  };

  // Convert onboarding alerts to issue format for display
  const convertAlertsToIssues = (alerts) => {
    return alerts.map(alert => ({
      id: `alert_${alert.id}`,
      type: 'onboarding_alert',
      driver_id: alert.driver_id,
      driver_name: alert.driver_name || 'Unknown Driver',
      phone_number: alert.phone_number,
      message: `Missing ${alert.document_type.toUpperCase()}: ${alert.user_message || 'Driver said they don\'t have this document'}`,
      ops_status: alert.resolved ? 'resolved' : 'reported',
      created_at: alert.created_at,
      reported_at: alert.created_at,
      timestamp: alert.created_at,
      document_type: alert.document_type,
      issue_type: alert.issue_type,
      language: alert.language,
      is_alert: true,
      alert_id: alert.id,
      chat_history: alert.chat_history || []  // Include chat_history from API
    }));
  };

  // Get filtered issues based on active tab
  const getFilteredIssues = () => {
    // Merge driver issues and onboarding alerts
    const allIssues = [
      ...(issues || []),
      ...convertAlertsToIssues(onboardingAlerts || [])
    ];

    if (allIssues.length === 0) return [];

    let filtered;
    switch (activeTab) {
      case 'new_reports':
        filtered = allIssues.filter(i => !['resolved', 'closed'].includes(i.ops_status));
        break;
      case 'resolved':
        filtered = allIssues.filter(i => ['resolved', 'closed'].includes(i.ops_status));
        break;
      default:
        filtered = allIssues;
    }
    // Apply date filter on created_at or reported_at
    return filtered.filter(issue => {
      const issueDate = issue.created_at || issue.reported_at || issue.timestamp;
      return !issueDate || isDateInRange(issueDate);
    });
  };

  const getTabCounts = () => {
    const allIssues = [
      ...(issues || []),
      ...convertAlertsToIssues(onboardingAlerts || [])
    ];

    return {
      new_reports: allIssues.filter(i => !['resolved', 'closed'].includes(i.ops_status)).length,
      resolved: allIssues.filter(i => ['resolved', 'closed'].includes(i.ops_status)).length,
      rejection_logs: (rejectionLogs || []).length
    };
  };

  // Action handlers
  const showConfirmation = (issue, action, newStatus, message) => {
    setSelectedIssue(issue);
    setConfirmAction({ action, newStatus });
    setConfirmMessage(message);
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
    setConfirmMessage('');
  };

  const confirmAndExecute = async () => {
    if (!selectedIssue || !confirmAction) return;

    setProcessingId(selectedIssue.id);
    closeConfirmModal();

    try {
      // Optimistically update the status immediately for instant visual feedback
      const updatedIssue = { ...selectedIssue, ops_status: confirmAction.newStatus };
      if (showDetailModal) setSelectedIssue(updatedIssue);

      // Handle onboarding alerts - only "resolved" action is supported
      if (selectedIssue.is_alert) {
        if (confirmAction.newStatus === 'resolved') {
          const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
          const response = await fetch(`${config.opsApiBase}/onboarding-alerts/${selectedIssue.alert_id}/resolve`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes: 'Resolved via operations center' })
          });

          if (!response.ok) {
            throw new Error('Failed to resolve alert');
          }

          toast.success('Onboarding alert resolved', { autoClose: 2000 });
          loadAllIssues(true); // Refresh both issues and alerts
        } else {
          // For alerts, only "resolved" is a valid action
          toast.warning('Only "Resolve" action is available for onboarding alerts');
          if (showDetailModal) setSelectedIssue(selectedIssue); // Revert optimistic update
        }
        return;
      }

      // Regular driver issues - use existing flow
      await dispatch(updateIssueStatus(selectedIssue.id, confirmAction.newStatus));

      const messages = {
        'ops_acknowledged': 'Issue acknowledged',
        'ops_investigating': 'Investigation started',
        'ops_escalated': 'Issue escalated!',
        'resolved': 'Issue resolved',
        'closed': 'Issue closed'
      };

      toast.success(messages[confirmAction.newStatus] || 'Status updated', { autoClose: 2000 });

    } catch (error) {
      toast.error('Failed to update issue status');
      // Revert optimistic update on error
      if (showDetailModal) setSelectedIssue(selectedIssue);
    } finally {
      setProcessingId(null);
      if (!showDetailModal) setSelectedIssue(null);
    }
  };

  const handleAcknowledge = (issue) => {
    showConfirmation(issue, 'acknowledge', 'ops_acknowledged',
      `Acknowledge this issue from ${issue.driver_name || 'driver'}?`);
  };

  const handleResolve = (issue) => {
    showConfirmation(issue, 'resolve', 'resolved',
      `Mark this issue as RESOLVED?`);
  };

  const handleClose = (issue) => {
    showConfirmation(issue, 'close', 'closed',
      `Close this issue permanently?`);
  };

  // Block driver handler
  const handleBlockDriver = (driver) => {
    setSelectedDriver(driver);
    setBlockReason('');
    setBlockDuration('end_of_day');
    setShowBlockModal(true);
  };

  const closeBlockModal = () => {
    setShowBlockModal(false);
    setSelectedDriver(null);
    setBlockReason('');
    setBlockDuration('end_of_day');
  };

  const submitBlockDriver = async () => {
    if (!selectedDriver || !blockReason.trim()) {
      toast.error('Please enter a block reason');
      return;
    }

    try {
      // Calculate blocked_until timestamp
      let blockedUntil = new Date();
      switch (blockDuration) {
        case 'end_of_day':
          blockedUntil.setHours(23, 59, 59, 999);
          break;
        case 'tomorrow':
          blockedUntil.setDate(blockedUntil.getDate() + 1);
          blockedUntil.setHours(23, 59, 59, 999);
          break;
        case '3_days':
          blockedUntil.setDate(blockedUntil.getDate() + 3);
          blockedUntil.setHours(23, 59, 59, 999);
          break;
        case '1_week':
          blockedUntil.setDate(blockedUntil.getDate() + 7);
          blockedUntil.setHours(23, 59, 59, 999);
          break;
        default:
          blockedUntil.setHours(23, 59, 59, 999);
      }

      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const blockedBy = currentUser.id || 1;

      await dispatch(blockDriver(
        selectedDriver.driver_id,
        blockedBy,
        blockedUntil.toISOString(),
        blockReason
      ));

      toast.success(`Driver ${selectedDriver.driver_name} blocked until ${blockedUntil.toLocaleString()}`, {
        autoClose: 4000
      });
      closeBlockModal();
    } catch (error) {
      toast.error('Failed to block driver: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDelete = async (issue) => {
    if (!window.confirm(`Are you sure you want to permanently delete issue #${issue.id}?`)) {
      return;
    }

    setProcessingId(issue.id);

    try {
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      const response = await fetch(`${config.opsApiBase}/driver-issues/${issue.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Issue deleted successfully', { autoClose: 3000 });
        loadAllIssues(true);
      } else {
        toast.error('Failed to delete issue');
      }
    } catch (error) {
      toast.error('Error deleting issue');
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearAllResolved = async () => {
    const resolvedIssues = filteredIssues.filter(issue => !issue.is_alert);
    
    if (resolvedIssues.length === 0) {
      toast.info('No resolved issues to clear');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete all ${resolvedIssues.length} resolved issues? This action cannot be undone.`)) {
      return;
    }

    setClearingAll(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const token = localStorage.getItem('token') || 'mock-jwt-token-for-testing';
      
      // Delete all resolved issues
      for (const issue of resolvedIssues) {
        try {
          const response = await fetch(`${config.opsApiBase}/driver-issues/${issue.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} resolved issue${successCount !== 1 ? 's' : ''}`, { autoClose: 3000 });
        loadAllIssues(true);
        setCurrentPage(1); // Reset to first page
      }
      
      if (failCount > 0) {
        toast.warning(`Failed to delete ${failCount} issue${failCount !== 1 ? 's' : ''}`, { autoClose: 3000 });
      }
    } catch (error) {
      toast.error('Error clearing resolved issues');
    } finally {
      setClearingAll(false);
    }
  };

  // Open detail modal with chat
  // Handle opening the Breakdown Ops Agent Modal (separate from the regular detail modal)
  const openBreakdownAgentModal = async (issue) => {
    setSelectedIssue(issue);
    setShowBreakdownModal(true);
    setBreakdownLoading(true);
    try {
      const res = await axios.get(`${config.opsApiBase}/driver-issues/${issue.id}/breakdown-details`);
      setBreakdownDetails(res.data);
    } catch (error) {
      console.error('Error fetching breakdown details:', error);
      toast.error('Failed to load breakdown details');
      setBreakdownDetails(null);
    } finally {
      setBreakdownLoading(false);
    }
  };

  // Issue types that support the Ops Agent enriched view
  const agentSupportedTypes = ['vehicle_breakdown', 'service_refusal', 'accident', 'delay', 'location_mismatch_pickup', 'location_mismatch_drop', 'customer_issue', 'request_team_call'];

  const openDetailModal = async (issue) => {
    setSelectedIssue(issue);
    setShowDetailModal(true);

    // Fetch enriched details for all Ops Agent supported issue types
    if (agentSupportedTypes.includes(issue.driver_status)) {
      setBreakdownLoading(true);
      try {
        const res = await axios.get(`${config.opsApiBase}/driver-issues/${issue.id}/breakdown-details`);
        setBreakdownDetails(res.data);
      } catch (err) {
        console.error('Error fetching agent details:', err);
        setBreakdownDetails(null);
      } finally {
        setBreakdownLoading(false);
      }
    }
  };

  const closeBreakdownModal = () => {
    setShowBreakdownModal(false);
    setBreakdownDetails(null);
  };

  const closeDetailModal = () => {
    setSelectedIssue(null);
    setShowDetailModal(false);
    setBreakdownDetails(null);
  };

  // Parse chat message for special content
  const parseMessageContent = (message) => {
    if (!message) return { type: 'text', content: '' };

    if (message.includes('📸 Photo:') || message.includes('Photo:')) {
      const urlMatch = message.match(/https?:\/\/[^\s]+/);
      return {
        type: 'photo',
        content: message.replace(/📸 Photo:|Photo:/g, '').trim(),
        url: urlMatch ? urlMatch[0] : null
      };
    }

    // Check for location - handles formats like "location 13.351871794068 74.79182895273"
    if (message.includes('📍 Location:') || message.includes('Location:') || message.toLowerCase().startsWith('location ')) {
      const coordsMatch = message.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
      if (coordsMatch) {
        return {
          type: 'location',
          content: '📍 Location shared',
          lat: parseFloat(coordsMatch[1]),
          lng: parseFloat(coordsMatch[2])
        };
      }
    }

    const mapLinkMatch = message.match(/https:\/\/www\.google\.com\/maps[^\s]*/);
    if (mapLinkMatch) {
      return {
        type: 'map_link',
        content: message.replace(mapLinkMatch[0], '').trim(),
        url: mapLinkMatch[0]
      };
    }

    return { type: 'text', content: message };
  };

  // Parse chat message - handles both object and JSON string formats
  const parseChatMessage = (msg) => {
    if (!msg) return null;

    // If it's already an object with role/message, return as-is
    if (typeof msg === 'object' && (msg.role || msg.sender)) {
      return msg;
    }

    // If it's a string, try to parse as JSON
    if (typeof msg === 'string') {
      try {
        const parsed = JSON.parse(msg);
        if (parsed && (parsed.role || parsed.sender)) {
          return parsed;
        }
      } catch (e) {
        // Not valid JSON, treat as plain text message
        return { role: 'unknown', message: msg };
      }
    }

    return { role: 'unknown', message: String(msg) };
  };

  // Render chat message
  const renderChatMessage = (rawMsg, index) => {
    const msg = parseChatMessage(rawMsg);
    if (!msg) return null;

    const role = (msg.sender || msg.role || '').toLowerCase();
    const isBot = role === 'bot' || role === 'assistant' || role === 'system';
    const messageText = msg.message || msg.content || '';
    const parsed = parseMessageContent(messageText);
    const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <div key={index} className={`${s.chatMessage} ${isBot ? s.botMessage : s.driverMessage}`}>
        <div className={s.messageAvatar}>
          {isBot ? '🤖' : '👤'}
        </div>
        <div className={s.messageBubble}>
          <div className={s.messageHeader}>
            <span className={s.messageSender}>{isBot ? 'Trip Bot' : 'Driver'}</span>
            {timestamp && <span className={s.messageTime}>{timestamp}</span>}
          </div>
          <div className={s.messageContent}>
            {parsed.type === 'photo' && (
              <div className={s.photoMessage}>
                <span className={s.photoIcon}>📸</span>
                <span>Photo shared</span>
                {parsed.url && (
                  <a href={parsed.url} target="_blank" rel="noopener noreferrer" className={s.viewLink}>
                    View
                  </a>
                )}
              </div>
            )}
            {parsed.type === 'location' && (
              <div className={s.locationMessage}>
                <span className={s.locationIcon}>📍</span>
                <span>Location shared</span>
                <a
                  href={`https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={s.viewLink}
                >
                  View Map
                </a>
              </div>
            )}
            {parsed.type === 'map_link' && (
              <div className={s.mapLinkMessage}>
                <span>{parsed.content}</span>
                <a href={parsed.url} target="_blank" rel="noopener noreferrer" className={s.mapButton}>
                  🗺️ Open Map
                </a>
              </div>
            )}
            {parsed.type === 'text' && (
              <span>{parsed.content}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Get action buttons for a specific tab
  const getActionButtons = (issue, tab) => {
    const isProcessing = processingId === issue.id;

    // Onboarding alerts - only show Resolve button
    if (issue.is_alert) {
      if (tab === 'new_reports' && !issue.resolved) {
        return (
          <button className={`${s.actionBtn} ${s.resolveBtn}`} onClick={(e) => { e.stopPropagation(); handleResolve(issue); }} disabled={isProcessing}>
            {isProcessing ? <Spinner size="sm" /> : 'Resolve'}
          </button>
        );
      }
      return null; // No actions for resolved alerts
    }

    // Regular driver issues
    const buttons = {
      new_reports: (
        <>
          {agentSupportedTypes.includes(issue.driver_status) && (
            <button 
              className={s.agentBtn} 
              onClick={(e) => { e.stopPropagation(); openBreakdownAgentModal(issue); }}
              disabled={isProcessing}
              title="Ops Agent - Issue Details"
            >
              🤖 Ops Agent
            </button>
          )}
          <button className={`${s.actionBtn} ${s.resolveBtn}`} onClick={(e) => { e.stopPropagation(); handleResolve(issue); }} disabled={isProcessing}>
            {isProcessing ? <Spinner size="sm" /> : 'Resolve'}
          </button>
        </>
      ),
      resolved: (
        <button className={`${s.actionBtn} ${s.deleteBtn}`} onClick={(e) => { e.stopPropagation(); handleDelete(issue); }} disabled={isProcessing}>
          {isProcessing ? <Spinner size="sm" /> : 'Clear Issue'}
        </button>
      )
    };

    return buttons[tab] || null;
  };

  const filteredIssues = getFilteredIssues();
  const counts = getTabCounts();
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIssues = filteredIssues.slice(startIndex, endIndex);
  
  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <h1 className={s.title}>
            <span className={s.titleIcon}>🚨</span>
            Operations Center
          </h1>
          <p className={s.subtitle}>Real-time Driver Issue Management</p>
        </div>
        <div className={s.headerRight}>
          <div className={`${s.liveIndicator} ${pollingActive ? s.active : s.paused}`}>
            <span className={s.liveDot}></span>
            <span className={s.liveText}>{pollingActive ? 'LIVE' : 'PAUSED'}</span>
          </div>
          <button className={s.controlBtn} onClick={togglePolling}>
            {pollingActive ? '⏸️ Pause' : '▶️ Resume'}
          </button>
          <button className={s.refreshBtn} onClick={() => loadAllIssues()} disabled={loading || alertsLoading}>
            {(loading || alertsLoading) ? <Spinner size="sm" /> : '🔄'}
          </button>
          <span className={s.lastUpdate}>
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--:--'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={s.tabsWrapper}>
        <div className={s.tabs}>
          <button className={`${s.tab} ${activeTab === 'new_reports' ? s.active : ''}`} onClick={() => setActiveTab('new_reports')}>
            <span className={s.tabLabel}>New Reports</span>
          </button>
          <button className={`${s.tab} ${activeTab === 'resolved' ? s.active : ''}`} onClick={() => setActiveTab('resolved')}>
            <span className={s.tabLabel}>Resolved</span>
          </button>
          <button className={`${s.tab} ${activeTab === 'rejection_logs' ? s.active : ''}`} onClick={() => setActiveTab('rejection_logs')}>
            <span className={s.tabLabel}>Rejection Logs</span>
          </button>
        </div>
        {activeTab === 'resolved' && filteredIssues.length > 0 && (
          <div className={s.clearAllWrapper}>
            <button 
              className={s.clearAllBtn} 
              onClick={handleClearAllResolved}
              disabled={clearingAll}
            >
              {clearingAll ? (
                <>
                  <Spinner size="sm" style={{ marginRight: '8px' }} />
                  Clearing...
                </>
              ) : (
                'Clear All'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Issues List */}
      <div className={s.issuesContainer}>
        {activeTab === 'rejection_logs' ? (
          /* Rejection Logs View */
          rejectionsLoading && rejectionLogs.length === 0 ? (
            <div className={s.loadingState}>
              <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
              <p>Loading rejection logs...</p>
            </div>
          ) : rejectionLogs.length === 0 ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>✓</div>
              <h3>No Rejections Today</h3>
              <p>All clear! No driver rejections logged today.</p>
            </div>
          ) : (
            <div className={s.issuesList}>
              {rejectionLogs.map((log, idx) => (
                <div key={idx} className={s.issueCard}>
                  <div className={s.issueHeader}>
                    <div className={s.issueTitle}>
                      <span className={s.issueIcon}>👤</span>
                      <div>
                        <h4>{log.driver_name}</h4>
                        <p className={s.issueSubtitle}>{log.driver_phone}</p>
                      </div>
                    </div>
                    <div className={s.issueMeta}>
                      {log.is_manually_blocked ? (
                        <Badge color="danger">BLOCKED</Badge>
                      ) : log.rejection_count >= 5 ? (
                        <Badge color="warning">HIGH RISK</Badge>
                      ) : (
                        <Badge color="secondary">Active</Badge>
                      )}
                    </div>
                  </div>

                  <div className={s.issueBody}>
                    <div className={s.issueDetails}>
                      <div className={s.detailRow}>
                        <span className={s.detailLabel}>Vehicle:</span>
                        <span className={s.detailValue}>{log.vehicle_registration}</span>
                      </div>
                      <div className={s.detailRow}>
                        <span className={s.detailLabel}>Rejections Today:</span>
                        <span className={`${s.detailValue} ${log.rejection_count >= 5 ? s.dangerText : ''}`}>
                          <strong>{log.rejection_count}</strong> trip{log.rejection_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className={s.detailRow}>
                        <span className={s.detailLabel}>Last Rejection:</span>
                        <span className={s.detailValue}>{formatTimeAgo(log.last_rejection_time)}</span>
                      </div>
                      {log.is_manually_blocked && (
                        <>
                          <div className={s.detailRow}>
                            <span className={s.detailLabel}>Blocked Until:</span>
                            <span className={s.detailValue}>
                              {log.blocked_until ? new Date(log.blocked_until).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div className={s.detailRow}>
                            <span className={s.detailLabel}>Reason:</span>
                            <span className={s.detailValue}>{log.block_reason || 'N/A'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={s.issueActions}>
                    {!log.is_manually_blocked ? (
                      <button
                        className={`${s.actionBtn} ${s.blockBtn}`}
                        onClick={() => handleBlockDriver(log)}
                        disabled={blocking}
                      >
                        {blocking ? <Spinner size="sm" /> : 'Block Driver'}
                      </button>
                    ) : (
                      <span className={s.blockedLabel}>✓ Blocked by ops team</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Existing Issues View */
          (loading || alertsLoading) && filteredIssues.length === 0 ? (
            <div className={s.loadingState}>
              <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
              <p>Loading issues...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>
                {activeTab === 'new_reports' ? '✓' : '📋'}
              </div>
              <h3>No {activeTab === 'new_reports' ? 'New Reports' : 'Resolved'} Issues</h3>
              <p>
                {activeTab === 'new_reports' && 'All clear! No new driver issues.'}
                {activeTab === 'resolved' && 'Resolved issues will appear here.'}
              </p>
            </div>
          ) : (
            <div className={s.issuesList}>
              {paginatedIssues.map(issue => {
                // Handle onboarding alerts differently
                if (issue.is_alert) {
                  const statusClass = issue.ops_status === 'resolved' ? 'resolved' : 'reported';
                  return (
                    <div
                      key={issue.id}
                      className={`${s.issueRow} ${s.medium} ${s[statusClass]}`}
                      onClick={() => openDetailModal(issue)}
                    >
                      <div className={s.issueIcon}>
                        📄
                      </div>

                      <div className={s.issueMain}>
                        <div className={s.issueTitle}>
                          Missing {issue.document_type?.toUpperCase() || 'Document'}
                          <Badge color="warning" style={{ marginLeft: '8px', fontSize: '0.7rem' }}>Onboarding</Badge>
                        </div>
                        <div className={s.issueMeta}>
                          <span className={s.driverName}>{issue.driver_name || 'Unknown Driver'}</span>
                          <span className={s.separator}>•</span>
                          <span className={s.bookingId}>{issue.phone_number}</span>
                          <span className={s.separator}>•</span>
                          <span className={s.time}>{formatTimeAgo(issue.created_at)}</span>
                        </div>
                        <div className={s.issueMessage} style={{ marginTop: '4px', fontSize: '0.9rem', color: '#666' }}>
                          {issue.message}
                        </div>
                      </div>

                      <div className={s.issueColumn}>
                        <span className={s.issueLabel}>Document</span>
                        <span className={s.issueValue}>{issue.document_type?.toUpperCase() || 'N/A'}</span>
                      </div>

                      <div className={s.issueBadges}>
                        <Badge className={`${s.severityBadge} ${s.medium}`}>
                          ONBOARDING
                        </Badge>
                      </div>

                      <div className={s.issueActions} onClick={e => e.stopPropagation()}>
                        {issue.phone_number && (
                          <a href={`tel:${issue.phone_number}`} className={s.callBtn}>
                            📞
                          </a>
                        )}
                        {getActionButtons(issue, activeTab)}
                      </div>

                      <div className={s.issueId}>#{issue.alert_id}</div>
                    </div>
                  );
                }

                // Regular driver issues
                const severity = getSeverityClass(issue.driver_status);
                const statusClass = issue.ops_status === 'ops_investigating' ? 'investigating' : 'reported';

                return (
                  <div
                    key={issue.id}
                    className={`${s.issueRow} ${s[severity]} ${s[statusClass]}`}
                    onClick={() => openDetailModal(issue)}
                  >
                    <div className={s.issueIcon}>
                      {getIssueIcon(issue.driver_status)}
                    </div>

                    <div className={s.issueMain}>
                      <div className={s.issueTitle}>
                        {formatDriverStatus(issue.driver_status)}
                      </div>
                      <div className={s.issueMeta}>
                        <span className={s.driverName}>{issue.driver_name || 'Unknown'}</span>
                        <span className={s.separator}>•</span>
                        <span className={s.bookingId}>#{issue.booking_id || issue.trip_id}</span>
                        <span className={s.separator}>•</span>
                        <span className={s.time}>{formatTimeAgo(issue.created_at)}</span>
                      </div>
                    </div>

                    <div className={s.issueLocation}>
                      <div className={s.locationPoint}>
                        <span className={`${s.dot} ${s.pickup}`}></span>
                        <span className={s.locationText}>{issue.pickup_location ? issue.pickup_location.split(',')[0] : 'N/A'}</span>
                      </div>
                      <div className={s.locationArrow}>→</div>
                      <div className={s.locationPoint}>
                        <span className={`${s.dot} ${s.drop}`}></span>
                        <span className={s.locationText}>{issue.drop_location ? issue.drop_location.split(',')[0] : 'N/A'}</span>
                      </div>
                    </div>

                    <div className={s.issueColumn}>
                      <span className={s.issueLabel}>Issue</span>
                      <span className={s.issueValue}>{issue.driver_status || 'N/A'}</span>
                    </div>

                    <div className={s.issueBadges}>
                      <Badge className={`${s.severityBadge} ${s[severity]}`}>
                        {severity.toUpperCase()}
                      </Badge>
                      <Badge className={s.statusBadge}>
                        {issue.trip_status || 'N/A'}
                      </Badge>
                    </div>

                    <div className={s.issueActions} onClick={e => e.stopPropagation()}>
                      {issue.driver_phone && (
                        <a href={`tel:${issue.driver_phone}`} className={s.callBtn}>
                          📞
                        </a>
                      )}
                      {issue.current_latitude && issue.current_longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${issue.current_latitude},${issue.current_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={s.mapBtn}
                        >
                          📍
                        </a>
                      )}
                      {getActionButtons(issue, activeTab)}
                    </div>

                    <div className={s.issueId}>#{issue.id}</div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className={s.pagination}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className={s.pageBtn}
          >
            <i className="fa fa-chevron-left" /> Previous
          </button>
          <span className={s.pageInfo}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className={s.pageBtn}
          >
            Next <i className="fa fa-chevron-right" />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={showConfirmModal} toggle={closeConfirmModal} centered className={s.confirmModal}>
        <ModalHeader toggle={closeConfirmModal}>
          Confirm Action
        </ModalHeader>
        <ModalBody>
          <p className={s.confirmText}>{confirmMessage}</p>
          {selectedIssue && (
            <div className={s.confirmIssueInfo}>
              <strong>Issue #{selectedIssue.id}</strong>
              <span>{formatDriverStatus(selectedIssue.driver_status)}</span>
              <span>Driver: {selectedIssue.driver_name}</span>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={closeConfirmModal}>Cancel</Button>
          <Button color="primary" onClick={confirmAndExecute}>Confirm</Button>
        </ModalFooter>
      </Modal>

      {/* Detail Modal with Chat History */}
      <Modal isOpen={showDetailModal} toggle={closeDetailModal} size="xl" className={s.detailModal}>
        <ModalHeader toggle={closeDetailModal}>
          <div className={s.modalHeaderContent}>
            <span className={s.modalIcon}>
              {selectedIssue && (selectedIssue.is_alert ? '📄' : getIssueIcon(selectedIssue.driver_status))}
            </span>
            <span className={s.modalTitle}>
              {selectedIssue && (selectedIssue.is_alert
                ? `Missing ${selectedIssue.document_type?.toUpperCase() || 'Document'}`
                : formatDriverStatus(selectedIssue.driver_status))}
            </span>
            {selectedIssue && (
              <Badge className={`${s.modalBadge} ${selectedIssue.is_alert ? s.medium : s[getSeverityClass(selectedIssue.driver_status)]}`}>
                {selectedIssue.is_alert ? 'ONBOARDING' : getSeverityClass(selectedIssue.driver_status).toUpperCase()}
              </Badge>
            )}
          </div>
        </ModalHeader>
        <ModalBody className={s.modalBody}>
          {selectedIssue && (
            <div className={s.splitView}>
              {/* Left Panel - Issue Details */}
              <div className={s.detailsPanel}>
                <h3 className={s.panelTitle}>Issue Details</h3>

                <div className={s.detailSection}>
                  <h4>👤 Driver Information</h4>
                  <div className={s.detailGrid}>
                    <div className={s.detailItem}>
                      <span className={s.label}>Name</span>
                      <span className={s.value}>{selectedIssue.driver_name || 'Unknown'}</span>
                    </div>
                    <div className={s.detailItem}>
                      <span className={s.label}>Phone</span>
                      <a href={`tel:${selectedIssue.phone_number || selectedIssue.driver_phone}`} className={s.phoneLink}>
                        {selectedIssue.phone_number || selectedIssue.driver_phone || 'N/A'}
                      </a>
                    </div>
                  </div>
                </div>

                {selectedIssue.is_alert ? (
                  // Onboarding Alert Details
                  <>
                    <div className={s.detailSection}>
                      <h4>📄 Document Information</h4>
                      <div className={s.detailGrid}>
                        <div className={s.detailItem}>
                          <span className={s.label}>Document Type</span>
                          <Badge className={s.tripStatusBadge}>{selectedIssue.document_type?.toUpperCase() || 'N/A'}</Badge>
                        </div>
                        <div className={s.detailItem}>
                          <span className={s.label}>Issue Type</span>
                          <Badge className={s.tripStatusBadge}>{selectedIssue.issue_type || 'missing'}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className={s.detailSection}>
                      <h4>💬 Driver Message</h4>
                      <div className={s.issueDetail}>
                        <span className={s.issueDetailValue}>{selectedIssue.message || 'N/A'}</span>
                      </div>
                    </div>

                    <div className={s.detailSection}>
                      <h4>🌐 Language</h4>
                      <div className={s.detailGrid}>
                        <div className={s.detailItem}>
                          <span className={s.label}>Language</span>
                          <span className={s.value}>{selectedIssue.language || 'english'}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : agentSupportedTypes.includes(selectedIssue.driver_status) ? (
                  // Ops Agent Enriched Details (all supported issue types)
                  <>
                    {breakdownLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Spinner size="sm" /> Loading details...
                      </div>
                    ) : breakdownDetails ? (
                      <>
                        {/* Issue Message Banner */}
                        <div className={s.breakdownMessage}>
                          <span className={s.breakdownIcon}>
                            {breakdownDetails.issue_type === 'accident' ? '🚑' :
                             breakdownDetails.issue_type === 'service_refusal' ? '⛔' :
                             breakdownDetails.issue_type === 'delay' ? '⏰' :
                             breakdownDetails.issue_type.includes('location_mismatch') ? '📍' :
                             breakdownDetails.issue_type === 'customer_issue' ? '👤' :
                             breakdownDetails.issue_type === 'request_team_call' ? '📞' : '🚨'}
                          </span>
                          <span>{breakdownDetails.message}</span>
                        </div>

                        {/* Driver Information — show for all types */}
                        <div className={s.detailSection}>
                          <h4>🚛 Driver Information</h4>
                          <div className={s.detailGrid}>
                            <div className={s.detailItem}>
                              <span className={s.label}>Vehicle ID</span>
                              <span className={s.value}>{breakdownDetails.driver_info.vehicle_id || 'N/A'}</span>
                            </div>
                            <div className={s.detailItem}>
                              <span className={s.label}>Registration</span>
                              <span className={s.value}>{breakdownDetails.driver_info.registration_no || 'N/A'}</span>
                            </div>
                            <div className={s.detailItem}>
                              <span className={s.label}>Driver Name</span>
                              <span className={s.value}>{breakdownDetails.driver_info.driver_name}</span>
                            </div>
                            <div className={s.detailItem}>
                              <span className={s.label}>Phone</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <a href={`tel:${breakdownDetails.driver_info.phone}`} className={s.phoneLink}>
                                  {breakdownDetails.driver_info.phone}
                                </a>
                                <a href={`tel:${breakdownDetails.driver_info.phone}`} className={s.callBtnInline}>📞</a>
                              </div>
                            </div>
                            <div className={s.detailItem}>
                              <span className={s.label}>Trip Accepted Time</span>
                              <span className={s.value}>
                                {breakdownDetails.driver_info.trip_accepted_time
                                  ? new Date(breakdownDetails.driver_info.trip_accepted_time).toLocaleString()
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Customer Information — show for all types EXCEPT request_team_call */}
                        {breakdownDetails.issue_type !== 'request_team_call' && (
                          <div className={s.detailSection}>
                            <h4>👤 Customer Information</h4>
                            <div className={s.detailGrid}>
                              <div className={s.detailItem}>
                                <span className={s.label}>Customer Name</span>
                                <span className={s.value}>{breakdownDetails.customer_info.customer_name}</span>
                              </div>
                              <div className={s.detailItem}>
                                <span className={s.label}>Mobile</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <a href={`tel:${breakdownDetails.customer_info.mobile}`} className={s.phoneLink}>
                                    {breakdownDetails.customer_info.mobile}
                                  </a>
                                  <a href={`tel:${breakdownDetails.customer_info.mobile}`} className={s.callBtnInline}>📞</a>
                                </div>
                              </div>
                              <div className={s.detailItem}>
                                <span className={s.label}>Booking Time</span>
                                <span className={s.value}>
                                  {breakdownDetails.customer_info.booking_time
                                    ? new Date(breakdownDetails.customer_info.booking_time).toLocaleString()
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Replacement Vehicle Suggestions — show for breakdown, accident, service_refusal */}
                        {['vehicle_breakdown', 'accident', 'service_refusal'].includes(breakdownDetails.issue_type) && breakdownDetails.replacement_vehicles && breakdownDetails.replacement_vehicles.length > 0 && (
                          <div className={s.detailSection}>
                            <h4>🔄 Replacement Vehicle Suggestions</h4>
                            <div className={s.replacementTable}>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Vehicle</th>
                                    <th>Driver</th>
                                    <th>Phone</th>
                                    <th>Class</th>
                                    <th>Distance</th>
                                    <th>Match</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {breakdownDetails.replacement_vehicles.map((rv, idx) => (
                                    <tr key={idx}>
                                      <td>{rv.registration_no || `#${rv.vehicle_id}`}</td>
                                      <td>{rv.driver_name}</td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span>{rv.phone}</span>
                                          <a href={`tel:${rv.phone}`} className={s.callBtnInline}>📞</a>
                                        </div>
                                      </td>
                                      <td>{rv.vehicle_class}</td>
                                      <td>{rv.distance_km} km</td>
                                      <td>
                                        <Badge className={`${s.matchBadge} ${rv.match_type === 'same_class' ? s.sameClass : s.higherClass}`}>
                                          {rv.match_type === 'same_class' ? 'Same Class' : '+1 Class'}
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {['vehicle_breakdown', 'accident', 'service_refusal'].includes(breakdownDetails.issue_type) && breakdownDetails.replacement_vehicles && breakdownDetails.replacement_vehicles.length === 0 && (
                          <div className={s.detailSection}>
                            <h4>🔄 Replacement Vehicle Suggestions</h4>
                            <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
                              {breakdownDetails.trip_status && ['loaded', 'en_route_drop', 'at_drop', 'completed'].includes(breakdownDetails.trip_status)
                                ? '⚠️ Trip is already loaded — replacement not applicable'
                                : 'No idle vehicles available for replacement at this time'}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
                        Failed to load details
                      </div>
                    )}
                  </>
                ) : (
                  // Regular Driver Issue Details
                  <>
                    <div className={s.detailSection}>
                      <h4>🚛 Trip Information</h4>
                      <div className={s.detailGrid}>
                        <div className={s.detailItem}>
                          <span className={s.label}>Booking ID</span>
                          <span className={s.value}>#{selectedIssue.booking_id || selectedIssue.trip_id || 'N/A'}</span>
                        </div>
                        <div className={s.detailItem}>
                          <span className={s.label}>Trip Status</span>
                          <Badge className={s.tripStatusBadge}>{selectedIssue.trip_status || 'N/A'}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className={s.detailSection}>
                      <h4>⚠️ Issue</h4>
                      <div className={s.issueDetail}>
                        <span className={s.issueDetailValue}>{selectedIssue.driver_status || 'N/A'}</span>
                      </div>
                    </div>

                    <div className={s.detailSection}>
                      <h4>📍 Route</h4>
                      <div className={s.routeCard}>
                        <div className={s.routePoint}>
                          <span className={`${s.routeDot} ${s.pickup}`}></span>
                          <div className={s.routeInfo}>
                            <span className={s.routeLabel}>PICKUP</span>
                            <span className={s.routeAddress}>{selectedIssue.pickup_location || 'N/A'}</span>
                          </div>
                        </div>
                        <div className={s.routeLine}></div>
                        <div className={s.routePoint}>
                          <span className={`${s.routeDot} ${s.drop}`}></span>
                          <div className={s.routeInfo}>
                            <span className={s.routeLabel}>DROP</span>
                            <span className={s.routeAddress}>{selectedIssue.drop_location || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Location Mismatch Details - only for location_mismatch issues */}
                    {selectedIssue.driver_status?.includes('location_mismatch') &&
                      selectedIssue.mismatch_driver_address && (
                        <div className={s.detailSection}>
                          <h4>🗺️ Location Mismatch Details</h4>
                          <div className={s.mismatchCard}>
                            <div className={s.mismatchRow}>
                              <span className={s.mismatchLabel}>Driver Was At</span>
                              <div className={s.mismatchValue}>
                                <span className={s.mismatchAddress}>
                                  {selectedIssue.mismatch_driver_address}
                                </span>
                                <a
                                  href={`https://www.google.com/maps?q=${selectedIssue.mismatch_driver_lat},${selectedIssue.mismatch_driver_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={s.mismatchMapLink}
                                >
                                  📍 View on Map
                                </a>
                              </div>
                            </div>
                            <div className={s.mismatchDivider}></div>
                            <div className={s.mismatchRow}>
                              <span className={s.mismatchLabel}>
                                Expected {selectedIssue.driver_status === 'location_mismatch_pickup' ? 'Pickup' : 'Drop'} Location
                              </span>
                              <div className={s.mismatchValue}>
                                <span className={s.mismatchAddress}>
                                  {selectedIssue.mismatch_expected_address || 'N/A'}
                                </span>
                                {selectedIssue.mismatch_expected_lat && (
                                  <a
                                    href={`https://www.google.com/maps?q=${selectedIssue.mismatch_expected_lat},${selectedIssue.mismatch_expected_lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={s.mismatchMapLink}
                                  >
                                    📍 View on Map
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className={s.mismatchDivider}></div>
                            <div className={s.mismatchRow}>
                              <span className={s.mismatchLabel}>Distance Off</span>
                              <span className={s.mismatchDistance}>
                                ⚠️ {selectedIssue.mismatch_distance_km} km away from expected location
                              </span>
                            </div>
                            {selectedIssue.mismatch_driver_lat && selectedIssue.mismatch_expected_lat && (
                              <a
                                href={`https://www.google.com/maps/dir/${selectedIssue.mismatch_driver_lat},${selectedIssue.mismatch_driver_lng}/${selectedIssue.mismatch_expected_lat},${selectedIssue.mismatch_expected_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={s.mismatchCompareBtn}
                              >
                                🗺️ Compare Both Locations on Map
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Quick Actions */}
                    <div className={s.quickActions}>
                      {selectedIssue.current_latitude && selectedIssue.current_longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${selectedIssue.current_latitude},${selectedIssue.current_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={s.quickActionBtn}
                        >
                          📍 View Location
                        </a>
                      )}
                      {selectedIssue.driver_phone && (
                        <a href={`tel:${selectedIssue.driver_phone}`} className={s.quickActionBtn}>
                          📞 Call Driver
                        </a>
                      )}
                    </div>
                  </>
                )}

                <div className={s.detailSection}>
                  <h4>⏰ Timeline</h4>
                  <div className={s.detailGrid}>
                    <div className={s.detailItem}>
                      <span className={s.label}>Reported</span>
                      <span className={s.value}>{formatTimeAgo(selectedIssue.created_at)}</span>
                    </div>
                    <div className={s.detailItem}>
                      <span className={s.label}>Status</span>
                      <Badge className={s.statusBadge}>
                        {selectedIssue.is_alert
                          ? (selectedIssue.ops_status === 'resolved' ? 'Resolved' : 'Reported')
                          : formatDriverStatus(selectedIssue.ops_status)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Quick Actions for Alerts */}
                {selectedIssue.is_alert && (
                  <div className={s.quickActions}>
                    {selectedIssue.phone_number && (
                      <a href={`tel:${selectedIssue.phone_number}`} className={s.quickActionBtn}>
                        📞 Call Driver
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Right Panel - Chat History */}
              <div className={s.chatPanel}>
                <h3 className={s.panelTitle}>
                  💬 Driver Chat History
                  {selectedIssue.chat_history && selectedIssue.chat_history.length > 0 && (
                    <span className={s.messageCount}>{selectedIssue.chat_history.length} messages</span>
                  )}
                </h3>

                <div className={s.chatContainer}>
                  {selectedIssue.chat_history && selectedIssue.chat_history.length > 0 ? (
                    <div className={s.chatMessages}>
                      {selectedIssue.chat_history.map((msg, index) => renderChatMessage(msg, index))}
                    </div>
                  ) : (
                    <div className={s.noChatHistory}>
                      <span className={s.noChatIcon}>💬</span>
                      <p>
                        {selectedIssue.is_alert
                          ? 'Chat history will be available soon'
                          : 'No chat history available for this trip'}
                      </p>
                      {selectedIssue.is_alert && (
                        <div className={s.alertInfoBox} style={{ marginTop: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                          <div style={{ marginBottom: '8px' }}>
                            <strong>Alert ID:</strong> #{selectedIssue.alert_id}
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <strong>Document:</strong> {selectedIssue.document_type?.toUpperCase() || 'N/A'}
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <strong>Issue Type:</strong> {selectedIssue.issue_type || 'missing'}
                          </div>
                          <div>
                            <strong>Language:</strong> {selectedIssue.language || 'english'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter className={s.modalFooter}>
          <div className={s.footerActions}>
            {selectedIssue && activeTab === 'new_reports' && (
              <Button color="success" onClick={() => { closeDetailModal(); handleResolve(selectedIssue); }}>
                ✅ Resolve
              </Button>
            )}
            {selectedIssue && activeTab === 'resolved' && !selectedIssue.is_alert && (
              // Only show delete for regular issues, not alerts
              <Button color="danger" onClick={() => { closeDetailModal(); handleDelete(selectedIssue); }}>
                🗑️ Clear Issue
              </Button>
            )}
          </div>
          <Button color="secondary" onClick={closeDetailModal}>Close</Button>
        </ModalFooter>
      </Modal>

      {/* Breakdown Ops Agent Modal */}
      <Modal isOpen={showBreakdownModal} toggle={closeBreakdownModal} size="md" className={s.detailModal}>
        <ModalHeader toggle={closeBreakdownModal}>
          <div className={s.modalHeaderContent}>
            <span className={s.modalIcon}>
              {breakdownDetails?.issue_type === 'accident' ? '🚑' :
               breakdownDetails?.issue_type === 'service_refusal' ? '⛔' :
               breakdownDetails?.issue_type === 'delay' ? '⏰' :
               breakdownDetails?.issue_type.includes('location_mismatch') ? '📍' :
               breakdownDetails?.issue_type === 'customer_issue' ? '👤' :
               breakdownDetails?.issue_type === 'request_team_call' ? '📞' : '🔧'}
            </span>
            <span className={s.modalTitle}>
              {breakdownDetails?.issue_type === 'accident' ? 'Accident' :
               breakdownDetails?.issue_type === 'service_refusal' ? 'Service Refusal' :
               breakdownDetails?.issue_type === 'delay' ? 'Major Delay' :
               breakdownDetails?.issue_type.includes('location') ? 'Location Issue' :
               breakdownDetails?.issue_type === 'customer_issue' ? 'Customer Issue' :
               breakdownDetails?.issue_type === 'request_team_call' ? 'Team Call Request' : 'Vehicle Breakdown'} Ops Agent
            </span>
            {selectedIssue && (
              <span className={`${s.modalBadge} ${
                selectedIssue.severity === 'critical' ? s.critical : 
                selectedIssue.severity === 'high' ? s.high : s.medium
              }`}>
                {(selectedIssue.severity || 'medium').toUpperCase()}
              </span>
            )}
          </div>
        </ModalHeader>
        <ModalBody style={{ padding: '20px', background: '#f8fafc', overflowY: 'auto', maxHeight: '75vh' }}>
          {breakdownLoading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
              <p className="mt-2 text-muted">Loading details...</p>
            </div>
          ) : breakdownDetails ? (
            <div>
              {/* Issue Message Box */}
              <div style={{ 
                background: breakdownDetails.issue_type === 'request_team_call' ? '#eff6ff' : '#fef2f2', 
                border: `1px solid ${breakdownDetails.issue_type === 'request_team_call' ? '#93c5fd' : '#fca5a5'}`, 
                padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' 
              }}>
                <span style={{ fontSize: '20px' }}>
                  {breakdownDetails.issue_type === 'accident' ? '🚑' :
                   breakdownDetails.issue_type === 'service_refusal' ? '⛔' :
                   breakdownDetails.issue_type === 'delay' ? '⏰' :
                   breakdownDetails.issue_type.includes('location_mismatch') ? '📍' :
                   breakdownDetails.issue_type === 'customer_issue' ? '👤' :
                   breakdownDetails.issue_type === 'request_team_call' ? '📞' : '🚨'}
                </span>
                <div>
                  <div style={{ color: breakdownDetails.issue_type === 'request_team_call' ? '#1e40af' : '#991b1b', fontWeight: '600', marginBottom: '4px' }}>
                    {breakdownDetails.message || 'Issue details unavailable.'}
                  </div>
                </div>
              </div>

              {/* Driver Side Box */}
              <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid #d97706' }}>
                <h6 style={{ marginBottom: '12px', color: '#92400e', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🚛</span> Driver Side
                </h6>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 8px', fontWeight: '600', width: '140px' }}>Driver Name:</td>
                      <td style={{ padding: '4px 8px' }}>{breakdownDetails.driver_info?.driver_name}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px', fontWeight: '600' }}>Phone:</td>
                      <td style={{ padding: '4px 8px' }}>
                        <a href={`tel:${breakdownDetails.driver_info?.phone}`} style={{ textDecoration: 'none', color: '#0284c7' }}>
                          {breakdownDetails.driver_info?.phone}
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px', fontWeight: '600' }}>Vehicle ID:</td>
                      <td style={{ padding: '4px 8px' }}>{breakdownDetails.driver_info?.vehicle_id}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px', fontWeight: '600' }}>Vehicle Reg:</td>
                      <td style={{ padding: '4px 8px' }}>{breakdownDetails.driver_info?.registration_no}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px', fontWeight: '600' }}>Accepted At:</td>
                      <td style={{ padding: '4px 8px' }}>
                        {breakdownDetails.driver_info?.trip_accepted_time ? new Date(breakdownDetails.driver_info.trip_accepted_time).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-3">
                  <a href={`tel:${breakdownDetails.driver_info?.phone}`} className="btn btn-sm" style={{ background: '#10b981', color: 'white', fontWeight: '600', padding: '6px 12px', borderRadius: '6px' }}>
                    <i className="fa fa-phone mr-2" /> Call Driver
                  </a>
                </div>
              </div>

              {/* Customer Side Box — hide for request_team_call */}
              {breakdownDetails.issue_type !== 'request_team_call' && breakdownDetails.customer_info?.customer_name && (
                <div style={{ background: '#dbeafe', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid #3b82f6' }}>
                  <h6 style={{ marginBottom: '12px', color: '#1e40af', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>👤</span> Customer Side
                  </h6>
                  <table style={{ width: '100%', fontSize: '13px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 8px', fontWeight: '600', width: '140px' }}>Customer Name:</td>
                        <td style={{ padding: '4px 8px' }}>{breakdownDetails.customer_info.customer_name}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 8px', fontWeight: '600' }}>Phone:</td>
                        <td style={{ padding: '4px 8px' }}>
                          <a href={`tel:${breakdownDetails.customer_info?.mobile}`} style={{ textDecoration: 'none', color: '#0284c7' }}>
                            {breakdownDetails.customer_info?.mobile}
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 8px', fontWeight: '600' }}>Booking Time:</td>
                        <td style={{ padding: '4px 8px' }}>
                          {breakdownDetails.customer_info?.booking_time ? new Date(breakdownDetails.customer_info.booking_time).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3">
                    <a href={`tel:${breakdownDetails.customer_info?.mobile}`} className="btn btn-sm" style={{ background: '#0284c7', color: 'white', fontWeight: '600', padding: '6px 12px', borderRadius: '6px' }}>
                      <i className="fa fa-phone mr-2" /> Call Customer
                    </a>
                  </div>
                </div>
              )}

              {/* Replacement Vehicles — only for breakdown, accident, service_refusal */}
              {['vehicle_breakdown', 'accident', 'service_refusal'].includes(breakdownDetails.issue_type) && (
              <div style={{ background: '#ffffff', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
                <h6 style={{ marginBottom: '12px', color: '#334155', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔄</span> Replacement Vehicle Suggestions
                </h6>
                
                {breakdownDetails.replacements_hidden_reason ? (
                   <div style={{ background: '#fef9c3', color: '#854d0e', padding: '12px', borderRadius: '6px', fontSize: '13px', textAlign: 'center', border: '1px solid #fde047' }}>
                     <strong>⚠️</strong> Trip is already {breakdownDetails.replacements_hidden_reason} — replacement not applicable
                   </div>
                ) : breakdownDetails.replacement_vehicles && breakdownDetails.replacement_vehicles.length > 0 ? (
                  <div className={s.replacementTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>Match</th>
                          <th>Vehicle & Driver</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdownDetails.replacement_vehicles.map((v, idx) => (
                          <tr key={idx}>
                            <td>
                              <span className={`${s.matchBadge} ${v.match_type === 'same_class' ? s.sameClass : s.higherClass}`}>
                                {v.match_type === 'same_class' ? 'Same Class' : '+1 Class'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <strong style={{ fontSize: '13px' }}>ID: {v.vehicle_id}</strong>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>{v.driver_name}</span>
                                <a href={`tel:${v.driver_phone}`} style={{ fontSize: '12px', color: '#0284c7', textDecoration: 'none' }}>📞 {v.driver_phone}</a>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <strong style={{ fontSize: '13px', color: '#0f766e' }}>{v.distance_km} km away</strong>
                                <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={v.location_name}>{v.location_name}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '12px', background: '#f1f5f9', borderRadius: '6px' }}>
                    No idle vehicles found in the same or +1 higher class.
                  </div>
                )}
              </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-danger">
              Failed to load details. Please check the backend connection.
            </div>
          )}
        </ModalBody>
        <ModalFooter style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '16px' }}>
          {selectedIssue && (
            <Button color="success" onClick={() => { closeBreakdownModal(); handleResolve(selectedIssue); }} style={{ fontWeight: '600' }}>
              ✅ Resolve Issue
            </Button>
          )}
          <Button color="secondary" onClick={closeBreakdownModal} style={{ fontWeight: '600' }} outline>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Block Driver Modal */}
      <Modal isOpen={showBlockModal} toggle={closeBlockModal} size="md" className={s.blockModal}>
        <ModalHeader toggle={closeBlockModal}>
          <span className={s.modalIcon}>🚫</span>
          Block Driver
        </ModalHeader>
        <ModalBody>
          {selectedDriver && (
            <div className={s.blockForm}>
              <div className={s.driverInfo}>
                <h5>{selectedDriver.driver_name}</h5>
                <p>{selectedDriver.driver_phone} • {selectedDriver.vehicle_registration}</p>
                <p className={s.rejectionsCount}>
                  <strong>{selectedDriver.rejection_count}</strong> rejections today
                </p>
              </div>

              <div className={s.formGroup}>
                <label>Block Duration</label>
                <select
                  className={s.formControl}
                  value={blockDuration}
                  onChange={(e) => setBlockDuration(e.target.value)}
                >
                  <option value="end_of_day">Until end of today (11:59 PM)</option>
                  <option value="tomorrow">Until tomorrow (11:59 PM)</option>
                  <option value="3_days">For 3 days</option>
                  <option value="1_week">For 1 week</option>
                </select>
              </div>

              <div className={s.formGroup}>
                <label>Block Reason *</label>
                <textarea
                  className={s.formControl}
                  rows="4"
                  placeholder="Enter reason for blocking (required)..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>

              <div className={s.warningBox}>
                <strong>⚠️ Warning:</strong> This will set vehicle.is_active = FALSE and prevent new trip assignments until the block expires.
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="danger"
            onClick={submitBlockDriver}
            disabled={blocking || !blockReason.trim()}
          >
            {blocking ? <Spinner size="sm" /> : '🚫 Block Driver'}
          </Button>
          <Button color="secondary" onClick={closeBlockModal}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default Notifications;