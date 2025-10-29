import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api, type Profile } from '../api-clerk';
import Icons from './ui/icons';

interface ModernProfileModalProps {
  onClose: () => void;
}

export default function ModernProfileModal({ onClose }: ModernProfileModalProps) {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
    summary: '',
    resumeText: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await getToken();
      const data = await api.getProfile(token || undefined);
      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      await api.postProfile(profile, token || undefined);
      onClose();
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modern-modal-overlay">
        <div className="modern-modal">
          <div className="modern-loading p-12">
            <div className="modern-spinner"></div>
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modern-modal-overlay" onClick={onClose}>
      <div className="modern-modal max-w-[640px]" onClick={(e) => e.stopPropagation()}>
        <div className="modern-modal-header">
          <h2 className="modern-modal-title">Profile Settings</h2>
          <button
            className="modern-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icons.x size={20} />
          </button>
        </div>

        <div className="modern-modal-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="modern-form-group">
              <label className="modern-form-label">
                <Icons.user size={14} />
                Name
              </label>
              <input
                type="text"
                className="modern-form-input"
                value={profile.name || ''}
                onChange={(e) => setProfile({...profile, name: e.target.value})}
                placeholder="John Doe"
              />
            </div>

            <div className="modern-form-group">
              <label className="modern-form-label">
                <Icons.mail size={14} />
                Email
              </label>
              <input
                type="email"
                className="modern-form-input"
                value={profile.email || ''}
                onChange={(e) => setProfile({...profile, email: e.target.value})}
                placeholder="john@example.com"
              />
            </div>

            <div className="modern-form-group">
              <label className="modern-form-label">
                <Icons.phone size={14} />
                Phone
              </label>
              <input
                type="tel"
                className="modern-form-input"
                value={profile.phone || ''}
                onChange={(e) => setProfile({...profile, phone: e.target.value})}
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div className="modern-form-group">
              <label className="modern-form-label">
                <Icons.mapPin size={14} />
                Location
              </label>
              <input
                type="text"
                className="modern-form-input"
                value={profile.location || ''}
                onChange={(e) => setProfile({...profile, location: e.target.value})}
                placeholder="San Francisco, CA"
              />
            </div>

            <div className="modern-form-group">
              <label className="modern-form-label">
                <Icons.linkedin size={14} />
                LinkedIn
              </label>
              <input
                type="url"
                className="modern-form-input"
                value={profile.linkedin || ''}
                onChange={(e) => setProfile({...profile, linkedin: e.target.value})}
                placeholder="linkedin.com/in/johndoe"
              />
            </div>

            <div className="modern-form-group">
              <label className="modern-form-label">
                <Icons.globe size={14} />
                Website
              </label>
              <input
                type="url"
                className="modern-form-input"
                value={profile.website || ''}
                onChange={(e) => setProfile({...profile, website: e.target.value})}
                placeholder="johndoe.com"
              />
            </div>
          </div>

          <div className="modern-form-group mt-6">
            <label className="modern-form-label">
              <Icons.fileText size={14} />
              Professional Summary
            </label>
            <textarea
              className="modern-form-input"
              rows={4}
              value={profile.summary || ''}
              onChange={(e) => setProfile({...profile, summary: e.target.value})}
              placeholder="A brief overview of your professional background and expertise..."
              className="modern-form-input resize-y"
            />
          </div>

          <div className="modern-form-group">
            <label className="modern-form-label">
              <Icons.fileText size={14} />
              Resume Content
            </label>
            <textarea
              className="modern-form-input resize-y font-mono text-[13px]"
              rows={8}
              value={profile.resumeText || ''}
              onChange={(e) => setProfile({...profile, resumeText: e.target.value})}
              placeholder="Paste your full resume content here..."
            />
          </div>
        </div>

        <div className="modern-modal-footer">
          <button className="modern-btn modern-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modern-btn modern-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Icons.loader className="animate-spin" size={16} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}