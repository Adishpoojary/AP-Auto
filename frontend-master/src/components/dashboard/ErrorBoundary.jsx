import React from 'react';
import { Card, CardBody } from 'reactstrap';

/**
 * ErrorBoundary — wraps any child component to catch render errors.
 * If a child throws, it renders a compact error card instead of crashing the entire dashboard.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Widget error caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-0 shadow-sm h-100">
          <CardBody
            className="d-flex flex-column justify-content-center align-items-center text-center"
            style={{ minHeight: this.props.minHeight || '120px' }}
          >
            <i className="glyphicon glyphicon-warning-sign" style={{ fontSize: '1.6rem', color: '#dc3545', marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, color: '#dc3545', marginBottom: '4px' }}>
              {this.props.label || 'Widget Error'}
            </div>
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
              This widget encountered an error and could not load.
            </div>
          </CardBody>
        </Card>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
