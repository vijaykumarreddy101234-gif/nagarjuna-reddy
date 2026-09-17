import React from 'react';
import { Card } from '../components/Card';

const DeprecatedSetupPage = () => {
    return (
        <div 
          className="min-h-screen bg-cover bg-center flex flex-col justify-center items-center p-4"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }}
        >
            <Card className="w-full max-w-lg text-center">
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">Setup Page Deprecated</h1>
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                    This manual setup page is no longer in use. The Google Client ID is now configured directly in the application code by an administrator.
                </p>
            </Card>
        </div>
    );
};

export default DeprecatedSetupPage;