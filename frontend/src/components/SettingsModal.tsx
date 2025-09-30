import React, { useState } from 'react';
import Icons from './ui/icons';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    darkMode: true,
    autoSave: true,
    compactView: false
  });

  const handleSave = () => {
    // Save settings to localStorage or API
    localStorage.setItem('userSettings', JSON.stringify(settings));
    onClose();
  };

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2 className="ai-modal-title">Settings</h2>
          <button
            className="ai-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <Icons.x size={20} />
          </button>
        </div>

        <div className="ai-modal-body">
          <div className="ai-settings-section">
            <h3 className="ai-settings-label">Preferences</h3>

            <label className="ai-setting-item">
              <div className="ai-setting-info">
                <span className="ai-setting-name">Email Notifications</span>
                <span className="ai-setting-desc">Receive updates about your resumes</span>
              </div>
              <input
                type="checkbox"
                className="ai-toggle"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
              />
            </label>

            <label className="ai-setting-item">
              <div className="ai-setting-info">
                <span className="ai-setting-name">Dark Mode</span>
                <span className="ai-setting-desc">Use dark theme interface</span>
              </div>
              <input
                type="checkbox"
                className="ai-toggle"
                checked={settings.darkMode}
                onChange={(e) => setSettings({...settings, darkMode: e.target.checked})}
              />
            </label>

            <label className="ai-setting-item">
              <div className="ai-setting-info">
                <span className="ai-setting-name">Auto-save</span>
                <span className="ai-setting-desc">Automatically save your work</span>
              </div>
              <input
                type="checkbox"
                className="ai-toggle"
                checked={settings.autoSave}
                onChange={(e) => setSettings({...settings, autoSave: e.target.checked})}
              />
            </label>

            <label className="ai-setting-item">
              <div className="ai-setting-info">
                <span className="ai-setting-name">Compact View</span>
                <span className="ai-setting-desc">Show more items on screen</span>
              </div>
              <input
                type="checkbox"
                className="ai-toggle"
                checked={settings.compactView}
                onChange={(e) => setSettings({...settings, compactView: e.target.checked})}
              />
            </label>
          </div>
        </div>

        <div className="ai-modal-footer">
          <button className="ai-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="ai-btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}