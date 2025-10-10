#!/bin/bash

# Script to set Gemini API Key in Railway
# Usage: ./set-gemini-key.sh YOUR_GEMINI_API_KEY

if [ -z "$1" ]; then
  echo "❌ Error: Gemini API key not provided"
  echo ""
  echo "Usage: ./set-gemini-key.sh YOUR_GEMINI_API_KEY"
  echo ""
  echo "To get a Gemini API key:"
  echo "1. Go to https://makersuite.google.com/app/apikey"
  echo "2. Click 'Create API Key'"
  echo "3. Copy the key and run this script"
  exit 1
fi

GEMINI_KEY="$1"

echo "🔧 Setting Gemini API Key in Railway..."
echo ""

# Link to your project (you'll need to select which one)
echo "📋 Available projects:"
railway list

echo ""
echo "Please select your PASS_ATS project from the list above"
echo "Which project? (1-4):"
read project_num

case $project_num in
  1) PROJECT="refreshing-intuition";;
  2) PROJECT="happy-expression";;
  3) PROJECT="heartfelt-education";;
  4) PROJECT="successful-love";;
  *) echo "Invalid selection"; exit 1;;
esac

echo ""
echo "🔗 Linking to project: $PROJECT"
railway link

echo ""
echo "🔑 Setting GEMINI_API_KEY environment variable..."
railway variables --set "GEMINI_API_KEY=$GEMINI_KEY"

echo ""
echo "✅ Done! Gemini API Key has been set in Railway"
echo ""
echo "🚀 Your app will automatically redeploy with the new key"
echo "⏱️  Deployment takes 2-3 minutes"
echo ""
echo "To verify:"
echo "  railway variables | grep GEMINI"
