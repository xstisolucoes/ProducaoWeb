export type ColorChipStyle = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

function normalizeHex(value: string | null | undefined, fallback: string) {
  const candidate = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(candidate)) return candidate;
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    const red = candidate.charAt(1);
    const green = candidate.charAt(2);
    const blue = candidate.charAt(3);
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }
  return fallback;
}

function channelLuminance(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** Mantém o tom real da tinta e escolhe texto com contraste legível. */
export function colorChipStyle(value: string | null | undefined): ColorChipStyle {
  const backgroundColor = normalizeHex(value, "#dce8ef");
  const red = Number.parseInt(backgroundColor.slice(1, 3), 16);
  const green = Number.parseInt(backgroundColor.slice(3, 5), 16);
  const blue = Number.parseInt(backgroundColor.slice(5, 7), 16);
  const luminance = 0.2126 * channelLuminance(red) + 0.7152 * channelLuminance(green) + 0.0722 * channelLuminance(blue);
  const color = luminance <= 0.32 ? "#ffffff" : "#111111";

  return { backgroundColor, color, borderColor: color === "#ffffff" ? "#ffffff" : "#6b6b6b" };
}

export function colorChipContrastTone(value: string | null | undefined) {
  return colorChipStyle(value).color === "#ffffff" ? "light" : "dark";
}
