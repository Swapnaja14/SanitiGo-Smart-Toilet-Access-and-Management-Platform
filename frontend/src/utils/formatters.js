/**
 * Format monetary amount in Indian Rupees (₹)
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format ISO date string into readable date and time
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Short date formatter
 */
export function formatDate(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}
