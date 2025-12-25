import { useState, useEffect } from 'react';
import { Logo } from './Logo';
import type { AppTab } from '../App';
import './Header.css';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

interface SystemInfo {
  os_name: string;
  os_version: string;
  cpu_brand: string;
  cpu_cores: number;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        // Dynamic import to avoid issues in dev mode
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke<SystemInfo>('get_system_info');
        setSystemInfo(info);
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      }
    };

    fetchSystemInfo();
  }, []);

  // Format OS name for display
  const formatOSName = (osName: string, osVersion: string): string => {
    if (
      osName.toLowerCase().includes('macos') ||
      osName.toLowerCase().includes('darwin')
    ) {
      return `macOS ${osVersion.split('.')[0] || ''}`;
    }
    if (osName.toLowerCase().includes('windows')) {
      return `Windows ${osVersion}`;
    }
    if (osName.toLowerCase().includes('linux')) {
      return `Linux ${osVersion}`;
    }
    return `${osName} ${osVersion}`;
  };

  // Format CPU brand for display (shorten if too long)
  const formatCPUBrand = (brand: string): string => {
    // Extract just the model name, remove extra details
    const parts = brand.split(' ');
    if (parts.length > 3) {
      return parts.slice(0, 3).join(' ');
    }
    return brand;
  };

  return (
    <header className="header">
      <div className="header-brand">
        <Logo size={28} />
        <span className="brand-name">Ursly</span>
      </div>

      <nav className="header-tabs">
        <button
          className={`header-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => onTabChange('files')}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Files</span>
        </button>
        <button
          className={`header-tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => onTabChange('metrics')}
          data-tab="metrics"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Metrics</span>
        </button>
      </nav>

      <div className="header-status-group">
        {systemInfo && (
          <div className="header-system-info">
            <span className="system-info-item">
              {formatOSName(systemInfo.os_name, systemInfo.os_version)}
            </span>
            <span className="system-info-divider">·</span>
            <span className="system-info-item">
              {systemInfo.cpu_cores} Core{systemInfo.cpu_cores !== 1 ? 's' : ''}
            </span>
            <span className="system-info-divider">·</span>
            <span
              className="system-info-item system-info-cpu"
              title={systemInfo.cpu_brand}
            >
              {formatCPUBrand(systemInfo.cpu_brand)}
            </span>
          </div>
        )}
        <div className="header-status">
          <span className="status-dot"></span>
          <span className="status-text">Connected</span>
        </div>
      </div>
    </header>
  );
}
