import React from 'react';

const DeprecatedTotalStockTable = () => {
  return (
    <div className="p-4 border border-dashed border-yellow-400 rounded-md bg-yellow-50 dark:bg-yellow-900/20">
      <p className="text-yellow-700 dark:text-yellow-300 text-center font-semibold">
        The 'Total Stock' view has been removed to streamline the interface. 
        Please use the 'Current Stock' view for all stock information.
      </p>
    </div>
  );
};

export default DeprecatedTotalStockTable;
