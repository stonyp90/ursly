import type { SystemInfo } from '../types';
import { Logo } from './Logo';

interface HeaderProps {
  systemInfo: SystemInfo | null;
}

export function Header({ systemInfo }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-brand">
        <Logo size={28} />
        <div className="brand-text">
          <h1>Ursly</h1>
          <span className="brand-tagline">VIRTUAL CLOUD FILE SYSTEM</span>
        </div>
      </div>

      <div className="header-info">
        {systemInfo && (
          <>
            <div className="info-item">
              <span className="info-label">Host</span>
              <span className="info-value">{systemInfo.hostname}</span>
            </div>
            <div className="info-item">
              <span className="info-label">OS</span>
              <span className="info-value">
                {systemInfo.os_name} {systemInfo.os_version}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">CPU</span>
              <span className="info-value">{systemInfo.cpu_cores} cores</span>
            </div>
          </>
        )}

        <div className="status-indicator online">
          <span className="status-dot"></span>
          <span>Connected</span>
        </div>
      </div>
    </header>
  );
}
