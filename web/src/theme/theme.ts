import { createTheme, type ThemeOptions } from '@mui/material/styles';

/**
 * Design tokens — kept in sync with src/theme/global.css.
 * The CSS variables in global.css are the source of truth for custom CSS
 * (they use oklch()). These constants mirror them in sRGB/hex form for the
 * MUI palette: MUI's color utilities (decomposeColor/alpha/lighten/darken)
 * do not parse oklch and will throw at createTheme() time.
 * When updating oklch values in global.css, regenerate the hex equivalents here.
 */
type Tokens = {
  bg0: string; bg1: string; bg2: string; bg3: string; bgHover: string;
  borderSoft: string; border: string; borderStrong: string;
  text1: string; text2: string; text3: string; text4: string;
  accent: string; accentStrong: string; accentInk: string;
  pos: string; neg: string; warn: string; info: string;
};

const darkTokens: Tokens = {
  bg0: '#0b0d10',
  bg1: '#121416',
  bg2: '#181b1e',
  bg3: '#212428',
  bgHover: '#26292d',
  borderSoft: 'rgba(42, 46, 51, 0.5)',
  border: 'rgba(51, 57, 62, 0.7)',
  borderStrong: '#474e55',
  text1: '#f3f5f8',
  text2: '#b4b8bc',
  text3: '#7c8186',
  text4: '#53595f',
  accent: '#38c8e8',
  accentStrong: '#55daf7',
  accentInk: '#001c2b',
  pos: '#55c483',
  neg: '#f2716a',
  warn: '#eba941',
  info: '#4baeed',
};

const lightTokens: Tokens = {
  bg0: '#f9fafc',
  bg1: '#ffffff',
  bg2: '#f1f4f6',
  bg3: '#e9ebee',
  bgHover: '#e2e5e8',
  borderSoft: 'rgba(205, 209, 214, 0.7)',
  border: 'rgba(179, 184, 190, 0.7)',
  borderStrong: '#8d9399',
  text1: '#13161a',
  text2: '#393e42',
  text3: '#5f6469',
  text4: '#82878c',
  accent: '#0099bb',
  accentStrong: '#007a97',
  accentInk: '#ffffff',
  pos: '#009351',
  neg: '#cc272e',
  warn: '#bd7400',
  info: '#0079c4',
};

const typography: ThemeOptions['typography'] = {
  fontFamily: '"Inter", "Noto Sans JP", system-ui, sans-serif',
  fontSize: 14,
  h1: { fontWeight: 600, letterSpacing: '-0.02em' },
  h2: { fontWeight: 600, letterSpacing: '-0.02em' },
  h3: { fontWeight: 600, letterSpacing: '-0.015em' },
  h4: { fontWeight: 600, letterSpacing: '-0.01em' },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  button: { fontWeight: 500, textTransform: 'none', letterSpacing: '-0.005em' },
  body1: { letterSpacing: '-0.005em' },
  body2: { letterSpacing: '-0.005em' },
};

function buildComponents(tokens: Tokens): ThemeOptions['components'] {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.bg0,
          color: tokens.text1,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 9,
          height: 34,
          paddingLeft: 14,
          paddingRight: 14,
          fontSize: 13,
        },
        sizeSmall: { height: 28, fontSize: 12 },
        sizeLarge: { height: 40, fontSize: 14 },
        contained: {
          backgroundColor: tokens.accent,
          color: tokens.accentInk,
          fontWeight: 600,
          '&:hover': { backgroundColor: tokens.accentStrong },
        },
        outlined: {
          borderColor: tokens.borderSoft,
          backgroundColor: tokens.bg2,
          color: tokens.text1,
          '&:hover': { backgroundColor: tokens.bg3, borderColor: tokens.border },
        },
        text: {
          color: tokens.text2,
          '&:hover': { backgroundColor: tokens.bg2, color: tokens.text1 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: tokens.text2,
          borderRadius: 9,
          '&:hover': { backgroundColor: tokens.bg2, color: tokens.text1 },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: tokens.bg1,
          color: tokens.text1,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: tokens.bg1,
          border: `1px solid ${tokens.borderSoft}`,
          borderRadius: 16,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: {
          backgroundColor: tokens.bg1,
          borderBottom: `1px solid ${tokens.borderSoft}`,
          color: tokens.text1,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.bg1,
          borderColor: tokens.borderSoft,
          color: tokens.text1,
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.bg1,
          border: `1px solid ${tokens.border}`,
          backgroundImage: 'none',
          borderRadius: 18,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.bg1,
          border: `1px solid ${tokens.borderSoft}`,
          backgroundImage: 'none',
          borderRadius: 12,
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.bg1,
          border: `1px solid ${tokens.borderSoft}`,
          backgroundImage: 'none',
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.bg2,
          borderRadius: 10,
          fontSize: 13,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.borderSoft },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.border },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.accent },
        },
        input: { color: tokens.text1 },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: tokens.text3 } },
    },
    MuiSelect: {
      styleOverrides: { icon: { color: tokens.text3 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: tokens.borderSoft, color: tokens.text1 },
        head: {
          color: tokens.text4,
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: tokens.borderSoft } },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 500,
          height: 22,
          backgroundColor: tokens.bg3,
          color: tokens.text2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: 13,
          color: tokens.text3,
          '&.Mui-selected': { color: tokens.text1 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: tokens.accent },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.bg3,
          color: tokens.text1,
          border: `1px solid ${tokens.borderSoft}`,
          fontSize: 11,
          borderRadius: 6,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          color: tokens.text2,
          '&:hover': { backgroundColor: tokens.bg2, color: tokens.text1 },
          '&.Mui-selected': {
            backgroundColor: tokens.bg3,
            color: tokens.text1,
            '&:hover': { backgroundColor: tokens.bgHover },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { color: 'inherit', minWidth: 36 } },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked': { color: tokens.accent } },
        track: { '.Mui-checked.Mui-checked + &': { backgroundColor: tokens.accent } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontSize: 12.5 },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: { backgroundColor: tokens.neg, color: tokens.text1 },
      },
    },
  };
}

function buildPalette(tokens: Tokens, mode: 'light' | 'dark') {
  return {
    mode,
    primary: {
      main: tokens.accent,
      light: tokens.accentStrong,
      dark: tokens.accent,
      contrastText: tokens.accentInk,
    },
    secondary: { main: tokens.info, contrastText: tokens.text1 },
    success: { main: tokens.pos, contrastText: tokens.accentInk },
    error: { main: tokens.neg, contrastText: tokens.text1 },
    warning: { main: tokens.warn, contrastText: tokens.accentInk },
    info: { main: tokens.info, contrastText: tokens.text1 },
    background: { default: tokens.bg0, paper: tokens.bg1 },
    text: { primary: tokens.text1, secondary: tokens.text3, disabled: tokens.text4 },
    divider: tokens.borderSoft,
    action: {
      hover: tokens.bg2,
      selected: tokens.bg3,
      disabled: tokens.text4,
      disabledBackground: tokens.bg2,
    },
  } as const;
}

export const darkTheme = createTheme({
  typography,
  shape: { borderRadius: 10 },
  palette: buildPalette(darkTokens, 'dark'),
  components: buildComponents(darkTokens),
});

export const lightTheme = createTheme({
  typography,
  shape: { borderRadius: 10 },
  palette: buildPalette(lightTokens, 'light'),
  components: buildComponents(lightTokens),
});
