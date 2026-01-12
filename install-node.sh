#!/bin/bash
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

echo "Installing Node.js 18..."
nvm install 18 2>&1 | tee /tmp/nvm-install.log

echo "Using Node.js 18..."
nvm use 18

echo "Setting as default..."
nvm alias default 18

echo "Verifying installation..."
node --version
npm --version

echo "Node.js installation complete!"


