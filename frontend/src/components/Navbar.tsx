import React from 'react';
import { Link } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import type { Quota } from '../api-adapter';

export default function Navbar({ quota }: { quota: Quota | null }) {
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? 0;

  return (
    <div className="nav">
      <div className="hstack">
        <Link to="/" className="title">PASS ATS</Link>
        <Link to="/generate" className="muted">Generate</Link>
        <Link to="/profile" className="muted">Profile</Link>
        <a className="muted" href="https://chrome.google.com/webstore" target="_blank" rel="noreferrer">Install Extension</a>
      </div>
      <div className="right">
        <span className="muted">Plan: Free</span>
        {limit ? <span className="muted">Usage: {used}/{limit}</span> : null}
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}

