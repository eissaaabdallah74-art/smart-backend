// src/constants/enums.js

const DRIVER_PAYMENT_METHODS = ['bank', 'wallet'];

const DRIVER_LOAN_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'disbursed',
  'cancelled',
  'closed',
];


const DRIVER_CONTRACT_STATUSES = [
  'Active',
  'Inactive',
  'Unreachable/Reschedule',
  'Resigned',
  'Hold zone',
];

const SIGNED_WITH_HR_STATUSES = [
  'Signed A Contract With HR',
  'Will Think About Our Offers',
  'Missing documents',
  'Unqualified',
];

module.exports = {
  DRIVER_CONTRACT_STATUSES,
  SIGNED_WITH_HR_STATUSES,
  DRIVER_PAYMENT_METHODS,
  DRIVER_LOAN_STATUSES,
};
