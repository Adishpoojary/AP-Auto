import React from 'react';
import { Card, CardBody } from 'reactstrap';

const SkeletonCard = ({ height = '150px' }) => {
  return (
    <Card className="border-0 shadow-sm h-100">
      <CardBody className="d-flex flex-column justify-content-center align-items-center" style={{ height }}>
        <div className="spinner-border text-light" role="status" style={{ opacity: 0.5 }}>
          <span className="sr-only">Loading...</span>
        </div>
        <div className="mt-2 text-muted" style={{ fontSize: '0.85rem' }}>Loading data...</div>
      </CardBody>
    </Card>
  );
};

export default SkeletonCard;
