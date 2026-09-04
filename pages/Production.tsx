import React from 'react';
import { Card } from '../components/Card';

const DeprecatedPage = () => (
    <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Production</h1>
        <Card>
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                This page (`Production`) is deprecated and no longer in use. 
                <br />
                Please use the <strong className="text-gray-700 dark:text-gray-200">Consumption</strong> page instead.
            </p>
        </Card>
    </div>
);

export default DeprecatedPage;