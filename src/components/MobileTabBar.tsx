import { BookOpen, MessageCircle, PlayCircle, User } from 'lucide-react';

type MobileTabBarProps = {
  activeTab: 'read' | 'sermons' | 'ask' | 'profile';
  onOpenRead: () => void;
  onOpenSermons: () => void;
  onOpenAIChat: () => void;
  onOpenProfile: () => void;
};

const tabs = [
  { id: 'read', label: 'Read', icon: BookOpen },
  { id: 'sermons', label: 'Sermons', icon: PlayCircle },
  { id: 'ask', label: 'Q&A', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: User },
] as const;

export function MobileTabBar({
  activeTab,
  onOpenRead,
  onOpenSermons,
  onOpenAIChat,
  onOpenProfile,
}: MobileTabBarProps) {
  const handlePress = (tabId: MobileTabBarProps['activeTab']) => {
    if (tabId === 'read') onOpenRead();
    if (tabId === 'sermons') onOpenSermons();
    if (tabId === 'ask') onOpenAIChat();
    if (tabId === 'profile') onOpenProfile();
  };

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#c49a5c]/20 bg-[#faf8f4]/95 backdrop-blur-md px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handlePress(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-colors ${
                isActive
                  ? 'bg-[#c49a5c] text-white shadow-sm'
                  : 'text-[#2c1810]/65 hover:bg-white hover:text-[#2c1810]'
              }`}
              aria-label={tab.label}
            >
              <Icon size={18} />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
