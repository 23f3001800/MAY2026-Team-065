// The two-pane auth card: BrandPane on the left, form on the right.
// Pages pass their form content as children.
import React from 'react';
import BrandPane from './BrandPane';

export default function AuthCard({ children }) {
  return (
    <div className="w-[1000px] max-w-full min-h-[620px] bg-[rgba(15,23,42,0.3)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.07)] rounded-3xl flex overflow-hidden shadow-card animate-card-appear max-[820px]:min-h-0 max-[820px]:w-[480px]">
      <BrandPane />
      <div className="flex-[1.2] p-12 flex flex-col justify-center relative bg-[rgba(15,23,42,0.15)] max-[480px]:p-6">
        {children}
      </div>
    </div>
  );
}
