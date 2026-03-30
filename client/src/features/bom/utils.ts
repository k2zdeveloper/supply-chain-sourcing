export const PLATFORM_MARGIN = 1.15;

export const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '-';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    minimumFractionDigits: 2 
  }).format(val);
};