import React, { useState } from 'react';
import Icons from './ui/icons';

interface ModernSettingsModalProps {
  onClose: () => void;
}

export default function ModernSettingsModal({ onClose }: ModernSettingsModalProps) {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    darkMode: true,
    autoSave: true,
    compactView: false,
    betaFeatures: false
  });

  const handleSave = () => {
    localStorage.setItem('userSettings', JSON.stringify(settings));
    onClose();
  };

  return (
    <div className="modern-modal-overlay" onClick={onClose}>
      <div className="modern-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modern-modal-header">
          <h2 className="modern-modal-title">Settings</h2>
          <button
            className="modern-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icons.x size={20} />
          </button>
        </div>

        <div className="modern-modal-body">
          <div className="modern-setting-row">
            <div className="modern-setting-info">
              <h4>Email Notifications</h4>
              <p>Get notified when your resumes are ready</p>
            </div>
            <label className="modern-toggle">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
              />
              <span className="modern-toggle-slider"></span>
            </label>
          </div>

          <div className="modern-setting-row">
            <div className="modern-setting-info">
              <h4>Dark Mode</h4>
              <p>Use dark theme across the application</p>
            </div>
            <label className="modern-toggle">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => setSettings({...settings, darkMode: e.target.checked})}
              />
              <span className="modern-toggle-slider"></span>
            </label>
          </div>

          <div className="modern-setting-row">
            <div className="modern-setting-info">
              <h4>Auto-save</h4>
              <p>Automatically save your work as you type</p>
            </div>
            <label className="modern-toggle">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => setSettings({...settings, autoSave: e.target.checked})}
              />
              <span className="modern-toggle-slider"></span>
            </label>
          </div>

          <div className="modern-setting-row">
            <div className="modern-setting-info">
              <h4>Compact View</h4>
              <p>Display more information in less space</p>
            </div>
            <label className="modern-toggle">
              <input
                type="checkbox"
                checked={settings.compactView}
                onChange={(e) => setSettings({...settings, compactView: e.target.checked})}
              />
              <span className="modern-toggle-slider"></span>
            </label>
          </div>

          <div className="modern-setting-row" style={{ borderBottom: 'none' }}>
            <div className="modern-setting-info">
              <h4>Beta Features</h4>
              <p>Try experimental features before release</p>
            </div>
            <label className="modern-toggle">
              <input
                type="checkbox"
                checked={settings.betaFeatures}
                onChange={(e) => setSettings({...settings, betaFeatures: e.target.checked})}
              />
              <span className="modern-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="modern-modal-footer">
          <button className="modern-btn modern-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modern-btn modern-btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}