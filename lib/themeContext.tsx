import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeConfig {
  name: string;
  displayName: string;
  primary: string;
  secondary: string;
  background: string;
  accent: string;
  description: string;
  preview: {
    gradient: string;
    cardGradient: string;
    buttonGradient: string;
  };
}

const themes: ThemeConfig[] = [
  {
    name: 'soft-blue',
    displayName: 'Soft Blue',
    primary: 'from-blue-600 to-blue-600',
    secondary: 'from-slate-600 to-slate-600', 
    background: 'from-blue-50 to-blue-50',
    accent: 'from-blue-100 to-blue-100',
    description: 'โทนสีฟ้าอ่อนที่นุ่มนวล เหมาะสำหรับการทำงาน',
    preview: {
      gradient: 'bg-blue-50',
      cardGradient: 'bg-white/90',
      buttonGradient: 'bg-blue-600'
    }
  },
  {
    name: 'sage-green',
    displayName: 'Sage Green',
    primary: 'from-green-600 to-green-600',
    secondary: 'from-gray-600 to-gray-600',
    background: 'from-green-50 to-green-50',
    accent: 'from-green-100 to-green-100', 
    description: 'โทนสีเขียวอ่อนที่ให้ความรู้สึกสงบ',
    preview: {
      gradient: 'bg-green-50',
      cardGradient: 'bg-white/90',
      buttonGradient: 'bg-green-600'
    }
  },
  {
    name: 'warm-gray',
    displayName: 'Warm Gray',
    primary: 'from-gray-600 to-gray-600',
    secondary: 'from-stone-600 to-stone-600',
    background: 'from-gray-50 to-gray-50',
    accent: 'from-gray-100 to-gray-100',
    description: 'โทนสีเทาอบอุ่นที่ดูหรูและเรียบง่าย',
    preview: {
      gradient: 'bg-gray-50', 
      cardGradient: 'bg-white/90',
      buttonGradient: 'bg-gray-600'
    }
  },
  {
    name: 'lavender',
    displayName: 'Lavender',
    primary: 'from-purple-600 to-purple-600',
    secondary: 'from-slate-600 to-slate-600',
    background: 'from-purple-50 to-purple-50',
    accent: 'from-purple-100 to-purple-100',
    description: 'โทนสีม่วงลาเวนเดอร์ที่นุ่มนวลและสวยงาม',
    preview: {
      gradient: 'bg-purple-50',
      cardGradient: 'bg-white/90', 
      buttonGradient: 'bg-purple-600'
    }
  },
  {
    name: 'sunset-orange',
    displayName: 'Sunset Orange', 
    primary: 'from-orange-600 to-orange-600',
    secondary: 'from-red-600 to-red-600',
    background: 'from-orange-50 to-orange-50',
    accent: 'from-orange-100 to-orange-100',
    description: 'โทนสีส้มอ่อนที่ให้ความรู้สึกอบอุ่น',
    preview: {
      gradient: 'bg-orange-50',
      cardGradient: 'bg-white/90',
      buttonGradient: 'bg-orange-600'
    }
  },
  {
    name: 'ocean-teal',
    displayName: 'Ocean Teal',
    primary: 'from-teal-600 to-teal-600', 
    secondary: 'from-blue-600 to-blue-600',
    background: 'from-teal-50 to-teal-50',
    accent: 'from-teal-100 to-teal-100',
    description: 'โทนสีเขียวอมฟ้าที่สดชื่นและเย็นสบาย',
    preview: {
      gradient: 'bg-teal-50',
      cardGradient: 'bg-white/90',
      buttonGradient: 'bg-teal-600'
    }
  }
];

interface ThemeContextType {
  currentTheme: ThemeConfig;
  setTheme: (themeName: string) => void;
  themes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState('soft-blue');
  
  const currentTheme = themes.find(t => t.name === themeName) || themes[0];

  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme && themes.find(t => t.name === savedTheme)) {
      setThemeName(savedTheme);
    }

    // Listen for theme change events
    const handleThemeChange = (event: CustomEvent) => {
      setThemeName(event.detail.theme);
    };

    window.addEventListener('theme-changed', handleThemeChange as EventListener);
    
    return () => {
      window.removeEventListener('theme-changed', handleThemeChange as EventListener);
    };
  }, []);

  const setTheme = (newThemeName: string) => {
    if (themes.find(t => t.name === newThemeName)) {
      localStorage.setItem('app-theme', newThemeName);
      setThemeName(newThemeName);
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('theme-changed', { 
        detail: { theme: newThemeName } 
      }));
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { themes };
export type { ThemeConfig };
