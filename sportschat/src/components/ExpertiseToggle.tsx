"use client";

import { ExpertiseLevel } from "@/lib/types";

interface ExpertiseToggleProps {
  level: ExpertiseLevel;
  onChange: (level: ExpertiseLevel) => void;
}

const levels: { value: ExpertiseLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "casual", label: "Casual" },
  { value: "hardcore", label: "Hardcore" },
];

export default function ExpertiseToggle({ level, onChange }: ExpertiseToggleProps) {
  return (
    <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-700">
      {levels.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            level === value
              ? "bg-orange-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
