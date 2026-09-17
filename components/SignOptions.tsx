import React from "react";

interface SignOptionsProps {
  onSelect: (option: 'gmail' | 'yahoo' | 'offline') => void;
}

const SignOptions = ({ onSelect }) => {
  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Sign in</h2>
      <div className="space-y-3">
        <button
          className="w-full p-3 rounded shadow"
          onClick={() => onSelect("gmail")}
        >
          Sign in with Gmail
        </button>
        <button
          className="w-full p-3 rounded shadow"
          onClick={() => onSelect("yahoo")}
        >
          Sign in with Yahoo
        </button>
        <button
          className="w-full p-3 rounded shadow"
          onClick={() => onSelect("offline")}
        >
          Offline / Local account
        </button>
      </div>
    </div>
  );
};

export default SignOptions;
