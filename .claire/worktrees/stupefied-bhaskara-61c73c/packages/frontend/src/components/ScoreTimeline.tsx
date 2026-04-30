'use client';

interface ScoreTimelineProps {
  address: string;
}

export default function ScoreTimeline({ address: _address }: ScoreTimelineProps) {
  return (
    <div className="h-48 bg-gray-800 border border-gray-700 rounded-xl flex items-center justify-center text-gray-500 text-sm">
      Score timeline chart — coming in M-27
    </div>
  );
}
