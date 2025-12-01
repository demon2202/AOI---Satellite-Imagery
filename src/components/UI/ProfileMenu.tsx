import type { ToastMessage } from '../../types'

interface ProfileMenuProps {
  onClose: () => void
  showToast: (message: string, type?: ToastMessage['type']) => void
}

export default function ProfileMenu({ onClose, showToast }: ProfileMenuProps) {
  const menuItems = [
    { 
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      label: 'My Profile',
      onClick: () => {
        showToast('Profile settings coming soon', 'info')
        onClose()
      }
    },
    { 
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      label: 'Account Settings',
      onClick: () => {
        showToast('Account settings coming soon', 'info')
        onClose()
      }
    },
    { 
      icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      label: 'Help & Support',
      onClick: () => {
        showToast('Help documentation coming soon', 'info')
        onClose()
      }
    },
  ]

  const handleLogout = () => {
    showToast('Logged out successfully', 'success')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[1500]" 
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className="absolute top-2 right-4 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[1600] overflow-hidden animate-fade-in">
        {/* User Info */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-sm font-medium">
              JD
            </div>
            <div>
              <p className="font-medium">John Doe</p>
              <p className="text-sm text-slate-400">john.doe@example.com</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-700 transition-colors text-left"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="border-t border-slate-700 py-2">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left text-red-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm">Log out</span>
          </button>
        </div>
      </div>
    </>
  )
}