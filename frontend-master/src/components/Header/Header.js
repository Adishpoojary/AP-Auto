/**
 * Flatlogic Dashboards (https://flatlogic.com/admin-dashboards)
 *
 * Copyright © 2015-present Flatlogic, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { connect } from 'react-redux';
import cx from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import {
  Navbar,
  Nav,
  NavItem,
  Button,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Input,
  InputGroup,
  InputGroupAddon,
} from 'reactstrap';
import { NavLink } from 'react-router-dom';

import Icon from '../Icon';
import { useCity } from '../../contexts/CityContext';
import { useDateFilter } from '../../contexts/DateFilterContext';
import CityAutocomplete from '../CityAutocomplete/CityAutocomplete';

import photo from '../../images/photo.jpg';
import { logoutUser } from '../../actions/user';
import s from './Header.module.scss';

// Compact City Selector for Header (Updated with Autocomplete)
const CompactCitySelector = () => {
  const { selectedCities, setCities } = useCity();
  const [isOpen, setIsOpen] = React.useState(false);

  const toggle = () => setIsOpen(!isOpen);

  const handleCitiesChange = (newCities) => {
    setCities(newCities);
  };

  const isAllCities = selectedCities.length === 0;
  const displayText = isAllCities 
    ? '🌍 All Cities' 
    : selectedCities.length === 1 
      ? selectedCities[0]
      : `${selectedCities.length} Cities`;

  return (
    <Dropdown isOpen={isOpen} toggle={toggle} style={{ marginRight: '10px' }}>
      <DropdownToggle 
        nav 
        style={{ 
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        className="city-selector-toggle"
      >
        <Icon glyph="location" style={{ fontSize: '16px', color: '#6b7280' }} />
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-start',
          lineHeight: '1.3',
          minWidth: '100px'
        }}>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: '600',
            color: '#1f2937',
            whiteSpace: 'nowrap'
          }}>
            {displayText}
          </span>
          <span style={{ 
            fontSize: '10px', 
            color: '#9ca3af',
            fontWeight: '500'
          }}>
            Click to change
          </span>
        </div>
        <i className="fa fa-angle-down" style={{ fontSize: '12px', color: '#6b7280' }} />
      </DropdownToggle>
      <DropdownMenu right style={{ minWidth: '400px', padding: '20px', marginTop: '8px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '12px', display: 'block' }}>
            Select Cities
          </label>
          <CityAutocomplete 
            selectedCities={selectedCities}
            onCitiesChange={handleCitiesChange}
          />
        </div>
        {selectedCities.length > 0 && (
          <div style={{ 
            padding: '12px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px', 
            fontSize: '13px', 
            textAlign: 'center',
            color: 'white',
            fontWeight: '600',
            marginTop: '12px'
          }}>
            <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>Currently Filtering By</div>
            <div style={{ fontSize: '14px' }}>
              📍 {selectedCities.join(', ')}
            </div>
          </div>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

// Compact Date Filter for Header
const CompactDateFilter = () => {
  const { dateRange, updateDateRange, clearDateFilter, setToday, setLast7Days, setLast30Days } = useDateFilter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [startDate, setStartDate] = React.useState(dateRange.startDate || '');
  const [endDate, setEndDate] = React.useState(dateRange.endDate || '');

  React.useEffect(() => {
    setStartDate(dateRange.startDate || '');
    setEndDate(dateRange.endDate || '');
  }, [dateRange]);

  const toggle = () => setIsOpen(!isOpen);

  const handleSetDateRange = () => {
    if (startDate || endDate) {
      updateDateRange(startDate, endDate);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    clearDateFilter();
    setStartDate('');
    setEndDate('');
    setIsOpen(false);
  };

  const handleQuickFilter = (filterFunc) => {
    filterFunc();
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (!dateRange.startDate && !dateRange.endDate) {
      return 'All Dates';
    }
    if (dateRange.startDate === dateRange.endDate && dateRange.startDate) {
      return dateRange.startDate;
    }
    if (dateRange.startDate && dateRange.endDate) {
      return `${dateRange.startDate} - ${dateRange.endDate}`;
    }
    if (dateRange.startDate) {
      return `From ${dateRange.startDate}`;
    }
    if (dateRange.endDate) {
      return `Until ${dateRange.endDate}`;
    }
    return 'All Dates';
  };

  return (
    <Dropdown isOpen={isOpen} toggle={toggle} style={{ marginRight: '10px' }}>
      <DropdownToggle 
        nav 
        style={{ 
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        className="date-filter-toggle"
      >
        <Icon glyph="calendar" style={{ fontSize: '16px', color: '#6b7280' }} />
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-start',
          lineHeight: '1.3',
          minWidth: '120px'
        }}>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: '600',
            color: '#1f2937',
            whiteSpace: 'nowrap'
          }}>
            {getDisplayText()}
          </span>
          <span style={{ 
            fontSize: '10px', 
            color: '#9ca3af',
            fontWeight: '500'
          }}>
            Click to change
          </span>
        </div>
        <i className="fa fa-angle-down" style={{ fontSize: '12px', color: '#6b7280' }} />
      </DropdownToggle>
      <DropdownMenu right style={{ minWidth: '320px', padding: '20px', marginTop: '8px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '8px', display: 'block' }}>
            Select Date Range
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ 
                  fontSize: '14px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ 
                  fontSize: '14px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <Button
            size="sm"
            color="primary"
            onClick={handleSetDateRange}
            style={{ 
              flex: 1, 
              fontSize: '13px', 
              fontWeight: '600',
              padding: '8px',
              borderRadius: '6px'
            }}
          >
            Apply Filter
          </Button>
          <Button
            size="sm"
            color="secondary"
            onClick={handleClear}
            style={{ 
              flex: 1, 
              fontSize: '13px',
              fontWeight: '600',
              padding: '8px',
              borderRadius: '6px'
            }}
          >
            Clear
          </Button>
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
          <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
            Quick Filters
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Button
              size="sm"
              color="light"
              onClick={() => handleQuickFilter(setToday)}
              style={{ 
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                textAlign: 'left'
              }}
            >
              📅 Today
            </Button>
            <Button
              size="sm"
              color="light"
              onClick={() => handleQuickFilter(setLast7Days)}
              style={{ 
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                textAlign: 'left'
              }}
            >
              📊 Last 7 Days
            </Button>
            <Button
              size="sm"
              color="light"
              onClick={() => handleQuickFilter(setLast30Days)}
              style={{ 
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                textAlign: 'left'
              }}
            >
              📈 Last 30 Days
            </Button>
          </div>
        </div>
        {(dateRange.startDate || dateRange.endDate) && (
          <div style={{ 
            padding: '12px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px', 
            fontSize: '13px', 
            textAlign: 'center',
            color: 'white',
            fontWeight: '600',
            marginTop: '12px'
          }}>
            <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>Currently Viewing</div>
            <div style={{ fontSize: '15px' }}>
              📆 {getDisplayText()}
            </div>
          </div>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};

class Header extends React.Component {
  static propTypes = {
    sidebarToggle: PropTypes.func,
    dispatch: PropTypes.func.isRequired,
  };

  static defaultProps = {
    sidebarToggle: () => {},
  };

  state = { isOpen: false };

  toggleDropdown = () => {
    this.setState(prevState => ({
      isOpen: !prevState.isOpen,
    }));
  }

  doLogout = () => {
    this.props.dispatch(logoutUser());
  }

  render() {
    const {isOpen} = this.state;
    return (
      <Navbar className={s.root}>
        <Nav>
          <NavItem
            className={cx('visible-xs mr-4 d-sm-up-none', s.headerIcon, s.sidebarToggler)}
            href="#"
            onClick={this.props.sidebarToggle}
          >
            <i className="fa fa-bars fa-2x text-muted" />
          </NavItem>
        </Nav>
        <Nav className="ml-auto">
          {/* <NavItem className={cx('', s.headerIcon)}>
            <Button>
              <Icon glyph="mail"/>
              <span>8</span>
            </Button>
          </NavItem> */}
          {/* <NavItem className={cx('', s.headerIcon)}>
            <Button>
              <Icon glyph="notification"/>
              <span>13</span>
            </Button>
          </NavItem> */}
          <CompactCitySelector />
          <CompactDateFilter />
          <NavItem className={cx('', s.headerIcon)}>
            <Button>
              <Icon glyph="settings"/>
            </Button>
          </NavItem>
          <Dropdown isOpen={isOpen} toggle={this.toggleDropdown}>
            <DropdownToggle nav>
              <img className={cx('rounded-circle mr-sm', s.adminPhoto)} src={photo} alt="administrator" />
              <span className="text-body">Administrator</span>
              <i className={cx('fa fa-angle-down ml-sm', s.arrow, {[s.arrowActive]: isOpen})} />
            </DropdownToggle>
            <DropdownMenu style={{width: '100%'}}>
              <DropdownItem>
                <NavLink to="/app/posts">Posts</NavLink>
              </DropdownItem>
              <DropdownItem>
                <NavLink to="/app/profile">Profile</NavLink>
              </DropdownItem>
              <DropdownItem onClick={this.doLogout}>
                Logout
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </Nav>
      </Navbar>
    );
  }
}

function mapStateToProps(state) {
  return {
    init: state.runtime.initialNow,
  };
}
export default connect(mapStateToProps)(Header);