import React from "react";

export default function ShiftFlowLoader({ label = "Chargement…", fullScreen = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fullScreen ? "min-h-screen" : "min-h-[38vh]"} flex w-full items-center justify-center px-6`}
      data-testid="shiftflow-loader"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-[22px] border-2 border-blue-100" aria-hidden="true" />
          <span className="absolute inset-0 rounded-[22px] border-2 border-transparent border-r-blue-300 border-t-blue-600 motion-safe:animate-spin" aria-hidden="true" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200/70 motion-safe:animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
          </span>
        </div>
        {label && <p className="mt-3 text-sm font-medium text-gray-500">{label}</p>}
      </div>
    </div>
  );
}
