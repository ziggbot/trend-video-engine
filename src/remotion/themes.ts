export interface Theme {
  background: string;
  backgroundAlt: string;
  accent: string;
  text: string;
  captionActive: string;
  fontFamily: string;
}

export const THEMES: Record<string, Theme> = {
  midnight: {
    background: '#101024',
    backgroundAlt: '#1c1c3a',
    accent: '#ffd60a',
    text: '#ffffff',
    captionActive: '#ffd60a',
    fontFamily: "'Noto Sans', 'DejaVu Sans', sans-serif"
  },
  ember: {
    background: '#1a0d0d',
    backgroundAlt: '#331414',
    accent: '#ff6b35',
    text: '#fff4ec',
    captionActive: '#ff6b35',
    fontFamily: "'Noto Sans', 'DejaVu Sans', sans-serif"
  },
  ocean: {
    background: '#06202a',
    backgroundAlt: '#0d3a4d',
    accent: '#4cc9f0',
    text: '#f0fbff',
    captionActive: '#4cc9f0',
    fontFamily: "'Noto Sans', 'DejaVu Sans', sans-serif"
  },
  paper: {
    background: '#f5f1e8',
    backgroundAlt: '#e8e0cf',
    accent: '#c1440e',
    text: '#1b1b1b',
    captionActive: '#c1440e',
    fontFamily: "'Noto Sans', 'DejaVu Sans', sans-serif"
  }
};

export function getTheme(name: string): Theme {
  return THEMES[name] ?? THEMES.midnight;
}
