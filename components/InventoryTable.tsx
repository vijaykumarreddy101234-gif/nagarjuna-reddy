
import React from 'react';

const DeprecatedComponent: React.FC = () => {
    return (
        <div className="p-4 border border-dashed border-red-400 rounded-md bg-red-50 dark:bg-red-900/20">
            <p className="text-red-700 dark:text-red-300 text-center font-semibold">
                This component (`InventoryTable`) is deprecated. Please use `ItemsTable` instead.
            </p>
        </div>
    );
};

export default DeprecatedComponent;
