import React from 'react';

const DeprecatedComponent = () => {
    return (
        <div className="p-4 border border-dashed border-red-400 rounded-md bg-red-50 dark:bg-red-900/20">
            <p className="text-red-700 dark:text-red-300 text-center font-semibold">
                This component (`RecordProductionModal`) is deprecated. Please use `CreateConsumptionModal` instead.
            </p>
        </div>
    );
};

export default DeprecatedComponent;