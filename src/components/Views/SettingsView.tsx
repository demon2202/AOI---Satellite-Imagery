import { useState } from 'react'
import type { ToastMessage } from '../../types'

interface SettingsViewProps {
  showToast: (message: string, type?: ToastMessage['type']) => void
}

export default function SettingsView({ showToast }: SettingsViewProps) {
  const [settings, setSettings] = useState({
    darkMode: true,
    notifications: true,
    autoSave: true,
    showCoordinates: true,
    defaultZoom: 5,
    language: 'en',
  })

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    showToast('Setting updated', 'success')
  }

  const handleSave = () => {
    localStorage.setItem('app-settings', JSON.stringify(settings))
    showToast('Settings saved successfully', 'success')
  }

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      localStorage.clear()
      showToast('All data cleared', 'info')
      window.location.reload()
    }
  }

  return (
    <div className="flex-1 bg-slate-900 p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Settings</h1>
          <p className="text-slate-400">Manage your application preferences</p>
        </div>

        {/* General Settings */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold">General</h2>
          </div>
          
          <div className="divide-y divide-slate-700">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-slate-400">Use dark theme for the application</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={() => handleToggle('darkMode')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
              </label>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-sm text-slate-400">Receive in-app notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={() => handleToggle('notifications')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
              </label>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-save Features</p>
                <p className="text-sm text-slate-400">Automatically save features to local storage</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={() => handleToggle('autoSave')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
              </label>
            </div>
          </div>
        </div>

        {/* Map Settings */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold">Map Preferences</h2>
          </div>
          
          <div className="divide-y divide-slate-700">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Show Coordinates</p>
                <p className="text-sm text-slate-400">Display mouse coordinates on the map</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showCoordinates}
                  onChange={() => handleToggle('showCoordinates')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
              </label>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Default Zoom Level</p>
                <p className="text-sm text-slate-400">Initial zoom when map loads</p>
              </div>
              <select
                value={settings.defaultZoom}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultZoom: parseInt(e.target.value) }))}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map(zoom => (
                  <option key={zoom} value={zoom}>Zoom {zoom}</option>
                ))}
              </select>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Language</p>
                <p className="text-sm text-slate-400">Select your preferred language</p>
              </div>
              <select
                value={settings.language}
                onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
                <option value="ta">தமிழ்</option>
                <option value="te">తెలుగు</option>
                <option value="mr">मराठी</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold">Data Management</h2>
          </div>
          
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-400">Clear All Data</p>
                <p className="text-sm text-slate-400">Delete all saved features and settings</p>
              </div>
              <button
                onClick={handleClearData}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>

        {/* About Section */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>AOI Creation v1.0.0</p>
          <p className="mt-1">Built with React, TypeScript, and Leaflet</p>
        </div>
      </div>
    </div>
  )
}