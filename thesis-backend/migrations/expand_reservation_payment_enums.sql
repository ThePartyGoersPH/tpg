ALTER TABLE reservations
  MODIFY COLUMN payment_status ENUM('pending','partial','paid','cancelled','refunded','failed') DEFAULT NULL COMMENT 'Payment status for reservation',
  MODIFY COLUMN payment_method ENUM('cash','gcash','paymaya','card','digital','other') DEFAULT NULL COMMENT 'Payment method used';
