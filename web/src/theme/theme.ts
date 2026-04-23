import { createTheme, type ThemeOptions } from '@mui/material/styles';

/**
 * Design tokens — kept in sync with src/theme/global.css.
 * The CSS variables in global.css are the source of truth for custom CSS;
 * these constants mirror them for MUI palette / component overrides.
 */
type Tokens = {
  bg0: string; bg1: string; bg2: string; bg3: string; bgHover: string;
  borderSoft: string; border: string; borderStrong: string;
  text1: string; text2: string; text3: string; text4: string;
  accent: string; accentStrong: string; accentInk: string;
  pos: string; neg: string; warn: string; info: string;
};

const darkTokens: Tokens = {
  bg0: 'oklch(0.16 0.006 250)',
  bg1: 'oklch(0.19 0.006 250)',
  bg2: 'oklch(0.22 0.007 250)',
  bg3: 'oklch(0.26 0.008 250)',
  bgHover: 'oklch(0.28 0.009 250)',
  borderSoft: 'oklch(0.30 0.01 250 / 0.5)',
  border: 'oklch(0.34 0.012 250 / 0.7)',
  borderStrong: 'oklch(0.42 0.014 250)',
  text1: 'oklch(0.97 0.005 250)',
  text2: 'oklch(0.78 0.008 250)',
  text3: 'oklch(0.60 0.01 250)',
  text4: 'oklch(0.46 0.012 250)',
  accent: 'oklch(0.74 0.14 155)',
  accentStrong: 'oklch(0.80 0.16 155)',
  accentInk: 'oklch(0.18 0.04 155)',
  pos: 'oklch(0.74 0.14 155)',
  neg: 'oklch(0.70 0.16 25)',
  warn: 'oklch(0.78 0.14 75)',
  info: 'oklch(0.72 0.13 240)',
};

const lightTokens: Tokens = {
  bg0: 'oklch(0.985 0.003 250)',
  bg1: 'oklch(1 0 0)',
  bg2: 'oklch(0.965 0.004 250)',
  bg3: 'oklch(0.94 0.005 250)',
  bgHover: 'oklch(0.92 0.006 250)',
  borderSoft: 'oklch(0.86 0.008 250 / 0.7)',
  border: 'oklch(0.78 0.01 250 / 0.7)',
  borderStrong: 'oklch(0.66 0.012 250)',
  text1: 'oklch(0.20 0.01 250)',
  text2: 'oklch(0.36 0.01 250)',
  text3: 'oklch(0.50 0.01 250)',
  text4: 'oklch(0.62 0.01 250)',
  accent: 'oklch(0.62 0.14 155)',
  accentStrong: 'oklch(0.56 0.16 155)',
  accentInk: 'oklch(1 0 0)',
  pos: 'oklch(0.58 0.15 155)',
  neg: 'oklch(0.55 0.20 25)',
  warn: 'oklch(0.62 0.16 75)',
  info: 'oklch(0.55 0.16 240)',
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
