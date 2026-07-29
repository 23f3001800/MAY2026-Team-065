// Fixed, animated gradient blobs behind every auth screen.
import React from 'react';

export default function AuthBackground() {
  return (
    <div className="bg-blob-container">
      {/* Emerald – top-right */}
      <div className="bg-blob w-[500px] h-[500px] bg-primary -top-[100px] -right-[50px] animate-float-blob-1" />
      {/* Blue – bottom-left */}
      <div className="bg-blob w-[600px] h-[600px] bg-secondary -bottom-[200px] -left-[100px] animate-float-blob-2" />
      {/* Purple – center */}
      <div className="bg-blob w-[400px] h-[400px] bg-[#a855f7] top-[40%] left-[30%] !opacity-[0.08] animate-float-blob-3" />
    </div>
  );
}
