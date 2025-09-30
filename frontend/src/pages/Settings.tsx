import React, { useEffect, useState } from 'react';
import Icons from '../components/ui/icons';

interface SettingGroup {
  title: string;
  icon: React.ReactNode;
  description: string;
  settings: Setting[];
}

interface Setting {
  key: keyof SettingsState;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

interface SettingsState {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyReports: boolean;
  darkMode: boolean;
  highContrast: boolean;
  animations: boolean;
  autoSave: boolean;
  compactView: boolean;
  keyboardShortcuts: boolean;
  betaFeatures: boolean;
  experimentalAI: boolean;
  debugMode: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    emailNotifications: true,
    pushNotifications: false,
    weeklyReports: true,
    darkMode: true,
    highContrast: false,
    animations: true,
    autoSave: true,
    compactView: false,
    keyboardShortcuts: true,
    betaFeatures: false,
    experimentalAI: false,
    debugMode: false,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const settingGroups: SettingGroup[] = [
    {
      title: 'Notifications',
      icon: <Icons.activity size={20} />,
      description: 'Configure how you receive updates and alerts',
      settings: [
        {
          key: 'emailNotifications',
          label: 'Email Notifications',
          description: 'Get notified when your resumes are ready',
        },
        {
          key: 'pushNotifications',
          label: 'Browser Push Notifications',
          description: 'Receive real-time updates in your browser',
        },
        {
          key: 'weeklyReports',
          label: 'Weekly Activity Reports',
          description: 'Receive a summary of your resume generation activity',
        },
      ],
    },
    {
      title: 'Appearance',
      icon: <Icons.eye size={20} />,
      description: 'Customize the look and feel of the application',
      settings: [
        {
          key: 'darkMode',
          label: 'Dark Mode',
          description: 'Use dark theme across the application',
        },
        {
          key: 'highContrast',
          label: 'High Contrast Mode',
          description: 'Increase contrast for better visibility',
        },
        {
          key: 'animations',
          label: 'Interface Animations',
          description: 'Enable smooth transitions and effects',
        },
      ],
    },
    {
      title: 'Productivity',
      icon: <Icons.zap size={20} />,
      description: 'Features to help you work more efficiently',
      settings: [
        {
          key: 'autoSave',
          label: 'Auto-save',
          description: 'Automatically save your work as you type',
        },
        {
          key: 'compactView',
          label: 'Compact View',
          description: 'Display more information in less space',
        },
        {
          key: 'keyboardShortcuts',
          label: 'Keyboard Shortcuts',
          description: 'Enable quick actions with keyboard combinations',
        },
      ],
    },
    {
      title: 'Labs',
      icon: <Icons.settings size={20} />,
      description: 'Experimental features and early access',
      settings: [
        {
          key: 'betaFeatures',
          label: 'Beta Features',
          description: 'Try experimental features before release',
        },
        {
          key: 'experimentalAI',
          label: 'Advanced AI Models',
          description: 'Access cutting-edge AI capabilities',
        },
        {
          key: 'debugMode',
          label: 'Debug Mode',
          description: 'Show additional technical information',
        },
      ],
    },
  ];

  useEffect(() => {
    try {
      const raw = localStorage.getItem('userSettings');
      if (raw) {
        const saved = JSON.parse(raw);
        setSettings(prev => ({ ...prev, ...saved }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const handleToggle = (key: keyof SettingsState) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('userSettings', JSON.stringify(settings));
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate save delay
      setSaveStatus('saved');
      setHasChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveStatus('idle');
    }
  };

  const handleReset = () => {
    const defaults: SettingsState = {
      emailNotifications: true,
      pushNotifications: false,
      weeklyReports: true,
      darkMode: true,
      highContrast: false,
      animations: true,
      autoSave: true,
      compactView: false,
      keyboardShortcuts: true,
      betaFeatures: false,
      experimentalAI: false,
      debugMode: false,
    };
    setSettings(defaults);
    setHasChanges(true);
    setSaveStatus('idle');
  };

  return (
    <div className="modern-settings-page">
      <div className="modern-settings-container">
        {/* Header */}
        <div className="modern-settings-header">
          <div className="modern-settings-title-section">
            <div className="modern-settings-icon">
              <Icons.settings size={28} />
            </div>
            <div>
              <h1 className="modern-settings-title">Settings</h1>
              <p className="modern-settings-subtitle">
                Manage your preferences and customize your experience
              </p>
            </div>
          </div>

          <div className="modern-settings-actions">
            <button
              className="modern-settings-reset"
              onClick={handleReset}
              aria-label="Reset to defaults"
            >
              <Icons.refresh size={18} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Settings Groups */}
        <div className="modern-settings-content">
          {settingGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="modern-settings-group">
              <div className="modern-settings-group-header">
                <div className="modern-settings-group-icon">{group.icon}</div>
                <div className="modern-settings-group-info">
                  <h2 className="modern-settings-group-title">{group.title}</h2>
                  <p className="modern-settings-group-description">{group.description}</p>
                </div>
              </div>

              <div className="modern-settings-list">
                {group.settings.map((setting, idx) => (
                  <div
                    key={setting.key}
                    className={`modern-setting-item ${
                      idx === group.settings.length - 1 ? 'last' : ''
                    }`}
                  >
                    <div className="modern-setting-content">
                      <div className="modern-setting-label">
                        {setting.label}
                        {settings[setting.key] && (
                          <span className="modern-setting-status">Active</span>
                        )}
                      </div>
                      <p className="modern-setting-description">{setting.description}</p>
                    </div>

                    <button
                      className={`modern-toggle-switch ${
                        settings[setting.key] ? 'active' : ''
                      }`}
                      onClick={() => handleToggle(setting.key)}
                      role="switch"
                      aria-checked={settings[setting.key]}
                      aria-label={`Toggle ${setting.label}`}
                    >
                      <span className="modern-toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Save Bar */}
        {hasChanges && (
          <div className="modern-save-bar">
            <div className="modern-save-content">
              <div className="modern-save-info">
                <Icons.info size={16} />
                <span>You have unsaved changes</span>
              </div>
              <div className="modern-save-actions">
                <button
                  className="modern-save-cancel"
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Cancel
                </button>
                <button
                  className="modern-save-button"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <div className="modern-save-spinner"></div>
                      <span>Saving...</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <Icons.check size={16} />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Icons.check size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="modern-settings-footer">
          <div className="modern-quick-actions">
            <h3 className="modern-quick-title">Quick Actions</h3>
            <div className="modern-quick-grid">
              <button className="modern-quick-card">
                <Icons.download size={20} />
                <span>Export Settings</span>
              </button>
              <button className="modern-quick-card">
                <Icons.upload size={20} />
                <span>Import Settings</span>
              </button>
              <button className="modern-quick-card">
                <Icons.info size={20} />
                <span>Help Center</span>
              </button>
              <button className="modern-quick-card">
                <Icons.mail size={20} />
                <span>Send Feedback</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}