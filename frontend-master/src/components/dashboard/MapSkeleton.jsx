import React from 'react';
import { Card, CardBody } from 'reactstrap';

const MapSkeleton = ({ height = '450px' }) => {
  return (
    <Card className="border-0 shadow-sm h-100">
      <CardBody className="d-flex flex-column justify-content-center align-items-center" style={{ height, backgroundColor: '#1a1d24' }}>
        <div className="spinner-border text-primary" role="status" style={{ opacity: 0.7 }}>
          <span className="sr-only">Loading Map...</span>
        </div>
        <div className="mt-3 text-muted" style={{ fontSize: '0.9rem' }}>Initializing Live Map...</div>
      </CardBody>
    </Card>
  );
};

export default MapSkeleton;
