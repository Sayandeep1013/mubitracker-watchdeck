import type { SVGProps } from 'react';

// `ref` is excluded: these are plain function components (no forwardRef), so
// they never support ref forwarding — omitting it here sidesteps a `ref`-typing
// incompatibility between `SVGProps`'s `Ref` and the intrinsic `<svg>` element's
// `LegacyRef` when spreading props built by the `icon()` helper below.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { size?: number };

function icon({ size = 16, className, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    ...props,
  };
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconLibrary(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}

export function IconBookmark(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

export function IconBookmarkPlus(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      <path d="M12 7v6" />
      <path d="M9 10h6" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconExternalLink(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M2 14h4" />
      <path d="M10 8h4" />
      <path d="M18 16h4" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13" />
    </svg>
  );
}
