import type { ReactNode } from 'react';
import { useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-2 bg-carbon border border-graphite rounded-card p-2 ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-md
            font-inter font-normal text-body-sm transition-all duration-150
            ${activeTab === tab.id
              ? 'bg-graphite text-paper'
              : 'text-fog hover:text-mist hover:bg-graphite/50'}
            ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}