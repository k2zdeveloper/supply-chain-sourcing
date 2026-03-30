import React, { useState } from 'react';
import { useRejectQuote } from '../hooks/useRejectQuote';

interface RejectQuoteButtonProps {
  quoteId: string;
  onRejected?: () => void;
  className?: string;
}

export const RejectQuoteButton: React.FC<RejectQuoteButtonProps> = ({ 
  quoteId, 
  onRejected,
  className = ''
}) => {
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  
  const { mutate, isRejecting, error } = useRejectQuote({
    onSuccess: () => {
      setRequiresConfirmation(false);
      onRejected?.();
    }
  });

  const handleClick = () => {
    if (!requiresConfirmation) {
      // Step 1: Ask for confirmation
      setRequiresConfirmation(true);
      return;
    }
    // Step 2: Actually execute the rejection
    mutate(quoteId);
  };

  const handleCancel = () => {
    setRequiresConfirmation(false);
    setError(null); // Clear any previous errors if they back out
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Cancel Button - Only shows during the confirmation step */}
      {requiresConfirmation && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isRejecting}
          className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 disabled:opacity-50"
        >
          Cancel
        </button>
      )}

      {/* Primary Action Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isRejecting}
        aria-live="polite"
        className={`
          relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
          ${requiresConfirmation 
            ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500' // Confirmed destructive state
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-700 hover:border-red-200 focus:ring-red-500' // Idle state
          }
        `}
      >
        {isRejecting ? (
          <>
            <svg className="w-4 h-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Rejecting...
          </>
        ) : requiresConfirmation ? (
          'Confirm Rejection'
        ) : (
          'Reject Quote'
        )}
      </button>
      
      {/* Error Message Display */}
      {error && (
        <span className="text-sm font-medium text-red-600 animate-pulse">
          {error.message}
        </span>
      )}
    </div>
  );
};

function setError(arg0: null) {
    throw new Error('Function not implemented.');
}
